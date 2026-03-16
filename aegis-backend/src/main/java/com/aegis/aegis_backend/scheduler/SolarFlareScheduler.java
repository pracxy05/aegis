package com.aegis.aegis_backend.scheduler;

import com.aegis.aegis_backend.model.Event;
import com.aegis.aegis_backend.repository.EventRepository;
import com.aegis.aegis_backend.service.AlertService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class SolarFlareScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;

    @Value("${api.nasa.key}")
    private String nasaApiKey;

    @Scheduled(fixedRate = 3600000) // every 1 hour
    @SuppressWarnings("unchecked")
    public void fetchSolarFlares() {
        log.info("🌞 Fetching NASA solar flare data...");
        try {
            String startDate = LocalDate.now().minusDays(7).toString();
            String endDate = LocalDate.now().toString();
            String url = "https://api.nasa.gov/DONKI/FLR?startDate=" + startDate
                       + "&endDate=" + endDate + "&api_key=" + nasaApiKey;

            List<Map<String, Object>> flares = restTemplate.getForObject(url, List.class);
            if (flares == null) return;

            int saved = 0;
            for (Map<String, Object> flare : flares) {
                String externalId = "FLR_" + flare.get("flrID");
                if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                String classType = (String) flare.get("classType");    // e.g. X1.5, M3.2, C5
                String beginTime = (String) flare.get("beginTime");

                // Classify severity by solar flare class
                String severity = "LOW";
                if (classType != null) {
                    if (classType.startsWith("X")) severity = "CRITICAL";
                    else if (classType.startsWith("M")) severity = "HIGH";
                    else if (classType.startsWith("C")) severity = "MEDIUM";
                }

                Event event = Event.builder()
                        .externalId(externalId)
                        .title("Solar Flare: Class " + classType)
                        .eventType("SOLAR_FLARE")
                        .source("NASA_DONKI")
                        .latitude(0.0)
                        .longitude(0.0)
                        .severity(severity)
                        .description("Class: " + classType + " | Begin: " + beginTime
                            + " | Potential GPS/radio disruption")
                        .eventTime(LocalDateTime.now())
                        .fetchedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .sourceUrl("https://kauai.ccmc.gsfc.nasa.gov/DONKI/")
                        .build();

                eventRepository.save(event);
                saved++;
                log.info("✅ Saved solar flare: Class {} | Severity: {}", classType, severity);

                if (severity.equals("HIGH") || severity.equals("CRITICAL")) {
                    alertService.broadcastAlert(event);
                }
            }
            log.info("🌞 Solar flare sync complete — {} new flares saved", saved);

        } catch (Exception ex) {
            log.error("❌ Solar flare fetch failed: {}", ex.getMessage());
        }
    }
}
