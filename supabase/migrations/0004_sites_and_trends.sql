-- Hydros sites and trends.
--
-- Investigations at the same place are grouped into geohash precision-7 cells
-- (~150 m). The application computes the cell; this migration only stores it.
-- Backfill for existing rows runs via `node scripts/backfill-sites.mjs`
-- (a SQL geohash implementation would be an unreviewable black box; the
-- script reuses lib/geo/site.ts, the same code as the live path).

create table if not exists public.sites (
  geohash text primary key,
  centroid_lat double precision not null,
  centroid_lng double precision not null,
  display_name text,
  waterway_name text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  investigation_count integer not null default 0
);

alter table public.sites enable row level security;

drop policy if exists "sites are publicly readable" on public.sites;
create policy "sites are publicly readable"
  on public.sites for select using (true);

alter table public.investigations
  add column if not exists site_geohash text references public.sites (geohash);

create index if not exists investigations_site_geohash_idx
  on public.investigations (site_geohash);
