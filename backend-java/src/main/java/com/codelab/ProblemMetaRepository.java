package com.codelab;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

public interface ProblemMetaRepository extends MongoRepository<ProblemMeta, Integer> {
    Optional<ProblemMeta> findBySlug(String slug);
}
