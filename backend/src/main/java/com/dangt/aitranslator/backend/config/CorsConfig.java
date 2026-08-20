//package com.dangt.aitranslator.backend.config;
//
//import org.springframework.beans.factory.annotation.Value;
//import org.springframework.context.annotation.Configuration;
//import org.springframework.web.servlet.config.annotation.CorsRegistry;
//import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
//
//import java.util.Arrays;
//
//@Configuration
//public class CorsConfig implements WebMvcConfigurer {
//
//    private final String[] allowedOrigins;
//
//    public CorsConfig(
//        // Thêm fallback localhost ở đây để nếu quên cấu hình trên Railway thì app vẫn chạy được local
//        @Value("${app.cors.allowed-origins:http://127.0.0.1:4174,http://localhost:4174}") String allowedOrigins
//    ) {
//        this.allowedOrigins = Arrays.stream(
//                String.valueOf(allowedOrigins).split(",")
//            )
//            .map(String::trim)
//            .filter(value -> !value.isEmpty())
//            .distinct()
//            .toArray(String[]::new);
//    }
//
//    @Override
//    public void addCorsMappings(CorsRegistry registry) {
//        if (allowedOrigins.length == 0) {
//            return;
//        }
//
//        registry
//            .addMapping("/api/**")
//            .allowedOrigins(allowedOrigins)
//            .allowedMethods(
//                "GET",
//                "POST",
//                "PUT",
//                "PATCH",
//                "DELETE",
//                "OPTIONS"
//            )
//            .allowedHeaders(
//                "Authorization",
//                "Content-Type",
//                "Accept",
//                "X-Request-Id"
//            )
//            .exposedHeaders("X-Request-Id")
//            .allowCredentials(false)
//            .maxAge(3600);
//    }
//}
