package com.codelab;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.UpdateOptions;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

import static com.mongodb.client.model.Filters.eq;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyImportService {

    private static final String GITHUB_RAW =
            "https://raw.githubusercontent.com/liquidslr/leetcode-company-wise-problems/main/";

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    // ★ Popular companies for single-problem auto-detect (batch of 40)
    private static final List<String> POPULAR_COMPANIES = List.of(
            "Amazon", "Google", "Microsoft", "Meta", "Apple", "Adobe",
            "Bloomberg", "Uber", "Netflix", "Tesla", "Goldman Sachs",
            "Flipkart", "Swiggy", "Zomato", "Paytm", "PhonePe",
            "Accenture", "Cisco", "Oracle", "Salesforce", "LinkedIn",
            "Twitter", "Airbnb", "Atlassian", "Pinterest", "Snap",
            "ByteDance", "Samsung", "Intel", "Nvidia", "Walmart", "eBay",
            "PayPal", "Stripe", "Zoom", "Dropbox", "Slack", "Spotify"
    );

    // CSV files that exist per company folder in the GitHub repo
    private static final String[] CSV_FILES = {
            "5. All.csv",
            "4. More Than Six Months.csv",
            "3. Six Months.csv",
            "2. Three Months.csv",
            "1. Thirty Days.csv"
    };

    /** Cache: company (lowercased) → CSV body (or null if not found) */
    private final Map<String, String> csvCache = new ConcurrentHashMap<>();

    private final MongoTemplate mongo;

    // ═══════════════════════════════════════════════════════════════
    //  PUBLIC: Bulk import
    // ═══════════════════════════════════════════════════════════════
    public Map<String, Object> importCompanies(List<String> companyNames) {
        Map<String, Object> result = new LinkedHashMap<>();
        int totalCompanies = 0;
        int totalProblemsUpdated = 0;
        List<String> errors = new ArrayList<>();

        if (companyNames == null || companyNames.isEmpty()) {
            result.put("_summary", Map.of(
                    "totalCompanies", 0,
                    "totalProblemsUpdated", 0,
                    "errors", List.of("No companies provided")
            ));
            return result;
        }

        // Dedupe request list (case-insensitive)
        LinkedHashSet<String> uniqueCompanies = new LinkedHashSet<>();
        for (String raw : companyNames) {
            if (raw != null && !raw.isBlank()) uniqueCompanies.add(raw.trim());
        }

        for (String company : uniqueCompanies) {
            try {
                log.info("Importing company: {}", company);
                int updated = importSingleCompany(company);
                totalProblemsUpdated += updated;
                totalCompanies++;
                result.put(company, Map.of("status", "success", "problemsUpdated", updated));
                Thread.sleep(200);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("Failed to import {}: {}", company, e.getMessage());
                result.put(company, Map.of("status", "error", "error", safeMsg(e)));
                errors.add(company + ": " + safeMsg(e));
            }
        }

        result.put("_summary", Map.of(
                "totalCompanies", totalCompanies,
                "totalProblemsUpdated", totalProblemsUpdated,
                "errors", errors
        ));
        return result;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Import one company — ★ raw MongoTemplate write, dedupe-safe
    // ═══════════════════════════════════════════════════════════════
    private int importSingleCompany(String company) throws Exception {
        String csvContent = fetchCompanyCsv(company);
        if (csvContent == null) {
            throw new RuntimeException("No CSV found for " + company);
        }

        List<CompanyProblem> problems = parseCsv(csvContent);
        log.info("Parsed {} problems from {}", problems.size(), company);

        if (problems.isEmpty()) return 0;

        // Valid slugs from problems collection
        Set<String> validSlugs = new HashSet<>();
        for (Document d : mongo.getCollection("problems").find(new Document("slug", 1))) {
            String s = d.getString("slug");
            if (s != null) validSlugs.add(s);
        }

        MongoCollection<Document> metaCol = mongo.getCollection("problem_meta");
        int updated = 0;
        int skippedNoMeta = 0;
        Set<String> seenSlugs = new HashSet<>();

        // Canonical company name (first-seen casing preserved)
        final String canonicalCompany = canonicalize(company);

        for (CompanyProblem cp : problems) {
            String slug = extractSlug(cp.link);
            if (slug == null || !validSlugs.contains(slug)) {
                skippedNoMeta++;
                continue;
            }
            if (!seenSlugs.add(slug)) continue; // same slug multiple times in one CSV

            Document existing = metaCol.find(eq("slug", slug)).first();
            if (existing == null) {
                skippedNoMeta++;
                continue;
            }

            // Normalize existing companies + dedupe (case-insensitive)
            LinkedHashMap<String, String> byLower = new LinkedHashMap<>();
            Object existingCompanies = existing.get("companies");
            if (existingCompanies instanceof List<?> list) {
                for (Object c : list) {
                    if (c == null) continue;
                    String cs = c.toString().trim();
                    if (cs.isEmpty()) continue;
                    byLower.putIfAbsent(cs.toLowerCase(), cs);
                }
            }

            String key = canonicalCompany.toLowerCase();
            if (byLower.containsKey(key)) {
                // Already tagged (case-insensitive) — heal duplicates in DB by rewriting normalized list
                List<String> normalized = new ArrayList<>(byLower.values());
                normalized.sort(String.CASE_INSENSITIVE_ORDER);
                // Only rewrite if length shrank (i.e., dupes were removed)
                int originalSize = (existingCompanies instanceof List<?> l) ? l.size() : 0;
                if (normalized.size() != originalSize) {
                    metaCol.updateOne(
                            eq("slug", slug),
                            new Document("$set", new Document("companies", normalized)),
                            new UpdateOptions().upsert(false)
                    );
                }
                continue;
            }

            // Add company (canonical casing) + sort
            byLower.put(key, canonicalCompany);
            List<String> sorted = new ArrayList<>(byLower.values());
            sorted.sort(String.CASE_INSENSITIVE_ORDER);

            metaCol.updateOne(
                    eq("slug", slug),
                    new Document("$set", new Document("companies", sorted)),
                    new UpdateOptions().upsert(false)
            );

            updated++;
        }

        if (skippedNoMeta > 0) {
            log.info("Skipped {} problems (not in DB) for {}", skippedNoMeta, company);
        }

        return updated;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Auto-detect companies for a SINGLE problem
    // ═══════════════════════════════════════════════════════════════
    public List<String> findCompaniesForProblem(String slug) {
        if (slug == null || slug.isBlank()) return List.of();

        log.info("Auto-detecting companies for slug: {}", slug);

        // Safe slug match: /problems/<slug> followed by path-separator OR boundary
        Pattern slugPattern = Pattern.compile(
                "/problems/" + Pattern.quote(slug) + "(?:[/?#\"',\\s)]|$)"
        );

        List<String> found = Collections.synchronizedList(new ArrayList<>());
        ExecutorService pool = Executors.newFixedThreadPool(10);

        try {
            List<Callable<Void>> tasks = new ArrayList<>();
            for (String company : POPULAR_COMPANIES) {
                tasks.add(() -> {
                    try {
                        String csv = fetchCompanyCsv(company);
                        if (csv == null) return null;
                        if (slugPattern.matcher(csv).find()) {
                            found.add(canonicalize(company));
                            log.debug("✓ {} has {}", company, slug);
                        }
                    } catch (Exception e) {
                        log.debug("Company {} check failed: {}", company, e.getMessage());
                    }
                    return null;
                });
            }

            List<Future<Void>> futures = pool.invokeAll(tasks, 90, TimeUnit.SECONDS);
            for (Future<Void> f : futures) {
                try { f.get(5, TimeUnit.SECONDS); } catch (Exception ignored) {}
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } finally {
            pool.shutdownNow();
        }

        // Dedupe (case-insensitive) + sort
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String c : found) unique.putIfAbsent(c.toLowerCase(), c);
        List<String> sorted = new ArrayList<>(unique.values());
        sorted.sort(String.CASE_INSENSITIVE_ORDER);

        log.info("Found {} companies for {}: {}", sorted.size(), slug, sorted);
        return sorted;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Fetch CSV with cache — tries 5. All.csv → 1. Thirty Days.csv
    // ═══════════════════════════════════════════════════════════════
    private String fetchCompanyCsv(String company) {
        String key = company.toLowerCase();
        if (csvCache.containsKey(key)) return csvCache.get(key);

        for (String csvFile : CSV_FILES) {
            try {
                String url = GITHUB_RAW
                        + encodeSegment(canonicalize(company)) + "/"
                        + encodeSegment(csvFile);

                log.info("Trying: {}", url);

                HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .header("User-Agent", "CodWP-Importer")
                        .GET()
                        .build();

                HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());

                if (res.statusCode() == 200 && !res.body().isBlank()) {
                    csvCache.put(key, res.body());
                    log.info("✓ Fetched {}/{} ({} bytes)", company, csvFile, res.body().length());
                    return res.body();
                }
            } catch (Exception e) {
                log.debug("Fetch failed {}/{}: {}", company, csvFile, e.getMessage());
            }
        }

        csvCache.put(key, null);
        log.warn("✗ No CSV found for {}", company);
        return null;
    }

    // URL-encode a single path segment (space → %20, keep dots)
    private static String encodeSegment(String s) {
        return s.replace(" ", "%20");
    }

    // ═══════════════════════════════════════════════════════════════
    //  CSV parsing — robust against quoted commas & escaped quotes
    // ═══════════════════════════════════════════════════════════════
    private List<CompanyProblem> parseCsv(String csv) {
        List<CompanyProblem> result = new ArrayList<>();
        if (csv == null || csv.isBlank()) return result;

        String[] lines = csv.split("\r?\n");
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) continue;

            try {
                String[] parts = splitCsvLine(line);
                if (parts.length < 5) continue;

                CompanyProblem cp = new CompanyProblem();
                cp.difficulty = parts[0].trim();
                cp.title = parts[1].trim();
                cp.frequency = parseDouble(parts[2]);
                cp.acceptance = parseDouble(parts[3]) * 100;
                cp.link = parts[4].trim();
                cp.topics = parts.length > 5 ? parts[5].replace("\"", "").trim() : "";
                if (cp.link.isBlank()) continue;
                result.add(cp);
            } catch (Exception e) {
                log.debug("Failed to parse line: {}", line);
            }
        }
        return result;
    }

    /** Split a CSV line honoring quoted fields and "" escapes. */
    private String[] splitCsvLine(String line) {
        List<String> parts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;

        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                // Handle escaped "" inside quoted field
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                parts.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        parts.add(cur.toString());
        return parts.toArray(new String[0]);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Slug extraction — safe from URL tails (?query, #hash)
    // ═══════════════════════════════════════════════════════════════
    private String extractSlug(String link) {
        if (link == null) return null;
        int idx = link.indexOf("/problems/");
        if (idx < 0) return null;
        String rest = link.substring(idx + "/problems/".length());
        int end = rest.length();
        for (int i = 0; i < rest.length(); i++) {
            char c = rest.charAt(i);
            if (c == '/' || c == '?' || c == '#') { end = i; break; }
        }
        String slug = rest.substring(0, end).trim();
        return slug.isEmpty() ? null : slug;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Helpers
    // ═══════════════════════════════════════════════════════════════

    /** Trim, collapse internal whitespace, preserve case. */
    private static String canonicalize(String s) {
        if (s == null) return "";
        return s.trim().replaceAll("\\s+", " ");
    }

    private double parseDouble(String s) {
        try { return Double.parseDouble(s.trim()); }
        catch (Exception e) { return 0.0; }
    }

    private static String safeMsg(Throwable t) {
        if (t == null) return "unknown error";
        String m = t.getMessage();
        return m == null || m.isBlank() ? t.getClass().getSimpleName() : m;
    }

    static class CompanyProblem {
        String difficulty, title, link, topics;
        double frequency, acceptance;
    }
}