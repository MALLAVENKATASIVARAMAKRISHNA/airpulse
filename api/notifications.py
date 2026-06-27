import threading
import httpx
from database import query

EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'

THRESHOLDS = {
    'normal':       200,
    'asthma':       100,
    'copd':         100,
    'heart disease':100,
    'diabetes':     150,
    'elderly':      100,
    'children':     100,
}

def _get_threshold(condition_name: str, severity: str) -> int:
    name = (condition_name or '').lower()
    base = 200
    for key, val in THRESHOLDS.items():
        if key in name:
            base = val
            break
    mod = -25 if severity == 'High' else 25 if severity == 'Low' else 0
    return base + mod

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
        print(f'Push notification failed: {e}')

def check_and_notify(node_id: str, aqi: int, location: str):
    """
    Called after every reading insert.
    Finds all users on this node whose threshold is crossed and sends push notifications.
    Runs in a background thread so it doesn't block the API response.
    """
    def _run():
        try:
            users = query("""
                SELECT u.user_id, u.push_token, hc.condition_name, uh.severity_level
                FROM users u
                JOIN user_health uh ON uh.user_id = u.user_id
                JOIN health_conditions hc ON hc.condition_id = uh.condition_id
                WHERE u.node_id = %s AND u.push_token IS NOT NULL AND u.role = 'user'
            """, (node_id,))

            for u in (users or []):
                threshold = _get_threshold(u['condition_name'], u['severity_level'])
                if aqi >= threshold:
                    _send(
                        token=u['push_token'],
                        title=f'⚠️ Air Quality Alert — {location}',
                        body=f'AQI has reached {aqi}. This exceeds your safe limit. Stay indoors.',
                        data={'node_id': node_id, 'aqi': aqi},
                    )
        except Exception as e:
            print(f'Notification check error: {e}')

    threading.Thread(target=_run, daemon=True).start()
