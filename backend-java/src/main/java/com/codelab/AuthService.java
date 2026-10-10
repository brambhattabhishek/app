package com.codelab;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.*;

import static com.mongodb.client.model.Filters.eq;

@Service
public class AuthService {
    @Autowired MongoTemplate mongo;
    private final SecretKey key = Keys.hmacShaKeyFor(System.getenv("JWT_SECRET").getBytes(StandardCharsets.UTF_8));

    public String token(String uid) {
        return Jwts.builder().subject(uid).issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 7L * 86_400_000)).signWith(key).compact();
    }

    public Document optional(String header) {
        if (header == null || !header.startsWith("Bearer ")) return null;
        try {
            String uid = Jwts.parser().verifyWith(key).build().parseSignedClaims(header.substring(7)).getPayload().getSubject();
            return mongo.getCollection("users").find(eq("user_id", uid)).first();
        } catch (Exception e) {
            return null;
        }
    }

    public Document require(String header) {
        Document u = optional(header);
        if (u == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please login to continue");
        return u;
    }

    public static Map<String, Object> publicUser(Document u) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String k : List.of("user_id", "name", "email", "picture", "provider", "created_at")) m.put(k, u.get(k));
        return m;
    }

    public Map<String, Object> session(Document u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("token", token(u.getString("user_id")));
        m.put("user", publicUser(u));
        return m;
    }
}
