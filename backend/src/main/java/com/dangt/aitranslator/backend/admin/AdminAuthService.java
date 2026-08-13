package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.auth.JwtService;
import com.dangt.aitranslator.backend.auth.UserSummary;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.common.UnauthorizedException;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AdminAuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;

    public AdminAuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AdminGuard adminGuard,
            AdminAuditService auditService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
    }

    @Transactional
    public AdminLoginResponse login(AdminLoginRequest request) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);

        UserAccount user = userRepository
                .findByEmail(email)
                .orElseThrow(() -> new UnauthorizedException(
                        "Email hoặc mật khẩu Admin không đúng."
                ));

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ForbiddenException("Tài khoản Admin hiện không hoạt động.");
        }

        if (!adminGuard.isAdminRole(user.getRole())) {
            throw new ForbiddenException("Tài khoản không có quyền Admin.");
        }

        if (user.getPasswordHash() == null ||
                !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Email hoặc mật khẩu Admin không đúng.");
        }

        JwtService.IssuedToken access =
                jwtService.issueAdminAccessToken(user);

        auditService.record(
                user.getId(),
                "ADMIN_LOGIN",
                user.getId(),
                "Đăng nhập Admin Console."
        );

        return new AdminLoginResponse(
                true,
                access.value(),
                "Bearer",
                access.expiresInSeconds(),
                UserSummary.from(user)
        );
    }
}
