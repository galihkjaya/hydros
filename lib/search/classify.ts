/**
 * Source classification and relevance scoring.
 *
 * Not all sources are equal: a government monitoring report and an anonymous
 * forum post make very different evidence. Classification is heuristic and
 * domain-based, which is crude but transparent and cheap — no extra model call.
 *
 * ponytail: domain heuristics miss regional agencies not on the lists below.
 * Add a model-based classification pass if misclassification becomes visible in
 * assessments.
 */
import type { SearchResult, Source, SourceType } from "@/types/investigation";
import { faviconUrl } from "@/lib/utils/favicon";

/** Suffixes that indicate an official government or agency publisher. */
const GOVERNMENT_SUFFIXES = [
  ".gov",
  ".gov.uk",
  ".gov.au",
  ".gov.in",
  ".gov.br",
  ".go.id",
  ".go.jp",
  ".go.kr",
  ".gob.mx",
  ".gouv.fr",
  ".govt.nz",
  ".gc.ca",
  ".europa.eu",
];

/**
 * Intergovernmental bodies. Matched as whole domains, not suffixes, since
 * "who.int" has no leading label.
 */
const GOVERNMENT_DOMAINS = ["who.int", "un.org", "unep.org", "unicef.org"];

/** Well-known scientific and academic publishers and repositories. */
const SCIENTIFIC_DOMAINS = [
  "sciencedirect.com",
  "springer.com",
  "link.springer.com",
  "nature.com",
  "wiley.com",
  "onlinelibrary.wiley.com",
  "tandfonline.com",
  "mdpi.com",
  "frontiersin.org",
  "plos.org",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "iopscience.iop.org",
  "researchgate.net",
  "jstor.org",
  "arxiv.org",
  "scielo.br",
  "copernicus.org",
  "acs.org",
  "rsc.org",
  "iwaponline.com",
];

const ACADEMIC_SUFFIXES = [".edu", ".ac.uk", ".ac.id", ".ac.jp", ".edu.au", ".ac.in"];

/** Reputable news organisations. Deliberately short and conservative. */
const NEWS_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "theguardian.com",
  "nytimes.com",
  "washingtonpost.com",
  "ft.com",
  "bloomberg.com",
  "aljazeera.com",
  "npr.org",
  "cnn.com",
  "abc.net.au",
  "dw.com",
  "france24.com",
  "scmp.com",
  "thejakartapost.com",
  "kompas.com",
  "tempo.co",
  "detik.com",
  "channelnewsasia.com",
  "straitstimes.com",
  "thehindu.com",
  "indiatimes.com",
];

/** Platforms where content is user-generated. */
const COMMUNITY_DOMAINS = [
  "reddit.com",
  "quora.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "medium.com",
  "wordpress.com",
  "blogspot.com",
  "substack.com",
  "youtube.com",
  "tiktok.com",
  "wikipedia.org",
  "stackexchange.com",
];

/** Environmental NGOs and institutes: credible, but not primary agencies. */
const NGO_SUFFIXES = [".org.uk", ".org.au"];
const NGO_DOMAINS = [
  "wri.org",
  "worldbank.org",
  "iucn.org",
  "wwf.org",
  "greenpeace.org",
];

function endsWithAny(domain: string, suffixes: readonly string[]): boolean {
  return suffixes.some((suffix) => domain.endsWith(suffix));
}

function matchesAny(domain: string, domains: readonly string[]): boolean {
  return domains.some(
    (candidate) => domain === candidate || domain.endsWith(`.${candidate}`),
  );
}

/** Assigns a reliability tier from the publishing domain. */
export function classifySource(domain: string): SourceType {
  const host = domain.toLowerCase().replace(/^www\./, "");

  if (
    endsWithAny(host, GOVERNMENT_SUFFIXES) ||
    matchesAny(host, GOVERNMENT_DOMAINS) ||
    matchesAny(host, NGO_DOMAINS)
  ) {
    return "government";
  }
  if (endsWithAny(host, ACADEMIC_SUFFIXES) || matchesAny(host, SCIENTIFIC_DOMAINS)) {
    return "scientific";
  }
  if (matchesAny(host, NEWS_DOMAINS)) return "news";
  if (matchesAny(host, COMMUNITY_DOMAINS) || endsWithAny(host, NGO_SUFFIXES)) {
    return "community";
  }
  return "unverified";
}

/** Base credibility weight per tier, used in relevance scoring. */
const TYPE_WEIGHT: Record<SourceType, number> = {
  government: 1,
  scientific: 0.9,
  news: 0.7,
  community: 0.5,
  unverified: 0.4,
};

/**
 * Terms that indicate the result is actually about water quality rather than
 * merely mentioning the place name.
 */
const TOPIC_TERMS = [
  "water quality",
  "pollution",
  "contamina",
  "effluent",
  "wastewater",
  "discharge",
  "turbidity",
  "monitoring",
  "river",
  "watershed",
  "sanitation",
  "heavy metal",
  "bacteri",
  "coliform",
  "sediment",
  "industrial waste",
  "leachate",
  "sampling",
];

/**
 * Scores 0–1 from source tier, topical wording, and overlap with the entities
 * the research plan cared about. Ordering, not truth — the reasoning model still
 * judges what the evidence means.
 */
export function scoreRelevance(
  result: SearchResult,
  sourceType: SourceType,
  entities: readonly string[],
): number {
  const haystack = `${result.title} ${result.snippet}`.toLowerCase();

  const topicHits = TOPIC_TERMS.filter((term) => haystack.includes(term)).length;
  // Saturates at 4 hits: more mentions do not mean more relevance.
  const topicScore = Math.min(topicHits, 4) / 4;

  const entityHits = entities.filter((entity) => {
    const needle = entity.toLowerCase().trim();
    return needle.length > 3 && haystack.includes(needle);
  }).length;
  const entityScore = entities.length > 0 ? Math.min(entityHits, 2) / 2 : 0;

  // A result with no snippet gives the evidence stage nothing to work with.
  const snippetPenalty = result.snippet.length < 40 ? 0.15 : 0;

  const score =
    TYPE_WEIGHT[sourceType] * 0.4 +
    topicScore * 0.4 +
    entityScore * 0.2 -
    snippetPenalty;

  return Math.min(Math.max(Number(score.toFixed(3)), 0), 1);
}

/** Turns a normalized search result into a classified, scored Source. */
export function toSource(
  result: SearchResult,
  entities: readonly string[],
): Source {
  const sourceType = classifySource(result.domain);
  return {
    ...result,
    sourceType,
    faviconUrl: faviconUrl(result.url),
    relevance: scoreRelevance(result, sourceType, entities),
  };
}
