import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import os

# Synthetic training data based on real earthquake/event patterns
np.random.seed(42)
n = 2000

data = []

# Earthquakes
for _ in range(600):
    mag   = np.random.uniform(0.5, 9.5)
    depth = np.random.uniform(1, 700)
    lat   = np.random.uniform(-90, 90)
    lon   = np.random.uniform(-180, 180)
    etype = 0  # EARTHQUAKE

    if mag >= 7.0 and depth < 70:     severity = "CRITICAL"
    elif mag >= 6.0 and depth < 100:  severity = "HIGH"
    elif mag >= 4.5:                  severity = "MEDIUM"
    else:                             severity = "LOW"
    data.append([mag, depth, lat, lon, etype, severity])

# Wildfires
for _ in range(300):
    mag   = 0.0
    depth = 0.0
    lat   = np.random.uniform(-60, 70)
    lon   = np.random.uniform(-180, 180)
    etype = 1  # WILDFIRE
    severity = np.random.choice(
        ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        p=[0.2, 0.3, 0.35, 0.15]
    )
    data.append([mag, depth, lat, lon, etype, severity])

# Storms
for _ in range(300):
    mag   = np.random.uniform(0, 5)
    depth = 0.0
    lat   = np.random.uniform(-40, 40)
    lon   = np.random.uniform(-180, 180)
    etype = 2  # STORM
    severity = np.random.choice(
        ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
        p=[0.15, 0.35, 0.35, 0.15]
    )
    data.append([mag, depth, lat, lon, etype, severity])

# Asteroids
for _ in range(400):
    mag   = np.random.uniform(0, 2)     # diameter proxy
    depth = np.random.uniform(0, 200)  # miss distance proxy (millions km)
    lat   = 0.0
    lon   = 0.0
    etype = 3  # ASTEROID
    if depth < 5:       severity = "CRITICAL"
    elif depth < 20:    severity = "HIGH"
    elif depth < 60:    severity = "MEDIUM"
    else:               severity = "LOW"
    data.append([mag, depth, lat, lon, etype, severity])

# Volcanoes
for _ in range(200):
    mag   = np.random.uniform(0, 3)
    depth = np.random.uniform(0, 50)
    lat   = np.random.uniform(-60, 70)
    lon   = np.random.uniform(-180, 180)
    etype = 4  # VOLCANO
    severity = np.random.choice(
        ["MEDIUM", "HIGH", "CRITICAL"],
        p=[0.3, 0.5, 0.2]
    )
    data.append([mag, depth, lat, lon, etype, severity])

# Solar Flares
for _ in range(200):
    mag   = np.random.uniform(0, 10)   # flare class proxy
    depth = 0.0
    lat   = 0.0
    lon   = 0.0
    etype = 5  # SOLAR_FLARE
    if mag >= 8:        severity = "CRITICAL"
    elif mag >= 5:      severity = "HIGH"
    elif mag >= 2:      severity = "MEDIUM"
    else:               severity = "LOW"
    data.append([mag, depth, lat, lon, etype, severity])

df = pd.DataFrame(data, columns=["magnitude", "depth", "latitude", "longitude", "event_type_enc", "severity"])

X = df[["magnitude", "depth", "latitude", "longitude", "event_type_enc"]]
y = df["severity"]

le = LabelEncoder()
y_enc = le.fit_transform(y)

model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
model.fit(X, y_enc)

os.makedirs("model", exist_ok=True)
joblib.dump(model, "model/severity_model.pkl")
joblib.dump(le,    "model/label_encoder.pkl")

print("✅ Model trained!")
print(f"   Classes: {le.classes_}")
print(f"   Features: {X.columns.tolist()}")
print(f"   Training samples: {len(df)}")
