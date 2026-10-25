package com.codelab;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CompanyImportService {

    private static final String GITHUB_RAW = "https://raw.githubusercontent.com/liquidslr/leetcode-company-wise-problems/main/";
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private final ProblemRepository problemRepo;
    private final ProblemMetaRepository metaRepo;

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
        // ★ Try multiple CSV filenames (repo has different naming)
        String[] csvFiles = {"All.csv", "1. All.csv", "all.csv", "3. All.csv", "6. All.csv"};
        String csvContent = null;

        for (String csvFile : csvFiles) {
            try {
                String url = GITHUB_RAW + encodePath(company) + "/" + encodePath(csvFile);
                HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .header("User-Agent", "CodWP-Importer")
                        .GET().build();
                HttpResponse<String> res = CLIENT.send(req, HttpResponse.BodyHandlers.ofString());
                if (res.statusCode() == 200) {
                    csvContent = res.body();
                    log.info("Found {}/{} ({} bytes)", company, csvFile, csvContent.length());
                    break;
                }
            } catch (Exception ignored) {}
        }

        if (csvContent == null) {
            throw new RuntimeException("No CSV found for " + company + " (tried All.csv, 1. All.csv, etc.)");
        }

        // Parse CSV
        List<CompanyProblem> problems = parseCsv(csvContent);
        log.info("Parsed {} problems from {}", problems.size(), company);

        int updated = 0;
        int skippedNoMeta = 0;

        for (CompanyProblem cp : problems) {
            String slug = extractSlug(cp.link);
            if (slug == null) continue;

            // ★ UPDATE ProblemMeta (companies stored here, not Problem)
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
                // ProblemMeta doesn't exist for this slug — problem not yet added to DB
                skippedNoMeta++;
            }
        }

        if (skippedNoMeta > 0) {
            log.info("Skipped {} problems (not in DB) for {}", skippedNoMeta, company);
        }

        return updated;
    }

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

    private String encodePath(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20");
    }

    static class CompanyProblem {
        String difficulty, title, link, topics;
        double frequency, acceptance;
    }
}