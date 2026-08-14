package com.dangt.aitranslator.backend.entitlement;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.time.LocalDate;
import java.time.ZoneOffset;

@Service
public class DailyQuotaService {

    private final JdbcTemplate jdbcTemplate;

    public DailyQuotaService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public boolean reserve(long userId, String quotaKey, long limit, long units) {
        if (userId <= 0 || units <= 0) {
            throw new IllegalArgumentException("Daily quota reservation không hợp lệ.");
        }
        if (limit < 0) {
            return true;
        }

        String key = normalizeKey(quotaKey);
        Date usageDate = Date.valueOf(LocalDate.now(ZoneOffset.UTC));

        jdbcTemplate.update(
                """
                INSERT INTO daily_usage_counters (user_id, usage_date, quota_key, used_units)
                VALUES (?, ?, ?, 0)
                ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP(6)
                """,
                userId, usageDate, key
        );

        Long current = jdbcTemplate.queryForObject(
                """
                SELECT used_units
                FROM daily_usage_counters
                WHERE user_id = ?
                  AND usage_date = ?
                  AND quota_key = ?
                FOR UPDATE
                """,
                Long.class,
                userId, usageDate, key
        );

        long used = current == null ? 0L : current;
        if (used + units > limit) {
            return false;
        }

        jdbcTemplate.update(
                """
                UPDATE daily_usage_counters
                SET used_units = used_units + ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND usage_date = ?
                  AND quota_key = ?
                """,
                units, userId, usageDate, key
        );

        return true;
    }

    @Transactional
    public void release(long userId, String quotaKey, long units) {
        if (userId <= 0 || units <= 0) {
            return;
        }
        String key = normalizeKey(quotaKey);
        Date usageDate = Date.valueOf(LocalDate.now(ZoneOffset.UTC));
        jdbcTemplate.update(
                """
                UPDATE daily_usage_counters
                SET used_units = GREATEST(used_units - ?, 0),
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE user_id = ?
                  AND usage_date = ?
                  AND quota_key = ?
                """,
                units, userId, usageDate, key
        );
    }

    @Transactional(readOnly = true)
    public long usedToday(long userId, String quotaKey) {
        String key = normalizeKey(quotaKey);
        Date usageDate = Date.valueOf(LocalDate.now(ZoneOffset.UTC));
        Long used = jdbcTemplate.queryForObject(
                """
                SELECT COALESCE(MAX(used_units), 0)
                FROM daily_usage_counters
                WHERE user_id = ?
                  AND usage_date = ?
                  AND quota_key = ?
                """,
                Long.class,
                userId, usageDate, key
        );
        return used == null ? 0L : used;
    }

    private static String normalizeKey(String value) {
        String key = String.valueOf(value == null ? "" : value).trim().toUpperCase();
        if (!key.matches("[A-Z][A-Z0-9_]{0,63}")) {
            throw new IllegalArgumentException("Daily quota key không hợp lệ.");
        }
        return key;
    }
}
