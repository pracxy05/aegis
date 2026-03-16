package com.aegis.aegis_backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import lombok.extern.slf4j.Slf4j;

import javax.sql.DataSource;
import java.net.URI;

@Slf4j
@Configuration
public class DataSourceConfig {

    // Render injects this as postgres://user:pass@host:port/db
    @Value("${DATABASE_URL:}")
    private String databaseUrl;

    // Local dev fallback values
    @Value("${spring.datasource.url:}")
    private String localJdbcUrl;

    @Value("${spring.datasource.username:}")
    private String localUser;

    @Value("${spring.datasource.password:}")
    private String localPass;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig config = new HikariConfig();
        config.setMaximumPoolSize(5);
        config.setMinimumIdle(1);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);

        if (!databaseUrl.isBlank()) {
            // ── Render PostgreSQL ──────────────────────────────────────
            log.info("🐘 Connecting via DATABASE_URL (Render PostgreSQL)");
            try {
                String normalized = databaseUrl
                        .replace("postgres://", "postgresql://");
                URI    uri  = URI.create(normalized);
                String host = uri.getHost();
                int    port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String db   = uri.getPath().replaceFirst("/", "");
                String info = uri.getUserInfo();
                String user = info.split(":")[0];
                String pass = info.substring(info.indexOf(':') + 1); // handles : in password

                config.setDriverClassName("org.postgresql.Driver");
                config.setJdbcUrl("jdbc:postgresql://" + host + ":" + port + "/" + db
                                  + "?sslmode=require");
                config.setUsername(user);
                config.setPassword(pass);

            } catch (Exception e) {
                throw new RuntimeException(
                    "❌ Failed to parse DATABASE_URL: " + databaseUrl, e);
            }

        } else if (!localJdbcUrl.isBlank()) {
            // ── Local dev (MySQL or any jdbc URL) ─────────────────────
            log.info("🗄️  Connecting via spring.datasource.url (local dev)");
            config.setJdbcUrl(localJdbcUrl);
            config.setUsername(localUser);
            config.setPassword(localPass);

        } else {
            throw new RuntimeException(
                "❌ No database configuration found. " +
                "Set DATABASE_URL (Render) or spring.datasource.url (local).");
        }

        return new HikariDataSource(config);
    }
}
