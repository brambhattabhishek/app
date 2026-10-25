package com.codelab;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class MongoSeedRunner implements ApplicationRunner {
    private final ProblemRepository problemRepo;
    private final LeetCodeAdminService leetCodeService;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        long count = problemRepo.count();
        log.info("MongoDB problems count on startup: {}", count);

        if (count == 0) {
            log.info("MongoDB is EMPTY. Seeding from JSON files...");
            try {
                int migrated = leetCodeService.migrateJsonToMongo();
                log.info("✅ Seeded {} problems into MongoDB from JSON", migrated);
            } catch (Exception e) {
                log.error("❌ Failed to seed MongoDB from JSON: {}", e.getMessage(), e);
            }
        } else {
            log.info("MongoDB already has {} problems, skipping seed", count);
        }
    }
}