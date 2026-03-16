from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Load model on startup
model = joblib.load("model/severity_model.pkl")
le    = joblib.load("model/label_encoder.pkl")

EVENT_TYPE_MAP = {
    "EARTHQUAKE":  0,
    "WILDFIRE":    1,
    "STORM":       2,
    "ASTEROID":    3,
    "VOLCANO":     4,
    "SOLAR_FLARE": 5,
    "FLOOD":       2,
    "NATURAL_EVENT": 1,
    "ICE_EVENT":   1,
    "DROUGHT":     1,
    "DUST_STORM":  2,
    "LANDSLIDE":   1,
    "LAUNCH":      1,
}

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "AEGIS ML online", "model": "RandomForest"})


@app.route("/predict", methods=["POST"])
def predict():
    """
    Predict severity for a single event.
    Body: { magnitude, depth, latitude, longitude, eventType }
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    magnitude  = float(data.get("magnitude")  or 0)
    depth      = float(data.get("depth")      or 0)
    latitude   = float(data.get("latitude")   or 0)
    longitude  = float(data.get("longitude")  or 0)
    event_type = data.get("eventType", "EARTHQUAKE").upper()

    event_enc  = EVENT_TYPE_MAP.get(event_type, 0)
    features   = np.array([[magnitude, depth, latitude, longitude, event_enc]])

    pred_enc   = model.predict(features)[0]
    proba      = model.predict_proba(features)[0]
    predicted  = le.inverse_transform([pred_enc])[0]

    # Build confidence map
    confidence = {
        le.classes_[i]: round(float(proba[i]) * 100, 1)
        for i in range(len(le.classes_))
    }

    return jsonify({
        "predictedSeverity": predicted,
        "confidence": confidence,
        "topConfidence": round(float(max(proba)) * 100, 1),
        "inputFeatures": {
            "magnitude": magnitude,
            "depth": depth,
            "latitude": latitude,
            "longitude": longitude,
            "eventType": event_type
        }
    })


@app.route("/predict/batch", methods=["POST"])
def predict_batch():
    """
    Predict severity for multiple events at once.
    Body: { events: [ { magnitude, depth, latitude, longitude, eventType, id } ] }
    """
    data = request.get_json()
    if not data or "events" not in data:
        return jsonify({"error": "No events provided"}), 400

    results = []
    events  = data["events"]

    for ev in events:
        magnitude  = float(ev.get("magnitude")  or 0)
        depth_raw  = ev.get("description", "")
        depth      = 0.0

        # Parse depth from description string "Depth: 10 km"
        if "Depth:" in str(depth_raw):
            try:
                depth = float(str(depth_raw).split("Depth:")[1].split("km")[0].strip())
            except:
                depth = 0.0

        latitude   = float(ev.get("latitude")   or 0)
        longitude  = float(ev.get("longitude")  or 0)
        event_type = str(ev.get("eventType", "EARTHQUAKE")).upper()
        event_enc  = EVENT_TYPE_MAP.get(event_type, 0)

        features  = np.array([[magnitude, depth, latitude, longitude, event_enc]])
        pred_enc  = model.predict(features)[0]
        proba     = model.predict_proba(features)[0]
        predicted = le.inverse_transform([pred_enc])[0]

        results.append({
            "id":               ev.get("id"),
            "predictedSeverity": predicted,
            "topConfidence":    round(float(max(proba)) * 100, 1),
            "confidence": {
                le.classes_[i]: round(float(proba[i]) * 100, 1)
                for i in range(len(le.classes_))
            }
        })

    return jsonify({"predictions": results, "count": len(results)})


@app.route("/earth-score", methods=["POST"])
def earth_score():
    """
    Compute AI-based Earth Threat Score from all active events.
    Body: { events: [...] }
    Returns: { score: 0-100, level: "SAFE"|"CAUTION"|"DANGER"|"CRITICAL" }
    """
    data   = request.get_json()
    events = data.get("events", [])

    if not events:
        return jsonify({"score": 100, "level": "SAFE"})

    total_risk = 0.0
    weights = {"CRITICAL": 25, "HIGH": 10, "MEDIUM": 4, "LOW": 1}

    for ev in events:
        magnitude  = float(ev.get("magnitude")  or 0)
        depth      = 0.0
        depth_raw  = ev.get("description", "")
        if "Depth:" in str(depth_raw):
            try:
                depth = float(str(depth_raw).split("Depth:")[1].split("km")[0].strip())
            except:
                depth = 0.0

        latitude   = float(ev.get("latitude")   or 0)
        longitude  = float(ev.get("longitude")  or 0)
        event_type = str(ev.get("eventType", "EARTHQUAKE")).upper()
        event_enc  = EVENT_TYPE_MAP.get(event_type, 0)

        features  = np.array([[magnitude, depth, latitude, longitude, event_enc]])
        pred_enc  = model.predict(features)[0]
        predicted = le.inverse_transform([pred_enc])[0]
        proba_max = float(max(model.predict_proba(features)[0]))

        risk = weights.get(predicted, 1) * proba_max
        total_risk += risk

    # Normalize to 0-100 score (100 = safest)
    score = max(0, round(100 - min(total_risk, 100)))

    if score >= 75:   level = "SAFE"
    elif score >= 50: level = "CAUTION"
    elif score >= 25: level = "DANGER"
    else:             level = "CRITICAL"

    return jsonify({
        "score":       score,
        "level":       level,
        "eventsAnalyzed": len(events),
        "totalRisk":   round(total_risk, 2)
    })


if __name__ == "__main__":
    print("🧠 AEGIS ML Service starting on port 5001...")
    app.run(host="0.0.0.0", port=5001, debug=False)
