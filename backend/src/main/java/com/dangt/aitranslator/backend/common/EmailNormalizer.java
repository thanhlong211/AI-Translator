package com.dangt.aitranslator.backend.common;

import java.text.Normalizer;
import java.util.Locale;

/**
 * Canonicalizes user email addresses before persistence and lookup.
 * Removes invisible Unicode format characters (for example zero-width space/BOM)
 * that can make two visually identical addresses compare as different strings.
 */
public final class EmailNormalizer {

    private EmailNormalizer() {
    }

    public static String normalize(String value) {
        String input = String.valueOf(value == null ? "" : value);
        String normalized = Normalizer.normalize(input, Normalizer.Form.NFKC);

        StringBuilder visible = new StringBuilder(normalized.length());
        normalized.codePoints().forEach(codePoint -> {
            int type = Character.getType(codePoint);
            if (type != Character.FORMAT) {
                visible.appendCodePoint(codePoint);
            }
        });

        return stripEdgeSpacing(visible.toString())
                .toLowerCase(Locale.ROOT);
    }

    private static String stripEdgeSpacing(String value) {
        int start = 0;
        int end = value.length();

        while (start < end) {
            int codePoint = value.codePointAt(start);
            if (!isEdgeNoise(codePoint)) {
                break;
            }
            start += Character.charCount(codePoint);
        }

        while (end > start) {
            int codePoint = value.codePointBefore(end);
            if (!isEdgeNoise(codePoint)) {
                break;
            }
            end -= Character.charCount(codePoint);
        }

        return value.substring(start, end);
    }

    private static boolean isEdgeNoise(int codePoint) {
        int type = Character.getType(codePoint);
        return Character.isWhitespace(codePoint)
                || Character.isSpaceChar(codePoint)
                || type == Character.CONTROL
                || type == Character.FORMAT;
    }
}
