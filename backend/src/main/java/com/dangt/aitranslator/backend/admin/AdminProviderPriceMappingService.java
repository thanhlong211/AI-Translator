package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.payment.PaymentProvider;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AdminProviderPriceMappingService {

    private final JdbcTemplate jdbcTemplate;
    private final AdminAuditService auditService;

    public AdminProviderPriceMappingService(
            JdbcTemplate jdbcTemplate,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminProviderPriceMappingResponse> listMappings(
            long priceId
    ) {
        requirePrice(priceId);

        return jdbcTemplate.query(
                """
                SELECT id,
                       price_id,
                       provider,
                       provider_product_id,
                       provider_price_id,
                       active
                FROM payment_provider_prices
                WHERE price_id = ?
                ORDER BY provider
                """,
                (rs, rowNum) ->
                        new AdminProviderPriceMappingResponse(
                                rs.getLong("id"),
                                rs.getLong("price_id"),
                                rs.getString("provider"),
                                rs.getString("provider_product_id"),
                                rs.getString("provider_price_id"),
                                rs.getBoolean("active")
                        ),
                priceId
        );
    }

    @Transactional
    public AdminProviderPriceMappingResponse upsertMapping(
            UserAccount actor,
            long priceId,
            String requestedProvider,
            AdminProviderPriceMappingUpdateRequest request
    ) {
        if (request == null) {
            throw new IllegalArgumentException(
                    "Provider price mapping không hợp lệ."
            );
        }

        PaymentProvider provider =
                PaymentProvider.from(requestedProvider);

        if (provider == PaymentProvider.MANUAL) {
            throw new IllegalArgumentException(
                    "MANUAL không sử dụng provider price mapping."
            );
        }

        String providerProductId =
                cleanOptional(request.providerProductId());

        String providerPriceId =
                cleanRequired(
                        request.providerPriceId(),
                        "Provider price ID không được để trống."
                );

        if (request.active() == null) {
            throw new IllegalArgumentException(
                    "Trạng thái active là bắt buộc."
            );
        }

        boolean active = request.active();

        String reason =
                cleanRequired(
                        request.reason(),
                        "Cần nhập lý do thay đổi mapping."
                );

        requirePrice(priceId);

        List<Long> conflicts =
                jdbcTemplate.queryForList(
                        """
                        SELECT price_id
                        FROM payment_provider_prices
                        WHERE provider = ?
                          AND provider_price_id = ?
                          AND price_id <> ?
                        LIMIT 1
                        """,
                        Long.class,
                        provider.dbValue(),
                        providerPriceId,
                        priceId
                );

        if (!conflicts.isEmpty()) {
            throw new ConflictException(
                    "Provider price ID đã được map với price #"
                            + conflicts.getFirst()
                            + "."
            );
        }

        List<Long> existingIds =
                jdbcTemplate.queryForList(
                        """
                        SELECT id
                        FROM payment_provider_prices
                        WHERE price_id = ?
                          AND provider = ?
                        LIMIT 1
                        """,
                        Long.class,
                        priceId,
                        provider.dbValue()
                );

        long mappingId;
        String action;

        if (existingIds.isEmpty()) {
            jdbcTemplate.update(
                    """
                    INSERT INTO payment_provider_prices (
                        price_id,
                        provider,
                        provider_product_id,
                        provider_price_id,
                        active,
                        created_at,
                        updated_at
                    ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                    """,
                    priceId,
                    provider.dbValue(),
                    providerProductId,
                    providerPriceId,
                    active
            );

            Long insertedId =
                    jdbcTemplate.queryForObject(
                            "SELECT LAST_INSERT_ID()",
                            Long.class
                    );

            if (insertedId == null || insertedId <= 0) {
                throw new IllegalStateException(
                        "Không xác định được provider mapping vừa tạo."
                );
            }

            mappingId = insertedId;
            action = "PAYMENT_PROVIDER_PRICE_MAPPING_CREATED";
        } else {
            mappingId = existingIds.getFirst();

            int updated =
                    jdbcTemplate.update(
                            """
                            UPDATE payment_provider_prices
                            SET provider_product_id = ?,
                                provider_price_id = ?,
                                active = ?,
                                updated_at = CURRENT_TIMESTAMP(6)
                            WHERE id = ?
                            """,
                            providerProductId,
                            providerPriceId,
                            active,
                            mappingId
                    );

            if (updated != 1) {
                throw new IllegalStateException(
                        "Không cập nhật được provider price mapping."
                );
            }

            action = "PAYMENT_PROVIDER_PRICE_MAPPING_UPDATED";
        }

        auditService.record(
                actor.getId(),
                action,
                null,
                "mappingId=" + mappingId
                        + "; priceId=" + priceId
                        + "; provider=" + provider.dbValue()
                        + "; providerPriceId=" + providerPriceId
                        + "; active=" + active
                        + "; reason=" + reason
        );

        return new AdminProviderPriceMappingResponse(
                mappingId,
                priceId,
                provider.dbValue(),
                providerProductId,
                providerPriceId,
                active
        );
    }

    private void requirePrice(long priceId) {
        if (priceId <= 0) {
            throw new IllegalArgumentException(
                    "Price ID không hợp lệ."
            );
        }

        Integer count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM plan_prices
                        WHERE id = ?
                        """,
                        Integer.class,
                        priceId
                );

        if (count == null || count == 0) {
            throw new IllegalArgumentException(
                    "Không tìm thấy cấu hình giá."
            );
        }
    }

    private static String cleanRequired(
            String value,
            String message
    ) {
        String clean =
                String.valueOf(
                                value == null
                                        ? ""
                                        : value
                        )
                        .trim();

        if (clean.isEmpty()) {
            throw new IllegalArgumentException(message);
        }

        return clean;
    }

    private static String cleanOptional(
            String value
    ) {
        if (value == null) {
            return null;
        }

        String clean = value.trim();
        return clean.isEmpty() ? null : clean;
    }
}
