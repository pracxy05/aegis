package com.aegis.aegis_backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;
import java.net.URI;

@Slf4j
@Configuration
public class DataSourceConfig {

    // Reads OS environment variable DATABASE_URL directly (Render injects this)
    // Empty string default means it's optional — local dev won't have it
    @Value("#{systemEnvironment['DATABASE_URL'] ?: ''}")
    private String renderUrl;

    @Value("${spring.datasource.url:}")
    private String localUrl;

    @Value("${spring.datasource.username:}")
    private String localUser;

    @Value("${spring.datasource.password:}")
    private String localPass;

    @Bean
    @Primary
    public DataSource dataSource() {
        HikariConfig cfg = new HikariConfig();
        cfg.setMaximumPoolSize(5);
        cfg.setMinimumIdle(1);
        cfg.setConnectionTimeout(30000);
        cfg.setIdleTimeout(600000);
        cfg.setMaxLifetime(1800000);

        if (renderUrl != null && !renderUrl.isBlank() && renderUrl.startsWith("postgres")) {
            // ── Render PostgreSQL ────────────────────────────────────
            log.info("🐘 RENDER mode — PostgreSQL via DATABASE_URL");
            try {
                URI    uri  = URI.create(renderUrl.replace("postgres://", "postgresql://"));
                String host = uri.getHost();
                int    port = uri.getPort() == -1 ? 5432 : uri.getPort();
                String db   = uri.getPath().replaceFirst("/", "");
                String info = uri.getUserInfo();
                String user = info.split(":")[0];
                String pass = info.substring(info.indexOf(':') + 1);

                cfg.setDriverClassName("org.postgresql.Driver");
                cfg.setJdbcUrl("jdbc:postgresql://" + host + ":" + port + "/" + db + "?sslmode=require");
                cfg.setUsername(user);
                cfg.setPassword(pass);

            } catch (Exception e) {
                throw new RuntimeException("❌ Failed to parse DATABASE_URL: " + renderUrl, e);
            }

        } else if (!localUrl.isBlank()) {
            // ── Local MySQL ──────────────────────────────────────────
            log.info("🗄️  LOCAL mode — MySQL via spring.datasource.url");
            cfg.setJdbcUrl(localUrl);
            cfg.setUsername(localUser);
            cfg.setPassword(localPass);
            cfg.setDriverClassName("com.mysql.cj.jdbc.Driver");

        } else {
            throw new RuntimeException(
                "❌ No DB config found. Set DATABASE_URL (Render) or spring.datasource.url (local).");
        }

        return new HikariDataSource(cfg);
    }
}
