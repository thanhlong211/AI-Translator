package com.dangt.aitranslator.backend.auth.device;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface DeviceTransferTokenRepository
        extends JpaRepository<DeviceTransferToken, Long> {

    List<DeviceTransferToken>
    findAllByUser_IdAndUsedAtIsNullOrderByCreatedAtDesc(
            Long userId
    );

    boolean existsByUser_IdAndCreatedAtAfter(
            Long userId,
            Instant createdAfter
    );

    long deleteByCreatedAtBefore(
            Instant createdBefore
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select t
            from DeviceTransferToken t
            where t.user.id = :userId
              and t.targetDeviceId = :targetDeviceId
              and t.usedAt is null
              and t.expiresAt > :now
            order by t.createdAt desc
            """)
    List<DeviceTransferToken> findActiveForUpdate(
            @Param("userId") Long userId,
            @Param("targetDeviceId") String targetDeviceId,
            @Param("now") Instant now
    );
}
