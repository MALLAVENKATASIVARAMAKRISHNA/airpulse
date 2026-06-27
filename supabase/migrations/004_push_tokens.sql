-- Add push notification token to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
