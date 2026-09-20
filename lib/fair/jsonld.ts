/**
 * FAIR exports: schema.org Dataset for one investigation and a DCAT-flavoured
 * DataCatalog over all public investigations.
 *
 * Findable: stable investigation IDs plus a catalogue endpoint.
 * Accessible: plain HTTPS GET, no auth for public investigations.
 * Interoperable: schema.org vocabulary plus links to the FHIR and raw JSON.
 * Reusable: provenance chain, creation timestamp, and license in every record.
 */
import type { Investigation } from "@/types/investigation";

const SCHEMA_CONTEXT = "https://schema.org";

/** Public base URL for absolute distribution links. Override in production. */
export function publicBaseUrl(request?: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (request) {
    try {
      return new URL(request.url).origin;
    } catch {
      // Fall through to the local default.
    }
  }
  return "http://localhost:3000";
}

export function investigationJsonLd(
  investigation: Investigation,
  baseUrl: string,
): Record<string, unknown> {
  const id = `${baseUrl}/api/investigate/${investigation.id}`;
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Dataset",
    "@id": `${id}/jsonld`,
    identifier: investigation.id,
    name:
      investigation.location.displayName ??
      `Water investigation at ${investigation.location.latitude}, ${investigation.location.longitude}`,
    description:
      investigation.assessment?.summary ??
      "Evidence-first water investigation. No assessment reached.",
    dateCreated: investigation.createdAt,
    license: "https://github.com/galihkjaya/hydros/blob/test/LICENSE",
    spatialCoverage: {
      "@type": "Place",
      geo: {
        "@type": "GeoCoordinates",
        latitude: investigation.location.latitude,
        longitude: investigation.location.longitude,
      },
    },
    creator: { "@type": "Organization", name: "Hydros" },
    provenance: {
      observations: (investigation.visual?.observations ?? []).map(
        (observation) => observation.provenance,
      ),
      sourceCount: investigation.sources.length,
      evidenceCount: investigation.evidence.length,
      pathwayCount: investigation.healthPathways.length,
      riskLevel: investigation.assessment?.riskLevel ?? "INSUFFICIENT_DATA",
    },
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "application/fhir+json",
        contentUrl: `${id}/fhir`,
      },
      {
        "@type": "DataDownload",
        encodingFormat: "application/ld+json",
        contentUrl: `${id}/jsonld`,
      },
    ],
  };
}

export type CatalogEntry = {
  id: string;
  createdAt: string;
  placeName: string | null;
  latitude: number;
  longitude: number;
  riskLevel: string | null;
};

export function investigationsCatalogJsonLd(
  entries: readonly CatalogEntry[],
  baseUrl: string,
): Record<string, unknown> {
  return {
    "@context": {
      "@vocab": "https://schema.org/",
      dcat: "http://www.w3.org/ns/dcat#",
    },
    "@type": "DataCatalog",
    "@id": `${baseUrl}/api/investigations.jsonld`,
    name: "Hydros public investigations",
    description:
      "Evidence-first urban freshwater investigations, built on the One Health model.",
    license: "https://github.com/galihkjaya/hydros/blob/test/LICENSE",
    "dcat:dataset": entries.map((entry) => ({
      "@type": "Dataset",
      "@id": `${baseUrl}/api/investigate/${entry.id}/jsonld`,
      identifier: entry.id,
      dateCreated: entry.createdAt,
      name: entry.placeName ?? `Investigation ${entry.id.slice(0, 8)}`,
      spatialCoverage: {
        "@type": "Place",
        geo: {
          "@type": "GeoCoordinates",
          latitude: entry.latitude,
          longitude: entry.longitude,
        },
      },
    })),
  };
}
