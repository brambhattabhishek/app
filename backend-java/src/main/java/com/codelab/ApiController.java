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

import static com.mongodb.client.model.Filters.and;
import static com.mongodb.client.model.Filters.eq;

@RestController
@RequestMapping("/api")
public class ApiController {
    @Autowired MongoTemplate mongo;
    @Autowired Executor executor;
    @Autowired AuthService auth;
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

    void validate(String lang, String code, Document p, List<String> inputs) {
        if (!LANGS.contains(lang)) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported language");
        if (code == null || code.isBlank() || code.length() > 50_000) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Code is empty or too long");
        if (inputs == null || inputs.isEmpty() || inputs.size() > 30) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Provide 1-30 testcases");
        int k = CodeTemplates.params(p).size();
        for (String in : inputs)
            if (in == null || in.strip().split("\n").length != k || Arrays.stream(in.strip().split("\n")).anyMatch(String::isBlank))
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Each testcase needs exactly " + k + " non-empty value(s)");
    }

    @GetMapping("/health")
    public Map<String, Object> health() { return Map.of("ok", true, "backend", "java-spring-boot"); }

    @GetMapping("/problems")
    public List<Map<String, Object>> list(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.optional(h);
        Set<String> solved = new HashSet<>(), attempted = new HashSet<>();
        if (u != null) for (Document s : mongo.getCollection("submissions").find(eq("user_id", u.getString("user_id")))) {
            attempted.add(s.getString("slug"));
            if ("Accepted".equals(s.getString("status"))) solved.add(s.getString("slug"));
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Document d : mongo.getCollection("problems").find().sort(new Document("id", 1))) {
            Map<String, Object> m = new LinkedHashMap<>();
            for (String k : List.of("id", "slug", "title", "difficulty", "tags", "acceptance")) m.put(k, d.get(k));
            String sl = d.getString("slug");
            m.put("status", solved.contains(sl) ? "solved" : attempted.contains(sl) ? "attempted" : "todo");
            out.add(m);
        }
        return out;
    }

    @GetMapping("/problems/{slug}")
    public Map<String, Object> detail(@PathVariable String slug) {
        Document d = problem(slug);
        Map<String, Object> m = clean(d);
        m.remove("hiddenTests");
        m.put("boilerplates", CodeTemplates.boilerplates(d));
        return m;
    }

    @PostMapping("/run")
    public Map<String, Object> run(@RequestBody RunReq r) {
        Document p = problem(r.slug());
        List<String> raw = r.inputs() == null || r.inputs().isEmpty()
                ? p.getList("sampleTests", Document.class).stream().map(t -> t.getString("input")).toList() : r.inputs();
        validate(r.language(), r.code(), p, raw);
        List<String> inputs = raw.stream().map(String::strip).toList();
        Executor.ExecResult res = executor.run(r.language(), r.code(), p, inputs);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("runtimeMs", res.runtimeMs());
        out.put("error", res.error());
        Executor.ExecResult ref = executor.run("python", p.get("editorial", Document.class).getString("code"), p, inputs);
        List<Map<String, Object>> cases = new ArrayList<>();
        boolean all = res.status().equals("OK");
        for (int i = 0; i < inputs.size(); i++) {
            String o = i < res.outputs().size() ? res.outputs().get(i) : null;
            String e = i < ref.outputs().size() ? ref.outputs().get(i) : null;
            boolean pass = o != null && o.equals(e);
            all &= pass;
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("input", inputs.get(i));
            c.put("output", o);
            c.put("expected", e);
            c.put("stdout", i < res.logs().size() ? res.logs().get(i) : "");
            c.put("passed", pass);
            cases.add(c);
        }
        out.put("status", !res.status().equals("OK") ? res.status() : all ? "Accepted" : "Wrong Answer");
        out.put("cases", cases);
        return out;
    }

    @PostMapping("/submit")
    public Map<String, Object> submit(@RequestHeader(value = "Authorization", required = false) String h, @RequestBody SubmitReq r) {
        Document u = auth.require(h);
        Document p = problem(r.slug());
        List<Document> tests = new ArrayList<>(p.getList("sampleTests", Document.class));
        tests.addAll(p.getList("hiddenTests", Document.class));
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
        String status = !res.status().equals("OK") ? res.status() : passed == tests.size() ? "Accepted" : "Wrong Answer";
        Document sub = new Document("submission_id", UUID.randomUUID().toString()).append("user_id", u.getString("user_id"))
                .append("slug", p.getString("slug")).append("title", p.getString("title")).append("difficulty", p.getString("difficulty"))
                .append("language", r.language()).append("code", r.code()).append("status", status).append("passed", passed)
                .append("total", tests.size()).append("runtimeMs", res.runtimeMs()).append("created_at", new Date());
        mongo.getCollection("submissions").insertOne(sub);
        Map<String, Object> out = clean(sub);
        out.put("failedCase", failed);
        out.put("error", res.error());
        return out;
    }

    @GetMapping("/submissions")
    public List<Map<String, Object>> submissions(@RequestHeader(value = "Authorization", required = false) String h, @RequestParam String slug) {
        Document u = auth.require(h);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Document d : mongo.getCollection("submissions").find(and(eq("user_id", u.getString("user_id")), eq("slug", slug)))
                .sort(new Document("created_at", -1)).limit(50)) out.add(clean(d));
        return out;
    }

    @GetMapping("/profile")
    public Map<String, Object> profile(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.require(h);
        List<Document> subs = mongo.getCollection("submissions").find(eq("user_id", u.getString("user_id")))
                .sort(new Document("created_at", -1)).into(new ArrayList<>());
        Map<String, Long> totals = new LinkedHashMap<>(Map.of("Easy", 0L, "Medium", 0L, "Hard", 0L));
        Map<String, String> diffOf = new HashMap<>();
        for (Document p : mongo.getCollection("problems").find()) {
            totals.merge(p.getString("difficulty"), 1L, Long::sum);
            diffOf.put(p.getString("slug"), p.getString("difficulty"));
        }
        Set<String> solved = subs.stream().filter(s -> "Accepted".equals(s.getString("status"))).map(s -> s.getString("slug")).collect(Collectors.toSet());
        Map<String, Long> solvedBy = new LinkedHashMap<>(Map.of("Easy", 0L, "Medium", 0L, "Hard", 0L));
        solved.forEach(s -> solvedBy.merge(diffOf.getOrDefault(s, "Easy"), 1L, Long::sum));
        Map<String, Long> langs = subs.stream().collect(Collectors.groupingBy(s -> s.getString("language"), Collectors.counting()));
        Map<String, Long> heat = subs.stream().collect(Collectors.groupingBy(
                s -> s.getDate("created_at").toInstant().atZone(ZoneOffset.UTC).toLocalDate().toString(), TreeMap::new, Collectors.counting()));
        long accepted = subs.stream().filter(s -> "Accepted".equals(s.getString("status"))).count();
        LocalDate d = LocalDate.now(ZoneOffset.UTC);
        if (!heat.containsKey(d.toString())) d = d.minusDays(1);
        int streak = 0;
        while (heat.containsKey(d.toString())) { streak++; d = d.minusDays(1); }
        List<Map<String, Object>> recent = subs.stream().limit(15).map(s -> { Map<String, Object> m = clean(s); m.remove("code"); return m; }).toList();
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
