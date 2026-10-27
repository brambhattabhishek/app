package com.codelab;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;
import java.util.function.Function;

import static com.mongodb.client.model.Filters.and;
import static com.mongodb.client.model.Filters.eq;
import static com.mongodb.client.model.Filters.gte;

@RestController
@RequestMapping("/api")
public class ApiController {
    @Autowired MongoTemplate mongo;
    @Autowired Executor executor;
    @Autowired AuthService auth;
    @Autowired DailyController daily;
    @Autowired ProblemMetaRepository metaRepo;

    static final List<String> LANGS = List.of("python", "java", "cpp", "javascript");

    record RunReq(String slug, String language, String code, List<String> inputs) {}
    record SubmitReq(String slug, String language, String code) {}

    Document problem(String slug) {
        Document d = mongo.getCollection("problems").find(eq("slug", slug)).first();
        if (d == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Problem not found");
        return d;
    }

    static Map<String, Object> clean(Document d) {
        Map<String, Object> m = new LinkedHashMap<>(d);
        m.remove("_id");
        return m;
    }

    static Object idOf(Document d) {
        Object idObj = d.get("id");
        if (idObj == null) idObj = d.get("_id");
        return idObj;
    }

    void validate(String lang, String code, Document p, List<String> inputs) {
        if (!LANGS.contains(lang)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported language");
        if (code == null || code.isBlank() || code.length() > 50_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code is empty or too long");
        if (inputs == null || inputs.isEmpty() || inputs.size() > 30) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide 1-30 testcases");
        int k = CodeTemplates.params(p).size();
        if (k == 0) return;
        for (String in : inputs)
            if (in == null || in.strip().split("\n").length != k || Arrays.stream(in.strip().split("\n")).anyMatch(String::isBlank))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each testcase needs exactly " + k + " non-empty value(s)");
    }

    // ═══════════════════════════════════════════════════════════════
    //  ★ RAW DOC HELPERS — bypass Spring Data quirks
    // ═══════════════════════════════════════════════════════════════

    /** Get raw problem_meta document for a slug (bypasses metaRepo). */
    private Document metaDoc(String slug) {
        if (slug == null) return null;
        return mongo.getCollection("problem_meta").find(eq("slug", slug)).first();
    }

    /** Extract companies list from a raw meta document — null-safe. */
    private static List<String> companiesOf(Document meta) {
        if (meta == null) return List.of();
        Object obj = meta.get("companies");
        if (!(obj instanceof List<?> list)) return List.of();
        return list.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .sorted()
                .toList();
    }

    /** Extract a string list from a raw meta field — null-safe. */
    private static List<String> stringListOf(Document meta, String key) {
        if (meta == null) return List.of();
        Object obj = meta.get(key);
        if (!(obj instanceof List<?> list)) return List.of();
        return list.stream()
                .filter(Objects::nonNull)
                .map(Object::toString)
                .toList();
    }

    // ═══════════════════════════════════════════════════════════════
    //  ★ companyToSlugs() — FIXED: uses raw problem_meta docs
    //  Reads directly from MongoTemplate → no metaRepo.findAll() issues.
    // ═══════════════════════════════════════════════════════════════
    private Map<String, Set<String>> companyToSlugs() {
        // 1. Valid slugs from problems collection
        Set<String> validSlugs = new HashSet<>();
        for (Document p : mongo.getCollection("problems").find(new Document("slug", 1))) {
            String s = p.getString("slug");
            if (s != null) validSlugs.add(s);
        }

        // 2. Iterate problem_meta raw docs
        Map<String, Set<String>> map = new TreeMap<>();
        for (Document meta : mongo.getCollection("problem_meta").find()) {
            String slug = meta.getString("slug");
            if (slug == null || !validSlugs.contains(slug)) continue;

            Object companiesObj = meta.get("companies");
            if (!(companiesObj instanceof List<?> list)) continue;

            for (Object c : list) {
                if (c == null) continue;
                String cs = c.toString().trim();
                if (cs.isEmpty()) continue;
                map.computeIfAbsent(cs, k -> new HashSet<>()).add(slug);
            }
        }

        // 3. Debug log — helps confirm fix on Render
        long metaCount = mongo.getCollection("problem_meta").countDocuments();
        System.out.println("[companyToSlugs] validSlugs=" + validSlugs.size()
                + ", metaCount=" + metaCount
                + ", companiesInMap=" + map.size());

        return map;
    }

    private Map<String, List<String>> companiesBySlug() {
        Map<String, List<String>> out = new HashMap<>();
        companyToSlugs().forEach((company, slugs) ->
                slugs.forEach(slug -> out.computeIfAbsent(slug, k -> new ArrayList<>()).add(company)));
        out.values().forEach(Collections::sort);
        return out;
    }

    @GetMapping("/health")
    public Map<String, Object> health() { return Map.of("ok", true, "backend", "java-spring-boot"); }

    // ═══════════════════════════════════════════════════════════════
    //  PROBLEMS — guest browsable
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/problems")
    public List<Map<String, Object>> list(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.optional(h);
        Set<String> solved = new HashSet<>(), attempted = new HashSet<>();
        if (u != null) {
            for (Document s : mongo.getCollection("submissions").find(eq("user_id", u.getString("user_id")))) {
                attempted.add(s.getString("slug"));
                if ("Accepted".equals(s.getString("status"))) solved.add(s.getString("slug"));
            }
        }

        Map<String, List<String>> companiesBySlug = companiesBySlug();

        List<Map<String, Object>> out = new ArrayList<>();
        for (Document d : mongo.getCollection("problems").find().sort(new Document("_id", 1))) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", idOf(d));
            for (String k : List.of("slug", "title", "difficulty", "tags", "acceptance")) {
                m.put(k, d.get(k));
            }
            String slug = d.getString("slug");
            m.put("companies", companiesBySlug.getOrDefault(slug, List.of()));
            m.put("status", solved.contains(slug) ? "solved" : attempted.contains(slug) ? "attempted" : "todo");
            out.add(m);
        }
        return out;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ★ DETAIL — FIXED: raw meta read instead of metaRepo.findBySlug
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/problems/{slug}")
    public Map<String, Object> detail(@PathVariable String slug,
                                      @RequestHeader(value = "Authorization", required = false) String h) {
        Document d = problem(slug);
        Document u = auth.optional(h);
        if (u != null) progress(u, slug, new Document("last_opened", new Date()));

        Map<String, Object> m = clean(d);
        m.remove("hiddenTests");
        m.put("id", idOf(d));

        // ★ Read meta directly from MongoTemplate
        Document meta = metaDoc(slug);
        m.put("hints", stringListOf(meta, "hints"));
        m.put("companies", companiesOf(meta));
        m.put("edgeCases", stringListOf(meta, "edgeCases"));
        Object exp = meta == null ? null : meta.get("explanation");
        m.put("explanation", exp == null ? "" : exp.toString());

        if (m.get("constraints") == null) m.put("constraints", List.of());

        m.put("boilerplates", CodeTemplates.boilerplates(d));
        return m;
    }

    // ═══════════════════════════════════════════════════════════════
    //  RUN — guest allowed, null-safe reference code
    // ═══════════════════════════════════════════════════════════════
    @PostMapping("/run")
    public Map<String, Object> run(@RequestBody RunReq r,
                                   @RequestHeader(value = "Authorization", required = false) String h) {
        Document p = problem(r.slug());

        Document u = auth.optional(h);
        if (u != null) {
            progress(u, r.slug(), new Document("last_opened", new Date()).append("last_run", new Date()));
        }

        List<String> raw;
        if (r.inputs() == null || r.inputs().isEmpty()) {
            raw = Optional.ofNullable(p.getList("sampleTests", Document.class)).orElse(List.of())
                    .stream()
                    .map(t -> t.getString("input"))
                    .filter(Objects::nonNull)
                    .toList();
        } else {
            raw = r.inputs();
        }

        validate(r.language(), r.code(), p, raw);
        List<String> inputs = raw.stream().map(String::strip).toList();

        Executor.ExecResult res = executor.run(r.language(), r.code(), p, inputs);
        List<String> expectedOutputs = computeExpected(p, inputs);

        List<Map<String, Object>> cases = new ArrayList<>();
        boolean allComparable = true;
        boolean allPass = res.status().equals("OK");

        for (int i = 0; i < inputs.size(); i++) {
            String o = i < res.outputs().size() ? res.outputs().get(i) : null;
            String e = i < expectedOutputs.size() ? expectedOutputs.get(i) : null;
            boolean comparable = e != null;
            boolean pass = comparable && o != null && o.equals(e);

            if (!comparable) allComparable = false;
            allPass &= pass;

            Map<String, Object> c = new LinkedHashMap<>();
            c.put("input", inputs.get(i));
            c.put("output", o);
            c.put("expected", e);
            c.put("stdout", i < res.logs().size() ? res.logs().get(i) : "");
            c.put("passed", pass);
            c.put("comparable", comparable);
            cases.add(c);
        }

        String status;
        if (!res.status().equals("OK")) {
            status = res.status();
        } else if (!allComparable) {
            status = "Ran";
        } else {
            status = allPass ? "Accepted" : "Wrong Answer";
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("runtimeMs", res.runtimeMs());
        out.put("error", res.error());
        out.put("status", status);
        out.put("cases", cases);
        return out;
    }

    private List<String> computeExpected(Document p, List<String> inputs) {
        List<String> fallback = Collections.nCopies(inputs.size(), (String) null);
        try {
            Document ed = p.get("editorial", Document.class);
            if (ed == null) return fallback;
            String refCode = ed.getString("code");
            if (refCode == null || refCode.isBlank()) return fallback;

            Executor.ExecResult ref = executor.run("python", refCode, p, inputs);
            if (!"OK".equals(ref.status())) return fallback;

            List<String> outs = new ArrayList<>(ref.outputs());
            while (outs.size() < inputs.size()) outs.add(null);
            return outs;
        } catch (Exception e) {
            return fallback;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  SUBMIT — login required
    // ═══════════════════════════════════════════════════════════════
    @PostMapping("/submit")
    public Map<String, Object> submit(@RequestHeader(value = "Authorization", required = false) String h,
                                      @RequestBody SubmitReq r) {
        Document u = auth.require(h);
        Document p = problem(r.slug());

        List<Document> tests = new ArrayList<>();
        List<Document> samples = Optional.ofNullable(p.getList("sampleTests", Document.class)).orElse(List.of());
        List<Document> hidden  = Optional.ofNullable(p.getList("hiddenTests", Document.class)).orElse(List.of());
        tests.addAll(samples);
        tests.addAll(hidden);

        if (tests.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No test cases configured for this problem");
        }

        List<String> inputs = tests.stream().map(t -> t.getString("input")).toList();
        validate(r.language(), r.code(), p, inputs);

        Executor.ExecResult res = executor.run(r.language(), r.code(), p, inputs);

        int passed = 0;
        Map<String, Object> failed = null;
        for (int i = 0; i < tests.size(); i++) {
            String o = i < res.outputs().size() ? res.outputs().get(i) : null;
            String e = tests.get(i).getString("expected");
            if (o != null && o.equals(e)) passed++;
            else if (failed == null) {
                failed = new LinkedHashMap<>();
                failed.put("input", inputs.get(i));
                failed.put("output", o);
                failed.put("expected", e);
                failed.put("stdout", i < res.logs().size() ? res.logs().get(i) : "");
            }
        }

        String status = !res.status().equals("OK")
                ? res.status()
                : passed == tests.size() ? "Accepted" : "Wrong Answer";

        Document sub = new Document("submission_id", UUID.randomUUID().toString())
                .append("user_id", u.getString("user_id"))
                .append("slug", p.getString("slug"))
                .append("title", p.getString("title"))
                .append("difficulty", p.getString("difficulty"))
                .append("language", r.language())
                .append("code", r.code())
                .append("status", status)
                .append("passed", passed)
                .append("total", tests.size())
                .append("runtimeMs", res.runtimeMs())
                .append("created_at", new Date());
        mongo.getCollection("submissions").insertOne(sub);

        progress(u, p.getString("slug"), new Document("last_opened", new Date()).append("last_status", status));

        Map<String, Object> out = clean(sub);
        out.put("failedCase", failed);
        out.put("daily", "Accepted".equals(status) ? daily.onAccepted(u, p.getString("slug")) : null);
        out.put("error", res.error());
        return out;
    }

    void progress(Document u, String slug, Document set) {
        mongo.getCollection("progress").updateOne(
                and(eq("user_id", u.getString("user_id")), eq("slug", slug)),
                new Document("$set", set).append("$setOnInsert", new Document("first_opened", new Date())),
                new com.mongodb.client.model.UpdateOptions().upsert(true));
    }

    // ═══════════════════════════════════════════════════════════════
    //  summary() — id fallback (daily challenge fix)
    // ═══════════════════════════════════════════════════════════════
    static Map<String, Object> summary(Document d) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", idOf(d));
        for (String k : List.of("slug", "title", "difficulty", "tags", "acceptance")) {
            m.put(k, d.get(k));
        }
        return m;
    }

    // ★ FIXED: raw meta read
    Map<String, Object> summaryWithCompanies(Document d) {
        Map<String, Object> m = summary(d);
        m.put("companies", companiesOf(metaDoc(d.getString("slug"))));
        return m;
    }

    // ═══════════════════════════════════════════════════════════════
    //  RECOMMENDATIONS — 3-tier fallback chain
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/recommendations")
    public Map<String, Object> recommendations(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.require(h);
        String uid = u.getString("user_id");

        Map<String, Document> probs = new LinkedHashMap<>();
        for (Document d : mongo.getCollection("problems").find().sort(new Document("id", 1)))
            probs.put(d.getString("slug"), d);

        Set<String> solved = new HashSet<>(), attempted = new HashSet<>();
        for (Document s : mongo.getCollection("submissions").find(eq("user_id", uid))) {
            attempted.add(s.getString("slug"));
            if ("Accepted".equals(s.getString("status"))) solved.add(s.getString("slug"));
        }

        // ── Pending ──
        List<Map<String, Object>> pending = new ArrayList<>();
        for (Document pr : mongo.getCollection("progress").find(eq("user_id", uid)).sort(new Document("last_opened", -1))) {
            String sl = pr.getString("slug");
            if (solved.contains(sl) || !probs.containsKey(sl) || pending.size() >= 5) continue;
            Map<String, Object> m = summaryWithCompanies(probs.get(sl));
            m.put("reason", attempted.contains(sl)
                    ? "Attempted · " + Optional.ofNullable(pr.getString("last_status")).orElse("not accepted")
                    : "Opened, not solved yet");
            m.put("last_opened", pr.get("last_opened"));
            pending.add(m);
        }

        // ── Score tags ──
        Map<String, Integer> score = new HashMap<>();
        for (String sl : attempted) {
            if (!probs.containsKey(sl)) continue;
            for (String t : Optional.ofNullable(probs.get(sl).getList("tags", String.class)).orElse(List.of()))
                score.merge(t, solved.contains(sl) ? 2 : 1, Integer::sum);
        }
        for (String t : Optional.ofNullable(u.getList("interests", String.class)).orElse(List.of()))
            score.merge(t, 3, Integer::sum);

        List<String> topTags = score.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .limit(3).map(Map.Entry::getKey).toList();

        Set<String> pendingSlugs = pending.stream().map(m -> (String) m.get("slug")).collect(Collectors.toSet());

        // ── Tier 1: tag-based ──
        List<Map<String, Object>> rec = new ArrayList<>();
        if (!topTags.isEmpty()) {
            rec = probs.values().stream()
                    .filter(d -> !solved.contains(d.getString("slug")) && !pendingSlugs.contains(d.getString("slug")))
                    .map(d -> {
                        List<String> tags = Optional.ofNullable(d.getList("tags", String.class)).orElse(List.of());
                        int s = tags.stream().mapToInt(t -> topTags.contains(t) ? score.getOrDefault(t, 0) : 0).sum();
                        return Map.entry(d, s);
                    })
                    .filter(e -> e.getValue() > 0)
                    .sorted((a, b) -> b.getValue() - a.getValue())
                    .limit(6)
                    .map(e -> {
                        Map<String, Object> m = summaryWithCompanies(e.getKey());
                        List<String> tags = Optional.ofNullable(e.getKey().getList("tags", String.class)).orElse(List.of());
                        String match = tags.stream().filter(topTags::contains).findFirst().orElse("");
                        m.put("reason", match.isEmpty() ? "Matches your interests" : "Matches your interest: " + match);
                        return m;
                    })
                    .collect(Collectors.toList());
        }

        // ── Tier 2: same difficulty ──
        if (rec.isEmpty() && !attempted.isEmpty()) {
            Map<String, Long> diffCount = attempted.stream()
                    .filter(probs::containsKey)
                    .map(sl -> probs.get(sl).getString("difficulty"))
                    .filter(Objects::nonNull)
                    .collect(Collectors.groupingBy(d -> d, Collectors.counting()));

            String favDiff = diffCount.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);

            if (favDiff != null) {
                final String diff = favDiff;
                rec = probs.values().stream()
                        .filter(d -> !solved.contains(d.getString("slug")) && !pendingSlugs.contains(d.getString("slug")))
                        .filter(d -> diff.equals(d.getString("difficulty")))
                        .sorted((a, b) -> {
                            double aa = a.get("acceptance") instanceof Number ? ((Number) a.get("acceptance")).doubleValue() : 0;
                            double bb = b.get("acceptance") instanceof Number ? ((Number) b.get("acceptance")).doubleValue() : 0;
                            return Double.compare(bb, aa);
                        })
                        .limit(6)
                        .map(d -> {
                            Map<String, Object> m = summaryWithCompanies(d);
                            m.put("reason", "More " + diff + " problems");
                            return m;
                        })
                        .collect(Collectors.toList());
            }
        }

        // ── Tier 3: popular Easy ──
        if (rec.isEmpty()) {
            rec = probs.values().stream()
                    .filter(d -> !solved.contains(d.getString("slug")) && !pendingSlugs.contains(d.getString("slug")))
                    .filter(d -> "Easy".equals(d.getString("difficulty")))
                    .sorted((a, b) -> {
                        double aa = a.get("acceptance") instanceof Number ? ((Number) a.get("acceptance")).doubleValue() : 0;
                        double bb = b.get("acceptance") instanceof Number ? ((Number) b.get("acceptance")).doubleValue() : 0;
                        return Double.compare(bb, aa);
                    })
                    .limit(6)
                    .map(d -> {
                        Map<String, Object> m = summaryWithCompanies(d);
                        m.put("reason", "Popular easy starter");
                        return m;
                    })
                    .collect(Collectors.toList());
        }

        String strategy = !topTags.isEmpty() ? "by-tags"
                : !attempted.isEmpty() ? "by-difficulty"
                : "easy-start";

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pending", pending);
        out.put("recommended", rec);
        out.put("topTags", topTags);
        out.put("strategy", strategy);
        return out;
    }

    // ═══════════════════════════════════════════════════════════════
    //  COMPANIES — guest browsable
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/companies")
    public List<Map<String, Object>> companies(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.optional(h);
        Set<String> solved = new HashSet<>();
        if (u != null) {
            for (Document s : mongo.getCollection("submissions").find(eq("user_id", u.getString("user_id")))) {
                if ("Accepted".equals(s.getString("status"))) solved.add(s.getString("slug"));
            }
        }

        List<Map<String, Object>> out = new ArrayList<>();
        companyToSlugs().forEach((company, slugs) -> {
            long solvedCount = slugs.stream().filter(solved::contains).count();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("name", company);
            m.put("count", slugs.size());
            m.put("solved", (int) solvedCount);
            out.add(m);
        });
        out.sort((a, b) -> (int) b.get("count") - (int) a.get("count"));
        return out;
    }

    @GetMapping("/companies/{name}")
    public Map<String, Object> company(@PathVariable String name,
                                       @RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.optional(h);
        Map<String, String> statusMap = new HashMap<>();
        if (u != null) {
            for (Document s : mongo.getCollection("submissions").find(eq("user_id", u.getString("user_id")))) {
                String sl = s.getString("slug");
                if ("Accepted".equals(s.getString("status"))) statusMap.put(sl, "solved");
                else statusMap.putIfAbsent(sl, "attempted");
            }
        }

        Set<String> slugs = companyToSlugs().get(name);
        if (slugs == null || slugs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found");
        }

        List<Map<String, Object>> list = new ArrayList<>();
        Map<String, int[]> byDiff = new LinkedHashMap<>();
        byDiff.put("Easy", new int[2]);
        byDiff.put("Medium", new int[2]);
        byDiff.put("Hard", new int[2]);

        for (String slug : slugs) {
            Document p = mongo.getCollection("problems").find(eq("slug", slug)).first();
            if (p == null) continue;

            Map<String, Object> m = summary(p);
            m.put("companies", List.of(name));
            String s = statusMap.getOrDefault(slug, "todo");
            m.put("status", s);
            list.add(m);

            int[] a = byDiff.get(p.getString("difficulty"));
            if (a != null) {
                a[0]++;
                if ("solved".equals(s)) a[1]++;
            }
        }

        List<String> diffOrder = List.of("Easy", "Medium", "Hard");
        list.sort(Comparator
                .comparingInt((Map<String, Object> m) -> {
                    int i = diffOrder.indexOf((String) m.get("difficulty"));
                    return i < 0 ? 99 : i;
                })
                .thenComparing(m -> String.valueOf(m.get("title"))));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("problems", list);
        out.put("total", list.size());
        out.put("solved", list.stream().filter(m -> "solved".equals(m.get("status"))).count());

        Map<String, Object> d = new LinkedHashMap<>();
        byDiff.forEach((k, a) -> d.put(k, Map.of("total", a[0], "solved", a[1])));
        out.put("byDifficulty", d);
        return out;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PROFILE UPDATE — login required
    // ═══════════════════════════════════════════════════════════════
    record ProfileReq(String name, String bio, String about, String location, String phone, List<String> interests,
                      Map<String, String> socials, Boolean daily_reminder) {}

    static final Map<String, String> SOCIAL_HOSTS = Map.of(
            "github", "github.com",
            "linkedin", "linkedin.com",
            "twitter", "x.com|twitter.com",
            "leetcode", "leetcode.com",
            "youtube", "youtube.com",
            "instagram", "instagram.com",
            "website", "");

    @PutMapping("/profile")
    public Map<String, Object> updateProfile(@RequestHeader(value = "Authorization", required = false) String h,
                                             @RequestBody ProfileReq r) {
        Document u = auth.require(h);
        Document set = new Document();

        if (r.name() != null) {
            if (r.name().isBlank() || r.name().length() > 60)
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Name must be 1-60 characters");
            set.append("name", r.name().trim());
        }
        if (r.bio() != null) set.append("bio", r.bio().length() > 280 ? r.bio().substring(0, 280) : r.bio());
        if (r.location() != null) set.append("location", r.location().length() > 80 ? r.location().substring(0, 80) : r.location());
        if (r.interests() != null) set.append("interests", r.interests().stream().limit(10).toList());
        if (r.about() != null) set.append("about", r.about().length() > 1500 ? r.about().substring(0, 1500) : r.about());
        if (r.daily_reminder() != null) set.append("daily_reminder", r.daily_reminder());

        if (r.socials() != null) {
            Document soc = new Document();
            for (var e : r.socials().entrySet()) {
                String v = e.getValue() == null ? "" : e.getValue().trim();
                if (v.isEmpty() || !SOCIAL_HOSTS.containsKey(e.getKey())) continue;
                java.net.URI uri;
                try { uri = new java.net.URI(v); } catch (Exception ex) { uri = null; }
                String host = uri == null || uri.getHost() == null ? "" : uri.getHost().toLowerCase().replaceFirst("^www\\.", "");
                String allowed = SOCIAL_HOSTS.get(e.getKey());
                boolean ok = uri != null && "https".equals(uri.getScheme()) && !host.isEmpty() && v.length() <= 200
                        && (allowed.isEmpty() || Arrays.stream(allowed.split("\\|")).anyMatch(a -> host.equals(a) || host.endsWith("." + a)));
                if (!ok) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Invalid " + e.getKey() + " link — use a full https:// URL" +
                                (allowed.isEmpty() ? "" : " on " + allowed.replace("|", " or ")));
                soc.append(e.getKey(), v);
            }
            set.append("socials", soc);
        }

        Document unset = new Document();
        if (r.phone() != null) {
            String ph = r.phone().replaceAll("[\\s-]", "");
            if (ph.isEmpty()) {
                if ("phone".equals(u.getString("provider")))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone is your login method");
                unset.append("phone", "");
            } else {
                if (!ph.matches(AuthController.PHONE_RE))
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Phone must include country code, e.g. +919876543210");
                Document other = mongo.getCollection("users").find(eq("phone", ph)).first();
                if (other != null && !other.getString("user_id").equals(u.getString("user_id")))
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "Phone already linked to another account");
                set.append("phone", ph);
            }
        }

        Document upd = new Document();
        if (!set.isEmpty()) upd.append("$set", set);
        if (!unset.isEmpty()) upd.append("$unset", unset);
        if (!upd.isEmpty())
            mongo.getCollection("users").updateOne(eq("user_id", u.getString("user_id")), upd);

        return AuthService.publicUser(mongo.getCollection("users").find(eq("user_id", u.getString("user_id"))).first());
    }

    // ═══════════════════════════════════════════════════════════════
    //  TRACK — guest allowed (anon analytics)
    // ═══════════════════════════════════════════════════════════════
    record TrackReq(String event, String path, String slug, String anon_id) {}

    @PostMapping("/track")
    public Map<String, Object> track(@RequestHeader(value = "Authorization", required = false) String h,
                                     @RequestBody TrackReq r,
                                     jakarta.servlet.http.HttpServletRequest req) {
        if (r.event() == null || !r.event().matches("[a-z_]{2,40}"))
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid event");

        Document u = auth.optional(h);
        Function<String, String> cut = s -> s == null ? null : s.length() > 200 ? s.substring(0, 200) : s;

        mongo.getCollection("events").insertOne(new Document("type", r.event())
                .append("path", cut.apply(r.path()))
                .append("slug", cut.apply(r.slug()))
                .append("anon_id", cut.apply(r.anon_id()))
                .append("user_id", u == null ? null : u.getString("user_id"))
                .append("ip", AuthService.ip(req))
                .append("ua", cut.apply(req.getHeader("User-Agent")))
                .append("created_at", new Date()));
        return Map.of("ok", true);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ADMIN OVERVIEW — admin only
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/admin/overview")
    public Map<String, Object> admin(@RequestHeader(value = "Authorization", required = false) String h) {
        Document me = auth.require(h);
        if (!AuthService.isAdmin(me)) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admins only");

        Date weekAgo = new Date(System.currentTimeMillis() - 7 * 86_400_000L);
        Date dayAgo  = new Date(System.currentTimeMillis() - 86_400_000L);

        Map<String, Long> subCount = new HashMap<>();
        Map<String, Set<String>> solvedSets = new HashMap<>();

        for (Document s : mongo.getCollection("submissions").find()) {
            subCount.merge(s.getString("user_id"), 1L, Long::sum);
            if ("Accepted".equals(s.getString("status")))
                solvedSets.computeIfAbsent(s.getString("user_id"), k -> new HashSet<>()).add(s.getString("slug"));
        }

        List<Map<String, Object>> users = new ArrayList<>();
        for (Document u : mongo.getCollection("users").find().sort(new Document("last_active_at", -1)).limit(200)) {
            Map<String, Object> m = AuthService.publicUser(u);
            m.put("last_active_at", u.get("last_active_at"));
            m.put("last_ip", u.get("last_ip"));
            m.put("submissions", subCount.getOrDefault(u.getString("user_id"), 0L));
            m.put("solved", (long) solvedSets.getOrDefault(u.getString("user_id"), Set.of()).size());
            users.add(m);
        }

        List<Map<String, Object>> notes = new ArrayList<>();
        for (Document n : mongo.getCollection("notifications").find().sort(new Document("created_at", -1)).limit(25))
            notes.add(clean(n));

        List<Map<String, Object>> events = new ArrayList<>();
        for (Document e : mongo.getCollection("events").find().sort(new Document("created_at", -1)).limit(40)) {
            Map<String, Object> m = clean(e);
            m.remove("ua");
            events.add(m);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalUsers", mongo.getCollection("users").countDocuments());
        out.put("activeUsers7d", mongo.getCollection("users").countDocuments(gte("last_active_at", weekAgo)));
        out.put("logins24h", mongo.getCollection("events").countDocuments(and(eq("type", "login"), gte("created_at", dayAgo))));
        out.put("pageViews24h", mongo.getCollection("events").countDocuments(and(eq("type", "page_view"), gte("created_at", dayAgo))));
        out.put("submissions24h", mongo.getCollection("submissions").countDocuments(gte("created_at", dayAgo)));
        out.put("users", users);
        out.put("notifications", notes);
        out.put("events", events);
        return out;
    }

    // ═══════════════════════════════════════════════════════════════
    //  SUBMISSIONS — login required
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/submissions")
    public List<Map<String, Object>> submissions(@RequestHeader(value = "Authorization", required = false) String h,
                                                 @RequestParam String slug) {
        Document u = auth.require(h);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Document d : mongo.getCollection("submissions")
                .find(and(eq("user_id", u.getString("user_id")), eq("slug", slug)))
                .sort(new Document("created_at", -1)).limit(50))
            out.add(clean(d));
        return out;
    }

    // ═══════════════════════════════════════════════════════════════
    //  PROFILE ANALYTICS — login required
    // ═══════════════════════════════════════════════════════════════
    @GetMapping("/profile")
    public Map<String, Object> profile(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.require(h);

        List<Document> subs = mongo.getCollection("submissions")
                .find(eq("user_id", u.getString("user_id")))
                .sort(new Document("created_at", -1))
                .into(new ArrayList<>());

        Map<String, Long> totals = new LinkedHashMap<>();
        totals.put("Easy", 0L);
        totals.put("Medium", 0L);
        totals.put("Hard", 0L);
        Map<String, String> diffOf = new HashMap<>();

        for (Document p : mongo.getCollection("problems").find()) {
            String diff = p.getString("difficulty");
            if (diff != null) totals.merge(diff, 1L, Long::sum);
            diffOf.put(p.getString("slug"), diff == null ? "Easy" : diff);
        }

        Set<String> solved = subs.stream()
                .filter(s -> "Accepted".equals(s.getString("status")))
                .map(s -> s.getString("slug"))
                .collect(Collectors.toSet());

        Map<String, Long> solvedBy = new LinkedHashMap<>();
        solvedBy.put("Easy", 0L);
        solvedBy.put("Medium", 0L);
        solvedBy.put("Hard", 0L);
        solved.forEach(s -> solvedBy.merge(diffOf.getOrDefault(s, "Easy"), 1L, Long::sum));

        Map<String, Long> langs = subs.stream()
                .filter(s -> s.getString("language") != null)
                .collect(Collectors.groupingBy(s -> s.getString("language"), Collectors.counting()));

        Map<String, Long> heat = subs.stream()
                .filter(s -> s.getDate("created_at") != null)
                .collect(Collectors.groupingBy(
                        s -> s.getDate("created_at").toInstant().atZone(ZoneOffset.UTC).toLocalDate().toString(),
                        TreeMap::new, Collectors.counting()));

        long accepted = subs.stream().filter(s -> "Accepted".equals(s.getString("status"))).count();

        LocalDate d = LocalDate.now(ZoneOffset.UTC);
        if (!heat.containsKey(d.toString())) d = d.minusDays(1);
        int streak = 0;
        while (heat.containsKey(d.toString())) { streak++; d = d.minusDays(1); }

        List<Map<String, Object>> recent = subs.stream().limit(15).map(s -> {
            Map<String, Object> m = clean(s);
            m.remove("code");
            return m;
        }).toList();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("user", AuthService.publicUser(u));
        out.put("totals", totals);
        out.put("totalProblems", totals.values().stream().mapToLong(Long::longValue).sum());
        out.put("solved", solved.size());
        out.put("solvedBy", solvedBy);
        out.put("totalSubmissions", subs.size());
        out.put("acceptedSubmissions", accepted);
        out.put("acceptanceRate", subs.isEmpty() ? 0 : Math.round(accepted * 1000.0 / subs.size()) / 10.0);
        out.put("languages", langs);
        out.put("heatmap", heat);
        out.put("streak", streak);
        out.put("activeDays", heat.size());
        out.put("recent", recent);
        return out;
    }
}