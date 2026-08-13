package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class AdminGuard {

    private static final Set<String> ADMIN_ROLES =
            Set.of("ADMIN", "SUPER_ADMIN");

    private final CurrentUserService currentUserService;

    public AdminGuard(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    public UserAccount requireAdmin(Jwt jwt) {
        UserAccount user = currentUserService.requireActiveUser(jwt);
        if (!ADMIN_ROLES.contains(user.getRole())) {
            throw new ForbiddenException("Tài khoản không có quyền Admin.");
        }
        return user;
    }

    public boolean isAdminRole(String role) {
        return ADMIN_ROLES.contains(String.valueOf(role));
    }

    public boolean isSuperAdmin(UserAccount user) {
        return user != null && "SUPER_ADMIN".equals(user.getRole());
    }
}
