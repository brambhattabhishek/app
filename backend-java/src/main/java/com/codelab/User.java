package com.codelab;

import lombok.*;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "users")
public class User {
    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;

    private String name;
    private String role = "USER";        // "USER" | "ADMIN"

    private Instant createdAt = Instant.now();
    private Instant lastLoginAt;
    private long    loginCount = 0;
    private String  lastIp;
}
