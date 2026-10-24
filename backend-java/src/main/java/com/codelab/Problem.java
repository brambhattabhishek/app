package com.codelab;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "problems")
public class Problem {

    /** LeetCode problem number, e.g. 1 for Two Sum */
    @Id
    private Integer id;

    @Indexed(unique = true)
    private String slug;

    private String title;

    private String difficulty;

    @Builder.Default
    private List<String> tags = new ArrayList<>();

    @Builder.Default
    private double acceptance = 0.0;

    @Builder.Default
    private String fn = "";

    @Builder.Default
    private List<Param> params = new ArrayList<>();

    @Builder.Default
    private String ret = "";

    @Builder.Default
    private String description = "";

    @Builder.Default
    private List<String> constraints = new ArrayList<>();

    @Builder.Default
    private List<SampleTest> sampleTests = new ArrayList<>();

    @Builder.Default
    private List<SampleTest> hiddenTests = new ArrayList<>();

    @Builder.Default
    private Editorial editorial = new Editorial("", "", "");

    // ---------- Nested types ----------

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Param {
        private String name;
        private String type;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SampleTest {
        private String input;
        private String expected;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Editorial {
        @Builder.Default private String approach   = "";
        @Builder.Default private String complexity = "";
        @Builder.Default private String code       = "";
    }
}