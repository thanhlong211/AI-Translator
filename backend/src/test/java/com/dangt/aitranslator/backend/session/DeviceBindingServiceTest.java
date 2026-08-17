package com.dangt.aitranslator.backend.session;

import com.dangt.aitranslator.backend.common.DeviceBindingException;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.*;

class DeviceBindingServiceTest {

    private UserRepository userRepository;
    private AuthSessionRepository sessionRepository;
    private DeviceBindingService service;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        sessionRepository = mock(AuthSessionRepository.class);

        service = new DeviceBindingService(
                userRepository,
                sessionRepository
        );
    }

    @Test
    void bindsFirstDevice() {
        UserAccount input = mock(UserAccount.class);
        UserAccount locked = mock(UserAccount.class);

        when(input.getId()).thenReturn(1L);
        when(locked.getId()).thenReturn(1L);
        when(locked.getBoundDeviceId()).thenReturn(null);

        when(userRepository.findByIdForUpdate(1L))
                .thenReturn(Optional.of(locked));

        when(userRepository.findByBoundDeviceId("device-a"))
                .thenReturn(Optional.empty());

        when(userRepository.saveAndFlush(locked))
                .thenReturn(locked);

        when(sessionRepository
                .findAllByUser_IdAndRevokedAtIsNullOrderByCreatedAtDesc(1L))
                .thenReturn(List.of());

        UserAccount result = service.requireOrBind(
                input,
                "device-a",
                "PC A"
        );

        assertSame(locked, result);

        verify(locked).bindDevice(
                eq("device-a"),
                eq("PC A"),
                any()
        );
    }

    @Test
    void allowsSameBoundDevice() {
        UserAccount input = mock(UserAccount.class);
        UserAccount locked = mock(UserAccount.class);

        when(input.getId()).thenReturn(1L);
        when(locked.getId()).thenReturn(1L);
        when(locked.getBoundDeviceId()).thenReturn("device-a");

        when(userRepository.findByIdForUpdate(1L))
                .thenReturn(Optional.of(locked));

        when(sessionRepository
                .findAllByUser_IdAndRevokedAtIsNullOrderByCreatedAtDesc(1L))
                .thenReturn(List.of());

        UserAccount result = service.requireOrBind(
                input,
                "device-a",
                "PC A"
        );

        assertSame(locked, result);
        verify(locked, never()).bindDevice(any(), any(), any());
    }

    @Test
    void blocksDifferentDeviceForSameAccount() {
        UserAccount input = mock(UserAccount.class);
        UserAccount locked = mock(UserAccount.class);

        when(input.getId()).thenReturn(1L);
        when(locked.getId()).thenReturn(1L);
        when(locked.getBoundDeviceId()).thenReturn("device-a");

        when(userRepository.findByIdForUpdate(1L))
                .thenReturn(Optional.of(locked));

        DeviceBindingException ex = assertThrows(
                DeviceBindingException.class,
                () -> service.requireOrBind(
                        input,
                        "device-b",
                        "PC B"
                )
        );

        assertEquals(
                "DEVICE_BINDING_MISMATCH",
                ex.getCode()
        );
    }

    @Test
    void blocksDeviceOwnedByAnotherAccount() {
        UserAccount input = mock(UserAccount.class);
        UserAccount locked = mock(UserAccount.class);
        UserAccount other = mock(UserAccount.class);

        when(input.getId()).thenReturn(1L);
        when(locked.getId()).thenReturn(1L);
        when(locked.getBoundDeviceId()).thenReturn(null);
        when(other.getId()).thenReturn(2L);

        when(userRepository.findByIdForUpdate(1L))
                .thenReturn(Optional.of(locked));

        when(userRepository.findByBoundDeviceId("device-a"))
                .thenReturn(Optional.of(other));

        DeviceBindingException ex = assertThrows(
                DeviceBindingException.class,
                () -> service.requireOrBind(
                        input,
                        "device-a",
                        "PC A"
                )
        );

        assertEquals(
                "DEVICE_ALREADY_BOUND",
                ex.getCode()
        );
    }
}
