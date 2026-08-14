package com.dangt.aitranslator.backend.entitlement;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DailyQuotaServiceTest {

    @Test
    void reservesWhenDailyLimitHasRoom() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(
                anyString(),
                eq(Long.class),
                any(),
                any(),
                any()
        )).thenReturn(4L);

        DailyQuotaService service = new DailyQuotaService(jdbc);
        boolean reserved = service.reserve(7L, "MANGA_PAGE", 5L, 1L);

        assertThat(reserved).isTrue();
    }

    @Test
    void rejectsWhenDailyLimitIsExhausted() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(
                anyString(),
                eq(Long.class),
                any(),
                any(),
                any()
        )).thenReturn(5L);

        DailyQuotaService service = new DailyQuotaService(jdbc);
        boolean reserved = service.reserve(7L, "MANGA_PAGE", 5L, 1L);

        assertThat(reserved).isFalse();
    }
}
