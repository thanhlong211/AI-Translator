package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.auth.JwtService;
import com.dangt.aitranslator.backend.auth.UserSummary;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.common.EmailNormalizer;
import com.dangt.aitranslator.backend.common.UnauthorizedException;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;


@Service
public class AdminAuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;
    private final AdminSecurityEventService securityEventService;

    public AdminAuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AdminGuard adminGuard,
            AdminAuditService auditService,
            AdminSecurityEventService securityEventService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
        this.securityEventService = securityEventService;
    }

    @Transactional
    public AdminLoginResponse login(AdminLoginRequest request) {
        String email = EmailNormalizer.normalize(request.email());
        UserAccount user = userRepository.findByEmail(email).orElse(null);

        if (user == null) {
            securityEventService.recordLoginFailure(email, null, "UNKNOWN_ACCOUNT");
            throw new UnauthorizedException("Email hoặc mật khẩu Admin không đúng.");
        }

        if (!"ACTIVE".equals(user.getStatus())) {
            securityEventService.recordLoginFailure(email, user, "ACCOUNT_INACTIVE");
            throw new ForbiddenException("Tài khoản Admin hiện không hoạt động.");
        }

        if (!adminGuard.isAdminRole(user.getRole())) {
            securityEventService.recordLoginFailure(email, user, "NON_ADMIN_ROLE");
            throw new ForbiddenException("Tài khoản không có quyền Admin.");
        }

        if (user.getPasswordHash() == null ||
                !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            securityEventService.recordLoginFailure(email, user, "INVALID_PASSWORD");
            throw new UnauthorizedException("Email hoặc mật khẩu Admin không đúng.");
        }

        JwtService.IssuedToken access =
                jwtService.issueAdminAccessToken(user);

        securityEventService.recordLoginSuccess(user, email);

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
