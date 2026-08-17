package com.dangt.aitranslator.backend.auth.device;

import com.dangt.aitranslator.backend.auth.AuthResponse;
import com.dangt.aitranslator.backend.auth.AuthService;
import com.dangt.aitranslator.backend.session.DeviceBindingService;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DeviceTransferServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private DeviceTransferTokenRepository tokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private DeviceTransferDeliveryService deliveryService;

    @Mock
    private DeviceBindingService deviceBindingService;

    @Mock
    private AuthService authService;

    private DeviceTransferService service;

    private UserAccount user;

    @BeforeEach
    void setUp() {
        service = new DeviceTransferService(
                userRepository,
                tokenRepository,
                passwordEncoder,
                deliveryService,
                deviceBindingService,
                authService,
                10,
                60,
                5
        );

        user = mock(UserAccount.class);

        when(user.getId())
                .thenReturn(42L);

        when(user.getStatus())
                .thenReturn("ACTIVE");
    }

    @Test
    void requestTransferCreatesSixDigitVerificationCode() {
        when(user.getEmail())
                .thenReturn("test@example.com");

        when(user.getBoundDeviceId())
                .thenReturn("device-B");

        when(userRepository.findByEmail("test@example.com"))
                .thenReturn(Optional.of(user));

        when(userRepository.findByIdForUpdate(42L))
                .thenReturn(Optional.of(user));

        when(userRepository.findByBoundDeviceId("device-C"))
                .thenReturn(Optional.empty());

        when(tokenRepository.existsByUser_IdAndCreatedAtAfter(
                eq(42L),
                any(Instant.class)
        )).thenReturn(false);

        when(tokenRepository
                .findAllByUser_IdAndUsedAtIsNullOrderByCreatedAtDesc(42L))
                .thenReturn(List.of());

        when(passwordEncoder.encode(anyString()))
                .thenReturn("hashed-code");

        when(tokenRepository.saveAndFlush(
                any(DeviceTransferToken.class)
        )).thenAnswer(invocation ->
                invocation.getArgument(0)
        );

        DeviceTransferRequestResponse response =
                service.requestTransfer(
                        new DeviceTransferRequest(
                                "test@example.com",
                                "device-C",
                                "Fake PC C"
                        ),
                        "127.0.0.1"
                );

        assertTrue(response.accepted());

        ArgumentCaptor<String> codeCaptor =
                ArgumentCaptor.forClass(String.class);

        verify(deliveryService).deliver(
                eq("test@example.com"),
                codeCaptor.capture()
        );

        String code =
                codeCaptor.getValue();

        assertNotNull(code);
        assertTrue(
                code.matches("\\d{6}"),
                "Verification code phải có đúng 6 chữ số."
        );

        verify(passwordEncoder).encode(code);

        verify(tokenRepository).saveAndFlush(
                any(DeviceTransferToken.class)
        );
    }

    @Test
    void requestTransferDoesNotSendCodeWhenTargetDeviceBelongsToAnotherAccount() {
        UserAccount otherUser =
                mock(UserAccount.class);

        when(otherUser.getId())
                .thenReturn(99L);

        when(user.getBoundDeviceId())
                .thenReturn("device-B");

        when(userRepository.findByEmail("test@example.com"))
                .thenReturn(Optional.of(user));

        when(userRepository.findByIdForUpdate(42L))
                .thenReturn(Optional.of(user));

        when(userRepository.findByBoundDeviceId("device-C"))
                .thenReturn(Optional.of(otherUser));

        DeviceTransferRequestResponse response =
                service.requestTransfer(
                        new DeviceTransferRequest(
                                "test@example.com",
                                "device-C",
                                "Fake PC C"
                        ),
                        "127.0.0.1"
                );

        assertTrue(response.accepted());

        verify(
                deliveryService,
                never()
        ).deliver(
                anyString(),
                anyString()
        );

        verify(
                tokenRepository,
                never()
        ).saveAndFlush(
                any(DeviceTransferToken.class)
        );
    }

    @Test
    void confirmTransferConsumesCodeAndCreatesSessionOnNewDevice() {
        DeviceTransferToken token =
                new DeviceTransferToken(
                        user,
                        "device-C",
                        "Fake PC C",
                        "hashed-code",
                        Instant.now()
                                .plusSeconds(600),
                        "127.0.0.1",
                        Instant.now()
                );

        when(userRepository.findByEmail("test@example.com"))
                .thenReturn(Optional.of(user));

        when(userRepository.findByIdForUpdate(42L))
                .thenReturn(Optional.of(user));

        when(tokenRepository.findActiveForUpdate(
                eq(42L),
                eq("device-C"),
                any(Instant.class)
        )).thenReturn(
                List.of(token)
        );

        when(passwordEncoder.matches(
                "123456",
                "hashed-code"
        )).thenReturn(true);

        when(tokenRepository.saveAndFlush(token))
                .thenReturn(token);

        when(tokenRepository
                .findAllByUser_IdAndUsedAtIsNullOrderByCreatedAtDesc(42L))
                .thenReturn(List.of());

        when(deviceBindingService.transferBinding(
                user,
                "device-C",
                "Fake PC C"
        )).thenReturn(user);

        AuthResponse authResponse =
                mock(AuthResponse.class);

        when(authService.createSessionForUser(
                user,
                "device-C",
                "Fake PC C"
        )).thenReturn(authResponse);

        AuthResponse result =
                service.confirmTransfer(
                        new DeviceTransferConfirmRequest(
                                "test@example.com",
                                "device-C",
                                "Fake PC C",
                                "123456"
                        )
                );

        assertSame(
                authResponse,
                result
        );

        assertNotNull(
                token.getUsedAt()
        );

        verify(deviceBindingService)
                .transferBinding(
                        user,
                        "device-C",
                        "Fake PC C"
                );

        verify(authService)
                .createSessionForUser(
                        user,
                        "device-C",
                        "Fake PC C"
                );
    }

    @Test
    void wrongCodeRecordsFailedAttemptAndRejectsTransfer() {
        DeviceTransferToken token =
                new DeviceTransferToken(
                        user,
                        "device-C",
                        "Fake PC C",
                        "hashed-code",
                        Instant.now()
                                .plusSeconds(600),
                        "127.0.0.1",
                        Instant.now()
                );

        when(userRepository.findByEmail("test@example.com"))
                .thenReturn(Optional.of(user));

        when(userRepository.findByIdForUpdate(42L))
                .thenReturn(Optional.of(user));

        when(tokenRepository.findActiveForUpdate(
                eq(42L),
                eq("device-C"),
                any(Instant.class)
        )).thenReturn(
                List.of(token)
        );

        when(passwordEncoder.matches(
                "999999",
                "hashed-code"
        )).thenReturn(false);

        when(tokenRepository.saveAndFlush(token))
                .thenReturn(token);

        DeviceTransferVerificationException ex =
                assertThrows(
                        DeviceTransferVerificationException.class,
                        () ->
                                service.confirmTransfer(
                                        new DeviceTransferConfirmRequest(
                                                "test@example.com",
                                                "device-C",
                                                "Fake PC C",
                                                "999999"
                                        )
                                )
                );

        assertEquals(
                "DEVICE_TRANSFER_CODE_INVALID",
                ex.getCode()
        );

        assertEquals(
                1,
                token.getFailedAttempts()
        );

        verify(
                deviceBindingService,
                never()
        ).transferBinding(
                any(),
                anyString(),
                anyString()
        );

        verify(
                authService,
                never()
        ).createSessionForUser(
                any(),
                anyString(),
                anyString()
        );
    }

    @Test
    void consumedOrMissingCodeCannotBeReused() {
        when(userRepository.findByEmail("test@example.com"))
                .thenReturn(Optional.of(user));

        when(userRepository.findByIdForUpdate(42L))
                .thenReturn(Optional.of(user));

        when(tokenRepository.findActiveForUpdate(
                eq(42L),
                eq("device-C"),
                any(Instant.class)
        )).thenReturn(
                List.of()
        );

        DeviceTransferVerificationException ex =
                assertThrows(
                        DeviceTransferVerificationException.class,
                        () ->
                                service.confirmTransfer(
                                        new DeviceTransferConfirmRequest(
                                                "test@example.com",
                                                "device-C",
                                                "Fake PC C",
                                                "123456"
                                        )
                                )
                );

        assertEquals(
                "DEVICE_TRANSFER_CODE_INVALID",
                ex.getCode()
        );

        verify(
                deviceBindingService,
                never()
        ).transferBinding(
                any(),
                anyString(),
                anyString()
        );
    }
}
