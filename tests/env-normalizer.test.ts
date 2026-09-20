/**
 * Env URL normalizer self-check.
 *
 * A bare hostname, trailing slash, wrapping quotes, or a stray \r must never
 * reach fetch as a corrupt URL — that failure mode is a bare TypeError with
 * no status, exactly the signature that hid Failure A.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readSupabaseUrl } from "../lib/env.js";

function withUrl(value: string | undefined, run: () => unknown): unknown {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    if (value === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = value;
    return run();
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
}

test("missing or empty is unset, not invalid", () => {
  assert.deepEqual(withUrl(undefined, readSupabaseUrl), { kind: "unset" });
  assert.deepEqual(withUrl("", readSupabaseUrl), { kind: "unset" });
  assert.deepEqual(withUrl("   ", readSupabaseUrl), { kind: "unset" });
});

test("bare hostname gains its scheme", () => {
  assert.deepEqual(withUrl("abcdef.supabase.co", readSupabaseUrl), {
    kind: "ok",
    url: "https://abcdef.supabase.co",
  });
});

test("trailing slashes, quotes, and CRLF are stripped", () => {
  assert.deepEqual(
    withUrl("https://abcdef.supabase.co/rest/v1///", readSupabaseUrl),
    { kind: "ok", url: "https://abcdef.supabase.co/rest/v1" },
  );
  assert.deepEqual(
    withUrl('"https://abcdef.supabase.co"', readSupabaseUrl),
    { kind: "ok", url: "https://abcdef.supabase.co" },
  );
  assert.deepEqual(
    withUrl("https://abcdef.supabase.co\r\n", readSupabaseUrl),
    { kind: "ok", url: "https://abcdef.supabase.co" },
  );
});

test("garbage is invalid with a descriptive message", () => {
  const state = withUrl("not a url at all", readSupabaseUrl) as {
    kind: string;
    message?: string;
  };
  assert.equal(state.kind, "invalid");
  assert.match(state.message ?? "", /not a valid URL/);
});

test("non-http schemes are rejected", () => {
  const state = withUrl("ftp://example.com/x", readSupabaseUrl) as {
    kind: string;
  };
  assert.equal(state.kind, "invalid");
});
