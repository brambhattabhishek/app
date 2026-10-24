package com.codelab;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProblemRepository extends MongoRepository<Problem, Integer> {
    boolean existsBySlug(String slug);
}
