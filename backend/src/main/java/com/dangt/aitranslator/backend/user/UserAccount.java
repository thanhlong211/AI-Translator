package com.dangt.aitranslator.backend.user;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 190)
    private String email;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 30)
    private String status;

    @Column(nullable = false, length = 30)
    private String role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "bound_device_id", length = 100)
    private String boundDeviceId;

    @Column(name = "bound_device_name", length = 190)
    private String boundDeviceName;

    @Column(name = "device_bound_at")
    private Instant deviceBoundAt;

    protected UserAccount() {
    }

    public UserAccount(String email, String passwordHash) {
        this.email = email;
        this.passwordHash = passwordHash;
        this.status = "ACTIVE";
        this.role = "USER";
        this.createdAt = Instant.now();
        this.updatedAt = this.createdAt;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public String getStatus() { return status; }
    public String getRole() { return role; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public String getBoundDeviceId() { return boundDeviceId; }
    public String getBoundDeviceName() { return boundDeviceName; }
    public Instant getDeviceBoundAt() { return deviceBoundAt; }

    public void bindDevice(
            String deviceId,
            String deviceName,
            Instant now
    ) {
        this.boundDeviceId = deviceId;
        this.boundDeviceName = deviceName;
        this.deviceBoundAt = now;
        this.updatedAt = now;
    }

    public void clearDeviceBinding(Instant now) {
        this.boundDeviceId = null;
        this.boundDeviceName = null;
        this.deviceBoundAt = null;
        this.updatedAt = now;
    }
}
