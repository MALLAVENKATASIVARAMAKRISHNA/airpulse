# AirPulse dashboard

Role-based Supabase dashboard for the AirPulse MVP.

## Included

- Email/password login and signup through Supabase Auth
- User/admin routing based on the protected `users.role` field
- First-login health-profile onboarding
- User dashboard scoped to the assigned monitoring node
- Pollutant composition and recent AQI trend
- Realtime full-screen alert when the assigned node receives AQI above 200
- Admin node selector and controls for AQI, pollutant values, and sub-AQI values
- Each admin apply operation creates a timestamped database reading
- Row-level security preventing users from reading other node data or granting themselves admin access

## Setup

1. Run your original AirPulse schema in Supabase.
2. Run the SQL files in `supabase/migrations` in numeric order in the Supabase SQL Editor.
3. Create `.env` from `.env.example` and add the Supabase project URL and anon key.
4. Install and run:

   ```bash
   npm install
   npm run dev
   ```

## Create the admin login

In Supabase, open **Authentication → Users → Add user** and create `admin@airpulse.com` with a secure password. Then run:

```sql
UPDATE public.users
SET role = 'admin',
    node_id = NULL,
    full_name = 'AirPulse Admin',
    location = 'AirPulse Headquarters'
WHERE auth_id = (
  SELECT id FROM auth.users WHERE email = 'admin@airpulse.com'
);
```

The Auth creation trigger creates or links the public profile by email. It never grants an admin role. Admin status can only be assigned directly in the database.

## Alert behavior

The admin panel inserts a new `aqi_readings` row when **Apply live reading** is clicked. Supabase Realtime sends it only to authenticated users allowed by RLS. A user assigned to that node receives a blocking dashboard alert when AQI is 200 or higher. Dismissing the alert hides that reading; a later dangerous reading creates a new alert.
