/**
 * Supabase REST and Storage access.
 *
 * Direct `fetch` against PostgREST rather than @supabase/supabase-js: the
 * application needs four inserts and two selects, and the SDK would add ~60 KB
 * plus an auth layer this MVP has no use for.
 *
 * Server-only. The service role key never leaves this module, and persistence is
 * strictly optional — every function here is safe to call when Supabase is not
 * configured, and returns a miss rather than throwing.
 */
import { optionalEnv } from "@/lib/env";

/**
 * Normalizes the configured URL to a bare project origin.
 *
 * The value in .env includes a `/rest/v1/` suffix; appending paths to that
 * yields 404s from PostgREST, so the suffix is stripped once here.
 */
function projectUrl(): string | null {
  const raw = optionalEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (!raw) return null;
  return raw.replace(/\/(rest|auth|storage)\/v\d+\/?$/, "").replace(/\/+$/, "");
}

function serviceKey(): string | null {
  return optionalEnv("SUPABASE_SERVICE_ROLE_KEY") ?? null;
}

/** True when server-side writes are possible. */
export function isPersistenceEnabled(): boolean {
  return projectUrl() !== null && serviceKey() !== null;
}

type ServiceContext = { url: string; key: string };

function serviceContext(): ServiceContext | null {
  const url = projectUrl();
  const key = serviceKey();
  return url && key ? { url, key } : null;
}

/**
 * Per-request budget.
 *
 * 20s rather than something tighter: a free-tier project cold-starts, and
 * PostgREST reloads its schema cache after a migration, both of which pushed
 * inserts past 10s in testing and aborted writes that would otherwise have
 * succeeded. Nothing is waiting on these — they are awaited after the stream has
 * already delivered every event — so a generous budget costs the user nothing.
 */
const TIMEOUT_MS = 20_000;

/**
 * Performs a request against the project.
 *
 * Returns null on any failure. Persistence must never break an investigation, so
 * errors are logged server-side (without credentials) and swallowed.
 */
async function request(
  path: string,
  init: RequestInit & { headers?: Record<string, string> },
): Promise<Response | null> {
  const context = serviceContext();
  if (!context) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${context.url}${path}`, {
      ...init,
      headers: {
        apikey: context.key,
        Authorization: `Bearer ${context.key}`,
        ...init.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      // Body may explain a schema mismatch; status alone is enough to log.
      await response.text().catch(() => "");
      console.warn(`[supabase] ${init.method ?? "GET"} ${path} -> ${response.status}`);
      return null;
    }

    return response;
  } catch (error) {
    console.warn(
      `[supabase] ${init.method ?? "GET"} ${path} failed:`,
      error instanceof Error ? error.name : "unknown error",
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Inserts rows into a table. Returns false when the write did not happen. */
export async function insertRows(
  table: string,
  rows: readonly unknown[],
): Promise<boolean> {
  if (rows.length === 0) return true;

  const response = await request(`/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // No representation needed back, and it keeps the response tiny.
      Prefer: "return=minimal",
    },
    body: JSON.stringify(rows),
  });

  return response !== null;
}

/** Upserts a single row by primary key. */
export async function upsertRow(
  table: string,
  row: unknown,
): Promise<boolean> {
  const response = await request(`/rest/v1/${table}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify([row]),
  });

  return response !== null;
}

/** Patches a row by id. */
export async function patchRow(
  table: string,
  id: string,
  patch: unknown,
): Promise<boolean> {
  const response = await request(
    `/rest/v1/${table}?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(patch),
    },
  );

  return response !== null;
}

/** Selects rows with a raw PostgREST query string. Returns [] on failure. */
export async function selectRows<T>(
  table: string,
  query: string,
): Promise<T[]> {
  const response = await request(`/rest/v1/${table}?${query}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response) return [];

  try {
    const payload: unknown = await response.json();
    return Array.isArray(payload) ? (payload as T[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const IMAGE_BUCKET = "hydros-images";

/**
 * Uploads an investigation image and returns its public URL.
 *
 * Returns null when storage is unavailable; the investigation continues and the
 * image simply is not persisted.
 */
export async function uploadInvestigationImage(
  investigationId: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<string | null> {
  const context = serviceContext();
  if (!context) return null;

  const extension =
    mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
  const path = `${investigationId}/source.${extension}`;

  const response = await request(
    `/storage/v1/object/${IMAGE_BUCKET}/${path}`,
    {
      method: "POST",
      headers: {
        "Content-Type": mimeType,
        // Overwrite on retry rather than failing with a duplicate.
        "x-upsert": "true",
      },
      // Uint8Array is a valid BodyInit; the cast satisfies the DOM typings.
      body: bytes as unknown as BodyInit,
    },
  );

  if (!response) return null;
  return `${context.url}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
}
