-- 005: ML integration tables
-- Apply: psql -h <host> -U <user> -d <db> -f 005_ml_tables.sql

-- Extend aqi_predictions with horizon column (6h / 24h / 48h)
ALTER TABLE aqi_predictions ADD COLUMN IF NOT EXISTS horizon VARCHAR(10) DEFAULT '6h';

-- Flag anomalous readings detected by Isolation Forest
ALTER TABLE aqi_readings ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE;

-- Hotspot clusters detected by DBSCAN
CREATE TABLE IF NOT EXISTS hotspot_clusters (
  cluster_id   SERIAL PRIMARY KEY,
  node_ids     TEXT[],
  centroid_aqi INT,
  label        VARCHAR(50),
  created_at   TIMESTAMP DEFAULT NOW()
);
