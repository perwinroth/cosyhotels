"use client";
// Interactive map of the cosiest towns: real lat/lng dots (equirectangular), hover/tap a town
// for a photo card of its top cosy hotel + the town's stats; click through to the city guide.
// No map library — a stylised sea + graticule keeps it light and on-brand.
import { useState } from "react";

export type Town = {
  city: string; country: string; lat: number; lng: number;
  n: number; avg: number; standouts: number;
  topHotel?: { name: string; score: number; photo?: string };
  guideSlug: string;
  labelBelow?: boolean; // avoid label collisions in dense clusters
};

const EMBER = "#E08A4B";

export function CosyMap({ towns, locale }: { towns: Town[]; locale: string }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 720, H = 470;
  const LON = { min: -11.5, max: 27 }, LAT = { min: 29.5, max: 59.5 };
  const x = (lng: number) => ((lng - LON.min) / (LON.max - LON.min)) * W;
  const y = (lat: number) => ((LAT.max - lat) / (LAT.max - LAT.min)) * H;
  const t = active != null ? towns[active] : null;
  // Card flips side near the map edges so it never clips.
  const cardLeftPct = t ? Math.min(72, Math.max(2, (x(t.lng) / W) * 100 + 3)) : 0;
  const cardTopPct = t ? Math.min(58, Math.max(2, (y(t.lat) / H) * 100 - 12)) : 0;

  return (
    <div className="relative" onMouseLeave={() => setActive(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Map of Europe and Morocco marking the eleven towns with the highest average cosy scores">
        <defs>
          <radialGradient id="sea" cx="42%" cy="38%" r="85%">
            <stop offset="0%" stopColor="rgba(157,168,159,0.16)" />
            <stop offset="100%" stopColor="rgba(157,168,159,0.05)" />
          </radialGradient>
        </defs>
        <rect width={W} height={H} rx={14} fill="url(#sea)" />
        {/* graticule */}
        {[-10, 0, 10, 20].map((lg) => (
          <g key={`lg${lg}`}>
            <line x1={x(lg)} x2={x(lg)} y1={0} y2={H} stroke="rgba(157,168,159,0.18)" strokeDasharray="2 6" />
            <text x={x(lg) + 4} y={H - 8} fontSize={10} fill="currentColor" opacity={0.35}>{lg}°</text>
          </g>
        ))}
        {[35, 45, 55].map((lt) => (
          <g key={`lt${lt}`}>
            <line x1={0} x2={W} y1={y(lt)} y2={y(lt)} stroke="rgba(157,168,159,0.18)" strokeDasharray="2 6" />
            <text x={6} y={y(lt) - 4} fontSize={10} fill="currentColor" opacity={0.35}>{lt}°N</text>
          </g>
        ))}
        {/* region hints so the eye orients without a coastline */}
        <text x={x(2)} y={y(47.2)} fontSize={12} fill="currentColor" opacity={0.35} fontStyle="italic">France</text>
        <text x={x(11.2)} y={y(43.6)} fontSize={12} fill="currentColor" opacity={0.35} fontStyle="italic">Italy</text>
        <text x={x(-6.5)} y={y(32.6)} fontSize={12} fill="currentColor" opacity={0.35} fontStyle="italic">Morocco</text>
        <text x={x(-5.8)} y={y(55.6)} fontSize={12} fill="currentColor" opacity={0.35} fontStyle="italic">Britain &amp; Ireland</text>
        <text x={x(21.5)} y={y(46.9)} fontSize={12} fill="currentColor" opacity={0.35} fontStyle="italic">Romania</text>
        {towns.map((tw, i) => {
          const r = 5 + (tw.avg - 6.4) * 30; // size = how far above the pack
          return (
            <g key={tw.city} style={{ cursor: "pointer" }}
               onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} tabIndex={0}
               onClick={() => { window.location.href = `/${locale}/guides/${tw.guideSlug}`; }}>
              <circle cx={x(tw.lng)} cy={y(tw.lat)} r={r + 7} fill={EMBER} opacity={active === i ? 0.28 : 0.12} />
              <circle cx={x(tw.lng)} cy={y(tw.lat)} r={Math.max(5, r)} fill={EMBER} stroke="#fff" strokeWidth={1.4} />
              <text x={x(tw.lng)} y={tw.labelBelow ? y(tw.lat) + r + 18 : y(tw.lat) - (r + 11)} textAnchor="middle" fontSize={12.5} fontWeight={active === i ? 700 : 500} fill="currentColor">{tw.city}</text>
            </g>
          );
        })}
      </svg>

      {t && (
        <div className="absolute z-10 w-64 rounded-xl border shadow-lg overflow-hidden"
             style={{ left: `${cardLeftPct}%`, top: `${cardTopPct}%`, borderColor: "var(--line)", background: "var(--card)" }}>
          {t.topHotel?.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.topHotel.photo} alt={t.topHotel.name} className="w-full object-cover" style={{ height: 110 }} loading="lazy" />
          )}
          <div className="p-3">
            <div className="font-semibold">{t.city}, {t.country}</div>
            <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              avg cosy {t.avg.toFixed(2)} · {t.n} hotels scored · {t.standouts} genuinely cosy
            </div>
            {t.topHotel && (
              <div className="text-xs mt-1.5">
                <span style={{ color: "var(--muted)" }}>cosiest: </span>
                <span className="font-medium">{t.topHotel.name}</span>
                <span className="ml-1 rounded px-1 font-semibold text-white" style={{ background: EMBER }}>{t.topHotel.score.toFixed(1)}</span>
              </div>
            )}
            <a href={`/${locale}/guides/${t.guideSlug}`} className="mt-2 inline-block text-xs underline" style={{ color: EMBER }}>
              See the {t.city} guide →
            </a>
          </div>
        </div>
      )}
      <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
        Dot size = how far the town&apos;s average sits above the global pack (6.27). Hover or tap a town; click through to its guide.
      </p>
    </div>
  );
}
