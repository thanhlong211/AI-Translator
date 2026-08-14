package com.dangt.aitranslator.backend.translation.batch;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.entitlement.DailyQuotaReservation;
import com.dangt.aitranslator.backend.entitlement.EntitlementService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/translate")
@Tag(
        name = "Translation",
        description =
                "Translation Profile → Personal Memory → AI Provider."
)
public class BatchTranslationController {

    private final BatchTranslationService batchTranslationService;
    private final CurrentUserService currentUserService;
    private final EntitlementService entitlementService;

    public BatchTranslationController(
            BatchTranslationService batchTranslationService,
            CurrentUserService currentUserService,
            EntitlementService entitlementService
    ) {
        this.batchTranslationService =
                batchTranslationService;
        this.currentUserService =
                currentUserService;
        this.entitlementService =
                entitlementService;
    }

    @Operation(
            summary =
                    "Dịch nhiều text blocks bằng một AI request",
            description =
                    "Dùng cho Full Screen, Manga page và Reader. "
                            + "Personal Translation Memory được kiểm tra riêng cho từng block trước khi gọi AI."
    )
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping(
            value = "/batch",
            consumes =
                    MediaType.APPLICATION_JSON_VALUE,
            produces =
                    MediaType.APPLICATION_JSON_VALUE
    )
    public BatchTranslateResponse translateBatch(
            @Valid
            @RequestBody
            BatchTranslateRequest request,
            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        if (request.purpose() == BatchTranslationPurpose.MANGA) {
            entitlementService.requireFeature(
                    user,
                    "mangaPanel",
                    "Manga Translation",
                    "PRO"
            );

            if (request.mangaMode() == MangaTranslationMode.SESSION
                    || request.mangaMode() == MangaTranslationMode.CONTINUOUS) {
                entitlementService.requireFeature(
                        user,
                        "mangaSession",
                        "Manga Session",
                        "PRO"
                );
            }

            if (request.mangaMode() == MangaTranslationMode.CONTINUOUS) {
                entitlementService.requireFeature(
                        user,
                        "continuousManga",
                        "Continuous Manga",
                        "MANGA_PLUS"
                );
            }
        }

        if (request.purpose() == BatchTranslationPurpose.NOVEL) {
            entitlementService.requireFeature(
                    user,
                    "novelReaderTxt",
                    "Novel Reader TXT",
                    "PRO"
            );
        }

        if (request.purpose() == BatchTranslationPurpose.NOVEL_EPUB) {
            entitlementService.requireFeature(
                    user,
                    "novelReaderEpub",
                    "Novel Reader EPUB",
                    "PRO"
            );
        }

        if (request.purpose() == BatchTranslationPurpose.PDF_TEXT) {
            entitlementService.requireFeature(
                    user,
                    "pdfTextReader",
                    "PDF Text Reader",
                    "PRO"
            );
        }

        if (request.purpose() == BatchTranslationPurpose.PDF_OCR) {
            entitlementService.requireFeature(
                    user,
                    "pdfOcrReader",
                    "PDF OCR Reader",
                    "PRO"
            );
        }

        entitlementService.requireContextItems(
                user,
                request.context().size()
        );

        entitlementService
                .requireTranslationQuota(user);

        boolean allowTranslationMemory = entitlementService.hasFeature(
                user,
                "translationMemory"
        );

        List<DailyQuotaReservation> reservations = List.of();
        if (request.purpose() == BatchTranslationPurpose.MANGA) {
            reservations = entitlementService.reserveMangaPage(
                    user,
                    request.mangaMode() == MangaTranslationMode.CONTINUOUS
            );
        }

        try {
            return batchTranslationService.translate(
                    user.getId(),
                    request,
                    allowTranslationMemory
            );
        } catch (RuntimeException ex) {
            entitlementService.releaseDailyReservations(reservations);
            throw ex;
        }
    }
}
