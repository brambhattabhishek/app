package com.codelab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
    private static final String RES     = "src/main/resources/";
    private static final Path   P1      = Paths.get(RES + "problems.json");
    private static final Path   P2      = Paths.get(RES + "problems2.json");
    private static final Path   PM      = Paths.get(RES + "problems_meta.json");

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();
    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ProblemRepository     problemRepo;
    private final ProblemMetaRepository metaRepo;

    private volatile String sessionCookie = "";
    private final AtomicBoolean fetchingAll = new AtomicBoolean(false);

    public void setSessionCookie(String cookie) {
        this.sessionCookie = cookie == null ? "" : cookie.trim();
    }

    // ★ Paths ab static nahi, method mein resolve honge
    private final ResourceLoader resourceLoader;

    // Helper method — path resolve karo
    private Path resolvePath(String filename) throws IOException {
        // Try to read from classpath first
        try {
            org.springframework.core.io.Resource res =
                    resourceLoader.getResource("classpath:" + filename);
            if (res.exists()) {
                File file = res.getFile();
                if (file.canWrite()) return file.toPath();
            }
        } catch (Exception ignored) {}

        // Fallback: current working directory
        Path fallback = Paths.get("data", filename);
        Files.createDirectories(fallback.getParent());
        if (!Files.exists(fallback)) Files.writeString(fallback, filename.endsWith("meta.json") ? "{}" : "[]");
        return fallback;
    }

    public boolean isFetchingAll() { return fetchingAll.get(); }

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
                String slug = slugForNumber(num);
                if (slug == null) {
                    log.warn("No slug for #{}", num);
                    continue;
                }

                JsonNode d = fetchQuestionDetail(slug);
                if (d == null || d.isMissingNode() || d.isNull()) {
                    log.warn("Empty detail for #{} ({})", num, slug);
                    continue;
                }

                Problem problem  = toProblem(num, d);
                ProblemMeta meta = toMeta(num, d);

                // ★ MongoDB mein save
                problemRepo.save(problem);
                metaRepo.save(meta);

                // ★ JSON files mein bhi save
                replaceOrAdd(p1Json, num, problemToJson(problem));
                replaceOrAdd(p2Json, num, problemMetaToJson2(problem, meta));
                metaJson.set(String.valueOf(num), metaToJson(meta));

                added.add(num);
                log.info("✓ Saved #{} {} (fn={}, params={}, samples={}) to DB + JSON",
                        num, problem.getTitle(), problem.getFn(),
                        problem.getParams().size(), problem.getSampleTests().size());

                if (input.split("\\s+|,").length > added.size()) {
                    Thread.sleep(200);
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                log.error("✗ Failed #{}: {}", num, e.getMessage());
            }
        }

        // ★ Dono JSON files write
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
              total: totalNum questions: data { frontendQuestionId titleSlug difficulty topicTags { name } }
            }}""", "{}");

            ArrayNode p1Json    = MAPPER.createArrayNode();
            ArrayNode p2Json    = MAPPER.createArrayNode();
            ObjectNode metaJson = MAPPER.createObjectNode();

            int count = 0;
            for (JsonNode q : list.path("data").path("problemsetQuestionList").path("questions")) {
                String slug = q.path("titleSlug").asText();
                String numStr = q.path("frontendQuestionId").asText("");
                int num;
                try { num = Integer.parseInt(numStr); }
                catch (NumberFormatException e) { continue; }

                try {
                    JsonNode d = fetchQuestionDetail(slug);
                    if (d == null || d.isMissingNode() || d.isNull()) continue;

                    Problem problem  = toProblem(num, d);
                    ProblemMeta meta = toMeta(num, d);

                    problemRepo.save(problem);
                    metaRepo.save(meta);

                    p1Json.add(problemToJson(problem));
                    p2Json.add(problemMetaToJson2(problem, meta));
                    metaJson.set(String.valueOf(num), metaToJson(meta));

                    count++;
                    log.info("✓ [{}] {} {} (samples: {})", count, num, slug, problem.getSampleTests().size());
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
          sampleTestCase metaData
          companyTags { name slug }   // ← Yeh add karo
        }}""", "{\"s\":\"" + escapeJson(slug) + "\"}");
        return root.path("data").path("question");
    }

    private String slugForNumber(int num) throws Exception {
        JsonNode r = graphql("""
            query($f:QuestionListFilterInput){problemsetQuestionList:questionList(
                categorySlug:"", limit:20, skip:0, filters:$f){ 
                questions:data{frontendQuestionId titleSlug} 
            }}""",
                "{\"f\":{\"searchKeywords\":\"" + num + "\"}}");

        JsonNode qs = r.path("data").path("problemsetQuestionList").path("questions");
        if (qs.isArray()) {
            for (JsonNode q : qs) {
                String idStr = q.path("frontendQuestionId").asText("");
                if (idStr.equals(String.valueOf(num))) {
                    return q.path("titleSlug").asText();
                }
            }
            if (qs.size() > 0) {
                return qs.get(0).path("titleSlug").asText();
            }
        }
        return null;
    }

    private JsonNode graphql(String query, String vars) throws Exception {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("query", query);
        body.set("variables", MAPPER.readTree(vars));

        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(GRAPHQL))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0")
                .header("Referer", "https://leetcode.com/")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()));

        if (!sessionCookie.isBlank())
            b.header("Cookie", "LEETCODE_SESSION=" + sessionCookie);

        HttpResponse<String> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() >= 400)
            throw new RuntimeException("GraphQL HTTP " + r.statusCode());

        JsonNode root = MAPPER.readTree(r.body());
        if (root.has("errors"))
            throw new RuntimeException(root.path("errors").toString());
        return root;
    }

    // ★★★ COMPLETE FIX: codeSnippets + metaData + description parsing ★★★
    private Problem toProblem(int num, JsonNode d) {
        List<String> tags = new ArrayList<>();
        if (d.path("topicTags").isArray())
            d.path("topicTags").forEach(t -> tags.add(t.path("name").asText()));

        String fn = "";
        List<Problem.Param> params = new ArrayList<>();
        String ret = "";
        List<Problem.SampleTest> sampleTests = new ArrayList<>();

        // ═══════════ STEP 1: codeSnippets se function signature ═══════════
        JsonNode snippets = d.path("codeSnippets");
        if (snippets.isArray() && snippets.size() > 0) {
            // JavaScript snippet prefer karein
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
            log.debug("Snippet for #{}: {}", num, code.length() > 200 ? code.substring(0, 200) : code);

            // Pattern: "var fnName = function(arg1, arg2) {" OR "var fnName = function(arg1, arg2) {"
            Pattern jsPattern = Pattern.compile(
                    "(?:var|let|const)\\s+(\\w+)\\s*=\\s*function\\s*\\(([^)]*)\\)",
                    Pattern.DOTALL
            );
            Matcher m = jsPattern.matcher(code);
            if (m.find()) {
                fn = m.group(1).trim();
                String argsStr = m.group(2).trim();
                if (!argsStr.isEmpty()) {
                    for (String arg : argsStr.split(",")) {
                        String argName = arg.trim();
                        if (!argName.isEmpty()) {
                            params.add(new Problem.Param(argName, guessType(argName)));
                        }
                    }
                }
            }

            // Return type: `/** @return {boolean} */` ya JS keyword se
            Pattern retPattern = Pattern.compile("@return\\s*\\{([^}]+)\\}");
            Matcher rm = retPattern.matcher(code);
            if (rm.find()) {
                ret = jsTypeToJava(rm.group(1).trim());
            }
        }

        // ═══════════ STEP 2: metaData override (agar available) ═══════════
        try {
            String metaDataStr = d.path("metaData").asText("");
            if (!metaDataStr.isEmpty()) {
                JsonNode meta = MAPPER.readTree(metaDataStr);
                String metaFn = meta.path("name").asText("");
                if (!metaFn.isEmpty()) fn = metaFn;

                JsonNode paramsArr = meta.path("params");
                if (paramsArr.isArray() && paramsArr.size() > 0) {
                    params.clear();
                    for (JsonNode p : paramsArr) {
                        params.add(new Problem.Param(
                                p.path("name").asText(""),
                                p.path("type").asText("")
                        ));
                    }
                }
                String metaRet = meta.path("return").path("type").asText("");
                if (!metaRet.isEmpty()) ret = metaRet;
            }
        } catch (Exception e) {
            log.warn("metaData parse failed for #{}: {}", num, e.getMessage());
        }

        // ═══════════ STEP 3: Description se Input/Output pairs ═══════════
        String description = d.path("content").asText("");
        if (!description.isEmpty()) {
            String text = description
                    .replaceAll("<br\\s*/?>", "\n")
                    .replaceAll("</p>", "\n")
                    .replaceAll("</pre>", "\n")
                    .replaceAll("<[^>]*>", " ")
                    .replace("&quot;", "\"")
                    .replace("&lt;", "<")
                    .replace("&gt;", ">")
                    .replace("&amp;", "&")
                    .replace("&nbsp;", " ")
                    .replace("&#39;", "'")
                    .replace("&apos;", "'");

            Pattern ioPattern = Pattern.compile(
                    "Input:\\s*(.+?)\\s*Output:\\s*(.+?)(?=Explanation:|Example\\s+\\d|Constraints:|\\z)",
                    Pattern.DOTALL
            );
            Matcher m = ioPattern.matcher(text);
            while (m.find()) {
                String input = m.group(1).trim().replaceAll("\\s+", " ");
                String expected = m.group(2).trim().replaceAll("\\s+", " ");
                if (input.isEmpty() || expected.isEmpty()) continue;
                boolean dup = sampleTests.stream().anyMatch(st -> st.getInput().equals(input));
                if (dup) continue;
                sampleTests.add(Problem.SampleTest.builder()
                        .input(input)
                        .expected(expected)
                        .build());
            }
        }

        // ═══════════ STEP 4: sampleTestCase fallback ═══════════
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
                    sampleTests.add(Problem.SampleTest.builder()
                            .input(inputBuilder.toString())
                            .expected("")
                            .build());
                }
            }
        }

        // ═══════════ STEP 5: Final defaults ═══════════
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
                .constraints(new ArrayList<>())
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

        List<String> companies = new ArrayList<>();
        if (d.path("companyTags").isArray())
            d.path("companyTags").forEach(c -> companies.add(c.path("name").asText()));

        return ProblemMeta.builder()
                .id(num)
                .companies(companies)
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
                .id(id).hints(hints).companies(companies).edgeCases(edges)
                .explanation(j.path("explanation").asText("")).build();
    }

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}