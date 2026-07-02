#!/usr/bin/env node
// Live page for the production review-scoring run. Reads review-scoring-state.json and shows
// progress, rate, time remaining, $ spent, and a feed of recent hotels.
//   node scripts/score-reviews-monitor.mjs  →  http://localhost:4851
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
const PORT = 4851, STATE = "scripts/backups/review-scoring-state.json";
createServer((req, res) => {
  if (req.url.startsWith("/status")) { res.writeHead(200, { "content-type": "application/json" }); res.end(existsSync(STATE) ? readFileSync(STATE, "utf8") : "{}"); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(HTML);
}).listen(PORT, () => console.log(`review-scoring monitor → http://localhost:${PORT}`));
const HTML = `<!doctype html><meta charset="utf8"><title>Review scoring — live</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:28px;max-width:880px;margin:0 auto}
  h1{font-size:23px;margin:0 0 2px;font-family:Georgia,serif} .sub{color:var(--mut);margin-bottom:18px;font-size:14px}
  .bar{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}
  .pct{font-size:32px;font-weight:700;font-family:Georgia,serif} .pct small{font-size:14px;color:var(--mut);font-weight:400;font-family:-apple-system}
  .track{height:13px;background:#0a0e0c;border-radius:7px;overflow:hidden;margin:11px 0;border:1px solid var(--line)}
  .fill{height:100%;background:linear-gradient(90deg,var(--clay),var(--ember),var(--gold));transition:width .5s}
  .stats{display:flex;gap:22px;flex-wrap:wrap;color:var(--mut);font-size:13px} .stats b{color:var(--ink);font-variant-numeric:tabular-nums}
  .cost{font-size:13px;color:var(--gold)}
  .feed{display:flex;flex-direction:column;gap:6px;margin-top:14px}
  .row{display:flex;gap:11px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:8px 12px;animation:in .4s}
  @keyframes in{from{opacity:0;transform:translateY(-5px)}to{opacity:1}}
  .sc{flex:none;width:34px;height:34px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;color:#16201c;font-variant-numeric:tabular-nums}
  .nm{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500} .delta{color:var(--mut);font-size:12px}
  .mode{font-size:11px;font-weight:700;padding:2px 8px;border-radius:5px;text-transform:uppercase}
</style>
<h1>Review scoring <span id="live" style="color:var(--sage);font-size:14px">● live</span></h1>
<div class="sub">Scoring un-grounded hotels from guest reviews (Haiku @20, calibrated to your grades), highest-score-first. <span id="mode"></span></div>
<div class="bar">
  <div class="pct"><span id="pct">0</span>% <small id="counts"></small></div>
  <div class="track"><div class="fill" id="fill" style="width:0%"></div></div>
  <div class="stats"><span>scored <b id="scored">—</b></span><span>no-reviews <b id="norev">—</b></span><span>rate <b id="rate">—</b>/min</span><span>time left <b id="eta">—</b></span><span class="cost">spent ≈ $<b id="cost" style="color:var(--gold)">—</b></span></div>
</div>
<div class="feed" id="feed"></div>
<script>
  const warm=v=>v>=8?'#d8b25a':v>=6?'#7fb7a2':v>=4?'#b07a4a':'#a89b8c';
  function fmt(m){if(!isFinite(m)||m<=0)return '—';if(m<60)return Math.round(m)+'m';return Math.floor(m/60)+'h '+Math.round(m%60)+'m';}
  async function tick(){
    let d; try{ d=await (await fetch('/status',{cache:'no-store'})).json(); }catch{ return; }
    if(!d.total){ document.getElementById('counts').textContent='waiting for run to start…'; return; }
    const pct=d.processed/d.total*100;
    document.getElementById('pct').textContent=pct.toFixed(1);
    document.getElementById('fill').style.width=pct+'%';
    document.getElementById('counts').textContent=d.processed+' / '+d.total+' processed'+(d.finished?' · ✓ done':'');
    document.getElementById('live').style.display=d.finished?'none':'inline';
    document.getElementById('mode').innerHTML=d.execute?'<span class="mode" style="background:color-mix(in srgb,var(--ember) 25%,transparent);color:var(--ember)">writing to prod</span>':'<span class="mode" style="background:#2a332d;color:var(--mut)">dry-run</span>';
    document.getElementById('scored').textContent=d.scored;
    document.getElementById('norev').textContent=d.noRev;
    document.getElementById('cost').textContent=(d.estCostUSD!=null?d.estCostUSD:0).toFixed(2);
    const mins=(d.updatedAt-d.startedAt)/60000;
    const rate=mins>0?d.processed/mins:0;
    document.getElementById('rate').textContent=rate>0?rate.toFixed(1):'—';
    document.getElementById('eta').textContent=fmt(rate>0?(d.total-d.processed)/rate:Infinity);
    document.getElementById('feed').innerHTML=(d.recent||[]).slice().reverse().map(r=>'<div class="row"><span class="sc" style="background:'+warm(r.cal)+'">'+r.cal+'</span><span class="nm">'+esc(r.name||'')+'</span><span class="delta">raw '+r.raw+' → cal '+r.cal+'</span></div>').join('');
  }
  function esc(s){return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));}
  tick(); setInterval(tick,2000);
</script>`;
