package com.dangt.aitranslator.backend.auth.device;

import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "device_transfer_tokens")
public class DeviceTransferToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(
            fetch = FetchType.LAZY,
            optional = false
    )
    @JoinColumn(
            name = "user_id",
            nullable = false
    )
    private UserAccount user;

    @Column(
            name = "target_device_id",
            nullable = false,
            length = 100
    )
    private String targetDeviceId;

    @Column(
            name = "target_device_name",
            nullable = false,
            length = 190
    )
    private String targetDeviceName;

    @Column(
            name = "code_hash",
            nullable = false,
            length = 100
    )
    private String codeHash;

    @Column(
            name = "expires_at",
            nullable = false
    )
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(
            name = "failed_attempts",
            nullable = false
    )
    private int failedAttempts;

    @Column(
            name = "requested_ip",
            length = 64
    )
    private String requestedIp;

    @Column(
            name = "created_at",
            nullable = false
    )
    private Instant createdAt;

    protected DeviceTransferToken() {
    }

    public DeviceTransferToken(
            UserAccount user,
            String targetDeviceId,
            String targetDeviceName,
            String codeHash,
            Instant expiresAt,
            String requestedIp,
            Instant createdAt
    ) {
        this.user = user;
        this.targetDeviceId = targetDeviceId;
        this.targetDeviceName = targetDeviceName;
        this.codeHash = codeHash;
        this.expiresAt = expiresAt;
        this.requestedIp = requestedIp;
        this.createdAt = createdAt;
        this.failedAttempts = 0;
    }

    public Long getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public String getTargetDeviceId() {
        return targetDeviceId;
    }

    public String getTargetDeviceName() {
        return targetDeviceName;
    }

    public String getCodeHash() {
        return codeHash;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public int getFailedAttempts() {
        return failedAttempts;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public boolean isUsable(
            Instant now,
            int maxAttempts
    ) {
        return usedAt == null
                && expiresAt.isAfter(now)
                && failedAttempts < maxAttempts;
    }

    public void recordFailedAttempt(
            Instant now,
            int maxAttempts
    ) {
        failedAttempts++;

        if (failedAttempts >= maxAttempts) {
            usedAt = now;
        }
    }

    public void consume(Instant now) {
        usedAt = now;
    }
}
