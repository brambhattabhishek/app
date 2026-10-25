package com.codelab;

import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.data.mongodb.core.MongoTemplate;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class CodelabApplication {
    public static void main(String[] args) {
        SpringApplication.run(CodelabApplication.class, args);
    }

    @Bean
    CommandLineRunner seed(MongoTemplate mongo) {
        return args -> {
            // ─────────────────────────────────────────────
            // STEP 1: Index creation (safe — ignore errors)
            // ─────────────────────────────────────────────
            try {
                var users = mongo.getCollection("users");

                // Drop old email_1 index if exists
                try {
                    for (Document ix : users.listIndexes()) {
                        if ("email_1".equals(ix.getString("name"))
                                && ix.get("partialFilterExpression") == null) {
                            users.dropIndex("email_1");
                            System.out.println("   Dropped old email_1 index");
                        }
                    }
                } catch (Exception ignored) {}

                createIndexSafe(users, new Document("email", 1),
                        new IndexOptions().unique(true)
                                .partialFilterExpression(new Document("email", new Document("$type", "string"))));

                createIndexSafe(users, new Document("phone", 1),
                        new IndexOptions().unique(true)
                                .partialFilterExpression(new Document("phone", new Document("$type", "string"))));

                createIndexSafe(users, new Document("github_id", 1),
                        new IndexOptions().unique(true)
                                .partialFilterExpression(new Document("github_id", new Document("$type", "string"))));

                createIndexSafe(users, new Document("linkedin_sub", 1),
                        new IndexOptions().unique(true)
                                .partialFilterExpression(new Document("linkedin_sub", new Document("$type", "string"))));

                createIndexSafe(users, new Document("user_id", 1),
                        new IndexOptions().unique(true));

                createIndexSafe(mongo.getCollection("progress"),
                        new Document("user_id", 1).append("slug", 1),
                        new IndexOptions().unique(true));

                createIndexSafe(mongo.getCollection("daily"),
                        new Document("user_id", 1).append("date", 1),
                        new IndexOptions().unique(true));

                createIndexSafe(mongo.getCollection("events"),
                        new Document("created_at", -1),
                        new IndexOptions());

                createIndexSafe(mongo.getCollection("oauth_states"),
                        new Document("created_at", 1),
                        new IndexOptions().expireAfter(600L, java.util.concurrent.TimeUnit.SECONDS));

                createIndexSafe(mongo.getCollection("otp_codes"),
                        new Document("created_at", 1),
                        new IndexOptions().expireAfter(900L, java.util.concurrent.TimeUnit.SECONDS));

                createIndexSafe(mongo.getCollection("submissions"),
                        new Document("user_id", 1).append("slug", 1),
                        new IndexOptions());

                System.out.println("✅ All indexes verified/created");
            } catch (Exception e) {
                System.err.println("⚠️ Index creation warning: " + e.getMessage());
                // Do NOT throw
            }
        };
    }

    private static void createIndexSafe(
            com.mongodb.client.MongoCollection<Document> col,
            Document keys,
            IndexOptions opts) {
        try {
            col.createIndex(keys, opts);
        } catch (Exception e) {
            if (!e.getMessage().contains("already exists")) {
                System.err.println("Index warning: " + e.getMessage());
            }
        }
    }
}