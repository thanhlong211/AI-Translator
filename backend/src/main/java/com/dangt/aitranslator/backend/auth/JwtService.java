package com.dangt.aitranslator.backend.auth;

import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final String issuer;
    private final Duration accessTokenLifetime;

    public JwtService(
            JwtEncoder jwtEncoder,
            @Value("${app.jwt.issuer}") String issuer,
            @Value("${app.jwt.access-token-minutes:15}") long accessTokenMinutes
    ) {
        this.jwtEncoder = jwtEncoder;
        this.issuer = issuer;
        this.accessTokenLifetime =
                Duration.ofMinutes(accessTokenMinutes);
    }

    public IssuedToken issueAccessToken(
            UserAccount user,
            Long sessionId
    ) {
        Instant now = Instant.now();
        Instant expiresAt =
                now.plus(accessTokenLifetime);

        JwtClaimsSet.Builder builder =
                JwtClaimsSet.builder()
                        .issuer(issuer)
                        .issuedAt(now)
                        .expiresAt(expiresAt)
                        .subject(
                                String.valueOf(user.getId())
                        )
                        .claim("email", user.getEmail())
                        .claim("role", user.getRole());

        if (sessionId != null) {
            builder.claim("sid", sessionId);
        }

        JwtClaimsSet claims = builder.build();

        String token =
                jwtEncoder
                        .encode(
                                JwtEncoderParameters.from(claims)
                        )
                        .getTokenValue();

        return new IssuedToken(
                token,
                accessTokenLifetime.toSeconds()
        );
    }

    public IssuedToken issueAdminAccessToken(UserAccount user) {
        return issueAccessToken(user, null);
    }

    public record IssuedToken(
            String value,
            long expiresInSeconds
    ) {
    }
}
