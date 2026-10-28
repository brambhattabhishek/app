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
    // SMS Gateway for Android (Cloud Mode) base URL
    static final String SMS_GATEWAY_URL = "https://api.sms-gate.app/3rdparty/v1";

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

    /** SMS Gateway credentials check. */
    static boolean smsGatewayReady() {
        return env("SMS_GATEWAY_USERNAME") != null && env("SMS_GATEWAY_PASSWORD") != null;
    }

    static String mailjetAuth() {
        String pub = env("MJ_APIKEY_PUBLIC");
        String priv = env("MJ_APIKEY_PRIVATE");
        return "Basic " + Base64.getEncoder()
                .encodeToString((pub + ":" + priv).getBytes(StandardCharsets.UTF_8));
    }

    /** SMS Gateway Basic Auth (username:password). */
    static String smsGatewayAuth() {
        String user = env("SMS_GATEWAY_USERNAME");
        String pass = env("SMS_GATEWAY_PASSWORD");
        return "Basic " + Base64.getEncoder()
                .encodeToString((user + ":" + pass).getBytes(StandardCharsets.UTF_8));
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

    /**
     * Har login/register par email aur SMS jayega.
     * - Naya user → "welcome"
     * - 7+ din inactive → "welcome_back"
     * - Normal active user → "login_alert"
     */
    public String greet(Document u, boolean isNew, Date prevActive) {
        long gap = prevActive == null ? Long.MAX_VALUE
                : (System.currentTimeMillis() - prevActive.getTime()) / 86_400_000L;

        String kind;
        if (isNew) {
            kind = "welcome";
        } else if (gap >= WELCOME_BACK_DAYS) {
            kind = "welcome_back";
        } else {
            kind = "login_alert";
        }

        CompletableFuture.runAsync(() -> {
            if (u.getString("email") != null) sendEmail(u, kind);
            if (u.getString("phone") != null) sendSms(u, kind);
        });
        return kind;
    }

    // ═══════════════════════════════════════════════════════════════
    //  EMAIL — Mailjet v3.1 (English content, professional template)
    // ═══════════════════════════════════════════════════════════════

    void sendEmail(Document u, String kind) {
        String brand = env("EMAIL_FROM_NAME");
        String app = env("APP_URL");
        String name = HtmlUtils.htmlEscape(Optional.ofNullable(u.getString("name")).orElse("there"));

        boolean back = kind.equals("welcome_back");
        boolean alert = kind.equals("login_alert");

        String subject;
        String heading;
        String line;
        String cta;
        String preheader;

        if (alert) {
            subject = "New sign-in to your " + brand + " account";
            heading = "New sign-in detected";
            preheader = "A new sign-in was detected on your " + brand + " account.";
            line = "We noticed a new sign-in to your " + brand + " account. If this was you, no action is needed. "
                    + "If you don't recognize this activity, please reset your password immediately.";
            cta = "Review account";
        } else if (back) {
            subject = "Welcome back to " + brand;
            heading = "Welcome back!";
            preheader = "Your problems and streak are waiting for you.";
            line = "It's been a while. Your problems and streak are waiting — pick up right where you left off.";
            cta = "Continue solving";
        } else {
            subject = "Welcome to " + brand;
            heading = "Welcome aboard!";
            preheader = "Your " + brand + " account is ready.";
            line = "Your account is ready. Solve problems in Python, Java, C++ or JavaScript, and track your progress on your profile.";
            cta = "Start solving";
        }

        String safeBrand = HtmlUtils.htmlEscape(brand);
        String safePreheader = HtmlUtils.htmlEscape(preheader);

        String html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>"
                + "<body style=\"margin:0;padding:0;background:#0A0A0C;\">"

                // Hidden preheader (inbox preview mein dikhta hai)
                + "<div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">" + safePreheader + "</div>"

                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#0A0A0C;padding:40px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background:#111114;border-radius:12px;overflow:hidden;\">"

                // Header / brand
                + "<tr><td style=\"padding:32px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;\">"
                + "<span style=\"font-size:20px;font-weight:bold;color:#FFA116;letter-spacing:0.5px;\">" + safeBrand + "</span>"
                + "</td></tr>"

                // Heading + body
                + "<tr><td style=\"padding:24px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;\">"
                + "<h1 style=\"margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:bold;color:#F3F4F6;\">"
                + HtmlUtils.htmlEscape(heading) + "</h1>"
                + "<p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#C9CBD1;\">Hi " + name + ",</p>"
                + "<p style=\"margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#C9CBD1;\">"
                + HtmlUtils.htmlEscape(line) + "</p>"
                + "</td></tr>"

                // CTA
                + "<tr><td style=\"padding:0 32px 28px 32px;\">"
                + "<a href=\"" + app + "/\" style=\"display:inline-block;background:#FFA116;color:#0A0A0C;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;\">"
                + HtmlUtils.htmlEscape(cta) + "</a>"
                + "</td></tr>"

                // Divider
                + "<tr><td style=\"padding:0 32px;\"><div style=\"border-top:1px solid #1F2024;\"></div></td></tr>"

                // Footer
                + "<tr><td style=\"padding:20px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;\">"
                + "<p style=\"margin:0 0 8px 0;font-size:12px;line-height:1.5;color:#6B6D75;\">"
                + "This email was sent by " + safeBrand + " because a sign-in was detected on your account.</p>"
                + "<p style=\"margin:0;font-size:12px;line-height:1.5;color:#6B6D75;\">"
                + "We never ask for your password or verification codes by email. If you didn't request this, you can safely ignore it.</p>"
                + "</td></tr>"

                + "</table></td></tr></table></body></html>";

        sendRaw(u, kind, subject, html);
    }

    public void dailyReminder(Document u, String title, String slug, int streak) {
        String brand = env("EMAIL_FROM_NAME"), app = env("APP_URL");
        String name = HtmlUtils.htmlEscape(Optional.ofNullable(u.getString("name")).orElse("there"));
        String safeTitle = HtmlUtils.htmlEscape(title);
        String subject = "Your " + brand + " daily challenge: " + title;
        String streakLine = streak > 0
                ? "Keep your " + streak + "-day streak alive — solve it before midnight (UTC)."
                : "Solve it today to start a new streak.";

        String html = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\">"
                + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"></head>"
                + "<body style=\"margin:0;padding:0;background:#0A0A0C;\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"background:#0A0A0C;padding:40px 16px;\">"
                + "<tr><td align=\"center\">"
                + "<table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:560px;background:#111114;border-radius:12px;overflow:hidden;\">"
                + "<tr><td style=\"padding:32px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;\">"
                + "<span style=\"font-size:20px;font-weight:bold;color:#FFA116;letter-spacing:0.5px;\">"
                + HtmlUtils.htmlEscape(brand) + "</span>"
                + "</td></tr>"
                + "<tr><td style=\"padding:24px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;\">"
                + "<h1 style=\"margin:0 0 12px 0;font-size:22px;line-height:1.3;font-weight:bold;color:#F3F4F6;\">"
                + "Today's challenge: " + safeTitle + "</h1>"
                + "<p style=\"margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#C9CBD1;\">Hi " + name + ",</p>"
                + "<p style=\"margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#C9CBD1;\">"
                + HtmlUtils.htmlEscape(streakLine) + "</p>"
                + "</td></tr>"
                + "<tr><td style=\"padding:0 32px 28px 32px;\">"
                + "<a href=\"" + app + "/problems/" + slug + "\" style=\"display:inline-block;background:#FFA116;color:#0A0A0C;padding:12px 24px;border-radius:8px;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;\">Solve now</a>"
                + "</td></tr>"
                + "<tr><td style=\"padding:0 32px;\"><div style=\"border-top:1px solid #1F2024;\"></div></td></tr>"
                + "<tr><td style=\"padding:20px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;\">"
                + "<p style=\"margin:0;font-size:12px;line-height:1.5;color:#6B6D75;\">"
                + "You get this because you turned on daily reminders in your " + HtmlUtils.htmlEscape(brand) + " profile. "
                + "Turn them off anytime from your profile.</p>"
                + "</td></tr>"
                + "</table></td></tr></table></body></html>";
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
    //  SMS — SMS Gateway for Android (Cloud Mode)
    //  Docs: POST /message, Basic Auth, {message, phoneNumbers}
    // ═══════════════════════════════════════════════════════════════

    void sendSms(Document u, String kind) {
        String brand = env("EMAIL_FROM_NAME");
        String phone = u.getString("phone");
        if (phone == null) { log(u, "sms", kind, null, "skipped", "no phone on user"); return; }
        if (!smsGatewayReady()) { log(u, "sms", kind, phone, "skipped", "SMS Gateway not configured"); return; }

        String body;
        if (kind.equals("login_alert")) {
            body = brand + ": New sign-in to your account. If this wasn't you, reset your password now.";
        } else if (kind.equals("welcome_back")) {
            body = "Welcome back to " + brand + "! Your next challenge is waiting.";
        } else {
            body = "Welcome to " + brand + "! Happy coding.";
        }

        try {
            Map<String, Object> payload = Map.of(
                    "message", body,
                    "phoneNumbers", List.of(phone)
            );
            HttpRequest req = HttpRequest.newBuilder(URI.create(SMS_GATEWAY_URL + "/message"))
                    .header("Authorization", smsGatewayAuth())
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