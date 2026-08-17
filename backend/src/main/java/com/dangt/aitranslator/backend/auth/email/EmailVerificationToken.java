package com.dangt.aitranslator.backend.auth.email;

import com.dangt.aitranslator.backend.user.UserAccount;
import jakarta.persistence.*;

import java.time.Instant;

@Entity
@Table(name = "email_verification_tokens")
public class EmailVerificationToken {

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

    protected EmailVerificationToken() {
    }

    public EmailVerificationToken(
            UserAccount user,
            String codeHash,
            Instant expiresAt,
            String requestedIp,
            Instant createdAt
    ) {
        this.user = user;
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
