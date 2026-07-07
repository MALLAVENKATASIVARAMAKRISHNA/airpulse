from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import query
from auth import get_current_user, admin_only

router = APIRouter()

class NodeCreateRequest(BaseModel):
    node_id: str
    location: str
    district: str
    state: str
    pincode: str
    latitude: float
    longitude: float
    zone_type: str = "Residential"
    near_highway: bool = False
    near_factory: bool = False
    near_construction: bool = False
    population_density: int = 50
    green_cover_percentage: float = 20.0

@router.post('/')
def create_node(data: NodeCreateRequest, current_user=Depends(admin_only)):
    # Check if exists
    existing = query("SELECT node_id FROM nodes WHERE node_id = %s", (data.node_id,), fetch='one')
    if existing:
        raise HTTPException(status_code=400, detail="Node ID already exists.")
        
    # Write to nodes table
    query("""
        INSERT INTO nodes (node_id, location, district, state, pincode)
        VALUES (%s, %s, %s, %s, %s)
    """, (data.node_id, data.location, data.district, data.state, data.pincode), fetch='none')
    
    # Write to node_metadata table
    zone_code_map = {"Residential": 0, "Commercial": 1, "Industrial": 2, "Sensitive": 3}
    zone_code = zone_code_map.get(data.zone_type, 0)
    
    query("""
        INSERT INTO node_metadata (
            node_id, latitude, longitude, zone_type, zone_type_code,
            near_highway, near_factory, near_construction,
            population_density, green_cover_percentage
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (
        data.node_id, data.latitude, data.longitude, data.zone_type, zone_code,
        data.near_highway, data.near_factory, data.near_construction,
        data.population_density, data.green_cover_percentage
    ), fetch='none')
    
    # Seed an initial reading to ensure it appears in the latest_node_readings view
    query("""
        INSERT INTO aqi_readings (
            node_id, aqi, pm25, pm10, co, nh3, no2, ozone, co2, voc, smoke,
            sub_aqi_pm25, sub_aqi_pm10, sub_aqi_co, sub_aqi_nh3, sub_aqi_no2, sub_aqi_ozone,
            dominant_pollutant, cause, is_anomaly, recorded_at
        ) VALUES (%s, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 400.0, 0.0, 0.0,
                  0, 0, 0, 0, 0, 0,
                  'PM2.5', 'Baseline monitoring initiated', false, NOW())
    """, (data.node_id,), fetch='none')
    
    return {"ok": True, "message": "Node registered successfully."}

@router.get('/')
def get_nodes():
    return query('SELECT * FROM nodes ORDER BY node_id')

@router.get('/latest')
def get_latest_readings(current_user=Depends(get_current_user)):
    return query("""
        SELECT r.*, m.latitude, m.longitude
        FROM latest_node_readings r
        LEFT JOIN node_metadata m ON m.node_id = r.node_id
        ORDER BY r.node_id
    """)

@router.get('/{node_id}/readings')
def get_node_readings(node_id: str, current_user=Depends(get_current_user)):
    return query("""
        SELECT * FROM aqi_readings
        WHERE node_id = %s
        ORDER BY reading_id DESC
        LIMIT 24
    """, (node_id,))
