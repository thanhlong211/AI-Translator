package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.auth.email.EmailVerificationRequiredException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerEmailVerificationTest {

    @Mock
    private AuthService authService;

    @Test
    void registerReturnsEmailVerificationRequiredAfterCreatingAccount() {
        AuthController controller =
                new AuthController(
                        authService
                );

        RegisterRequest request =
                new RegisterRequest(
                        "test@example.com",
                        "StrongPassword123!",
                        "device-A",
                        "Test PC"
                );

        MockHttpServletRequest httpRequest =
                new MockHttpServletRequest();

        httpRequest.setRemoteAddr(
                "127.0.0.1"
        );

        EmailVerificationRequiredException ex =
                assertThrows(
                        EmailVerificationRequiredException.class,
                        () ->
                                controller.register(
                                        request,
                                        httpRequest
                                )
                );

        assertEquals(
                "EMAIL_VERIFICATION_REQUIRED",
                ex.getCode()
        );

        verify(authService).register(
                request,
                "127.0.0.1"
        );
    }
}
