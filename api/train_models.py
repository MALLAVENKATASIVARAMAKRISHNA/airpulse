import os
import psycopg2
import psycopg2.extras
import pandas as pd
import numpy as np
import joblib
import warnings
warnings.filterwarnings('ignore')

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

def main():
    print("Connecting to database...")
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    
    print("Loading data from RDS...")
    cur.execute("""
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
    rows = cur.fetchall()
    conn.close()
    
    df = pd.DataFrame(rows)
    print(f"Loaded {df.shape[0]} rows. Performing feature engineering...")
    
    # Feature engineering
    df['recorded_at'] = pd.to_datetime(df['recorded_at'])
    df['hour']    = df['recorded_at'].dt.hour
    df['day']     = df['recorded_at'].dt.day
    df['month']   = df['recorded_at'].dt.month
    df['weekday'] = df['recorded_at'].dt.weekday
    df['weekend'] = (df['weekday'] >= 5).astype(int)
    df['rush_hour'] = df['hour'].apply(lambda h: 1 if (7 <= h <= 10 or 17 <= h <= 20) else 0)
    
    node_enc = {n: i for i, n in enumerate(sorted(df['node_id'].unique()))}
    df['node_id_enc'] = df['node_id'].map(node_enc)
    
    df = df.sort_values(['node_id', 'recorded_at']).reset_index(drop=True)
    
    for lag in [1, 3, 6, 12, 24]:
        df[f'aqi_lag_{lag}'] = df.groupby('node_id')['aqi'].shift(lag)
        
    df['aqi_roll_mean_6']  = df.groupby('node_id')['aqi'].transform(lambda x: x.rolling(6,  min_periods=1).mean())
    df['aqi_roll_mean_24'] = df.groupby('node_id')['aqi'].transform(lambda x: x.rolling(24, min_periods=1).mean())
    df['aqi_roll_std_6']   = df.groupby('node_id')['aqi'].transform(lambda x: x.rolling(6,  min_periods=1).std().fillna(0))
    
    df['aqi_after_6h']  = df.groupby('node_id')['aqi'].shift(-6)
    df['aqi_after_24h'] = df.groupby('node_id')['aqi'].shift(-24)
    df['aqi_after_48h'] = df.groupby('node_id')['aqi'].shift(-48)
    
    df = df.dropna().reset_index(drop=True)
    print(f"Data shape after cleaning: {df.shape}")
    
    os.makedirs('api/ml_models', exist_ok=True)
    
    # 1. Train Regressors
    from sklearn.ensemble import GradientBoostingRegressor
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
    
    X = df[FEATURES]
    for horizon, target in [('6h', 'aqi_after_6h'), ('24h', 'aqi_after_24h'), ('48h', 'aqi_after_48h')]:
        y = df[target]
        print(f"Training Regressor for {horizon} horizon...")
        gbr = GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)
        gbr.fit(X, y)
        path = f'api/ml_models/aqi_forecast_{horizon}.pkl'
        joblib.dump(gbr, path)
        print(f"Saved {path}")
        
    # 2. Train Anomaly Detector (Isolation Forest)
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    
    ANOMALY_FEATURES = ['aqi', 'pm25', 'pm10', 'co', 'co2', 'no2', 'ozone', 'voc', 'smoke',
                        'temperature', 'humidity', 'traffic_density']
    
    X_anom = df[ANOMALY_FEATURES].fillna(0)
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_anom)
    
    print("Training Isolation Forest Anomaly Detector...")
    iso = IsolationForest(n_estimators=100, contamination=0.02, random_state=42, n_jobs=-1)
    iso.fit(X_scaled)
    
    joblib.dump(iso,    "api/ml_models/anomaly_detector.pkl")
    joblib.dump(scaler, "api/ml_models/anomaly_scaler.pkl")
    print("Saved anomaly detector and scaler.")
    print("All models trained and saved successfully!")

if __name__ == '__main__':
    main()
