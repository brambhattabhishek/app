package com.codelab;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ProblemRepository extends MongoRepository<Problem, Integer> {
    Optional<Problem> findBySlug(String slug);   // ★ FIXED: Problem, not ProblemMeta
}