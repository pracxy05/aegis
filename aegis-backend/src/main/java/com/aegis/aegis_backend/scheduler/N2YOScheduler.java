package com.aegis.aegis_backend.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;

import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class N2YOScheduler {

    private final RestTemplate restTemplate;

    @Value("${api.n2yo.key}")
    private String n2yoKey;

    // Store latest positions in memory — no DB needed, just for live globe
    private volatile Map<String, Object> issPosition   = null;
    private volatile Map<String, Object> hubblePosition = null;

    // NORAD IDs
    private static final int ISS_ID    = 25544;
    private static final int HUBBLE_ID = 20580;

    @Scheduled(fixedRate = 30000) // every 30 seconds
    public void fetchSatellitePositions() {
        issPosition    = fetchPosition(ISS_ID,    "ISS");
        hubblePosition = fetchPosition(HUBBLE_ID, "Hubble");
    }

    private Map<String, Object> fetchPosition(int noradId, String name) {
        try {
            // observer at 0,0,0 (returns satellite position regardless)
            String url = String.format(
                "https://api.n2yo.com/rest/v1/satellite/positions/%d/0/0/0/1/&apiKey=%s",
                noradId, n2yoKey
            );
            HttpHeaders headers = new HttpHeaders();
            headers.set("Accept", "application/json");
            HttpEntity<String> entity = new HttpEntity<>(headers);

            ResponseEntity<Map<String, Object>> res = restTemplate.exchange(
                url, HttpMethod.GET, entity,
                new ParameterizedTypeReference<Map<String, Object>>() {}
            );
            log.debug("🛸 {} position fetched", name);
            return res.getBody();
        } catch (Exception e) {
            log.warn("⚠️ N2YO {} fetch failed: {}", name, e.getMessage());
            return null;
        }
    }

    public Map<String, Object> getIssPosition()    { return issPosition; }
    public Map<String, Object> getHubblePosition() { return hubblePosition; }
}
