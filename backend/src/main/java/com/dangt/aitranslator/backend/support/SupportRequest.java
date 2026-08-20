package com.dangt.aitranslator.backend.support;

public class SupportRequest {
    private String hardwareId;
    private String contactEmail;
    private String reason;

    public String getHardwareId() { return hardwareId; }
    public void setHardwareId(String hardwareId) { this.hardwareId = hardwareId; }
    public String getContactEmail() { return contactEmail; }
    public void setContactEmail(String contactEmail) { this.contactEmail = contactEmail; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
