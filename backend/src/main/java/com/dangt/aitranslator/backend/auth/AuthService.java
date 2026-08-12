package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.common.UnauthorizedException;
import com.dangt.aitranslator.backend.session.RefreshTokenService;
import com.dangt.aitranslator.backend.user.UserAccount;
import com.dangt.aitranslator.backend.user.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            RefreshTokenService refreshTokenService
    ) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String email = normalizeEmail(request.email());

        if (userRepository.existsByEmail(email)) {
            throw new ConflictException("Email này đã được đăng ký.");
        }

        UserAccount user = new UserAccount(
                email,
                passwordEncoder.encode(request.password())
        );

        try {
            user = userRepository.saveAndFlush(user);
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Email này đã được đăng ký.");
        }

        return createSessionResponse(
                user,
                request.deviceId(),
                request.deviceName()
        );
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());

        UserAccount user = userRepository
                .findByEmail(email)
                .orElseThrow(() ->
                        new UnauthorizedException("Email hoặc mật khẩu không đúng.")
                );

        requireActiveUser(user);

        if (user.getPasswordHash() == null ||
                !passwordEncoder.matches(
                        request.password(),
                        user.getPasswordHash()
                )) {
            throw new UnauthorizedException(
                    "Email hoặc mật khẩu không đúng."
            );
        }

        return createSessionResponse(
                user,
                request.deviceId(),
                request.deviceName()
        );
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        RefreshTokenService.RotatedSession rotated =
                refreshTokenService.rotate(
                        request.refreshToken()
                );

        JwtService.IssuedToken access =
                jwtService.issueAccessToken(
                        rotated.user(),
                        rotated.sessionId()
                );

        return AuthResponse.success(
                access,
                rotated.refreshToken(),
                UserSummary.from(rotated.user())
        );
    }

    @Transactional
    public LogoutResponse logout(LogoutRequest request) {
        refreshTokenService.revokeByRefreshToken(
                request.refreshToken()
        );

        return new LogoutResponse(true);
    }

    private AuthResponse createSessionResponse(
            UserAccount user,
            String deviceId,
            String deviceName
    ) {
        requireActiveUser(user);

        RefreshTokenService.IssuedRefreshToken refresh =
                refreshTokenService.createSession(
                        user,
                        deviceId,
                        deviceName
                );

        JwtService.IssuedToken access =
                jwtService.issueAccessToken(
                        user,
                        refresh.sessionId()
                );

        return AuthResponse.success(
                access,
                refresh,
                UserSummary.from(user)
        );
    }

    private void requireActiveUser(UserAccount user) {
        if (!"ACTIVE".equals(user.getStatus())) {
            throw new ForbiddenException(
                    "Tài khoản hiện không hoạt động."
            );
        }
    }

    private String normalizeEmail(String email) {
        return email
                .trim()
                .toLowerCase(Locale.ROOT);
    }
}
