import threading
import httpx
from database import query

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

# ─── Clinical threshold system ─────────────────────────────────────────────────
# Sources: CPCB NAAQS 2009, WHO AQG 2021, GINA 2023, GOLD 2024, AHA, ACOG
# Mirrors mobile/src/lib/airQuality.js — keep both in sync.
# Returns the "stay indoors" AQI — the threshold for a push notification alert.

def _get_alert_threshold(condition_name: str, severity: str, age: int) -> int:
    cond = (condition_name or '').lower()
    yr   = int(age or 30)

    infant  = yr <= 2
    child   = 3  <= yr <= 12
    teen    = 13 <= yr <= 18
    elderly = yr >= 60

    # Asthma (GINA 2023)
    if 'asthma' in cond:
        if infant or child: alert = 200
        elif teen:          alert = 201
        elif elderly:       alert = 200
        else:               alert = 301

    # COPD (GOLD 2024)
    elif 'copd' in cond:
        alert = 200 if elderly else 301

    # Heart / Cardiovascular (AHA Brook 2010)
    elif 'heart' in cond:
        alert = 200 if elderly else 300

    # Diabetes (Brook 2016; Liu 2016)
    elif 'diabetes' in cond:
        alert = 201 if elderly else 301

    # Children condition tag
    elif 'children' in cond:
        alert = 200 if infant else 201

    # Elderly condition tag
    elif 'elderly' in cond:
        alert = 201

    # Normal / healthy — age-based (Section 5, AirPulse_Health_Reference)
    else:
        if infant:   alert = 200
        elif child:  alert = 201
        elif teen:   alert = 301
        elif elderly:alert = 201
        else:        alert = 401   # healthy adult

    mod = -25 if severity == 'High' else 25 if severity == 'Low' else 0
    return max(75, alert + mod)


def _send(token: str, title: str, body: str, data: dict):
    try:
        httpx.post(EXPO_PUSH_URL, json={
            'to':       token,
            'title':    title,
            'body':     body,
            'sound':    'default',
            'priority': 'high',
            'data':     data,
            'channelId':'aqi-alerts',
        }, timeout=10)
    except Exception as e:
        print(f'Push send error: {e}')


def check_and_notify(node_id: str, aqi: int, location: str):
    """
    Called after every reading insert (simulation + manual).
    Queries all users on this node, checks their personalised threshold,
    and sends an Expo push notification if AQI >= their alert threshold.
    Runs in a background thread so it never blocks the API response.
    """
    def _run():
        try:
            reading = query("""
                SELECT * FROM aqi_readings
                WHERE node_id = %s
                ORDER BY reading_id DESC LIMIT 1
            """, (node_id,), fetch='one')
            if not reading:
                return

            users = query("""
                SELECT u.user_id, u.push_token,
                       hc.condition_name, uh.severity_level, uh.age
                FROM users u
                JOIN user_health uh ON uh.user_id = u.user_id
                JOIN health_conditions hc ON hc.condition_id = uh.condition_id
                WHERE u.node_id = %s
                  AND u.role = 'user'
            """, (node_id,))

            for u in (users or []):
                threshold = _get_alert_threshold(
                    u['condition_name'],
                    u['severity_level'],
                    u['age'] or 30,
                )
                cond = (u['condition_name'] or '').lower()
                
                # Check pollutant-specific triggers
                triggers = []
                
                # Asthma: PM2.5, NO2
                if 'asthma' in cond:
                    if reading.get('sub_aqi_pm25', 0) >= threshold:
                        triggers.append(('PM2.5', reading.get('sub_aqi_pm25', 0), f"PM2.5 levels are high ({float(reading.get('pm25', 0)):.1f} µg/m³), which can trigger an asthma attack. Stay indoors."))
                    if reading.get('sub_aqi_no2', 0) >= threshold:
                        triggers.append(('NO2', reading.get('sub_aqi_no2', 0), f"NO2 levels are high ({float(reading.get('no2', 0)):.1f} µg/m³), which can trigger bronchial spasms. Stay indoors."))
                
                # COPD: PM10, NO2
                elif 'copd' in cond:
                    if reading.get('sub_aqi_pm10', 0) >= threshold:
                        triggers.append(('PM10', reading.get('sub_aqi_pm10', 0), f"PM10 levels are high ({float(reading.get('pm10', 0)):.1f} µg/m³), which poses a risk of COPD flare-up. Stay indoors."))
                    if reading.get('sub_aqi_no2', 0) >= threshold:
                        triggers.append(('NO2', reading.get('sub_aqi_no2', 0), f"NO2 levels are high ({float(reading.get('no2', 0)):.1f} µg/m³), which causes severe airway irritation in COPD. Stay indoors."))
                
                # Heart Disease: CO, PM2.5
                elif 'heart' in cond:
                    if reading.get('sub_aqi_co', 0) >= threshold:
                        triggers.append(('CO', reading.get('sub_aqi_co', 0), f"Carbon Monoxide (CO) levels are high ({float(reading.get('co', 0)):.1f} mg/m³), which reduces oxygen transport to the heart. Stay indoors."))
                    if reading.get('sub_aqi_pm25', 0) >= threshold:
                        triggers.append(('PM2.5', reading.get('sub_aqi_pm25', 0), f"PM2.5 levels are high ({float(reading.get('pm25', 0)):.1f} µg/m³), which increases cardiovascular strain. Stay indoors."))
                
                # Diabetes: PM2.5
                elif 'diabetes' in cond:
                    if reading.get('sub_aqi_pm25', 0) >= threshold:
                        triggers.append(('PM2.5', reading.get('sub_aqi_pm25', 0), f"PM2.5 levels are high ({float(reading.get('pm25', 0)):.1f} µg/m³). Fine particles can increase systemic inflammation and spike insulin resistance. Wear a mask."))
                
                # Children / Elderly: PM2.5, PM10, Ozone
                elif 'children' in cond or 'elderly' in cond:
                    if reading.get('sub_aqi_pm25', 0) >= threshold:
                        triggers.append(('PM2.5', reading.get('sub_aqi_pm25', 0), f"PM2.5 levels are high ({float(reading.get('pm25', 0)):.1f} µg/m³), which is unsafe for vulnerable age groups. Stay indoors."))
                    if reading.get('sub_aqi_pm10', 0) >= threshold:
                        triggers.append(('PM10', reading.get('sub_aqi_pm10', 0), f"PM10 levels are high ({float(reading.get('pm10', 0)):.1f} µg/m³), which is unsafe for vulnerable age groups. Stay indoors."))
                    if reading.get('sub_aqi_ozone', 0) >= threshold:
                        triggers.append(('Ozone', reading.get('sub_aqi_ozone', 0), f"Ozone levels are high ({float(reading.get('ozone', 0)):.1f} µg/m³), which is unsafe for vulnerable age groups. Stay indoors."))
                
                # Normal / Healthy: Overall AQI
                else:
                    if reading.get('aqi', 0) >= threshold:
                        triggers.append(('AQI', reading.get('aqi', 0), f"Air Quality Index (AQI) has reached {reading.get('aqi', 0)}, exceeding your personal safe limit of {threshold}. Avoid strenuous outdoor activity."))

                if triggers:
                    # Pick the trigger with the highest sub-AQI severity
                    triggers.sort(key=lambda t: t[1], reverse=True)
                    target_pollutant, highest_sub_aqi, alert_message = triggers[0]
                    
                    # Log to database
                    try:
                        query("""
                            INSERT INTO user_alert_log (user_id, reading_id, alerted_at)
                            VALUES (%s, %s, NOW())
                        """, (u['user_id'], reading['reading_id']), fetch='none')
                    except Exception:
                        pass
                    
                    # Send push notification
                    if u['push_token']:
                        _send(
                            token=u['push_token'],
                            title=f'⚠️ Air Quality Alert — {location}',
                            body=alert_message,
                            data={'node_id': node_id, 'aqi': reading.get('aqi', 0), 'threshold': threshold, 'location': location},
                        )
        except Exception as e:
            print(f'Notification check error: {e}')

    threading.Thread(target=_run, daemon=True).start()
