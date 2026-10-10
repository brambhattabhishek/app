package com.codelab;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mongodb.client.model.IndexOptions;
import com.mongodb.client.model.ReplaceOptions;
import org.bson.Document;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;
import java.util.Map;

import static com.mongodb.client.model.Filters.eq;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class CodelabApplication {
    public static void main(String[] args) {
        SpringApplication.run(CodelabApplication.class, args);
    }

    @Bean
    CommandLineRunner seed(MongoTemplate mongo) {
        return args -> {
            ObjectMapper om = new ObjectMapper();
            List<Map<String, Object>> problems = new java.util.ArrayList<>(om.readValue(
                    new ClassPathResource("problems.json").getInputStream(), new TypeReference<List<Map<String, Object>>>() {}));
            problems.addAll(om.readValue(new ClassPathResource("problems2.json").getInputStream(), new TypeReference<List<Map<String, Object>>>() {}));
            Map<String, Map<String, Object>> meta = om.readValue(new ClassPathResource("problems_meta.json").getInputStream(), new TypeReference<>() {});
            var col = mongo.getCollection("problems");
            for (Map<String, Object> p : problems) {
                if (meta.containsKey(p.get("slug"))) p.putAll(meta.get(p.get("slug")));
                col.replaceOne(eq("slug", p.get("slug")), new Document(p), new ReplaceOptions().upsert(true));
            }
            var users = mongo.getCollection("users");
            for (Document ix : users.listIndexes()) if ("email_1".equals(ix.getString("name")) && ix.get("partialFilterExpression") == null) users.dropIndex("email_1");
            users.createIndex(new Document("email", 1), new IndexOptions().unique(true).partialFilterExpression(new Document("email", new Document("$type", "string"))));
            users.createIndex(new Document("phone", 1), new IndexOptions().unique(true).partialFilterExpression(new Document("phone", new Document("$type", "string"))));
            users.createIndex(new Document("github_id", 1), new IndexOptions().unique(true).partialFilterExpression(new Document("github_id", new Document("$type", "string"))));
            users.createIndex(new Document("linkedin_sub", 1), new IndexOptions().unique(true).partialFilterExpression(new Document("linkedin_sub", new Document("$type", "string"))));
            mongo.getCollection("progress").createIndex(new Document("user_id", 1).append("slug", 1), new IndexOptions().unique(true));
            mongo.getCollection("daily").createIndex(new Document("user_id", 1).append("date", 1), new IndexOptions().unique(true));
            mongo.getCollection("events").createIndex(new Document("created_at", -1));
            mongo.getCollection("oauth_states").createIndex(new Document("created_at", 1), new IndexOptions().expireAfter(600L, java.util.concurrent.TimeUnit.SECONDS));
            mongo.getCollection("otp_codes").createIndex(new Document("created_at", 1), new IndexOptions().expireAfter(900L, java.util.concurrent.TimeUnit.SECONDS));
            mongo.getCollection("users").createIndex(new Document("user_id", 1), new IndexOptions().unique(true));
            mongo.getCollection("submissions").createIndex(new Document("user_id", 1).append("slug", 1));
        };
    }
}
