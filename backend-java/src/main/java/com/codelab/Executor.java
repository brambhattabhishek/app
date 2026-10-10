package com.codelab;

import org.springframework.stereotype.Component;

import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Component
public class Executor {
    public record ExecResult(String status, String error, List<String> outputs, List<String> logs, long runtimeMs) {}

    record Proc(int code, boolean timedOut, String out) {}

    static final int MAX_OUT = 64 * 1024;

    Proc exec(Path dir, List<String> cmd, String stdin, int timeoutSec) throws Exception {
        Process pr = new ProcessBuilder(cmd).directory(dir.toFile()).redirectErrorStream(true).start();
        CompletableFuture<byte[]> out = CompletableFuture.supplyAsync(() -> {
            try { return pr.getInputStream().readAllBytes(); } catch (Exception e) { return new byte[0]; }
        });
        try (OutputStream os = pr.getOutputStream()) {
            os.write(stdin.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ignored) {}
        boolean done = pr.waitFor(timeoutSec, TimeUnit.SECONDS);
        if (!done) pr.destroyForcibly();
        String s = new String(out.get(5, TimeUnit.SECONDS), StandardCharsets.UTF_8);
        if (s.length() > MAX_OUT) s = s.substring(0, MAX_OUT) + "\n...output truncated";
        return new Proc(done ? pr.exitValue() : -1, !done, s);
    }

    public ExecResult run(String lang, String code, Map<String, Object> p, List<String> inputs) {
        Path dir = null;
        try {
            dir = Files.createTempDirectory("cl");
            String stdin = inputs.size() + "\n" + String.join("\n", inputs) + "\n";
            List<String> cmd;
            switch (lang) {
                case "python" -> { Files.writeString(dir.resolve("main.py"), CodeTemplates.python(code, p)); cmd = List.of("python3", "main.py"); }
                case "javascript" -> { Files.writeString(dir.resolve("main.js"), CodeTemplates.javascript(code, p)); cmd = List.of("node", "main.js"); }
                case "java" -> {
                    Files.writeString(dir.resolve("Main.java"), CodeTemplates.java(code, p));
                    Proc c = exec(dir, List.of("javac", "-encoding", "UTF-8", "-nowarn", "Main.java"), "", 40);
                    if (c.code() != 0) return new ExecResult("Compile Error", c.out().trim(), List.of(), List.of(), 0);
                    cmd = List.of("java", "-Xss64m", "-Xmx256m", "-cp", ".", "Main");
                }
                case "cpp" -> {
                    Files.writeString(dir.resolve("main.cpp"), CodeTemplates.cpp(code, p));
                    Proc c = exec(dir, List.of("g++", "-O2", "-std=c++17", "-o", "main", "main.cpp"), "", 60);
                    if (c.code() != 0) return new ExecResult("Compile Error", c.out().replace(dir + File.separator, "").trim(), List.of(), List.of(), 0);
                    cmd = List.of("./main");
                }
                default -> throw new IllegalArgumentException("Unsupported language");
            }
            long t0 = System.nanoTime();
            Proc r0 = exec(dir, cmd, stdin, 10);
            Proc r = new Proc(r0.code(), r0.timedOut(), r0.out().replace(dir + File.separator, ""));
            long ms = (System.nanoTime() - t0) / 1_000_000;
            return parse(r, ms);
        } catch (Exception e) {
            return new ExecResult("Runtime Error", e.getMessage(), List.of(), List.of(), 0);
        } finally {
            if (dir != null) deleteDir(dir.toFile());
        }
    }

    ExecResult parse(Proc r, long ms) {
        List<String> outputs = new ArrayList<>(), logs = new ArrayList<>();
        StringBuilder pre = new StringBuilder(), cur = null;
        for (String line : r.out().split("\n", -1)) {
            if (line.equals("@@CASE@@")) {
                if (cur != null) logs.add(cur.toString());
                cur = new StringBuilder();
                outputs.add(null);
            } else if (line.startsWith("@@RESULT@@")) {
                outputs.set(outputs.size() - 1, line.substring(10).trim());
            } else {
                (cur == null ? pre : cur).append(line).append("\n");
            }
        }
        if (cur != null) logs.add(cur.toString());
        String status = r.timedOut() ? "Time Limit Exceeded" : r.code() != 0 ? "Runtime Error" : "OK";
        String error = null;
        if (r.timedOut()) error = "Time Limit Exceeded (10s)";
        else if (r.code() != 0) error = (logs.isEmpty() ? pre.toString() : logs.get(logs.size() - 1)).trim();
        if (error != null && error.isEmpty()) error = "Process exited with code " + r.code();
        return new ExecResult(status, error, outputs, logs, ms);
    }

    void deleteDir(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteDir(k);
        f.delete();
    }
}
