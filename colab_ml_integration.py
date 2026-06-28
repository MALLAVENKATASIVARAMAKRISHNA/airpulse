# -*- coding: utf-8 -*-
"""
AirPulse ML Integration — Google Colab Notebook
================================================
Run cells in order. Only Cell 3 (populate node tables) needs to be run once.
All other cells can be re-run anytime to refresh predictions.

RDS: airpulse-db.c52y26y4sdyz.ap-south-1.rds.amazonaws.com
DB : airpulse | User: airpulse_admin
"""

# ============================================================
# CELL 1 — Install packages
# ============================================================
# Paste this in Cell 1 and run it

"""
!pip install psycopg2-binary catboost xgboost scikit-learn pandas numpy joblib -q
"""

# ============================================================
# CELL 2 — Connect to RDS + mount Drive
# ============================================================

import psycopg2
import psycopg2.extras
import pandas as pd
import numpy as np
import joblib
import warnings
warnings.filterwarnings('ignore')

from google.colab import drive
drive.mount('/content/drive')

DB = {
    'host':     'airpulse-db.c52y26y4sdyz.ap-south-1.rds.amazonaws.com',
    'port':     5432,
    'dbname':   'airpulse',
    'user':     'airpulse_admin',
    'password': 'airpulseAdmin123456',
    'sslmode':  'require',
}

def get_conn():
    return psycopg2.connect(**DB)

def rds_query(sql, params=None, fetch=True):
    conn = get_conn()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params or ())
    if fetch:
        rows = cur.fetchall()
        conn.close()
        return rows
    conn.commit()
    conn.close()

print("Connected to RDS successfully")

# ============================================================
# CELL 3 — Populate node_metadata + node_weather from CSV
# RUN THIS ONLY ONCE
# ============================================================

# Change this path to wherever your CSV is on Google Drive
CSV_PATH = "/content/drive/MyDrive/aqi_5node_dataset (1).csv"

df_csv = pd.read_csv(CSV_PATH)
print("CSV shape:", df_csv.shape)
print("Columns:", df_csv.columns.tolist())

# Rename CSV columns to standard names
COL_MAP = {
    'node_id': 'node_id', 'Node_ID': 'node_id',
    'latitude': 'latitude', 'Latitude': 'latitude',
    'longitude': 'longitude', 'Longitude': 'longitude',
    'zone_type': 'zone_type', 'Zone_Type': 'zone_type',
    'near_highway': 'near_highway', 'Near_Highway': 'near_highway',
    'near_factory': 'near_factory', 'Near_Factory': 'near_factory',
    'near_construction': 'near_construction', 'Near_Construction': 'near_construction',
    'population_density': 'population_density', 'Population_Density': 'population_density',
    'green_cover_percentage': 'green_cover_pct', 'Green_Cover_Percentage': 'green_cover_pct',
    'temperature': 'temperature', 'Temperature': 'temperature',
    'humidity': 'humidity', 'Humidity': 'humidity',
    'pressure': 'pressure', 'Pressure': 'pressure',
    'wind_speed': 'wind_speed', 'Wind_Speed': 'wind_speed',
    'rainfall': 'rainfall', 'Rainfall': 'rainfall',
    'visibility': 'visibility', 'Visibility': 'visibility',
    'traffic_density': 'traffic_density', 'Traffic_Density': 'traffic_density',
}
df_csv = df_csv.rename(columns={k: v for k, v in COL_MAP.items() if k in df_csv.columns})

if 'node_id' in df_csv.columns:
    df_csv['node_id'] = df_csv['node_id'].astype(str).str.replace('_', '', regex=False)

# Hardcoded defaults per node (used when CSV doesn't have the column)
NODE_META = {
    'NODE001': {'latitude': 13.1627, 'longitude': 80.2619, 'zone_type': 'Industrial',  'zone_type_code': 2, 'near_highway': True,  'near_factory': True,  'near_construction': False, 'population_density': 60,  'green_cover_pct': 5.0},
    'NODE002': {'latitude': 13.0850, 'longitude': 80.2101, 'zone_type': 'Residential', 'zone_type_code': 0, 'near_highway': False, 'near_factory': False, 'near_construction': False, 'population_density': 80,  'green_cover_pct': 22.0},
    'NODE003': {'latitude': 13.0418, 'longitude': 80.2341, 'zone_type': 'Commercial',  'zone_type_code': 1, 'near_highway': True,  'near_factory': False, 'near_construction': True,  'population_density': 90,  'green_cover_pct': 8.0},
    'NODE004': {'latitude': 13.0569, 'longitude': 80.2521, 'zone_type': 'Commercial',  'zone_type_code': 1, 'near_highway': True,  'near_factory': False, 'near_construction': False, 'population_density': 85,  'green_cover_pct': 10.0},
    'NODE005': {'latitude': 13.0604, 'longitude': 80.2496, 'zone_type': 'Residential', 'zone_type_code': 0, 'near_highway': False, 'near_factory': False, 'near_construction': False, 'population_density': 40,  'green_cover_pct': 45.0},
}
WEATHER_DEFAULTS = {'temperature': 32.0, 'humidity': 72.0, 'pressure': 1010.0, 'wind_speed': 8.0, 'rainfall': 0.5, 'visibility': 8.0, 'traffic_density': 50.0}

conn = get_conn()
cur  = conn.cursor()

for node_id, meta in NODE_META.items():
    csv_node = df_csv[df_csv['node_id'] == node_id] if 'node_id' in df_csv.columns else pd.DataFrame()

    def cv(col, default):
        return csv_node[col].iloc[0] if (not csv_node.empty and col in csv_node.columns) else default

    cur.execute("""
        INSERT INTO node_metadata
            (node_id, latitude, longitude, zone_type, zone_type_code,
             near_highway, near_factory, near_construction,
             population_density, green_cover_percentage)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (node_id) DO UPDATE SET
            latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude,
            zone_type=EXCLUDED.zone_type, zone_type_code=EXCLUDED.zone_type_code,
            near_highway=EXCLUDED.near_highway, near_factory=EXCLUDED.near_factory,
            near_construction=EXCLUDED.near_construction,
            population_density=EXCLUDED.population_density,
            green_cover_percentage=EXCLUDED.green_cover_percentage
    """, (node_id, cv('latitude', meta['latitude']), cv('longitude', meta['longitude']),
          cv('zone_type', meta['zone_type']), int(cv('zone_type_code', meta['zone_type_code'])),
          bool(cv('near_highway', meta['near_highway'])), bool(cv('near_factory', meta['near_factory'])),
          bool(cv('near_construction', meta['near_construction'])),
          int(cv('population_density', meta['population_density'])),
          float(cv('green_cover_pct', meta['green_cover_pct']))))

    wrow = {}
    for col, default in WEATHER_DEFAULTS.items():
        if not csv_node.empty and col in csv_node.columns:
            val = csv_node[col].mean()
            wrow[col] = default if np.isnan(val) else float(val)
        else:
            wrow[col] = default

    cur.execute("""
        INSERT INTO node_weather
            (node_id, temperature, humidity, pressure, wind_speed, rainfall, visibility, traffic_density)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (node_id) DO UPDATE SET
            temperature=EXCLUDED.temperature, humidity=EXCLUDED.humidity,
            pressure=EXCLUDED.pressure, wind_speed=EXCLUDED.wind_speed,
            rainfall=EXCLUDED.rainfall, visibility=EXCLUDED.visibility,
            traffic_density=EXCLUDED.traffic_density, updated_at=NOW()
    """, (node_id, wrow['temperature'], wrow['humidity'], wrow['pressure'],
          wrow['wind_speed'], wrow['rainfall'], wrow['visibility'], wrow['traffic_density']))

conn.commit()
conn.close()
print("node_metadata + node_weather populated successfully")

# ============================================================
# CELL 4 — Load full training data from RDS
# ============================================================

rows = rds_query("""
    SELECT
        r.reading_id, r.node_id, r.aqi, r.pm25, r.pm10, r.co, r.nh3,
        r.no2, r.ozone, r.co2, r.voc, r.smoke, r.recorded_at,
        r.dominant_pollutant, r.cause,
        m.latitude, m.longitude, m.zone_type_code,
        m.near_highway::int, m.near_factory::int, m.near_construction::int,
        m.population_density, m.green_cover_percentage,
        w.temperature, w.humidity, w.pressure,
        w.wind_speed, w.rainfall, w.visibility, w.traffic_density
    FROM aqi_readings r
    JOIN node_metadata m ON m.node_id = r.node_id
    JOIN node_weather  w ON w.node_id = r.node_id
    ORDER BY r.node_id, r.recorded_at
""")

df = pd.DataFrame(rows)
print("Rows loaded from RDS:", df.shape)

# Time features
df['recorded_at'] = pd.to_datetime(df['recorded_at'])
df['hour']    = df['recorded_at'].dt.hour
df['day']     = df['recorded_at'].dt.day
df['month']   = df['recorded_at'].dt.month
df['weekday'] = df['recorded_at'].dt.weekday
df['weekend'] = (df['weekday'] >= 5).astype(int)
df['rush_hour'] = df['hour'].apply(lambda h: 1 if (7 <= h <= 10 or 17 <= h <= 20) else 0)

# Encode node_id as integer
node_enc = {n: i for i, n in enumerate(sorted(df['node_id'].unique()))}
df['node_id_enc'] = df['node_id'].map(node_enc)

# Lag + rolling features per node
df = df.sort_values(['node_id', 'recorded_at']).reset_index(drop=True)

for lag in [1, 3, 6, 12, 24]:
    df[f'aqi_lag_{lag}'] = df.groupby('node_id')['aqi'].shift(lag)

df['aqi_roll_mean_6']  = df.groupby('node_id')['aqi'].transform(lambda x: x.rolling(6,  min_periods=1).mean())
df['aqi_roll_mean_24'] = df.groupby('node_id')['aqi'].transform(lambda x: x.rolling(24, min_periods=1).mean())
df['aqi_roll_std_6']   = df.groupby('node_id')['aqi'].transform(lambda x: x.rolling(6,  min_periods=1).std().fillna(0))

# Future AQI targets
df['aqi_after_6h']  = df.groupby('node_id')['aqi'].shift(-6)
df['aqi_after_24h'] = df.groupby('node_id')['aqi'].shift(-24)
df['aqi_after_48h'] = df.groupby('node_id')['aqi'].shift(-48)

df = df.dropna().reset_index(drop=True)
print("After feature engineering:", df.shape)

# ============================================================
# CELL 5 — Train CatBoost Forecast Model + Save to RDS
# ============================================================

from catboost import CatBoostRegressor
from sklearn.metrics import mean_absolute_error, r2_score

FEATURES = [
    'node_id_enc', 'latitude', 'longitude', 'zone_type_code',
    'hour', 'day', 'month', 'weekday', 'weekend', 'rush_hour',
    'temperature', 'humidity', 'pressure', 'wind_speed', 'rainfall', 'visibility',
    'pm25', 'pm10', 'co', 'nh3', 'no2', 'ozone', 'co2', 'voc', 'smoke',
    'traffic_density', 'population_density', 'near_highway', 'near_factory',
    'near_construction', 'green_cover_percentage',
    'aqi', 'aqi_lag_1', 'aqi_lag_3', 'aqi_lag_6', 'aqi_lag_12', 'aqi_lag_24',
    'aqi_roll_mean_6', 'aqi_roll_mean_24', 'aqi_roll_std_6',
]

split   = int(len(df) * 0.8)
X_train = df[FEATURES].iloc[:split]
X_test  = df[FEATURES].iloc[split:]

models = {}

for horizon, target in [('6h', 'aqi_after_6h'), ('24h', 'aqi_after_24h'), ('48h', 'aqi_after_48h')]:
    y_train = df[target].iloc[:split]
    y_test  = df[target].iloc[split:]

    cat = CatBoostRegressor(iterations=500, depth=8, learning_rate=0.05, verbose=False, random_seed=42)
    cat.fit(X_train, y_train)
    pred = cat.predict(X_test)

    print(f"{horizon} — MAE: {mean_absolute_error(y_test, pred):.1f}  R²: {r2_score(y_test, pred):.3f}")

    models[horizon] = cat
    joblib.dump(cat, f"/content/drive/MyDrive/aqi_forecast_{horizon}.pkl")

# Save predictions for latest reading per node to RDS
conn = get_conn()
cur  = conn.cursor()
cur.execute("DELETE FROM aqi_predictions")

latest = df.sort_values('recorded_at').groupby('node_id').tail(1)

for _, row in latest.iterrows():
    feat = row[FEATURES].values.reshape(1, -1)
    for horizon, model in models.items():
        pred_aqi = int(np.clip(model.predict(feat)[0], 0, 500))
        hours_ahead = 6 if horizon == '6h' else 24 if horizon == '24h' else 48
        cur.execute("""
            INSERT INTO aqi_predictions (node_id, predicted_aqi, predicted_for, horizon, created_at)
            VALUES (%s, %s, NOW() + (%s * INTERVAL '1 hour'), %s, NOW())
        """, (row['node_id'], pred_aqi, hours_ahead, horizon))

conn.commit()
conn.close()
print("Predictions saved to RDS successfully")

# ============================================================
# CELL 6 — Anomaly Detection (Isolation Forest)
# ============================================================

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

ANOMALY_FEATURES = ['aqi', 'pm25', 'pm10', 'co', 'co2', 'no2', 'ozone', 'voc', 'smoke',
                    'temperature', 'humidity', 'traffic_density']

X_anom   = df[ANOMALY_FEATURES].fillna(0)
scaler   = StandardScaler()
X_scaled = scaler.fit_transform(X_anom)

iso = IsolationForest(n_estimators=300, contamination=0.02, random_state=42, n_jobs=-1)
iso.fit(X_scaled)
df['anomaly'] = iso.predict(X_scaled)

anomaly_count = (df['anomaly'] == -1).sum()
print(f"Anomalies detected: {anomaly_count} out of {len(df)} readings ({anomaly_count/len(df)*100:.1f}%)")

joblib.dump(iso,    "/content/drive/MyDrive/anomaly_detector.pkl")
joblib.dump(scaler, "/content/drive/MyDrive/anomaly_scaler.pkl")

conn = get_conn()
cur  = conn.cursor()
cur.execute("UPDATE aqi_readings SET is_anomaly = FALSE")

anomaly_ids = df.loc[df['anomaly'] == -1, 'reading_id'].astype(int).tolist()
if anomaly_ids:
    cur.execute("UPDATE aqi_readings SET is_anomaly = TRUE WHERE reading_id = ANY(%s)", (anomaly_ids,))

conn.commit()
conn.close()
print("Anomaly flags updated in RDS successfully")

# ============================================================
# CELL 7 — Cause Analysis (Rule-Based → Update RDS)
# ============================================================

def identify_cause(pm25, pm10, co, co2, no2, ozone, smoke, traffic, near_factory, near_construction, wind_speed, rainfall):
    scores = {}

    v = 0
    if traffic > 70:       v += 35
    if co > 2:             v += 25
    if no2 > 40:           v += 20
    if pm25 > 80:          v += 20
    scores['Vehicle Emissions'] = v

    i = 0
    if near_factory:       i += 35
    if co2 > 800:          i += 25
    if no2 > 45:           i += 20
    if ozone > 80:         i += 20
    scores['Industrial Emissions'] = i

    c = 0
    if near_construction:  c += 40
    if pm10 > 150:         c += 35
    if wind_speed > 10:    c += 15
    scores['Construction Dust'] = c

    b = 0
    if smoke > 70:         b += 40
    if co > 2:             b += 20
    if pm25 > 100:         b += 25
    scores['Waste Burning'] = b

    w = 0
    if wind_speed < 2:     w += 30
    if rainfall == 0:      w += 20
    if pm25 > 90:          w += 25
    scores['Weather Conditions'] = w

    best = max(scores, key=scores.get)
    return best

conn = get_conn()
cur  = conn.cursor()

updated = 0
for _, row in df.iterrows():
    cause = identify_cause(
        pm25=row['pm25'], pm10=row['pm10'], co=row['co'], co2=row['co2'],
        no2=row['no2'], ozone=row['ozone'], smoke=row['smoke'],
        traffic=row['traffic_density'], near_factory=bool(row['near_factory']),
        near_construction=bool(row['near_construction']),
        wind_speed=row['wind_speed'], rainfall=row['rainfall'],
    )
    cur.execute("UPDATE aqi_readings SET cause = %s WHERE reading_id = %s", (cause, int(row['reading_id'])))
    updated += 1

conn.commit()
conn.close()
print(f"Cause updated for {updated} readings in RDS successfully")

# ============================================================
# CELL 8 — Hotspot Clustering (DBSCAN) → Save to RDS
# ============================================================

from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler as SS2

station = df.groupby('node_id').agg(
    latitude        =('latitude', 'first'),
    longitude       =('longitude', 'first'),
    aqi             =('aqi', 'mean'),
    pm25            =('pm25', 'mean'),
    pm10            =('pm10', 'mean'),
    traffic_density =('traffic_density', 'mean'),
).reset_index()

X_clust  = station[['latitude', 'longitude', 'aqi', 'pm25', 'pm10', 'traffic_density']]
X_scaled = SS2().fit_transform(X_clust)

db = DBSCAN(eps=1.5, min_samples=2)
station['cluster'] = db.fit_predict(X_scaled)

print(station[['node_id', 'aqi', 'cluster']].to_string())

CLUSTER_LABELS = {-1: 'Isolated Station', 0: 'High Pollution Zone', 1: 'Moderate Zone', 2: 'Clean Zone'}

conn = get_conn()
cur  = conn.cursor()
cur.execute("TRUNCATE hotspot_clusters")

for cid in station['cluster'].unique():
    nodes_in  = station[station['cluster'] == cid]
    node_ids  = nodes_in['node_id'].tolist()
    centroid  = int(nodes_in['aqi'].mean())
    label     = CLUSTER_LABELS.get(int(cid), f'Zone {cid}')
    cur.execute(
        "INSERT INTO hotspot_clusters (node_ids, centroid_aqi, label) VALUES (%s, %s, %s)",
        (node_ids, centroid, label)
    )

conn.commit()
conn.close()
print("Hotspot clusters saved to RDS successfully")

# ============================================================
print("\n====== ALL CELLS COMPLETE ======")
print("Predictions   → aqi_predictions table")
print("Anomalies     → aqi_readings.is_anomaly")
print("Causes        → aqi_readings.cause")
print("Hotspots      → hotspot_clusters table")
print("Models saved  → Google Drive")
