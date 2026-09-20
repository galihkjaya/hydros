"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection } from "geojson";
import { Chip, Eyebrow, riskChipTone } from "@/components/ui/primitives";
import { formatCoordinate } from "@/lib/utils/validation";
import type { RiskLevel } from "@/types/investigation";

export type MapPoint = {
  id: string;
  createdAt: string;
  placeName: string | null;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  riskLevel: RiskLevel | null;
  siteGeohash: string | null;
  guidedMode: boolean;
  sourceCount: number;
  assessmentSummary: string | null;
};

const RISK_COLOR: Record<RiskLevel | "NONE", string> = {
  LOW: "#ffffff",
  MEDIUM: "#0a0a0a",
  HIGH: "#b3261e",
  INSUFFICIENT_DATA: "#a3a3a0",
  NONE: "#a3a3a0",
};

const RISK_STROKE: Record<RiskLevel | "NONE", string> = {
  LOW: "#0a0a0a",
  MEDIUM: "#0a0a0a",
  HIGH: "#b3261e",
  INSUFFICIENT_DATA: "#5a5a58",
  NONE: "#5a5a58",
};

/**
 * Greyscale investigation map.
 *
 * Free OSM raster tiles desaturated toward a printed map, MapLibre clustering
 * with monospace counts, typographic risk styling (outline / solid / signal),
 * and an editorial side panel per investigation. Filters run client-side over
 * the server-rendered point set.
 */
export function InvestigationMap({
  points,
  alertSites,
}: {
  points: MapPoint[];
  /** Site geohashes with a live alert, for the marker modifier. */
  alertSites: Record<string, "watch" | "concern">;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<MapPoint | null>(null);

  // Filters.
  const [risks, setRisks] = useState<Set<RiskLevel | "NONE">>(
    () => new Set(["LOW", "MEDIUM", "HIGH", "INSUFFICIENT_DATA", "NONE"]),
  );
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minSources, setMinSources] = useState(0);
  const [mode, setMode] = useState<"all" | "photo" | "guided">("all");

  const filtered = useMemo(() => {
    const fromTime = from ? new Date(from).getTime() : Number.NEGATIVE_INFINITY;
    const toTime = to ? new Date(`${to}T23:59:59`).getTime() : Number.POSITIVE_INFINITY;
    return points.filter((point) => {
      if (!risks.has(point.riskLevel ?? "NONE")) return false;
      const at = new Date(point.createdAt).getTime();
      if (at < fromTime || at > toTime) return false;
      if (point.sourceCount < minSources) return false;
      if (mode === "photo" && point.guidedMode) return false;
      if (mode === "guided" && !point.guidedMode) return false;
      return true;
    });
  }, [points, risks, from, to, minSources, mode]);

  const geojson = useMemo(
    () =>
      ({
        type: "FeatureCollection",
        features: filtered.map((point) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [point.longitude, point.latitude],
          },
          properties: {
            id: point.id,
            risk: point.riskLevel ?? "NONE",
            alert: point.siteGeohash && alertSites[point.siteGeohash] ? "1" : "",
          },
        })),
      }) as FeatureCollection,
    [filtered, alertSites],
  );

  const byId = useMemo(() => new Map(points.map((p) => [p.id, p])), [points]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [{ id: "osm", type: "raster", source: "osm" }],
      },
      center: [8, 48],
      zoom: 3,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.addSource("investigations", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      });

      // Alert halo behind alerted points.
      map.addLayer({
        id: "alert-halo",
        type: "circle",
        source: "investigations",
        filter: ["==", ["get", "alert"], "1"],
        paint: {
          "circle-radius": 14,
          "circle-color": "#b3261e",
          "circle-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "investigations",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": 18,
          "circle-color": "#0a0a0a",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "investigations",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 11,
        },
        paint: { "text-color": "#ffffff" },
      });

      map.addLayer({
        id: "points",
        type: "circle",
        source: "investigations",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": [
            "case",
            ["==", ["get", "risk"], "HIGH"],
            9,
            7,
          ],
          "circle-color": [
            "match",
            ["get", "risk"],
            "LOW",
            RISK_COLOR.LOW,
            "MEDIUM",
            RISK_COLOR.MEDIUM,
            "HIGH",
            RISK_COLOR.HIGH,
            RISK_COLOR.INSUFFICIENT_DATA,
          ],
          "circle-stroke-color": [
            "match",
            ["get", "risk"],
            "LOW",
            RISK_STROKE.LOW,
            "MEDIUM",
            RISK_STROKE.MEDIUM,
            "HIGH",
            RISK_STROKE.HIGH,
            RISK_STROKE.INSUFFICIENT_DATA,
          ],
          "circle-stroke-width": 2,
        },
      });

      map.on("click", "clusters", async (event) => {
        const features = map.queryRenderedFeatures(event.point, {
          layers: ["clusters"],
        });
        const clusterId = features[0]?.properties?.cluster_id;
        const source = map.getSource("investigations") as maplibregl.GeoJSONSource;
        if (clusterId === undefined || !source) return;
        try {
          const zoom = await source.getClusterExpansionZoom(Number(clusterId));
          const geometry = features[0]?.geometry;
          if (geometry?.type === "Point") {
            map.easeTo({ center: geometry.coordinates as [number, number], zoom });
          }
        } catch {
          // Cluster data changed mid-click; ignore.
        }
      });

      map.on("click", "points", (event) => {
        const id = (event.features?.[0]?.properties as { id?: string } | undefined)?.id;
        setSelected((id && byId.get(id)) || null);
      });
      map.on("mouseenter", "points", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "points", () => {
        map.getCanvas().style.cursor = "";
      });

      setReady(true);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [byId]);

  // Push filtered data into the source.
  useEffect(() => {
    if (!ready) return;
    const map = mapRef.current;
    const source = map?.getSource("investigations") as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData(geojson);
  }, [geojson, ready]);

  function toggleRisk(risk: RiskLevel | "NONE") {
    setRisks((prev) => {
      const next = new Set(prev);
      if (next.has(risk)) next.delete(risk);
      else next.add(risk);
      return next;
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="lg:col-span-8">
        <div className="border border-ink">
          <div
            ref={containerRef}
            role="application"
            aria-label="Greyscale map of investigations"
            // Printed-map look: the raster tiles render near-greyscale.
            className="h-[60vh] min-h-[320px] w-full grayscale contrast-[1.05]"
          />
        </div>
        <p className="mt-2 text-[0.8125rem] text-ink-faint">
          Map data © OpenStreetMap contributors · {filtered.length} of{" "}
          {points.length} shown
        </p>

        <div className="mt-4 grid gap-4 border-t border-rule pt-4 sm:grid-cols-3">
          <fieldset>
            <legend className="hydros-eyebrow">Risk</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["LOW", "MEDIUM", "HIGH", "INSUFFICIENT_DATA", "NONE"] as const).map(
                (risk) => (
                  <label
                    key={risk}
                    className={
                      risks.has(risk)
                        ? "cursor-pointer border border-ink bg-ink px-2 py-1 font-mono text-[0.6875rem] tracking-wider text-paper uppercase"
                        : "cursor-pointer border border-ink-faint px-2 py-1 font-mono text-[0.6875rem] tracking-wider text-ink-muted uppercase hover:border-ink"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={risks.has(risk)}
                      onChange={() => toggleRisk(risk)}
                      className="sr-only"
                    />
                    {risk === "NONE" ? "No data" : risk.replace("_", " ")}
                  </label>
                ),
              )}
            </div>
          </fieldset>
          <fieldset>
            <legend className="hydros-eyebrow">Date range</legend>
            <div className="mt-2 flex gap-2">
              <label className="flex-1">
                <span className="sr-only">From</span>
                <input
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                  className="h-9 w-full border border-rule bg-paper px-2 font-mono text-[0.8125rem]"
                />
              </label>
              <label className="flex-1">
                <span className="sr-only">To</span>
                <input
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                  className="h-9 w-full border border-rule bg-paper px-2 font-mono text-[0.8125rem]"
                />
              </label>
            </div>
          </fieldset>
          <fieldset>
            <legend className="hydros-eyebrow">Sources · Mode</legend>
            <div className="mt-2 flex gap-2">
              <label className="flex flex-1 items-center gap-2 border border-rule px-2">
                <span className="sr-only">Minimum sources</span>
                <span className="font-mono text-[0.8125rem] text-ink-muted">≥</span>
                <input
                  type="number"
                  min={0}
                  value={minSources}
                  onChange={(event) =>
                    setMinSources(Math.max(0, Number(event.target.value) || 0))
                  }
                  className="h-9 w-full bg-paper font-mono text-[0.8125rem]"
                />
              </label>
              <label className="flex-1">
                <span className="sr-only">Mode</span>
                <select
                  value={mode}
                  onChange={(event) =>
                    setMode(event.target.value as "all" | "photo" | "guided")
                  }
                  className="h-9 w-full border border-rule bg-paper px-2 font-mono text-[0.8125rem]"
                >
                  <option value="all">All</option>
                  <option value="photo">Photo</option>
                  <option value="guided">Guided</option>
                </select>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      <aside className="lg:col-span-4" aria-live="polite">
        {selected ? (
          <div className="border-t-2 border-ink pt-4">
            <Eyebrow>Investigation</Eyebrow>
            {selected.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl}
                alt={`Water source at ${selected.placeName ?? "unresolved location"}`}
                className="mt-3 aspect-[4/3] w-full border border-ink object-cover"
                loading="lazy"
              />
            ) : (
              <p className="mt-3 border border-ink bg-paper-sunk p-4 font-serif text-sm text-ink-muted italic">
                Guided assessment — no photograph.
              </p>
            )}
            <p className="mt-3 font-serif text-2xl">
              {selected.placeName ?? "Unresolved location"}
            </p>
            <p className="mt-1 font-mono text-[0.8125rem] text-ink-faint">
              {formatCoordinate(selected.latitude)},{" "}
              {formatCoordinate(selected.longitude)}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selected.riskLevel ? (
                <Chip tone={riskChipTone(selected.riskLevel)}>
                  {selected.riskLevel.replace("_", " ")}
                </Chip>
              ) : (
                <Chip tone="neutral">No assessment</Chip>
              )}
              {selected.siteGeohash && alertSites[selected.siteGeohash] ? (
                <Chip tone="high">
                  {alertSites[selected.siteGeohash]} alert
                </Chip>
              ) : null}
              <Chip tone="mono">
                {selected.sourceCount} source{selected.sourceCount === 1 ? "" : "s"}
              </Chip>
            </div>
            {selected.assessmentSummary ? (
              <p className="mt-3 text-[0.875rem] leading-6 text-ink-muted">
                {selected.assessmentSummary}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-4">
              <a
                href={`/investigations/${selected.id}`}
                className="font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 hover:text-ink"
              >
                Full investigation →
              </a>
              {selected.siteGeohash ? (
                <a
                  href={`/site/${selected.siteGeohash}`}
                  className="font-mono text-[0.8125rem] tracking-wider uppercase underline underline-offset-4 hover:text-ink"
                >
                  Site profile →
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="border-t border-rule pt-4">
            <Eyebrow>Investigation</Eyebrow>
            <p className="mt-2 font-serif text-xl text-ink-muted italic">
              Select a marker to read its investigation.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
