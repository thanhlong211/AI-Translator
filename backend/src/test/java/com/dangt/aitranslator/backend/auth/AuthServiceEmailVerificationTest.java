package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.auth.email.EmailVerificationRequiredException;
import com.dangt.aitranslator.backend.auth.email.EmailVerificationService;
import com.dangt.aitranslator.backend.session.RefreshTokenService;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceEmailVerificationTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private RefreshTokenService refreshTokenService;

    @Mock
    private EmailVerificationService emailVerificationService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userRepository,
                passwordEncoder,
                jwtService,
                refreshTokenService,
                emailVerificationService
        );
    }

    @Test
    void registerCreatesUnverifiedUserAndDoesNotCreateSession() {
        RegisterRequest request =
                new RegisterRequest(
                        "test@example.com",
                        "StrongPassword123!",
                        "device-A",
                        "Test PC"
                );

        when(
                userRepository.existsByEmail(
                        "test@example.com"
                )
        ).thenReturn(false);

        when(
                passwordEncoder.encode(
                        "StrongPassword123!"
                )
        ).thenReturn("hashed-password");

        when(
                userRepository.saveAndFlush(
                        any(UserAccount.class)
                )
        ).thenAnswer(invocation ->
                invocation.getArgument(0)
        );

        authService.register(
                request,
                "127.0.0.1"
        );

        ArgumentCaptor<UserAccount> captor =
                ArgumentCaptor.forClass(
                        UserAccount.class
                );

        verify(userRepository)
                .saveAndFlush(
                        captor.capture()
                );

        UserAccount created =
                captor.getValue();

        assertFalse(
                created.isEmailVerified()
        );

        verify(emailVerificationService)
                .issueForUser(
                        same(created),
                        eq("127.0.0.1")
                );

        verifyNoInteractions(
                jwtService,
                refreshTokenService
        );
    }

    @Test
    void loginUnverifiedUserRequiresEmailVerificationAndDoesNotCreateSession() {
        UserAccount user =
                mock(UserAccount.class);

        when(user.getStatus())
                .thenReturn("ACTIVE");

        when(user.getPasswordHash())
                .thenReturn("hashed-password");

        when(user.isEmailVerified())
                .thenReturn(false);

        when(
                userRepository.findByEmail(
                        "test@example.com"
                )
        ).thenReturn(
                Optional.of(user)
        );

        when(
                passwordEncoder.matches(
                        "StrongPassword123!",
                        "hashed-password"
                )
        ).thenReturn(true);

        EmailVerificationRequiredException ex =
                assertThrows(
                        EmailVerificationRequiredException.class,
                        () ->
                                authService.login(
                                        new LoginRequest(
                                                "test@example.com",
                                                "StrongPassword123!",
                                                "device-A",
                                                "Test PC"
                                        )
                                )
                );

        assertEquals(
                "EMAIL_VERIFICATION_REQUIRED",
                ex.getCode()
        );

        verifyNoInteractions(
                jwtService,
                refreshTokenService
        );
    }
}
