package com.codelab;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class UserPrincipal {
    private String id;
    private String email;
    private String password;
}
