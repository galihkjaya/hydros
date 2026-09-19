# Hydros — Product Requirements Document (PRD)

**Project:** Hydros
**Event:** IEEE OneAquaHealth Global Hackathon 2026  
**Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Cerebras SDK, MapLibre GL JS, Supabase  

---

## 1. Executive Summary & Vision

Hydros is an AI-powered water safety investigation and One Health intelligence platform. Built for citizen scientists, environmental researchers, and public health officials, Hydros transforms raw ground-level observations (photographs or guided checklist entries) and geographic location data into structured, URL-traceable, and domain-grounded water risk assessments.

### Core Value Proposition
- **Strict Separation of Facts vs. Inferences:** Enforces a rigid 3-layer domain model (Observation → Evidence → Risk Assessment) preventing halluncinated safety assertions.
- **One Health Integration:** Links water contamination indicators directly across Ecosystem, Animal, and Human health domains using conditional, evidence-backed pathways.
- **Newspaper Design System:** Premium, high-contrast, editorial black-and-white visual identity optimized for data density and maximum legibility.
- **Open Data & Interoperability:** Full FHIR R4 Bundle exporting, JSON-LD / DCAT metadata standards, and open source-weighted evidence synthesis.
- **Geospatial & Temporal Intelligence:** Geohash-based site grouping (~150m cells), interactive greyscale spatial mapping, deterministic alert engines, and longitudinal trend analysis.

---

## 2. Core Architectural & Design Principles

### 2.1 The Three-Layer Data Model
Every investigation in Hydros maintains a strict separation of concerns in code and data types:
1. **Observation (`VisualObservation`):** Raw facts extracted visually from photos or directly reported by users. *Never* asserts safety, risk, or chemical contamination on its own.
2. **Evidence (`Evidence`):** URL-traceable external findings gathered from OpenStreetMap, scientific literature, government datasets, or web search. Must link to verifiable sources.
3. **Inference (`RiskAssessment` & `HealthPathway`):** Synthesized conclusions derived *only* by evaluating Evidence against Observations. Expressed with explicit confidence levels and conditional phrasing.

### 2.2 Newspaper Visual Aesthetics ("Ink & Paper")
The application strictly uses a high-contrast editorial newspaper aesthetic:
- **Color Palette:**
  - Background: Off-white newsprint (`--paper`: `#FDFBF7`, Dark: `#121212`)
  - Typography/Borders: Deep charcoal ink (`--paper-ink`: `#1A1917`, Dark: `#F0EFEA`)
  - Structural Hairlines: Hairline rules (`--rule`: `#D8D5CD`, Dark: `#33322E`)
  - Accent Signal: High-visibility editorial red (`--signal`: `#D03B2C`) reserved exclusively for critical warnings and active UI indicators.
- **Typography:**
  - Display/Headings: `Instrument Serif` (Editorial headlines, title blocks)
  - Body Text: `Inter` (Clean readability)
  - Monospace/Data: `JetBrains Mono` (Coordinates, geohashes, metrics, code, confidence values)
- **UI Elements:**
  - Hairline borders (`1px solid var(--rule)`), zero border radius (`rounded-none`), zero drop shadows (`shadow-none`).
  - Risk chips: Typographic styling only (LOW: outline, MEDIUM: solid ink, HIGH: signal fill, INSUFFICIENT_DATA: dashed outline).

---

## 3. Detailed Feature Specifications by Feature Branch

### 3.1 Branch 1: `feat/foundation-ui` — Rebrand & Design System
- **Rebrand:** Rename all references from Hydros to Hydros across `package.json`, metadata, layout, storage buckets (`hydros-images`), and scripts.
- **Newspaper Design Tokens:** Implement global CSS variables for paper, ink, rule, and signal in light and dark modes.
- **Typography Integration:** Load `Instrument Serif`, `Inter`, and `JetBrains Mono` via `next/font/google`.
- **UI Component Library:** Build rule-based primitives (`Rule`, `Eyebrow`, `DisplayHeading`, `Card`, `Chip`, `Button`, `DataPair`, `Figure`, `Callout`).
- **Editorial Landing Page:** 7-section layout featuring Masthead Hero, 3-Layer Explainer, Live Demo Strip, 4-Stage Pipeline, One Health Section, Limitations Callout, and Hackathon Footer.
- **Branded SVGs:** Replace all icons/banners with vector Hydros wordmarks and triple-rule icons.

### 3.2 Branch 2: `feat/cerebras-migration` — One Health, HITL & Guided Mode
- **Cerebras One Health Bridge (`lib/ai/one-health.ts`):** Evaluates visual observations and evidence packages to construct `HealthPathway` objects for Human, Animal, and Ecosystem domains. Enforces non-empty evidence basis and conditional phrasing.
- **Human-in-the-Loop (HITL) Confirmation:**
  - Pipeline split into Phase A (Image processing & location geocoding → `awaiting_confirmation`) and Phase B (Confirmed observations → evidence synthesis & risk assessment).
  - Confirmation interface (`ObservationConfirmation.tsx`) allowing users to edit, add, or remove AI-detected observations before proceeding.
- **Guided Assessment (`/investigate/guided`):** 10-item structured visual observation checklist enabling investigations without requiring a photograph.

### 3.3 Branch 3: `feat/ai-research` — Interoperability, FAIR Data & Evidence Hardening
- **FHIR R4 Export (`/api/investigate/[id]/fhir`):** Generates valid FHIR R4 Bundle collections containing `Location`, `Observation` (survey & exposure), `RiskAssessment`, `DocumentReference`, and `Provenance` resources.
- **FAIR Data Standards (`/api/investigate/[id]/jsonld` & `/api/investigations.jsonld`):** Exports Schema.org + Dataset & DCAT metadata for web crawler indexing and open research federation.
- **Evidence Hardening:**
  - Source-type weighting (Government > Scientific > News > Community > Unverified).
  - Claim-source URL matching and staleness down-weighting (>5 years old).
  - Prompt-injection defenses wrapping external text in explicit delimiters.

### 3.4 Branch 4: `feat/geospatial-pipeline` — MapLibre, Geohashing, Trends, Alerts & Cities
- **Geohash Site Clustering (`lib/geo/site.ts`):** Groups investigations into Geohash Precision 7 cells (~150m radius).
- **MapLibre GL JS Water Map (`/map`):** Interactive greyscale map with custom typographic markers, clustering, and filtering by risk, date, and investigation mode.
- **Site Profiles & Trend Analysis (`/site/[geohash]`):** Reverse-chronological investigation timeline with custom inline SVG risk timelines and observation drift tables.
- **Deterministic Alert Engine (`lib/investigation/alerts.ts`):** Fires alerts based on risk degradation, persistent medium/high risks, new scientific sources, or sudden pathway strength increases.
- **Research Cities Portal (`/cities` & `/cities/[slug]`):** Dedicated hubs for 5 research cities (Coimbra, Ghent, Oslo, Toulouse, Benevento) pre-seeded with sample data via `scripts/seed-demo.mjs`.

---

## 4. Verification & Quality Standards

- **Static Analysis:** `npm run typecheck` and `npm run lint` must pass cleanly without warnings.
- **Automated Tests:** `npm run test` must pass all unit and integration tests covering One Health validation, prompt injection defense, FHIR bundle correctness, evidence integrity, geohashing, trends, and alert generation.
- **Build Verification:** `npm run build` must complete without errors.
- **Branch Strategy:** Work occurs on `feat/*` branches and merges into `test` with `--no-ff`.
