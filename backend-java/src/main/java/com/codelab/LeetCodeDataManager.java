package com.codelab;

import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import java.io.*;
import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.util.*;

public class LeetCodeDataManager {
    static final String GRAPHQL = "https://leetcode.com/graphql/";
    static final HttpClient CLIENT = HttpClient.newHttpClient();
    static final ObjectMapper MAPPER = new ObjectMapper();
    static final String RES = "src/main/resources/";
    static final Path P1 = Paths.get(RES + "problems.json");
    static final Path P2 = Paths.get(RES + "problems2.json");
    static final Path PM = Paths.get(RES + "problems_meta.json");
    static String sessionCookie = ""; // paste LEETCODE_SESSION for company tags

    public static void main(String[] args) throws Exception {
        Scanner sc = new Scanner(System.in);
        while (true) {
            System.out.println("\n=== LeetCode Admin ===");
            System.out.println("1. Fetch ALL problems (rebuild from scratch)");
            System.out.println("2. Add problem(s) by number(s) — e.g. 1 3 5 or 1,3,5");
            System.out.println("3. Exit");
            System.out.print("Choice: ");
            String cmd = sc.nextLine().trim();
            if (cmd.equals("3")) break;
            if (cmd.equals("1")) {
                System.out.print("Paste LEETCODE_SESSION cookie (blank = skip company tags): ");
                sessionCookie = sc.nextLine().trim();
                fetchAll();
            } else if (cmd.equals("2")) {
                System.out.print("Problem numbers: ");
                addProblems(sc.nextLine());
            }
        }
    }

    // ---------- FETCH ALL ----------
    static void fetchAll() throws Exception {
        JsonNode list = graphql("""
            query { problemsetQuestionList: questionList(categorySlug:"",limit:3000,skip:0,filters:{}) {
              total: totalNum questions: data { frontendQuestionId titleSlug difficulty topicTags { name } }
            }}""", "{}");
        ArrayNode p1 = MAPPER.createArrayNode(), p2 = MAPPER.createArrayNode();
        ObjectNode meta = MAPPER.createObjectNode();
        for (JsonNode q : list.path("data").path("problemsetQuestionList").path("questions")) {
            String slug = q.path("titleSlug").asText();
            int num = Integer.parseInt(q.path("frontendQuestionId").asText());
            try {
                JsonNode detail = graphql("""
                    query($s:String!){question(titleSlug:$s){questionFrontendId title titleSlug content difficulty
                    topicTags{name} hints codeSnippets{lang code} sampleTestCase metaData}}""",
                        "{\"s\":\"" + slug + "\"}").path("data").path("question");
                p1.add(buildProblem1(num, detail));
                p2.add(buildProblem2(num, detail));
                meta.set(String.valueOf(num), buildMeta(num, detail));
                System.out.println("✓ " + num + " " + slug);
                Thread.sleep(300); // rate limit
            } catch (Exception e) {
                System.err.println("✗ " + num + " " + slug + " : " + e.getMessage());
            }
        }
        write(P1, p1); write(P2, p2); write(PM, meta);
        System.out.println("Done. Wrote " + p1.size() + " problems.");
    }

    // ---------- ADD BY NUMBER(S) ----------
    static void addProblems(String input) throws Exception {
        ArrayNode p1 = readArray(P1);
        ArrayNode p2 = readArray(P2);
        ObjectNode meta = readObject(PM);

        for (String token : input.replace(",", " ").split("\\s+")) {
            if (token.isBlank()) continue;
            int num = Integer.parseInt(token);
            String slug = slugForNumber(num);
            if (slug == null) { System.err.println("✗ No slug for #" + num); continue; }

            JsonNode d = graphql("""
            query($s:String!){question(titleSlug:$s){questionFrontendId title titleSlug content difficulty
            topicTags{name} hints codeSnippets{lang code} sampleTestCase metaData}}""",
                    "{\"s\":\"" + slug + "\"}").path("data").path("question");

            replaceOrAdd(p1, num, buildProblem1(num, d));
            replaceOrAdd(p2, num, buildProblem2(num, d));
            meta.set(String.valueOf(num), buildMeta(num, d));
            System.out.println("✓ Added/replaced #" + num + " " + d.path("title").asText());
        }
        write(P1, p1); write(P2, p2); write(PM, meta);
    }

    static String slugForNumber(int num) throws Exception {
        JsonNode r = graphql("""
            query($f:QuestionListFilterInput){problemsetQuestionList:questionList(categorySlug:"",limit:1,skip:0,filters:$f){
              questions:data{titleSlug}}}""",
                "{\"f\":{\"searchKeywords\":\"" + num + "\"}}");
        JsonNode qs = r.path("data").path("problemsetQuestionList").path("questions");
        return qs.isArray() && qs.size() > 0 ? qs.get(0).path("titleSlug").asText() : null;
    }

    // ---------- BUILDERS (match your exact schema) ----------
    static ObjectNode buildProblem1(int num, JsonNode d) {
        ObjectNode o = MAPPER.createObjectNode();
        o.put("id", num);
        o.put("slug", d.path("titleSlug").asText());
        o.put("title", d.path("title").asText());
        o.put("difficulty", d.path("difficulty").asText());
        o.set("tags", names(d.path("topicTags")));
        o.put("acceptance", 0); // not in this query; add acRate to list query if needed
        o.put("fn", "");
        o.set("params", MAPPER.createArrayNode());
        o.put("ret", "");
        o.put("description", d.path("content").asText());
        o.set("constraints", MAPPER.createArrayNode());
        o.set("sampleTests", MAPPER.createArrayNode());
        o.set("hiddenTests", MAPPER.createArrayNode());
        ObjectNode ed = MAPPER.createObjectNode();
        ed.put("approach", "See LeetCode");
        ed.put("complexity", "");
        ed.put("code", "");
        o.set("editorial", ed);
        return o;
    }

    static ObjectNode buildProblem2(int num, JsonNode d) {
        ObjectNode o = MAPPER.createObjectNode();
        o.put("id", num);
        o.put("slug", d.path("titleSlug").asText());
        o.put("title", d.path("title").asText());
        o.put("difficulty", d.path("difficulty").asText());
        o.set("tags", names(d.path("topicTags")));
        o.set("companies", MAPPER.createArrayNode()); // needs auth + premium
        o.put("fn", "");
        o.set("params", MAPPER.createArrayNode());
        o.put("ret", "");
        o.put("description", d.path("content").asText());
        o.set("constraints", MAPPER.createArrayNode());
        o.set("hints", MAPPER.createArrayNode());
        o.set("edgeCases", MAPPER.createArrayNode());
        o.put("explanation", "");
        o.set("sampleTests", MAPPER.createArrayNode());
        o.set("hiddenTests", MAPPER.createArrayNode());
        ObjectNode ed = MAPPER.createObjectNode();
        ed.put("approach", "See LeetCode");
        ed.put("complexity", "");
        ed.put("code", "");
        o.set("editorial", ed);
        return o;
    }

    static ObjectNode buildMeta(int num, JsonNode d) {
        ObjectNode o = MAPPER.createObjectNode();
        o.set("companies", MAPPER.createArrayNode());
        o.set("hints", d.path("hints"));
        o.set("edgeCases", MAPPER.createArrayNode());
        o.put("explanation", "");
        return o;
    }

    // ---------- GRAPHQL HELPER ----------
    static JsonNode graphql(String query, String vars) throws Exception {
        ObjectNode body = MAPPER.createObjectNode();
        body.put("query", query);
        body.set("variables", MAPPER.readTree(vars));
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create(GRAPHQL))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body.toString()));
        if (!sessionCookie.isBlank()) b.header("Cookie", "LEETCODE_SESSION=" + sessionCookie);
        HttpResponse<String> r = CLIENT.send(b.build(), HttpResponse.BodyHandlers.ofString());
        JsonNode root = MAPPER.readTree(r.body());
        if (root.has("errors")) throw new RuntimeException(root.path("errors").toString());
        return root;
    }

    // ---------- JSON FILE I/O ----------
// ---------- JSON FILE I/O ----------
    static ArrayNode readArray(Path p) throws IOException {
        if (!Files.exists(p) || Files.size(p) == 0) return MAPPER.createArrayNode();
        JsonNode n = MAPPER.readTree(p.toFile());
        return n.isArray() ? (ArrayNode) n : MAPPER.createArrayNode();
    }

    static ObjectNode readObject(Path p) throws IOException {
        if (!Files.exists(p) || Files.size(p) == 0) return MAPPER.createObjectNode();
        JsonNode n = MAPPER.readTree(p.toFile());
        return n.isObject() ? (ObjectNode) n : MAPPER.createObjectNode();
    }

    static void write(Path p, JsonNode n) throws IOException {
        Files.createDirectories(p.getParent());
        MAPPER.writerWithDefaultPrettyPrinter().writeValue(p.toFile(), n);
    }

    static void replaceOrAdd(ArrayNode arr, int id, ObjectNode obj) {
        for (int i = 0; i < arr.size(); i++) {
            if (arr.get(i).path("id").asInt() == id) { arr.set(i, obj); return; }
        }
        arr.add(obj);
    }

    static ArrayNode names(JsonNode tags) {
        ArrayNode a = MAPPER.createArrayNode();
        if (tags != null && tags.isArray()) {
            for (JsonNode t : tags) a.add(t.path("name").asText());
        }
        return a;
    }
}