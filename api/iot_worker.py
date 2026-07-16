import os
import sys
import time
import json
import random
import threading
import urllib.parse
import traceback
import paho.mqtt.client as mqtt

# Ensure paths can resolve imports correctly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import query
from routes.iot import build_wss_url
from routes.simulation import NODE_BASES, get_time_factor, sub_aqi, PM25_BP, PM10_BP, NO2_BP, CO_BP, OZONE_BP, get_iot_client
from ml_inference import run_local_inference, update_predictions_table
from notifications import check_and_notify

NH3_BP = [(0,200,0,50),(200,400,51,100),(400,800,101,200),(800,1200,201,300),(1200,1800,301,400),(1800,2000,401,500)]

def process_and_save_message(topic: str, payload_str: str):
    try:
        data = json.loads(payload_str)
    except Exception as e:
        print(f"[MQTT Worker] JSON decode error: {e}")
        return

    # Extract node_id from topic if missing in payload
    node_id = data.get('node_id')
    if not node_id:
        parts = topic.split('/')
        node_id = parts[-1]
    
    if not node_id:
        print("[MQTT Worker] Missing node_id in topic and payload")
        return

    print(f"[MQTT Worker] Processing message for {node_id}: {data}")

    # Build the full reading dictionary
    reading_dict = {
        'node_id': node_id,
        'aqi': 0,
        'pm25': float(data.get('pm25', 0)),
        'pm10': float(data.get('pm10', 0)),
        'co': float(data.get('co', 0)),
        'nh3': float(data.get('nh3', 0)),
        'no2': float(data.get('no2', 0)),
        'ozone': float(data.get('ozone', 0)),
        'co2': float(data.get('co2', 0)),
        'voc': float(data.get('voc', 0)),
        'smoke': float(data.get('smoke', 0)),
        'cause': data.get('cause', '')
    }

    # If it's NODE006, scale raw potentiometer values
    if node_id == 'NODE006':
        # CO: raw 0-255 potentiometer -> 0.0 - 10.0 mg/m3
        if reading_dict['co'] > 15:
            reading_dict['co'] = round((reading_dict['co'] / 255.0) * 10.0, 2)
        # NH3: raw 0-255 potentiometer -> 0.0 - 120.0 ug/m3
        if reading_dict['nh3'] > 10:
            reading_dict['nh3'] = round((reading_dict['nh3'] / 255.0) * 120.0, 2)

    # Hybrid Simulation: fill missing fields dynamically
    base = NODE_BASES.get(node_id, {'pm25': 48, 'pm10': 72, 'co': 2.1, 'no2': 32, 'ozone': 38, 'co2': 430, 'voc': 8, 'smoke': 5})
    tf = get_time_factor(node_id)
    
    def vary(val, pct=0.15):
        return max(0, round((val + random.uniform(-val * pct, val * pct)) * tf, 2))

    for field in ['pm25', 'pm10', 'co', 'nh3', 'no2', 'ozone', 'co2', 'voc', 'smoke']:
        if reading_dict[field] == 0:
            if field == 'nh3':
                reading_dict['nh3'] = round(random.uniform(1.0, 5.0) * tf, 2)
            else:
                reading_dict[field] = vary(base.get(field, 0.0))

    # Calculate sub-AQIs
    subs = {
        'PM2.5': sub_aqi(reading_dict['pm25'],  PM25_BP),
        'PM10':  sub_aqi(reading_dict['pm10'],  PM10_BP),
        'CO':    sub_aqi(reading_dict['co'],    CO_BP),
        'NO2':   sub_aqi(reading_dict['no2'],   NO2_BP),
        'Ozone': sub_aqi(reading_dict['ozone'], OZONE_BP),
        'NH3':   sub_aqi(reading_dict['nh3'],   NH3_BP),
    }
    dominant = max(subs, key=subs.get)
    
    reading_dict['sub_aqi_pm25'] = subs['PM2.5']
    reading_dict['sub_aqi_pm10'] = subs['PM10']
    reading_dict['sub_aqi_co'] = subs['CO']
    reading_dict['sub_aqi_no2'] = subs['NO2']
    reading_dict['sub_aqi_ozone'] = subs['Ozone']
    reading_dict['sub_aqi_nh3'] = subs['NH3']
    reading_dict['dominant_pollutant'] = dominant
    
    reading_dict['aqi'] = max(subs.values())

    # Run ML local inference (anomaly detection + forecasting)
    is_anomaly, preds, predicted_cause = run_local_inference(node_id, reading_dict)
    final_cause = reading_dict['cause'] if reading_dict['cause'] else predicted_cause

    # Write to database
    print(f"[MQTT Worker] Saving processed reading to DB for {node_id}: AQI={reading_dict['aqi']}")
    row = query("""
        INSERT INTO aqi_readings (
            node_id, aqi, pm25, pm10, co, nh3, no2, ozone, co2, voc, smoke,
            sub_aqi_pm25, sub_aqi_pm10, sub_aqi_co, sub_aqi_nh3, sub_aqi_no2, sub_aqi_ozone,
            dominant_pollutant, cause, is_anomaly, recorded_at
        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
        RETURNING *
    """, (
        node_id, reading_dict['aqi'], reading_dict['pm25'], reading_dict['pm10'], reading_dict['co'], reading_dict['nh3'], reading_dict['no2'], reading_dict['ozone'], reading_dict['co2'], reading_dict['voc'], reading_dict['smoke'],
        reading_dict['sub_aqi_pm25'], reading_dict['sub_aqi_pm10'], reading_dict['sub_aqi_co'], reading_dict['sub_aqi_nh3'], reading_dict['sub_aqi_no2'], reading_dict['sub_aqi_ozone'],
        dominant, final_cause, is_anomaly
    ), fetch='one')

    # Update predictions table
    update_predictions_table(node_id, preds)

    # Trigger push notifications
    node = query("SELECT location FROM nodes WHERE node_id = %s", (node_id,), fetch='one')
    check_and_notify(node_id, reading_dict['aqi'], node['location'] if node else node_id)

    # Republish clean data & ML results back to IoT Core so Web & Mobile apps receive them in real-time
    try:
        publish_row = dict(row)
        if 'recorded_at' in publish_row and publish_row['recorded_at'] is not None:
            if hasattr(publish_row['recorded_at'], 'strftime'):
                publish_row['recorded_at'] = publish_row['recorded_at'].strftime('%Y-%m-%dT%H:%M:%SZ')
            else:
                publish_row['recorded_at'] = str(publish_row['recorded_at'])
                
        iot_client = get_iot_client()
        iot_client.publish(
            topic=f'airpulse/clean_readings/{node_id}',
            qos=1,
            payload=json.dumps(publish_row),
        )
        iot_client.publish(
            topic=f'airpulse/ml/{node_id}',
            qos=1,
            payload=json.dumps({'node_id': node_id, 'predictions': preds, 'is_anomaly': is_anomaly}),
        )
        print(f"[MQTT Worker] Clean data and ML results successfully republished for {node_id}")
    except Exception as e:
        print(f"[MQTT Worker] Error publishing to IoT Core: {e}")

def run_worker_loop():
    print("[MQTT Worker] Starting background worker...")
    while True:
        try:
            # Build current signed WSS url
            url = build_wss_url()
            parsed = urllib.parse.urlparse(url)
            host = parsed.netloc
            path = parsed.path + "?" + parsed.query
            
            # Setup MQTT Client
            client = mqtt.Client(client_id="airpulse-api-worker", transport="websockets")
            client.ws_set_options(path=path)
            client.tls_set()
            
            def on_connect(c, userdata, flags, rc):
                print(f"[MQTT Worker] Connected to AWS IoT Core WSS. rc={rc}")
                c.subscribe("airpulse/readings/#")
                print("[MQTT Worker] Subscribed to airpulse/readings/#")
                
            def on_message(c, userdata, msg):
                try:
                    process_and_save_message(msg.topic, msg.payload.decode('utf-8'))
                except Exception as e:
                    print(f"[MQTT Worker] Error inside on_message: {e}")
                    traceback.print_exc()

            def on_disconnect(c, userdata, rc):
                print(f"[MQTT Worker] Disconnected. rc={rc}. Reconnecting...")

            client.on_connect = on_connect
            client.on_message = on_message
            client.on_disconnect = on_disconnect
            
            client.connect(host, port=443, keepalive=60)
            
            # Loop forever blocking this iteration
            client.loop_forever()
        except Exception as e:
            print(f"[MQTT Worker] Loop error: {e}")
            traceback.print_exc()
        
        # Sleep before reconnecting with a fresh WSS URL
        print("[MQTT Worker] Waiting 10 seconds before attempting next connection...")
        time.sleep(10)

def start_iot_worker():
    if not os.environ.get('AWS_ACCESS_KEY_ID') or not os.environ.get('AWS_SECRET_ACCESS_KEY'):
        print("[MQTT Worker] AWS credentials missing in environment. Worker disabled.")
        return
    t = threading.Thread(target=run_worker_loop, daemon=True)
    t.start()
