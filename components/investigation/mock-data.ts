/**
 * MOCK DATA — UI DEVELOPMENT ONLY.
 *
 * Used by the investigation workspace's mock driver until the real pipeline is
 * wired in commit 22, at which point this file is deleted. It never reaches a
 * production investigation.
 *
 * Every value below is fictitious and labelled as such in the UI.
 */
import { faviconUrl } from "@/lib/utils/favicon";
import type {
  Evidence,
  GeographicSource,
  RiskAssessment,
  Source,
  VisualObservation,
} from "@/types/investigation";

export const MOCK_OBSERVATIONS: VisualObservation[] = [
  {
    attribute: "color",
    description:
      "The water appears brown with a slight grey tint across the visible surface.",
    confidence: 0.86,
  },
  {
    attribute: "clarity",
    description:
      "Low clarity. The bed is not visible in the shallower foreground.",
    confidence: 0.78,
  },
  {
    attribute: "foam",
    description:
      "Patches of pale foam collect where the flow slows near the bank.",
    confidence: 0.64,
  },
  {
    attribute: "debris",
    description:
      "Scattered floating plant matter; no clearly identifiable industrial waste visible.",
    confidence: 0.55,
  },
];

export const MOCK_GEO_SOURCES: GeographicSource[] = [
  {
    id: "way/1001",
    name: "Unnamed stream",
    category: "waterway",
    osmTag: "waterway=stream",
    latitude: -6.2089,
    longitude: 106.8457,
    distanceMetres: 40,
    relation: "adjacent",
  },
  {
    id: "way/1002",
    name: "Textile works",
    category: "factory",
    osmTag: "man_made=works",
    latitude: -6.2032,
    longitude: 106.8441,
    distanceMetres: 780,
    relation: "upstream",
  },
  {
    id: "way/1003",
    name: "Municipal wastewater plant",
    category: "wastewater",
    osmTag: "man_made=wastewater_plant",
    latitude: -6.1951,
    longitude: 106.8422,
    distanceMetres: 1600,
    relation: "upstream",
  },
  {
    id: "way/1004",
    name: "Cropland",
    category: "farm",
    osmTag: "landuse=farmland",
    latitude: -6.2103,
    longitude: 106.8489,
    distanceMetres: 320,
    relation: "adjacent",
  },
];

const mockSource = (
  source: Omit<Source, "faviconUrl" | "domain"> & { domain: string },
): Source => ({ ...source, faviconUrl: faviconUrl(source.url) });

export const MOCK_SOURCES: Source[] = [
  mockSource({
    title: "Regional river water quality monitoring report (example)",
    url: "https://www.epa.gov/example-report",
    domain: "epa.gov",
    snippet:
      "Sampling across the basin recorded elevated turbidity and periodic exceedances following heavy rainfall.",
    sourceType: "government",
    publishedAt: "2024-08",
    relevance: 0.91,
  }),
  mockSource({
    title: "Textile effluent and downstream turbidity: a review (example)",
    url: "https://www.sciencedirect.com/example-study",
    domain: "sciencedirect.com",
    snippet:
      "Untreated dyeing effluent is associated with persistent discolouration and suspended solids downstream of discharge points.",
    sourceType: "scientific",
    publishedAt: "2022",
    relevance: 0.74,
  }),
  mockSource({
    title: "Residents report discoloured river water (example)",
    url: "https://www.reuters.com/example-article",
    domain: "reuters.com",
    snippet:
      "Local residents described a change in the river's colour over several weeks; authorities said an inspection was planned.",
    sourceType: "news",
    publishedAt: "2024-11",
    relevance: 0.62,
  }),
];

export const MOCK_EVIDENCE: Evidence[] = [
  {
    claim:
      "A government monitoring programme recorded elevated turbidity in this river basin, with exceedances after heavy rainfall.",
    sourceUrl: "https://www.epa.gov/example-report",
    uncertainty:
      "Monitoring stations are basin-wide; none is reported at the user's exact coordinates.",
    relevance: 0.88,
  },
  {
    claim:
      "Textile dyeing effluent is a documented cause of persistent discolouration and suspended solids downstream of a discharge point.",
    sourceUrl: "https://www.sciencedirect.com/example-study",
    uncertainty:
      "General literature finding. It does not establish that the nearby works discharges to this stream.",
    relevance: 0.7,
  },
  {
    claim:
      "Residents reported a sustained change in the river's colour within the past year.",
    sourceUrl: "https://www.reuters.com/example-article",
    uncertainty:
      "Community observation reported by news media; no measurement accompanies it.",
    relevance: 0.58,
  },
];

export const MOCK_ASSESSMENT: RiskAssessment = {
  riskLevel: "MEDIUM",
  confidence: 0.48,
  summary:
    "The visible discolouration and low clarity are consistent with high suspended solids. Public records document turbidity exceedances in this basin, and an industrial site sits upstream of the sampling point. Together these raise concern, but none of the evidence measures this location, and appearance alone cannot distinguish natural sediment from an industrial cause.",
  riskFactors: [
    "Brown, low-clarity water with foam accumulation at slow-flow areas",
    "Industrial site and wastewater facility mapped upstream within 2 km",
    "Basin-wide turbidity exceedances documented by a monitoring programme",
    "Community reports of a sustained colour change",
  ],
  evidence: MOCK_EVIDENCE,
  recommendation:
    "Treat this water as untested. Avoid drinking or domestic use until a laboratory test is done, and ask the local environmental authority whether recent sampling exists for this stretch.",
  limitations: [
    "No chemical, bacteriological or heavy-metal measurement was performed.",
    "Sediment from rainfall or riverbed disturbance produces the same appearance as pollutant loading.",
    "Upstream inference is based on mapped waterway geometry, not on tracked flow.",
    "No retrieved source measured water quality at these coordinates.",
  ],
};
