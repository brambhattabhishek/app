package com.codelab;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "problem_meta")
public class ProblemMeta {

    /** LeetCode problem number — same id as Problem.id */
    @Id
    private Integer id;

    @Builder.Default
    private List<String> companies   = new ArrayList<>();

    @Builder.Default
    private List<String> hints       = new ArrayList<>();

    @Builder.Default
    private List<String> edgeCases   = new ArrayList<>();

    @Builder.Default
    private String       explanation = "";
}