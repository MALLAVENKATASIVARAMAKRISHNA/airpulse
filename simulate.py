import json
import random
import time
import threading
import ssl
import paho.mqtt.client as mqtt

# ── AWS IoT Core config ───────────────────────────────────────
IOT_ENDPOINT = "a154ie33qhakmk-ats.iot.ap-south-1.amazonaws.com"
IOT_PORT     = 8883
CA_CERT      = "certs/AmazonRootCA1.pem"
CLIENT_CERT  = "certs/device.pem.crt"
PRIVATE_KEY  = "certs/private.pem.key"
CLIENT_ID    = "airpulse-simulator"
TOPIC_PREFIX = "airpulse/readings"

# ── Nodes to simulate ─────────────────────────────────────────
NODES = [
    {"node_id": "NODE001", "name": "Manali Industrial Area", "base_aqi": 185,
     "base": {"pm25":90,  "pm10":120, "co":6.5, "no2":65, "ozone":55, "co2":520, "voc":18, "smoke":12}},
    {"node_id": "NODE002", "name": "Anna Nagar",             "base_aqi": 110,
     "base": {"pm25":48,  "pm10":72,  "co":2.1, "no2":32, "ozone":38, "co2":430, "voc":8,  "smoke":5}},
    {"node_id": "NODE003", "name": "T Nagar",                "base_aqi": 148,
     "base": {"pm25":68,  "pm10":95,  "co":4.2, "no2":52, "ozone":45, "co2":470, "voc":12, "smoke":8}},
    {"node_id": "NODE004", "name": "Mount Road",             "base_aqi": 210,
     "base": {"pm25":105, "pm10":145, "co":8.0, "no2":78, "ozone":62, "co2":550, "voc":22, "smoke":16}},
    {"node_id": "NODE005", "name": "Semmozhi Poonga",        "base_aqi": 72,
     "base": {"pm25":28,  "pm10":42,  "co":1.2, "no2":18, "ozone":28, "co2":400, "voc":4,  "smoke":2}},
]

# ── Sub-AQI calculators (CPCB breakpoints) ───────────────────
def calc_sub_aqi(c, bps):
    for (c_lo, c_hi, a_lo, a_hi) in bps:
        if c_lo <= c <= c_hi:
            return int(((a_hi - a_lo) / (c_hi - c_lo)) * (c - c_lo) + a_lo)
    return min(500, int(c))

PM25_BP  = [(0,30,0,50),(30,60,51,100),(60,90,101,200),(90,120,201,300),(120,250,301,400),(250,500,401,500)]
PM10_BP  = [(0,50,0,50),(50,100,51,100),(100,250,101,200),(250,350,201,300),(350,430,301,400),(430,600,401,500)]
NO2_BP   = [(0,40,0,50),(40,80,51,100),(80,180,101,200),(180,280,201,300),(280,400,301,400),(400,800,401,500)]
CO_BP    = [(0,1,0,50),(1,2,51,100),(2,10,101,200),(10,17,201,300),(17,34,301,400),(34,100,401,500)]
OZONE_BP = [(0,50,0,50),(50,100,51,100),(100,168,101,200),(168,208,201,300),(208,748,301,400),(748,1000,401,500)]

CAUSE_MAP = {
    "PM2.5": "Vehicle exhaust and construction dust",
    "PM10":  "Road dust and industrial emissions",
    "CO":    "Incomplete combustion from traffic",
    "NO2":   "Vehicle and industrial emissions",
    "Ozone": "Photochemical reaction from sunlight and pollutants",
}

import datetime
import math

def get_time_factor(node_id):
    h = datetime.datetime.now().hour
    
    # Industrial area NODE001 runs 24/7 with steady baseline emissions and random process spikes
    if node_id == "NODE001":
        # Flat diurnal wave (fluctuates between 0.95 and 1.1)
        factor = 0.95 + 0.10 * math.sin((h - 14) * math.pi / 12)
        # 5% chance of a temporary factory stack emissions release spike
        if random.random() < 0.05:
            factor *= 1.75
        return factor

    # Office and residential nodes follow daily traffic/rush-hour cycles
    if 8 <= h <= 10:
        factor = 1.35  # Morning office rush hour
    elif 17 <= h <= 20:
        factor = 1.45  # Evening home rush hour
    elif 23 <= h or h <= 5:
        factor = 0.55  # Night time quiet hours
    else:
        # Off-peak daytime variation
        factor = 0.90 + 0.15 * math.sin((h - 12) * math.pi / 6)
        
    return factor

def generate_reading(node):
    b = node["base"]
    node_id = node["node_id"]
    tf = get_time_factor(node_id)
    
    v = lambda base, spread: max(0, round((base + random.uniform(-spread, spread)) * tf, 2))

    if node_id == "NODE001":
        # Industrial Area: High PM10, CO2, VOCs, Smoke, and NO2 from stack emissions
        pm25  = v(b["pm25"],  b["pm25"]  * 0.10)
        pm10  = v(b["pm10"] * 1.25, b["pm10"] * 0.10)  # 25% higher PM10 (dust, ash)
        co    = v(b["co"],    b["co"]    * 0.15)
        no2   = v(b["no2"] * 1.15,  b["no2"]   * 0.10)  # 15% higher NO2 (combustion)
        ozone = v(b["ozone"], b["ozone"] * 0.15)
        co2   = v(b["co2"] * 1.30,  b["co2"]   * 0.05)  # 30% higher CO2 (ovens, boilers)
        voc   = v(b["voc"] * 1.40,  b["voc"]   * 0.15)  # 40% higher VOCs (solvents, chemicals)
        smoke = v(b["smoke"] * 1.50, b["smoke"] * 0.15)  # 50% higher Smoke
    else:
        # Residential / Commercial: Standard diurnal scaling
        pm25  = v(b["pm25"],  b["pm25"]  * 0.15)
        pm10  = v(b["pm10"],  b["pm10"]  * 0.15)
        co    = v(b["co"],    b["co"]    * 0.20)
        no2   = v(b["no2"],   b["no2"]   * 0.15)
        ozone = v(b["ozone"], b["ozone"] * 0.15)
        co2   = v(b["co2"],   b["co2"]   * 0.05)
        voc   = v(b["voc"],   b["voc"]   * 0.20)
        smoke = v(b["smoke"], b["smoke"] * 0.20)
        
    nh3   = round(random.uniform(1.0, 5.0) * tf, 2)

    sub_aqis = {
        "PM2.5": calc_sub_aqi(pm25,  PM25_BP),
        "PM10":  calc_sub_aqi(pm10,  PM10_BP),
        "CO":    calc_sub_aqi(co,    CO_BP),
        "NO2":   calc_sub_aqi(no2,   NO2_BP),
        "Ozone": calc_sub_aqi(ozone, OZONE_BP),
    }
    dom = max(sub_aqis, key=sub_aqis.get)
    aqi = sub_aqis[dom]

    return {
        "node_id":            node["node_id"],
        "aqi":                aqi,
        "pm25":               pm25,
        "pm10":               pm10,
        "co":                 co,
        "nh3":                nh3,
        "no2":                no2,
        "ozone":              ozone,
        "co2":                co2,
        "voc":                voc,
        "smoke":              smoke,
        "sub_aqi_pm25":       sub_aqis["PM2.5"],
        "sub_aqi_pm10":       sub_aqis["PM10"],
        "sub_aqi_co":         sub_aqis["CO"],
        "sub_aqi_nh3":        0,
        "sub_aqi_no2":        sub_aqis["NO2"],
        "sub_aqi_ozone":      sub_aqis["Ozone"],
        "dominant_pollutant": dom,
        "cause":              CAUSE_MAP[dom],
    }

# ── MQTT client setup ─────────────────────────────────────────
def create_mqtt_client():
    client = mqtt.Client(client_id=CLIENT_ID)
    client.tls_set(
        ca_certs=CA_CERT,
        certfile=CLIENT_CERT,
        keyfile=PRIVATE_KEY,
        tls_version=ssl.PROTOCOL_TLSv1_2,
    )
    client.on_connect = lambda c, u, f, rc: print(
        f"Connected to IoT Core ✓" if rc == 0 else f"Connection failed: rc={rc}"
    )
    client.connect(IOT_ENDPOINT, IOT_PORT, keepalive=60)
    client.loop_start()
    return client

# ── Simulate each node in a thread ───────────────────────────
def simulate_node(client, node):
    while True:
        try:
            reading = generate_reading(node)
            topic   = f"{TOPIC_PREFIX}/{node['node_id']}"
            client.publish(topic, json.dumps(reading), qos=1)
            print(f"[{node['name']:<22}] AQI: {reading['aqi']:>3}  "
                  f"Dominant: {reading['dominant_pollutant']:<6}  → {topic}")
        except Exception as e:
            print(f"[{node['name']}] Error: {e}")
        time.sleep(2)

# ── Main ──────────────────────────────────────────────────────
if __name__ == "__main__":
    print("AirPulse Simulator — publishing to AWS IoT Core every 5s")
    print(f"Endpoint: {IOT_ENDPOINT}\n")

    client = create_mqtt_client()
    time.sleep(2)  # wait for connection

    threads = []
    for node in NODES:
        t = threading.Thread(target=simulate_node, args=(client, node), daemon=True)
        t.start()
        threads.append(t)
        time.sleep(1)

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\nSimulation stopped")
        client.loop_stop()
        client.disconnect()
