#!/usr/bin/env node
// Live dashboard for the Haiku vision-QA sweep (scripts/vision-qa-haiku.mjs). Reads the run's
// progress JSON and serves a self-updating page: progress bar, kept/rejected/cost, and a feed of
// each image's verdict as it lands.
//   node scripts/vision-qa-monitor.mjs        # then open http://localhost:4852
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";

const PORT = 4852;
const PROGRESS = "scripts/backups/vision-haiku-progress.json";

const server = createServer((req, res) => {
  if (req.url.startsWith("/status")) {
    res.writeHead(200, { "content-type": "application/json" });
    if (!existsSync(PROGRESS)) return res.end(JSON.stringify({ error: "no run yet — start scripts/vision-qa-haiku.mjs" }));
    try { res.end(readFileSync(PROGRESS, "utf8")); }
    catch (e) { res.end(JSON.stringify({ error: String(e.message) })); }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(HTML);
});
server.listen(PORT, () => console.log(`Vision-QA monitor → http://localhost:${PORT}`));

const HTML = `<!doctype html><meta charset="utf8"><title>Vision QA (Haiku) — live</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:28px;max-width:920px;margin:0 auto}
  h1{font-size:24px;margin:0 0 2px;font-family:Georgia,serif} .sub{color:var(--mut);margin-bottom:20px;font-size:14px}
  .banner{background:#2a241a;border:1px solid var(--gold);color:var(--gold);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px;display:none}
  .barwrap{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}
  .pct{font-size:34px;font-weight:700;font-family:Georgia,serif} .pct small{font-size:15px;color:var(--mut);font-weight:400;font-family:-apple-system,sans-serif}
  .track{height:14px;background:#0a0e0c;border-radius:8px;overflow:hidden;margin:12px 0 4px;border:1px solid var(--line)}
  .fill{height:100%;background:linear-gradient(90deg,var(--clay),var(--ember),var(--gold));border-radius:8px;transition:width .6s ease}
  .stats{display:flex;gap:22px;flex-wrap:wrap;color:var(--mut);font-size:13px;margin-top:8px}
  .stats b{color:var(--ink);font-variant-numeric:tabular-nums}
  .feed{display:flex;flex-direction:column;gap:7px}
  .row{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:9px 13px;animation:in .4s ease}
  @keyframes in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  .tag{flex:none;width:74px;text-align:center;border-radius:7px;font-weight:700;font-size:12px;padding:3px 0;color:#16201c}
  .keep{background:var(--sage)} .rej{background:var(--clay)} .pend{background:#3a443c;color:var(--mut)}
  .host{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
  .lbl{color:var(--mut);font-size:12px;flex:none}
</style>
<h1>Vision QA · Claude Haiku <span style="color:var(--sage);font-size:14px">● live</span></h1>
<div class="sub" id="sub">Each stored hotel image is classified keep / reject — junk (logos, badges, people, collages, landmarks) is flagged so it never shows.</div>
<div class="banner" id="banner"></div>
<div class="barwrap">
  <div class="pct"><span id="pct">—</span>% <small id="counts"></small></div>
  <div class="track"><div class="fill" id="fill" style="width:0%"></div></div>
  <div class="stats"><span>kept <b id="kept">—</b></span><span>rejected <b id="rej">—</b></span><span>transient <b id="tr">—</b></span><span>rate <b id="rate">—</b>/min</span><span>ETA <b id="eta">—</b></span><span>spent <b id="spent">—</b> / est <b id="est">—</b></span></div>
</div>
<div class="feed" id="feed"></div>
<script>
  let hist = [];
  function fmtEta(min){ if(!isFinite(min)||min<=0) return '—'; if(min<60) return Math.round(min)+'m'; const h=Math.floor(min/60); return h+'h '+Math.round(min%60)+'m'; }
  function esc(s){ return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  async function tick(){
    let d; try { d = await (await fetch('/status',{cache:'no-store'})).json(); } catch { return; }
    if(d.error){ document.getElementById('sub').textContent = d.error; return; }
    const pct = d.total? (d.done/d.total*100):0;
    document.getElementById('pct').textContent = pct.toFixed(1);
    document.getElementById('fill').style.width = pct+'%';
    document.getElementById('counts').textContent = (d.done||0).toLocaleString()+' / '+(d.total||0).toLocaleString()+' images'+(d.finished&&d.mode==='execute'?' · ✓ complete':'');
    document.getElementById('kept').textContent = (d.kept||0).toLocaleString();
    document.getElementById('rej').textContent = (d.rejected||0).toLocaleString();
    document.getElementById('tr').textContent = (d.transient||0).toLocaleString();
    document.getElementById('spent').textContent = '$'+(d.spentUsd||0).toFixed(2);
    document.getElementById('est').textContent = '$'+(d.estCostUsd||0).toFixed(2);
    const b = document.getElementById('banner');
    if(d.mode==='dry'){ b.style.display='block'; b.textContent='DRY-RUN — '+ (d.total||0).toLocaleString()+' images in scope ('+d.scope+'), est ≤ $'+(d.estCostUsd||0).toFixed(2)+'. No writes, no spend. Run with --execute to start.'; }
    else { b.style.display='none'; }
    const now = Date.now(); hist.push({t:now,done:d.done}); hist = hist.filter(h=>now-h.t<120000);
    if(hist.length>=2){ const a=hist[0], z=hist[hist.length-1]; const perMin=(z.done-a.done)/((z.t-a.t)/60000);
      document.getElementById('rate').textContent = perMin>0?perMin.toFixed(0):'—';
      document.getElementById('eta').textContent = fmtEta((d.total-d.done)/perMin); }
    const feed = document.getElementById('feed');
    feed.innerHTML = (d.recent||[]).map(r=>{
      const cls = r.ok===true?'keep':r.ok===false?'rej':'pend';
      const tag = r.ok===true?'KEEP':r.ok===false?'REJECT':('was '+(r.prior===null?'null':r.prior));
      return '<div class="row"><span class="tag '+cls+'">'+tag+'</span><span class="host">'+esc(r.host)+'</span><span class="lbl">'+esc(r.label||'')+'</span></div>';
    }).join('');
  }
  tick(); setInterval(tick, 2000);
</script>`;
