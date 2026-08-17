package com.dangt.aitranslator.backend.auth.device;

import com.dangt.aitranslator.backend.auth.AuthResponse;
import com.dangt.aitranslator.backend.common.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth/device-transfer")
public class DeviceTransferController {

    private final DeviceTransferService
            deviceTransferService;

    public DeviceTransferController(
            DeviceTransferService deviceTransferService
    ) {
        this.deviceTransferService =
                deviceTransferService;
    }

    @PostMapping("/request")
    public DeviceTransferRequestResponse
    requestTransfer(
            @Valid
            @RequestBody
            DeviceTransferRequest request,

            HttpServletRequest httpRequest
    ) {
        return deviceTransferService
                .requestTransfer(
                        request,
                        clientIp(
                                httpRequest
                        )
                );
    }

    @PostMapping("/confirm")
    public AuthResponse confirmTransfer(
            @Valid
            @RequestBody
            DeviceTransferConfirmRequest request
    ) {
        return deviceTransferService
                .confirmTransfer(
                        request
                );
    }

    @ExceptionHandler(
            DeviceTransferVerificationException.class
    )
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiError handleVerification(
            DeviceTransferVerificationException ex
    ) {
        return ApiError.of(
                ex.getCode(),
                HttpStatus.BAD_REQUEST,
                ex.getMessage()
        );
    }

    private String clientIp(
            HttpServletRequest request
    ) {
        String forwarded =
                request.getHeader(
                        "X-Forwarded-For"
                );

        if (
                forwarded != null
                && !forwarded.isBlank()
        ) {
            String first =
                    forwarded
                            .split(
                                    ",",
                                    2
                            )[0]
                            .trim();

            if (!first.isBlank()) {
                return first;
            }
        }

        return request
                .getRemoteAddr();
    }
}
