package com.dangt.aitranslator.backend.social;

import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/auth/social")
public class SocialAuthController {

    private final SocialAuthService socialAuthService;

    public SocialAuthController(SocialAuthService socialAuthService) {
        this.socialAuthService = socialAuthService;
    }

    @GetMapping(value = "/providers", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<SocialProviderStatus> providers() {
        return socialAuthService.providers();
    }

    @PostMapping(
            value = "/{provider}/start",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public SocialAuthStartResponse start(
            @PathVariable String provider,
            @Valid @RequestBody SocialAuthStartRequest request
    ) {
        return socialAuthService.startLogin(
                SocialAuthProvider.fromPath(provider),
                request
        );
    }

    @PostMapping(
            value = "/attempts/{attemptId}/poll",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public SocialAuthPollResponse poll(
            @PathVariable String attemptId,
            @Valid @RequestBody SocialAuthPollRequest request
    ) {
        return socialAuthService.poll(attemptId, request);
    }

    @GetMapping(
            value = "/{provider}/callback",
            produces = MediaType.TEXT_HTML_VALUE
    )
    public ResponseEntity<String> callback(
            @PathVariable String provider,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription
    ) {
        SocialAuthProvider resolvedProvider = SocialAuthProvider.fromPath(provider);
        SocialAuthService.CallbackResult result;

        try {
            result = socialAuthService.handleCallback(
                    resolvedProvider,
                    state,
                    code,
                    error == null ? errorDescription : error
            );
        } catch (Exception ex) {
            result = new SocialAuthService.CallbackResult(
                    false,
                    "Phiên đăng nhập không hợp lệ hoặc đã hết hạn."
            );
        }

        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(callbackHtml(
                        resolvedProvider.displayName(),
                        result.success(),
                        result.message()
                ));
    }

    private static String callbackHtml(
            String provider,
            boolean success,
            String message
    ) {
        String title = success ? "Đăng nhập thành công" : "Không thể đăng nhập";
        String accent = success ? "#16a34a" : "#dc2626";

        return """
                <!doctype html>
                <html lang="vi">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>%s · AI Translator</title>
                  <style>
                    body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#f5f4ef;color:#1f2937;margin:0;display:grid;place-items:center;min-height:100vh}
                    main{width:min(520px,calc(100%% - 40px));background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:32px;box-shadow:0 18px 55px rgba(15,23,42,.10)}
                    .mark{width:52px;height:52px;border-radius:16px;display:grid;place-items:center;background:%s;color:white;font-size:26px;font-weight:700}
                    h1{margin:20px 0 8px;font-size:26px}p{line-height:1.65;color:#4b5563}.provider{font-weight:700;color:#111827}
                  </style>
                </head>
                <body>
                  <main>
                    <div class="mark">%s</div>
                    <h1>%s</h1>
                    <p><span class="provider">%s</span> · %s</p>
                    <p>Bạn có thể đóng tab này và quay lại AI Translator Desktop.</p>
                  </main>
                </body>
                </html>
                """.formatted(
                htmlEscape(title),
                accent,
                success ? "✓" : "!",
                htmlEscape(title),
                htmlEscape(provider),
                htmlEscape(message)
        );
    }

    private static String htmlEscape(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
