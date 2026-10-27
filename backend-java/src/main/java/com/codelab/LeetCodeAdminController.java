package com.codelab;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/leetcode")
@RequiredArgsConstructor
public class LeetCodeAdminController {

    private final LeetCodeAdminService service;
    private final CompanyImportService companyImportService;

    /** Body: { "numbers": "1 3 5" } or "1,3,5". Returns { success, added: [...] } */
    @PostMapping("/add")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> addProblems(@RequestBody Map<String, String> body) {
        try {
            String numbers = body == null ? null : body.get("numbers");
            if (numbers == null || numbers.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Missing 'numbers' field"));
            }
            List<Integer> added = service.addProblems(numbers);
            return ResponseEntity.ok(Map.of("success", true, "added", added));
        } catch (NumberFormatException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("success", false, "error", "Invalid problem number in: " + body.get("numbers")));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/delete")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteProblems(@RequestBody Map<String, String> body) {
        try {
            String input = body == null ? null : body.get("numbers");
            if (input == null || input.isBlank()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Missing 'numbers' field"));
            }
            Map<String, Object> result = service.deleteProblems(input);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    @PostMapping("/import-companies")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> importCompanies(@RequestBody Map<String, List<String>> body) {
        try {
            List<String> companies = body == null ? List.of() : body.getOrDefault("companies", List.of());
            if (companies.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Provide 'companies' array"));
            }
            Map<String, Object> result = companyImportService.importCompanies(companies);
            return ResponseEntity.ok(Map.of("success", true, "result", result));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    /** Kicks off full refresh in background. Returns immediately. */
    @PostMapping("/fetch-all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> fetchAll(@RequestBody(required = false) Map<String, String> body) {
        if (service.isFetchingAll()) {
            return ResponseEntity.status(409)
                    .body(Map.of("success", false, "error", "A full fetch is already running"));
        }

        if (body != null && body.get("cookie") != null) {
            service.setSessionCookie(body.get("cookie"));
        }

        service.fetchAllAsync();   // @Async — returns immediately
        return ResponseEntity.ok(Map.of("started", true));
    }

    /** One-time seed from existing JSON files. Safe to call repeatedly (upserts). */
    @PostMapping("/migrate-json")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> migrate() {
        try {
            int n = service.migrateJsonToMongo();
            return ResponseEntity.ok(Map.of("migrated", n));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ★ NEW — Refresh companies for one or more problems
    //  Body: { "slugs": ["two-sum", "triangle"] }  OR  { "numbers": "1 120" }
    //  Scans ALL 300+ company CSVs, replaces meta.companies.
    // ═══════════════════════════════════════════════════════════════
    @PostMapping("/refresh-companies")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> refreshCompanies(@RequestBody Map<String, Object> body) {
        try {
            List<String> slugs;

            if (body != null && body.get("slugs") instanceof List<?> list) {
                slugs = list.stream()
                        .filter(java.util.Objects::nonNull)
                        .map(Object::toString)
                        .map(String::trim)
                        .filter(s -> !s.isEmpty())
                        .toList();
            } else if (body != null && body.get("numbers") != null) {
                slugs = service.resolveSlugsForNumbers(body.get("numbers").toString());
            } else {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "Provide 'slugs' array or 'numbers' string"));
            }

            if (slugs.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(Map.of("success", false, "error", "No valid slugs to refresh"));
            }

            Map<String, Object> result = service.refreshCompaniesForSlugs(slugs);
            return ResponseEntity.ok(Map.of("success", true, "result", result));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ★ NEW — Refresh companies for ALL problems in DB
    //  Runs synchronously — can take 10-30 min for 3000 problems.
    //  Returns when complete (or times out via gateway).
    // ═══════════════════════════════════════════════════════════════
    @PostMapping("/refresh-companies-all")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> refreshCompaniesAll() {
        try {
            Map<String, Object> result = service.refreshCompaniesForAll();
            return ResponseEntity.ok(Map.of("success", true, "result", result));
        } catch (Exception e) {
            return ResponseEntity.internalServerError()
                    .body(Map.of("success", false, "error", e.getMessage()));
        }
    }
}