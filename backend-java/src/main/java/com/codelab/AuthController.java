package com.codelab;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.MongoCollection;
import jakarta.servlet.http.HttpServletRequest;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;

import static com.codelab.AuthService.publicUser;
import static com.mongodb.client.model.Filters.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired MongoTemplate mongo;
    @Autowired AuthService auth;
    @Autowired Notifier notifier;
    @Autowired JwtService jwtService;
    private final BCryptPasswordEncoder enc = new BCryptPasswordEncoder();
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper om = new ObjectMapper();
    private final SecureRandom rnd = new SecureRandom();
    static final String PHONE_RE = "^\\+[1-9]\\d{7,14}$";

    record RegisterReq(String name, String email, String password) {}
    record LoginReq(String email, String password) {}
    record GoogleReq(String session_id) {}
    record OAuthReq(String code, String state) {}
    record OtpReq(String phone, String code) {}

    MongoCollection<Document> users() { return mongo.getCollection("users"); }

    static ResponseStatusException err(HttpStatus s, String msg) { return new ResponseStatusException(s, msg); }

    static String newId() { return "user_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12); }

    // ★ Every new user gets an explicit role. Default = "USER".
    static Document newUser(String name, String provider) {
        return new Document("user_id", newId())
                .append("name", name)
                .append("provider", provider)
                .append("role", "USER")
                .append("interests", new ArrayList<>())
                .append("created_at", new Date());
    }

    static String roleOf(Document u) {
        String r = u.getString("role");
        return r == null ? "USER" : r.toUpperCase();
    }

    static boolean isBootstrapAdminEmail(String email) {
        String adminEmail = Notifier.env("ADMIN_EMAIL");
        return adminEmail != null && email != null && adminEmail.trim().equalsIgnoreCase(email.trim());
    }

    @GetMapping("/providers")
    public Map<String, Object> providers() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("email", true);
        m.put("google", true);
        m.put("github", Notifier.env("GITHUB_CLIENT_ID") != null && Notifier.env("GITHUB_CLIENT_SECRET") != null);
        m.put("linkedin", Notifier.env("LINKEDIN_CLIENT_ID") != null && Notifier.env("LINKEDIN_CLIENT_SECRET") != null);
        m.put("otp", Notifier.verifyReady() ? "live" : "demo");
        return m;
    }

    @PostMapping("/register")
    public Map<String, Object> register(@RequestBody RegisterReq r, HttpServletRequest req) {
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) throw err(HttpStatus.BAD_REQUEST, "Enter a valid email");
        if (r.password() == null || r.password().length() < 6) throw err(HttpStatus.BAD_REQUEST, "Password must be at least 6 characters");
        if (users().find(eq("email", email)).first() != null) throw err(HttpStatus.CONFLICT, "Email already registered");

        String name = r.name() == null || r.name().isBlank() ? email.split("@")[0] : r.name().trim();
        Document u = newUser(name, "email").append("email", email).append("password_hash", enc.encode(r.password()));

        if (isBootstrapAdminEmail(email)) u.put("role", "ADMIN");

        users().insertOne(u);
        return loginInternal(u, true, "email", req);
    }

    // ★ CRITICAL FIX: Missing @PostMapping("/login") endpoint
    @PostMapping("/login")
    public Map<String, Object> login(@RequestBody LoginReq r, HttpServletRequest req) {
        String email = r.email() == null ? "" : r.email().trim().toLowerCase();
        String ident = AuthService.ip(req) + ":" + email;
        var attempts = mongo.getCollection("login_attempts");
        Document a = attempts.find(eq("identifier", ident)).first();
        if (a != null && a.getInteger("count", 0) >= 5 && System.currentTimeMillis() - a.getDate("last").getTime() < 15 * 60_000L)
            throw err(HttpStatus.TOO_MANY_REQUESTS, "Too many failed attempts. Try again in 15 minutes.");
        Document u = users().find(eq("email", email)).first();
        if (u == null || u.getString("password_hash") == null || r.password() == null || !enc.matches(r.password(), u.getString("password_hash"))) {
            attempts.updateOne(eq("identifier", ident), new Document("$inc", new Document("count", 1)).append("$set", new Document("last", new Date())),
                    new com.mongodb.client.model.UpdateOptions().upsert(true));
            throw err(HttpStatus.UNAUTHORIZED, u != null && u.getString("password_hash") == null
                    ? "This account uses social / phone login. Use that method instead." : "Invalid email or password");
        }
        attempts.deleteOne(eq("identifier", ident));

        // Backfill role for old users
        if (u.getString("role") == null) {
            String role = isBootstrapAdminEmail(email) ? "ADMIN" : "USER";
            users().updateOne(eq("user_id", u.getString("user_id")), new Document("$set", new Document("role", role)));
            u.put("role", role);
        }

        return loginInternal(u, false, "email", req);
    }

    // ★ Internal method (renamed from login → loginInternal)
    private Map<String, Object> loginInternal(Document u, boolean isNew, String method, HttpServletRequest req) {
        Date prevActive = u.getDate("last_active_at");
        Date now = new Date();
        String ua = Optional.ofNullable(req.getHeader("User-Agent")).orElse("");

        mongo.getCollection("users").updateOne(eq("user_id", u.getString("user_id")), new Document("$set",
                new Document("last_login_at", now).append("last_active_at", now).append("last_ip", AuthService.ip(req)).append("last_user_agent", ua))
                .append("$inc", new Document("login_count", 1)).append("$addToSet", new Document("providers", method)));

        String greeting = notifier.greet(u, isNew, prevActive);

        mongo.getCollection("events").insertOne(new Document("type", "login").append("user_id", u.getString("user_id")).append("method", method)
                .append("new_user", isNew).append("greeting", greeting).append("ip", AuthService.ip(req)).append("ua", ua).append("created_at", now));

        // ★ NPE-safe
        Document fresh = mongo.getCollection("users").find(eq("user_id", u.getString("user_id"))).first();
        if (fresh == null) {
            if (u.getString("email") != null) {
                fresh = mongo.getCollection("users").find(eq("email", u.getString("email"))).first();
            }
            if (fresh == null) fresh = u;
        }

        String role = fresh.getString("role") == null ? "USER" : fresh.getString("role");
        String token = jwtService.sign(fresh.getString("user_id"), fresh.getString("email"), role);

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("token", token);
        m.put("user", publicUser(fresh));
        m.put("greeting", greeting);
        return m;
    }

    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.require(h);
        Map<String, Object> out = publicUser(u);
        out.put("isAdmin", "ADMIN".equals(roleOf(u)));
        return out;
    }

    @PostMapping("/admin/promote")
    @PreAuthorize("hasRole('ADMIN')")
    public Map<String, Object> promote(@RequestBody Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String role  = body.getOrDefault("role", "USER").trim().toUpperCase();
        if (!role.equals("ADMIN") && !role.equals("USER"))
            throw err(HttpStatus.BAD_REQUEST, "role must be ADMIN or USER");
        Document u = users().find(eq("email", email)).first();
        if (u == null) throw err(HttpStatus.NOT_FOUND, "No user with that email");
        users().updateOne(eq("user_id", u.getString("user_id")), new Document("$set", new Document("role", role)));
        return Map.of("email", email, "role", role, "ok", true);
    }

    @GetMapping("/admin/list-admins")
    @PreAuthorize("hasRole('ADMIN')")
    public List<Map<String, Object>> listAdmins() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Document u : users().find(eq("role", "ADMIN")))
            out.add(Map.of(
                    "user_id", u.getString("user_id"),
                    "email",   u.getString("email") == null ? "" : u.getString("email"),
                    "name",    u.getString("name")  == null ? "" : u.getString("name")
            ));
        return out;
    }

    Map<String, Object> upsertSocial(String idField, String idValue, String email, String name, String picture, String provider,
                                     Document extra, HttpServletRequest req) {
        Document u = idField == null ? null : users().find(eq(idField, idValue)).first();
        if (u == null && email != null) u = users().find(eq("email", email)).first();
        boolean isNew = u == null;
        if (isNew) {
            u = newUser(name == null || name.isBlank() ? (email != null ? email.split("@")[0] : "Coder") : name, provider).append("picture", picture);
            if (email != null) u.append("email", email);
            if (idField != null) u.append(idField, idValue);
            if (email != null && isBootstrapAdminEmail(email)) u.put("role", "ADMIN");
            u.putAll(extra);
            users().insertOne(u);
        } else {
            Document set = new Document(extra);
            if (idField != null) set.append(idField, idValue);
            if (picture != null && u.getString("picture") == null) set.append("picture", picture);
            if (u.getString("role") == null) {
                set.append("role", email != null && isBootstrapAdminEmail(email) ? "ADMIN" : "USER");
            }
            if (!set.isEmpty()) users().updateOne(eq("user_id", u.getString("user_id")), new Document("$set", set));
            u.putAll(set);
        }
        return loginInternal(u, isNew, provider, req);
    }

    @PostMapping("/google")
    public Map<String, Object> google(@RequestBody GoogleReq r, HttpServletRequest req) throws Exception {
        if (r.session_id() == null || r.session_id().isBlank()) throw err(HttpStatus.BAD_REQUEST, "session_id required");
        HttpRequest hr = HttpRequest.newBuilder(URI.create("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"))
                .header("X-Session-ID", r.session_id()).GET().build();
        HttpResponse<String> res = http.send(hr, HttpResponse.BodyHandlers.ofString());
        if (res.statusCode() != 200) throw err(HttpStatus.UNAUTHORIZED, "Google session invalid or expired. Please try again.");
        JsonNode j = om.readTree(res.body());
        String email = j.path("email").asText().toLowerCase();
        return upsertSocial(null, null, email, j.path("name").asText(), j.path("picture").asText(null), "google", new Document(), req);
    }

    static final Map<String, String[]> OAUTH = Map.of(
            "github", new String[]{"GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "https://github.com/login/oauth/authorize", "read:user user:email"},
            "linkedin", new String[]{"LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "https://www.linkedin.com/oauth/v2/authorization", "openid profile email"});

    String[] cfg(String provider) {
        String[] c = OAUTH.get(provider);
        if (c == null) throw err(HttpStatus.NOT_FOUND, "Unknown provider");
        if (Notifier.env(c[0]) == null || Notifier.env(c[1]) == null)
            throw err(HttpStatus.SERVICE_UNAVAILABLE, Character.toUpperCase(provider.charAt(0)) + provider.substring(1) + " login is not configured yet");
        return c;
    }

    static String enc(String s) { return URLEncoder.encode(s, StandardCharsets.UTF_8); }

    @GetMapping("/oauth/{provider}/start")
    public Map<String, Object> oauthStart(@PathVariable String provider, @RequestParam String redirect_uri) {
        String[] c = cfg(provider);
        if (!redirect_uri.startsWith("https://") && !redirect_uri.startsWith("http://localhost") || !redirect_uri.endsWith("/auth/oauth/" + provider))
            throw err(HttpStatus.BAD_REQUEST, "Invalid redirect_uri");
        String state = UUID.randomUUID().toString().replace("-", "");
        mongo.getCollection("oauth_states").insertOne(new Document("state", state).append("provider", provider)
                .append("redirect_uri", redirect_uri).append("created_at", new Date()));
        String url = c[2] + "?response_type=code&client_id=" + enc(Notifier.env(c[0])) + "&redirect_uri=" + enc(redirect_uri)
                + "&scope=" + enc(c[3]) + "&state=" + state;
        return Map.of("url", url);
    }

    @PostMapping("/oauth/{provider}/callback")
    public Map<String, Object> oauthCallback(@PathVariable String provider, @RequestBody OAuthReq r, HttpServletRequest req) throws Exception {
        String[] c = cfg(provider);
        Bson f = and(eq("state", r.state()), eq("provider", provider));
        Document st = mongo.getCollection("oauth_states").findOneAndDelete(f);
        if (st == null || r.code() == null) throw err(HttpStatus.UNAUTHORIZED, "Login session expired. Please try again.");
        String redirect = st.getString("redirect_uri");
        Map<String, String> body = Map.of("grant_type", "authorization_code", "code", r.code(), "redirect_uri", redirect,
                "client_id", Notifier.env(c[0]), "client_secret", Notifier.env(c[1]));
        String tokenUrl = provider.equals("github") ? "https://github.com/login/oauth/access_token" : "https://www.linkedin.com/oauth/v2/accessToken";
        HttpResponse<String> tr = http.send(HttpRequest.newBuilder(URI.create(tokenUrl)).header("Accept", "application/json")
                        .header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(Notifier.form(body))).build(),
                HttpResponse.BodyHandlers.ofString());
        String access = om.readTree(tr.body()).path("access_token").asText(null);
        if (access == null) throw err(HttpStatus.UNAUTHORIZED, "Could not complete " + provider + " login");
        if (provider.equals("github")) {
            JsonNode me = getJson("https://api.github.com/user", access);
            String email = null;
            for (JsonNode e : getJson("https://api.github.com/user/emails", access))
                if (e.path("primary").asBoolean() && e.path("verified").asBoolean()) email = e.path("email").asText().toLowerCase();
            String name = me.path("name").asText(null);
            return upsertSocial("github_id", me.path("id").asText(), email, name == null ? me.path("login").asText() : name,
                    me.path("avatar_url").asText(null), "github", new Document("github_login", me.path("login").asText()), req);
        }
        JsonNode me = getJson("https://api.linkedin.com/v2/userinfo", access);
        String email = me.path("email_verified").asBoolean(false) ? me.path("email").asText().toLowerCase() : null;
        return upsertSocial("linkedin_sub", me.path("sub").asText(), email, me.path("name").asText(null), me.path("picture").asText(null),
                "linkedin", new Document(), req);
    }

    JsonNode getJson(String url, String token) throws Exception {
        HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create(url)).header("Authorization", "Bearer " + token)
                .header("User-Agent", "algoforge").header("Accept", "application/json").GET().build(), HttpResponse.BodyHandlers.ofString());
        if (r.statusCode() != 200) throw err(HttpStatus.UNAUTHORIZED, "Provider profile request failed");
        return om.readTree(r.body());
    }

    @PostMapping("/otp/send")
    public Map<String, Object> otpSend(@RequestBody OtpReq r) throws Exception {
        String phone = r.phone() == null ? "" : r.phone().replaceAll("[\\s-]", "");
        if (!phone.matches(PHONE_RE)) throw err(HttpStatus.BAD_REQUEST, "Enter phone with country code, e.g. +919876543210");
        var otps = mongo.getCollection("otp_codes");
        if (otps.countDocuments(and(eq("phone", phone), gte("created_at", new Date(System.currentTimeMillis() - 15 * 60_000L)))) >= 5)
            throw err(HttpStatus.TOO_MANY_REQUESTS, "Too many OTP requests. Try again later.");
        Map<String, Object> out = new LinkedHashMap<>();
        if (Notifier.verifyReady()) {
            HttpResponse<String> res = notifier.twilioPost("https://verify.twilio.com/v2/Services/" + Notifier.env("TWILIO_VERIFY_SERVICE_SID") + "/Verifications",
                    Map.of("To", phone, "Channel", "sms"));
            if (res.statusCode() >= 300) throw err(HttpStatus.BAD_GATEWAY, "Could not send OTP. Check the number and try again.");
            otps.insertOne(new Document("phone", phone).append("mode", "twilio").append("created_at", new Date()));
            out.put("demo", false);
        } else {
            String code = String.format("%06d", rnd.nextInt(1_000_000));
            otps.insertOne(new Document("phone", phone).append("mode", "demo").append("hash", enc.encode(code)).append("attempts", 0)
                    .append("used", false).append("created_at", new Date()));
            out.put("demo", true);
            out.put("demo_code", code);
        }
        out.put("sent", true);
        return out;
    }

    @PostMapping("/otp/verify")
    public Map<String, Object> otpVerify(@RequestBody OtpReq r, HttpServletRequest req) throws Exception {
        String phone = r.phone() == null ? "" : r.phone().replaceAll("[\\s-]", "");
        if (!phone.matches(PHONE_RE) || r.code() == null || !r.code().matches("\\d{4,8}")) throw err(HttpStatus.BAD_REQUEST, "Invalid phone or code");
        if (Notifier.verifyReady()) {
            HttpResponse<String> res = notifier.twilioPost("https://verify.twilio.com/v2/Services/" + Notifier.env("TWILIO_VERIFY_SERVICE_SID") + "/VerificationCheck",
                    Map.of("To", phone, "Code", r.code()));
            if (res.statusCode() >= 300 || !"approved".equals(om.readTree(res.body()).path("status").asText()))
                throw err(HttpStatus.UNAUTHORIZED, "Incorrect or expired OTP");
        } else {
            var otps = mongo.getCollection("otp_codes");
            Document o = otps.find(and(eq("phone", phone), eq("mode", "demo"), eq("used", false),
                    gte("created_at", new Date(System.currentTimeMillis() - 10 * 60_000L)))).sort(new Document("created_at", -1)).first();
            if (o == null || o.getInteger("attempts", 0) >= 5) throw err(HttpStatus.UNAUTHORIZED, "OTP expired. Request a new one.");
            if (!enc.matches(r.code(), o.getString("hash"))) {
                otps.updateOne(eq("_id", o.getObjectId("_id")), new Document("$inc", new Document("attempts", 1)));
                throw err(HttpStatus.UNAUTHORIZED, "Incorrect OTP");
            }
            otps.updateOne(eq("_id", o.getObjectId("_id")), new Document("$set", new Document("used", true)));
        }
        Document u = users().find(eq("phone", phone)).first();
        boolean isNew = u == null;
        if (isNew) {
            u = newUser("Coder " + phone.substring(phone.length() - 4), "phone").append("phone", phone);
            users().insertOne(u);
        }
        return loginInternal(u, isNew, "phone", req);
    }
}