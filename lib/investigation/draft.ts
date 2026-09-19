"use client";

/**
 * Client-side handoff between the input form and the investigation workspace.
 *
 * The workspace is a separate route, so the draft (including the prepared image
 * data URL) is parked in sessionStorage under a generated id rather than pushed
 * through the URL. sessionStorage is per-tab and cleared on close, which suits a
 * single investigation run.
 *
 * ponytail: sessionStorage caps the draft at a few MB and does not survive a
 * new tab. Move the handoff to a server-side upload + row id (commit 24's
 * Supabase persistence) if drafts need to be shareable or resumable.
 */
import { useSyncExternalStore } from "react";

export type InvestigationDraft = {
  /** JPEG data URL produced by prepareImage(). */
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  latitude: number;
  longitude: number;
  /** Optional user observation or question. */
  note: string;
  createdAt: string;
};

const PREFIX = "hydros-draft:";

export function newInvestigationId(): string {
  return crypto.randomUUID();
}

export function saveDraft(id: string, draft: InvestigationDraft): void {
  sessionStorage.setItem(PREFIX + id, JSON.stringify(draft));
}

/** Returns null when the draft is absent or unparseable. */
export function loadDraft(id: string): InvestigationDraft | null {
  const raw = sessionStorage.getItem(PREFIX + id);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<InvestigationDraft>;
    if (
      typeof parsed.imageDataUrl !== "string" ||
      typeof parsed.latitude !== "number" ||
      typeof parsed.longitude !== "number"
    ) {
      return null;
    }
    return {
      imageDataUrl: parsed.imageDataUrl,
      imageWidth: parsed.imageWidth ?? 0,
      imageHeight: parsed.imageHeight ?? 0,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      note: parsed.note ?? "",
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearDraft(id: string): void {
  sessionStorage.removeItem(PREFIX + id);
  snapshots.delete(id);
}

/**
 * Cached snapshots so `getSnapshot` below returns a referentially stable value,
 * as useSyncExternalStore requires.
 */
const snapshots = new Map<string, InvestigationDraft | null>();

/** Never changes after load, so there is nothing to subscribe to. */
function subscribe(): () => void {
  return () => {};
}

/**
 * Reads the draft through useSyncExternalStore — the supported way to consume
 * a browser-only store, and it avoids a setState-in-effect round trip.
 *
 * Returns `undefined` while the value is still unknown (server render and
 * hydration) and `null` when the draft genuinely does not exist.
 */
export function useDraft(id: string): InvestigationDraft | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!snapshots.has(id)) snapshots.set(id, loadDraft(id));
      return snapshots.get(id) ?? null;
    },
    () => undefined,
  );
}
