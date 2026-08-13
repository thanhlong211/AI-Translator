package com.dangt.aitranslator.backend.social;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/account/identities")
public class AccountIdentityController {

    private final CurrentUserService currentUserService;
    private final SocialAuthService socialAuthService;

    public AccountIdentityController(
            CurrentUserService currentUserService,
            SocialAuthService socialAuthService
    ) {
        this.currentUserService = currentUserService;
        this.socialAuthService = socialAuthService;
    }

    @GetMapping
    public List<SocialIdentityResponse> list(
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user = currentUserService.requireActiveUser(jwt);
        return socialAuthService.listIdentities(user.getId());
    }

    @PostMapping("/{provider}/link/start")
    public SocialAuthStartResponse startLink(
            @PathVariable String provider,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user = currentUserService.requireActiveUser(jwt);
        return socialAuthService.startLink(
                SocialAuthProvider.fromPath(provider),
                user
        );
    }
}
