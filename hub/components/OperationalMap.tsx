"use client";

import { useEffect, useRef } from "react";

export type OperationalMapPoint = {
  id: string;
  lat: number;
  lon: number;
  kind: "center" | "request" | "resource" | "safe";
  label: string;
  critical?: boolean;
};

const colors = { center: "#2563eb", request: "#b91c1c", resource: "#15803d", safe: "#7c3aed" };

export function OperationalMap({ points }: { points: OperationalMapPoint[] }) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!element.current) return;
    let disposed = false;
    let cleanup = () => {};

    void import("leaflet").then((L) => {
      if (disposed || !element.current) return;
      const valid = points.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lon));
      const map = L.map(element.current, { zoomControl: true, attributionControl: true }).setView([4.6767, -74.0483], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      for (const point of valid) {
        L.circleMarker([point.lat, point.lon], {
          radius: point.kind === "center" ? 9 : point.critical ? 8 : 7,
          color: "#ffffff",
          weight: 2,
          fillColor: colors[point.kind],
          fillOpacity: 0.95,
        }).bindTooltip(point.label).addTo(map);
      }

      if (valid.length === 1) map.setView([valid[0].lat, valid[0].lon], 14);
      if (valid.length > 1) map.fitBounds(valid.map((point) => [point.lat, point.lon] as [number, number]), { padding: [32, 32], maxZoom: 15 });
      window.setTimeout(() => map.invalidateSize(), 0);
      cleanup = () => map.remove();
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [points]);

  return (
    <div className="operational-map-wrap">
      <div className="operational-map" ref={element} role="img" aria-label="Mapa operacional con posiciones aproximadas sincronizadas" />
      {points.length === 0 && <div className="map-empty overlay">Esperando posiciones sincronizadas</div>}
      <span className="map-note">Ubicaciones aproximadas · ~100 m</span>
    </div>
  );
}
