-- ============================================================
-- Run this after 001_initial.sql
-- Helper function used by the monthly-reminder Edge Function
-- ============================================================

create or replace function public.get_outstanding_debts()
returns table (
  debtor_id     uuid,
  debtor_email  text,
  debtor_name   text,
  board_name    text,
  total_owed    numeric
)
language sql security definer as $$
  select
    p.id                     as debtor_id,
    p.email                  as debtor_email,
    p.full_name              as debtor_name,
    b.name                   as board_name,
    round(sum(cs.share), 2)  as total_owed
  from cost_splits cs
  join costs c        on c.id       = cs.cost_id
  join boards b       on b.id       = c.board_id
  join profiles p     on p.id       = cs.user_id
  where cs.settled = false
    and cs.user_id != c.paid_by   -- exclude the payer's own share
  group by p.id, p.email, p.full_name, b.id, b.name
  having sum(cs.share) > 0
  order by total_owed desc;
$$;

-- ============================================================
-- CRON JOB — fires Edge Function on 1st of every month at 8am
-- Requires: pg_cron extension enabled in Supabase Dashboard
-- Dashboard → Database → Extensions → pg_cron → Enable
-- ============================================================
select cron.schedule(
  'monthly-debt-reminder',
  '0 8 1 * *',  -- 8:00am on the 1st of every month (UTC)
  $$
    select net.http_post(
      url    := current_setting('app.supabase_url') || '/functions/v1/monthly-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body   := '{}'::jsonb
    );
  $$
);
