from fastapi import APIRouter, Depends
from database import query
from auth import get_current_user

router = APIRouter()

@router.get('/')
def get_nodes(current_user=Depends(get_current_user)):
    return query('SELECT * FROM nodes ORDER BY node_id')

@router.get('/latest')
def get_latest_readings(current_user=Depends(get_current_user)):
    return query('SELECT * FROM latest_node_readings ORDER BY node_id')

@router.get('/{node_id}/readings')
def get_node_readings(node_id: str, current_user=Depends(get_current_user)):
    return query("""
        SELECT * FROM aqi_readings
        WHERE node_id = %s
        ORDER BY reading_id DESC
        LIMIT 24
    """, (node_id,))
