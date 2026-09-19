# Hydros — Master Implementation Plan & Progress Tracker

> **INSTRUCTION FOR AI AGENTS:**  
> When working on this repository, you MUST:
> 1. Read [PRD.md](file:///d:/Portfolio/hydros/PRD.md) to understand the project architecture, design system, and technical requirements.
> 2. Keep this `PLAN.md` updated as you work. Mark completed tasks with `[x]`, update status indicators, and document any context or changes in the progress log.
> 3. Ensure all changes adhere to the 3-Layer Data Model (Observation → Evidence → Risk Assessment) and the Newspaper Design System (`--paper`, `--ink`, `--rule`, `--signal`).
> 4. Verify your work with `npm run typecheck && npm run lint && npm run test` before merging any branch into `test`.

---

## Current Status Overview

- **Active Branch:** `feat/foundation-ui`
- **Target Branch:** `test`
- **Overall Progress:** Branch 1 complete, verified (typecheck+lint+111 tests green), ready to merge

---

## Git & Workflow Strategy

- **Feature Branches:** `feat/foundation-ui`, `feat/cerebras-migration`, `feat/ai-research`, `feat/geospatial-pipeline`
- **Integration Branch:** `test`
- **Production Branch:** `main` (Untouched until all branches pass complete verification)
- **Merge Standard:** Merge feature branches into `test` using `git merge --no-ff <branch-name>` only after `npm run typecheck`, `npm run lint`, and `npm run test` pass 100%.

---

## Detailed Task Tracker

### Branch 1: `feat/foundation-ui` — Rebrand & Newspaper Design System
- `[x]` Git setup: Create `test` and `feat/foundation-ui` branches
- `[x]` Copy `.env` file, install dependencies, and verify environment setup
- `[x]` Rebrand identity in `package.json`, layout metadata, and storage configuration (`hydros-images`)
- `[x]` Implement newspaper design token system in `globals.css` (`--paper`, `--ink`, `--rule`, `--signal`)
- `[x]` Add Google Fonts via `next/font/google` (`Instrument Serif`, `Inter`, `JetBrains Mono`)
- `[x]` Rewrite primitive components (`Rule`, `Eyebrow`, `DisplayHeading`, `Card`, `Chip`, `Button`, `DataPair`, `Figure`, `Callout`)
- `[x]` Create Hydros branded SVGs (`Logo.tsx`, `public/src/logo.svg`, `public/src/banner.svg`)
- `[x]` Update layout components (`Navbar.tsx`, `Footer.tsx`, `ThemeToggle.tsx`) to newspaper aesthetic
- `[x]` Rebuild marketing landing page (`app/(marketing)/page.tsx`) with 7 editorial sections
- `[x]` Restyle `InvestigationWorkspace.tsx` to 12-column editorial grid
- `[x]` Restyle all investigation components (`Form`, `RiskAssessment`, `EvidenceCard`, `ContextPanels`, `Status`, `Timeline`, `SourceGathering`)
- `[x]` Restyle map, error, and not-found pages
- `[x]` Rebrand AI prompts and system messages (`orchestrator.ts`, `assessment.ts`, `vision-prompts.ts`, `geo`)
- `[x]` Add database migration `0002_rebrand_hydros.sql` for storage bucket configuration
- `[x]` Update `lib/supabase/store.ts` and `lib/investigation/draft.ts` bucket constants
- `[x]` Rewrite `README.md` to reflect Hydros vision, hackathon tracks, and architecture
- `[x]` Run verification: `npm run typecheck && npm run lint && npm run test`
- `[ ]` Merge `feat/foundation-ui` into `test` branch (`--no-ff`)

---

### Branch 2: `feat/cerebras-migration` — One Health, HITL & Guided Mode
- `[ ]` Extend domain types in `types/investigation.ts` (`HealthDomain`, `ExposureRoute`, `HealthPathway`, `provenance`)
- `[ ]` Add One Health events to `types/events.ts`
- `[ ]` Implement Cerebras One Health bridge layer (`lib/ai/one-health.ts`) with basis validation & conditional phrasing
- `[ ]` Split investigation orchestrator (`lib/investigation/orchestrator.ts`) into Phase A (Observation) and Phase B (Synthesis)
- `[ ]` Add database migration `0003_hitl_and_one_health.sql` and update DB types (`types/database.ts`)
- `[ ]` Update Supabase store (`lib/supabase/store.ts`) for observation provenance & health pathways
- `[ ]` Create API endpoints: Phase A (`/api/investigate`), Phase B (`/api/investigate/[id]/confirm`), Poll (`/api/investigate/[id]`)
- `[ ]` Build Human-in-the-Loop observation confirmation UI (`components/investigation/ObservationConfirmation.tsx`)
- `[ ]` Build One Health pathways presentation panel (`components/investigation/HealthPathways.tsx`)
- `[ ]` Create Guided Assessment checklist page (`app/investigate/guided/page.tsx`) & mapping logic (`lib/investigation/guided.ts`)
- `[ ]` Integrate confirmation & Health Pathways into `InvestigationWorkspace.tsx`
- `[ ]` Add unit tests (`tests/one-health.test.ts`, `tests/guided.test.ts`)
- `[ ]` Run verification: `npm run typecheck && npm run lint && npm run test`
- `[ ]` Merge `feat/cerebras-migration` into `test` branch (`--no-ff`)

---

### Branch 3: `feat/ai-research` — Interoperability, FAIR Data & Evidence Hardening
- `[ ]` Build FHIR R4 mapping library (`lib/fhir/bundle.ts`, `resources.ts`, `code-system.ts`)
- `[ ]` Create FHIR export endpoint (`/api/investigate/[id]/fhir/route.ts`) returning `application/fhir+json`
- `[ ]` Create JSON-LD endpoints (`/api/investigate/[id]/jsonld` & `/api/investigations.jsonld`) with Schema.org & DCAT compliance
- `[ ]` Add `FhirViewer.tsx` component to investigation workspace
- `[ ]` Harden evidence extraction (`lib/ai/evidence.ts`) with source-type weighting, claim-source URL matching, and staleness signals
- `[ ]` Strengthen prompt-injection defenses across AI prompt builders
- `[ ]` Update evidence card UI to display source weighting and source age inline
- `[ ]` Add test suites (`tests/injection.test.ts`, `tests/fhir.test.ts`, `tests/evidence-integrity.test.ts`, `tests/fair.test.ts`)
- `[ ]` Run verification: `npm run typecheck && npm run lint && npm run test`
- `[ ]` Merge `feat/ai-research` into `test` branch (`--no-ff`)

---

### Branch 4: `feat/geospatial-pipeline` — Spatial Intelligence, Trends, Alerts & Cities
- `[ ]` Implement geohash encoding and site grouping (`lib/geo/site.ts`) with precision 7 (~150m cells)
- `[ ]` Add database migration `0004_sites_and_trends.sql` for `sites` table and `site_geohash` relation
- `[ ]` Upgrade map page (`components/map/WaterMap.tsx`) with MapLibre GL JS, custom typographic markers, clustering, and filters
- `[ ]` Build Site Profile pages (`app/site/[geohash]/page.tsx`) with chronological investigation histories
- `[ ]` Create longitudinal trend computation engine (`lib/investigation/trends.ts`) & inline SVG charts (risk timeline, observation drift)
- `[ ]` Implement deterministic degradation alert engine (`lib/investigation/alerts.ts`) and alerts feed page (`app/alerts/page.tsx`)
- `[ ]` Implement research city registry (`lib/geo/cities.ts`) and city pages (`app/cities`, `app/cities/[slug]`)
- `[ ]` Create idempotent demo seeding script (`scripts/seed-demo.mjs`) with sample photos for Coimbra, Ghent, Oslo, Toulouse, and Benevento
- `[ ]` Add test suites (`tests/site.test.ts`, `tests/trends.test.ts`, `tests/alerts.test.ts`)
- `[ ]` Run full verification suite: `npm run typecheck && npm run lint && npm run test && npm run build`
- `[ ]` Merge `feat/geospatial-pipeline` into `test` branch (`--no-ff`)

---

## Verification & Final Handover Checklist

- `[ ]` All 4 feature branches merged into `test`
- `[ ]` `npm run build` passes with zero errors
- `[ ]` Zero occurrences of the old project name or the old hackathon theme remaining in working-tree source (0001 migration and repo URL excepted — see Branch 1 report)
- `[ ]` Strict 3-Layer separation verified across all feature endpoints
- `[ ]` Design system consistent across dark/light modes and responsive viewports (375px+)
- `[ ]` Final merge from `test` into `main` after user review
