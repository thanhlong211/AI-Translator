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
        String safeProvider = htmlEscape(provider);
        String safeMessage = htmlEscape(message);
        String title = success ? "Đăng nhập thành công" : "Không thể hoàn tất đăng nhập";
        String headline = success
                ? "Bạn đã đăng nhập với " + safeProvider
                : "Đăng nhập " + safeProvider + " chưa hoàn tất";
        String description = success
                ? "Tài khoản đã được xác nhận. Bạn có thể quay lại AI Translator và tiếp tục sử dụng ứng dụng."
                : "Hãy quay lại AI Translator và thử đăng nhập lại. Nếu lỗi tiếp tục xảy ra, hãy kiểm tra kết nối và cấu hình tài khoản.";
        String stateClass = success ? "success" : "error";
        String stateMark = success ? "✓" : "!";
        String statusLabel = success ? "Đã xác nhận an toàn" : "Cần thử lại";
        String actionLabel = success ? "Quay lại AI Translator" : "Đóng tab và thử lại";
        String providerIcon = providerIcon(provider);

        String template = """
                <!doctype html>
                <html lang="vi">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <meta name="color-scheme" content="light dark">
                  <meta name="robots" content="noindex,nofollow,noarchive">
                  <meta name="referrer" content="no-referrer">
                  <title>{{TITLE}} · AI Translator</title>
                  <style>
                    :root{
                      color-scheme:light;
                      --bg:#f5f6fb;
                      --bg-soft:#eef1fb;
                      --surface:rgba(255,255,255,.92);
                      --surface-strong:#ffffff;
                      --border:#e3e7f0;
                      --border-strong:#d5dbe8;
                      --text:#101828;
                      --muted:#667085;
                      --muted-2:#98a2b3;
                      --brand:#5b4cf0;
                      --brand-2:#7968ff;
                      --brand-soft:#f1efff;
                      --success:#17a05d;
                      --success-soft:#eaf8f1;
                      --danger:#d64545;
                      --danger-soft:#fff0f0;
                      --shadow:0 28px 80px rgba(16,24,40,.14),0 8px 24px rgba(16,24,40,.06);
                    }
                    *{box-sizing:border-box}
                    html,body{min-height:100%}
                    body{
                      margin:0;
                      min-height:100vh;
                      display:grid;
                      place-items:center;
                      overflow-x:hidden;
                      font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;
                      color:var(--text);
                      background:
                        radial-gradient(circle at 16% 18%,rgba(104,86,255,.13),transparent 28rem),
                        radial-gradient(circle at 88% 82%,rgba(68,193,153,.09),transparent 25rem),
                        linear-gradient(145deg,var(--bg),var(--bg-soft));
                      padding:48px 20px;
                    }
                    body::before{
                      content:"";
                      position:fixed;
                      inset:0;
                      pointer-events:none;
                      background-image:linear-gradient(rgba(91,76,240,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(91,76,240,.025) 1px,transparent 1px);
                      background-size:32px 32px;
                      mask-image:linear-gradient(to bottom,rgba(0,0,0,.38),transparent 76%);
                    }
                    .page{position:relative;width:min(720px,100%);z-index:1}
                    .brand{
                      display:flex;
                      align-items:center;
                      justify-content:center;
                      gap:12px;
                      margin:0 auto 22px;
                      color:var(--text);
                    }
                    .brand-mark{
                      width:42px;height:42px;border-radius:13px;
                      display:grid;place-items:center;
                      color:white;font-weight:850;font-size:18px;letter-spacing:-.03em;
                      background:linear-gradient(145deg,var(--brand),var(--brand-2));
                      box-shadow:0 10px 26px rgba(91,76,240,.28);
                    }
                    .brand-copy{display:grid;gap:1px;text-align:left}
                    .brand-copy strong{font-size:15px;letter-spacing:-.015em}
                    .brand-copy span{font-size:12px;color:var(--muted)}
                    .card{
                      position:relative;
                      overflow:hidden;
                      padding:46px 48px 36px;
                      background:var(--surface);
                      border:1px solid rgba(213,219,232,.9);
                      border-radius:30px;
                      box-shadow:var(--shadow);
                      backdrop-filter:blur(18px);
                    }
                    .card::before{
                      content:"";
                      position:absolute;
                      inset:0 0 auto;
                      height:4px;
                      background:linear-gradient(90deg,var(--brand),#8e7cff,#35b987);
                    }
                    .topline{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:32px}
                    .provider-pill{
                      display:inline-flex;align-items:center;gap:10px;
                      padding:9px 13px 9px 9px;
                      border:1px solid var(--border);
                      border-radius:999px;
                      background:var(--surface-strong);
                      font-size:13px;font-weight:700;
                      box-shadow:0 3px 12px rgba(16,24,40,.04);
                    }
                    .provider-icon{
                      width:30px;height:30px;border-radius:9px;
                      display:grid;place-items:center;overflow:hidden;flex:0 0 auto;
                      border:1px solid var(--border);
                      background:#fff;
                    }
                    .provider-icon svg{width:19px;height:19px;display:block}
                    .provider-icon.facebook{background:#1877f2;border-color:#1877f2;color:#fff;font-family:Arial,sans-serif;font-weight:900;font-size:22px;line-height:1}
                    .status-pill{
                      display:inline-flex;align-items:center;gap:8px;
                      padding:8px 12px;border-radius:999px;
                      font-size:12px;font-weight:750;
                    }
                    .status-pill::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 0 4px currentColor;color:inherit;opacity:.9}
                    .success .status-pill{background:var(--success-soft);color:var(--success)}
                    .error .status-pill{background:var(--danger-soft);color:var(--danger)}
                    .status-icon{
                      width:74px;height:74px;border-radius:23px;
                      display:grid;place-items:center;
                      font-size:34px;font-weight:800;margin-bottom:24px;
                    }
                    .success .status-icon{color:var(--success);background:linear-gradient(145deg,#eefaf4,#dff5ea);box-shadow:inset 0 0 0 1px rgba(23,160,93,.09)}
                    .error .status-icon{color:var(--danger);background:linear-gradient(145deg,#fff5f5,#ffe5e5);box-shadow:inset 0 0 0 1px rgba(214,69,69,.09)}
                    h1{margin:0 0 12px;font-size:clamp(28px,4.5vw,38px);line-height:1.14;letter-spacing:-.035em}
                    .lead{margin:0;max-width:590px;color:var(--muted);font-size:16px;line-height:1.7}
                    .summary{
                      display:flex;align-items:flex-start;gap:12px;
                      margin:28px 0 0;padding:16px 18px;
                      border:1px solid var(--border);
                      border-radius:17px;
                      background:rgba(248,250,252,.82);
                    }
                    .summary-mark{width:22px;height:22px;border-radius:7px;display:grid;place-items:center;flex:0 0 auto;margin-top:1px;font-size:12px;font-weight:850}
                    .success .summary-mark{background:var(--success-soft);color:var(--success)}
                    .error .summary-mark{background:var(--danger-soft);color:var(--danger)}
                    .summary p{margin:0;color:var(--muted);font-size:13px;line-height:1.6}
                    .actions{display:flex;align-items:center;gap:12px;margin-top:30px;flex-wrap:wrap}
                    button{
                      appearance:none;border:0;cursor:pointer;
                      min-height:46px;padding:0 19px;border-radius:14px;
                      font:inherit;font-size:14px;font-weight:760;
                      transition:transform .16s ease,box-shadow .16s ease,background .16s ease,border-color .16s ease;
                    }
                    button:focus-visible{outline:3px solid rgba(91,76,240,.22);outline-offset:3px}
                    .primary{
                      display:inline-flex;align-items:center;justify-content:center;gap:9px;
                      color:#fff;background:linear-gradient(135deg,var(--brand),var(--brand-2));
                      box-shadow:0 12px 24px rgba(91,76,240,.25);
                    }
                    .primary:hover{transform:translateY(-1px);box-shadow:0 15px 30px rgba(91,76,240,.3)}
                    .primary svg{width:17px;height:17px}
                    .helper{font-size:12px;line-height:1.5;color:var(--muted-2);max-width:280px}
                    .footer{
                      display:flex;align-items:center;justify-content:center;gap:8px;
                      margin-top:20px;color:var(--muted-2);font-size:11px;text-align:center;
                    }
                    .footer-lock{width:14px;height:14px;opacity:.72}
                    @media (max-width:620px){
                      body{padding:28px 14px}
                      .card{padding:34px 24px 28px;border-radius:24px}
                      .topline{align-items:flex-start;flex-direction:column;margin-bottom:28px}
                      .status-icon{width:66px;height:66px;border-radius:20px;font-size:30px}
                      .actions{align-items:stretch;flex-direction:column}
                      .primary{width:100%}
                      .helper{max-width:none;text-align:center}
                    }
                    @media (prefers-color-scheme:dark){
                      :root{
                        color-scheme:dark;
                        --bg:#0b1020;
                        --bg-soft:#11182a;
                        --surface:rgba(17,24,39,.9);
                        --surface-strong:#151d2e;
                        --border:#273247;
                        --border-strong:#344158;
                        --text:#f6f7fb;
                        --muted:#aeb8ca;
                        --muted-2:#8390a6;
                        --brand-soft:#221f45;
                        --success-soft:#123326;
                        --danger-soft:#3d2023;
                        --shadow:0 28px 90px rgba(0,0,0,.38),0 8px 24px rgba(0,0,0,.24);
                      }
                      body{
                        background:
                          radial-gradient(circle at 16% 18%,rgba(105,88,255,.2),transparent 28rem),
                          radial-gradient(circle at 88% 82%,rgba(53,185,135,.11),transparent 25rem),
                          linear-gradient(145deg,var(--bg),var(--bg-soft));
                      }
                      .card{border-color:rgba(52,65,88,.9)}
                      .provider-icon{border-color:#d8dde8}
                      .summary{background:rgba(11,16,32,.52)}
                    }
                    @media (prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
                  </style>
                </head>
                <body>
                  <div class="page">
                    <header class="brand" aria-label="AI Translator">
                      <div class="brand-mark" aria-hidden="true">AI</div>
                      <div class="brand-copy">
                        <strong>AI Translator</strong>
                        <span>Desktop</span>
                      </div>
                    </header>

                    <main class="card {{STATE_CLASS}}">
                      <div class="topline">
                        <div class="provider-pill">
                          {{PROVIDER_ICON}}
                          <span>{{PROVIDER}}</span>
                        </div>
                        <div class="status-pill">{{STATUS_LABEL}}</div>
                      </div>

                      <div class="status-icon" aria-hidden="true">{{STATE_MARK}}</div>
                      <h1>{{HEADLINE}}</h1>
                      <p class="lead">{{DESCRIPTION}}</p>

                      <div class="summary" role="status" aria-live="polite">
                        <div class="summary-mark" aria-hidden="true">{{STATE_MARK}}</div>
                        <p>{{MESSAGE}}</p>
                      </div>

                      <div class="actions">
                        <button id="returnButton" class="primary" type="button">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M14.5 6.5 9 12l5.5 5.5M9.5 12H20M4 5v14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          <span>{{ACTION_LABEL}}</span>
                        </button>
                        <span id="helperText" class="helper">Bạn có thể đóng tab này sau khi quay lại ứng dụng.</span>
                      </div>
                    </main>

                    <footer class="footer">
                      <svg class="footer-lock" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="5" y="10" width="14" height="10" rx="3" stroke="currentColor" stroke-width="1.8"/>
                        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                      </svg>
                      <span>Phiên đăng nhập này chỉ dùng để hoàn tất xác thực AI Translator.</span>
                    </footer>
                  </div>

                  <script>
                    (() => {
                      const button = document.getElementById('returnButton');
                      const helper = document.getElementById('helperText');
                      if (!button || !helper) return;

                      button.addEventListener('click', () => {
                        window.close();
                        window.setTimeout(() => {
                          if (!document.hidden) {
                            helper.textContent = 'Trình duyệt không cho phép đóng tab tự động. Hãy đóng tab này và quay lại AI Translator.';
                            button.querySelector('span').textContent = 'Đóng tab này';
                          }
                        }, 220);
                      });
                    })();
                  </script>
                </body>
                </html>
                """;

        return template
                .replace("{{TITLE}}", htmlEscape(title))
                .replace("{{STATE_CLASS}}", stateClass)
                .replace("{{PROVIDER_ICON}}", providerIcon)
                .replace("{{PROVIDER}}", safeProvider)
                .replace("{{STATUS_LABEL}}", htmlEscape(statusLabel))
                .replace("{{STATE_MARK}}", stateMark)
                .replace("{{HEADLINE}}", headline)
                .replace("{{DESCRIPTION}}", htmlEscape(description))
                .replace("{{MESSAGE}}", safeMessage)
                .replace("{{ACTION_LABEL}}", htmlEscape(actionLabel));
    }

    private static String providerIcon(String provider) {
        if ("Google".equalsIgnoreCase(provider)) {
            return """
                    <span class="provider-icon google" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.24-.2-1.79H12v3.25h5.37a4.6 4.6 0 0 1-1.99 2.94l-.02.11 2.89 2.24.2.02c1.83-1.69 2.9-4.18 2.9-6.77Z"/>
                        <path fill="#34A853" d="M12 21.75c2.62 0 4.82-.86 6.43-2.35l-3.07-2.37c-.82.55-1.93.94-3.36.94a5.84 5.84 0 0 1-5.52-4.04l-.1.01-3 2.31-.04.1A9.71 9.71 0 0 0 12 21.75Z"/>
                        <path fill="#FBBC05" d="M6.48 13.93A5.96 5.96 0 0 1 6.17 12c0-.67.11-1.32.3-1.93v-.1L3.44 7.62l-.1.05A9.75 9.75 0 0 0 2.25 12c0 1.56.37 3.04 1.09 4.34l3.14-2.41Z"/>
                        <path fill="#EA4335" d="M12 6.03c1.82 0 3.05.79 3.75 1.44l2.74-2.67C16.81 3.24 14.62 2.25 12 2.25a9.71 9.71 0 0 0-8.66 5.42l3.13 2.4A5.86 5.86 0 0 1 12 6.03Z"/>
                      </svg>
                    </span>
                    """;
        }

        if ("Facebook".equalsIgnoreCase(provider)) {
            return "<span class=\"provider-icon facebook\" aria-hidden=\"true\">f</span>";
        }

        return "<span class=\"provider-icon\" aria-hidden=\"true\">↗</span>";
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
