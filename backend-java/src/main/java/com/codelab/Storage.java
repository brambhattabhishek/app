package com.codelab;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Map;

@Service
public class Storage {
    public record Obj(byte[] data, String contentType) {}

    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper om = new ObjectMapper();
    private volatile String storageKey;

    static String url() {
        String b = Notifier.env("INTEGRATION_PROXY_URL");
        return (b == null ? "https://integrations.emergentagent.com" : b.trim()).replaceAll("/+$", "") + "/objstore/api/v1/storage";
    }

    synchronized String key(boolean force) throws Exception {
        if (storageKey != null && !force) return storageKey;
        HttpRequest req = HttpRequest.newBuilder(URI.create(url() + "/init")).header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(Map.of("emergent_key", Notifier.env("EMERGENT_LLM_KEY"))))).build();
        HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() >= 300) throw new IllegalStateException("Storage init failed: " + r.statusCode());
        storageKey = om.readTree(r.body()).path("storage_key").asText();
        return storageKey;
    }

    public String put(String path, byte[] data, String contentType) throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url() + "/objects/" + path)).header("X-Storage-Key", key(attempt > 0))
                    .header("Content-Type", contentType).PUT(HttpRequest.BodyPublishers.ofByteArray(data)).build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            if (r.statusCode() == 404 && attempt == 0) continue;
            if (r.statusCode() >= 300) throw new IllegalStateException("Upload failed: " + r.statusCode());
            return om.readTree(r.body()).path("path").asText(path);
        }
        throw new IllegalStateException("Upload failed");
    }

    public Obj get(String path) throws Exception {
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpRequest req = HttpRequest.newBuilder(URI.create(url() + "/objects/" + path)).header("X-Storage-Key", key(attempt > 0)).GET().build();
            HttpResponse<byte[]> r = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
            if (r.statusCode() == 404 && attempt == 0) continue;
            if (r.statusCode() >= 300) throw new IllegalStateException("Download failed: " + r.statusCode());
            return new Obj(r.body(), r.headers().firstValue("Content-Type").orElse("application/octet-stream"));
        }
        throw new IllegalStateException("Download failed");
    }
}
