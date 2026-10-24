package com.codelab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

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

    /** In-memory session cookie — thread-safe. */
    private volatile String sessionCookie = "";

    /** Guard against overlapping full-fetches. */
    private final AtomicBoolean fetchingAll = new AtomicBoolean(false);

    public void setSessionCookie(String cookie) {
        this.sessionCookie = cookie == null ? "" : cookie.trim();
    }

    public boolean isFetchingAll() {
        return fetchingAll.get();
    }

    // ============================================================
    //  PUBLIC API
    // ============================================================

    /** Add/replace one or more problems by number. Persists to Mongo AND JSON files. */
    public synchronized List<Integer> addProblems(String input) throws Exception {
        List<Integer> added = new ArrayList<>();
        if (input == null || input.isBlank()) return added;

        ArrayNode p1Json   = readArray(P1);
        ArrayNode p2Json   = readArray(P2);
        ObjectNode metaJson = readObject(PM);

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

                problemRepo.save(problem);
                metaRepo.save(meta);

                replaceOrAdd(p1Json, num, problemToJson(problem));
                replaceOrAdd(p2Json, num, problemMetaToJson2(problem, meta));
                metaJson.set(String.valueOf(num), metaToJson(meta));

                added.add(num);
                log.info("✓ Saved #{} {} to Mongo + JSON", num, problem.getTitle());

                // Only sleep *between* problems, not after the last one
                if (input.split("\\s+|,").length > added.size()) {
                    Thread.sleep(200);
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                log.warn("Interrupted at #{}", num);
                break;
            } catch (Exception e) {
                log.error("✗ Failed #{}: {}", num, e.getMessage());
            }
        }

        write(P1, p1Json);
        write(P2, p2Json);
        write(PM, metaJson);
        return added;
    }

    /**
     * Full refresh — slow (thousands of problems × ~300ms each).
     * Call via @Async path or background thread.
     */
    @Async("taskExecutor")
    public void fetchAllAsync() {
        try {
            fetchAll();
        } catch (Exception e) {
            log.error("fetchAll background failure", e);
        }
    }

    /** Synchronous full fetch. Prefer fetchAllAsync() from the controller. */
    public int fetchAll() throws Exception {
        if (!fetchingAll.compareAndSet(false, true)) {
            log.warn("fetchAll already running — skipping duplicate request");
            return 0;
        }
        try {
            JsonNode list = graphql("""
                query { problemsetQuestionList: questionList(categorySlug:"",limit:3000,skip:0,filters:{}) {
                  total: totalNum questions: data { frontendQuestionId titleSlug difficulty topicTags { name } }
                }}""", "{}");

            ArrayNode p1Json    = MAPPER.createArrayNode();
            ArrayNode p2Json    = MAPPER.createArrayNode();
            ObjectNode metaJson = MAPPER.createObjectNode();

            int count = 0;
            int idx = 0;
            for (JsonNode q : list.path("data").path("problemsetQuestionList").path("questions")) {
                idx++;
                String slug = q.path("titleSlug").asText();
                String numStr = q.path("frontendQuestionId").asText("");
                int num;
                try { num = Integer.parseInt(numStr); }
                catch (NumberFormatException e) {
                    log.warn("Skip non-numeric frontendQuestionId '{}'", numStr);
                    continue;
                }

                try {
                    JsonNode d = fetchQuestionDetail(slug);
                    if (d == null || d.isMissingNode() || d.isNull()) {
                        log.warn("Empty detail for {} {}", num, slug);
                        continue;
                    }

                    Problem problem  = toProblem(num, d);
                    ProblemMeta meta = toMeta(num, d);

                    problemRepo.save(problem);
                    metaRepo.save(meta);

                    p1Json.add(problemToJson(problem));
                    p2Json.add(problemMetaToJson2(problem, meta));
                    metaJson.set(String.valueOf(num), metaToJson(meta));

                    count++;
                    log.info("✓ [{}] {} {}", count, num, slug);
                    Thread.sleep(250);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    log.warn("fetchAll interrupted at #{}", num);
                    break;
                } catch (Exception e) {
                    log.error("✗ {} {}: {}", num, slug, e.getMessage());
                }
            }

            write(P1, p1Json);
            write(P2, p2Json);
            write(PM, metaJson);
            log.info("fetchAll done — {} / {} problems written", count, idx);
            return count;
        } finally {
            fetchingAll.set(false);
        }
    }

    // ============================================================
    //  GraphQL helper
    // ============================================================

    private JsonNode fetchQuestionDetail(String slug) throws Exception {
        JsonNode root = graphql("""
            query($s:String!){question(titleSlug:$s){
              questionFrontendId title titleSlug content difficulty
              topicTags{name} hints
              codeSnippets{lang code}
              sampleTestCase metaData
            }}""", "{\"s\":\"" + escapeJson(slug) + "\"}");
        return root.path("data").path("question");
    }

    private String slugForNumber(int num) throws Exception {
        JsonNode r = graphql("""
            query($f:QuestionListFilterInput){problemsetQuestionList:questionList(
                categorySlug:"", limit:1, skip:0, filters:$f){ questions:data{titleSlug} }}""",
                "{\"f\":{\"searchKeywords\":\"" + num + "\"}}");
        JsonNode qs = r.path("data").path("problemsetQuestionList").path("questions");
        return qs.isArray() && qs.size() > 0 ? qs.get(0).path("titleSlug").asText() : null;
    }

    private JsonNode graphql(String query, String vars) throws Exception {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("query", query);
        body.set("variables", MAPPER.readTree(vars));

        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(GRAPHQL))
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (codelab-leetcode-admin)")
                .header("Referer", "https://leetcode.com/")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()));

        if (!sessionCookie.isBlank())
            b.header("Cookie", "LEETCODE_SESSION=" + sessionCookie + "; csrftoken=" + csrfFromCookie());

        HttpResponse<String> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() >= 400)
            throw new RuntimeException("GraphQL HTTP " + r.statusCode() + ": " + truncate(r.body(), 200));

        JsonNode root = MAPPER.readTree(r.body());
        if (root.has("errors"))
            throw new RuntimeException(root.path("errors").toString());
        return root;
    }

    private String csrfFromCookie() {
        // LeetCode also needs a csrftoken cookie for authed queries; if user only pasted LEETCODE_SESSION we can't fabricate it.
        // This returns a blank string if absent — public queries still work.
        return "";
    }

    // ============================================================
    //  BUILDERS  (JsonNode → domain)
    // ============================================================

    private Problem toProblem(int num, JsonNode d) {
        List<String> tags = new ArrayList<>();
        if (d.path("topicTags").isArray())
            d.path("topicTags").forEach(t -> tags.add(t.path("name").asText()));

        return Problem.builder()
                .id(num)
                .slug(text(d, "titleSlug"))
                .title(text(d, "title"))
                .difficulty(text(d, "difficulty"))
                .tags(tags)
                .acceptance(0.0)
                .fn("")
                .params(new ArrayList<>())
                .ret("")
                .description(text(d, "content"))
                .constraints(new ArrayList<>())
                .sampleTests(new ArrayList<>())
                .hiddenTests(new ArrayList<>())
                .editorial(Problem.Editorial.builder()
                        .approach("See LeetCode")
                        .complexity("")
                        .code("")
                        .build())
                .build();
    }

    private ProblemMeta toMeta(int num, JsonNode d) {
        List<String> hints = new ArrayList<>();
        if (d.path("hints").isArray())
            d.path("hints").forEach(h -> hints.add(h.asText()));

        return ProblemMeta.builder()
                .id(num)
                .companies(new ArrayList<>())
                .hints(hints)
                .edgeCases(new ArrayList<>())
                .explanation("")
                .build();
    }

    /** Safe text getter — never returns "null" string. */
    private static String text(JsonNode n, String field) {
        JsonNode v = n.path(field);
        return v.isMissingNode() || v.isNull() ? "" : v.asText("");
    }

    // ============================================================
    //  DOMAIN → JsonNode (keeps your exact file schema)
    // ============================================================

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

    /** problems2.json = Problem + companies/hints/edgeCases/explanation */
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

    // ============================================================
    //  JSON file helpers
    // ============================================================

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

    // ============================================================
    //  ONE-TIME MIGRATION — seed Mongo from existing JSON files
    // ============================================================

    public int migrateJsonToMongo() throws IOException {
        ArrayNode p1Json = readArray(P1);
        ArrayNode p2Json = readArray(P2);
        ObjectNode pm    = readObject(PM);

        int problemsSaved = 0;
        for (JsonNode j : p1Json) {
            try {
                Problem p = MAPPER.treeToValue(j, Problem.class);
                if (p.getId() == null) {
                    log.warn("skip problem with missing id: {}", truncate(j.toString(), 120));
                    continue;
                }
                problemRepo.save(p);
                problemsSaved++;
            } catch (Exception e) {
                log.warn("problem migrate skip: {}", e.getMessage());
            }
        }

        // Meta may live inside problems2.json (id-keyed array) OR problems_meta.json (id-keyed object)
        int metaSaved = 0;

        // 1) problems2.json entries (each has id + companies/hints/etc.)
        for (JsonNode j : p2Json) {
            try {
                int id = j.path("id").asInt(-1);
                if (id < 0) continue;
                metaRepo.save(buildMetaFromJson(id, j));
                metaSaved++;
            } catch (Exception e) {
                log.warn("meta2 migrate skip: {}", e.getMessage());
            }
        }

        // 2) problems_meta.json — object keyed by numeric string
        var fields = pm.fields();
        while (fields.hasNext()) {
            var entry = fields.next();
            try {
                int id = Integer.parseInt(entry.getKey());
                metaRepo.save(buildMetaFromJson(id, entry.getValue()));
                metaSaved++;
            } catch (Exception e) {
                log.warn("metaObj migrate skip key={}: {}", entry.getKey(), e.getMessage());
            }
        }

        log.info("Migrated {} problems + {} meta docs to Mongo", problemsSaved, metaSaved);
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
                .hints(hints)
                .companies(companies)
                .edgeCases(edges)
                .explanation(j.path("explanation").asText(""))
                .build();
    }

    // ============================================================
    //  Misc
    // ============================================================

    private static String escapeJson(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String truncate(String s, int max) {
        if (s == null) return "";
        return s.length() <= max ? s : s.substring(0, max) + "…";
    }
}