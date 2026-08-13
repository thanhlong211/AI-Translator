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
import java.util.Currency;
import java.util.List;
import java.util.Locale;

@Service
public class AdminFxRateService {

    private final JdbcTemplate jdbcTemplate;
    private final AdminGuard adminGuard;
    private final AdminAuditService auditService;

    public AdminFxRateService(
            JdbcTemplate jdbcTemplate,
            AdminGuard adminGuard,
            AdminAuditService auditService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.adminGuard = adminGuard;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<AdminFxRateResponse> list(
            String requestedBaseCurrency,
            String requestedQuoteCurrency,
            Boolean active,
            int requestedLimit
    ) {
        String base = normalizeOptionalCurrency(requestedBaseCurrency);
        String quote = normalizeOptionalCurrency(requestedQuoteCurrency);
        int limit = Math.max(1, Math.min(requestedLimit, 500));

        StringBuilder sql = new StringBuilder(selectSql()).append(" WHERE 1=1");
        List<Object> args = new ArrayList<>();
        if (base != null) {
            sql.append(" AND f.base_currency = ?");
            args.add(base);
        }
        if (quote != null) {
            sql.append(" AND f.quote_currency = ?");
            args.add(quote);
        }
        if (active != null) {
            sql.append(" AND f.active = ?");
            args.add(active);
        }
        sql.append(" ORDER BY f.base_currency, f.quote_currency, f.effective_from DESC, f.id DESC LIMIT ?");
        args.add(limit);

        return jdbcTemplate.query(sql.toString(), (rs, rowNum) -> map(rs), args.toArray());
    }

    @Transactional(readOnly = true)
    public AdminFxRateResponse detail(long rateId) {
        return requireRate(rateId);
    }

    @Transactional
    public AdminFxRateResponse create(UserAccount actor, AdminFxRateCreateRequest request) {
        requireSuperAdmin(actor);
        String base = normalizeCurrency(request.baseCurrency());
        String quote = normalizeCurrency(request.quoteCurrency());
        requireDifferentCurrencies(base, quote);
        BigDecimal rate = normalizeRate(request.rate());
        boolean active = request.active() == null || request.active();
        Instant effectiveFrom = parseOptionalInstant(request.effectiveFrom(), "Ngày bắt đầu hiệu lực");
        if (effectiveFrom == null) effectiveFrom = Instant.now();
        Instant effectiveTo = parseOptionalInstant(request.effectiveTo(), "Ngày kết thúc hiệu lực");
        String notes = cleanOptional(request.notes(), 500);
        String reason = cleanReason(request.reason());

        validateWindow(effectiveFrom, effectiveTo);
        requireNoActiveOverlap(null, base, quote, active, effectiveFrom, effectiveTo);

        jdbcTemplate.update(
                """
                INSERT INTO currency_exchange_rates (
                    base_currency, quote_currency, rate, active,
                    effective_from, effective_to, notes, created_by_user_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(6), CURRENT_TIMESTAMP(6))
                """,
                base, quote, rate, active,
                Timestamp.from(effectiveFrom), toTimestamp(effectiveTo), notes, actor.getId()
        );

        Long id = jdbcTemplate.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
        if (id == null || id <= 0) throw new IllegalStateException("Không xác định được FX rate vừa tạo.");

        auditService.record(
                actor.getId(),
                "FX_RATE_CREATED",
                null,
                "fxRateId=" + id
                        + "; pair=" + base + "->" + quote
                        + "; rate=" + rate.toPlainString()
                        + "; active=" + active
                        + "; reason=" + reason
        );
        return requireRate(id);
    }

    @Transactional
    public AdminFxRateResponse update(UserAccount actor, long rateId, AdminFxRateUpdateRequest request) {
        requireSuperAdmin(actor);
        AdminFxRateResponse before = requireRate(rateId);
        String base = normalizeCurrency(request.baseCurrency());
        String quote = normalizeCurrency(request.quoteCurrency());
        requireDifferentCurrencies(base, quote);
        BigDecimal rate = normalizeRate(request.rate());
        boolean active = request.active() == null ? before.active() : request.active();
        Instant effectiveFrom = parseOptionalInstant(request.effectiveFrom(), "Ngày bắt đầu hiệu lực");
        if (effectiveFrom == null) effectiveFrom = before.effectiveFrom();
        Instant effectiveTo = parseOptionalInstant(request.effectiveTo(), "Ngày kết thúc hiệu lực");
        String notes = cleanOptional(request.notes(), 500);
        String reason = cleanReason(request.reason());

        validateWindow(effectiveFrom, effectiveTo);
        requireNoActiveOverlap(rateId, base, quote, active, effectiveFrom, effectiveTo);

        jdbcTemplate.update(
                """
                UPDATE currency_exchange_rates
                SET base_currency = ?,
                    quote_currency = ?,
                    rate = ?,
                    active = ?,
                    effective_from = ?,
                    effective_to = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP(6)
                WHERE id = ?
                """,
                base, quote, rate, active,
                Timestamp.from(effectiveFrom), toTimestamp(effectiveTo), notes, rateId
        );

        auditService.record(
                actor.getId(),
                "FX_RATE_UPDATED",
                null,
                "fxRateId=" + rateId
                        + "; pair=" + before.baseCurrency() + "->" + before.quoteCurrency()
                        + "=>" + base + "->" + quote
                        + "; rate=" + before.rate().toPlainString() + "->" + rate.toPlainString()
                        + "; active=" + before.active() + "->" + active
                        + "; reason=" + reason
        );
        return requireRate(rateId);
    }

    private AdminFxRateResponse requireRate(long rateId) {
        List<AdminFxRateResponse> rows = jdbcTemplate.query(
                selectSql() + " WHERE f.id = ? LIMIT 1",
                (rs, rowNum) -> map(rs),
                rateId
        );
        if (rows.isEmpty()) throw new IllegalArgumentException("Không tìm thấy FX rate.");
        return rows.getFirst();
    }

    private void requireNoActiveOverlap(
            Long excludedId,
            String base,
            String quote,
            boolean active,
            Instant from,
            Instant to
    ) {
        if (!active) return;
        String sql = """
                SELECT id, effective_from, effective_to
                FROM currency_exchange_rates
                WHERE base_currency = ?
                  AND quote_currency = ?
                  AND active = TRUE
                """;
        List<Window> rows;
        if (excludedId == null) {
            rows = jdbcTemplate.query(sql, (rs, rowNum) -> window(rs), base, quote);
        } else {
            rows = jdbcTemplate.query(sql + " AND id <> ?", (rs, rowNum) -> window(rs), base, quote, excludedId);
        }
        for (Window existing : rows) {
            if (overlaps(from, to, existing.from(), existing.to())) {
                throw new ConflictException("Khoảng hiệu lực bị trùng với FX rate #" + existing.id() + " cho " + base + " -> " + quote + ".");
            }
        }
    }

    private static Window window(ResultSet rs) throws SQLException {
        return new Window(rs.getLong("id"), toInstant(rs.getTimestamp("effective_from")), toInstant(rs.getTimestamp("effective_to")));
    }

    private static boolean overlaps(Instant leftStart, Instant leftEnd, Instant rightStart, Instant rightEnd) {
        boolean leftBeforeRightEnd = rightEnd == null || leftStart.isBefore(rightEnd);
        boolean rightBeforeLeftEnd = leftEnd == null || rightStart.isBefore(leftEnd);
        return leftBeforeRightEnd && rightBeforeLeftEnd;
    }

    private static void validateWindow(Instant from, Instant to) {
        if (to != null && !from.isBefore(to)) {
            throw new IllegalArgumentException("Ngày kết thúc hiệu lực phải sau ngày bắt đầu.");
        }
    }

    private static void requireDifferentCurrencies(String base, String quote) {
        if (base.equals(quote)) {
            throw new IllegalArgumentException("Không cần cấu hình FX cho cùng currency; hệ thống tự dùng rate 1.");
        }
    }

    private void requireSuperAdmin(UserAccount actor) {
        if (!adminGuard.isSuperAdmin(actor)) {
            throw new ForbiddenException("Chỉ SUPER_ADMIN được thay đổi FX rate.");
        }
    }

    private static BigDecimal normalizeRate(BigDecimal value) {
        if (value == null || value.signum() <= 0) throw new IllegalArgumentException("FX rate phải lớn hơn 0.");
        if (value.scale() > 12) throw new IllegalArgumentException("FX rate chỉ hỗ trợ tối đa 12 chữ số thập phân.");
        if (value.precision() - value.scale() > 12) throw new IllegalArgumentException("FX rate quá lớn.");
        return value;
    }

    private static String normalizeOptionalCurrency(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        return clean.isEmpty() ? null : normalizeCurrency(clean);
    }

    private static String normalizeCurrency(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim().toUpperCase(Locale.ROOT);
        if (!clean.matches("[A-Z]{3}")) throw new IllegalArgumentException("Currency phải là mã ISO 3 ký tự.");
        try {
            Currency.getInstance(clean);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Currency không được Java hỗ trợ: " + clean);
        }
        return clean;
    }

    private static Instant parseOptionalInstant(String value, String label) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) return null;
        try {
            return Instant.parse(clean);
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException(label + " không hợp lệ; cần ISO-8601 UTC.");
        }
    }

    private static String cleanReason(String value) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) throw new IllegalArgumentException("Cần nhập lý do thao tác.");
        return clean.length() <= 500 ? clean : clean.substring(0, 500);
    }

    private static String cleanOptional(String value, int max) {
        String clean = String.valueOf(value == null ? "" : value).trim();
        if (clean.isEmpty()) return null;
        return clean.length() <= max ? clean : clean.substring(0, max);
    }

    private static String selectSql() {
        return """
                SELECT f.id,
                       f.base_currency,
                       f.quote_currency,
                       f.rate,
                       f.active,
                       f.effective_from,
                       f.effective_to,
                       f.notes,
                       f.created_by_user_id,
                       creator.email AS created_by_email,
                       f.created_at,
                       f.updated_at
                FROM currency_exchange_rates f
                LEFT JOIN users creator ON creator.id = f.created_by_user_id
                """;
    }

    private static AdminFxRateResponse map(ResultSet rs) throws SQLException {
        Instant from = toInstant(rs.getTimestamp("effective_from"));
        Instant to = toInstant(rs.getTimestamp("effective_to"));
        Instant now = Instant.now();
        boolean effective = rs.getBoolean("active") && !from.isAfter(now) && (to == null || to.isAfter(now));
        return new AdminFxRateResponse(
                rs.getLong("id"),
                rs.getString("base_currency"),
                rs.getString("quote_currency"),
                rs.getBigDecimal("rate"),
                rs.getBoolean("active"),
                from,
                to,
                effective,
                rs.getString("notes"),
                nullableLong(rs.getObject("created_by_user_id")),
                rs.getString("created_by_email"),
                toInstant(rs.getTimestamp("created_at")),
                toInstant(rs.getTimestamp("updated_at"))
        );
    }

    private static Long nullableLong(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static Timestamp toTimestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    private static Instant toInstant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }

    private record Window(long id, Instant from, Instant to) {
    }
}
