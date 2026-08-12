package com.dangt.aitranslator.backend.profile;

public record SetDefaultProfileResponse(
        boolean success,
        Long profileId
) {
}
