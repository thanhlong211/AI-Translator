package com.dangt.aitranslator.backend.session;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AuthSessionRepository
        extends JpaRepository<AuthSession, Long> {

    Optional<AuthSession> findByRefreshTokenHash(
            String refreshTokenHash
    );

    List<AuthSession> findAllByUser_IdAndDeviceIdAndRevokedAtIsNull(
            Long userId,
            String deviceId
    );

    List<AuthSession> findAllByUser_IdAndRevokedAtIsNullOrderByCreatedAtDesc(
            Long userId
    );

    Optional<AuthSession> findByIdAndUser_Id(
            Long id,
            Long userId
    );
}
