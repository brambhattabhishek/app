package com.codelab;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.HttpServletRequest;
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
    @Autowired Notifier notifier;
    private final SecretKey key = Keys.hmacShaKeyFor(System.getenv("JWT_SECRET").getBytes(StandardCharsets.UTF_8));
    static final long ACTIVE_TOUCH_MS = 5 * 60_000L;

    // ★ UPDATED: Ab JWT token mein role bhi jayega
    public String token(String uid, String email, String role) {
        return Jwts.builder()
                .subject(uid)
                .claim("email", email)
                .claim("role", role == null ? "USER" : role) // ROLE JWT MEIN ADD KIYA
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 7L * 86_400_000))
                .signWith(key)
                .compact();
    }

    public Document optional(String header) {
        if (header == null || !header.startsWith("Bearer ")) return null;
        try {
            String uid = Jwts.parser().verifyWith(key).build().parseSignedClaims(header.substring(7)).getPayload().getSubject();
            Document u = mongo.getCollection("users").find(eq("user_id", uid)).first();
            if (u != null) {
                Date last = u.getDate("last_active_at");
                if (last == null || System.currentTimeMillis() - last.getTime() > ACTIVE_TOUCH_MS)
                    mongo.getCollection("users").updateOne(eq("user_id", uid), new Document("$set", new Document("last_active_at", new Date())));
            }
            return u;
        } catch (Exception e) {
            return null;
        }
    }

    public Document require(String header) {
        Document u = optional(header);
        if (u == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please login to continue");
        return u;
    }

    // ★ UPDATED: Database ka role field check karega
    public static boolean isAdmin(Document u) {
        if (u == null) return false;
        String role = u.getString("role");
        if ("ADMIN".equalsIgnoreCase(role)) return true;

        // Fallback: check legacy ADMIN_EMAILS env
        String admins = Optional.ofNullable(System.getenv("ADMIN_EMAILS")).orElse("");
        return u.getString("email") != null && Arrays.asList(admins.toLowerCase().split(",")).contains(u.getString("email").toLowerCase());
    }

    public static Map<String, Object> publicUser(Document u) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String k : List.of("user_id", "name", "email", "phone", "picture", "provider", "providers", "bio", "about", "socials", "location", "interests", "daily_reminder", "daily_streak", "daily_best", "coins", "badges",
                "github_login", "created_at", "last_login_at", "login_count"))
            m.put(k, u.get(k));

        boolean admin = isAdmin(u);
        m.put("role", u.getString("role") == null ? "USER" : u.getString("role")); // Role explicitly bhejein
        m.put("is_admin", admin);
        m.put("isAdmin", admin); // Frontend isAdmin dhundh raha hai
        return m;
    }

    public static String ip(HttpServletRequest req) {
        String f = req.getHeader("X-Forwarded-For");
        return f != null && !f.isBlank() ? f.split(",")[0].trim() : req.getRemoteAddr();
    }

    public Map<String, Object> login(Document u, boolean isNew, String method, HttpServletRequest req) {
        Date prevActive = u.getDate("last_active_at");
        Date now = new Date();
        String ua = Optional.ofNullable(req.getHeader("User-Agent")).orElse("");
        mongo.getCollection("users").updateOne(eq("user_id", u.getString("user_id")), new Document("$set",
                new Document("last_login_at", now).append("last_active_at", now).append("last_ip", ip(req)).append("last_user_agent", ua))
                .append("$inc", new Document("login_count", 1)).append("$addToSet", new Document("providers", method)));
        String greeting = notifier.greet(u, isNew, prevActive);
        mongo.getCollection("events").insertOne(new Document("type", "login").append("user_id", u.getString("user_id")).append("method", method)
                .append("new_user", isNew).append("greeting", greeting).append("ip", ip(req)).append("ua", ua).append("created_at", now));

        Document fresh = mongo.getCollection("users").find(eq("user_id", u.getString("user_id"))).first();

        // ★ Yahan role pass kiya token() method mein
        String role = fresh.getString("role") == null ? "USER" : fresh.getString("role");
        String token = token(fresh.getString("user_id"), fresh.getString("email"), role);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("token", token);
        m.put("user", publicUser(fresh));
        m.put("greeting", greeting);
        return m;
    }
}