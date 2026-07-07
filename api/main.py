from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, nodes, users, readings, simulation, ml, iot
import ml_inference
import os

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

@app.on_event('startup')
def startup_load_models():
    print('Startup: loading ML models...')
    ml_inference.load_models()
    print(f'Startup: models loaded = {list(ml_inference._models.keys())}')

@app.get('/api/health')
def health():
    return {'status': 'ok'}

@app.get('/api/ml/status')
def ml_status():
    files = {}
    for fname in ['aqi_forecast_6h.pkl','aqi_forecast_24h.pkl','aqi_forecast_48h.pkl',
                  'anomaly_detector.pkl','anomaly_scaler.pkl','cause_classifier.pkl']:
        path = os.path.join(ml_inference.MODELS_DIR, fname)
        files[fname] = os.path.exists(path)
    return {
        'models_loaded': list(ml_inference._models.keys()),
        'models_dir': ml_inference.MODELS_DIR,
        'files_on_disk': files,
        'inference_ready': '6h' in ml_inference._models and 'anomaly' in ml_inference._models,
    }
