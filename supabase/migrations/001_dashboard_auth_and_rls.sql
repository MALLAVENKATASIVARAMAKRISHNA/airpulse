-- AirPulse dashboard migration
-- Run this after the original schema in Supabase SQL Editor.

-- 1. Link public profiles to Supabase Auth and add protected application roles.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user';

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'));

-- Existing password_hash is not used after switching to Supabase Auth.
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;

-- A user has one health profile.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_health_user_id
  ON public.user_health(user_id);

-- Avoid null timestamps in live and historical views.
UPDATE public.aqi_readings SET recorded_at = NOW() WHERE recorded_at IS NULL;
ALTER TABLE public.aqi_readings
  ALTER COLUMN recorded_at SET DEFAULT NOW(),
  ALTER COLUMN recorded_at SET NOT NULL;

-- 2. Signup trigger. Role is always forced to "user"; client metadata cannot create admins.
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    auth_id,
    node_id,
    full_name,
    email,
    phone_number,
    password_hash,
    location,
    role
  ) VALUES (
    NEW.id,
    NULLIF(NEW.raw_user_meta_data->>'node_id', ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(NEW.raw_user_meta_data->>'phone_number', ''),
    NULL,
    (
      SELECT n.location
      FROM public.nodes n
      WHERE n.node_id = NULLIF(NEW.raw_user_meta_data->>'node_id', '')
    ),
    'user'
  )
  ON CONFLICT (email) DO UPDATE
  SET
    auth_id = EXCLUDED.auth_id,
    node_id = COALESCE(EXCLUDED.node_id, public.users.node_id),
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number),
    location = COALESCE(EXCLUDED.location, public.users.location);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 3. Helper used by RLS policies. SECURITY DEFINER avoids recursive users policies.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_node()
RETURNS VARCHAR
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT node_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_node() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_node() TO authenticated;

-- 4. Latest reading per node for the admin overview.
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
-- reading_id is the insertion sequence. This prevents future-dated seed rows
-- or device clock drift from hiding a newly applied live reading.
ORDER BY r.node_id, r.reading_id DESC;

GRANT SELECT ON public.latest_node_readings TO authenticated;

-- 5. Row-level security.
ALTER TABLE public.nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aqi_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nodes are available for signup" ON public.nodes;
CREATE POLICY "Nodes are available for signup"
  ON public.nodes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users read own profile or admin reads all" ON public.users;
CREATE POLICY "Users read own profile or admin reads all"
  ON public.users FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid() OR public.current_user_role() = 'admin');

DROP POLICY IF EXISTS "Health conditions are readable" ON public.health_conditions;
CREATE POLICY "Health conditions are readable"
  ON public.health_conditions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users read own health or admin reads all" ON public.user_health;
CREATE POLICY "Users read own health or admin reads all"
  ON public.user_health FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = user_health.user_id
        AND u.auth_id = auth.uid()
    )
    OR public.current_user_role() = 'admin'
  );

DROP POLICY IF EXISTS "Users create own health profile" ON public.user_health;
CREATE POLICY "Users create own health profile"
  ON public.user_health FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = user_health.user_id
        AND u.auth_id = auth.uid()
        AND u.role = 'user'
    )
  );

DROP POLICY IF EXISTS "Users update own health profile" ON public.user_health;
CREATE POLICY "Users update own health profile"
  ON public.user_health FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = user_health.user_id
        AND u.auth_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.user_id = user_health.user_id
        AND u.auth_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read assigned node readings" ON public.aqi_readings;
CREATE POLICY "Users read assigned node readings"
  ON public.aqi_readings FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'admin'
    OR node_id = public.current_user_node()
  );

DROP POLICY IF EXISTS "Admins insert node readings" ON public.aqi_readings;
CREATE POLICY "Admins insert node readings"
  ON public.aqi_readings FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'admin');

-- 6. Realtime must include aqi_readings for instant dashboard alerts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'aqi_readings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.aqi_readings;
  END IF;
END $$;

-- 7. Create admin safely:
--    a) Supabase Dashboard -> Authentication -> Users -> Add user.
--    b) Use the same email below, then run:
--
-- INSERT INTO public.users (auth_id, node_id, full_name, email, role, location)
-- SELECT id, NULL, 'AirPulse Admin', email, 'admin', 'AirPulse Headquarters'
-- FROM auth.users
-- WHERE email = 'admin@airpulse.com'
-- ON CONFLICT (auth_id) DO UPDATE SET role = 'admin';
--
-- If the signup trigger already created the profile, only this is needed:
-- UPDATE public.users
-- SET role = 'admin', node_id = NULL
-- WHERE auth_id = (SELECT id FROM auth.users WHERE email = 'admin@airpulse.com');
