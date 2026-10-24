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

    // ✅ Directly Render ke environment variable se lega, aur agar na mile toh fallback
    // Note: Secret key kam se kam 32 characters ki honi chahiye
    @Value("${JWT_SECRET:default-secret-key-must-be-at-least-32-chars-long}")
    private String secret;

    @Value("${JWT_EXPIRY_MS:604800000}") // 7 days default
    private long expiryMs;

    private SecretKey key() {
        // Agar key 32 characters se chhoti hai, toh error aayega. Isliye ensure karein ki Render par lambi key ho.
        byte[] keyBytes = secret.getBytes(StandardCharsets.UTF_8);
        if (keyBytes.length < 32) {
            throw new IllegalArgumentException("JWT_SECRET must be at least 32 characters long for HS256");
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