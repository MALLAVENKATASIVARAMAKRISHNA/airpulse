from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import auth, nodes, users, readings, simulation, ml, iot

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

@app.get('/api/health')
def health():
    return {'status': 'ok'}
