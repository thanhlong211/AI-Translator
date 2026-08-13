package com.dangt.aitranslator.backend.admin;

import java.util.List;

public record AdminUserPageResponse(
        List<AdminUserRow> items,
        int page,
        int size,
        long total
) {
}
