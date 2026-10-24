package com.codelab;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProblemMetaRepository extends MongoRepository<ProblemMeta, Integer> {
}
