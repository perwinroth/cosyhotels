"use client";
// Real interactive map (Leaflet + OSM tiles): pan, zoom, and per-town markers whose popups show
// the town's top cosy hotel photo, its stats, and a click-through to the city guide.
// Loaded client-side only; tiles from the standard OSM raster CDN with proper attribution.
import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export type Town = {
  city: string; country: string; lat: number; lng: number;
  n: number; avg: number; standouts: number;
  topHotel?: { name: string; score: number; photo?: string };
  guideSlug: string;
  labelBelow?: boolean; // kept for API compatibility (unused by Leaflet renderer)
};

const EMBER = "#E08A4B";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

export function CosyMap({ towns, locale }: { towns: Town[]; locale: string }) {
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | null = null;
    let cancelled = false;
    const node = el.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !node || node.dataset.init) return;
      node.dataset.init = "1";
      map = L.map(node, { scrollWheelZoom: false, worldCopyJump: true, minZoom: 3 });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      // Open correctly framed on all towns (Europe + Morocco). fitBounds must run AFTER the
      // container has its real size — during hydration/layout it can be 0-height, which mis-fits
      // the view. Invalidate then fit on the next frame, and re-fit on container resize until the
      // reader genuinely interacts (drag/click — NOT our own fitBounds, which also fires move events).
      const bounds = L.latLngBounds(towns.map((t) => [t.lat, t.lng] as [number, number]));
      const frame = () => { if (!map) return; map.invalidateSize(); map.fitBounds(bounds, { padding: [36, 36] }); };
      frame();
      requestAnimationFrame(frame);
      let interacted = false;
      map.on("dragstart", () => { interacted = true; });
      map.once("click", () => { interacted = true; if (map) map.scrollWheelZoom.enable(); }); // scroll-zoom after engagement
      const ro = new ResizeObserver(() => { if (!interacted) frame(); else if (map) map.invalidateSize(); });
      ro.observe(node);
      map.once("unload", () => ro.disconnect());

      for (const t of towns) {
        const r = 8 + Math.max(0, t.avg - 6.45) * 55; // size = distance above the pack
        const m = L.circleMarker([t.lat, t.lng], {
          radius: Math.min(18, r), color: "#fff", weight: 1.5, fillColor: EMBER, fillOpacity: 0.92,
        }).addTo(map);
        m.bindTooltip(`${esc(t.city)} · ${t.avg.toFixed(2)}`, { direction: "top", offset: [0, -6] });
        const photo = t.topHotel?.photo
          ? `<img src="${esc(t.topHotel.photo)}" alt="${esc(t.topHotel.name)}" style="width:100%;height:110px;object-fit:cover;border-radius:8px 8px 0 0" loading="lazy"/>`
          : "";
        const hotelLine = t.topHotel
          ? `<div style="margin-top:5px;font-size:12px">cosiest: <b>${esc(t.topHotel.name)}</b> <span style="background:${EMBER};color:#fff;border-radius:4px;padding:0 4px;font-weight:700">${t.topHotel.score.toFixed(1)}</span></div>`
          : "";
        m.bindPopup(
          `<div style="width:230px">${photo}<div style="padding:${photo ? "8px 4px 2px" : "2px 4px"}">
            <div style="font-weight:700;font-size:14px">${esc(t.city)}, ${esc(t.country)}</div>
            <div style="font-size:12px;opacity:.75;margin-top:2px">avg cosy ${t.avg.toFixed(2)} · ${t.n} hotels scored · ${t.standouts} genuinely cosy</div>
            ${hotelLine}
            <a href="/${esc(locale)}/guides/${esc(t.guideSlug)}" style="display:inline-block;margin-top:7px;font-size:12px;color:${EMBER};font-weight:600">See the ${esc(t.city)} guide →</a>
          </div></div>`,
          { maxWidth: 250 }
        );
      }
    })();
    return () => { cancelled = true; if (map) map.remove(); if (node) delete node.dataset.init; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={el} style={{ height: 440, borderRadius: 12, overflow: "hidden", zIndex: 0, position: "relative" }} aria-label="Interactive map of the towns with the highest average cosy scores" />
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
        Dot size = how far the town&apos;s average sits above the global pack (6.27). Click a dot for its cosiest
        hotel and the town&apos;s numbers; click the map once to enable scroll-zoom.
      </p>
    </div>
  );
}
