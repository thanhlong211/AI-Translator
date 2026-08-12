package com.dangt.aitranslator.backend.translation.ai;

public interface TranslationAiProvider {

    TranslationAiResult translate(
            String prompt
    );
}
