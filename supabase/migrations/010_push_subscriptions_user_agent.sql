-- The code (browser-notifications) stores the subscriber's user agent, and the
-- original schema had this column; the live table was created without it.
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text;
