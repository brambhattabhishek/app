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
public class CodelabApplication {
    public static void main(String[] args) {
        SpringApplication.run(CodelabApplication.class, args);
    }

    @Bean
    CommandLineRunner seed(MongoTemplate mongo) {
        return args -> {
            List<Map<String, Object>> problems = new ObjectMapper().readValue(
                    new ClassPathResource("problems.json").getInputStream(), new TypeReference<>() {});
            var col = mongo.getCollection("problems");
            for (Map<String, Object> p : problems) {
                col.replaceOne(eq("slug", p.get("slug")), new Document(p), new ReplaceOptions().upsert(true));
            }
            mongo.getCollection("users").createIndex(new Document("email", 1), new IndexOptions().unique(true));
            mongo.getCollection("users").createIndex(new Document("user_id", 1), new IndexOptions().unique(true));
            mongo.getCollection("submissions").createIndex(new Document("user_id", 1).append("slug", 1));
        };
    }
}
