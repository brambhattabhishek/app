package com.codelab;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

@Service
public class JwtService {

    // ✅ 64-char secret = HS512 (best security)
    @Value("${JWT_SECRET:a623da0cb27a86d780a8d0a3dc64e1462b993dd5a20090472af2c883a39beaeb}")
    private String secret;

    @Value("${JWT_EXPIRY_MS:604800000}") // 7 days
    private long expiryMs;

    private SecretKey key() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException(
                    "❌ JWT_SECRET is missing! Set env var JWT_SECRET (min 32 chars, 64 recommended for HS512)."
            );
        }

        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);

        if (keyBytes.length < 32) {
            throw new IllegalStateException(
                    "❌ JWT_SECRET too short! Current: " + keyBytes.length + " chars. " +
                            "Minimum 32 chars required (64+ for HS512)."
            );
        }

        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String sign(String userId, String email, String role) {
        Date now = new Date();
        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .claim("role", role == null ? "USER" : role)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expiryMs))
                .signWith(key())
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key()).build()
                .parseSignedClaims(token).getPayload();
    }
}