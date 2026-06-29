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
!pip install psycopg2-binary scikit-learn pandas numpy joblib -q
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
df_csv['node_id'] = df_csv['node_id'].astype(str).str.replace('_', '', regex=False)
print("CSV loaded:", df_csv.shape)

NODE_META = {
    'NODE001': {'lat': 13.1627, 'lon': 80.2619, 'zone': 'Industrial',  'zcode': 2, 'highway': True,  'factory': True,  'construction': False, 'pop': 60,  'green': 5.0},
    'NODE002': {'lat': 13.0850, 'lon': 80.2101, 'zone': 'Residential', 'zcode': 0, 'highway': False, 'factory': False, 'construction': False, 'pop': 80,  'green': 22.0},
    'NODE003': {'lat': 13.0418, 'lon': 80.2341, 'zone': 'Commercial',  'zcode': 1, 'highway': True,  'factory': False, 'construction': True,  'pop': 90,  'green': 8.0},
    'NODE004': {'lat': 13.0569, 'lon': 80.2521, 'zone': 'Commercial',  'zcode': 1, 'highway': True,  'factory': False, 'construction': False, 'pop': 85,  'green': 10.0},
    'NODE005': {'lat': 13.0604, 'lon': 80.2496, 'zone': 'Residential', 'zcode': 0, 'highway': False, 'factory': False, 'construction': False, 'pop': 40,  'green': 45.0},
}

conn = get_conn()
cur = conn.cursor()

for nid, m in NODE_META.items():
    n = df_csv[df_csv['node_id'] == nid]

    def g(col, default):
        if not n.empty and col in n.columns:
            v = n[col].iloc[0]
            return default if pd.isna(v) else v
        return default

    def gm(col, default):
        if not n.empty and col in n.columns:
            v = n[col].mean()
            return default if pd.isna(v) else float(v)
        return default

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
    """, (
        nid,
        float(g('latitude', m['lat'])),
        float(g('longitude', m['lon'])),
        str(g('zone_type', m['zone'])),
        int(m['zcode']),
        bool(g('near_highway', m['highway'])),
        bool(g('near_factory', m['factory'])),
        bool(m['construction']),
        int(gm('population_density', m['pop'])),
        float(m['green']),
    ))

    cur.execute("""
        INSERT INTO node_weather
            (node_id, temperature, humidity, pressure,
             wind_speed, rainfall, visibility, traffic_density)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (node_id) DO UPDATE SET
            temperature=EXCLUDED.temperature, humidity=EXCLUDED.humidity,
            pressure=EXCLUDED.pressure, wind_speed=EXCLUDED.wind_speed,
            rainfall=EXCLUDED.rainfall, visibility=EXCLUDED.visibility,
            traffic_density=EXCLUDED.traffic_density, updated_at=NOW()
    """, (
        nid,
        float(gm('temperature_c', 32.0)),
        float(gm('humidity_pct', 72.0)),
        float(gm('pressure_hpa', 1010.0)),
        float(gm('wind_speed_kmh', 8.0)),
        float(gm('rainfall_mm', 0.5)),
        float(gm('visibility_km', 8.0)),
        float(gm('population_density', 50.0)),
    ))

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
# CELL 5 — Train GradientBoosting Forecast Model + Save to Drive
# ============================================================

from sklearn.ensemble import GradientBoostingRegressor
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

    gbr = GradientBoostingRegressor(n_estimators=300, max_depth=6, learning_rate=0.05, random_state=42)
    gbr.fit(X_train, y_train)
    pred = gbr.predict(X_test)

    print(f"{horizon} — MAE: {mean_absolute_error(y_test, pred):.1f}  R²: {r2_score(y_test, pred):.3f}")

    models[horizon] = gbr
    joblib.dump(gbr, f"/content/drive/MyDrive/aqi_forecast_{horizon}.pkl")

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
# CELL 7 — Cause Analysis (Rule-Based → Batch Update RDS)
# ============================================================

from psycopg2.extras import execute_values

def identify_cause(row):
    pm25, pm10, co, co2   = row['pm25'], row['pm10'], row['co'], row['co2']
    no2, ozone, smoke     = row['no2'], row['ozone'], row['smoke']
    traffic               = row['traffic_density']
    near_factory          = bool(row['near_factory'])
    near_construction     = bool(row['near_construction'])
    wind_speed, rainfall  = row['wind_speed'], row['rainfall']

    scores = {
        'Vehicle Emissions':    (35 if traffic > 70 else 0) + (25 if co > 2 else 0) + (20 if no2 > 40 else 0) + (20 if pm25 > 80 else 0),
        'Industrial Emissions': (35 if near_factory else 0) + (25 if co2 > 800 else 0) + (20 if no2 > 45 else 0) + (20 if ozone > 80 else 0),
        'Construction Dust':    (40 if near_construction else 0) + (35 if pm10 > 150 else 0) + (15 if wind_speed > 10 else 0),
        'Waste Burning':        (40 if smoke > 70 else 0) + (20 if co > 2 else 0) + (25 if pm25 > 100 else 0),
        'Weather Conditions':   (30 if wind_speed < 2 else 0) + (20 if rainfall == 0 else 0) + (25 if pm25 > 90 else 0),
    }
    return max(scores, key=scores.get)

# Compute all causes in Python (no DB round-trips during computation)
df['cause'] = df.apply(identify_cause, axis=1)
print(f"Causes computed for {len(df)} rows")
print(df['cause'].value_counts())

# Single bulk UPDATE — sends at most a handful of SQL statements instead of 14K
conn = get_conn()
cur  = conn.cursor()

data = [(row['cause'], int(row['reading_id'])) for _, row in df[['cause', 'reading_id']].iterrows()]

execute_values(
    cur,
    """
    UPDATE aqi_readings AS r
    SET cause = v.cause
    FROM (VALUES %s) AS v(cause, reading_id)
    WHERE r.reading_id = v.reading_id::int
    """,
    data,
    page_size=500,
)

conn.commit()
conn.close()
print(f"Cause updated for {len(data)} readings in RDS successfully")

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
