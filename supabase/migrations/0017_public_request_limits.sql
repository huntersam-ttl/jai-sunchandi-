-- Server-side abuse protection for unauthenticated API lookups/submissions.
-- Keys are HMAC'd by the application; raw client addresses are never stored.
create table if not exists public.public_request_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.public_request_limits enable row level security;
revoke all on public.public_request_limits from anon, authenticated;
