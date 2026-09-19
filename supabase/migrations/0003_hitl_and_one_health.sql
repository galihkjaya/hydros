-- Hydros human-in-the-loop and One Health bridge.
--
-- * `awaiting_confirmation` pauses the run between Phase A (observation) and
--   Phase B (research → assessment) while the user reviews observations.
-- * `health_pathways` stores the Layer 2.5 bridge output as JSONB.
-- * `guided_responses` stores the raw guided-checklist answers as JSONB.
-- Observation provenance lives inside the `visual` JSONB documents, so no
-- further DDL is needed for it.

alter table public.investigations
  drop constraint if exists investigations_status_check;

alter table public.investigations
  add constraint investigations_status_check
  check (status in ('running', 'awaiting_confirmation', 'completed', 'failed'));

alter table public.investigations
  add column if not exists health_pathways jsonb not null default '[]'::jsonb;

alter table public.investigations
  add column if not exists guided_responses jsonb;
