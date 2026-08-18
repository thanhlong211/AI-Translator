package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AdminProviderPriceMappingServiceTest {

    @Mock
    private JdbcTemplate jdbcTemplate;

    @Mock
    private AdminAuditService auditService;

    private AdminProviderPriceMappingService service;
    private UserAccount actor;

    @BeforeEach
    void setUp() {
        service =
                new AdminProviderPriceMappingService(
                        jdbcTemplate,
                        auditService
                );

        actor = mock(UserAccount.class);
    }

    @Test
    void createsLemonSqueezyMapping() {
        when(actor.getId()).thenReturn(99L);
        when(jdbcTemplate.queryForObject(
                anyString(),
                eq(Integer.class),
                eq(7L)
        )).thenReturn(1);

        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                eq("LEMON_SQUEEZY"),
                eq("2031752"),
                eq(7L)
        )).thenReturn(List.of());

        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                eq(7L),
                eq("LEMON_SQUEEZY")
        )).thenReturn(List.of());

        when(jdbcTemplate.queryForObject(
                eq("SELECT LAST_INSERT_ID()"),
                eq(Long.class)
        )).thenReturn(12L);

        AdminProviderPriceMappingResponse result =
                service.upsertMapping(
                        actor,
                        7L,
                        "lemon_squeezy",
                        new AdminProviderPriceMappingUpdateRequest(
                                null,
                                "2031752",
                                true,
                                "Test mapping"
                        )
                );

        assertThat(result.id()).isEqualTo(12L);
        assertThat(result.priceId()).isEqualTo(7L);
        assertThat(result.provider())
                .isEqualTo("LEMON_SQUEEZY");
        assertThat(result.providerPriceId())
                .isEqualTo("2031752");
        assertThat(result.active()).isTrue();

        verify(auditService).record(
                eq(99L),
                eq("PAYMENT_PROVIDER_PRICE_MAPPING_CREATED"),
                isNull(),
                contains("priceId=7")
        );
    }

    @Test
    void rejectsProviderPriceMappedToAnotherPrice() {
        when(jdbcTemplate.queryForObject(
                anyString(),
                eq(Integer.class),
                eq(7L)
        )).thenReturn(1);

        when(jdbcTemplate.queryForList(
                anyString(),
                eq(Long.class),
                eq("LEMON_SQUEEZY"),
                eq("2031752"),
                eq(7L)
        )).thenReturn(List.of(8L));

        assertThatThrownBy(() ->
                service.upsertMapping(
                        actor,
                        7L,
                        "LEMON_SQUEEZY",
                        new AdminProviderPriceMappingUpdateRequest(
                                null,
                                "2031752",
                                true,
                                "Duplicate test"
                        )
                )
        )
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("price #8");

        verifyNoInteractions(auditService);
    }
}
