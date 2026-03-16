package com.aegis.aegis_backend.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/astronomy")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AstronomyController {

    private final RestTemplate restTemplate;

    @Value("${api.astronomy.id}")
    private String appId;

    @Value("${api.astronomy.secret}")
    private String appSecret;

    private String getAuthHeader() {
        String creds = appId + ":" + appSecret;
        return "Basic " + Base64.getEncoder().encodeToString(creds.getBytes());
    }

    // Star chart for a given RA/Dec
    @GetMapping("/star-chart")
    public ResponseEntity<Object> getStarChart(
            @RequestParam(defaultValue = "0") double lat,
            @RequestParam(defaultValue = "0") double lon
    ) {
        try {
            String url = "https://api.astronomyapi.com/api/v2/studio/star-chart";
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", getAuthHeader());
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Request body for a sky chart
            String body = String.format("""
                {
                  "style": "navy",
                  "observer": {
                    "latitude": %s,
                    "longitude": %s,
                    "date": "%s"
                  },
                  "view": {
                    "type": "area",
                    "parameters": {
                      "position": { "equatorial": { "rightAscension": 0, "declination": 0 } },
                      "zoom": 2
                    }
                  }
                }
                """,
                lat, lon,
                java.time.LocalDate.now().toString()
            );

            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.POST, entity,
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }

    // Moon phase
    @GetMapping("/moon-phase")
    public ResponseEntity<Object> getMoonPhase() {
        try {
            String url = "https://api.astronomyapi.com/api/v2/studio/moon-phase";
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", getAuthHeader());
            headers.setContentType(MediaType.APPLICATION_JSON);

            String body = String.format("""
                {
                  "format": "png",
                  "style": { "moonStyle": "default", "backgroundStyle": "stars",
                              "backgroundColor": "black", "headingColor": "white",
                              "textColor": "white" },
                  "observer": { "latitude": 17.4, "longitude": 78.5, "date": "%s" },
                  "view": { "type": "portrait-simple", "orientation": "south-up" }
                }
                """,
                java.time.LocalDate.now().toString()
            );

            HttpEntity<String> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Object> res = restTemplate.exchange(
                url, HttpMethod.POST, entity,
                new ParameterizedTypeReference<Object>() {}
            );
            return ResponseEntity.ok(res.getBody());
        } catch (Exception e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }
}
