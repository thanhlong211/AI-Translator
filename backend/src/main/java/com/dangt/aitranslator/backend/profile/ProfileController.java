package com.dangt.aitranslator.backend.profile;

import com.dangt.aitranslator.backend.auth.CurrentUserService;
import com.dangt.aitranslator.backend.user.UserAccount;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/profiles")
@Tag(
        name = "Translation Profiles",
        description =
                "Prompt profile, Characters, Glossary và style dịch theo từng user."
)
@SecurityRequirement(name = "bearerAuth")
public class ProfileController {

    private final ProfileService profileService;
    private final CurrentUserService currentUserService;

    public ProfileController(
            ProfileService profileService,
            CurrentUserService currentUserService
    ) {
        this.profileService = profileService;
        this.currentUserService = currentUserService;
    }

    @Operation(
            summary =
                    "Danh sách Translation Profiles của user"
    )
    @GetMapping
    public List<ProfileResponse> list(
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return profileService.list(
                user.getId()
        );
    }

    @Operation(
            summary = "Chi tiết một Profile"
    )
    @GetMapping("/{profileId}")
    public ProfileResponse get(
            @PathVariable Long profileId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return profileService.get(
                user.getId(),
                profileId
        );
    }

    @Operation(
            summary = "Tạo Translation Profile"
    )
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProfileResponse create(
            @Valid
            @RequestBody
            ProfileUpsertRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return profileService.create(
                user.getId(),
                request
        );
    }

    @Operation(
            summary = "Cập nhật Profile"
    )
    @PutMapping("/{profileId}")
    public ProfileResponse update(
            @PathVariable Long profileId,

            @Valid
            @RequestBody
            ProfileUpsertRequest request,

            @AuthenticationPrincipal
            Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return profileService.update(
                user.getId(),
                profileId,
                request
        );
    }

    @Operation(
            summary = "Đặt Profile mặc định"
    )
    @PutMapping("/{profileId}/default")
    public SetDefaultProfileResponse setDefault(
            @PathVariable Long profileId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        return profileService.setDefault(
                user.getId(),
                profileId
        );
    }

    @Operation(
            summary = "Xóa Profile"
    )
    @DeleteMapping("/{profileId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long profileId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        UserAccount user =
                currentUserService
                        .requireActiveUser(jwt);

        profileService.delete(
                user.getId(),
                profileId
        );
    }
}
