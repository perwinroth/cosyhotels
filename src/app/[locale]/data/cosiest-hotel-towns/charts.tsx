// Inline SVG charts for the cosiest-hotel-towns report — no chart library, per the locked
// Character-lane chart spec (service-lane adjudication, 2026-07-07). Static (no client JS):
// every value is direct-labelled in text, never colour-only, so these render identically
// server-side and read fine with images/animation off.
//
// Colours are fixed hexes (not the page's --ember/--muted CSS vars) because they were
// validated for both themes as part of the chart spec: towns #eb6834, capitals #898781.
const TOWN = "#eb6834";
const CAPITAL = "#898781";
const AXIS = "rgba(137,135,129,0.35)";

function ChartFrame({ title, children, height, ariaLabel }: { title: string; children: React.ReactNode; height: number; ariaLabel: string }) {
  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border p-4" style={{ borderColor: "var(--line)" }}>
      <svg viewBox={`0 0 720 ${height}`} width="100%" style={{ minWidth: 480 }} role="img" aria-label={ariaLabel}>
        <title>{title}</title>
        {children}
      </svg>
    </div>
  );
}

// ————— Host-gap chart — the mechanism section centerpiece —————
// Source: data-story-1-mechanism.json (evidence_table.1_host_people_language,
// evidence_table.3c_name_type_pattern). Cohorts: 180 qualified hotels across the 10 cosiest
// towns vs 509 qualified hotels across 8 large capitals (Barcelona, Paris, Rome, London,
// Amsterdam, Vienna, Prague, Florence). "Qualified" = review-derived score ≥5.0.
const HOST_GAP_ROWS: Array<{ label: string; townPct: number; capitalPct: number }> = [
  { label: "mentions a host / owner / family", townPct: 73.9, capitalPct: 25.7 },
  { label: "named as guesthouse / B&B / casa / inn", townPct: 31.1, capitalPct: 9.6 },
];

export function HostGapChart() {
  const W = 720;
  const PAD = { l: 260, r: 60, t: 44, b: 34 };
  const GROUP_H = 58;
  const H = PAD.t + HOST_GAP_ROWS.length * GROUP_H + PAD.b;
  const x = (pct: number) => PAD.l + (W - PAD.l - PAD.r) * (pct / 100);
  return (
    <ChartFrame
      height={H}
      title="How often a hotel's review evidence names a host, owner, family or guesthouse-type name: 10 cosiest towns vs 8 large capitals"
      ariaLabel="Bar chart: towns 74% vs capitals 26% mention a host, owner or family; towns 31% vs capitals 10% are named as a guesthouse or B&B. Full figures in the mechanism section text and evidence table below."
    >
      <text x={PAD.l} y={20} fontSize={12} fontWeight={700} fill={TOWN}>■ 10 cosiest towns (n=180 qualified hotels)</text>
      <text x={PAD.l} y={36} fontSize={12} fontWeight={700} fill={CAPITAL}>■ 8 large capitals (n=509 qualified hotels)</text>
      {HOST_GAP_ROWS.map((row, i) => {
        const gy = PAD.t + i * GROUP_H;
        return (
          <g key={row.label}>
            <text x={PAD.l - 12} y={gy + 24} textAnchor="end" fontSize={13} fill="currentColor">{row.label}</text>
            <line x1={PAD.l} x2={W - PAD.r} y1={gy} y2={gy} stroke={AXIS} />
            {/* towns bar */}
            <rect x={PAD.l} y={gy + 6} height={12} rx={4} width={Math.max(0, x(row.townPct) - PAD.l)} fill={TOWN} />
            <text x={x(row.townPct) + 8} y={gy + 16} fontSize={12.5} fontWeight={700} fill="currentColor">{row.townPct.toFixed(0)}% towns</text>
            {/* capitals bar */}
            <rect x={PAD.l} y={gy + 24} height={12} rx={4} width={Math.max(0, x(row.capitalPct) - PAD.l)} fill={CAPITAL} />
            <text x={x(row.capitalPct) + 8} y={gy + 34} fontSize={12.5} fontWeight={700} fill="currentColor">{row.capitalPct.toFixed(0)}% capitals</text>
          </g>
        );
      })}
      <text x={PAD.l} y={H - 8} fontSize={11.5} fill="currentColor" opacity={0.6}>
        share of qualified (score ≥5.0) hotels whose review-derived signals match · axis 0–100%
      </text>
    </ChartFrame>
  );
}

// ————— Tier strip — top-tier towns vs a few famous capitals, honestly axed —————
export function TierStripChart({
  towns,
  capitals,
}: {
  towns: Array<{ city: string; mean: number }>;
  capitals: Array<{ city: string; mean: number }>;
}) {
  const rows = [...towns.map((t) => ({ ...t, isTown: true })), ...capitals.map((c) => ({ ...c, isTown: false }))];
  const W = 720;
  const ROW = 30;
  const PAD = { l: 150, r: 56, t: 10, b: 30 };
  const H = PAD.t + rows.length * ROW + PAD.b;
  const AXIS_MIN = 5.0;
  const max = Math.max(...rows.map((r) => r.mean)) + 0.15;
  const x = (v: number) => PAD.l + (W - PAD.l - PAD.r) * ((v - AXIS_MIN) / (max - AXIS_MIN));
  return (
    <ChartFrame
      height={H}
      title="Top-tier cosiest towns vs four well-known capitals, mean cosy score"
      ariaLabel="Bar chart of mean cosy score for the top-tier cosiest towns compared with Rome, Paris, Vienna and Barcelona, shown as de-emphasised context. Axis starts at 5.0, the qualification floor, not zero. Full ranked table below."
    >
      {rows.map((r, i) => {
        const ty = PAD.t + i * ROW;
        return (
          <g key={r.city}>
            <text x={PAD.l - 10} y={ty + 17} textAnchor="end" fontSize={12.5} fill="currentColor" opacity={r.isTown ? 1 : 0.7}>{r.city}</text>
            <line x1={PAD.l} x2={W - PAD.r} y1={ty + 13} y2={ty + 13} stroke={AXIS} />
            <rect x={PAD.l} y={ty + 7} height={12} rx={4} width={Math.max(0, x(r.mean) - PAD.l)} fill={r.isTown ? TOWN : CAPITAL} />
            <text x={x(r.mean) + 8} y={ty + 17} fontSize={12} fontWeight={700} fill="currentColor">{r.mean.toFixed(2)}</text>
          </g>
        );
      })}
      <text x={PAD.l} y={H - 10} fontSize={11.5} fill="currentColor" opacity={0.6}>
        mean cosy score · axis starts at 5.0 — the qualification floor, not zero · grey = de-emphasised capital context, not part of the top tier
      </text>
    </ChartFrame>
  );
}
