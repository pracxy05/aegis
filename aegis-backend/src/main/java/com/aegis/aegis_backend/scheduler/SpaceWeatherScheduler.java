package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class SpaceWeatherScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;

    // NOAA Kp Index — 0-9 geomagnetic storm scale
    private static final String KP_URL =
        "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";

    @Scheduled(fixedRate = 1800000) // 30 minutes
    public void fetchSpaceWeather() {
        log.info("🌞 Fetching NOAA space weather Kp index...");
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<List<List<Object>>> response = restTemplate.exchange(
                KP_URL, HttpMethod.GET, entity,
                new ParameterizedTypeReference<List<List<Object>>>() {}
            );

            List<List<Object>> rows = response.getBody();
            if (rows == null || rows.size() < 2) return;

            // Last row is latest reading
            List<Object> latest = rows.get(rows.size() - 1);
            String timeTag = latest.get(0).toString();
            double kp = Double.parseDouble(latest.get(1).toString());

            String externalId = "KP_" + timeTag;
            if (eventRepository.findByExternalId(externalId).isPresent()) return;

            // Only save notable events (Kp >= 4 = minor storm)
            if (kp < 4.0) {
                log.info("🌞 Kp={} — quiet, skipping", kp);
                return;
            }

            String severity;
            String description;
            if      (kp >= 8) { severity = "CRITICAL"; description = "Extreme geomagnetic storm (G4-G5). GPS/radio blackouts possible worldwide."; }
            else if (kp >= 6) { severity = "HIGH";     description = "Strong geomagnetic storm (G2-G3). HF radio disruptions. Aurora visible at mid-latitudes."; }
            else if (kp >= 5) { severity = "MEDIUM";   description = "Minor geomagnetic storm (G1). Power grid fluctuations. Aurora at high latitudes."; }
            else              { severity = "LOW";      description = "Active geomagnetic conditions. Kp=" + kp; }

            Event event = Event.builder()
                    .externalId(externalId)
                    .title("Geomagnetic Storm — Kp " + kp)
                    .eventType("SOLAR_FLARE")
                    .source("NOAA_SWPC")
                    .latitude(0.0)
                    .longitude(0.0)
                    .magnitude(kp)
                    .severity(severity)
                    .description(description)
                    .eventTime(LocalDateTime.now())
                    .fetchedAt(LocalDateTime.now())
                    .status("ACTIVE")
                    .sourceUrl("https://www.swpc.noaa.gov/products/planetary-k-index")
                    .build();

            eventRepository.save(event);
            alertService.broadcastAlert(event);
            log.info("🌞 Geomagnetic storm saved — Kp={}, severity={}", kp, severity);

        } catch (Exception ex) {
            log.error("❌ NOAA space weather fetch failed: {}", ex.getMessage());
        }
    }
}
