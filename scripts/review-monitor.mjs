#!/usr/bin/env node
// Live dashboard for the review-validation run. Reads the incremental results JSON + the run log
// and serves a self-updating page: progress bar, the two correlations (vs owner grades, vs photos)
// computed live so you watch them stabilize, and a feed of each hotel as it's scored.
//   node scripts/review-monitor.mjs [/tmp/revval30b.out]
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";

const PORT = 4849;
const LOG = process.argv[2] || "/tmp/revval30b.out";
const JSONF = "scripts/backups/review-validate.json";
const corr = (x, y) => { const n = x.length; if (n < 2) return null; const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let nu = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { nu += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return (dx && dy) ? nu / Math.sqrt(dx * dy) : null; };
const mae = (a) => a.length ? a.reduce((s, o) => s + o, 0) / a.length : null;

function status() {
  const out = existsSync(JSONF) ? JSON.parse(readFileSync(JSONF, "utf8")) : [];
  let total = 0, processed = 0, model = "?", finished = false;
  if (existsSync(LOG)) {
    const t = readFileSync(LOG, "utf8");
    const mt = t.match(/unique hotels to fetch=(\d+)/); if (mt) total = Number(mt[1]);
    const mm = t.match(/scorer model: (\S+)/); if (mm) model = mm[1];
    const proc = [...t.matchAll(/(\d+)\/\d+ processed/g)]; if (proc.length) processed = Number(proc[proc.length - 1][1]);
    finished = /=== RESULTS/.test(t);
  }
  const vg = out.filter((o) => o.grade != null);
  const vp = out.filter((o) => o.warmth != null);
  return {
    model, total, processed: Math.max(processed, out.length), scored: out.length, finished,
    grade: { corr: corr(vg.map((o) => o.reviewScore), vg.map((o) => o.grade)), mae: mae(vg.map((o) => Math.abs(o.reviewScore - o.grade))), n: vg.length },
    photo: { corr: corr(vp.map((o) => o.reviewScore), vp.map((o) => o.warmth)), mae: mae(vp.map((o) => Math.abs(o.reviewScore - o.warmth))), n: vp.length },
    recent: out.slice(-18).reverse(),
  };
}

createServer((req, res) => {
  if (req.url.startsWith("/status")) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(status())); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(HTML);
}).listen(PORT, () => console.log(`review monitor → http://localhost:${PORT}  (log: ${LOG})`));

const HTML = `<!doctype html><meta charset="utf8"><title>Review-signal test — live</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:26px;max-width:900px;margin:0 auto}
  h1{font-size:23px;margin:0 0 2px;font-family:Georgia,serif} .sub{color:var(--mut);margin-bottom:18px;font-size:14px}
  .bar{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-bottom:14px}
  .pct{font-size:30px;font-weight:700;font-family:Georgia,serif} .pct small{font-size:14px;color:var(--mut);font-weight:400;font-family:-apple-system}
  .track{height:12px;background:#0a0e0c;border-radius:7px;overflow:hidden;margin:10px 0;border:1px solid var(--line)}
  .fill{height:100%;background:linear-gradient(90deg,var(--clay),var(--ember),var(--gold));transition:width .5s}
  .cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
  .metric{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px}
  .metric .lab{color:var(--mut);font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  .metric .big{font-size:40px;font-weight:700;font-family:Georgia,serif;line-height:1.1}
  .metric .sub2{color:var(--mut);font-size:12px}
  .gold-b{border-color:color-mix(in srgb,var(--gold) 45%,var(--line))}
  .verdict{font-size:13px;font-weight:600;margin-top:4px}
  .feed{display:flex;flex-direction:column;gap:6px}
  .row{display:flex;gap:10px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px;animation:in .4s}
  @keyframes in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
  .sc{flex:none;width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#16201c;font-variant-numeric:tabular-nums}
  .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
  .tru{flex:none;color:var(--mut);font-size:13px;font-variant-numeric:tabular-nums}
  .stat{color:var(--mut);font-size:13px;margin-top:6px}
</style>
<h1>Review-signal test <span id="live" style="color:var(--sage);font-size:14px">● live</span></h1>
<div class="sub">Scoring cosiness from guest reviews with <b id="model">…</b>, checked against truth we trust. Watching the correlation stabilize.</div>
<div class="bar">
  <div class="pct"><span id="pct">0</span>% <small id="counts"></small></div>
  <div class="track"><div class="fill" id="fill" style="width:0%"></div></div>
  <div class="stat"><span id="rate"></span> · <span id="eta"></span></div>
</div>
<div class="cards">
  <div class="metric gold-b"><div class="lab">vs your grades (gold truth)</div><div class="big" id="gc">—</div><div class="sub2" id="gn"></div><div class="verdict" id="gv"></div></div>
  <div class="metric"><div class="lab">vs photos (noisy)</div><div class="big" id="pc">—</div><div class="sub2" id="pn"></div><div class="sub2" style="color:var(--mut)">text model = 0.11</div></div>
</div>
<div class="feed" id="feed"></div>
<script>
  const warm=v=>v>=8?'#d8b25a':v>=6?'#7fb7a2':v>=4?'#b07a4a':'#a89b8c';
  const vtxt=c=>c==null?'':c>=0.4?'STRONG ✓':c>=0.25?'moderate':'weak';
  let hist=[];
  function fmtEta(m){if(!isFinite(m)||m<=0)return '';if(m<60)return Math.round(m)+'m left';return Math.floor(m/60)+'h '+Math.round(m%60)+'m left';}
  async function tick(){
    let d; try{ d=await (await fetch('/status',{cache:'no-store'})).json(); }catch{ return; }
    document.getElementById('model').textContent=d.model;
    const pct=d.total?d.processed/d.total*100:0;
    document.getElementById('pct').textContent=pct.toFixed(0);
    document.getElementById('fill').style.width=pct+'%';
    document.getElementById('counts').textContent=d.processed+' / '+d.total+' processed · '+d.scored+' scored'+(d.finished?' · ✓ done':'');
    document.getElementById('live').style.display=d.finished?'none':'inline';
    const g=d.grade.corr, p=d.photo.corr;
    document.getElementById('gc').textContent=g==null?'—':g.toFixed(3);
    document.getElementById('gn').textContent='n='+d.grade.n+(d.grade.mae?' · MAE '+d.grade.mae.toFixed(2):'');
    const gv=document.getElementById('gv'); gv.textContent=vtxt(g); gv.style.color=g>=0.4?'#7fb7a2':g>=0.25?'#d8b25a':'#b07a4a';
    document.getElementById('pc').textContent=p==null?'—':p.toFixed(3);
    document.getElementById('pn').textContent='n='+d.photo.n+(d.photo.mae?' · MAE '+d.photo.mae.toFixed(2):'');
    const now=Date.now(); hist.push({t:now,n:d.processed}); hist=hist.filter(h=>now-h.t<120000);
    if(hist.length>=2){const a=hist[0],b=hist[hist.length-1];const perMin=(b.n-a.n)/((b.t-a.t)/60000);
      document.getElementById('rate').textContent=perMin>0?perMin.toFixed(1)+'/min':'';
      document.getElementById('eta').textContent=fmtEta((d.total-d.processed)/perMin);}
    document.getElementById('feed').innerHTML=(d.recent||[]).map(r=>'<div class="row"><span class="sc" style="background:'+warm(r.reviewScore)+'">'+r.reviewScore+'</span><span class="nm">'+esc(r.name||'')+'</span><span class="tru">'+(r.grade!=null?'grade '+r.grade:'')+(r.warmth!=null?'  photo '+r.warmth:'')+'  ('+r.nReviews+' rev)</span></div>').join('');
  }
  function esc(s){return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  tick(); setInterval(tick,2500);
</script>`;
