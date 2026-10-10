package com.codelab;

import org.bson.Document;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

import static com.mongodb.client.model.Filters.*;

@RestController
@RequestMapping("/api")
public class DailyController {
    @Autowired MongoTemplate mongo;
    @Autowired AuthService auth;
    @Autowired Notifier notifier;
    static final int[] MILESTONES = {3, 7, 15, 30, 50, 100};
    static final int COINS_PER_DAY = 10;

    static String today() { return LocalDate.now(ZoneOffset.UTC).toString(); }

    List<Document> problems() { return mongo.getCollection("problems").find().sort(new Document("id", 1)).into(new ArrayList<>()); }

    /** Today's problem for this user: unsolved, from their most-solved categories / interests; stable for the whole day. */
    Document assignment(Document u) {
        String uid = u.getString("user_id"), day = today();
        var daily = mongo.getCollection("daily");
        Document d = daily.find(and(eq("user_id", uid), eq("date", day))).first();
        if (d != null) return d;
        List<Document> all = problems();
        Map<String, List<String>> tagsOf = new HashMap<>();
        all.forEach(p -> tagsOf.put(p.getString("slug"), p.getList("tags", String.class)));
        Set<String> solved = new HashSet<>();
        Map<String, Integer> score = new HashMap<>();
        for (Document s : mongo.getCollection("submissions").find(and(eq("user_id", uid), eq("status", "Accepted")))) solved.add(s.getString("slug"));
        solved.forEach(sl -> tagsOf.getOrDefault(sl, List.of()).forEach(t -> score.merge(t, 1, Integer::sum)));
        Optional.ofNullable(u.getList("interests", String.class)).orElse(List.of()).forEach(t -> score.merge(t, 3, Integer::sum));
        List<String> top = score.entrySet().stream().sorted((a, b) -> b.getValue() - a.getValue()).limit(3).map(Map.Entry::getKey).toList();
        List<Document> unsolved = all.stream().filter(p -> !solved.contains(p.getString("slug"))).toList();
        List<Document> fav = unsolved.stream().filter(p -> p.getList("tags", String.class).stream().anyMatch(top::contains)).toList();
        List<Document> pool = !fav.isEmpty() ? fav : !unsolved.isEmpty() ? unsolved : all;
        Document pick = pool.get(Math.floorMod((uid + day).hashCode(), pool.size()));
        String reason = !fav.isEmpty() ? "From your favourite: " + pick.getList("tags", String.class).stream().filter(top::contains).findFirst().orElse("")
                : !unsolved.isEmpty() ? "Something new to try" : "Revisit a classic";
        d = new Document("user_id", uid).append("date", day).append("slug", pick.getString("slug")).append("reason", reason)
                .append("completed", false).append("created_at", new Date());
        daily.insertOne(d);
        return d;
    }

    @GetMapping("/daily")
    public Map<String, Object> daily(@RequestHeader(value = "Authorization", required = false) String h) {
        Document u = auth.optional(h);
        Map<String, Object> out = new LinkedHashMap<>();
        Document p;
        if (u == null) {
            List<Document> all = problems();
            p = all.get(Math.floorMod(today().hashCode(), all.size()));
            out.put("reason", "Today's pick for everyone");
            out.put("completed", false);
        } else {
            Document d = assignment(u);
            p = mongo.getCollection("problems").find(eq("slug", d.getString("slug"))).first();
            out.put("reason", d.getString("reason"));
            out.put("completed", d.getBoolean("completed", false));
            String last = u.getString("daily_last_date");
            boolean alive = last != null && (last.equals(today()) || last.equals(LocalDate.now(ZoneOffset.UTC).minusDays(1).toString()));
            out.put("streak", alive ? u.getInteger("daily_streak", 0) : 0);
            out.put("best", u.getInteger("daily_best", 0));
            out.put("coins", u.getInteger("coins", 0));
            out.put("badges", Optional.ofNullable(u.getList("badges", String.class)).orElse(List.of()));
            out.put("reminder", u.getBoolean("daily_reminder", false));
        }
        out.put("date", today());
        out.put("problem", ApiController.summary(p));
        return out;
    }

    /** Called after an Accepted submission; returns the reward if it completed today's challenge. */
    public Map<String, Object> onAccepted(Document u, String slug) {
        String uid = u.getString("user_id"), day = today();
        Document d = mongo.getCollection("daily").find(and(eq("user_id", uid), eq("date", day))).first();
        if (d == null || d.getBoolean("completed", false) || !slug.equals(d.getString("slug"))) return null;
        mongo.getCollection("daily").updateOne(eq("_id", d.getObjectId("_id")), new Document("$set", new Document("completed", true).append("completed_at", new Date())));
        String yesterday = LocalDate.now(ZoneOffset.UTC).minusDays(1).toString();
        int streak = yesterday.equals(u.getString("daily_last_date")) ? u.getInteger("daily_streak", 0) + 1 : 1;
        int coins = COINS_PER_DAY;
        String badge = null;
        for (int m : MILESTONES) if (streak == m) { badge = m + "-day streak"; coins += m * 5; }
        Document set = new Document("daily_streak", streak).append("daily_last_date", day).append("daily_best", Math.max(streak, u.getInteger("daily_best", 0)));
        Document upd = new Document("$set", set).append("$inc", new Document("coins", coins));
        if (badge != null) upd.append("$addToSet", new Document("badges", badge));
        mongo.getCollection("users").updateOne(eq("user_id", uid), upd);
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("streak", streak);
        r.put("coins_earned", coins);
        r.put("badge", badge);
        return r;
    }

    /** Daily reminder for users who opted in and haven't completed today's challenge (~7:30 PM IST). */
    @Scheduled(cron = "0 0 14 * * *", zone = "UTC")
    public int sendReminders() {
        String day = today();
        int sent = 0;
        for (Document u : mongo.getCollection("users").find(and(eq("daily_reminder", true), type("email", "string"), ne("daily_reminded_date", day))).limit(1000)) {
            Document d = assignment(u);
            if (d.getBoolean("completed", false)) continue;
            Document p = mongo.getCollection("problems").find(eq("slug", d.getString("slug"))).first();
            mongo.getCollection("users").updateOne(eq("user_id", u.getString("user_id")), new Document("$set", new Document("daily_reminded_date", day)));
            notifier.dailyReminder(u, p.getString("title"), p.getString("slug"), u.getInteger("daily_streak", 0));
            sent++;
        }
        return sent;
    }

    @PostMapping("/admin/daily-reminders/run")
    public Map<String, Object> runReminders(@RequestHeader(value = "Authorization", required = false) String h) {
        if (!AuthService.isAdmin(auth.require(h))) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admins only");
        return Map.of("sent", sendReminders());
    }

    // ---------- Company practice lists ----------
    Map<String, String> statusMap(Document u) {
        Map<String, String> st = new HashMap<>();
        if (u == null) return st;
        for (Document s : mongo.getCollection("submissions").find(eq("user_id", u.getString("user_id")))) {
            String sl = s.getString("slug");
            if ("Accepted".equals(s.getString("status"))) st.put(sl, "solved");
            else st.putIfAbsent(sl, "attempted");
        }
        return st;
    }

    @GetMapping("/companies")
    public List<Map<String, Object>> companies(@RequestHeader(value = "Authorization", required = false) String h) {
        Map<String, String> st = statusMap(auth.optional(h));
        Map<String, int[]> agg = new TreeMap<>();
        for (Document p : problems())
            for (String c : Optional.ofNullable(p.getList("companies", String.class)).orElse(List.of())) {
                int[] a = agg.computeIfAbsent(c, k -> new int[2]);
                a[0]++;
                if ("solved".equals(st.get(p.getString("slug")))) a[1]++;
            }
        List<Map<String, Object>> out = new ArrayList<>();
        agg.forEach((c, a) -> out.add(new LinkedHashMap<>(Map.of("name", c, "count", a[0], "solved", a[1]))));
        out.sort((x, y) -> (int) y.get("count") - (int) x.get("count"));
        return out;
    }

    @GetMapping("/companies/{name}")
    public Map<String, Object> company(@PathVariable String name, @RequestHeader(value = "Authorization", required = false) String h) {
        Map<String, String> st = statusMap(auth.optional(h));
        List<Map<String, Object>> list = new ArrayList<>();
        Map<String, int[]> byDiff = new LinkedHashMap<>(Map.of("Easy", new int[2], "Medium", new int[2], "Hard", new int[2]));
        for (Document p : problems()) {
            if (!Optional.ofNullable(p.getList("companies", String.class)).orElse(List.of()).contains(name)) continue;
            Map<String, Object> m = ApiController.summary(p);
            String s = st.getOrDefault(p.getString("slug"), "todo");
            m.put("status", s);
            list.add(m);
            int[] a = byDiff.get(p.getString("difficulty"));
            a[0]++;
            if (s.equals("solved")) a[1]++;
        }
        if (list.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Company not found");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("name", name);
        out.put("problems", list);
        out.put("total", list.size());
        out.put("solved", list.stream().filter(m -> "solved".equals(m.get("status"))).count());
        Map<String, Object> d = new LinkedHashMap<>();
        byDiff.forEach((k, a) -> d.put(k, Map.of("total", a[0], "solved", a[1])));
        out.put("byDifficulty", d);
        return out;
    }
}
