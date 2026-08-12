package com.dangt.aitranslator.backend.profile;

import com.dangt.aitranslator.backend.common.ConflictException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProfileService {

    private final TranslationProfileRepository repository;

    public ProfileService(
            TranslationProfileRepository repository
    ) {
        this.repository = repository;
    }

    @Transactional
    public List<ProfileResponse> list(Long userId) {
        getOrCreateDefault(userId);

        return repository
                .findAllByUserIdOrderByDefaultProfileDescNameAsc(
                        userId
                )
                .stream()
                .map(ProfileResponse::from)
                .toList();
    }

    @Transactional
    public ProfileResponse get(
            Long userId,
            Long profileId
    ) {
        return ProfileResponse.from(
                requireOwnedProfile(
                        userId,
                        profileId
                )
        );
    }

    @Transactional
    public ProfileResponse create(
            Long userId,
            ProfileUpsertRequest request
    ) {
        String name =
                normalizeName(
                        request.name()
                );

        repository
                .findByUserIdAndNameIgnoreCase(
                        userId,
                        name
                )
                .ifPresent(existing -> {
                    throw new ConflictException(
                            "Bạn đã có profile tên này."
                    );
                });

        boolean makeDefault =
                repository
                        .findAllByUserIdOrderByDefaultProfileDescNameAsc(
                                userId
                        )
                        .isEmpty();

        TranslationProfile profile =
                new TranslationProfile(
                        userId,
                        name,
                        request.style(),
                        request.contextLines(),
                        request.keepHonorifics(),
                        normalizeInstruction(
                                request.customInstruction()
                        ),
                        makeDefault
                );

        profile.replaceCharacters(
                request.characters()
        );

        profile.replaceGlossary(
                request.glossary()
        );

        return ProfileResponse.from(
                repository.saveAndFlush(
                        profile
                )
        );
    }

    @Transactional
    public ProfileResponse update(
            Long userId,
            Long profileId,
            ProfileUpsertRequest request
    ) {
        TranslationProfile profile =
                requireOwnedProfile(
                        userId,
                        profileId
                );

        String name =
                normalizeName(
                        request.name()
                );

        repository
                .findByUserIdAndNameIgnoreCase(
                        userId,
                        name
                )
                .filter(existing ->
                        !existing
                                .getId()
                                .equals(profileId)
                )
                .ifPresent(existing -> {
                    throw new ConflictException(
                            "Bạn đã có profile tên này."
                    );
                });

        profile.update(
                name,
                request.style(),
                request.contextLines(),
                request.keepHonorifics(),
                normalizeInstruction(
                        request.customInstruction()
                )
        );

        profile.replaceCharacters(
                request.characters()
        );

        profile.replaceGlossary(
                request.glossary()
        );

        return ProfileResponse.from(
                repository.saveAndFlush(
                        profile
                )
        );
    }

    @Transactional
    public void delete(
            Long userId,
            Long profileId
    ) {
        TranslationProfile profile =
                requireOwnedProfile(
                        userId,
                        profileId
                );

        if (profile.isDefaultProfile()) {
            throw new IllegalArgumentException(
                    "Không thể xóa profile mặc định. Hãy chọn profile mặc định khác trước."
            );
        }

        repository.delete(profile);
    }

    @Transactional
    public SetDefaultProfileResponse setDefault(
            Long userId,
            Long profileId
    ) {
        TranslationProfile selected =
                requireOwnedProfile(
                        userId,
                        profileId
                );

        List<TranslationProfile> profiles =
                repository
                        .findAllByUserIdOrderByDefaultProfileDescNameAsc(
                                userId
                        );

        for (TranslationProfile profile : profiles) {
            profile.markDefault(
                    profile
                            .getId()
                            .equals(
                                    selected.getId()
                            )
            );
        }

        repository.saveAll(profiles);

        return new SetDefaultProfileResponse(
                true,
                selected.getId()
        );
    }

    @Transactional
    public TranslationProfile resolveProfile(
            Long userId,
            Long profileId
    ) {
        TranslationProfile profile;

        if (profileId != null) {
            profile = requireOwnedProfile(
                    userId,
                    profileId
            );
        } else {
            profile = getOrCreateDefault(
                    userId
            );
        }

        initializePromptCollections(
                profile
        );

        return profile;
    }

    /**
     * TranslationService gọi OpenAI sau khi method này return.
     * Vì vậy transaction/JPA session đã đóng tại thời điểm PromptBuilder
     * đọc characters/glossary.
     *
     * Chủ động materialize hai LAZY collections ngay trong transaction,
     * thay vì đổi mapping sang EAGER hoặc giữ DB transaction mở trong
     * suốt network call đến OpenAI.
     */
    private void initializePromptCollections(
            TranslationProfile profile
    ) {
        profile.getCharacters()
                .forEach(character -> {
                    character.getName();
                    character.getAliasesText();
                    character.getRule();
                });

        profile.getGlossary()
                .forEach(entry -> {
                    entry.getSourceLanguage();
                    entry.getTargetLanguage();
                    entry.getSource();
                    entry.getTarget();
                    entry.getNote();
                });
    }

    @Transactional
    public TranslationProfile getOrCreateDefault(
            Long userId
    ) {
        return repository
                .findByUserIdAndDefaultProfileTrue(
                        userId
                )
                .orElseGet(() ->
                        createDefaultEntity(
                                userId
                        )
                );
    }

    private TranslationProfile createDefaultEntity(
            Long userId
    ) {
        TranslationProfile profile =
                new TranslationProfile(
                        userId,
                        "Default",
                        TranslationStyle.MANGA,
                        5,
                        true,
                        "Ưu tiên hội thoại tự nhiên, ngắn gọn và phù hợp manga/anime.",
                        true
                );

        return repository.saveAndFlush(
                profile
        );
    }

    private TranslationProfile requireOwnedProfile(
            Long userId,
            Long profileId
    ) {
        if (profileId == null) {
            throw new IllegalArgumentException(
                    "profileId không hợp lệ."
            );
        }

        return repository
                .findByIdAndUserId(
                        profileId,
                        userId
                )
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Không tìm thấy Translation Profile."
                        )
                );
    }

    private String normalizeName(String value) {
        String clean =
                value == null
                        ? ""
                        : value.trim();

        if (clean.isBlank()) {
            throw new IllegalArgumentException(
                    "Tên profile không được để trống."
            );
        }

        return clean;
    }

    private String normalizeInstruction(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();

        return clean.isBlank()
                ? null
                : clean;
    }
}
