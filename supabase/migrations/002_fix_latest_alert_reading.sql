-- Fix latest-reading selection for dashboard alerts.
-- Run this in Supabase SQL Editor after migration 001.

CREATE OR REPLACE VIEW public.latest_node_readings
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (r.node_id)
  r.*,
  n.location,
  n.district,
  n.state,
  n.pincode
FROM public.aqi_readings r
JOIN public.nodes n ON n.node_id = r.node_id
ORDER BY r.node_id, r.reading_id DESC;

GRANT SELECT ON public.latest_node_readings TO authenticated;
