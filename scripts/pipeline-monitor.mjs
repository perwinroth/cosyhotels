#!/usr/bin/env node
// Live dashboard for the content pipeline. Shows every job that writes a progress JSON:
//   ① Apify review scraping   ② bespoke FAQ (Haiku)   ③ grounded copy (Haiku)
// (rescore is added once score-reviews writes a progress file).
//   node scripts/pipeline-monitor.mjs    # then open http://localhost:4853
import { createServer } from "http";
import { readFileSync, existsSync } from "fs";

const PORT = 4853;
const JOBS = [
  { key: "scrape", title: "① Scraping reviews (Apify)", file: "scripts/backups/apify-scrape-progress.json", kind: "scrape" },
  { key: "faq", title: "② Bespoke FAQ (Haiku)", file: "scripts/backups/generate-faqs-progress.json", kind: "haiku" },
  { key: "copy", title: "③ Grounded copy (Haiku)", file: "scripts/backups/generate-copy-progress.json", kind: "haiku" },
];
const read = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };

const server = createServer((req, res) => {
  if (req.url.startsWith("/status")) {
    const out = {};
    for (const j of JOBS) out[j.key] = read(j.file);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(out));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(HTML);
});
server.listen(PORT, () => console.log(`Pipeline monitor → http://localhost:${PORT}`));

const PANELS = JOBS.map((j) => `
  <div class="panel">
    <div class="ph"><h2>${j.title}</h2><span class="st" id="${j.key}-st">—</span></div>
    <div class="pct"><span id="${j.key}-pct">—</span>% <small id="${j.key}-counts"></small></div>
    <div class="track"><div class="fill ${j.kind}" id="${j.key}-fill" style="width:0%"></div></div>
    <div class="stats" id="${j.key}-stats"></div>
    <div class="feed" id="${j.key}-feed"></div>
  </div>`).join("");

const HTML = `<!doctype html><meta charset="utf8"><title>Content pipeline — live</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:28px;max-width:880px;margin:0 auto}
  h1{font-size:23px;margin:0 0 18px;font-family:Georgia,serif}
  .panel{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:18px}
  .ph{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
  .ph h2{font-size:16px;margin:0;font-family:Georgia,serif} .ph .st{font-size:12px}
  .pct{font-size:30px;font-weight:700;font-family:Georgia,serif} .pct small{font-size:13px;color:var(--mut);font-weight:400;font-family:-apple-system,sans-serif}
  .track{height:12px;background:#0a0e0c;border-radius:7px;overflow:hidden;margin:10px 0 6px;border:1px solid var(--line)}
  .fill{height:100%;border-radius:7px;transition:width .6s ease}
  .fill.scrape{background:linear-gradient(90deg,var(--sage),var(--gold))} .fill.haiku{background:linear-gradient(90deg,var(--clay),var(--ember))}
  .stats{display:flex;gap:18px;flex-wrap:wrap;color:var(--mut);font-size:12.5px;margin-top:6px}
  .stats b{color:var(--ink);font-variant-numeric:tabular-nums}
  .feed{margin-top:12px;display:flex;flex-direction:column;gap:5px}
  .row{display:flex;gap:10px;align-items:center;font-size:12.5px;color:var(--mut)}
  .row .nm{color:var(--ink);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .tag{flex:none;font-variant-numeric:tabular-nums}
  .idle{color:var(--mut)} .live{color:var(--sage)} .done{color:var(--gold)}
</style>
<h1>Content pipeline <span class="live" style="font-size:13px">● live</span></h1>
${PANELS}
<script>
  const KEYS=${JSON.stringify(JOBS.map((j) => ({ key: j.key, kind: j.kind })))};
  const hist={};
  const fmtEta=m=>{if(!isFinite(m)||m<=0)return '—';if(m<60)return Math.round(m)+'m';return Math.floor(m/60)+'h '+Math.round(m%60)+'m';};
  const esc=s=>String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const $=id=>document.getElementById(id);
  function panel(key,kind,d){
    hist[key]=hist[key]||[];
    const st=$(key+'-st');
    if(!d){st.innerHTML='<span class="idle">not started</span>';$(key+'-pct').textContent='0';$(key+'-counts').textContent='';$(key+'-stats').innerHTML='';return;}
    const stale=Date.now()-(d.updatedAt||0)>20000;
    const total=d.total||0, done=d.done||0, pct=total?done/total*100:0;
    $(key+'-pct').textContent=pct.toFixed(1);
    $(key+'-fill').style.width=pct+'%';
    $(key+'-counts').textContent=done.toLocaleString()+' / '+total.toLocaleString();
    st.innerHTML=d.queued?'<span class="idle">queued — '+esc(d.note||'waiting')+'</span>':d.finished?'<span class="done">✓ complete</span>':(stale?'<span class="idle">idle</span>':'<span class="live">● running</span>');
    const now=Date.now(); hist[key].push({t:now,done}); hist[key]=hist[key].filter(h=>now-h.t<120000);
    let perMin='—',eta='—';
    if(hist[key].length>=2){const a=hist[key][0],z=hist[key][hist[key].length-1];const pm=(z.done-a.done)/((z.t-a.t)/60000);if(pm>0){perMin=pm.toFixed(0);eta=fmtEta((total-done)/pm);}}
    if(kind==='scrape'){
      $(key+'-stats').innerHTML='<span>matched <b>'+(d.matched||0).toLocaleString()+'</b></span><span>no-match <b>'+(d.noMatch||0).toLocaleString()+'</b></span><span>reviews <b>'+(d.reviews||0).toLocaleString()+'</b></span><span>rate <b>'+perMin+'</b>/min</span><span>ETA <b>'+(d.finished?'done':eta)+'</b></span><span>spent <b>$'+(d.costUsd||0).toFixed(2)+'</b></span>';
      $(key+'-feed').innerHTML=(d.recent||[]).map(r=>'<div class="row"><span class="nm">'+esc(r.name)+'</span><span class="tag '+(r.reviews?'':'idle')+'">'+(r.reviews?r.reviews+' reviews':'no match')+'</span></div>').join('');
    } else {
      $(key+'-stats').innerHTML='<span>written <b>'+(d.written||0).toLocaleString()+'</b></span><span>failed <b>'+(d.failed||0).toLocaleString()+'</b></span><span>rate <b>'+perMin+'</b>/min</span><span>ETA <b>'+(d.finished?'done':eta)+'</b></span>';
      $(key+'-feed').innerHTML=(d.recent||[]).map(r=>'<div class="row"><span class="nm">'+esc(r.name)+'</span><span class="tag">'+esc((r.description||'').slice(0,46))+(r.description?'…':'')+'</span></div>').join('');
    }
  }
  async function tick(){let d;try{d=await(await fetch('/status',{cache:'no-store'})).json();}catch{return;}for(const j of KEYS)panel(j.key,j.kind,d[j.key]);}
  tick();setInterval(tick,2500);
</script>`;
