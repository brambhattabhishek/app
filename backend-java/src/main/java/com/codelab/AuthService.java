package com.codelab;

import io.jsonwebtoken.Jwts;
import jakarta.servlet.http.HttpServletRequest;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

import static com.mongodb.client.model.Filters.eq;

@Service
public class AuthService {
    @Autowired MongoTemplate mongo;
    @Autowired Notifier notifier;
    @Autowired JwtService jwtService;

    static final long ACTIVE_TOUCH_MS = 5 * 60_000L;

    public Document optional(String header) {
        if (header == null || !header.startsWith("Bearer ")) return null;
        try {
            var claims = jwtService.parse(header.substring(7));
            String uid = claims.getSubject();

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

    public static boolean isAdmin(Document u) {
        if (u == null) return false;
        String role = u.getString("role");
        if ("ADMIN".equalsIgnoreCase(role)) return true;

        String admins = Optional.ofNullable(System.getenv("ADMIN_EMAILS")).orElse("");
        return u.getString("email") != null && Arrays.asList(admins.toLowerCase().split(",")).contains(u.getString("email").toLowerCase());
    }

    public static Map<String, Object> publicUser(Document u) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (String k : List.of("user_id", "name", "email", "phone", "picture", "provider", "providers", "bio", "about", "socials", "location", "interests", "daily_reminder", "daily_streak", "daily_best", "coins", "badges",
                "github_login", "created_at", "last_login_at", "login_count"))
            m.put(k, u.get(k));

        boolean admin = isAdmin(u);
        m.put("role", u.getString("role") == null ? "USER" : u.getString("role"));
        m.put("is_admin", admin);
        m.put("isAdmin", admin);
        return m;
    }

    public static String ip(HttpServletRequest req) {
        String f = req.getHeader("X-Forwarded-For");
        return f != null && !f.isBlank() ? f.split(",")[0].trim() : req.getRemoteAddr();
    }
}