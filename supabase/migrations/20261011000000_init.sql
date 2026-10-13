-- Restaurant Swipe: initial schema
create extension if not exists postgis with schema extensions;

-- Every restaurant found by any sweep. Google Places content may only be cached
-- for a limited time, so fetched_at drives refreshes.
create table public.restaurants (
  place_id        text primary key,
  name            text not null,
  lat             double precision not null,
  lng             double precision not null,
  geog            extensions.geography(Point, 4326)
                    generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored,
  address         text,
  rating          real,
  rating_count    integer not null default 0,
  price_level     smallint,            -- 0 (free) .. 4 (very expensive), null if unknown
  primary_type    text,
  google_types    text[] not null default '{}',
  summary         text,
  photo_name      text,                -- Places photo resource name, served via /api/photo
  website         text,
  maps_url        text,
  hours           jsonb,               -- regularOpeningHours.periods
  utc_offset_min  integer,
  fetched_at      timestamptz not null default now(),
  -- categorization
  cuisine         text,
  tags            text[] not null default '{}',
  tagged_at       timestamptz
);

create index restaurants_geog_idx on public.restaurants using gist (geog);
create index restaurants_cuisine_idx on public.restaurants (cuisine);
create index restaurants_untagged_idx on public.restaurants (place_id) where tagged_at is null;

-- One row per sweep, so a sweep can report progress and be reused.
create table public.searches (
  id              bigint generated always as identity primary key,
  label           text,
  origin_lat      double precision not null,
  origin_lng      double precision not null,
  radius_mi       real not null,
  status          text not null default 'pending'
                    check (status in ('pending', 'fetching', 'tagging', 'done', 'failed')),
  tiles_total     integer not null default 0,
  requests_made   integer not null default 0,
  places_found    integer not null default 0,
  tagged_count    integer not null default 0,
  error           text,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz
);

create table public.swipes (
  id              bigint generated always as identity primary key,
  place_id        text not null references public.restaurants (place_id) on delete cascade,
  decision        text not null check (decision in ('yes', 'no')),
  cuisine_filter  text,
  weight_deltas   jsonb not null default '{}',  -- {feature: delta} actually applied, for exact undo
  created_at      timestamptz not null default now()
);

create index swipes_place_idx on public.swipes (place_id);

-- Learned affinity per feature, e.g. 'cuisine:thai', 'tag:date-night', 'price:2'.
create table public.preference_weights (
  feature         text primary key,
  weight          real not null default 0,
  updated_at      timestamptz not null default now()
);

-- Single user, no login: lock every table to the service role (used only server-side).
alter table public.restaurants enable row level security;
alter table public.searches enable row level security;
alter table public.swipes enable row level security;
alter table public.preference_weights enable row level security;

-- Candidates for the deck: restaurants within radius of an origin, with distance,
-- optional cuisine filter, and already-swiped places excluded (unless asked).
create or replace function public.deck_candidates(
  p_lat double precision,
  p_lng double precision,
  p_radius_m double precision,
  p_cuisine text default null,
  p_include_passed boolean default false
)
returns table (
  place_id text,
  name text,
  lat double precision,
  lng double precision,
  address text,
  rating real,
  rating_count integer,
  price_level smallint,
  summary text,
  photo_name text,
  website text,
  maps_url text,
  hours jsonb,
  utc_offset_min integer,
  cuisine text,
  tags text[],
  distance_m double precision
)
language sql
stable
set search_path = public, extensions
as $$
  with origin as (
    select st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography as g
  )
  select r.place_id, r.name, r.lat, r.lng, r.address, r.rating, r.rating_count,
         r.price_level, r.summary, r.photo_name, r.website, r.maps_url, r.hours,
         r.utc_offset_min, r.cuisine, r.tags,
         st_distance(r.geog, origin.g) as distance_m
  from public.restaurants r, origin
  where st_dwithin(r.geog, origin.g, p_radius_m)
    and (p_cuisine is null or r.cuisine = p_cuisine)
    and not exists (
      select 1 from public.swipes s
      where s.place_id = r.place_id
        and (s.decision = 'yes' or not p_include_passed)
    )
  order by r.place_id
$$;

revoke execute on function public.deck_candidates from public, anon, authenticated;
