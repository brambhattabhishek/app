package com.codelab;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserPrincipal {
    private String userId;
    private String email;
    private String role;      // "ADMIN" | "USER"
}
