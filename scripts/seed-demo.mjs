/**
 * Seeds demo investigations for the five OneAquaHealth research cities.
 *
 *   1. npm run dev                      # the script drives the real API
 *   2. node scripts/seed-demo.mjs [--base URL] [--city slug] [--dry-run]
 *
 * Runs real end-to-end investigations (vision → geo → confirm-skip →
 * research → assessment) against the committed sample photographs in
 * public/samples/, with deterministic UUIDs so the landing demo strip can
 * link them. Coimbra gets three visits at one site (two photo, one guided)
 * so trends and alerts have something to chew on.
 *
 * Idempotent and safe to re-run: completed investigations are detected via
 * GET /api/investigate/[id] and skipped.
 */
import { readFileSync } from "node:fs";
import { encodeGeohash } from "./geo.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : (args[index + 1] ?? fallback);
};
const BASE = (opt("--base", "http://localhost:3000") ?? "").replace(/\/+$/, "");
const ONLY_CITY = opt("--city", null);
const DRY_RUN = args.includes("--dry-run");

// Deterministic demo IDs — the landing strip links these.
const DEMOS = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    city: "coimbra",
    lat: 40.2033,
    lon: -8.4103,
    photo: "coimbra",
  },
  {
    id: "11111111-1111-4111-8111-111111111112",
    city: "coimbra",
    lat: 40.2039,
    lon: -8.4096,
    photo: "coimbra",
  },
  {
    id: "11111111-1111-4111-8111-111111111113",
    city: "coimbra",
    lat: 40.2027,
    lon: -8.411,
    guided: {
      waterColour: "green",
      waterColourOther: "",
      clarity: "not_visible",
      surface: "scum",
      odour: "earthy",
      odourOther: "",
      algae: "patches",
      flow: "slow",
      bankVegetation: "patchy",
      litter: "some",
      wildlife: "Ducks near the bank.",
      humanActivity: "Walkers and a rowing club.",
    },
  },
  { id: "22222222-2222-4222-8222-222222222222", city: "ghent", lat: 51.0543, lon: 3.7216, photo: "ghent" },
  { id: "33333333-3333-4333-8333-333333333333", city: "oslo", lat: 59.9235, lon: 10.7522, photo: "oslo" },
  { id: "44444444-4444-4444-8444-444444444444", city: "toulouse", lat: 43.6047, lon: 1.4442, photo: "toulouse" },
  { id: "55555555-5555-4555-8555-555555555555", city: "benevento", lat: 41.1295, lon: 14.7827, photo: "benevento" },
];

/** Nudge spots toward the base until every Coimbra visit shares one cell. */
function coimbraCells() {
  const base = { lat: 40.2033, lon: -8.4103 };
  const baseCell = encodeGeohash(base.lat, base.lon);
  // Deterministic spiral of candidate offsets (degrees); keep the first two
  // inside the base cell so all three visits group as one site.
  const candidates = [];
  for (const step of [0.0001, 0.0002, 0.0003, 0.0004, 0.0005, 0.0006]) {
    candidates.push(
      [step, step * 0.6],
      [-step * 0.7, step],
      [step * 0.5, -step],
      [-step, -step * 0.4],
    );
  }
  const inside = candidates
    .map(([dLat, dLon]) => ({ lat: base.lat + dLat, lon: base.lon + dLon }))
    .filter((spot) => encodeGeohash(spot.lat, spot.lon) === baseCell);
  if (inside.length < 2) throw new Error("No room in the base cell for 3 demos.");
  const spots = DEMOS.filter((d) => d.city === "coimbra");
  spots[1].lat = inside[0].lat;
  spots[1].lon = inside[0].lon;
  spots[2].lat = inside[1].lat;
  spots[2].lon = inside[1].lon;
  return baseCell;
}

async function getInvestigation(id) {
  const response = await fetch(`${BASE}/api/investigate/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GET ${id} -> ${response.status}`);
  return response.json();
}

/** Consumes an SSE stream; resolves with the terminal event payload. */
async function consumeStream(response, want) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const event = JSON.parse(line.slice(5).trim());
        if (event.type === "failed") {
          throw new Error(`stage ${event.data.stage}: ${event.data.message}`);
        }
        if (want.includes(event.type)) return event;
      }
      sep = buffer.indexOf("\n\n");
    }
  }
  throw new Error("Stream ended without a terminal event.");
}

async function runDemo(demo) {
  const existing = await getInvestigation(demo.id).catch(() => null);
  if (existing && existing.status === "completed") {
    console.log(`skip ${demo.city} ${demo.id.slice(0, 8)} (already completed)`);
    return;
  }

  const body = {
    latitude: demo.lat,
    longitude: demo.lon,
    note: "",
    investigationId: demo.id,
  };
  if (demo.photo) {
    const bytes = readFileSync(`public/samples/${demo.photo}.png`);
    body.imageDataUrl = `data:image/png;base64,${bytes.toString("base64")}`;
  } else {
    body.guidedResponses = demo.guided;
  }

  console.log(`phase A: ${demo.city} ${demo.id.slice(0, 8)}…`);
  const phaseA = await fetch(`${BASE}/api/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!phaseA.ok) throw new Error(`phase A -> ${phaseA.status}: ${await phaseA.text()}`);
  const paused = await consumeStream(phaseA, ["awaiting_confirmation"]);

  console.log(`phase B: ${demo.city} ${demo.id.slice(0, 8)}…`);
  const phaseB = await fetch(`${BASE}/api/investigate/${demo.id}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visual: paused.data.visual,
      geographic: paused.data.geographic,
      note: "",
      ...(body.imageDataUrl ? { imageDataUrl: body.imageDataUrl } : {}),
      confirmation: { observations: paused.data.visual.observations },
    }),
  });
  if (!phaseB.ok) throw new Error(`phase B -> ${phaseB.status}: ${await phaseB.text()}`);
  await consumeStream(phaseB, ["completed"]);
  console.log(`done: ${demo.city} ${demo.id.slice(0, 8)}`);
}

const cell = coimbraCells();
console.log(`Coimbra site cell: ${cell}`);

const queue = DEMOS.filter((d) => !ONLY_CITY || d.city === ONLY_CITY);
if (DRY_RUN) {
  for (const demo of queue) {
    console.log(
      `${demo.city} ${demo.id} cell=${encodeGeohash(demo.lat, demo.lon)} ${demo.photo ? "photo" : "guided"}`,
    );
  }
  process.exit(0);
}

for (const demo of queue) {
  try {
    await runDemo(demo);
  } catch (error) {
    console.error(`FAILED ${demo.city} ${demo.id.slice(0, 8)}: ${error.message}`);
  }
}
console.log("seeding pass complete");
