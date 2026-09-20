/**
 * OneAquaHealth research cities.
 *
 * Single registry shared by the landing demo strip, the /cities pages
 * (Branch 4), and the demo seeding script. Coordinates mark a representative
 * point on each city's primary urban waterway.
 */
export type ResearchCity = {
  slug: string;
  name: string;
  country: string;
  waterway: string;
  latitude: number;
  longitude: number;
  /** One-line editorial note for cards and city pages. */
  note: string;
};

export const RESEARCH_CITIES: ResearchCity[] = [
  {
    slug: "coimbra",
    name: "Coimbra",
    country: "Portugal",
    waterway: "Mondego River",
    latitude: 40.2033,
    longitude: -8.4103,
    note: "The project coordinator sits at the University of Coimbra — this is our flagship demo.",
  },
  {
    slug: "ghent",
    name: "Ghent",
    country: "Belgium",
    waterway: "Lys River",
    latitude: 51.0543,
    longitude: 3.7216,
    note: "Canals and the Lys–Scheldt confluence in a dense historic core.",
  },
  {
    slug: "oslo",
    name: "Oslo",
    country: "Norway",
    waterway: "Akerselva River",
    latitude: 59.9235,
    longitude: 10.7522,
    note: "Akerselva runs from the forests through industrial heritage to the fjord.",
  },
  {
    slug: "toulouse",
    name: "Toulouse",
    country: "France",
    waterway: "Garonne River",
    latitude: 43.6047,
    longitude: 1.4442,
    note: "The Garonne and the Canal du Midi meet in the Pink City.",
  },
  {
    slug: "benevento",
    name: "Benevento",
    country: "Italy",
    waterway: "Sabato River",
    latitude: 41.1295,
    longitude: 14.7827,
    note: "Sabato and Calore rivers join at the edge of the old town.",
  },
];

/** Prefilled investigation entry for a city. */
export function cityInvestigateHref(slug: string): string {
  const city = RESEARCH_CITIES.find((c) => c.slug === slug);
  if (!city) return "/investigate";
  return `/investigate?lat=${city.latitude}&lon=${city.longitude}`;
}

/**
 * Deterministic demo investigation IDs, written by scripts/seed-demo.mjs.
 * The landing strip links these: real, completed, seeded investigations.
 */
export const DEMO_INVESTIGATIONS: { slug: string; id: string }[] = [
  { slug: "coimbra", id: "11111111-1111-4111-8111-111111111111" },
  { slug: "ghent", id: "22222222-2222-4222-8222-222222222222" },
  { slug: "oslo", id: "33333333-3333-4333-8333-333333333333" },
];
