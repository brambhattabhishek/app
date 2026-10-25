package com.codelab;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyImportService {

    private static final String GITHUB_RAW = "https://raw.githubusercontent.com/liquidslr/leetcode-company-wise-problems/main/";
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    // ★ Popular companies to check when auto-detecting a single problem
    // (Checking all 300+ would take too long per add — 40 is a good balance)
    private static final List<String> POPULAR_COMPANIES = List.of(
            "Amazon", "Google", "Microsoft", "Meta", "Apple", "Adobe",
            "Bloomberg", "Uber", "Netflix", "Tesla", "Goldman Sachs",
            "Flipkart", "Swiggy", "Zomato", "Paytm", "PhonePe",
            "Accenture", "Cisco", "Oracle", "Salesforce", "LinkedIn",
            "Twitter", "Airbnb", "Atlassian", "Pinterest", "Snap",
            "ByteDance", "Samsung", "Intel", "Nvidia", "Walmart", "eBay",
            "PayPal", "Stripe", "Zoom", "Dropbox", "Slack", "Spotify", "Adobe"
    );

    // ★ Cache CSV per company (avoid re-fetching)
    private final Map<String, String> csvCache = new ConcurrentHashMap<>();

    private final ProblemRepository problemRepo;
    private final ProblemMetaRepository metaRepo;

    // ═══════════════════════════════════════════════════════════════
    //  PUBLIC: Bulk import (existing method — user clicks button)
    // ═══════════════════════════════════════════════════════════════
    public Map<String, Object> importCompanies(List<String> companyNames) {
        Map<String, Object> result = new LinkedHashMap<>();
        int totalCompanies = 0;
        int totalProblemsUpdated = 0;
        List<String> errors = new ArrayList<>();

        for (String company : companyNames) {
            try {
                log.info("Importing company: {}", company);
                int updated = importSingleCompany(company);
                totalProblemsUpdated += updated;
                totalCompanies++;
                result.put(company, Map.of("status", "success", "problemsUpdated", updated));
                Thread.sleep(300);
            } catch (Exception e) {
                log.error("Failed to import {}: {}", company, e.getMessage());
                result.put(company, Map.of("status", "error", "error", e.getMessage()));
                errors.add(company + ": " + e.getMessage());
            }
        }

        result.put("_summary", Map.of(
                "totalCompanies", totalCompanies,
                "totalProblemsUpdated", totalProblemsUpdated,
                "errors", errors
        ));
        return result;
    }

    private int importSingleCompany(String company) throws Exception {
        String csvContent = fetchCompanyCsv(company);
        if (csvContent == null) {
            throw new RuntimeException("No CSV found for " + company);
        }

        List<CompanyProblem> problems = parseCsv(csvContent);
        log.info("Parsed {} problems from {}", problems.size(), company);

        int updated = 0;
        int skippedNoMeta = 0;

        for (CompanyProblem cp : problems) {
            String slug = extractSlug(cp.link);
            if (slug == null) continue;

            var metaOpt = metaRepo.findBySlug(slug);
            if (metaOpt.isPresent()) {
                ProblemMeta meta = metaOpt.get();
                if (meta.getCompanies() == null) meta.setCompanies(new ArrayList<>());
                if (!meta.getCompanies().contains(company)) {
                    meta.getCompanies().add(company);
                    metaRepo.save(meta);
                    updated++;
                }
            } else {
                skippedNoMeta++;
            }
        }

        if (skippedNoMeta > 0) {
            log.info("Skipped {} problems (not in DB) for {}", skippedNoMeta, company);
        }

        return updated;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ★ NEW: Auto-detect companies for a SINGLE problem
    //  Called from LeetCodeAdminService.addProblems()
    // ═══════════════════════════════════════════════════════════════
    public List<String> findCompaniesForProblem(String slug) {
        if (slug == null || slug.isBlank()) return List.of();

        log.info("Auto-detecting companies for slug: {}", slug);
        List<String> found = Collections.synchronizedList(new ArrayList<>());

        ExecutorService pool = Executors.newFixedThreadPool(10);
        try {
            List<Callable<Void>> tasks = new ArrayList<>();
            for (String company : POPULAR_COMPANIES) {
                tasks.add(() -> {
                    try {
                        String csv = fetchCompanyCsv(company);
                        if (csv == null) return null;

                        // Check if slug exists in CSV
                        if (csv.contains("/problems/" + slug + "\"") ||
                                csv.contains("/problems/" + slug + ",") ||
                                csv.contains("/problems/" + slug + "\n") ||
                                csv.endsWith("/problems/" + slug)) {
                            found.add(company);
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

        // Sort alphabetically for consistency
        List<String> sorted = new ArrayList<>(found);
        Collections.sort(sorted);
        log.info("Found {} companies for {}: {}", sorted.size(), slug, sorted);
        return sorted;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Fetch CSV with cache
    // ═══════════════════════════════════════════════════════════════
    private String fetchCompanyCsv(String company) {
        // Check cache first
        if (csvCache.containsKey(company)) {
            return csvCache.get(company);
        }

        String[] csvFiles = {
                "5. All.csv",
                "4. More Than Six Months.csv",
                "3. Six Months.csv",
                "2. Three Months.csv",
                "1. Thirty Days.csv"
        };

        for (String csvFile : csvFiles) {
            try {
                String encodedCompany = company.replace(" ", "%20");
                String encodedFile = csvFile.replace(" ", "%20");
                String url = GITHUB_RAW + encodedCompany + "/" + encodedFile;

                log.info("Trying: {}", url);

                HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .header("User-Agent", "CodWP-Importer")
                        .GET().build();
                HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());

                if (res.statusCode() == 200) {
                    String body = res.body();
                    csvCache.put(company, body);
                    log.info("✓ Fetched {}/{} ({} bytes)", company, csvFile, body.length());
                    return body;
                }
            } catch (Exception e) {
                log.debug("Fetch failed {}/{}: {}", company, csvFile, e.getMessage());
            }
        }

        // Cache miss (company doesn't exist)
        csvCache.put(company, null);
        log.warn("✗ No CSV found for {}", company);
        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    //  CSV parsing helpers
    // ═══════════════════════════════════════════════════════════════
    private List<CompanyProblem> parseCsv(String csv) {
        List<CompanyProblem> result = new ArrayList<>();
        String[] lines = csv.split("\n");

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
                result.add(cp);
            } catch (Exception e) {
                log.warn("Failed to parse line: {}", line);
            }
        }
        return result;
    }

    private String[] splitCsvLine(String line) {
        List<String> parts = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                parts.add(cur.toString());
                cur = new StringBuilder();
            } else {
                cur.append(c);
            }
        }
        parts.add(cur.toString());
        return parts.toArray(new String[0]);
    }

    private String extractSlug(String link) {
        if (link == null) return null;
        String[] parts = link.split("/problems/");
        if (parts.length < 2) return null;
        return parts[1].split("/")[0];
    }

    private double parseDouble(String s) {
        try { return Double.parseDouble(s.trim()); }
        catch (Exception e) { return 0.0; }
    }

    static class CompanyProblem {
        String difficulty, title, link, topics;
        double frequency, acceptance;
    }
}