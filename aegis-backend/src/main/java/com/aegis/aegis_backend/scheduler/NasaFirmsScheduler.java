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

import java.time.LocalDateTime;
import java.util.*;

@Component
@RequiredArgsConstructor
@Slf4j
public class NasaFirmsScheduler {

    private final EventRepository eventRepository;
    private final RestTemplate restTemplate;
    private final AlertService alertService;

    @Value("${api.nasa.firms.key}")
    private String firmsKey;

    // FIRMS returns CSV — we fetch and parse it
    // VIIRS NRT — Near Real Time, updates every 3 hours
    @Scheduled(fixedRate = 10800000) // 3 hours
    public void fetchActiveFires() {
        log.info("🔥 Fetching NASA FIRMS active fire data...");
        try {
            String url = "https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
                + firmsKey + "/VIIRS_SNPP_NRT/world/1";

            String csv = restTemplate.getForObject(url, String.class);
            if (csv == null || csv.isBlank()) return;

            String[] lines = csv.split("\n");
            int saved = 0;

            // Skip header line
            for (int i = 1; i < lines.length && i < 200; i++) {
                String[] cols = lines[i].split(",");
                if (cols.length < 9) continue;

                try {
                    double lat    = Double.parseDouble(cols[0].trim());
                    double lon    = Double.parseDouble(cols[1].trim());
                    double bright = Double.parseDouble(cols[2].trim()); // brightness temp K
                    String date   = cols[5].trim(); // acq_date
                    String time   = cols[6].trim(); // acq_time
                    double frp    = Double.parseDouble(cols[9].trim()); // fire radiative power MW

                    String externalId = "FIRMS_" + date + "_" + lat + "_" + lon;
                    if (eventRepository.findByExternalId(externalId).isPresent()) continue;

                    // Severity by Fire Radiative Power (MW)
                    String severity;
                    if      (frp >= 500) severity = "CRITICAL";
                    else if (frp >= 100) severity = "HIGH";
                    else if (frp >= 20)  severity = "MEDIUM";
                    else                 severity = "LOW";

                    Event event = Event.builder()
                            .externalId(externalId)
                            .title("Active Wildfire — " + date)
                            .eventType("WILDFIRE")
                            .source("NASA_FIRMS")
                            .latitude(lat)
                            .longitude(lon)
                            .magnitude(frp) // store FRP as magnitude
                            .severity(severity)
                            .description(String.format(
                                "NASA FIRMS VIIRS fire detection. Brightness: %.0fK, FRP: %.1f MW",
                                bright, frp))
                            .eventTime(LocalDateTime.now())
                            .fetchedAt(LocalDateTime.now())
                            .status("ACTIVE")
                            .sourceUrl("https://firms.modaps.eosdis.nasa.gov/map/")
                            .build();

                    eventRepository.save(event);
                    saved++;

                    if (severity.equals("CRITICAL") || severity.equals("HIGH")) {
                        alertService.broadcastAlert(event);
                    }
                } catch (NumberFormatException ignored) {}
            }

            log.info("🔥 FIRMS sync complete — {} new fire events saved", saved);

        } catch (Exception ex) {
            log.error("❌ NASA FIRMS fetch failed: {}", ex.getMessage());
        }
    }
}
