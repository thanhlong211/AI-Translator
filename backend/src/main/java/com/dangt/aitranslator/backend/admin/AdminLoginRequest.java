package com.dangt.aitranslator.backend.admin;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AdminLoginRequest(
        @NotBlank(message = "Email không được để trống.")
        @Email(message = "Email không hợp lệ.")
        @Size(max = 190, message = "Email quá dài.")
        String email,

        @NotBlank(message = "Mật khẩu không được để trống.")
        @Size(max = 200, message = "Mật khẩu quá dài.")
        String password
) {
}
