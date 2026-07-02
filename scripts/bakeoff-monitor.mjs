#!/usr/bin/env node
// Live leaderboard for the scorer bake-off. Reads bakeoff.json (incremental) + the run log and
// shows each model's correlation-to-grades building live, re-ranked as it scores.
//   node scripts/bakeoff-monitor.mjs
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";

const PORT = 4850;
const JSONF = "scripts/backups/bakeoff.json";
const LOG = "/tmp/bakeoff.out";
const CONFIGS = [
  { key: "qwen14b", label: "qwen3:14b", kind: "local" },
  { key: "haiku", label: "claude-haiku-4-5", kind: "api" },
  { key: "sonnet", label: "claude-sonnet-4-6", kind: "api" },
  { key: "opus", label: "claude-opus-4-8", kind: "api" },
  { key: "qwen14b_think", label: "qwen3:14b + thinking", kind: "local" },
];
const corr = (x, y) => { const n = x.length; if (n < 2) return null; const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return (dx && dy) ? nu / Math.sqrt(dx * dy) : null; };

const EXTRA = "scripts/backups/bakeoff-extra.json";
function status() {
  const rows = existsSync(JSONF) ? JSON.parse(readFileSync(JSONF, "utf8")) : [];
  const extra = existsSync(EXTRA) ? JSON.parse(readFileSync(EXTRA, "utf8")) : {};
  let active = "", finished = false, total = rows.length;
  if (existsSync(LOG)) { const t = readFileSync(LOG, "utf8"); const m = [...t.matchAll(/(qwen3:14b\+thinking|qwen3:14b|claude-[\w-]+): (\d+)\/(\d+)/g)]; if (m.length) { active = m[m.length - 1][1]; total = Number(m[m.length - 1][3]); } finished = /— FINAL/.test(t); const tm = t.match(/(\d+) hotels have reviews/); if (tm) total = Number(tm[1]); }
  const board = CONFIGS.map((c) => {
    const r = rows.filter((x) => typeof x.scores?.[c.key] === "number" && typeof x.grade === "number");
    const cc = r.length >= 5 ? corr(r.map((x) => x.scores[c.key]), r.map((x) => x.grade)) : null;
    const mae = r.length ? r.reduce((s, x) => s + Math.abs(x.scores[c.key] - x.grade), 0) / r.length : null;
    return { label: c.label, kind: c.kind, corr: cc, mae, n: r.length };
  });
  // Haiku at reduced review depths — scores in bakeoff-extra.json {id:{h10,h20}}, grades from rows.
  const val = (x, k) => { const e = extra[x.id]; return typeof e === "object" ? e[k] : (k === "h10" ? e : null); };
  for (const [k, label, kind] of [["h20", "claude-haiku-4-5 @20 (1 page)", "api · cheap ✓"], ["h10", "claude-haiku-4-5 @10 reviews", "api · cheapest"]]) {
    const p = rows.filter((x) => val(x, k) != null && typeof x.grade === "number").map((x) => ({ s: val(x, k), g: x.grade }));
    if (p.length >= 5) board.push({ label, kind, corr: corr(p.map((q) => q.s), p.map((q) => q.g)), mae: p.reduce((s, q) => s + Math.abs(q.s - q.g), 0) / p.length, n: p.length });
  }
  board.sort((a, b) => (b.corr ?? -9) - (a.corr ?? -9));
  return { board, active, finished, total };
}
createServer((req, res) => {
  if (req.url.startsWith("/status")) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(status())); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(HTML);
}).listen(PORT, () => console.log(`bake-off monitor → http://localhost:${PORT}`));

const HTML = `<!doctype html><meta charset="utf8"><title>Scorer bake-off — live</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:28px;max-width:820px;margin:0 auto}
  h1{font-size:23px;margin:0 0 2px;font-family:Georgia,serif} .sub{color:var(--mut);margin-bottom:8px;font-size:14px}
  .base{color:var(--mut);font-size:12px;margin-bottom:18px}
  .row{position:relative;overflow:hidden;display:flex;align-items:center;gap:14px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:10px;transition:all .5s}
  .prog{position:absolute;left:0;right:0;bottom:0;height:4px;background:#0a0e0c}
  .progfill{height:100%;background:var(--sage);transition:width .5s}
  .progfill.run{background:linear-gradient(90deg,var(--ember),var(--gold))}
  .row.lead{border-color:color-mix(in srgb,var(--gold) 55%,var(--line));box-shadow:0 0 0 1px color-mix(in srgb,var(--gold) 30%,transparent)}
  .rank{width:24px;color:var(--mut);font-size:15px;font-variant-numeric:tabular-nums}
  .name{flex:1;font-weight:600;font-size:16px} .kind{font-size:11px;color:var(--mut);font-weight:400;margin-left:8px;text-transform:uppercase;letter-spacing:.05em}
  .barwrap{flex:2;height:10px;background:#0a0e0c;border-radius:6px;overflow:hidden;border:1px solid var(--line)}
  .barfill{height:100%;background:linear-gradient(90deg,var(--clay),var(--ember),var(--gold));transition:width .6s}
  .corr{width:70px;text-align:right;font-family:Georgia,serif;font-size:26px;font-weight:700;font-variant-numeric:tabular-nums}
  .meta{width:120px;text-align:right;color:var(--mut);font-size:12px}
  .scoring{color:var(--sage);font-size:12px;font-weight:600}
  .pending{opacity:.45}
  .explain{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 16px;margin-bottom:18px;font-size:13px;color:var(--mut);line-height:1.6}
  .explain b{color:var(--ink)}
  .scale{display:flex;gap:6px;margin:8px 0;flex-wrap:wrap}
  .band{font-size:11px;padding:3px 9px;border-radius:6px;font-weight:600}
  .band.weak{background:color-mix(in srgb,var(--clay) 22%,transparent);color:var(--clay)}
  .band.mod{background:color-mix(in srgb,var(--gold) 20%,transparent);color:var(--gold)}
  .band.good{background:color-mix(in srgb,var(--sage) 20%,transparent);color:var(--sage)}
  .band.strong{background:color-mix(in srgb,var(--sage) 35%,transparent);color:#bfe6d6}
  .barwrap{position:relative}
  .tick{position:absolute;top:-2px;bottom:-2px;left:57.1%;width:2px;background:color-mix(in srgb,var(--ink) 50%,transparent);z-index:2}
  .chip{font-size:10px;font-weight:700;padding:2px 7px;border-radius:5px;text-transform:uppercase;letter-spacing:.04em;margin-left:8px;vertical-align:middle}
</style>
<h1>Scorer bake-off <span id="live" style="color:var(--sage);font-size:14px">● live</span></h1>
<div class="sub">Same guest reviews, scored by each model, ranked by correlation to <b>your owner grades</b>. <span id="active"></span></div>
<div class="explain">
  <b>What the number is:</b> correlation between the model's review-score and your human grade — <b>0 = random guessing, 1 = perfect agreement.</b> Higher = the model "reads" cosiness the way you do.
  <div class="scale">
    <span class="band weak">&lt;0.25 weak</span><span class="band mod">0.25–0.4 moderate</span><span class="band good">0.4–0.55 good</span><span class="band strong">0.55+ trustworthy</span>
  </div>
  <b>Reference points:</b> old text model <b>0.11</b> (useless) · qwen2.5-VL-7b vision <b>≈0.40</b> · the 0.40 mark is the line on each bar to beat. <b>MAE</b> = average points the score is off your grade (lower better). Bars scale to 0.70.
</div>
<div id="board"></div>
<script>
  function tick(){ fetch('/status',{cache:'no-store'}).then(r=>r.json()).then(d=>{
    document.getElementById('live').style.display=d.finished?'none':'inline';
    document.getElementById('active').textContent=d.finished?'✓ complete':(d.active?('now scoring: '+d.active):'starting…');
    document.getElementById('board').innerHTML=d.board.map((m,i)=>{
      const has=m.corr!=null;
      const pct=has?Math.max(0,Math.min(100,m.corr/0.7*100)):0;
      const isScoring=m.label.replace(' + ','+')===d.active||m.label===d.active;
      const v=!has?null:m.corr>=0.55?['strong','#bfe6d6','color-mix(in srgb,#7fb7a2 35%,transparent)']:m.corr>=0.4?['good','#7fb7a2','color-mix(in srgb,#7fb7a2 20%,transparent)']:m.corr>=0.25?['moderate','#d8b25a','color-mix(in srgb,#d8b25a 20%,transparent)']:['weak','#b07a4a','color-mix(in srgb,#b07a4a 22%,transparent)'];
      const chip=v?'<span class="chip" style="color:'+v[1]+';background:'+v[2]+'">'+v[0]+'</span>':'';
      return '<div class="row '+(i===0&&has?'lead':'')+' '+(has?'':'pending')+'">'
        +'<span class="rank">'+(has?'#'+(i+1):'·')+'</span>'
        +'<span class="name">'+m.label+'<span class="kind">'+m.kind+'</span>'+chip+'</span>'
        +'<span class="barwrap"><span class="tick" title="0.40 vision baseline"></span><span class="barfill" style="width:'+pct+'%"></span></span>'
        +'<span class="corr">'+(has?m.corr.toFixed(3):'—')+'</span>'
        +'<span class="meta">'+(has?('MAE '+m.mae.toFixed(2)+' · '+m.n+'/'+d.total):(isScoring?'<span class="scoring">scoring…</span>':'pending'))+'</span>'
        +'<div class="prog"><div class="progfill '+(isScoring?'run':'')+'" style="width:'+(d.total?Math.round(m.n/d.total*100):0)+'%"></div></div></div>';
    }).join('');
  }).catch(()=>{}); }
  tick(); setInterval(tick,2500);
</script>`;
