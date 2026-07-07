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
    is_anomaly, preds, predicted_cause = run_local_inference(data.node_id, reading_dict)
    
    # Use ML predicted cause if not manually provided
    final_cause = data.cause if data.cause else predicted_cause

    row = query("""
        INSERT INTO aqi_readings (
            node_id, aqi, pm25, pm10, co, nh3, no2, ozone, co2, voc, smoke,
            sub_aqi_pm25, sub_aqi_pm10, sub_aqi_co, sub_aqi_nh3,
            sub_aqi_no2, sub_aqi_ozone, dominant_pollutant, cause, is_anomaly, recorded_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        RETURNING *
    """, (
        data.node_id, data.aqi, data.pm25, data.pm10, data.co, data.nh3,
        data.no2, data.ozone, data.co2, data.voc, data.smoke,
        data.sub_aqi_pm25, data.sub_aqi_pm10, data.sub_aqi_co, data.sub_aqi_nh3,
        data.sub_aqi_no2, data.sub_aqi_ozone, data.dominant_pollutant, final_cause,
        is_anomaly
    ), fetch='one')

    # Update predictions table
    update_predictions_table(data.node_id, preds)

    node = query("SELECT location FROM nodes WHERE node_id = %s", (data.node_id,), fetch='one')
    check_and_notify(data.node_id, data.aqi, node['location'] if node else data.node_id)
    return dict(row)
