from fastapi import APIRouter, Depends
from database import query
from auth import get_current_user

router = APIRouter()


@router.get('/predictions/{node_id}')
def get_predictions(node_id: str, current_user=Depends(get_current_user)):
    """Latest 6h / 24h / 48h forecast for a node (most recent run per horizon)."""
    rows = query("""
        SELECT DISTINCT ON (horizon)
            prediction_id, node_id, predicted_aqi, predicted_for, horizon, created_at
        FROM aqi_predictions
        WHERE node_id = %s
        ORDER BY horizon, created_at DESC
    """, (node_id,))
    return rows or []


@router.get('/hotspots')
def get_hotspots(current_user=Depends(get_current_user)):
    """Most recent hotspot cluster run."""
    rows = query("""
        SELECT * FROM hotspot_clusters
        ORDER BY created_at DESC
        LIMIT 10
    """)
    return rows or []


@router.get('/anomalies')
def get_anomalies(current_user=Depends(get_current_user)):
    """Recent readings flagged as anomalous by Isolation Forest."""
    rows = query("""
        SELECT r.reading_id, r.node_id, r.aqi, r.recorded_at,
               n.location, n.district
        FROM aqi_readings r
        JOIN nodes n ON n.node_id = r.node_id
        WHERE r.is_anomaly = TRUE
        ORDER BY r.recorded_at DESC
        LIMIT 20
    """)
    return rows or []
