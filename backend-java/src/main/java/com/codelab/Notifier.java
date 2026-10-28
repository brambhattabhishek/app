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

    static final long WELCOME_BACK_DAYS = 7;
    static final String MAILJET_URL = "https://api.mailjet.com/v3.1/send";
    static final String TEXTBEE_URL = "https://api.textbee.dev/api/v1/gateway/send-sms";

    final HttpClient http = HttpClient.newHttpClient();
    final ObjectMapper om = new ObjectMapper();

    static String env(String k) {
        String v = System.getenv(k);
        return v == null || v.isBlank() ? null : v;
    }

    /** OAuth callbacks ke liye (AuthController use karta hai). */
    static String form(Map<String, String> m) {
        StringJoiner j = new StringJoiner("&");
        m.forEach((k, v) -> j.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(v, StandardCharsets.UTF_8)));
        return j.toString();
    }

    static boolean mailjetReady() {
        return env("MJ_APIKEY_PUBLIC") != null
                && env("MJ_APIKEY_PRIVATE") != null
                && env("EMAIL_FROM_ADDRESS") != null;
    }

    static boolean textbeeReady() {
        return env("TEXTBEE_API_KEY") != null;
    }

    static String mailjetAuth() {
        String pub = env("MJ_APIKEY_PUBLIC");
        String priv = env("MJ_APIKEY_PRIVATE");
        return "Basic " + Base64.getEncoder()
                .encodeToString((pub + ":" + priv).getBytes(StandardCharsets.UTF_8));
    }

    void log(Document u, String channel, String kind, String to, String status, String error) {
        mongo.getCollection("notifications").insertOne(
                new Document("user_id", u.getString("user_id"))
                        .append("channel", channel)
                        .append("kind", kind)
                        .append("to", to)
                        .append("status", status)
                        .append("error", error)
                        .append("created_at", new Date()));
    }

    /** Welcome (new user) ya welcome-back (>= 7 din inactive). Consistently active ko kuch nahi. */
    public String greet(Document u, boolean isNew, Date prevActive) {
        long gap = prevActive == null ? Long.MAX_VALUE
                : (System.currentTimeMillis() - prevActive.getTime()) / 86_400_000L;
        String kind = isNew ? "welcome" : gap >= WELCOME_BACK_DAYS ? "welcome_back" : null;
        if (kind == null) return null;

        CompletableFuture.runAsync(() -> {
            if (u.getString("email") != null) sendEmail(u, kind);
            if (u.getString("phone") != null) sendSms(u, kind);
        });
        return kind;
    }

    // ═══════════════════════════════════════════════════════════════
    //  EMAIL — Mailjet v3.1
    // ═══════════════════════════════════════════════════════════════

    void sendEmail(Document u, String kind) {
        String brand = env("EMAIL_FROM_NAME");
        String app = env("APP_URL");
        String name = HtmlUtils.htmlEscape(Optional.ofNullable(u.getString("name")).orElse("there"));
        boolean back = kind.equals("welcome_back");
        String subject = back ? "Welcome back to " + brand + "!" : "Welcome to " + brand + "!";
        String line = back
                ? "It's been a while — your problems and streak are waiting. Pick up right where you left off."
                : "Your account is ready. Solve problems in Python, Java, C++ or JavaScript, and track your progress on your profile.";
        String html = "<table role=\"presentation\" width=\"100%\" style=\"background:#0A0A0C\"><tr><td style=\"padding:32px;font-family:Arial,sans-serif;color:#F3F4F6\">"
                + "<h2 style=\"margin:0 0 12px;color:#FFA116\">" + HtmlUtils.htmlEscape(subject) + "</h2>"
                + "<p>Hi " + name + ",</p><p>" + line + "</p>"
                + "<p><a href=\"" + app + "/\" style=\"display:inline-block;background:#FFA116;color:#0A0A0C;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">Open " + HtmlUtils.htmlEscape(brand) + "</a></p>"
                + "<p style=\"font-size:12px;color:#888\">Sent by " + HtmlUtils.htmlEscape(brand) + ". We never ask for your password or codes by email.</p></td></tr></table>";
        sendRaw(u, kind, subject, html);
    }

    public void dailyReminder(Document u, String title, String slug, int streak) {
        String brand = env("EMAIL_FROM_NAME"), app = env("APP_URL");
        String subject = "Your " + brand + " daily challenge: " + title;
        String streakLine = streak > 0
                ? "Keep your " + streak + "-day streak alive — solve it before midnight (UTC)."
                : "Solve it today to start a new streak.";
        String html = "<table role=\"presentation\" width=\"100%\" style=\"background:#0A0A0C\"><tr><td style=\"padding:32px;font-family:Arial,sans-serif;color:#F3F4F6\">"
                + "<h2 style=\"margin:0 0 12px;color:#FFA116\">Today's challenge: " + HtmlUtils.htmlEscape(title) + "</h2>"
                + "<p>Hi " + HtmlUtils.htmlEscape(Optional.ofNullable(u.getString("name")).orElse("there")) + ",</p><p>" + streakLine + "</p>"
                + "<p><a href=\"" + app + "/problems/" + slug + "\" style=\"display:inline-block;background:#FFA116;color:#0A0A0C;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold\">Solve now</a></p>"
                + "<p style=\"font-size:12px;color:#888\">You get this because you turned on daily reminders in your " + HtmlUtils.htmlEscape(brand) + " profile. Turn them off anytime from your profile.</p></td></tr></table>";
        sendRaw(u, "daily_reminder", subject, html);
    }

    void sendRaw(Document u, String kind, String subject, String html) {
        String to = u.getString("email");
        if (to == null) { log(u, "email", kind, null, "skipped", "no email on user"); return; }
        if (!mailjetReady()) { log(u, "email", kind, to, "skipped", "Mailjet not configured"); return; }
        try {
            assertSafe(html);
            Map<String, Object> message = Map.of(
                    "From", Map.of("Email", env("EMAIL_FROM_ADDRESS"), "Name", env("EMAIL_FROM_NAME")),
                    "To", List.of(Map.of("Email", to, "Name", Optional.ofNullable(u.getString("name")).orElse(""))),
                    "Subject", subject,
                    "HTMLPart", html
            );
            Map<String, Object> payload = Map.of("Messages", List.of(message));
            HttpRequest req = HttpRequest.newBuilder(URI.create(MAILJET_URL))
                    .header("Authorization", mailjetAuth())
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            boolean ok = r.statusCode() >= 200 && r.statusCode() < 300;
            log(u, "email", kind, to, ok ? "sent" : "failed",
                    ok ? null : ("HTTP " + r.statusCode() + " " + r.body()));
        } catch (Exception e) {
            log(u, "email", kind, to, "failed", e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  SMS — Textbee (docs: POST /gateway/send-sms, x-api-key, {recipients, message})
    // ═══════════════════════════════════════════════════════════════

    void sendSms(Document u, String kind) {
        String brand = env("EMAIL_FROM_NAME");
        String phone = u.getString("phone");
        if (phone == null) { log(u, "sms", kind, null, "skipped", "no phone on user"); return; }
        if (!textbeeReady()) { log(u, "sms", kind, phone, "skipped", "Textbee not configured"); return; }

        String body = kind.equals("welcome_back")
                ? "Welcome back to " + brand + "! Your next problem is waiting."
                : "Welcome to " + brand + "! Happy coding.";

        try {
            Map<String, Object> payload = Map.of(
                    "recipients", List.of(phone),
                    "message", body
            );
            HttpRequest req = HttpRequest.newBuilder(URI.create(TEXTBEE_URL))
                    .header("x-api-key", env("TEXTBEE_API_KEY"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(om.writeValueAsString(payload)))
                    .build();
            HttpResponse<String> r = http.send(req, HttpResponse.BodyHandlers.ofString());
            boolean ok = r.statusCode() >= 200 && r.statusCode() < 300;
            log(u, "sms", kind, phone, ok ? "sent" : "failed",
                    ok ? null : ("HTTP " + r.statusCode() + " " + r.body()));
        } catch (Exception e) {
            log(u, "sms", kind, phone, "failed", e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  HTML SAFETY
    // ═══════════════════════════════════════════════════════════════

    static void assertSafe(String html) {
        String low = html.toLowerCase();
        if (low.contains("<form") || low.contains("<input"))
            throw new IllegalStateException("forms not allowed in email");
        for (String part : low.split("href=\"").length > 1
                ? Arrays.copyOfRange(low.split("href=\""), 1, low.split("href=\"").length)
                : new String[0])
            if (!part.startsWith("https://"))
                throw new IllegalStateException("email links must be https");
    }
}