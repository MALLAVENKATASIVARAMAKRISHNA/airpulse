import json, os, io, boto3, joblib, numpy as np, psycopg2, psycopg2.extras, httpx
from datetime import datetime, timezone

# ── Globals cached across warm invocations ───────────────────
_models = None
_scaler = None
_conn   = None

S3     = boto3.client('s3', region_name='ap-south-1')
BUCKET = os.environ['S3_BUCKET']

NODE_ENC = {'NODE001':0,'NODE002':1,'NODE003':2,'NODE004':3,'NODE005':4}

NODE_META = {
    'NODE001':{'lat':13.1627,'lon':80.2619,'zone':2,'highway':1,'factory':1,'construction':0,'pop':60, 'green':5.0},
    'NODE002':{'lat':13.0850,'lon':80.2101,'zone':0,'highway':0,'factory':0,'construction':0,'pop':80, 'green':22.0},
    'NODE003':{'lat':13.0418,'lon':80.2341,'zone':1,'highway':1,'factory':0,'construction':1,'pop':90, 'green':8.0},
    'NODE004':{'lat':13.0569,'lon':80.2521,'zone':1,'highway':1,'factory':0,'construction':0,'pop':85, 'green':10.0},
    'NODE005':{'lat':13.0604,'lon':80.2496,'zone':0,'highway':0,'factory':0,'construction':0,'pop':40, 'green':45.0},
}

NODE_WEATHER = {
    'NODE001':{'temp':33,'hum':70,'pres':1010,'wind':8, 'rain':0.5,'vis':7, 'traffic':80},
    'NODE002':{'temp':32,'hum':72,'pres':1010,'wind':7, 'rain':0.5,'vis':9, 'traffic':50},
    'NODE003':{'temp':33,'hum':71,'pres':1010,'wind':6, 'rain':0.5,'vis':8, 'traffic':85},
    'NODE004':{'temp':34,'hum':68,'pres':1009,'wind':9, 'rain':0.5,'vis':8, 'traffic':90},
    'NODE005':{'temp':31,'hum':75,'pres':1011,'wind':10,'rain':0.5,'vis':10,'traffic':30},
}

LOCATIONS = {
    'NODE001':'Manali Industrial Area','NODE002':'Anna Nagar',
    'NODE003':'T Nagar','NODE004':'Mount Road','NODE005':'Semmozhi Poonga',
}

CAUSE_MAP = {
    'PM2.5':'Vehicle exhaust and construction dust',
    'PM10': 'Road dust and industrial emissions',
    'CO':   'Incomplete combustion from traffic',
    'NO2':  'Vehicle and industrial emissions',
    'Ozone':'Photochemical reaction from sunlight',
}

PM25_BP  = [(0,30,0,50),(30,60,51,100),(60,90,101,200),(90,120,201,300),(120,250,301,400),(250,500,401,500)]
PM10_BP  = [(0,50,0,50),(50,100,51,100),(100,250,101,200),(250,350,201,300),(350,430,301,400),(430,600,401,500)]
NO2_BP   = [(0,40,0,50),(40,80,51,100),(80,180,101,200),(180,280,201,300),(280,400,301,400),(400,800,401,500)]
CO_BP    = [(0,1,0,50),(1,2,51,100),(2,10,101,200),(10,17,201,300),(17,34,301,400),(34,100,401,500)]
OZONE_BP = [(0,50,0,50),(50,100,51,100),(100,168,101,200),(168,208,201,300),(208,748,301,400),(748,1000,401,500)]

def sub_aqi(c, bps):
    for (lo, hi, alo, ahi) in bps:
        if lo <= c <= hi:
            return int(((ahi-alo)/(hi-lo))*(c-lo)+alo)
    return min(500, int(c))

# ── Model loading (cold start only) ─────────────────────────
def load_models():
    global _models, _scaler
    if _models:
        return
    _models = {}
    for h in ['6h','24h','48h']:
        obj = S3.get_object(Bucket=BUCKET, Key=f'aqi_forecast_{h}.pkl')
        _models[h] = joblib.load(io.BytesIO(obj['Body'].read()))
    obj = S3.get_object(Bucket=BUCKET, Key='anomaly_detector.pkl')
    _models['anomaly'] = joblib.load(io.BytesIO(obj['Body'].read()))
    obj = S3.get_object(Bucket=BUCKET, Key='anomaly_scaler.pkl')
    _scaler = joblib.load(io.BytesIO(obj['Body'].read()))
    print('Models loaded from S3')

# ── DB connection (reused across warm invocations) ───────────
def get_db():
    global _conn
    try:
        _conn.cursor().execute('SELECT 1')
    except:
        _conn = psycopg2.connect(
            host=os.environ['DB_HOST'], dbname=os.environ['DB_NAME'],
            user=os.environ['DB_USER'], password=os.environ['DB_PASS'],
            sslmode='require', connect_timeout=5,
        )
    return _conn

# ── Feature vector ───────────────────────────────────────────
def build_features(r, node_id):
    meta = NODE_META[node_id]
    wthr = NODE_WEATHER[node_id]
    now  = datetime.now(timezone.utc)
    hr   = now.hour
    wd   = now.weekday()
    aqi  = r['aqi']

    try:
        cur = get_db().cursor()
        cur.execute("SELECT aqi FROM aqi_readings WHERE node_id=%s ORDER BY reading_id DESC LIMIT 24", (node_id,))
        hist = [row[0] for row in cur.fetchall()]
    except:
        hist = []

    def lag(n): return hist[n-1] if len(hist) >= n else aqi
    r6  = hist[:6]  or [aqi]
    r24 = hist[:24] or [aqi]

    return np.array([[
        NODE_ENC.get(node_id,0),
        meta['lat'], meta['lon'], meta['zone'],
        hr, now.day, now.month, wd,
        1 if wd>=5 else 0,
        1 if (7<=hr<=10 or 17<=hr<=20) else 0,
        wthr['temp'], wthr['hum'], wthr['pres'], wthr['wind'], wthr['rain'], wthr['vis'],
        r.get('pm25',0), r.get('pm10',0), r.get('co',0), r.get('nh3',0),
        r.get('no2',0), r.get('ozone',0), r.get('co2',0), r.get('voc',0), r.get('smoke',0),
        wthr['traffic'], meta['pop'], meta['highway'], meta['factory'], meta['construction'], meta['green'],
        aqi,
        lag(1), lag(3), lag(6), lag(12), lag(24),
        float(np.mean(r6)), float(np.mean(r24)),
        float(np.std(r6)) if len(r6)>1 else 0.0,
    ]])

# ── DB writes ────────────────────────────────────────────────
def insert_reading(r, node_id, is_anomaly):
    pm25,pm10,co,no2,ozone = r.get('pm25',0),r.get('pm10',0),r.get('co',0),r.get('no2',0),r.get('ozone',0)
    subs = {
        'PM2.5':sub_aqi(pm25,PM25_BP),'PM10':sub_aqi(pm10,PM10_BP),
        'CO':sub_aqi(co,CO_BP),'NO2':sub_aqi(no2,NO2_BP),'Ozone':sub_aqi(ozone,OZONE_BP),
    }
    dom = max(subs, key=subs.get)
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        INSERT INTO aqi_readings (
            node_id,aqi,pm25,pm10,co,nh3,no2,ozone,co2,voc,smoke,
            sub_aqi_pm25,sub_aqi_pm10,sub_aqi_co,sub_aqi_nh3,
            sub_aqi_no2,sub_aqi_ozone,dominant_pollutant,cause,is_anomaly,recorded_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        RETURNING reading_id
    """, (
        node_id,r['aqi'],pm25,pm10,co,r.get('nh3',0),no2,ozone,
        r.get('co2',0),r.get('voc',0),r.get('smoke',0),
        subs['PM2.5'],subs['PM10'],subs['CO'],0,subs['NO2'],subs['Ozone'],
        dom, CAUSE_MAP.get(dom,''), is_anomaly,
    ))
    reading_id = cur.fetchone()[0]
    conn.commit()
    return reading_id, dom

def insert_predictions(node_id, preds):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("DELETE FROM aqi_predictions WHERE node_id=%s", (node_id,))
    for h, aqi in preds.items():
        hrs = int(h.replace('h',''))
        cur.execute("""
            INSERT INTO aqi_predictions (node_id,predicted_aqi,predicted_for,horizon,created_at)
            VALUES (%s,%s,NOW()+(%s*INTERVAL '1 hour'),%s,NOW())
        """, (node_id, aqi, hrs, h))
    conn.commit()

# ── Push notifications ───────────────────────────────────────
def get_threshold(cond, sev, age):
    c  = (cond or '').lower()
    yr = int(age or 30)
    el = yr>=60; ch = 3<=yr<=12; in_ = yr<=2
    if 'asthma'   in c: a = 200 if (in_ or ch or el) else 301
    elif 'copd'   in c: a = 200 if el else 301
    elif 'heart'  in c: a = 200 if el else 300
    elif 'diabetes' in c: a = 201 if el else 301
    elif 'children' in c: a = 200 if in_ else 201
    elif 'elderly' in c:  a = 201
    else: a = 200 if (in_ or ch or el) else 401
    mod = -25 if sev=='High' else 25 if sev=='Low' else 0
    return max(75, a+mod)

def notify(node_id, aqi, location):
    try:
        cur = get_db().cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute("""
            SELECT u.push_token, hc.condition_name, uh.severity_level, uh.age
            FROM users u
            JOIN user_health uh ON uh.user_id=u.user_id
            JOIN health_conditions hc ON hc.condition_id=uh.condition_id
            WHERE u.node_id=%s AND u.push_token IS NOT NULL AND u.role='user'
        """, (node_id,))
        for u in (cur.fetchall() or []):
            thr = get_threshold(u['condition_name'], u['severity_level'], u['age'])
            if aqi >= thr:
                httpx.post('https://exp.host/--/api/v2/push/send', json={
                    'to': u['push_token'],
                    'title': f'⚠️ Air Quality Alert — {location}',
                    'body': f'AQI is {aqi}, exceeding your safe limit of {thr}. Stay indoors.',
                    'sound':'default','priority':'high','channelId':'aqi-alerts',
                    'data':{'node_id':node_id,'aqi':aqi,'threshold':thr,'location':location},
                }, timeout=5)
    except Exception as e:
        print(f'Notify error: {e}')

# ── Handler ──────────────────────────────────────────────────
def lambda_handler(event, context):
    load_models()

    node_id = event.get('node_id','')
    if node_id not in NODE_META:
        return {'statusCode':400,'body':f'Unknown node: {node_id}'}

    # ML inference
    feat = build_features(event, node_id)
    preds = {h: int(np.clip(_models[h].predict(feat)[0],0,500)) for h in ['6h','24h','48h']}

    wthr = NODE_WEATHER[node_id]
    anom_feat = np.array([[
        event.get('aqi',0),event.get('pm25',0),event.get('pm10',0),
        event.get('co',0),event.get('co2',0),event.get('no2',0),
        event.get('ozone',0),event.get('voc',0),event.get('smoke',0),
        wthr['temp'],wthr['hum'],wthr['traffic'],
    ]])
    is_anomaly = bool(_models['anomaly'].predict(_scaler.transform(anom_feat))[0] == -1)

    # DB writes
    reading_id, dominant = insert_reading(event, node_id, is_anomaly)
    insert_predictions(node_id, preds)

    # Push notifications
    location = LOCATIONS.get(node_id, node_id)
    notify(node_id, event['aqi'], location)

    print(f"[{node_id}] AQI={event['aqi']} anomaly={is_anomaly} preds={preds}")
    return {'statusCode':200,'body':json.dumps({'reading_id':reading_id,'predictions':preds,'is_anomaly':is_anomaly})}
