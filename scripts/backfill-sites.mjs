/**
 * Backfills site_geohash and the sites table for pre-existing investigations.
 *
 *   node scripts/backfill-sites.mjs
 *
 * Reads SUPABASE credentials from the environment or .env, lists
 * investigations with no site cell, computes precision-7 geohashes with the
 * same code as the live path (scripts/geo.mjs), and upserts sites. Safe to
 * re-run: rows that already have a cell are skipped.
 */
import { readFileSync, existsSync } from "node:fs";
import { encodeGeohash } from "./geo.mjs";

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
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || fromFile.NEXT_PUBLIC_SUPABASE_URL || "").replace(
  /\/(rest|auth|storage)\/v\d+\/?$/,
  "",
).replace(/\/+$/, "");
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || fromFile.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Supabase is not configured; nothing to backfill.");
  process.exit(0);
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function rest(path, init = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${response.status}`);
  return response.json();
}

const rows = await rest(
  "investigations?select=id,created_at,latitude,longitude,place_name,geographic&site_geohash=is.null&limit=1000",
);
console.log(`${rows.length} investigations without a site cell`);

const sites = new Map();
for (const row of rows) {
  const geohash = encodeGeohash(row.latitude, row.longitude, 7);
  const waterway = row.geographic?.waterways?.[0] ?? null;
  let site = sites.get(geohash);
  if (!site) {
    // Merge with any existing row already stored.
    const existing = await rest(`sites?select=*&geohash=eq.${geohash}&limit=1`);
    site = existing[0] ?? {
      geohash,
      centroid_lat: 0,
      centroid_lng: 0,
      display_name: null,
      waterway_name: null,
      first_seen_at: row.created_at,
      last_seen_at: row.created_at,
      investigation_count: 0,
    };
    sites.set(geohash, site);
  }
  const count = site.investigation_count + 1;
  site.centroid_lat = (site.centroid_lat * (count - 1) + row.latitude) / count;
  site.centroid_lng = (site.centroid_lng * (count - 1) + row.longitude) / count;
  site.display_name = site.display_name ?? row.place_name ?? null;
  site.waterway_name = site.waterway_name ?? waterway;
  site.first_seen_at = site.first_seen_at < row.created_at ? site.first_seen_at : row.created_at;
  site.last_seen_at = site.last_seen_at > row.created_at ? site.last_seen_at : row.created_at;
  site.investigation_count = count;

  await rest(`investigations?id=eq.${row.id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ site_geohash: geohash }),
  });
}

for (const site of sites.values()) {
  await rest("sites", {
    method: "POST",
    headers: { Prefer: "return=minimal,resolution=merge-duplicates" },
    body: JSON.stringify([site]),
  });
  console.log(`site ${site.geohash}: ${site.investigation_count} investigations`);
}
console.log("backfill complete");
