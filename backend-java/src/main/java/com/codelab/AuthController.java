package com.codelab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoCollection;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.*;

import static com.mongodb.client.model.Filters.eq;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired MongoTemplate mongo;
    @Autowired AuthService auth;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper om = new ObjectMapper();

    record RegisterReq(String name, String email, String password) {}
    record LoginReq(String email, String password) {}
    record GoogleReq(String session_id) {}

    MongoCollection<Document> users() { return mongo.getCollection("users"); }

    static ResponseStatusException err(HttpStatus s, String msg) { return new ResponseStatusException(s, msg); }

    static String newId() { return "user_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12); }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterReq r) {
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw err(HttpStatus.BAD_REQUEST, "Enter a valid email");
        if (r.password() == null || r.password().length() < 6) throw err(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        if (users().find(eq("email", email)).first() != null) throw err(HttpStatus.CONFLICT, "Email already registered");
        String name = r.name() == null || r.name().isBlank() ? email.split("@")[0] : r.name().trim();
        Document u = new Document("user_id", newId()).append("email", email).append("name", name).append("picture", null)
                .append("provider", "email").append("password_hash", enc.encode(r.password())).append("created_at", new Date());
        users().insertOne(u);
        return auth.session(u);
    }

    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginReq r) {
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        Document u = users().find(eq("email", email)).first();
        if (u == null || u.getString("password_hash") == null || r.password() == null || !enc.matches(r.password(), u.getString("password_hash")))
            throw err(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        return auth.session(u);
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String h) {
        return AuthService.publicUser(auth.require(h));
    }

    @PostMapping("/google")
    public Map<String, Object> google(@RequestBody GoogleReq r) throws Exception {
        if (r.session_id() == null || r.session_id().isBlank()) throw err(HttpStatus.BAD_REQUEST, "session_id required");
        HttpRequest req = HttpRequest.newBuilder(URI.create("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"))
                .header("X-Session-ID", r.session_id()).GET().build();
        HttpResponse<String> res = http.send(req, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw err(HttpStatus.UNAUTHORIZED, "Google session invalid or expired");
        JsonNode j = om.readTree(res.body());
        String email = j.path("email").asText().toLowerCase();
        Document u = users().find(eq("email", email)).first();
        if (u == null) {
            u = new Document("user_id", newId()).append("email", email).append("name", j.path("name").asText())
                    .append("picture", j.path("picture").asText(null)).append("provider", "google").append("created_at", new Date());
            users().insertOne(u);
        } else {
            users().updateOne(eq("email", email), new Document("$set", new Document("picture", j.path("picture").asText(null))));
            u.put("picture", j.path("picture").asText(null));
        }
        return auth.session(u);
    }
}
