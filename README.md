<p align="center">
  <img src="public/src/banner.svg" alt="WaterLens" width="900">
</p>

<p align="center">
  <strong>See water. Find context. Follow the evidence.</strong>
  <br>
  AI-powered environmental investigation from a photograph and a location.
</p>

<p align="center">
  <a href="https://waterlens.vercel.app">Live Demo</a>
  ·
  <a href="(https://devpost.com/software/waterlens)">Devpost</a>
</p>

<p align="center">
  <sub>Replace the placeholder links above with the published project URLs.</sub>
</p>

## See it

WaterLens turns a photograph of a water source and its location into a structured
environmental investigation. It brings visual observations, geographic context,
public web sources, and a cautious assessment into one workflow.

There are no application screenshots checked into the repository yet, so the
workflow below is the clearest product preview for now:

```text
Photo + Location
       ↓
Visual Analysis
       ↓
Geographic Context
       ↓
Research Plan
       ↓
Web Search
       ↓
Evidence Synthesis
       ↓
Assessment
```

The result is not a black-box verdict. WaterLens keeps the path from what was
seen to what was found to what can reasonably be inferred visible throughout the
investigation.

## The investigation experience

WaterLens exposes the work as it happens. The workspace streams real backend
stages such as:

```text
Identifying visual characteristics…
Checking the surrounding area…
Planning what to investigate…
Searching the web…
Analysing evidence…
Preparing assessment…
```

The progress timeline reflects actual investigation events rather than an
arbitrary loading animation. Sources appear as they are found, and the final
assessment includes the evidence and limitations behind it.

## Observation → Evidence → Inference

WaterLens deliberately keeps three kinds of information separate:

| Layer | What it means | Example |
| --- | --- | --- |
| **Observation** | What can actually be seen in the photograph. | “The water appears brown and cloudy.” |
| **Evidence** | What a retrieved external source states, with its URL preserved. | “A public report documented elevated turbidity in the surrounding basin.” |
| **Inference** | What can reasonably be concluded from the observations and evidence together. | “The findings raise concern, but do not establish contamination at this exact location.” |

An observation is not automatically a contamination claim. WaterLens makes the
distinction explicit so a visible appearance, a public record, and a conclusion
cannot quietly become the same thing.

## Geographic context

The location is the bridge between a photograph and the place around it.
WaterLens combines:

- OpenStreetMap data
- Overpass queries for nearby mapped features and waterways
- Nominatim reverse geocoding for place context

This can surface waterways, nearby industry, agriculture, landfills, treatment
facilities, and other relevant mapped infrastructure. The interface may also
show a feature as **potentially upstream** when its position along a mapped
waterway supports that description.

That upstream relationship is an approximation based on OSM vertex ordering and
geometric projection. It is useful context, not a complete hydrological model
and never proof of causation.

## Web research

WaterLens does not simply ask a model what happened. It first uses the location
and visible observations to plan focused research, then searches publicly
available information and preserves the sources that came back.

```text
Location + Observation + Research
                  ↓
          Relevant evidence
```

Search results are classified and kept traceable to their URLs. The research
model organizes source claims and uncertainty; the final reasoning stage draws
the application-level assessment from the complete evidence package.

## Responsible uncertainty

WaterLens is not a laboratory. A photograph cannot directly measure:

- bacteria
- chemicals
- heavy metals
- contamination levels
- potability

So WaterLens must never imply that a visual inspection proves water is safe or
unsafe to drink. When the available evidence does not support a stronger
conclusion, the correct result is:

```text
INSUFFICIENT_DATA
```

Sometimes the most responsible answer is that we do not know. That is a core
product feature, not a failure state.

## Why WaterLens

Environmental context is often scattered across maps, public reports, news,
environmental records, and other web sources. Someone investigating an unusual
change near their home may have to connect all of those pieces manually.

WaterLens brings the first layer of that investigation into one place. It does
not replace laboratory testing or professional environmental assessment; it
makes local environmental information easier to investigate.

## Earth Forward

WaterLens was built for the **NextStep Hacks 2026 Earth Forward** theme.

The project focuses on water, environmental awareness, and public information
that is tied to real places. Its goal is simple: make environmental context
easier to investigate where it actually happens, while staying honest about
what an image, a map, and public records cannot establish on their own.

## How it works

```text
NVIDIA Vision
      ↓
Cerebras — Research Planning
      ↓
Web Search
      ↓
Cerebras — Evidence Synthesis
      ↓
Groq — Final Reasoning
      ↓
Assessment
```

Geographic context from OpenStreetMap, Overpass, and Nominatim runs alongside
the visual stage and informs the research plan. The application is built with
Next.js and TypeScript, uses NVIDIA NIM for image observations, Cerebras for
research and evidence synthesis, Groq for final reasoning, SearchAPI.io for web
search, and optional Supabase persistence. It is designed for deployment on
Vercel.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Environment variables

Copy `.env.example` to `.env` and fill in the server-side credentials. The
provider keys must never be committed.

```env
# AI — Vision
NVIDIA_API_KEY=
NVIDIA_VISION_MODEL=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning

# AI — Research
CEREBRAS_API_KEY=
CEREBRAS_MODEL=gpt-oss-120b

# AI — Final Reasoning
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-120b

# Web Search

SEARCH_API_KEY=


# SUPABASE

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Only `NEXT_PUBLIC_*` values are reachable from the browser. Provider calls and
server credentials stay inside the Next.js route handler.

## Limitations

- WaterLens is not a laboratory and cannot measure water chemistry or microbiology.
- Nearby evidence does not necessarily prove causation at the observation point.
- Public information may be incomplete, outdated, or unavailable.
- AI-generated analysis can be wrong and should be checked against primary sources.
- Geographic upstream analysis is an approximation, not a hydrological network model.
- WaterLens supports investigation; it does not replace professional environmental assessment.

## Attribution

Geographic data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
via Overpass and Nominatim.

<p align="center">
  <img src="public/src/logo.svg" alt="WaterLens logo" width="72">
  <br>
  <strong>WaterLens</strong>
  <br>
  <sub>See water. Find context. Follow the evidence.</sub>
</p>
