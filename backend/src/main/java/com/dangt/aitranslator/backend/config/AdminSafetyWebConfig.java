package com.dangt.aitranslator.backend.config;

import com.dangt.aitranslator.backend.admin.AdminSafetyInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class AdminSafetyWebConfig implements WebMvcConfigurer {

    private final AdminSafetyInterceptor adminSafetyInterceptor;

    public AdminSafetyWebConfig(AdminSafetyInterceptor adminSafetyInterceptor) {
        this.adminSafetyInterceptor = adminSafetyInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminSafetyInterceptor).addPathPatterns("/api/v1/admin/**");
    }
}
