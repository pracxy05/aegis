package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class UsgsScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;

    private static final String USGS_URL =
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson";

    @Scheduled(fixedRate = 300000)
    @SuppressWarnings("unchecked")
    public void fetchEarthquakes() {
        log.info("⚡ Fetching USGS earthquake data...");
        try {
            Map<String, Object> response = restTemplate.getForObject(USGS_URL, Map.class);

            if (response == null || !response.containsKey("features")) {
                log.warn("⚠️ USGS response was null or missing features");
                return;
            }

            List<Map<String, Object>> features = (List<Map<String, Object>>) response.get("features");
            int saved = 0;

            for (Map<String, Object> feature : features) {
                String externalId = (String) feature.get("id");

                if (externalId == null) continue;

                // Deduplication — skip if already in DB
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                Map<String, Object> props    = (Map<String, Object>) feature.get("properties");
                Map<String, Object> geometry = (Map<String, Object>) feature.get("geometry");
                List<Double> coords          = (List<Double>) geometry.get("coordinates");

                if (props == null || coords == null || coords.size() < 3) continue;

                Object magObj = props.get("mag");
                if (magObj == null) continue;

                double magnitude = ((Number) magObj).doubleValue();
                String severity  = magnitude >= 7.0 ? "CRITICAL"
                                 : magnitude >= 5.5 ? "HIGH"
                                 : magnitude >= 4.0 ? "MEDIUM" : "LOW";

                Event event = Event.builder()
                        .externalId(externalId)
                        .title((String) props.get("title"))
                        .eventType("EARTHQUAKE")
                        .source("USGS")
                        .latitude(coords.get(1))
                        .longitude(coords.get(0))
                        .magnitude(magnitude)
                        .severity(severity)
                        .description("Depth: " + coords.get(2) + " km")
                        .eventTime(LocalDateTime.now())
                        .fetchedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .sourceUrl((String) props.get("url"))
                        .build();

                eventRepository.save(event);
                saved++;
                log.info("✅ Saved earthquake: {} | Mag: {} | Severity: {}",
                        event.getTitle(), magnitude, severity);

                if (severity.equals("HIGH") || severity.equals("CRITICAL")) {
                    alertService.broadcastAlert(event);
                }
            }

            log.info("🌍 USGS sync complete — {} new earthquakes saved", saved);

        } catch (Exception e) {
            log.error("❌ USGS fetch failed: {}", e.getMessage());
        }
    }
}
