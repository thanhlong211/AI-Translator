package com.dangt.aitranslator.backend.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(
            CorsRegistry registry
    ) {
        /*
         * Development only.
         *
         * Production Electron requests will later be sent
         * from the Electron main process together with auth tokens.
         */
        registry
                .addMapping("/api/**")
                .allowedOrigins(
                        "http://localhost:5173"
                )
                .allowedMethods(
                        "GET",
                        "POST",
                        "OPTIONS"
                )
                .allowedHeaders("*");
    }
}
