package com.dangt.aitranslator.backend.system;

import com.dangt.aitranslator.backend.usage.TranslationUsageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;

@RestController
@Profile("dev")
@RequestMapping("/api/v1/system")
@Tag(
        name = "System",
        description = "Các API kiểm tra backend và MySQL trong development."
)
public class SystemController {

    private final DataSource dataSource;
    private final JdbcTemplate jdbcTemplate;
    private final TranslationUsageService usageService;

    public SystemController(
            DataSource dataSource,
            JdbcTemplate jdbcTemplate,
            TranslationUsageService usageService
    ) {
        this.dataSource = dataSource;
        this.jdbcTemplate = jdbcTemplate;
        this.usageService = usageService;
    }

    @GetMapping("/database")
    @Operation(
            summary = "Kiểm tra kết nối MySQL",
            description = "Trả về database product/version và tổng số usage event."
    )
    @SecurityRequirement(name = "bearerAuth")
    public DatabaseStatusResponse databaseStatus()
            throws Exception {

        try (Connection connection =
                     dataSource.getConnection()) {

            DatabaseMetaData meta =
                    connection.getMetaData();

            String database =
                    jdbcTemplate.queryForObject(
                            "SELECT DATABASE()",
                            String.class
                    );

            return new DatabaseStatusResponse(
                    true,
                    meta.getDatabaseProductName(),
                    meta.getDatabaseProductVersion(),
                    database,
                    usageService.countAll()
            );
        }
    }
}
