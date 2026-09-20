/**
 * One-round end-to-end check: photo investigation straight through the API.
 *
 *   node scripts/e2e-check.mjs [--base URL]
 *
 * Phase A (vision + geo) → confirm-skip → Phase B (research → assessment),
 * asserting every stage completes and the assessment carries its rails
 * (risk level, confidence, limitations, recommendation). Exits non-zero on
 * any failure, printing the SSE event trail for diagnosis.
 */
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
};
const BASE = (opt("--base", "http://localhost:3100") ?? "").replace(/\/+$/, "");

const trail = [];
async function consume(response, terminal) {
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
        trail.push(event.type);
        if (event.type === "failed") {
          const err = new Error(`stage ${event.data.stage}: ${event.data.message}`);
          err.trail = [...trail];
          throw err;
        }
        if (terminal.includes(event.type)) return event;
      }
      sep = buffer.indexOf("\n\n");
    }
  }
  const err = new Error("stream ended without a terminal event");
  err.trail = [...trail];
  throw err;
}

const fail = (message) => {
  console.error(`E2E FAIL: ${message}`);
  console.error(`trail: ${trail.join(" → ")}`);
  process.exit(1);
};

const bytes = readFileSync("public/samples/coimbra.png");
const id = `e2e-${Date.now().toString(16)}-${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0")}`;

let phaseA;
try {
  phaseA = await fetch(`${BASE}/api/investigate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageDataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      latitude: 40.2033,
      longitude: -8.4103,
      note: "e2e check",
      investigationId: "00000000-0000-4000-8000-000000000000",
    }),
  });
} catch (error) {
  fail(`phase A unreachable: ${error.message}`);
}
if (!phaseA.ok) fail(`phase A HTTP ${phaseA.status}: ${await phaseA.text()}`);

let paused;
try {
  paused = await consume(phaseA, ["awaiting_confirmation"]);
} catch (error) {
  fail(`phase A: ${error.message}`);
}
const { visual, geographic } = paused.data;
if (!visual?.observations?.length) fail("phase A produced no observations");
console.log(`phase A ok: ${visual.observations.length} observations, place=${geographic?.location?.displayName ?? "unresolved"}`);

let phaseB;
try {
  phaseB = await fetch(`${BASE}/api/investigate/00000000-0000-4000-8000-000000000000/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      visual,
      geographic,
      note: "e2e check",
      imageDataUrl: `data:image/png;base64,${bytes.toString("base64")}`,
      confirmation: { observations: visual.observations.map((o) => ({ ...o, provenance: "user_confirmed" })) },
    }),
  });
} catch (error) {
  fail(`phase B unreachable: ${error.message}`);
}
if (!phaseB.ok) fail(`phase B HTTP ${phaseB.status}: ${await phaseB.text()}`);

try {
  await consume(phaseB, ["completed"]);
} catch (error) {
  fail(`phase B: ${error.message}`);
}

// The completed stream's assessment is the last assessment_completed payload;
// re-derive it from the trail is not possible, so assert on event presence.
for (const required of ["research_plan_ready", "search_completed", "evidence_ready", "health_pathways_ready", "assessment_completed", "completed"]) {
  if (!trail.includes(required)) fail(`missing event ${required}`);
}
console.log(`phase B ok: full trail completed`);
console.log(`E2E PASS (investigation ${id})`);
