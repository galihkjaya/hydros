-- WaterLens schema.
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting into the SQL
-- editor. The application works without these tables: persistence is optional
-- and failures are swallowed, so an investigation still completes.
--
-- Design notes:
-- * One row per investigation holds the visual analysis and geographic context
--   as JSONB. They are read as whole documents and never queried field by
--   field, so separate tables would buy nothing.
-- * Sources, evidence and the assessment are separate tables because they are
--   the things a user browses and links to.
-- * No user accounts in the MVP, so rows are anonymous. RLS is enabled with
--   read-only public access; every write goes through the service role on the
--   server.

create extension if not exists "pgcrypto";

-- Investigations -------------------------------------------------------------

create table if not exists public.investigations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),

  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  place_name text,
  country_code text check (country_code is null or char_length(country_code) = 2),

  -- Untrusted user text. Stored as data, never interpreted.
  user_note text not null default '',

  -- Public URL in the investigation-images bucket.
  image_url text,

  -- VisualAnalysis and GeographicContext, stored whole.
  visual jsonb,
  geographic jsonb,

  -- User-safe failure message when status = 'failed'.
  error text
);

create index if not exists investigations_created_at_idx
  on public.investigations (created_at desc);

-- Sources --------------------------------------------------------------------

create table if not exists public.sources (
  id bigserial primary key,
  investigation_id uuid not null
    references public.investigations (id) on delete cascade,

  title text not null,
  url text not null,
  domain text not null,
  snippet text not null default '',
  published_at text,

  source_type text not null
    check (source_type in ('government', 'scientific', 'news', 'community', 'unverified')),
  relevance real not null default 0 check (relevance between 0 and 1),

  -- The same page can surface across several queries.
  unique (investigation_id, url)
);

create index if not exists sources_investigation_idx
  on public.sources (investigation_id);

-- Evidence -------------------------------------------------------------------

create table if not exists public.evidence (
  id bigserial primary key,
  investigation_id uuid not null
    references public.investigations (id) on delete cascade,

  claim text not null,
  -- Not a foreign key: a claim must keep its citation even if the source row is
  -- pruned, and the URL is the citation.
  source_url text not null,
  uncertainty text not null default '',
  relevance real not null default 0 check (relevance between 0 and 1)
);

create index if not exists evidence_investigation_idx
  on public.evidence (investigation_id);

-- Assessments ----------------------------------------------------------------

create table if not exists public.assessments (
  investigation_id uuid primary key
    references public.investigations (id) on delete cascade,
  created_at timestamptz not null default now(),

  risk_level text not null
    check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'INSUFFICIENT_DATA')),
  confidence real not null check (confidence between 0 and 1),

  summary text not null,
  recommendation text not null,
  risk_factors jsonb not null default '[]'::jsonb,
  limitations jsonb not null default '[]'::jsonb,
  -- The evidence the conclusion actually rests on.
  cited_evidence jsonb not null default '[]'::jsonb
);

-- Row level security ---------------------------------------------------------
-- Investigations are public read-only artefacts in the MVP. All writes use the
-- service role, which bypasses RLS, so no write policy is granted to anon.

alter table public.investigations enable row level security;
alter table public.sources enable row level security;
alter table public.evidence enable row level security;
alter table public.assessments enable row level security;

drop policy if exists "investigations are publicly readable" on public.investigations;
create policy "investigations are publicly readable"
  on public.investigations for select using (true);

drop policy if exists "sources are publicly readable" on public.sources;
create policy "sources are publicly readable"
  on public.sources for select using (true);

drop policy if exists "evidence is publicly readable" on public.evidence;
create policy "evidence is publicly readable"
  on public.evidence for select using (true);

drop policy if exists "assessments are publicly readable" on public.assessments;
create policy "assessments are publicly readable"
  on public.assessments for select using (true);

-- Storage --------------------------------------------------------------------
-- Public bucket for uploaded photographs, capped at 8 MB to match the
-- application's own validation.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'investigation-images',
  'investigation-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
