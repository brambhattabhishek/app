package com.codelab;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.CompletableFuture;

@Service
public class Notifier {
    @Autowired MongoTemplate mongo;
    static final String EMAIL_BASE_URL = "https://integrations.emergentagent.com";
    static final long WELCOME_BACK_DAYS = 7;
    final HttpClient http = HttpClient.newHttpClient();
    final ObjectMapper om = new ObjectMapper();

    static String env(String k) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? null : v;
    }

    static boolean twilioReady() { return env("TWILIO_ACCOUNT_SID") != null && env("TWILIO_AUTH_TOKEN") != null; }
    static boolean verifyReady() { return twilioReady() && env("TWILIO_VERIFY_SERVICE_SID") != null; }
    static boolean smsReady() { return twilioReady() && env("TWILIO_PHONE_NUMBER") != null; }

    static String form(Map<String, String> m) {
        StringJoiner j = new StringJoiner("&");
        m.forEach((k, v) -> j.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(v, StandardCharsets.UTF_8)));
        return j.toString();
    }

    String twilioAuth() {
        return "Basic " + Base64.getEncoder().encodeToString((env("TWILIO_ACCOUNT_SID") + ":" + env("TWILIO_AUTH_TOKEN")).getBytes(StandardCharsets.UTF_8));
    }

    public HttpResponse<String> twilioPost(String url, Map<String, String> body) throws Exception {
        HttpRequest req = HttpRequest.newBuilder(URI.create(url)).header("Authorization", twilioAuth())
                .header("Content-Type", "application/x-www-form-urlencoded").POST(HttpRequest.BodyPublishers.ofString(form(body))).build();
        return http.send(req, HttpResponse.BodyHandlers.ofString());
    }

    void log(Document u, String channel, String kind, String to, String status, String error) {
        mongo.getCollection("notifications").insertOne(new Document("user_id", u.getString("user_id")).append("channel", channel)
                .append("kind", kind).append("to", to).append("status", status).append("error", error).append("created_at", new Date()));
    }

    /** Sends welcome (new user) or welcome-back (inactive >= 7 days); consistently active users get nothing. */
    public String greet(Document u, boolean isNew, Date prevActive) {
        long gap = prevActive == null ? Long.MAX_VALUE : (System.currentTimeMillis() - prevActive.getTime()) / 86_400_000L;
        String kind = isNew ? "welcome" : gap >= WELCOME_BACK_DAYS ? "welcome_back" : null;
        if (kind == null) return null;
        CompletableFuture.runAsync(() -> {
            if (u.getString("email") != null) sendEmail(u, kind);
            if (u.getString("phone") != null) sendSms(u, kind);
        });
        return kind;
    }

    void sendEmail(Document u, String kind) {
        String brand = env("EMAIL_FROM_NAME");
        String app = env("APP_URL");
        String name = HtmlUtils.htmlEscape(Optional.ofNullable(u.getString("name")).orElse("there"));
        boolean back = kind.equals("welcome_back");
        String subject = back ? "Welcome back to " + brand + "!" : "Welcome to " + brand + "!";
        String line = back ? "It's been a while — your problems and streak are waiting. Pick up right where you left off."
                : "Your account is ready. Solve problems in Python, Java, C++ or JavaScript, and track your progress on your profile.";
        String html = "<table role=\"presentation\" width=\"100%\" style=\"background:#0A0A0C\"><tr><td style=\"padding:32px;font-family:Arial,sans-serif;color:#F3F4F6\">"
                + "<h2 style=\"margin:0 0 12px;color:#FFA116\">" + HtmlUtils.htmlEscape(subject) + "</h2>"
                + "<p>Hi " + name + ",</p><p>" + line + "</p>"
                + "<p><a href=\"" + app + "/\" style=\"display:inline-block;background:#FFA116;color:#0A0A0C;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">Open " + HtmlUtils.htmlEscape(brand) + "</a></p>"
                + "<p style=\"font-size:12px;color:#888\">Sent by " + HtmlUtils.htmlEscape(brand) + ". We never ask for your password or codes by email.</p></td></tr></table>";
        try {
            assertSafe(html);
            Map<String, Object> payload = Map.of("to", List.of(u.getString("email")), "subject", subject, "html", html, "from_name", brand);
            HttpRequest req = HttpRequest.newBuilder(URI.create(EMAIL_BASE_URL + "/api/v1/email/send"))
                    .header("X-Email-Key", env("EMERGENT_EMAIL_KEY")).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(payload))).build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            log(u, "email", kind, u.getString("email"), r.statusCode() < 300 ? "sent" : "failed", r.statusCode() < 300 ? null : r.body());
        } catch (Exception e) {
            log(u, "email", kind, u.getString("email"), "failed", e.getMessage());
        }
    }

    static void assertSafe(String html) {
        String low = html.toLowerCase();
        if (low.contains("<form") || low.contains("<input")) throw new IllegalStateException("forms not allowed in email");
        for (String part : low.split("href=\"").length > 1 ? Arrays.copyOfRange(low.split("href=\""), 1, low.split("href=\"").length) : new String[0])
            if (!part.startsWith("https://")) throw new IllegalStateException("email links must be https");
    }

    void sendSms(Document u, String kind) {
        String brand = env("EMAIL_FROM_NAME");
        String body = kind.equals("welcome_back") ? "Welcome back to " + brand + "! Your next problem is waiting." : "Welcome to " + brand + "! Happy coding.";
        if (!smsReady()) { log(u, "sms", kind, u.getString("phone"), "mocked", "Twilio not configured"); return; }
        try {
            HttpResponse<String> r = twilioPost("https://api.twilio.com/2010-04-01/Accounts/" + env("TWILIO_ACCOUNT_SID") + "/Messages.json",
                    Map.of("To", u.getString("phone"), "From", env("TWILIO_PHONE_NUMBER"), "Body", body));
            log(u, "sms", kind, u.getString("phone"), r.statusCode() < 300 ? "sent" : "failed", r.statusCode() < 300 ? null : r.body());
        } catch (Exception e) {
            log(u, "sms", kind, u.getString("phone"), "failed", e.getMessage());
        }
    }
}
