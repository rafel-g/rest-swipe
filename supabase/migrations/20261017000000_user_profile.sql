-- What the user told us up front: cuisines they like and dietary restrictions.
-- Single user, so a single row (id is always true).
create table public.user_profile (
  id              boolean primary key default true check (id),
  cuisines        text[] not null default '{}',
  dietary         text[] not null default '{}',
  updated_at      timestamptz not null default now()
);

alter table public.user_profile enable row level security;
