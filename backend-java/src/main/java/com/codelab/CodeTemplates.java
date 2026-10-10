package com.codelab;

import org.springframework.core.io.ClassPathResource;

import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

public class CodeTemplates {
    private static final Map<String, String> RES = new HashMap<>();

    static String res(String name) {
        return RES.computeIfAbsent(name, n -> {
            try {
                return new String(new ClassPathResource("drivers/" + n).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    @SuppressWarnings("unchecked")
    static List<Map<String, Object>> params(Map<String, Object> p) {
        return (List<Map<String, Object>>) p.get("params");
    }

    static String py(String t) {
        return switch (t) { case "int[]" -> "List[int]"; case "string" -> "str"; case "double" -> "float"; default -> t; };
    }

    static String java(String t) {
        return switch (t) { case "string" -> "String"; case "bool" -> "boolean"; default -> t; };
    }

    static String cpp(String t, boolean param) {
        return switch (t) { case "int[]" -> param ? "vector<int>&" : "vector<int>"; case "string" -> "string"; default -> t; };
    }

    static String js(String t) {
        return switch (t) { case "int[]" -> "number[]"; case "string" -> "string"; case "bool" -> "boolean"; default -> "number"; };
    }

    static String parser(String t) {
        return switch (t) { case "int" -> "pInt"; case "int[]" -> "pIntArr"; case "string" -> "pStr"; case "bool" -> "pBool"; default -> "pDouble"; };
    }

    static String join(Map<String, Object> p, java.util.function.Function<Map<String, Object>, String> f) {
        return params(p).stream().map(f).collect(Collectors.joining(", "));
    }

    public static Map<String, String> boilerplates(Map<String, Object> p) {
        String fn = (String) p.get("fn"), ret = (String) p.get("ret");
        Map<String, String> m = new LinkedHashMap<>();
        m.put("python", "class Solution:\n    def " + fn + "(self, " + join(p, x -> x.get("name") + ": " + py((String) x.get("type")))
                + ") -> " + py(ret) + ":\n        pass");
        m.put("java", "class Solution {\n    public " + java(ret) + " " + fn + "(" + join(p, x -> java((String) x.get("type")) + " " + x.get("name"))
                + ") {\n        \n    }\n}");
        m.put("cpp", "class Solution {\npublic:\n    " + cpp(ret, false) + " " + fn + "(" + join(p, x -> cpp((String) x.get("type"), true) + " " + x.get("name"))
                + ") {\n        \n    }\n};");
        StringBuilder doc = new StringBuilder("/**\n");
        for (Map<String, Object> x : params(p)) doc.append(" * @param {").append(js((String) x.get("type"))).append("} ").append(x.get("name")).append("\n");
        doc.append(" * @return {").append(js(ret)).append("}\n */\n");
        m.put("javascript", doc + "var " + fn + " = function(" + join(p, x -> (String) x.get("name")) + ") {\n    \n};");
        return m;
    }

    public static String python(String code, Map<String, Object> p) {
        int k = params(p).size();
        return "import sys, json, math, collections, heapq, bisect, itertools\nfrom typing import *\nfrom collections import *\n\n" + code
                + "\n\n" + res("driver.py").replace("__RET__", (String) p.get("ret")).replace("__K__", String.valueOf(k)).replace("__FN__", (String) p.get("fn"));
    }

    public static String javascript(String code, Map<String, Object> p) {
        String ser = "double".equals(p.get("ret")) ? "Number(v).toFixed(5)" : "JSON.stringify(v)";
        return code + "\n\n" + res("driver.js").replace("__SER__", ser).replace("__K__", String.valueOf(params(p).size())).replace("__FN__", (String) p.get("fn"));
    }

    static String argsDecl(Map<String, Object> p, String lineExpr) {
        StringBuilder b = new StringBuilder();
        List<Map<String, Object>> ps = params(p);
        for (int i = 0; i < ps.size(); i++)
            b.append("      auto a").append(i).append(" = ").append(parser((String) ps.get(i).get("type"))).append("(").append(lineExpr).append(");\n");
        return b.toString();
    }

    static String callArgs(Map<String, Object> p) {
        List<String> a = new ArrayList<>();
        for (int i = 0; i < params(p).size(); i++) a.add("a" + i);
        return String.join(", ", a);
    }

    public static String java(String code, Map<String, Object> p) {
        String decl = argsDecl(p, "__l.get(__idx++)").replace("auto ", "var ");
        return "import java.util.*;\nimport java.io.*;\nimport java.util.stream.*;\n\n" + code.replace("public class Solution", "class Solution")
                + "\n\n" + res("Main.java.txt").replace("__DECL__", decl).replace("__CALL__", "new Solution()." + p.get("fn") + "(" + callArgs(p) + ")");
    }

    public static String cpp(String code, Map<String, Object> p) {
        String decl = argsDecl(p, "__l[__idx++]");
        return "#include <bits/stdc++.h>\nusing namespace std;\n\n" + code + "\n\n"
                + res("main.cpp.txt").replace("__DECL__", decl).replace("__CALL__", "__sol." + p.get("fn") + "(" + callArgs(p) + ")");
    }
}
