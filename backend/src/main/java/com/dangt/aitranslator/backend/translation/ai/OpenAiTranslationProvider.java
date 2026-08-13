package com.dangt.aitranslator.backend.translation.ai;

import com.dangt.aitranslator.backend.usage.AiProviderUsage;
import com.dangt.aitranslator.backend.usage.OpenAiUsageExtractor;
import com.openai.client.OpenAIClient;
import com.openai.models.ChatModel;
import com.openai.models.responses.Response;
import com.openai.models.responses.ResponseCreateParams;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.stream.Collectors;

@Component
public class OpenAiTranslationProvider
        implements TranslationAiProvider {

    private final OpenAIClient openAIClient;
    private final ChatModel model;
    private final String modelName;

    public OpenAiTranslationProvider(
            OpenAIClient openAIClient,

            @Value(
                    "${app.openai.model:gpt-5.4-mini}"
            )
            String modelName
    ) {
        this.openAIClient = openAIClient;
        this.modelName = modelName;
        this.model = ChatModel.of(modelName);
    }

    @Override
    public String providerName() {
        return "openai";
    }

    @Override
    public String modelName() {
        return modelName;
    }

    @Override
    public TranslationAiResult translate(
            String prompt
    ) {
        ResponseCreateParams params =
                ResponseCreateParams
                        .builder()
                        .model(model)
                        .input(prompt)
                        .build();

        Response response =
                openAIClient
                        .responses()
                        .create(params);

        String text =
                response
                        .output()
                        .stream()
                        .flatMap(
                                item ->
                                        item
                                                .message()
                                                .stream()
                        )
                        .flatMap(
                                message ->
                                        message
                                                .content()
                                                .stream()
                        )
                        .flatMap(
                                content ->
                                        content
                                                .outputText()
                                                .stream()
                        )
                        .map(
                                outputText ->
                                        outputText.text()
                        )
                        .collect(
                                Collectors.joining()
                        )
                        .trim();

        if (text.isBlank()) {
            throw new IllegalStateException(
                    "OpenAI không trả về nội dung dịch."
            );
        }

        AiProviderUsage usage =
                OpenAiUsageExtractor.from(
                        response,
                        modelName
                );

        return new TranslationAiResult(
                text,
                usage.provider(),
                usage.model(),
                usage
        );
    }
}
