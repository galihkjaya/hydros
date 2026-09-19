/**
 * Reports which Hydros environment variables are configured.
 *
 *   npm run check-env
 *
 * Prints presence only — never values — so it is safe to run in CI logs.
 */
import { readFileSync, existsSync } from "node:fs";

const REQUIRED_FOR_INVESTIGATION = [
  "NVIDIA_API_KEY",
  "NVIDIA_VISION_MODEL",
  "CEREBRAS_API_KEY",
  "CEREBRAS_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "SEARCH_API_KEY",
];

const OPTIONAL = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

/** Minimal .env reader: KEY=VALUE lines, ignores comments and blanks. */
function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const fromFile = loadEnvFile(".env");
const resolve = (name) => process.env[name] || fromFile[name] || "";

let missingRequired = 0;

console.log("Hydros environment check\n");
console.log("Required for a full investigation:");
for (const name of REQUIRED_FOR_INVESTIGATION) {
  const present = resolve(name).length > 0;
  if (!present) missingRequired += 1;
  console.log(`  ${present ? "ok      " : "missing "} ${name}`);
}

console.log("\nOptional (Supabase persistence):");
for (const name of OPTIONAL) {
  console.log(`  ${resolve(name).length > 0 ? "ok      " : "unset   "} ${name}`);
}

if (missingRequired > 0) {
  console.log(
    `\n${missingRequired} required variable(s) missing. The UI still runs; investigations will return a configuration error.`,
  );
} else {
  console.log("\nAll investigation credentials are configured.");
}
