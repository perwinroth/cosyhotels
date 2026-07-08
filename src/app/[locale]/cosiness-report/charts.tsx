"use client";
// Interactive SVG charts for the cosiness data study. No chart library — lightweight,
// hover/focus tooltips, mount animation, honest axes. Every chart title states the takeaway.
import { useEffect, useRef, useState } from "react";

const EMBER = "#E08A4B";
const MOSS = "#9DA89F";
const GOLD = "#D8B25A";
const LINE = "rgba(157,168,159,0.25)";

function useInView() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(true); return; }
    const ob = new IntersectionObserver((e) => e[0].isIntersecting && setSeen(true), { threshold: 0.25 });
    ob.observe(el);
    return () => ob.disconnect();
  }, []);
  return { ref, seen };
}

function Tip({ x, y, lines }: { x: number; y: number; lines: string[] }) {
  const w = Math.max(...lines.map((l) => l.length)) * 7.2 + 20;
  return (
    <g pointerEvents="none">
      <rect x={x - w / 2} y={y - 16 - lines.length * 17} width={w} height={lines.length * 17 + 10} rx={6} fill="#0F1512" stroke={LINE} />
      {lines.map((l, i) => (
        <text key={i} x={x} y={y - 8 - (lines.length - 1 - i) * 17} textAnchor="middle" fontSize={12} fill="#F3EEE6" fontFamily="ui-sans-serif, system-ui">{l}</text>
      ))}
    </g>
  );
}

// ————— 1 · Score distribution histogram —————
export function Histogram({ data, floor, cosy }: { data: Array<{ bucket: number; n: number }>; floor: number; cosy: number }) {
  const { ref, seen } = useInView();
  const [hov, setHov] = useState<number | null>(null);
  const W = 720, H = 300, PAD = { l: 44, r: 12, t: 40, b: 34 };
  const max = Math.max(...data.map((d) => d.n));
  const bw = (W - PAD.l - PAD.r) / data.length;
  const x = (i: number) => PAD.l + i * bw;
  const y = (n: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - n / max);
  const xForScore = (s: number) => PAD.l + ((s - data[0].bucket) / 0.5) * bw;
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Distribution of cosy scores across 17,727 hotels">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(max * f)} y2={y(max * f)} stroke={LINE} strokeDasharray="3 5" />
            <text x={PAD.l - 8} y={y(max * f) + 4} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.55}>{Math.round(max * f).toLocaleString("en-GB")}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cosyBar = d.bucket >= cosy, hidden = d.bucket < floor;
          return (
            <g key={d.bucket}>
              <rect
                x={x(i) + 2} width={bw - 4}
                y={seen ? y(d.n) : H - PAD.b} height={seen ? H - PAD.b - y(d.n) : 0}
                rx={3}
                fill={cosyBar ? EMBER : hidden ? "rgba(157,168,159,0.28)" : MOSS}
                style={{ transition: `all .7s ${i * 0.03}s cubic-bezier(.2,.7,.3,1)` }}
                onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
              />
              {i % 2 === 0 && <text x={x(i) + bw / 2} y={H - PAD.b + 16} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.55}>{d.bucket}</text>}
            </g>
          );
        })}
        <line x1={xForScore(cosy)} x2={xForScore(cosy)} y1={PAD.t - 6} y2={H - PAD.b} stroke={EMBER} strokeDasharray="4 4" />
        <text x={xForScore(cosy) - 8} y={PAD.t + 6} textAnchor="end" fontSize={12} fill={EMBER} fontWeight={700}>2.3% of hotels are genuinely cosy →</text>
        <text x={PAD.l} y={PAD.t - 14} fontSize={12} fill="currentColor" opacity={0.55}>{`grey = below our 5.0 floor (not listed) · hover for counts`}</text>
        {hov != null && <Tip x={x(hov) + bw / 2} y={y(data[hov].n)} lines={[`score ${data[hov].bucket}–${data[hov].bucket + 0.4}`, `${data[hov].n.toLocaleString("en-GB")} hotels`]} />}
      </svg>
    </div>
  );
}

// ————— 2 · Stars vs cosiness (the flatline) —————
export function StarsChart({ data }: { data: Array<{ stars: string; n: number; avg: number }> }) {
  const { ref, seen } = useInView();
  const [hov, setHov] = useState<number | null>(null);
  const W = 720, H = 300, PAD = { l: 44, r: 12, t: 30, b: 40 };
  const bw = (W - PAD.l - PAD.r) / data.length;
  const y = (v: number) => PAD.t + (H - PAD.t - PAD.b) * (1 - v / 10);
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Average cosy score by hotel star rating: nearly identical across all star levels">
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke={LINE} strokeDasharray="3 5" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill="currentColor" opacity={0.55}>{v}</text>
          </g>
        ))}
        {data.map((d, i) => (
          <g key={d.stars}>
            <rect
              x={PAD.l + i * bw + bw * 0.18} width={bw * 0.64}
              y={seen ? y(d.avg) : y(0)} height={seen ? y(0) - y(d.avg) : 0}
              rx={5} fill={i === data.length - 1 ? GOLD : MOSS}
              style={{ transition: `all .7s ${i * 0.08}s cubic-bezier(.2,.7,.3,1)` }}
              onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}
            />
            <text x={PAD.l + i * bw + bw / 2} y={y(d.avg) - 8} textAnchor="middle" fontSize={14} fontWeight={700} fill="currentColor" opacity={seen ? 1 : 0} style={{ transition: "opacity .5s .6s" }}>{d.avg.toFixed(2)}</text>
            <text x={PAD.l + i * bw + bw / 2} y={H - PAD.b + 18} textAnchor="middle" fontSize={12} fill="currentColor" opacity={0.55}>{d.stars}</text>
          </g>
        ))}
        <text x={PAD.l} y={H - 6} fontSize={12} fill="currentColor" opacity={0.55}>average cosy score (0–10) · listed hotels with a known star rating · hover for sample sizes</text>
        {hov != null && <Tip x={PAD.l + hov * bw + bw / 2} y={y(data[hov].avg)} lines={[`${data[hov].stars}: ${data[hov].avg.toFixed(2)}/10`, `${data[hov].n.toLocaleString("en-GB")} hotels`]} />}
      </svg>
    </div>
  );
}

// ————— 3 · What separates cosy hotels (paired rates + lift) —————
export function LiftChart({ data }: { data: Array<{ label: string; cosy: number; uncosy: number }> }) {
  const { ref, seen } = useInView();
  const [hov, setHov] = useState<number | null>(null);
  const W = 720, ROW = 44, PAD = { l: 210, r: 74, t: 30, b: 26 };
  const H = PAD.t + data.length * ROW + PAD.b;
  const x = (v: number) => PAD.l + (W - PAD.l - PAD.r) * (v / 100);
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="How often each cosy signal appears in genuinely cosy hotels versus the rest">
        <text x={PAD.l} y={18} fontSize={12} fill={EMBER} fontWeight={700}>● cosy hotels (7.0+)</text>
        <text x={PAD.l + 160} y={18} fontSize={12} fill="currentColor" opacity={0.65} fontWeight={700}>● the rest (below 6.0)</text>
        {data.map((d, i) => {
          const ty = PAD.t + i * ROW;
          const lift = d.uncosy > 0 ? d.cosy / d.uncosy : d.cosy;
          return (
            <g key={d.label} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <text x={PAD.l - 10} y={ty + 21} textAnchor="end" fontSize={13} fill="currentColor">{d.label}</text>
              <rect x={PAD.l} y={ty + 6} height={11} rx={4} width={seen ? x(d.cosy) - PAD.l : 0} fill={EMBER} style={{ transition: `width .7s ${i * 0.06}s cubic-bezier(.2,.7,.3,1)` }} />
              <rect x={PAD.l} y={ty + 21} height={11} rx={4} width={seen ? x(d.uncosy) - PAD.l : 0} fill="rgba(157,168,159,0.55)" style={{ transition: `width .7s ${i * 0.06 + 0.05}s cubic-bezier(.2,.7,.3,1)` }} />
              <text x={x(Math.max(d.cosy, d.uncosy)) + 8} y={ty + 22} fontSize={12.5} fontWeight={700} fill={GOLD} opacity={seen ? 1 : 0} style={{ transition: "opacity .5s .7s" }}>{lift >= 2 ? `${lift.toFixed(1)}×` : ""}</text>
              {hov === i && <Tip x={PAD.l + 170} y={ty + 6} lines={[`${d.label}`, `cosy: ${d.cosy}% · rest: ${d.uncosy}%`]} />}
            </g>
          );
        })}
        <text x={PAD.l} y={H - 6} fontSize={12} fill="currentColor" opacity={0.55}>share of hotels whose reviews mention the signal · × = lift vs the rest</text>
      </svg>
    </div>
  );
}

// ————— 4 · Cosiest towns —————
export function CitiesChart({ data }: { data: Array<{ city: string; country: string; n: number; avg: number; standouts: number }> }) {
  const { ref, seen } = useInView();
  const [hov, setHov] = useState<number | null>(null);
  const W = 720, ROW = 34, PAD = { l: 150, r: 60, t: 12, b: 26 };
  const H = PAD.t + data.length * ROW + PAD.b;
  const min = 5.8, max = Math.max(...data.map((d) => d.avg)) + 0.05;
  const x = (v: number) => PAD.l + (W - PAD.l - PAD.r) * ((v - min) / (max - min));
  return (
    <div ref={ref}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cities with the highest average cosy score">
        {data.map((d, i) => {
          const ty = PAD.t + i * ROW;
          return (
            <g key={d.city} onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <text x={PAD.l - 10} y={ty + 18} textAnchor="end" fontSize={13} fill="currentColor">{d.city}</text>
              <line x1={PAD.l} x2={W - PAD.r} y1={ty + 14} y2={ty + 14} stroke={LINE} />
              <rect x={PAD.l} y={ty + 8} height={12} rx={5} width={seen ? x(d.avg) - PAD.l : 0} fill={i < 3 ? EMBER : "rgba(224,138,75,0.55)"} style={{ transition: `width .7s ${i * 0.05}s cubic-bezier(.2,.7,.3,1)` }} />
              <text x={x(d.avg) + 8} y={ty + 18} fontSize={12.5} fontWeight={700} fill="currentColor" opacity={seen ? 1 : 0} style={{ transition: "opacity .5s .6s" }}>{d.avg.toFixed(2)}</text>
              {hov === i && <Tip x={PAD.l + 190} y={ty + 8} lines={[`${d.city}, ${d.country}`, `${d.n} hotels scored · ${d.standouts} genuinely cosy`]} />}
            </g>
          );
        })}
        <text x={PAD.l} y={H - 6} fontSize={12} fill="currentColor" opacity={0.55}>average cosy score, towns with 15+ scored hotels · axis starts at 5.8 · hover for detail</text>
      </svg>
    </div>
  );
}
