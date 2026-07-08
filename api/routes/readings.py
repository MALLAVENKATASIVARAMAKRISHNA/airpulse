from fastapi import APIRouter, Depends
from pydantic import BaseModel
from database import query
from auth import admin_only
from notifications import check_and_notify
from ml_inference import run_local_inference, update_predictions_table

router = APIRouter()

class ReadingRequest(BaseModel):
    node_id: str
    aqi: int
    pm25: float = 0
    pm10: float = 0
    co: float = 0
    nh3: float = 0
    no2: float = 0
    ozone: float = 0
    co2: float = 0
    voc: float = 0
    smoke: float = 0
    sub_aqi_pm25: int = 0
    sub_aqi_pm10: int = 0
    sub_aqi_co: int = 0
    sub_aqi_nh3: int = 0
    sub_aqi_no2: int = 0
    sub_aqi_ozone: int = 0
    dominant_pollutant: str = ''
    cause: str = ''

@router.post('/')
def insert_reading(data: ReadingRequest, current_user=Depends(admin_only)):
    # Run ML inference locally
    reading_dict = data.dict()
    node_id = data.node_id
    
    # Hybrid Mode: If the reading comes from a physical sensor node
    # and has missing/placeholder variables, we simulate them.
    from routes.simulation import NODE_BASES, get_time_factor, sub_aqi, PM25_BP, PM10_BP, NO2_BP, CO_BP, OZONE_BP
    import random
    
    # Fallback base profile for custom/newly added nodes
    base = NODE_BASES.get(node_id, {'pm25': 48, 'pm10': 72, 'co': 2.1, 'no2': 32, 'ozone': 38, 'co2': 430, 'voc': 8, 'smoke': 5})
    tf = get_time_factor(node_id)
    
    def vary(val, pct=0.15):
        return max(0, round((val + random.uniform(-val * pct, val * pct)) * tf, 2))
        
    if reading_dict.get('pm25', 0) == 0:
        reading_dict['pm25'] = vary(base['pm25'])
    if reading_dict.get('pm10', 0) == 0:
        reading_dict['pm10'] = vary(base['pm10'])
    if reading_dict.get('ozone', 0) == 0:
        reading_dict['ozone'] = vary(base['ozone'])
    if reading_dict.get('no2', 0) == 0:
        reading_dict['no2'] = vary(base['no2'])
    if reading_dict.get('nh3', 0) == 0:
        reading_dict['nh3'] = round(random.uniform(1.0, 5.0) * tf, 2)
    if reading_dict.get('voc', 0) == 0:
        reading_dict['voc'] = vary(base['voc'])
    if reading_dict.get('smoke', 0) == 0:
        reading_dict['smoke'] = vary(base['smoke'])
        
    # Recompute sub-AQIs for the complete dataset
    subs = {
        'PM2.5': sub_aqi(reading_dict['pm25'],  PM25_BP),
        'PM10':  sub_aqi(reading_dict['pm10'],  PM10_BP),
        'CO':    sub_aqi(reading_dict['co'],    CO_BP),
        'NO2':   sub_aqi(reading_dict['no2'],   NO2_BP),
        'Ozone': sub_aqi(reading_dict['ozone'], OZONE_BP),
    }
    dominant = max(subs, key=subs.get)
    
    reading_dict['sub_aqi_pm25'] = subs['PM2.5']
    reading_dict['sub_aqi_pm10'] = subs['PM10']
    reading_dict['sub_aqi_co'] = subs['CO']
    reading_dict['sub_aqi_no2'] = subs['NO2']
    reading_dict['sub_aqi_ozone'] = subs['Ozone']
    reading_dict['dominant_pollutant'] = dominant
    
    if reading_dict.get('aqi', 0) == 0 or reading_dict['aqi'] == subs['CO']:
        reading_dict['aqi'] = max(subs.values())

    is_anomaly, preds, predicted_cause = run_local_inference(node_id, reading_dict)
    
    # Use ML predicted cause if not manually provided
    final_cause = reading_dict['cause'] if reading_dict['cause'] else predicted_cause

    row = query("""
        INSERT INTO aqi_readings (
            node_id, aqi, pm25, pm10, co, nh3, no2, ozone, co2, voc, smoke,
            sub_aqi_pm25, sub_aqi_pm10, sub_aqi_co, sub_aqi_nh3,
            sub_aqi_no2, sub_aqi_ozone, dominant_pollutant, cause, is_anomaly, recorded_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        RETURNING *
    """, (
        reading_dict['node_id'], reading_dict['aqi'], reading_dict['pm25'], reading_dict['pm10'],
        reading_dict['co'], reading_dict['nh3'], reading_dict['no2'], reading_dict['ozone'],
        reading_dict['co2'], reading_dict['voc'], reading_dict['smoke'],
        reading_dict['sub_aqi_pm25'], reading_dict['sub_aqi_pm10'], reading_dict['sub_aqi_co'],
        reading_dict['sub_aqi_nh3'], reading_dict['sub_aqi_no2'], reading_dict['sub_aqi_ozone'],
        reading_dict['dominant_pollutant'], final_cause, is_anomaly
    ), fetch='one')

    # Update predictions table
    update_predictions_table(data.node_id, preds)

    node = query("SELECT location FROM nodes WHERE node_id = %s", (data.node_id,), fetch='one')
    check_and_notify(data.node_id, data.aqi, node['location'] if node else data.node_id)
    return dict(row)
