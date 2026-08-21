/**
 * Web search provider.
 *
 * Server-only. SearchAPI.io is the configured provider (SEARCH_API_KEY), reached
 * through the small `SearchProvider` seam below so swapping providers means one
 * new function, not changes across the pipeline.
 *
 * Retrieved content is data, never instruction. Titles and snippets are
 * sanitized here before any model sees them.
 */
import { requireEnv } from "@/lib/env";
import { InvestigationError } from "@/lib/investigation/errors";
import { domainFromUrl } from "@/lib/utils/favicon";
import { sanitizeText } from "@/lib/utils/validation";
import type { SearchResult } from "@/types/investigation";

/** Results requested per query. Enough to rank, small enough to stay cheap. */
const RESULTS_PER_QUERY = 6;

const TIMEOUT_MS = 15_000;

const MAX_TITLE_LENGTH = 200;
const MAX_SNIPPET_LENGTH = 400;

export type SearchOptions = {
  /** ISO 3166-1 alpha-2, biases results toward the investigation's region. */
  countryCode?: string;
  limit?: number;
};

type SearchProvider = (
  query: string,
  options: SearchOptions,
) => Promise<SearchResult[]>;

// ---------------------------------------------------------------------------
// SearchAPI.io
// ---------------------------------------------------------------------------

const SEARCHAPI_URL = "https://www.searchapi.io/api/v1/search";

/** Shape of the fields we read from a SearchAPI organic result. */
type SearchApiResult = {
  title?: unknown;
  link?: unknown;
  domain?: unknown;
  snippet?: unknown;
  date?: unknown;
};

const searchApiProvider: SearchProvider = async (query, options) => {
  const apiKey = requireEnv("SEARCH_API_KEY");

  const url = new URL(SEARCHAPI_URL);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(options.limit ?? RESULTS_PER_QUERY));
  if (options.countryCode) {
    url.searchParams.set("gl", options.countryCode.toLowerCase());
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      await response.text().catch(() => "");
      throw new InvestigationError("search", messageForStatus(response.status));
    }

    const payload: unknown = await response.json();
    const organic = (payload as { organic_results?: unknown }).organic_results;
    if (!Array.isArray(organic)) return [];

    return organic
      .map((raw) => normalizeSearchApiResult(raw as SearchApiResult))
      .filter((result): result is SearchResult => result !== null);
  } catch (error) {
    if (error instanceof InvestigationError) throw error;
    throw new InvestigationError(
      "search",
      "The web search did not respond in time.",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
  }
};

function messageForStatus(status: number): string {
  if (status === 401 || status === 403) {
    return "The web search provider rejected the request credentials.";
  }
  if (status === 429) {
    return "The web search quota has been reached. Try again later.";
  }
  if (status >= 500) return "The web search provider is temporarily unavailable.";
  return "The web search request could not be completed.";
}

/**
 * Normalizes one provider result.
 *
 * Rejects anything without an http(s) URL, so `javascript:` and `data:` links
 * can never reach the UI. Text is stripped of control characters and truncated,
 * bounding what a hostile page title can inject into a later prompt.
 */
function normalizeSearchApiResult(raw: SearchApiResult): SearchResult | null {
  const url = typeof raw.link === "string" ? raw.link.trim() : "";
  if (!/^https?:\/\//i.test(url)) return null;

  const domain =
    typeof raw.domain === "string" && raw.domain.trim()
      ? raw.domain.trim().replace(/^www\./, "")
      : domainFromUrl(url);
  if (!domain) return null;

  const title = sanitizeText(
    typeof raw.title === "string" ? raw.title : "",
    MAX_TITLE_LENGTH,
  );
  if (!title) return null;

  const publishedAt =
    typeof raw.date === "string" && raw.date.trim()
      ? sanitizeText(raw.date, 40)
      : undefined;

  return {
    title,
    url,
    domain,
    snippet: sanitizeText(
      typeof raw.snippet === "string" ? raw.snippet : "",
      MAX_SNIPPET_LENGTH,
    ),
    ...(publishedAt ? { publishedAt } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const provider: SearchProvider = searchApiProvider;

/** Runs one query. Returns [] rather than throwing when there are no results. */
export async function search(
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  return provider(query, options);
}

export type MultiSearchResult = {
  results: SearchResult[];
  /** Queries that failed, so the pipeline can report partial coverage. */
  failedQueries: string[];
};

/**
 * Runs several queries and merges the results, deduplicated by URL.
 *
 * Queries run sequentially: the free search tier rate-limits parallel bursts,
 * and 3–5 fast queries fit comfortably in the serverless budget. A single
 * failing query degrades coverage instead of failing the stage — but if every
 * query fails, the caller gets an error.
 */
export async function searchMany(
  queries: readonly string[],
  options: SearchOptions = {},
  onResults?: (query: string, results: SearchResult[]) => void,
): Promise<MultiSearchResult> {
  const seen = new Set<string>();
  const results: SearchResult[] = [];
  const failedQueries: string[] = [];

  for (const query of queries) {
    try {
      const found = await search(query, options);
      const fresh = found.filter((result) => {
        const key = result.url.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      results.push(...fresh);
      onResults?.(query, fresh);
    } catch {
      // Message intentionally not propagated per-query; coverage is reported
      // through failedQueries instead.
      failedQueries.push(query);
    }
  }

  if (results.length === 0 && failedQueries.length === queries.length && queries.length > 0) {
    throw new InvestigationError(
      "search",
      "The web search could not be completed. The investigation cannot gather external evidence right now.",
    );
  }

  return { results, failedQueries };
}
