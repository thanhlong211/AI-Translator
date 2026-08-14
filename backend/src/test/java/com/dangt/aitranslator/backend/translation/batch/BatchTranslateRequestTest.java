package com.dangt.aitranslator.backend.translation.batch;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BatchTranslateRequestTest {

    @Test
    void defaultsMangaModeToPanelForOlderClients() {
        BatchTranslateRequest request = new BatchTranslateRequest(
                null,
                BatchTranslationPurpose.MANGA,
                null,
                null,
                null,
                List.of(),
                List.of()
        );

        assertThat(request.mangaMode()).isEqualTo(MangaTranslationMode.PANEL);
    }
}
