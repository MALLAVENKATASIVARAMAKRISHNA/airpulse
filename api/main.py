from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, nodes, users, readings, simulation, ml, iot
import ml_inference
import os, sys, threading

app = FastAPI(title='AirPulse API', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://localhost:4173', 'https://4z.onrender.com', 'https://03f93003.xyz', 'https://03112003.xyz', 'https://www.03112003.xyz'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(auth.router,       prefix='/api/auth')
app.include_router(nodes.router,      prefix='/api/nodes')
app.include_router(users.router,      prefix='/api/users')
app.include_router(readings.router,   prefix='/api/readings')
app.include_router(simulation.router, prefix='/api/simulation')
app.include_router(ml.router,         prefix='/api/ml')
app.include_router(iot.router,        prefix='/api/iot')

def _retrain_in_background():
    """Retrain models from RDS if loaded .pkl files are incompatible with current sklearn."""
    try:
        import psycopg2, psycopg2.extras, pandas as pd, numpy as np, joblib
        from sklearn.ensemble import GradientBoostingRegressor, IsolationForest
        from sklearn.preprocessing import StandardScaler

        print('Background retrain: connecting to DB...')
        conn = psycopg2.connect(
            host=os.environ.get('DB_HOST', 'airpulse-db.c52y26y4sdyz.ap-south-1.rds.amazonaws.com'),
            port=5432, dbname=os.environ.get('DB_NAME', 'airpulse'),
            user=os.environ.get('DB_USER', 'airpulse_admin'),
            password=os.environ.get('DB_PASS', 'airpulseAdmin123456'),
            sslmode='require'
        )
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT r.node_id, r.aqi, r.pm25, r.pm10, r.co, r.nh3, r.no2, r.ozone,
                   r.co2, r.voc, r.smoke, r.recorded_at,
                   m.latitude, m.longitude, m.zone_type_code,
                   m.near_highway::int, m.near_factory::int, m.near_construction::int,
                   m.population_density, m.green_cover_percentage,
                   w.temperature, w.humidity, w.pressure, w.wind_speed,
                   w.rainfall, w.visibility, w.traffic_density
            FROM aqi_readings r
            JOIN node_metadata m ON m.node_id = r.node_id
            JOIN node_weather  w ON w.node_id = r.node_id
            ORDER BY r.node_id, r.recorded_at
        """)
        rows = cur.fetchall()
        conn.close()

        df = pd.DataFrame(rows)
        df['recorded_at'] = pd.to_datetime(df['recorded_at'])
        df['hour']    = df['recorded_at'].dt.hour
        df['day']     = df['recorded_at'].dt.day
        df['month']   = df['recorded_at'].dt.month
        df['weekday'] = df['recorded_at'].dt.weekday
        df['weekend'] = (df['weekday'] >= 5).astype(int)
        df['rush_hour'] = df['hour'].apply(lambda h: 1 if (7<=h<=10 or 17<=h<=20) else 0)
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
        print(f'Background retrain: {len(df)} rows loaded')

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
        os.makedirs(ml_inference.MODELS_DIR, exist_ok=True)
        for horizon, target in [('6h','aqi_after_6h'),('24h','aqi_after_24h'),('48h','aqi_after_48h')]:
            print(f'Background retrain: training {horizon}...')
            gbr = GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)
            gbr.fit(X, df[target])
            joblib.dump(gbr, os.path.join(ml_inference.MODELS_DIR, f'aqi_forecast_{horizon}.pkl'))

        ANOM_FEATS = ['aqi','pm25','pm10','co','co2','no2','ozone','voc','smoke','temperature','humidity','traffic_density']
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(df[ANOM_FEATS].fillna(0))
        iso = IsolationForest(n_estimators=100, contamination=0.02, random_state=42, n_jobs=-1)
        iso.fit(X_scaled)
        joblib.dump(iso,    os.path.join(ml_inference.MODELS_DIR, 'anomaly_detector.pkl'))
        joblib.dump(scaler, os.path.join(ml_inference.MODELS_DIR, 'anomaly_scaler.pkl'))

        print('Background retrain: done, reloading models...')
        ml_inference._models.clear()
        ml_inference._scaler = None
        ml_inference.load_models()
        print(f'Background retrain: models now loaded = {list(ml_inference._models.keys())}')
    except Exception as e:
        print(f'Background retrain failed: {e}')

@app.on_event('startup')
def startup_load_models():
    print('Startup: loading ML models...')
    ml_inference.load_models()
    loaded = list(ml_inference._models.keys())
    print(f'Startup: models loaded = {loaded}')
    if 'anomaly' not in ml_inference._models:
        print('Startup: models incompatible — launching background retrain from RDS...')
        threading.Thread(target=_retrain_in_background, daemon=True).start()

@app.get('/api/health')
def health():
    return {'status': 'ok'}

@app.get('/api/ml/status')
def ml_status():
    import sklearn
    files = {}
    for fname in ['aqi_forecast_6h.pkl','aqi_forecast_24h.pkl','aqi_forecast_48h.pkl',
                  'anomaly_detector.pkl','anomaly_scaler.pkl','cause_classifier.pkl']:
        path = os.path.join(ml_inference.MODELS_DIR, fname)
        files[fname] = os.path.exists(path)
    load_error = None
    if files.get('aqi_forecast_6h.pkl') and '6h' not in ml_inference._models:
        try:
            import joblib
            joblib.load(os.path.join(ml_inference.MODELS_DIR, 'aqi_forecast_6h.pkl'))
        except Exception as e:
            load_error = str(e)
    return {
        'python': sys.version,
        'sklearn': sklearn.__version__,
        'models_loaded': list(ml_inference._models.keys()),
        'models_dir': ml_inference.MODELS_DIR,
        'files_on_disk': files,
        'inference_ready': '6h' in ml_inference._models and 'anomaly' in ml_inference._models,
        'load_error': load_error,
    }
