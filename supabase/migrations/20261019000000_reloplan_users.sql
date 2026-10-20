-- ReloPlan authentication schema.
-- Additive and idempotent: safe to run more than once. Never drops tables or deletes rows.
-- Run in the Supabase SQL editor (or `psql`) against the intended project.

-- 1. Users ---------------------------------------------------------------------
-- The four business fields keep their exact quoted names. Internal fields are lower-case.
create table if not exists public."ReloPlan_Users" (
  "Username"               text   not null,            -- normalized (trimmed, lower-cased) email
  "Password"               text   not null,            -- Argon2id hash, never the original password
  "Date of Registration"   date   not null default current_date,
  "Date of Deregistration" date,                       -- NULL = active
  id                       bigint generated always as identity primary key,
  session_version          integer     not null default 1,  -- bump to invalidate all sessions
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint reloplan_users_username_not_blank check (length(btrim("Username")) > 0)
);

-- Case-insensitive uniqueness, also covering rows that might be inserted outside the app.
create unique index if not exists reloplan_users_username_ci_key
  on public."ReloPlan_Users" (lower("Username"));

-- 2. Sessions --------------------------------------------------------------------
-- Only a SHA-256 hash of the session token is stored; the raw token lives in an HttpOnly cookie.
create table if not exists public.reloplan_sessions (
  token_hash        text primary key,
  user_id           bigint references public."ReloPlan_Users"(id) on delete cascade,
  is_admin          boolean     not null default false,
  session_version   integer,               -- user's session_version when the session was created
  admin_fingerprint text,                  -- admin sessions: fingerprint of the admin credential
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null,
  revoked_at        timestamptz,
  constraint reloplan_sessions_owner check (
    (is_admin and user_id is null and admin_fingerprint is not null)
    or (not is_admin and user_id is not null and session_version is not null)
  )
);

create index if not exists reloplan_sessions_user_idx on public.reloplan_sessions (user_id);
create index if not exists reloplan_sessions_expires_idx on public.reloplan_sessions (expires_at);

-- 3. Rate-limit events -----------------------------------------------------------
create table if not exists public.reloplan_rate_events (
  id         bigint generated always as identity primary key,
  bucket     text        not null,   -- e.g. 'login-fail-user', 'login-fail-ip', 'register-ip'
  key        text        not null,   -- hashed identifier (email or IP)
  created_at timestamptz not null default now()
);

create index if not exists reloplan_rate_events_lookup_idx
  on public.reloplan_rate_events (bucket, key, created_at);

-- 4. Lock the tables away from Supabase's public API roles -------------------------
-- All access goes through the server using the database connection string.
-- RLS with no policies denies every row to anon/authenticated; revoking privileges is belt and braces.
alter table public."ReloPlan_Users"      enable row level security;
alter table public.reloplan_sessions     enable row level security;
alter table public.reloplan_rate_events  enable row level security;

do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public."ReloPlan_Users" from %I', r);
      execute format('revoke all on table public.reloplan_sessions from %I', r);
      execute format('revoke all on table public.reloplan_rate_events from %I', r);
    end if;
  end loop;
end
$$;
