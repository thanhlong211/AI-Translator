package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.common.UnauthorizedException;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CurrentUserService {

    private final UserRepository userRepository;

    public CurrentUserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public UserAccount requireActiveUser(Jwt jwt) {
        long userId;
        try {
            userId = Long.parseLong(jwt.getSubject());
        } catch (Exception ex) {
            throw new UnauthorizedException("Token không chứa user hợp lệ.");
        }

        UserAccount user = userRepository
                .findById(userId)
                .orElseThrow(() -> new UnauthorizedException("Không tìm thấy tài khoản."));

        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ForbiddenException("Tài khoản hiện không hoạt động.");
        }

        return user;
    }
}
