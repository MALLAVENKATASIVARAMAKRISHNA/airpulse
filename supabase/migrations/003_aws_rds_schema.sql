-- ============================================================
-- AirPulse — Complete Schema for AWS RDS PostgreSQL
-- Run: psql -h <endpoint> -U airpulse_admin -d airpulse -f 003_aws_rds_schema.sql
-- ============================================================

-- 1. NODES
CREATE TABLE IF NOT EXISTS nodes (
  node_id   VARCHAR(50) PRIMARY KEY,
  location  VARCHAR(100),
  district  VARCHAR(100),
  state     VARCHAR(100),
  pincode   VARCHAR(10)
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
  user_id       SERIAL PRIMARY KEY,
  node_id       VARCHAR(50) REFERENCES nodes(node_id),
  full_name     VARCHAR(150),
  email         VARCHAR(150) UNIQUE NOT NULL,
  phone_number  VARCHAR(20),
  location      VARCHAR(100),
  role          VARCHAR(10) DEFAULT 'user'
                  CHECK (role IN ('admin', 'user', 'authority')),
  password_hash TEXT
);

-- 3. HEALTH CONDITIONS
CREATE TABLE IF NOT EXISTS health_conditions (
  condition_id   SERIAL PRIMARY KEY,
  condition_name VARCHAR(100) NOT NULL
);

-- 4. USER HEALTH
CREATE TABLE IF NOT EXISTS user_health (
  health_id      SERIAL PRIMARY KEY,
  user_id        INT UNIQUE REFERENCES users(user_id),
  condition_id   INT REFERENCES health_conditions(condition_id),
  severity_level VARCHAR(10) DEFAULT 'None'
                   CHECK (severity_level IN ('None', 'Low', 'Medium', 'High')),
  age            INT,
  gender         VARCHAR(20)
);

-- 5. AQI READINGS
CREATE TABLE IF NOT EXISTS aqi_readings (
  reading_id         SERIAL PRIMARY KEY,
  node_id            VARCHAR(50) REFERENCES nodes(node_id),

  -- Core AQI
  aqi                INT,

  -- Pollutant raw values
  pm25               NUMERIC(6,2)  DEFAULT 0,
  pm10               NUMERIC(6,2)  DEFAULT 0,
  co                 NUMERIC(6,2)  DEFAULT 0,
  nh3                NUMERIC(6,2)  DEFAULT 0,
  no2                NUMERIC(6,2)  DEFAULT 0,
  ozone              NUMERIC(6,2)  DEFAULT 0,
  co2                NUMERIC(8,2)  DEFAULT 0,
  voc                NUMERIC(6,2)  DEFAULT 0,
  smoke              NUMERIC(6,2)  DEFAULT 0,

  -- Sub-AQI (only for pollutants with official NAAQS breakpoints)
  sub_aqi_pm25       INT DEFAULT 0,
  sub_aqi_pm10       INT DEFAULT 0,
  sub_aqi_co         INT DEFAULT 0,
  sub_aqi_nh3        INT DEFAULT 0,
  sub_aqi_no2        INT DEFAULT 0,
  sub_aqi_ozone      INT DEFAULT 0,

  -- Pollution cause
  dominant_pollutant VARCHAR(20),
  cause              TEXT,

  recorded_at        TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 6. ALERT THRESHOLDS
CREATE TABLE IF NOT EXISTS alert_thresholds (
  condition_id   INT REFERENCES health_conditions(condition_id),
  severity_level VARCHAR(10),
  aqi_threshold  INT NOT NULL,
  PRIMARY KEY (condition_id, severity_level)
);

-- 7. USER ALERT LOG
CREATE TABLE IF NOT EXISTS user_alert_log (
  log_id     SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(user_id),
  reading_id INT REFERENCES aqi_readings(reading_id),
  alerted_at TIMESTAMP DEFAULT NOW()
);

-- 8. AQI PREDICTIONS
CREATE TABLE IF NOT EXISTS aqi_predictions (
  prediction_id SERIAL PRIMARY KEY,
  node_id       VARCHAR(50) REFERENCES nodes(node_id),
  predicted_aqi INT,
  predicted_for TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- 9. LATEST READING PER NODE (view)
CREATE OR REPLACE VIEW latest_node_readings AS
SELECT DISTINCT ON (r.node_id)
  r.*,
  n.location,
  n.district,
  n.state,
  n.pincode
FROM aqi_readings r
JOIN nodes n ON n.node_id = r.node_id
ORDER BY r.node_id, r.reading_id DESC;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Nodes
INSERT INTO nodes (node_id, location, district, state, pincode) VALUES
  ('NODE001', 'Manali Industrial Area', 'Chennai', 'Tamil Nadu', '600068'),
  ('NODE002', 'Anna Nagar',             'Chennai', 'Tamil Nadu', '600040'),
  ('NODE003', 'T Nagar',                'Chennai', 'Tamil Nadu', '600017'),
  ('NODE004', 'Mount Road',             'Chennai', 'Tamil Nadu', '600002'),
  ('NODE005', 'Semmozhi Poonga',        'Chennai', 'Tamil Nadu', '600006')
ON CONFLICT (node_id) DO NOTHING;

-- Health conditions
INSERT INTO health_conditions (condition_name) VALUES
  ('Normal'),
  ('Asthma'),
  ('COPD'),
  ('Heart Disease'),
  ('Diabetes'),
  ('Elderly'),
  ('Children')
ON CONFLICT DO NOTHING;

-- Alert thresholds
INSERT INTO alert_thresholds (condition_id, severity_level, aqi_threshold) VALUES
  (1, 'None',   200),
  (2, 'Low',    125), (2, 'Medium', 100), (2, 'High',  75),
  (3, 'Low',    125), (3, 'Medium', 100), (3, 'High',  75),
  (4, 'Low',    125), (4, 'Medium', 100), (4, 'High',  75),
  (5, 'Low',    175), (5, 'Medium', 150), (5, 'High', 125),
  (6, 'Low',    125), (6, 'Medium', 100), (6, 'High',  75),
  (7, 'Low',    125), (7, 'Medium', 100), (7, 'High',  75)
ON CONFLICT DO NOTHING;
