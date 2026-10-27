package com.codelab;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity(prePostEnabled = true)   // enables @PreAuthorize
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth

                        // ═══════════════════════════════════════════════════
                        //  ALWAYS PUBLIC — preflight + static + SPA shell
                        // ═══════════════════════════════════════════════════
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(
                                "/",
                                "/index.html",
                                "/favicon.ico",
                                "/manifest.json",
                                "/static/**",
                                "/assets/**",
                                "/og-image.png",
                                "/robots.txt",
                                "/sitemap.xml",
                                "/Loading.gif",
                                "/error",
                                "/.well-known/**"
                        ).permitAll()

                        // ═══════════════════════════════════════════════════
                        //  GUEST-ACCESSIBLE API  (login optional)
                        //
                        //  These endpoints must work WITHOUT a JWT so the
                        //  guest flow (browse + run + daily pick) is fully
                        //  functional. Submit / profile / recommendations
                        //  stay behind authentication below.
                        // ═══════════════════════════════════════════════════
                        .requestMatchers(
                                // ── Auth ──────────────────────────────────
                                "/api/auth/**",              // login / register / OAuth / OTP / providers / me

                                // ── Ops / health ─────────────────────────
                                "/api/public/**",
                                "/api/health",

                                // ── Browse problems ─────────────────────
                                "/api/problems",
                                "/api/problems/**",
                                "/api/problems2/**",
                                "/api/problems_meta/**",

                                // ── Companies ────────────────────────────
                                "/api/companies",
                                "/api/companies/**",

                                // ── Daily challenge (guest: global pick) ─
                                "/api/daily",

                                // ── Guest code execution ─────────────────
                                "/api/run",

                                // ── Analytics events (guest tracking) ────
                                "/api/track",

                                // ── Avatar image serving (public read) ───
                                "/api/avatars/**"
                        ).permitAll()

                        // ═══════════════════════════════════════════════════
                        //  ADMIN-ONLY
                        // ═══════════════════════════════════════════════════
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // ═══════════════════════════════════════════════════
                        //  LOGIN REQUIRED  (everything else)
                        //  ─ /api/submit
                        //  ─ /api/recommendations
                        //  ─ /api/profile, /api/profile/avatar
                        //  ─ /api/submissions
                        //  ─ /api/auth/admin/**   (though /api/auth/** is public,
                        //    controller-level @PreAuthorize still enforces
                        //    admin role — belt & braces)
                        // ═══════════════════════════════════════════════════
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> {
                            res.setStatus(401);
                            res.setContentType("application/json");
                            res.setCharacterEncoding("UTF-8");
                            res.getWriter().write(
                                    "{\"error\":\"Unauthorized\",\"message\":\"Please sign in to continue\"}"
                            );
                        })
                        .accessDeniedHandler((req, res, e) -> {
                            res.setStatus(403);
                            res.setContentType("application/json");
                            res.setCharacterEncoding("UTF-8");
                            res.getWriter().write(
                                    "{\"error\":\"Forbidden\",\"message\":\"You don't have permission for this action\"}"
                            );
                        })
                );

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    // ═══════════════════════════════════════════════════════════════
    //  CORS — used by the security filter chain
    //
    //  allowCredentials=true ke saath AllowedOrigins="*" allowed nahi
    //  hota, isliye AllowedOriginPatterns use karte hain — ye sab
    //  origins allow karta hai aur credentials bhi (Bearer token via
    //  Authorization header) bhej sakta hai.
    //
    //  Frontend runs on a different origin than the backend in production
    //  (codeup-y3u0.onrender.com ↔ app-16-xiwa.onrender.com), so this
    //  must NOT be restrictive.
    // ═══════════════════════════════════════════════════════════════
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOriginPatterns(List.of("*"));
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("Authorization", "Content-Type"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}