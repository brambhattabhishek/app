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
                        //  ALWAYS PUBLIC (preflight + static + SPA shell)
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
                                "/error"
                        ).permitAll()

                        // ═══════════════════════════════════════════════════
                        //  GUEST-ACCESSIBLE API  (login optional)
                        //  ─ Auth flows, browse, run code, daily pick,
                        //    companies, avatar images, analytics events
                        // ═══════════════════════════════════════════════════
                        .requestMatchers(
                                "/api/auth/**",              // login/register/OAuth/OTP/providers
                                "/api/public/**",            // any future public helpers
                                "/api/health",               // health check
                                "/api/problems",             // browse problems (list)
                                "/api/problems/**",          // problem detail (read-only)
                                "/api/problems2/**",         // legacy read-only mirror
                                "/api/problems_meta/**",     // legacy read-only mirror
                                "/api/companies",            // companies list
                                "/api/companies/**",         // company detail
                                "/api/daily",                // guest → global pick; user → personalised
                                "/api/run",                  // ★ guest can RUN code (no submit)
                                "/api/track",                // analytics events from guests too
                                "/api/avatars/**"            // public avatar image serving
                        ).permitAll()

                        // ═══════════════════════════════════════════════════
                        //  ADMIN-ONLY
                        // ═══════════════════════════════════════════════════
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")

                        // ═══════════════════════════════════════════════════
                        //  LOGIN REQUIRED  (everything else)
                        //  ─ /api/submit, /api/recommendations, /api/profile,
                        //    /api/profile/avatar, /api/submissions,
                        //    /api/auth/admin/**, /api/auth/me  (also fine — auth/** is public
                        //    but controller itself uses auth.require for /me)
                        // ═══════════════════════════════════════════════════
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((req, res, e) -> {
                            res.setStatus(401);
                            res.setContentType("application/json");
                            res.setCharacterEncoding("UTF-8");
                            res.getWriter().write("{\"error\":\"Unauthorized\",\"message\":\"Please sign in to continue\"}");
                        })
                        .accessDeniedHandler((req, res, e) -> {
                            res.setStatus(403);
                            res.setContentType("application/json");
                            res.setCharacterEncoding("UTF-8");
                            res.getWriter().write("{\"error\":\"Forbidden\",\"message\":\"You don't have permission for this action\"}");
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

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // allowCredentials=true ke saath AllowedOrigins "*" allowed nahi hota,
        // isliye AllowedOriginPatterns use karte hain — ye sab origins allow karta hai
        // aur credentials bhi bhej sakta hai (Bearer token ke liye zaroori).
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