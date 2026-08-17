package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.auth.email.EmailVerificationRequiredException;
import com.dangt.aitranslator.backend.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(
        name = "Authentication",
        description = "Đăng ký, đăng nhập, refresh token và logout."
)
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Đăng ký tài khoản và gửi mã xác minh email")
    @ApiResponse(
            responseCode = "403",
            description = "Tài khoản đã được tạo và cần xác minh email"
    )
    @ApiResponse(
            responseCode = "409",
            description = "Email đã tồn tại",
            content = @Content(
                    mediaType = MediaType.APPLICATION_JSON_VALUE,
                    schema = @Schema(implementation = ApiError.class)
            )
    )
    @PostMapping(
            value = "/register",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public void register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.register(
                request,
                clientIp(httpRequest)
        );

        throw new EmailVerificationRequiredException();
    }

    @Operation(summary = "Đăng nhập + tạo/đổi device session")
    @PostMapping(
            value = "/login",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public AuthResponse login(
            @Valid @RequestBody LoginRequest request
    ) {
        return authService.login(request);
    }

    @Operation(summary = "Đổi refresh token lấy access token mới")
    @PostMapping(
            value = "/refresh",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public AuthResponse refresh(
            @Valid @RequestBody RefreshRequest request
    ) {
        return authService.refresh(request);
    }

    @Operation(summary = "Logout và thu hồi refresh token")
    @PostMapping(
            value = "/logout",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public LogoutResponse logout(
            @Valid @RequestBody LogoutRequest request
    ) {
        return authService.logout(request);
    }

    private String clientIp(
            HttpServletRequest request
    ) {
        String forwarded =
                request.getHeader(
                        "X-Forwarded-For"
                );

        if (
                forwarded != null
                && !forwarded.isBlank()
        ) {
            String first =
                    forwarded
                            .split(
                                    ",",
                                    2
                            )[0]
                            .trim();

            if (!first.isBlank()) {
                return first;
            }
        }

        return request.getRemoteAddr();
    }

}
