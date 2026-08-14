package com.dangt.aitranslator.backend.admin;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.boot.availability.ApplicationAvailability;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Service
public class AdminOperationalHealthService {

    private final JdbcTemplate jdbcTemplate;
    private final MeterRegistry meterRegistry;
    private final ApplicationAvailability availability;
    private final AdminSafetyService safetyService;

    public AdminOperationalHealthService(
            JdbcTemplate jdbcTemplate,
            MeterRegistry meterRegistry,
            ApplicationAvailability availability,
            AdminSafetyService safetyService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.meterRegistry = meterRegistry;
        this.availability = availability;
        this.safetyService = safetyService;
    }

    public AdminOperationalHealthResponse snapshot() {
        List<AdminOperationalHealthResponse.Check> checks = new ArrayList<>();
        availabilityHealth(checks);

        AdminOperationalHealthResponse.DatabaseHealth database = databaseHealth(checks);
        if (database.reachable()) {
            safetyHealth(checks);
        }
        AdminOperationalHealthResponse.JvmHealth jvm = jvmHealth(checks);
        AdminOperationalHealthResponse.HttpHealth http = httpHealth(checks);

        AdminOperationalHealthResponse.AiHealth ai = database.reachable()
                ? aiHealth(checks)
                : emptyAiHealth();
        AdminOperationalHealthResponse.RevenueHealth revenue = database.reachable()
                ? revenueHealth(checks)
                : emptyRevenueHealth();
        AdminOperationalHealthResponse.SecurityHealth security = database.reachable()
                ? securityHealth(checks)
                : emptySecurityHealth();
        AdminOperationalHealthResponse.ErrorHealth errors = database.reachable()
                ? errorHealth(checks)
                : emptyErrorHealth();

        return new AdminOperationalHealthResponse(
                Instant.now(),
                overallStatus(checks),
                availability.getLivenessState().name(),
                availability.getReadinessState().name(),
                Math.max(0L, ManagementFactory.getRuntimeMXBean().getUptime() / 1000L),
                database,
                jvm,
                http,
                ai,
                revenue,
                security,
                errors,
                List.copyOf(checks)
        );
    }

    private void availabilityHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        String liveness = availability.getLivenessState().name();
        String readiness = availability.getReadinessState().name();
        boolean healthy = "CORRECT".equals(liveness) && "ACCEPTING_TRAFFIC".equals(readiness);
        checks.add(check(
                "APPLICATION_AVAILABILITY",
                healthy ? "HEALTHY" : "CRITICAL",
                "Application availability",
                healthy
                        ? "Spring Boot liveness/readiness đang cho phép phục vụ traffic."
                        : "Liveness hoặc readiness đang báo backend không sẵn sàng phục vụ traffic.",
                liveness + " · " + readiness
        ));
    }

    private AdminOperationalHealthResponse.DatabaseHealth databaseHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        long started = System.nanoTime();
        try {
            Integer ping = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            long latencyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
            if (ping == null || ping != 1) {
                throw new IllegalStateException("Unexpected database ping response");
            }

            String version = safeStringQuery("SELECT VERSION()", "unknown");
            MigrationSnapshot migration = migrationSnapshot();

            checks.add(check(
                    "DATABASE_CONNECTIVITY",
                    latencyMs >= 500 ? "WARNING" : "HEALTHY",
                    "Database connectivity",
                    latencyMs >= 500
                            ? "Database trả lời nhưng latency đang cao."
                            : "Database reachable và trả lời ping bình thường.",
                    latencyMs + " ms"
            ));

            checks.add(check(
                    "FLYWAY_HISTORY",
                    migration.failedMigrations() > 0 ? "CRITICAL" : "HEALTHY",
                    "Flyway migration history",
                    migration.failedMigrations() > 0
                            ? "Có migration Flyway failed trong schema history."
                            : "Không có migration failed trong schema history.",
                    migration.latestVersion().isBlank()
                            ? "no migration"
                            : "V" + migration.latestVersion()
            ));

            return new AdminOperationalHealthResponse.DatabaseHealth(
                    true,
                    latencyMs,
                    version,
                    migration.latestVersion(),
                    migration.latestDescription(),
                    migration.failedMigrations()
            );
        } catch (Exception exception) {
            long latencyMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started);
            checks.add(check(
                    "DATABASE_CONNECTIVITY",
                    "CRITICAL",
                    "Database connectivity",
                    "Backend không thể xác nhận kết nối database: " + exception.getClass().getSimpleName(),
                    "unreachable"
            ));
            checks.add(check(
                    "FLYWAY_HISTORY",
                    "WARNING",
                    "Flyway migration history",
                    "Không thể đọc migration history khi database unavailable.",
                    "unavailable"
            ));
            return new AdminOperationalHealthResponse.DatabaseHealth(
                    false,
                    latencyMs,
                    "unavailable",
                    "",
                    "",
                    0L
            );
        }
    }

    private MigrationSnapshot migrationSnapshot() {
        Long failed = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM flyway_schema_history WHERE success = FALSE",
                Long.class
        );

        List<MigrationSnapshot> latest = jdbcTemplate.query(
                """
                SELECT COALESCE(version, ''), COALESCE(description, '')
                FROM flyway_schema_history
                WHERE success = TRUE
                ORDER BY installed_rank DESC
                LIMIT 1
                """,
                (rs, rowNum) -> new MigrationSnapshot(
                        rs.getString(1),
                        rs.getString(2),
                        failed == null ? 0L : failed
                )
        );

        if (latest.isEmpty()) {
            return new MigrationSnapshot("", "", failed == null ? 0L : failed);
        }
        return latest.getFirst();
    }

    private String safeStringQuery(String sql, String fallback) {
        try {
            String result = jdbcTemplate.queryForObject(sql, String.class);
            return result == null || result.isBlank() ? fallback : result;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    private void safetyHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        try {
            AdminSafetyResponse safety = safetyService.snapshot();
            checks.add(check(
                    "ADMIN_WRITE_MODE",
                    safety.readOnly() ? "WARNING" : "HEALTHY",
                    "Admin write mode",
                    safety.readOnly()
                            ? "Admin Console đang READ_ONLY; các write operation quản trị bị chặn trừ safety unlock và incident lifecycle."
                            : "Admin Console đang cho phép write operation bình thường.",
                    safety.mode()
            ));
        } catch (Exception exception) {
            checks.add(check(
                    "ADMIN_WRITE_MODE",
                    "WARNING",
                    "Admin write mode",
                    "Không thể đọc Admin safety state: " + exception.getClass().getSimpleName(),
                    "unavailable"
            ));
        }
    }

    private AdminOperationalHealthResponse.JvmHealth jvmHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        Runtime runtime = Runtime.getRuntime();
        long heapUsed = runtime.totalMemory() - runtime.freeMemory();
        long heapMax = runtime.maxMemory();
        double usage = heapMax <= 0 ? 0.0 : percent(heapUsed, heapMax);

        String status = usage >= 95.0 ? "CRITICAL" : usage >= 85.0 ? "WARNING" : "HEALTHY";
        checks.add(check(
                "JVM_HEAP",
                status,
                "JVM heap usage",
                switch (status) {
                    case "CRITICAL" -> "Heap usage rất cao; có nguy cơ OutOfMemory hoặc GC pressure.";
                    case "WARNING" -> "Heap usage đang cao; nên theo dõi nếu tiếp tục tăng.";
                    default -> "Heap usage nằm trong ngưỡng vận hành bình thường.";
                },
                formatPercent(usage)
        ));

        return new AdminOperationalHealthResponse.JvmHealth(
                heapUsed,
                heapMax,
                usage,
                runtime.availableProcessors()
        );
    }

    private AdminOperationalHealthResponse.HttpHealth httpHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        long total = 0L;
        long clientErrors = 0L;
        long serverErrors = 0L;
        double totalTimeMs = 0.0;

        for (Timer timer : meterRegistry.find("http.server.requests").timers()) {
            long count = timer.count();
            total += count;
            totalTimeMs += timer.totalTime(TimeUnit.MILLISECONDS);

            String status = timer.getId().getTag("status");
            if (status != null && status.startsWith("4")) {
                clientErrors += count;
            }
            if (status != null && status.startsWith("5")) {
                serverErrors += count;
            }
        }

        double errorRate = percent(serverErrors, total);
        double averageLatencyMs = total == 0 ? 0.0 : totalTimeMs / total;
        String status = total >= 20 && errorRate >= 20.0
                ? "CRITICAL"
                : total >= 20 && errorRate >= 5.0
                ? "WARNING"
                : "HEALTHY";

        checks.add(check(
                "HTTP_5XX_RATE",
                status,
                "HTTP 5xx rate",
                total < 20
                        ? "Chưa đủ 20 request từ lúc backend start để đánh giá error rate ổn định."
                        : status.equals("HEALTHY")
                        ? "Tỷ lệ HTTP 5xx đang trong ngưỡng bình thường."
                        : "Tỷ lệ HTTP 5xx từ lúc backend start đang cao.",
                formatPercent(errorRate) + " · " + serverErrors + "/" + total
        ));

        return new AdminOperationalHealthResponse.HttpHealth(
                total,
                clientErrors,
                serverErrors,
                errorRate,
                averageLatencyMs
        );
    }

    private AdminOperationalHealthResponse.AiHealth aiHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        return jdbcTemplate.query(
                """
                SELECT COUNT(*) AS requests,
                       COALESCE(SUM(CASE WHEN successful = FALSE THEN 1 ELSE 0 END), 0) AS failed,
                       COALESCE(SUM(CASE WHEN cost_status = 'CALCULATED' THEN 1 ELSE 0 END), 0) AS calculated,
                       COALESCE(SUM(CASE WHEN cost_status <> 'CALCULATED' THEN 1 ELSE 0 END), 0) AS missing_cost
                FROM ai_usage_events
                WHERE created_at >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6))
                  AND created_at <= CURRENT_TIMESTAMP(6)
                """,
                rs -> {
                    if (!rs.next()) {
                        return emptyAiHealth();
                    }
                    long requests = rs.getLong("requests");
                    long failed = rs.getLong("failed");
                    long calculated = rs.getLong("calculated");
                    long missingCost = rs.getLong("missing_cost");
                    double successRate = requests == 0 ? 100.0 : percent(requests - failed, requests);
                    double coverage = requests == 0 ? 100.0 : percent(calculated, requests);

                    String reliabilityStatus = requests >= 5 && successRate < 80.0
                            ? "CRITICAL"
                            : requests >= 5 && successRate < 95.0
                            ? "WARNING"
                            : "HEALTHY";
                    checks.add(check(
                            "AI_RELIABILITY_24H",
                            reliabilityStatus,
                            "AI request reliability (24h)",
                            requests == 0
                                    ? "Không có AI request trong 24 giờ gần nhất."
                                    : "Theo dõi success/failure từ metadata-only AI usage ledger.",
                            formatPercent(successRate) + " success · " + requests + " requests"
                    ));

                    String coverageStatus = missingCost > 0 ? "WARNING" : "HEALTHY";
                    checks.add(check(
                            "AI_COST_COVERAGE_24H",
                            coverageStatus,
                            "AI cost coverage (24h)",
                            missingCost > 0
                                    ? "Có AI event chưa tính được cost; kiểm tra model rate/token metadata."
                                    : "Tất cả AI event 24h có cost snapshot hoặc không có event.",
                            formatPercent(coverage) + " · " + missingCost + " missing"
                    ));

                    return new AdminOperationalHealthResponse.AiHealth(
                            requests,
                            failed,
                            successRate,
                            calculated,
                            missingCost,
                            coverage
                    );
                }
        );
    }

    private AdminOperationalHealthResponse.RevenueHealth revenueHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        AdminOperationalHealthResponse.RevenueHealth health = jdbcTemplate.query(
                """
                SELECT
                    COALESCE(SUM(CASE
                        WHEN status IN ('SUCCEEDED', 'REFUNDED')
                         AND paid_at >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6))
                        THEN 1 ELSE 0 END), 0) AS paid_transactions,
                    COALESCE(SUM(CASE
                        WHEN status = 'FAILED'
                         AND COALESCE(failed_at, updated_at) >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6))
                        THEN 1 ELSE 0 END), 0) AS failed_transactions,
                    COALESCE(SUM(CASE
                        WHEN status IN ('SUCCEEDED', 'REFUNDED')
                         AND paid_at >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6))
                         AND revenue_status = 'NORMALIZED'
                        THEN 1 ELSE 0 END), 0) AS normalized_revenue,
                    COALESCE(SUM(CASE
                        WHEN status IN ('SUCCEEDED', 'REFUNDED')
                         AND paid_at >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6))
                         AND revenue_status <> 'NORMALIZED'
                        THEN 1 ELSE 0 END), 0) AS missing_revenue
                FROM payment_transactions
                """,
                rs -> {
                    if (!rs.next()) {
                        return emptyRevenueHealth();
                    }
                    long paid = rs.getLong("paid_transactions");
                    long failed = rs.getLong("failed_transactions");
                    long normalized = rs.getLong("normalized_revenue");
                    long missing = rs.getLong("missing_revenue");
                    double coverage = paid == 0 ? 100.0 : percent(normalized, paid);
                    return new AdminOperationalHealthResponse.RevenueHealth(
                            paid,
                            failed,
                            normalized,
                            missing,
                            coverage
                    );
                }
        );

        String status = health.missingRevenue24h() > 0 ? "WARNING" : "HEALTHY";
        checks.add(check(
                "REVENUE_COVERAGE_24H",
                status,
                "Revenue normalization coverage (24h)",
                health.missingRevenue24h() > 0
                        ? "Có payment đã settle nhưng chưa normalize về reporting currency."
                        : "Payment đã settle trong 24h đều có revenue snapshot hoặc không có payment.",
                formatPercent(health.revenueCoveragePercent()) + " · " + health.missingRevenue24h() + " missing"
        ));

        String paymentStatus = health.failedTransactions24h() >= 5 ? "WARNING" : "HEALTHY";
        checks.add(check(
                "PAYMENT_FAILURES_24H",
                paymentStatus,
                "Payment failures (24h)",
                health.failedTransactions24h() >= 5
                        ? "Số payment FAILED trong 24h đang cao; cần kiểm tra provider/failure_code."
                        : "Không phát hiện cụm payment failure lớn trong 24h.",
                health.failedTransactions24h() + " failed"
        ));

        return health;
    }

    private AdminOperationalHealthResponse.SecurityHealth securityHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        AdminOperationalHealthResponse.SecurityHealth health = jdbcTemplate.query(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END), 0) AS warnings,
                    COALESCE(SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS critical_events,
                    COALESCE(SUM(CASE WHEN outcome = 'DENIED' THEN 1 ELSE 0 END), 0) AS denied_events,
                    COALESCE(SUM(CASE WHEN event_type = 'ADMIN_LOGIN_FAILED' THEN 1 ELSE 0 END), 0) AS failed_logins
                FROM admin_security_events
                WHERE created_at >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6))
                  AND created_at <= CURRENT_TIMESTAMP(6)
                """,
                rs -> {
                    if (!rs.next()) {
                        return emptySecurityHealth();
                    }
                    return new AdminOperationalHealthResponse.SecurityHealth(
                            rs.getLong("warnings"),
                            rs.getLong("critical_events"),
                            rs.getLong("denied_events"),
                            rs.getLong("failed_logins")
                    );
                }
        );

        String status = health.critical24h() > 0
                ? "CRITICAL"
                : health.warnings24h() > 0 || health.failedLogins24h() >= 5
                ? "WARNING"
                : "HEALTHY";
        checks.add(check(
                "SECURITY_EVENTS_24H",
                status,
                "Security events (24h)",
                health.critical24h() > 0
                        ? "Có CRITICAL security event trong 24h; mở Security Events để điều tra."
                        : health.warnings24h() > 0 || health.failedLogins24h() >= 5
                        ? "Có warning hoặc nhiều login failure cần theo dõi."
                        : "Không có security signal nghiêm trọng trong 24h.",
                health.critical24h() + " critical · " + health.warnings24h() + " warning"
        ));

        return health;
    }


    private AdminOperationalHealthResponse.ErrorHealth errorHealth(
            List<AdminOperationalHealthResponse.Check> checks
    ) {
        AdminOperationalHealthResponse.ErrorHealth health = jdbcTemplate.query(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN status <> 'RESOLVED' THEN 1 ELSE 0 END), 0) AS open_events,
                    COALESCE(SUM(CASE WHEN status <> 'RESOLVED' AND severity = 'CRITICAL' THEN 1 ELSE 0 END), 0) AS critical_open,
                    COALESCE(SUM(CASE WHEN status <> 'RESOLVED' AND retryable = TRUE THEN 1 ELSE 0 END), 0) AS retryable_open,
                    COALESCE(SUM(CASE WHEN occurred_at >= TIMESTAMPADD(HOUR, -24, CURRENT_TIMESTAMP(6)) THEN 1 ELSE 0 END), 0) AS new_24h
                FROM admin_error_events
                """,
                rs -> {
                    if (!rs.next()) {
                        return emptyErrorHealth();
                    }
                    return new AdminOperationalHealthResponse.ErrorHealth(
                            rs.getLong("open_events"),
                            rs.getLong("critical_open"),
                            rs.getLong("retryable_open"),
                            rs.getLong("new_24h")
                    );
                }
        );

        String status = health.criticalOpenEvents() > 0
                ? "CRITICAL"
                : health.openEvents() > 0
                ? "WARNING"
                : "HEALTHY";
        checks.add(check(
                "OPEN_ERROR_EVENTS",
                status,
                "Open operational errors",
                health.criticalOpenEvents() > 0
                        ? "Có CRITICAL error event chưa resolve; mở Errors & Failed Jobs để điều tra."
                        : health.openEvents() > 0
                        ? "Có error event đang OPEN/ACKNOWLEDGED cần theo dõi."
                        : "Không có operational error event đang mở.",
                health.openEvents() + " open · " + health.criticalOpenEvents() + " critical"
        ));
        return health;
    }

    private AdminOperationalHealthResponse.AiHealth emptyAiHealth() {
        return new AdminOperationalHealthResponse.AiHealth(0, 0, 100.0, 0, 0, 100.0);
    }

    private AdminOperationalHealthResponse.RevenueHealth emptyRevenueHealth() {
        return new AdminOperationalHealthResponse.RevenueHealth(0, 0, 0, 0, 100.0);
    }

    private AdminOperationalHealthResponse.SecurityHealth emptySecurityHealth() {
        return new AdminOperationalHealthResponse.SecurityHealth(0, 0, 0, 0);
    }

    private AdminOperationalHealthResponse.ErrorHealth emptyErrorHealth() {
        return new AdminOperationalHealthResponse.ErrorHealth(0, 0, 0, 0);
    }

    private AdminOperationalHealthResponse.Check check(
            String code,
            String status,
            String title,
            String detail,
            String observedValue
    ) {
        return new AdminOperationalHealthResponse.Check(code, status, title, detail, observedValue);
    }

    private String overallStatus(List<AdminOperationalHealthResponse.Check> checks) {
        if (checks.stream().anyMatch(check -> "CRITICAL".equals(check.status()))) {
            return "CRITICAL";
        }
        if (checks.stream().anyMatch(check -> "WARNING".equals(check.status()))) {
            return "WARNING";
        }
        return "HEALTHY";
    }

    private double percent(long numerator, long denominator) {
        return denominator <= 0 ? 0.0 : (numerator * 100.0) / denominator;
    }

    private String formatPercent(double value) {
        return String.format(Locale.ROOT, "%.2f%%", value);
    }

    private record MigrationSnapshot(
            String latestVersion,
            String latestDescription,
            long failedMigrations
    ) {
    }
}
