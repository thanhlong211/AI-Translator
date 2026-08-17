package com.dangt.aitranslator.backend.session;

import com.dangt.aitranslator.backend.common.DeviceBindingException;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class DeviceBindingService {

    private final UserRepository userRepository;
    private final AuthSessionRepository sessionRepository;

    public DeviceBindingService(
            UserRepository userRepository,
            AuthSessionRepository sessionRepository
    ) {
        this.userRepository = userRepository;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public UserAccount requireOrBind(
            UserAccount user,
            String requestedDeviceId,
            String requestedDeviceName
    ) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException(
                    "Không xác định được tài khoản cần liên kết thiết bị."
            );
        }

        String deviceId = normalizeDeviceId(requestedDeviceId);
        String deviceName = normalizeDeviceName(requestedDeviceName);

        UserAccount lockedUser = userRepository
                .findByIdForUpdate(user.getId())
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy tài khoản."
                        )
                );

        String boundDeviceId = lockedUser.getBoundDeviceId();

        if (boundDeviceId != null && !boundDeviceId.equals(deviceId)) {
            throw new DeviceBindingException(
                    "DEVICE_BINDING_MISMATCH",
                    "Tài khoản này đã được liên kết với một thiết bị khác."
            );
        }

        if (boundDeviceId == null) {
            UserAccount existingOwner = userRepository
                    .findByBoundDeviceId(deviceId)
                    .orElse(null);

            if (existingOwner != null
                    && !existingOwner.getId().equals(lockedUser.getId())) {
                throw new DeviceBindingException(
                        "DEVICE_ALREADY_BOUND",
                        "Thiết bị này đã được liên kết với một tài khoản khác."
                );
            }

            lockedUser.bindDevice(
                    deviceId,
                    deviceName,
                    Instant.now()
            );

            try {
                lockedUser = userRepository.saveAndFlush(lockedUser);
            } catch (DataIntegrityViolationException ex) {
                throw new DeviceBindingException(
                        "DEVICE_ALREADY_BOUND",
                        "Thiết bị này đã được liên kết với một tài khoản khác."
                );
            }
        }

        revokeOtherDeviceSessions(
                lockedUser.getId(),
                deviceId
        );

        return lockedUser;
    }

    @Transactional
    public UserAccount transferBinding(
            UserAccount user,
            String requestedDeviceId,
            String requestedDeviceName
    ) {
        if (user == null || user.getId() == null) {
            throw new IllegalArgumentException(
                    "Không xác định được tài khoản cần chuyển thiết bị."
            );
        }

        String deviceId =
                normalizeDeviceId(
                        requestedDeviceId
                );

        String deviceName =
                normalizeDeviceName(
                        requestedDeviceName
                );

        UserAccount lockedUser =
                userRepository
                        .findByIdForUpdate(
                                user.getId()
                        )
                        .orElseThrow(() ->
                                new IllegalArgumentException(
                                        "Không tìm thấy tài khoản."
                                )
                        );

        UserAccount existingOwner =
                userRepository
                        .findByBoundDeviceId(
                                deviceId
                        )
                        .orElse(null);

        if (
                existingOwner != null
                && !existingOwner
                        .getId()
                        .equals(
                                lockedUser.getId()
                        )
        ) {
            throw new DeviceBindingException(
                    "DEVICE_ALREADY_BOUND",
                    "Thiết bị này đã được liên kết với một tài khoản khác."
            );
        }

        Instant now =
                Instant.now();

        revokeAllSessions(
                lockedUser.getId(),
                now
        );

        lockedUser.bindDevice(
                deviceId,
                deviceName,
                now
        );

        try {
            lockedUser =
                    userRepository
                            .saveAndFlush(
                                    lockedUser
                            );
        } catch (DataIntegrityViolationException ex) {
            throw new DeviceBindingException(
                    "DEVICE_ALREADY_BOUND",
                    "Thiết bị này đã được liên kết với một tài khoản khác."
            );
        }

        return lockedUser;
    }

    private void revokeAllSessions(
            Long userId,
            Instant now
    ) {
        List<AuthSession> changed =
                new ArrayList<>();

        for (
                AuthSession session
                : sessionRepository
                        .findAllByUser_IdAndRevokedAtIsNullOrderByCreatedAtDesc(
                                userId
                        )
        ) {
            session.revoke(now);
            changed.add(session);
        }

        if (!changed.isEmpty()) {
            sessionRepository.saveAll(
                    changed
            );
        }
    }

    private void revokeOtherDeviceSessions(
            Long userId,
            String allowedDeviceId
    ) {
        Instant now = Instant.now();

        List<AuthSession> changed = new ArrayList<>();

        for (AuthSession session :
                sessionRepository
                        .findAllByUser_IdAndRevokedAtIsNullOrderByCreatedAtDesc(
                                userId
                        )) {

            if (!session.isActive(now)) {
                continue;
            }

            if (allowedDeviceId.equals(session.getDeviceId())) {
                continue;
            }

            session.revoke(now);
            changed.add(session);
        }

        if (!changed.isEmpty()) {
            sessionRepository.saveAll(changed);
        }
    }

    private String normalizeDeviceId(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(
                    "Thiếu mã nhận dạng thiết bị."
            );
        }

        String clean = value.trim();

        if (clean.length() > 100) {
            throw new IllegalArgumentException(
                    "Mã nhận dạng thiết bị vượt quá giới hạn."
            );
        }

        return clean;
    }

    private String normalizeDeviceName(String value) {
        String clean =
                value == null || value.isBlank()
                        ? "AI Translator Desktop"
                        : value.trim();

        if (clean.length() > 190) {
            clean = clean.substring(0, 190);
        }

        return clean;
    }
}
