package com.dangt.aitranslator.backend.session;

import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "auth_sessions")
public class AuthSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "device_id", nullable = false, length = 100)
    private String deviceId;

    @Column(name = "device_name", nullable = false, length = 190)
    private String deviceName;

    @Column(name = "refresh_token_hash", nullable = false, unique = true, length = 64)
    private String refreshTokenHash;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "last_used_at")
    private Instant lastUsedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected AuthSession() {
    }

    public AuthSession(
            UserAccount user,
            String deviceId,
            String deviceName,
            String refreshTokenHash,
            Instant expiresAt
    ) {
        this.user = user;
        this.deviceId = deviceId;
        this.deviceName = deviceName;
        this.refreshTokenHash = refreshTokenHash;
        this.expiresAt = expiresAt;
        this.createdAt = Instant.now();
        this.lastUsedAt = this.createdAt;
    }

    public Long getId() { return id; }
    public UserAccount getUser() { return user; }
    public String getDeviceId() { return deviceId; }
    public String getDeviceName() { return deviceName; }
    public String getRefreshTokenHash() { return refreshTokenHash; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getRevokedAt() { return revokedAt; }
    public Instant getLastUsedAt() { return lastUsedAt; }
    public Instant getCreatedAt() { return createdAt; }

    public boolean isActive(Instant now) {
        return revokedAt == null && expiresAt.isAfter(now);
    }

    public void rotateRefreshToken(
            String newHash,
            Instant newExpiresAt,
            Instant now
    ) {
        this.refreshTokenHash = newHash;
        this.expiresAt = newExpiresAt;
        this.lastUsedAt = now;
    }

    public void revoke(Instant now) {
        if (this.revokedAt == null) {
            this.revokedAt = now;
        }
    }
}
