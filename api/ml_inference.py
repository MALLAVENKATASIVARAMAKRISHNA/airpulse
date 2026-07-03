import os
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from database import query

# Cache models on load
MODELS_DIR = os.path.join(os.path.dirname(__file__), 'ml_models')
_models = {}
_scaler = None

def load_models():
    global _scaler
    if '6h' in _models:
        return
    try:
        for h in ['6h', '24h', '48h']:
            _models[h] = joblib.load(os.path.join(MODELS_DIR, f'aqi_forecast_{h}.pkl'))
        _models['anomaly'] = joblib.load(os.path.join(MODELS_DIR, 'anomaly_detector.pkl'))
        _scaler = joblib.load(os.path.join(MODELS_DIR, 'anomaly_scaler.pkl'))
    except Exception as e:
        print(f"Error loading local ML models: {e}")

def run_local_inference(node_id: str, reading: dict) -> tuple[bool, dict]:
    """
    Runs anomaly detection and forecast regressor models for a new reading.
    Returns (is_anomaly, predictions_dict).
    """
    load_models()
    if 'anomaly' not in _models or _scaler is None:
        # Fallback if models not found
        return False, {'6h': reading['aqi'], '24h': reading['aqi'], '48h': reading['aqi']}

    # 1. Fetch metadata
    meta = query("""
        SELECT latitude, longitude, zone_type_code, 
               near_highway::int, near_factory::int, near_construction::int,
               population_density, green_cover_percentage
        FROM node_metadata WHERE node_id = %s
    """, (node_id,), fetch='one')
    if not meta:
        meta = {
            'latitude': 13.0827, 'longitude': 80.2707, 'zone_type_code': 1,
            'near_highway': 0, 'near_factory': 0, 'near_construction': 0,
            'population_density': 10000, 'green_cover_percentage': 15.0
        }

    # 2. Fetch weather
    weather = query("""
        SELECT temperature, humidity, pressure, wind_speed, rainfall, visibility, traffic_density
        FROM node_weather WHERE node_id = %s
    """, (node_id,), fetch='one')
    if not weather:
        weather = {
            'temperature': 30.0, 'humidity': 60.0, 'pressure': 1010.0,
            'wind_speed': 10.0, 'rainfall': 0.0, 'visibility': 8.0, 'traffic_density': 0.5
        }

    # 3. Fetch historical readings for lag & rolling calculations
    history = query("""
        SELECT aqi FROM aqi_readings 
        WHERE node_id = %s 
        ORDER BY recorded_at DESC LIMIT 25
    """, (node_id,), fetch='all')
    
    aqis = [reading['aqi']] + [r['aqi'] for r in (history or [])]

    def get_lag(n):
        return aqis[n] if len(aqis) > n else aqis[0]

    lag_1 = get_lag(1)
    lag_3 = get_lag(3)
    lag_6 = get_lag(6)
    lag_12 = get_lag(12)
    lag_24 = get_lag(24)

    roll_6 = aqis[:6]
    roll_24 = aqis[:24]

    roll_mean_6 = sum(roll_6) / len(roll_6)
    roll_mean_24 = sum(roll_24) / len(roll_24)

    if len(roll_6) > 1:
        mean_6 = roll_mean_6
        var_6 = sum((x - mean_6)**2 for x in roll_6) / (len(roll_6) - 1)
        roll_std_6 = var_6 ** 0.5
    else:
        roll_std_6 = 0.0

    # 4. Get node encoder
    nodes_rows = query("SELECT DISTINCT node_id FROM nodes ORDER BY node_id", fetch='all')
    node_list = [n['node_id'] for n in nodes_rows]
    node_enc = {n: i for i, n in enumerate(node_list)}
    node_id_enc = node_enc.get(node_id, 0)

    # 5. Extract time features
    now = datetime.utcnow()
    hour = now.hour
    day = now.day
    month = now.month
    weekday = now.weekday()
    weekend = 1 if weekday >= 5 else 0
    rush_hour = 1 if (7 <= hour <= 10 or 17 <= hour <= 20) else 0

    # 6. Anomaly Detection
    anom_vals = [
        reading['aqi'], reading.get('pm25', 0), reading.get('pm10', 0), reading.get('co', 0), 
        reading.get('co2', 0), reading.get('no2', 0), reading.get('ozone', 0), 
        reading.get('voc', 0), reading.get('smoke', 0),
        weather['temperature'], weather['humidity'], weather['traffic_density']
    ]
    anom_df = pd.DataFrame([anom_vals], columns=[
        'aqi', 'pm25', 'pm10', 'co', 'co2', 'no2', 'ozone', 'voc', 'smoke',
        'temperature', 'humidity', 'traffic_density'
    ])
    scaled_anom = _scaler.transform(anom_df)
    is_anomaly = bool(_models['anomaly'].predict(scaled_anom)[0] == -1)

    # 7. Forecast Regression
    feat_vals = [
        node_id_enc, meta['latitude'], meta['longitude'], meta['zone_type_code'],
        hour, day, month, weekday, weekend, rush_hour,
        weather['temperature'], weather['humidity'], weather['pressure'], weather['wind_speed'],
        weather['rainfall'], weather['visibility'],
        reading.get('pm25', 0), reading.get('pm10', 0), reading.get('co', 0), reading.get('nh3', 0),
        reading.get('no2', 0), reading.get('ozone', 0), reading.get('co2', 0), reading.get('voc', 0),
        reading.get('smoke', 0), weather['traffic_density'], meta['population_density'],
        meta['near_highway'], meta['near_factory'], meta['near_construction'], meta['green_cover_percentage'],
        reading['aqi'], lag_1, lag_3, lag_6, lag_12, lag_24,
        roll_mean_6, roll_mean_24, roll_std_6
    ]
    
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
    feat_df = pd.DataFrame([feat_vals], columns=FEATURES)
    
    preds = {}
    for h in ['6h', '24h', '48h']:
        pred_val = _models[h].predict(feat_df)[0]
        preds[h] = int(np.clip(pred_val, 0, 500))

    return is_anomaly, preds

def update_predictions_table(node_id: str, preds: dict):
    """
    Deletes old predictions for the node and inserts the newly calculated forecasts.
    """
    try:
        query("DELETE FROM aqi_predictions WHERE node_id = %s", (node_id,), fetch='none')
        for h, aqi in preds.items():
            hrs = int(h.replace('h', ''))
            query("""
                INSERT INTO aqi_predictions (node_id, predicted_aqi, predicted_for, horizon, created_at)
                VALUES (%s, %s, NOW() + (%s * INTERVAL '1 hour'), %s, NOW())
            """, (node_id, aqi, hrs, h), fetch='none')
    except Exception as e:
        print(f"Error updating predictions in database: {e}")
