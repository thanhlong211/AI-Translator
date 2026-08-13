package com.dangt.aitranslator.backend.admin;

import com.dangt.aitranslator.backend.common.ConflictException;
import com.dangt.aitranslator.backend.common.ForbiddenException;
import com.dangt.aitranslator.backend.user.UserAccount;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class AdminAiModelCostService {

    private final JdbcTemplate jdbcTemplate;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;

    public AdminAiModelCostService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminAiModelCostResponse> list(
            String requestedProvider,
            String requestedModel,
            Boolean active,
            int requestedLimit
    ) {
        String provider = normalizeOptionalProvider(requestedProvider);
        String model = cleanOptional(requestedModel, 120);
        int limit = Math.max(1, Math.min(requestedLimit, 500));

        StringBuilder sql = new StringBuilder(costSelectSql()).append(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (provider != null) {
            sql.append(" AND c.provider = ?");
            args.add(provider);
        }
        if (model != null) {
            sql.append(" AND c.model = ?");
            args.add(model);
        }
        if (active != null) {
            sql.append(" AND c.active = ?");
            args.add(active);
        }
        sql.append(" ORDER BY c.provider, c.model, c.currency, c.effective_from DESC, c.id DESC LIMIT ?");
        args.add(limit);

        return jdbcTemplate.query(
                sql.toString(),
                (rs, rowNum) -> mapCost(rs),
                args.toArray()
        );
    }

    @Transactional(readOnly = true)
    public AdminAiModelCostResponse detail(long costId) {
        return requireCost(costId);
    }

    @Transactional
    public AdminAiModelCostResponse create(
            UserAccount actor,
            AdminAiModelCostCreateRequest request
    ) {
        requireSuperAdmin(actor);
        String provider = normalizeProvider(request.provider());
        String model = normalizeModel(request.model());
        String currency = normalizeCurrency(request.currency());
        BigDecimal input = normalizeCost(request.inputCostPerMillion(), "Input cost");
        BigDecimal cached = normalizeCost(request.cachedInputCostPerMillion(), "Cached input cost");
        BigDecimal output = normalizeCost(request.outputCostPerMillion(), "Output cost");
        boolean active = request.active() == null || request.active();
        Instant effectiveFrom = parseOptionalInstant(request.effectiveFrom(), "Ngày bắt đầu hiệu lực");
        Instant effectiveTo = parseOptionalInstant(request.effectiveTo(), "Ngày kết thúc hiệu lực");
        String notes = cleanOptional(request.notes(), 500);
        String reason = cleanReason(request.reason());

        validateWindow(effectiveFrom, effectiveTo);
        requireNoActiveOverlap(null, provider, model, currency, active, effectiveFrom, effectiveTo);

        jdbcTemplate.update(
                """
                INSERT INTO ai_model_costs (
                    provider,
                    model,
                    currency,
                    input_cost_per_million,
                    cached_input_cost_per_million,
                    output_cost_per_million,
                    active,
                    effective_from,
                    effective_to,
                    notes,
                    created_by_user_id,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                provider,
                model,
                currency,
                input,
                cached,
                output,
                active,
                toTimestamp(effectiveFrom),
                toTimestamp(effectiveTo),
                notes,
                actor.getId()
        );

        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        if (id == null || id <= 0) {
            throw new IllegalStateException("Không xác định được ID model cost vừa tạo.");
        }

        auditService.record(
                actor.getId(),
                "AI_MODEL_COST_CREATED",
                null,
                "costId=" + id
                        + "; provider=" + provider
                        + "; model=" + model
                        + "; currency=" + currency
                        + "; inputPer1M=" + input.toPlainString()
                        + "; cachedPer1M=" + cached.toPlainString()
                        + "; outputPer1M=" + output.toPlainString()
                        + "; active=" + active
                        + "; reason=" + reason
        );

        return requireCost(id);
    }

    @Transactional
    public AdminAiModelCostResponse update(
            UserAccount actor,
            long costId,
            AdminAiModelCostUpdateRequest request
    ) {
        requireSuperAdmin(actor);
        AdminAiModelCostResponse before = requireCost(costId);
        String provider = normalizeProvider(request.provider());
        String model = normalizeModel(request.model());
        String currency = normalizeCurrency(request.currency());
        BigDecimal input = normalizeCost(request.inputCostPerMillion(), "Input cost");
        BigDecimal cached = normalizeCost(request.cachedInputCostPerMillion(), "Cached input cost");
        BigDecimal output = normalizeCost(request.outputCostPerMillion(), "Output cost");
        boolean active = request.active();
        Instant effectiveFrom = parseOptionalInstant(request.effectiveFrom(), "Ngày bắt đầu hiệu lực");
        Instant effectiveTo = parseOptionalInstant(request.effectiveTo(), "Ngày kết thúc hiệu lực");
        String notes = cleanOptional(request.notes(), 500);
        String reason = cleanReason(request.reason());

        validateWindow(effectiveFrom, effectiveTo);
        requireNoActiveOverlap(costId, provider, model, currency, active, effectiveFrom, effectiveTo);

        jdbcTemplate.update(
                """
                UPDATE ai_model_costs
                SET provider = ?,
                    model = ?,
                    currency = ?,
                    input_cost_per_million = ?,
                    cached_input_cost_per_million = ?,
                    output_cost_per_million = ?,
                    active = ?,
                    effective_from = ?,
                    effective_to = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                provider,
                model,
                currency,
                input,
                cached,
                output,
                active,
                toTimestamp(effectiveFrom),
                toTimestamp(effectiveTo),
                notes,
                costId
        );

        auditService.record(
                actor.getId(),
                "AI_MODEL_COST_UPDATED",
                null,
                "costId=" + costId
                        + "; provider=" + before.provider() + "->" + provider
                        + "; model=" + before.model() + "->" + model
                        + "; currency=" + before.currency() + "->" + currency
                        + "; inputPer1M=" + before.inputCostPerMillion().toPlainString() + "->" + input.toPlainString()
                        + "; cachedPer1M=" + before.cachedInputCostPerMillion().toPlainString() + "->" + cached.toPlainString()
                        + "; outputPer1M=" + before.outputCostPerMillion().toPlainString() + "->" + output.toPlainString()
                        + "; active=" + before.active() + "->" + active
                        + "; reason=" + reason
        );

        return requireCost(costId);
    }

    private AdminAiModelCostResponse requireCost(long costId) {
        List<AdminAiModelCostResponse> rows = jdbcTemplate.query(
                costSelectSql() + " WHERE c.id = ? LIMIT 1",
                (rs, rowNum) -> mapCost(rs),
                costId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Không tìm thấy AI model cost configuration.");
        }
        return rows.getFirst();
    }

    private void requireNoActiveOverlap(
            Long excludedId,
            String provider,
            String model,
            String currency,
            boolean active,
            Instant effectiveFrom,
            Instant effectiveTo
    ) {
        if (!active) {
            return;
        }

        String sql = """
                SELECT id, effective_from, effective_to
                FROM ai_model_costs
                WHERE provider = ?
                  AND model = ?
                  AND currency = ?
                  AND active = TRUE
                """;

        List<CostWindow> windows;
        if (excludedId == null) {
            windows = jdbcTemplate.query(
                    sql,
                    (rs, rowNum) -> new CostWindow(
                            rs.getLong("id"),
                            toInstant(rs.getTimestamp("effective_from")),
                            toInstant(rs.getTimestamp("effective_to"))
                    ),
                    provider,
                    model,
                    currency
            );
        } else {
            windows = jdbcTemplate.query(
                    sql + " AND id <> ?",
                    (rs, rowNum) -> new CostWindow(
                            rs.getLong("id"),
                            toInstant(rs.getTimestamp("effective_from")),
                            toInstant(rs.getTimestamp("effective_to"))
                    ),
                    provider,
                    model,
                    currency,
                    excludedId
            );
        }

        for (CostWindow window : windows) {
            if (overlaps(effectiveFrom, effectiveTo, window.effectiveFrom(), window.effectiveTo())) {
                throw new ConflictException(
                        "Khoảng hiệu lực bị trùng với cost #" + window.id()
                                + " cho " + provider + " / " + model + " / " + currency + "."
                );
            }
        }
    }

    private static boolean overlaps(
            Instant leftStart,
            Instant leftEnd,
            Instant rightStart,
            Instant rightEnd
    ) {
        boolean leftBeforeRightEnd = rightEnd == null
                || leftStart == null
                || leftStart.isBefore(rightEnd);
        boolean rightBeforeLeftEnd = leftEnd == null
                || rightStart == null
                || rightStart.isBefore(leftEnd);
        return leftBeforeRightEnd && rightBeforeLeftEnd;
    }

    private static void validateWindow(Instant effectiveFrom, Instant effectiveTo) {
        if (effectiveFrom != null && effectiveTo != null && !effectiveFrom.isBefore(effectiveTo)) {
            throw new IllegalArgumentException("Ngày kết thúc hiệu lực phải sau ngày bắt đầu.");
        }
    }

    private static BigDecimal normalizeCost(BigDecimal value, String label) {
        if (value == null) {
            throw new IllegalArgumentException(label + " là bắt buộc.");
        }
        if (value.signum() < 0) {
            throw new IllegalArgumentException(label + " không được âm.");
        }
        if (value.scale() > 8) {
            throw new IllegalArgumentException(label + " chỉ hỗ trợ tối đa 8 chữ số thập phân.");
        }
        if (value.precision() - value.scale() > 12) {
            throw new IllegalArgumentException(label + " quá lớn.");
        }
        return value;
    }

    private void requireSuperAdmin(UserAccount actor) {
        if (!adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được thay đổi cấu hình AI model cost.");
        }
    }

    private static String costSelectSql() {
        return """
                SELECT c.id,
                       c.provider,
                       c.model,
                       c.currency,
                       c.input_cost_per_million,
                       c.cached_input_cost_per_million,
                       c.output_cost_per_million,
                       c.active,
                       c.effective_from,
                       c.effective_to,
                       c.notes,
                       c.created_by_user_id,
                       creator.email AS created_by_email,
                       c.created_at,
                       c.updated_at
                FROM ai_model_costs c
                LEFT JOIN users creator ON creator.id = c.created_by_user_id
                """;
    }

    private static AdminAiModelCostResponse mapCost(ResultSet rs) throws SQLException {
        Instant effectiveFrom = toInstant(rs.getTimestamp("effective_from"));
        Instant effectiveTo = toInstant(rs.getTimestamp("effective_to"));
        boolean active = rs.getBoolean("active");
        Instant now = Instant.now();
        boolean currentlyEffective = active
                && (effectiveFrom == null || !effectiveFrom.isAfter(now))
                && (effectiveTo == null || effectiveTo.isAfter(now));

        return new AdminAiModelCostResponse(
                rs.getLong("id"),
                rs.getString("provider"),
                rs.getString("model"),
                rs.getString("currency"),
                rs.getBigDecimal("input_cost_per_million"),
                rs.getBigDecimal("cached_input_cost_per_million"),
                rs.getBigDecimal("output_cost_per_million"),
                active,
                currentlyEffective,
                effectiveFrom,
                effectiveTo,
                rs.getString("notes"),
                nullableLong(rs.getObject("created_by_user_id")),
                rs.getString("created_by_email"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at"))
        );
    }

    private static String normalizeProvider(String value) {
        String provider = cleanRequired(value, 50, "Provider").toLowerCase(Locale.ROOT);
        if (!provider.matches("[a-z0-9._-]+")) {
            throw new IllegalArgumentException("Provider chỉ được chứa chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.");
        }
        return provider;
    }

    private static String normalizeOptionalProvider(String value) {
        String clean = cleanOptional(value, 50);
        return clean == null ? null : normalizeProvider(clean);
    }

    private static String normalizeModel(String value) {
        return cleanRequired(value, 120, "Model");
    }

    private static String normalizeCurrency(String value) {
        String currency = cleanRequired(value, 3, "Currency").toUpperCase(Locale.ROOT);
        if (!currency.matches("[A-Z]{3}")) {
            throw new IllegalArgumentException("Currency phải là mã ISO 3 ký tự.");
        }
        return currency;
    }

    private static String cleanReason(String value) {
        return cleanRequired(value, 500, "Lý do thao tác");
    }

    private static String cleanRequired(Object value, int maxLength, String label) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            throw new IllegalArgumentException(label + " không được để trống.");
        }
        if (clean.length() > maxLength) {
            throw new IllegalArgumentException(label + " quá dài.");
        }
        return clean;
    }

    private static String cleanOptional(Object value, int maxLength) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            return null;
        }
        if (clean.length() > maxLength) {
            throw new IllegalArgumentException("Giá trị quá dài.");
        }
        return clean;
    }

    private static Instant parseOptionalInstant(String value, String label) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) {
            return null;
        }
        try {
            return Instant.parse(clean);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(label + " không hợp lệ.");
        }
    }

    private static Timestamp toTimestamp(Instant instant) {
        return instant == null ? null : Timestamp.from(instant);
    }

    private static Instant toInstant(Timestamp timestamp) {
        return timestamp == null ? null : timestamp.toInstant();
    }

    private static Long nullableLong(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }

    private record CostWindow(long id, Instant effectiveFrom, Instant effectiveTo) {
    }
}
