from fastapi import APIRouter, Depends, HTTPException
from database import query
from auth import get_current_user

router = APIRouter()


@router.get('/predictions/{node_id}')
def get_predictions(node_id: str, current_user=Depends(get_current_user)):
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
    rows = query("SELECT * FROM hotspot_clusters ORDER BY created_at DESC LIMIT 10")
    return rows or []


@router.get('/anomalies')
def get_anomalies(current_user=Depends(get_current_user)):
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


@router.post('/health-risk')
def health_risk(data: dict, current_user=Depends(get_current_user)):
    """
    Returns personalised health risk score (0-100), risk level,
    mask recommendation, and advice based on user health profile
    + current AQI + 3 forecast horizons.
    """
    health = query("""
        SELECT uh.age, uh.severity_level, hc.condition_name
        FROM user_health uh
        JOIN health_conditions hc ON hc.condition_id = uh.condition_id
        WHERE uh.user_id = %s
    """, (current_user['user_id'],), fetch='one')

    if not health:
        raise HTTPException(400, 'Health profile not set up.')

    current_aqi = int(data.get('current_aqi', 0))
    future6     = int(data.get('future6',     current_aqi))
    future24    = int(data.get('future24',    current_aqi))
    future48    = int(data.get('future48',    current_aqi))
    age         = int(health['age'] or 30)
    condition   = str(health['condition_name'] or 'Healthy')
    severity    = str(health['severity_level'] or 'Medium')

    score = _health_engine(age, condition, severity, current_aqi, future6, future24, future48)
    level = _risk_level(score)
    rec   = _recommendation(level)

    return {
        'risk_score': score,
        'risk_level': level,
        **rec,
    }


def _health_engine(age, condition, severity, current_aqi, future6, future24, future48):
    score = 0

    # Current AQI score
    if current_aqi <= 50:    score += 5
    elif current_aqi <= 100: score += 15
    elif current_aqi <= 150: score += 30
    elif current_aqi <= 200: score += 45
    elif current_aqi <= 300: score += 60
    else:                    score += 80

    # Future AQI trending up
    if max(future6, future24, future48) > current_aqi:
        score += 15

    # Age factor
    if age <= 12:    score += 20
    elif age >= 60:  score += 20
    elif age >= 45:  score += 10

    # Condition factor
    cond = condition.lower()
    if 'asthma' in cond:       score += 25
    elif 'copd' in cond:       score += 30
    elif 'heart' in cond:      score += 25
    elif 'respiratory' in cond:score += 30
    elif 'diabetes' in cond:   score += 10
    elif 'pregnant' in cond:   score += 15
    elif 'allergy' in cond:    score += 15
    elif 'children' in cond:   score += 20
    elif 'elderly' in cond:    score += 20

    # Severity modifier
    if severity == 'High':   score += 10
    elif severity == 'Low':  score -= 5

    return min(max(score, 0), 100)


def _risk_level(score):
    if score < 20:   return 'LOW'
    if score < 40:   return 'MODERATE'
    if score < 60:   return 'HIGH'
    if score < 80:   return 'VERY HIGH'
    return 'CRITICAL'


def _recommendation(level):
    recs = {
        'LOW': {
            'mask': 'None',
            'outdoor': 'Safe for all activities',
            'advice': 'Air quality is good. Enjoy outdoor activities. Stay hydrated.',
            'actions': ['Enjoy outdoor exercise', 'Keep windows open', 'Normal activities safe'],
        },
        'MODERATE': {
            'mask': 'Surgical Mask',
            'outdoor': 'Reduce prolonged outdoor activity',
            'advice': 'Sensitive individuals should limit heavy outdoor exercise.',
            'actions': ['Wear surgical mask outdoors', 'Avoid peak traffic hours', 'Take breaks indoors'],
        },
        'HIGH': {
            'mask': 'N95 Mask',
            'outdoor': 'Avoid outdoor exercise',
            'advice': 'Limit outdoor exposure. Keep medicines handy. Monitor symptoms.',
            'actions': ['Wear N95 mask if going out', 'Keep inhaler/medication handy', 'Use air purifier indoors'],
        },
        'VERY HIGH': {
            'mask': 'N95 Mask',
            'outdoor': 'Stay indoors whenever possible',
            'advice': 'Poor air quality. Close windows, use air purifier, avoid outdoor exposure.',
            'actions': ['Stay indoors', 'Close all windows', 'Run air purifier on high'],
        },
        'CRITICAL': {
            'mask': 'N95 Mask',
            'outdoor': 'DO NOT go outside',
            'advice': 'Hazardous conditions. Consult doctor if symptoms occur. Carry emergency medication.',
            'actions': ['Do not go outside', 'Seek medical help if symptomatic', 'Carry emergency medication'],
        },
    }
    return recs.get(level, recs['MODERATE'])
