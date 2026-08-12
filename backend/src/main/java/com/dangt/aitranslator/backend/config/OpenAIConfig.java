package com.dangt.aitranslator.backend.config;

import com.openai.client.OpenAIClient;
import com.openai.client.okhttp.OpenAIOkHttpClient;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenAIConfig {

    @Bean
    OpenAIClient openAIClient() {
        /*
         * OPENAI_API_KEY is read from the server environment.
         *
         * Never put the commercial OpenAI key inside:
         * - Electron
         * - React
         * - app.asar
         * - Setup.exe
         * - application.properties
         */
        return OpenAIOkHttpClient.fromEnv();
    }
}
