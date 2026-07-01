import threading
import time
import random
import json
import os
import boto3
from datetime import datetime
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from auth import admin_only
from database import query
from notifications import check_and_notify

IOT_ENDPOINT = os.environ.get('AWS_IOT_ENDPOINT', 'a154ie33qhakmk-ats.iot.ap-south-1.amazonaws.com')

_iot_client = None

def get_iot_client():
    global _iot_client
    if _iot_client is None:
        _iot_client = boto3.client(
            'iot-data',
            region_name=os.environ.get('AWS_REGION', 'ap-south-1'),
            endpoint_url=f'https://{IOT_ENDPOINT}',
            aws_access_key_id=os.environ.get('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.environ.get('AWS_SECRET_ACCESS_KEY'),
        )
    return _iot_client

router = APIRouter()

# ── Simulation state ─────────────────────────────────────────
class SimState:
    def __init__(self):
        self.running   = False
        self.thread    = None
        self.interval  = 30
        self.overrides = {}
        self.log       = []

sim = SimState()

NODE_BASES = {
    'NODE001': {'name': 'Manali Industrial', 'pm25': 90,  'pm10': 120, 'co': 6.5, 'no2': 65, 'ozone': 55, 'co2': 520, 'voc': 18, 'smoke': 12},
    'NODE002': {'name': 'Anna Nagar',        'pm25': 48,  'pm10': 72,  'co': 2.1, 'no2': 32, 'ozone': 38, 'co2': 430, 'voc': 8,  'smoke': 5 },
    'NODE003': {'name': 'T Nagar',           'pm25': 68,  'pm10': 95,  'co': 4.2, 'no2': 52, 'ozone': 45, 'co2': 470, 'voc': 12, 'smoke': 8 },
    'NODE004': {'name': 'Mount Road',        'pm25': 105, 'pm10': 145, 'co': 8.0, 'no2': 78, 'ozone': 62, 'co2': 550, 'voc': 22, 'smoke': 16},
    'NODE005': {'name': 'Semmozhi Poonga',   'pm25': 28,  'pm10': 42,  'co': 1.2, 'no2': 18, 'ozone': 28, 'co2': 400, 'voc': 4,  'smoke': 2 },
}

PM25_BP  = [(0,30,0,50),(30,60,51,100),(60,90,101,200),(90,120,201,300),(120,250,301,400),(250,500,401,500)]
PM10_BP  = [(0,50,0,50),(50,100,51,100),(100,250,101,200),(250,350,201,300),(350,430,301,400),(430,600,401,500)]
NO2_BP   = [(0,40,0,50),(40,80,51,100),(80,180,101,200),(180,280,201,300),(280,400,301,400),(400,800,401,500)]
CO_BP    = [(0,1,0,50),(1,2,51,100),(2,10,101,200),(10,17,201,300),(17,34,301,400),(34,100,401,500)]
OZONE_BP = [(0,50,0,50),(50,100,51,100),(100,168,101,200),(168,208,201,300),(208,748,301,400),(748,1000,401,500)]

CAUSE_MAP = {
    'PM2.5': 'Vehicle exhaust and construction dust',
    'PM10':  'Road dust and industrial emissions',
    'CO':    'Incomplete combustion from traffic',
    'NO2':   'Vehicle and industrial emissions',
    'Ozone': 'Photochemical reaction from sunlight',
}

def sub_aqi(c, bps):
    for (c_lo, c_hi, a_lo, a_hi) in bps:
        if c_lo <= c <= c_hi:
            return int(((a_hi - a_lo) / (c_hi - c_lo)) * (c - c_lo) + a_lo)
    return min(500, int(c))

def vary(base, pct=0.15):
    return max(0, round(base + random.uniform(-base * pct, base * pct), 2))

def generate_and_insert(node_id, base):
    override = sim.overrides.get(node_id, {})

    pm25  = override.get('pm25',  vary(base['pm25']))
    pm10  = override.get('pm10',  vary(base['pm10']))
    co    = override.get('co',    vary(base['co'],    0.20))
    no2   = override.get('no2',   vary(base['no2']))
    ozone = override.get('ozone', vary(base['ozone']))
    co2   = override.get('co2',   vary(base['co2'],   0.05))
    voc   = override.get('voc',   vary(base['voc'],   0.20))
    smoke = override.get('smoke', vary(base['smoke'], 0.20))
    nh3   = round(random.uniform(1.0, 5.0), 2)

    subs = {
        'PM2.5': sub_aqi(pm25,  PM25_BP),
        'PM10':  sub_aqi(pm10,  PM10_BP),
        'CO':    sub_aqi(co,    CO_BP),
        'NO2':   sub_aqi(no2,   NO2_BP),
        'Ozone': sub_aqi(ozone, OZONE_BP),
    }
    dominant = max(subs, key=subs.get)
    aqi = override.get('aqi', max(subs.values()))

    payload = {
        'node_id':           node_id,
        'aqi':               aqi,
        'pm25':              pm25,
        'pm10':              pm10,
        'co':                co,
        'nh3':               nh3,
        'no2':               no2,
        'ozone':             ozone,
        'co2':               co2,
        'voc':               voc,
        'smoke':             smoke,
        'sub_aqi_pm25':      subs['PM2.5'],
        'sub_aqi_pm10':      subs['PM10'],
        'sub_aqi_co':        subs['CO'],
        'sub_aqi_nh3':       0,
        'sub_aqi_no2':       subs['NO2'],
        'sub_aqi_ozone':     subs['Ozone'],
        'dominant_pollutant': dominant,
        'cause':             CAUSE_MAP[dominant],
        'recorded_at':       datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
    }

    # Write to DB — admin panel, mobile app, history all read from here
    query("""
        INSERT INTO aqi_readings (
            node_id, aqi, pm25, pm10, co, nh3, no2, ozone, co2, voc, smoke,
            sub_aqi_pm25, sub_aqi_pm10, sub_aqi_co, sub_aqi_nh3,
            sub_aqi_no2, sub_aqi_ozone, dominant_pollutant, cause, recorded_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
    """, (
        node_id, aqi, pm25, pm10, co, nh3, no2, ozone, co2, voc, smoke,
        subs['PM2.5'], subs['PM10'], subs['CO'], 0,
        subs['NO2'], subs['Ozone'], dominant, CAUSE_MAP[dominant],
    ), fetch='none')

    # Publish to IoT Core — user dashboard WebSocket gets real-time update
    try:
        get_iot_client().publish(
            topic=f'airpulse/readings/{node_id}',
            qos=1,
            payload=json.dumps(payload),
        )
    except Exception as e:
        print(f'IoT publish error [{node_id}]: {e}')

    entry = {
        'time': datetime.now().strftime('%H:%M:%S'),
        'node_id': node_id,
        'name': base['name'],
        'aqi': aqi,
        'dominant': dominant,
    }
    sim.log = ([entry] + sim.log)[:20]

    check_and_notify(node_id, aqi, base['name'])

def simulation_loop():
    while sim.running:
        for node_id, base in NODE_BASES.items():
            try:
                generate_and_insert(node_id, base)
            except Exception as e:
                print(f'Sim error [{node_id}]: {e}')
        time.sleep(sim.interval)

# ── Routes ───────────────────────────────────────────────────
class StartRequest(BaseModel):
    interval_seconds: int = 30

class OverrideRequest(BaseModel):
    node_id: str
    aqi: int | None = None
    pm25: float | None = None
    pm10: float | None = None
    co: float | None = None
    no2: float | None = None

class ResetRequest(BaseModel):
    node_id: str

@router.get('/status')
def get_status(current_user=Depends(admin_only)):
    return {
        'running':  sim.running,
        'interval': sim.interval,
        'overrides': sim.overrides,
        'log': sim.log,
    }

@router.post('/start')
def start_sim(data: StartRequest, current_user=Depends(admin_only)):
    if sim.running:
        return {'ok': True, 'message': 'Already running'}
    sim.running  = True
    sim.interval = max(10, data.interval_seconds)
    sim.thread   = threading.Thread(target=simulation_loop, daemon=True)
    sim.thread.start()
    return {'ok': True, 'message': f'Simulation started — interval {sim.interval}s'}

@router.post('/stop')
def stop_sim(current_user=Depends(admin_only)):
    sim.running = False
    return {'ok': True, 'message': 'Simulation stopped'}

@router.post('/override')
def set_override(data: OverrideRequest, current_user=Depends(admin_only)):
    override = {}
    if data.aqi  is not None: override['aqi']  = data.aqi
    if data.pm25 is not None: override['pm25'] = data.pm25
    if data.pm10 is not None: override['pm10'] = data.pm10
    if data.co   is not None: override['co']   = data.co
    if data.no2  is not None: override['no2']  = data.no2
    sim.overrides[data.node_id] = override
    return {'ok': True}

@router.post('/reset')
def reset_override(data: ResetRequest, current_user=Depends(admin_only)):
    sim.overrides.pop(data.node_id, None)
    return {'ok': True}
