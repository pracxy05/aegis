package com.aegis.aegis_backend.config;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import javax.sql.DataSource;

@Slf4j
@Configuration
public class DataSourceConfig {

    // ── Render individual vars (set in Render dashboard) ──────────
    @Value("#{systemEnvironment['DB_HOST'] ?: ''}")
    private String dbHost;

    @Value("#{systemEnvironment['DB_PORT'] ?: '5432'}")
    private String dbPort;

    @Value("#{systemEnvironment['DB_NAME'] ?: ''}")
    private String dbName;

    @Value("#{systemEnvironment['DB_USER'] ?: ''}")
    private String dbUser;

    @Value("#{systemEnvironment['DB_PASSWORD'] ?: ''}")
    private String dbPassword;

    // ── Local MySQL fallback ───────────────────────────────────────
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

        if (!dbHost.isBlank()) {
            // ── Render PostgreSQL (individual vars) ──────────────────
            log.info("🐘 RENDER mode — PostgreSQL {}:{}/{}", dbHost, dbPort, dbName);
            cfg.setDriverClassName("org.postgresql.Driver");
            cfg.setJdbcUrl(
                "jdbc:postgresql://" + dbHost + ":" + dbPort + "/" + dbName + "?sslmode=require"
            );
            cfg.setUsername(dbUser);
            cfg.setPassword(dbPassword);

        } else if (!localUrl.isBlank()) {
            // ── Local MySQL ──────────────────────────────────────────
            log.info("🗄️  LOCAL mode — MySQL via spring.datasource.url");
            cfg.setDriverClassName("com.mysql.cj.jdbc.Driver");
            cfg.setJdbcUrl(localUrl);
            cfg.setUsername(localUser);
            cfg.setPassword(localPass);

        } else {
            throw new RuntimeException(
                "❌ No DB config found.\n" +
                "  → Render: set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD\n" +
                "  → Local:  set spring.datasource.url in application.properties"
            );
        }

        return new HikariDataSource(cfg);
    }
}