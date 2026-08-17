package com.dangt.aitranslator.backend.social;

import com.dangt.aitranslator.backend.auth.AuthService;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SocialAuthServiceEmailVerificationTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private UserRepository userRepository;

    @Mock
    private AuthService authService;

    @Mock
    private SocialOAuthClient oauthClient;

    private SocialAuthService socialAuthService;

    @BeforeEach
    void setUp() {
        socialAuthService = new SocialAuthService(
                jdbcTemplate,
                userRepository,
                authService,
                oauthClient,
                5
        );
    }

    @Test
    void socialLoginMarksUnverifiedEmailBeforeCreatingSession() {
        UserAccount user =
                new UserAccount(
                        "social@example.com",
                        null
                );

        assertFalse(
                user.isEmailVerified()
        );

        Instant now =
                Instant.parse(
                        "2026-08-18T00:00:00Z"
                );

        socialAuthService.createVerifiedSocialSession(
                user,
                "device-A",
                "Test PC",
                now
        );

        assertTrue(
                user.isEmailVerified()
        );

        assertEquals(
                now,
                user.getEmailVerifiedAt()
        );

        verify(userRepository)
                .saveAndFlush(
                        same(user)
                );

        verify(authService)
                .createSessionForUser(
                        same(user),
                        eq("device-A"),
                        eq("Test PC")
                );
    }

    @Test
    void socialLoginKeepsExistingVerificationTimestamp() {
        UserAccount user =
                new UserAccount(
                        "social@example.com",
                        null
                );

        Instant verifiedAt =
                Instant.parse(
                        "2026-08-17T00:00:00Z"
                );

        user.markEmailVerified(
                verifiedAt
        );

        socialAuthService.createVerifiedSocialSession(
                user,
                "device-A",
                "Test PC",
                Instant.parse(
                        "2026-08-18T00:00:00Z"
                )
        );

        assertEquals(
                verifiedAt,
                user.getEmailVerifiedAt()
        );

        verify(
                userRepository,
                never()
        ).saveAndFlush(
                any(UserAccount.class)
        );

        verify(authService)
                .createSessionForUser(
                        same(user),
                        eq("device-A"),
                        eq("Test PC")
                );
    }
}
