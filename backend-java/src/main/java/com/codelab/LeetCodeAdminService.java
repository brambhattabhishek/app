package com.codelab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeetCodeAdminService {

    private static final String GRAPHQL = "https://leetcode.com/graphql/";

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ProblemRepository     problemRepo;
    private final ProblemMetaRepository metaRepo;
    private final ResourceLoader        resourceLoader;
    private final CompanyImportService  companyImportService;   // ★ NEW

    private volatile String sessionCookie = "";
    private final AtomicBoolean fetchingAll = new AtomicBoolean(false);

    public void setSessionCookie(String cookie) {
        this.sessionCookie = cookie == null ? "" : cookie.trim();
    }

    public boolean isFetchingAll() { return fetchingAll.get(); }

    private Path resolvePath(String filename) throws IOException {
        try {
            Resource res = resourceLoader.getResource("classpath:" + filename);
            if (res.exists()) {
                File file = res.getFile();
                if (file.canWrite()) return file.toPath();
            }
        } catch (Exception ignored) {}

        Path fallback = Paths.get("data", filename);
        Files.createDirectories(fallback.getParent());
        if (!Files.exists(fallback)) {
            Files.writeString(fallback, filename.endsWith("meta.json") ? "{}" : "[]");
        }
        return fallback;
    }

    public synchronized List<Integer> addProblems(String input) throws Exception {
        List<Integer> added = new ArrayList<>();
        if (input == null || input.isBlank()) return added;

        Path p1Path = resolvePath("problems.json");
        Path p2Path = resolvePath("problems2.json");
        Path pmPath = resolvePath("problems_meta.json");

        ArrayNode p1Json   = readArray(p1Path);
        ArrayNode p2Json   = readArray(p2Path);
        ObjectNode metaJson = readObject(pmPath);

        for (String token : input.replace(",", " ").split("\\s+")) {
            if (token.isBlank()) continue;
            int num;
            try { num = Integer.parseInt(token); }
            catch (NumberFormatException e) {
                log.warn("Skip non-numeric token '{}'", token);
                continue;
            }

            try {
                log.info("Fetching #{}...", num);
                SlugInfo info = slugForNumber(num);
                if (info == null || info.slug == null) {
                    log.warn("No slug for #{}", num);
                    continue;
                }
                String slug = info.slug;
                log.info("Resolved #{} -> slug={}, acceptance={}%", num, slug, info.acceptance);

                JsonNode d = fetchQuestionDetail(slug);
                if (d == null || d.isMissingNode() || d.isNull()) {
                    log.warn("Empty detail for #{} ({})", num, slug);
                    continue;
                }

                Problem problem  = toProblem(num, d);
                problem.setAcceptance(info.acceptance);
                ProblemMeta meta = toMeta(num, d);

                // ★ AUTO-DETECT COMPANIES
                try {
                    List<String> companies = companyImportService.findCompaniesForProblem(slug);
                    if (!companies.isEmpty()) {
                        meta.setCompanies(companies);
                        log.info("✓ Auto-detected {} companies for #{}: {}", companies.size(), num, companies);
                    } else {
                        log.info("No companies found for #{} ({})", num, slug);
                    }
                } catch (Exception e) {
                    log.warn("Company auto-detect failed for #{}: {}", num, e.getMessage());
                }

                problemRepo.save(problem);
                metaRepo.save(meta);

                replaceOrAdd(p1Json, num, problemToJson(problem));
                replaceOrAdd(p2Json, num, problemMetaToJson2(problem, meta));
                metaJson.set(String.valueOf(num), metaToJson(meta));

                added.add(num);
                log.info("✓ Saved #{} {} (fn={}, params={}, samples={}, acceptance={}%, companies={})",
                        num, problem.getTitle(), problem.getFn(),
                        problem.getParams().size(), problem.getSampleTests().size(),
                        problem.getAcceptance(), meta.getCompanies());

                if (input.split("\\s+|,").length > added.size()) {
                    Thread.sleep(200);
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("✗ Failed #{}: {}", num, e.getMessage(), e);
            }
        }

        write(p1Path, p1Json);
        write(p2Path, p2Json);
        write(pmPath, metaJson);
        return added;
    }

    @Async("taskExecutor")
    public void fetchAllAsync() {
        try { fetchAll(); } catch (Exception e) { log.error("fetchAll background failure", e); }
    }

    public int fetchAll() throws Exception {
        if (!fetchingAll.compareAndSet(false, true)) return 0;
        try {
            Path p1Path = resolvePath("problems.json");
            Path p2Path = resolvePath("problems2.json");
            Path pmPath = resolvePath("problems_meta.json");

            JsonNode list = graphql("""
        query { problemsetQuestionList: questionList(categorySlug:"",limit:3000,skip:0,filters:{}) {
          total: totalNum questions: data { frontendQuestionId titleSlug difficulty topicTags { name } acceptanceRate }
        }}""", "{}");

            ArrayNode p1Json    = MAPPER.createArrayNode();
            ArrayNode p2Json    = MAPPER.createArrayNode();
            ObjectNode metaJson = MAPPER.createObjectNode();

            int count = 0;
            for (JsonNode q : list.path("data").path("problemsetQuestionList").path("questions")) {
                String slug = q.path("titleSlug").asText();
                String numStr = q.path("frontendQuestionId").asText("");
                double acceptance = q.path("acceptanceRate").asDouble(0.0);
                int num;
                try { num = Integer.parseInt(numStr); }
                catch (NumberFormatException e) { continue; }

                try {
                    JsonNode d = fetchQuestionDetail(slug);
                    if (d == null || d.isMissingNode() || d.isNull()) continue;

                    Problem problem  = toProblem(num, d);
                    problem.setAcceptance(acceptance);
                    ProblemMeta meta = toMeta(num, d);

                    // ★ Auto-detect companies during bulk fetch too
                    try {
                        List<String> companies = companyImportService.findCompaniesForProblem(slug);
                        if (!companies.isEmpty()) {
                            meta.setCompanies(companies);
                        }
                    } catch (Exception e) {
                        log.debug("Company detect failed for {}: {}", slug, e.getMessage());
                    }

                    problemRepo.save(problem);
                    metaRepo.save(meta);

                    p1Json.add(problemToJson(problem));
                    p2Json.add(problemMetaToJson2(problem, meta));
                    metaJson.set(String.valueOf(num), metaToJson(meta));

                    count++;
                    log.info("✓ [{}] {} {} (samples: {}, acc: {}%, companies: {})",
                            count, num, slug, problem.getSampleTests().size(),
                            acceptance, meta.getCompanies().size());
                    Thread.sleep(250);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    log.error("✗ {} {}: {}", num, slug, e.getMessage());
                }
            }

            write(p1Path, p1Json);
            write(p2Path, p2Json);
            write(pmPath, metaJson);
            return count;
        } finally {
            fetchingAll.set(false);
        }
    }

    private JsonNode fetchQuestionDetail(String slug) throws Exception {
        JsonNode root = graphql("""
    query($s:String!){question(titleSlug:$s){
      questionFrontendId title titleSlug content difficulty
      topicTags{name} hints
      codeSnippets{lang langSlug code}
      sampleTestCase
      exampleTestcases
    }}""", "{\"s\":\"" + escapeJson(slug) + "\"}");
        return root.path("data").path("question");
    }

    private volatile Map<Integer, SlugInfo> slugCache = null;
    private final Object cacheLock = new Object();

    private static class SlugInfo {
        final String slug;
        final double acceptance;
        SlugInfo(String slug, double acceptance) {
            this.slug = slug;
            this.acceptance = acceptance;
        }
    }

    private SlugInfo slugForNumber(int num) throws Exception {
        Map<Integer, SlugInfo> cache = slugCache;
        if (cache != null && cache.containsKey(num)) {
            return cache.get(num);
        }

        try {
            JsonNode r = graphql("""
            query($f:QuestionListFilterInput){problemsetQuestionList:questionList(
                categorySlug:"", limit:20, skip:0, filters:$f){ 
                questions:data{questionFrontendId titleSlug acRate} 
            }}""",
                    "{\"f\":{\"searchKeywords\":\"" + num + "\"}}");

            JsonNode qs = r.path("data").path("problemsetQuestionList").path("questions");
            if (qs.isArray()) {
                for (JsonNode q : qs) {
                    String idStr = q.path("questionFrontendId").asText("");
                    if (idStr.equals(String.valueOf(num))) {
                        return new SlugInfo(
                                q.path("titleSlug").asText(),
                                q.path("acRate").asDouble(0.0)
                        );
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Search failed for #{}: {}", num, e.getMessage());
        }

        synchronized (cacheLock) {
            if (slugCache == null || slugCache.isEmpty()) {
                slugCache = buildSlugCache();
            }
            return slugCache.get(num);
        }
    }

    private Map<Integer, SlugInfo> buildSlugCache() throws Exception {
        Map<Integer, SlugInfo> map = new HashMap<>();
        int skip = 0;
        int limit = 100;

        while (true) {
            JsonNode r = graphql("""
            query($skip:Int!, $limit:Int!){problemsetQuestionList:questionList(
                categorySlug:"", limit:$limit, skip:$skip, filters:{}){ 
                questions:data{questionFrontendId titleSlug acceptanceRate} 
            }}""",
                    "{\"skip\":" + skip + ",\"limit\":" + limit + "}");

            JsonNode qs = r.path("data").path("problemsetQuestionList").path("questions");
            if (!qs.isArray() || qs.size() == 0) break;

            for (JsonNode q : qs) {
                String idStr = q.path("questionFrontendId").asText("");
                String slug = q.path("titleSlug").asText("");
                double acc = q.path("acceptanceRate").asDouble(0.0);
                if (!idStr.isEmpty() && !slug.isEmpty()) {
                    try { map.put(Integer.parseInt(idStr), new SlugInfo(slug, acc)); }
                    catch (Exception ignored) {}
                }
            }

            if (qs.size() < limit) break;
            skip += limit;
            Thread.sleep(150);
        }

        log.info("Built slug cache with {} problems", map.size());
        return map;
    }

    private JsonNode graphql(String query, String vars) throws Exception {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("query", query);
        body.set("variables", MAPPER.readTree(vars));

        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(GRAPHQL))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("Referer", "https://leetcode.com/")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()));

        if (!sessionCookie.isBlank())
            b.header("Cookie", "LEETCODE_SESSION=" + sessionCookie);

        HttpResponse<String> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() >= 400)
            throw new RuntimeException("GraphQL HTTP " + r.statusCode() + ": " + r.body());

        JsonNode root = MAPPER.readTree(r.body());
        if (root.has("errors"))
            throw new RuntimeException(root.path("errors").toString());
        return root;
    }

    private Problem toProblem(int num, JsonNode d) {
        List<String> tags = new ArrayList<>();
        if (d.path("topicTags").isArray())
            d.path("topicTags").forEach(t -> tags.add(t.path("name").asText()));

        String fn = "";
        List<Problem.Param> params = new ArrayList<>();
        String ret = "";
        List<Problem.SampleTest> sampleTests = new ArrayList<>();
        List<String> constraints = new ArrayList<>();

        // ═══════════ STEP 1: Parse function signature from codeSnippets ═══════════
        JsonNode snippets = d.path("codeSnippets");
        if (snippets.isArray() && snippets.size() > 0) {
            JsonNode jsSnippet = null;
            for (JsonNode s : snippets) {
                String langSlug = s.path("langSlug").asText("").toLowerCase();
                if (langSlug.equals("javascript") || langSlug.equals("js")) {
                    jsSnippet = s;
                    break;
                }
            }
            if (jsSnippet == null) jsSnippet = snippets.get(0);

            String code = jsSnippet.path("code").asText("");

            Pattern jsPattern = Pattern.compile(
                    "(?:var|let|const)\\s+(\\w+)\\s*=\\s*(?:function\\s*\\(([^)]*)\\)|\\(([^)]*)\\)\\s*=>)",
                    Pattern.DOTALL
            );
            Matcher m = jsPattern.matcher(code);
            if (m.find()) {
                fn = m.group(1).trim();
                String argsStr = (m.group(2) != null ? m.group(2) : m.group(3)).trim();
                if (!argsStr.isEmpty()) {
                    for (String arg : argsStr.split(",")) {
                        String argName = arg.trim();
                        if (!argName.isEmpty()) {
                            params.add(new Problem.Param(argName, guessType(argName)));
                        }
                    }
                }
            }

            Pattern retPattern = Pattern.compile("@return\\s*\\{([^}]+)\\}");
            Matcher rm = retPattern.matcher(code);
            if (rm.find()) {
                ret = jsTypeToJava(rm.group(1).trim());
            }
        }

        String description = d.path("content").asText("");

        // ═══════════ STEP 2: Parse CONSTRAINTS from description HTML ═══════════
        if (!description.isEmpty()) {
            // Pattern: <strong>Constraints:</strong> ... <ul>...</ul>
            Pattern constraintsPattern = Pattern.compile(
                    "Constraints:\\s*</strong>(.*?)(?:<strong>|$)",
                    Pattern.DOTALL | Pattern.CASE_INSENSITIVE
            );
            Matcher cm = constraintsPattern.matcher(description);
            if (cm.find()) {
                String block = cm.group(1);

                // Extract each <li> as one constraint
                Pattern liPattern = Pattern.compile("<li>(.*?)</li>", Pattern.DOTALL);
                Matcher lm = liPattern.matcher(block);
                while (lm.find()) {
                    String c = lm.group(1)
                            .replaceAll("<[^>]*>", "")   // strip HTML tags
                            .replace("&lt;", "<")
                            .replace("&gt;", ">")
                            .replace("&amp;", "&")
                            .replace("&nbsp;", " ")
                            .replace("&times;", "×")
                            .replace("&le;", "≤")
                            .replace("&ge;", "≥")
                            .replace("&#39;", "'")
                            .replace("&quot;", "\"")
                            .replaceAll("\\s+", " ")
                            .trim();

                    if (!c.isEmpty() && c.length() < 500) {
                        constraints.add(c);
                    }
                }
            }
        }

        // ═══════════ STEP 3: Parse expected outputs from description ═══════════
        List<String> expectedOutputs = new ArrayList<>();
        if (!description.isEmpty()) {
            String text = description
                    .replaceAll("<[^>]*>", " ")
                    .replace("&quot;", "\"")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&amp;", "&")
                    .replace("&nbsp;", " ")
                    .replace("&#39;", "'")
                    .replaceAll("\\s+", " ")
                    .trim();

            Pattern outputPattern = Pattern.compile(
                    "Output:\\s*(.+?)(?=Explanation:|Example\\s+\\d|Constraints:|$)",
                    Pattern.DOTALL
            );
            Matcher om = outputPattern.matcher(text);
            while (om.find()) {
                String exp = om.group(1).trim();
                if (!exp.isEmpty()) expectedOutputs.add(exp);
            }
        }

        // ═══════════ STEP 4: Parse sample tests from exampleTestcases ═══════════
        String exampleTestcases = d.path("exampleTestcases").asText("");
        if (!exampleTestcases.isEmpty()) {
            String[] lines = exampleTestcases.split("\n");
            int numParams = params.size();

            if (numParams > 0) {
                int outIdx = 0;
                for (int i = 0; i + numParams - 1 < lines.length; i += numParams) {
                    StringBuilder input = new StringBuilder();
                    for (int j = 0; j < numParams; j++) {
                        if (j > 0) input.append("\n");
                        input.append(lines[i + j].trim());
                    }

                    String expected = outIdx < expectedOutputs.size()
                            ? expectedOutputs.get(outIdx)
                            : "";

                    sampleTests.add(Problem.SampleTest.builder()
                            .input(input.toString())
                            .expected(expected)
                            .build());

                    outIdx++;
                }
                log.debug("Parsed {} sample tests for #{}", sampleTests.size(), num);
            }
        }

        // ═══════════ STEP 5: Fallback — sampleTestCase ═══════════
        if (sampleTests.isEmpty()) {
            String sampleInput = d.path("sampleTestCase").asText("");
            if (!sampleInput.isEmpty() && !params.isEmpty()) {
                String[] lines = sampleInput.split("\n");
                if (lines.length >= params.size()) {
                    StringBuilder inputBuilder = new StringBuilder();
                    for (int i = 0; i < params.size(); i++) {
                        if (i > 0) inputBuilder.append("\n");
                        inputBuilder.append(lines[i].trim());
                    }
                    String expected = !expectedOutputs.isEmpty() ? expectedOutputs.get(0) : "";
                    sampleTests.add(Problem.SampleTest.builder()
                            .input(inputBuilder.toString())
                            .expected(expected)
                            .build());
                }
            }
        }

        // ═══════════ STEP 6: Final defaults ═══════════
        if (fn.isEmpty()) fn = d.path("titleSlug").asText("").replace("-", "_");
        if (ret.isEmpty()) ret = "any";

        return Problem.builder()
                .id(num)
                .slug(d.path("titleSlug").asText())
                .title(d.path("title").asText())
                .difficulty(d.path("difficulty").asText())
                .tags(tags)
                .acceptance(0.0)
                .fn(fn)
                .params(params)
                .ret(ret)
                .description(description)
                .constraints(constraints)              // ★ NOW PARSED
                .sampleTests(sampleTests)
                .hiddenTests(new ArrayList<>())
                .editorial(Problem.Editorial.builder()
                        .approach("See LeetCode")
                        .complexity("")
                        .code("")
                        .build())
                .build();
    }

    private String guessType(String argName) {
        String lower = argName.toLowerCase();
        if (lower.equals("n") || lower.equals("k") || lower.equals("target") ||
                lower.equals("val") || lower.equals("x") || lower.equals("y") ||
                lower.equals("num") || lower.equals("index") || lower.equals("i")) {
            return "int";
        }
        if (lower.equals("s") || lower.equals("t") || lower.equals("word") ||
                lower.equals("word1") || lower.equals("word2") || lower.equals("str") ||
                lower.equals("text") || lower.equals("pattern")) {
            return "string";
        }
        if (lower.contains("nums") || lower.contains("arr") || lower.contains("array") ||
                lower.contains("prices") || lower.contains("heights") || lower.equals("a") ||
                lower.equals("b") || lower.equals("digits")) {
            return "int[]";
        }
        if (lower.equals("p") || lower.equals("q") || lower.equals("root") ||
                lower.equals("node") || lower.equals("head") || lower.equals("tree")) {
            return "TreeNode";
        }
        if (lower.equals("matrix") || lower.equals("grid") || lower.equals("board")) {
            return "int[][]";
        }
        return "any";
    }

    private String jsTypeToJava(String jsType) {
        switch (jsType.toLowerCase()) {
            case "number": return "int";
            case "string": return "string";
            case "boolean": return "bool";
            case "void": return "void";
            case "number[]": return "int[]";
            case "string[]": return "string[]";
            default: return jsType;
        }
    }

    private ProblemMeta toMeta(int num, JsonNode d) {
        List<String> hints = new ArrayList<>();
        if (d.path("hints").isArray())
            d.path("hints").forEach(h -> hints.add(h.asText()));

        return ProblemMeta.builder()
                .id(num)
                .slug(d.path("titleSlug").asText())
                .companies(new ArrayList<>())
                .hints(hints)
                .edgeCases(new ArrayList<>())
                .explanation("")
                .build();
    }

    private ObjectNode problemToJson(Problem p) {
        ObjectNode o = MAPPER.createObjectNode();
        o.put("id", p.getId());
        o.put("slug", p.getSlug());
        o.put("title", p.getTitle());
        o.put("difficulty", p.getDifficulty());
        o.set("tags", MAPPER.valueToTree(p.getTags()));
        o.put("acceptance", p.getAcceptance());
        o.put("fn", p.getFn());
        o.set("params", MAPPER.valueToTree(p.getParams()));
        o.put("ret", p.getRet());
        o.put("description", p.getDescription());
        o.set("constraints", MAPPER.valueToTree(p.getConstraints()));
        o.set("sampleTests", MAPPER.valueToTree(p.getSampleTests()));
        o.set("hiddenTests", MAPPER.valueToTree(p.getHiddenTests()));
        ObjectNode ed = MAPPER.createObjectNode();
        ed.put("approach", p.getEditorial() == null ? "" : p.getEditorial().getApproach());
        ed.put("complexity", p.getEditorial() == null ? "" : p.getEditorial().getComplexity());
        ed.put("code", p.getEditorial() == null ? "" : p.getEditorial().getCode());
        o.set("editorial", ed);
        return o;
    }

    private ObjectNode problemMetaToJson2(Problem p, ProblemMeta m) {
        ObjectNode o = problemToJson(p);
        o.set("companies", MAPPER.valueToTree(m.getCompanies()));
        o.set("hints", MAPPER.valueToTree(m.getHints()));
        o.set("edgeCases", MAPPER.valueToTree(m.getEdgeCases()));
        o.put("explanation", m.getExplanation());
        return o;
    }

    private ObjectNode metaToJson(ProblemMeta m) {
        ObjectNode o = MAPPER.createObjectNode();
        o.set("companies", MAPPER.valueToTree(m.getCompanies()));
        o.set("hints", MAPPER.valueToTree(m.getHints()));
        o.set("edgeCases", MAPPER.valueToTree(m.getEdgeCases()));
        o.put("explanation", m.getExplanation());
        return o;
    }

    private ArrayNode readArray(Path p) throws IOException {
        if (!Files.exists(p) || Files.size(p) == 0) return MAPPER.createArrayNode();
        JsonNode n = MAPPER.readTree(p.toFile());
        return n.isArray() ? (ArrayNode) n : MAPPER.createArrayNode();
    }

    private ObjectNode readObject(Path p) throws IOException {
        if (!Files.exists(p) || Files.size(p) == 0) return MAPPER.createObjectNode();
        JsonNode n = MAPPER.readTree(p.toFile());
        return n.isObject() ? (ObjectNode) n : MAPPER.createObjectNode();
    }

    private void write(Path p, JsonNode n) throws IOException {
        Files.createDirectories(p.getParent());
        MAPPER.writerWithDefaultPrettyPrinter().writeValue(p.toFile(), n);
    }

    private void replaceOrAdd(ArrayNode arr, int id, ObjectNode obj) {
        for (int i = 0; i < arr.size(); i++) {
            if (arr.get(i).path("id").asInt() == id) {
                arr.set(i, obj);
                return;
            }
        }
        arr.add(obj);
    }

    public int migrateJsonToMongo() throws IOException {
        ArrayNode p1Json = readArray(resolvePath("problems.json"));
        ArrayNode p2Json = readArray(resolvePath("problems2.json"));
        ObjectNode pm    = readObject(resolvePath("problems_meta.json"));

        int problemsSaved = 0;
        for (JsonNode j : p1Json) {
            try {
                Problem p = MAPPER.treeToValue(j, Problem.class);
                if (p.getId() == null) continue;
                problemRepo.save(p);
                problemsSaved++;
            } catch (Exception e) { log.warn("problem migrate skip: {}", e.getMessage()); }
        }

        int metaSaved = 0;
        for (JsonNode j : p2Json) {
            try {
                int id = j.path("id").asInt(-1);
                if (id < 0) continue;
                metaRepo.save(buildMetaFromJson(id, j));
                metaSaved++;
            } catch (Exception e) { log.warn("meta2 migrate skip: {}", e.getMessage()); }
        }

        var fields = pm.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            try {
                int id = Integer.parseInt(entry.getKey());
                metaRepo.save(buildMetaFromJson(id, entry.getValue()));
                metaSaved++;
            } catch (Exception e) { log.warn("metaObj migrate skip key={}: {}", entry.getKey(), e.getMessage()); }
        }
        return problemsSaved;
    }

    private ProblemMeta buildMetaFromJson(int id, JsonNode j) {
        List<String> hints = new ArrayList<>();
        if (j.path("hints").isArray()) j.path("hints").forEach(h -> hints.add(h.asText()));
        List<String> companies = new ArrayList<>();
        if (j.path("companies").isArray()) j.path("companies").forEach(c -> companies.add(c.asText()));
        List<String> edges = new ArrayList<>();
        if (j.path("edgeCases").isArray()) j.path("edgeCases").forEach(e -> edges.add(e.asText()));

        return ProblemMeta.builder()
                .id(id)
                .slug(j.path("slug").asText(""))
                .hints(hints).companies(companies).edgeCases(edges)
                .explanation(j.path("explanation").asText("")).build();
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}