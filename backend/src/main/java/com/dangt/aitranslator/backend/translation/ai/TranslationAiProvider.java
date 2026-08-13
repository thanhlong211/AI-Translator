package com.dangt.aitranslator.backend.translation.ai;

public interface TranslationAiProvider {

    String providerName();

    String modelName();

    TranslationAiResult translate(
            String prompt
    );
}
