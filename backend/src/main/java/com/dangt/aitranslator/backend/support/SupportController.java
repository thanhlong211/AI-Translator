package com.dangt.aitranslator.backend.support;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/support")
public class SupportController {

    @PostMapping("/device-unbind")
    public ResponseEntity<?> requestDeviceUnbind(@RequestBody SupportRequest request) {
        // Luồng gửi mail cảnh báo tới Admin qua Resend
        System.out.println("Yêu cầu gỡ thiết bị từ email: " + request.getContactEmail() + " cho HWID: " + request.getHardwareId());
        return ResponseEntity.ok().build();
    }
}
