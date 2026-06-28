-- Migration 006: node_metadata + node_weather tables for ML pipeline

CREATE TABLE IF NOT EXISTS node_metadata (
    node_id              VARCHAR(10) PRIMARY KEY REFERENCES nodes(node_id),
    latitude             FLOAT,
    longitude            FLOAT,
    zone_type            VARCHAR(20),
    zone_type_code       INT,
    near_highway         BOOLEAN DEFAULT FALSE,
    near_factory         BOOLEAN DEFAULT FALSE,
    near_construction    BOOLEAN DEFAULT FALSE,
    population_density   INT,
    green_cover_percentage FLOAT
);

CREATE TABLE IF NOT EXISTS node_weather (
    node_id          VARCHAR(10) PRIMARY KEY REFERENCES nodes(node_id),
    temperature      FLOAT,
    humidity         FLOAT,
    pressure         FLOAT,
    wind_speed       FLOAT,
    rainfall         FLOAT,
    visibility       FLOAT,
    traffic_density  FLOAT,
    updated_at       TIMESTAMP DEFAULT NOW()
);
