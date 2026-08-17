package com.dangt.aitranslator.backend.auth.device;

public record DeviceTransferRequestResponse(
        boolean accepted,
        String message
) {
}
