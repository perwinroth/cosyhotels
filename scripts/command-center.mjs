#!/usr/bin/env node
// Got Cosy — Command Center. One pane for the whole operation: every background job (scrape, FAQ,
// copy, rescore, image backfill), live data coverage (scored / images / reviews / FAQ / copy), and
// the content + growth surface. Replaces the scattered per-job monitors.
//   node scripts/command-center.mjs   →  http://localhost:4900
import { createServer } from "http";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const PORT = 4900;
try { for (const line of readFileSync(".env.local", "utf8").split("\n")) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && process.env[m[1]] == null) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ""); } } catch {}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE);

const readJson = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null; } catch { return null; } };
const JOBS = [
  { key: "scrape", title: "Review scraping (Google+Apify)", file: "scripts/backups/apify-scrape-progress.json", kind: "scrape" },
  { key: "rescore", title: "Review grounding / re-scoring (Haiku)", file: "scripts/backups/review-scoring-state.json", kind: "haiku" },
  { key: "faq", title: "Bespoke FAQ", file: "scripts/backups/generate-faqs-progress.json", kind: "haiku" },
  { key: "copy", title: "Grounded copy", file: "scripts/backups/generate-copy-progress.json", kind: "haiku" },
  { key: "vision", title: "Image vision QA", file: "scripts/backups/vision-haiku-progress.json", kind: "haiku" },
];

// ---- coverage cache (DB queries are cheap count/head; refresh every 30s) -------------------------
let cache = { coverage: null, jobs: {}, updatedAt: 0, err: null };
const cnt = async (table, f) => { try { let q = db.from(table).select("*", { count: "exact", head: true }); if (f) q = f(q); const { count } = await q; return count || 0; } catch { return null; } };
async function refresh() {
  try {
    const [scored, s5, s78, s8, withDesc, imgTrue, imgFalse, imgNull] = await Promise.all([
      cnt("cosy_scores"), cnt("cosy_scores", (q) => q.gte("score", 5)), cnt("cosy_scores", (q) => q.gte("score", 7.8)),
      cnt("cosy_scores", (q) => q.gte("score", 8)), cnt("cosy_scores", (q) => q.not("description", "is", null).neq("description", "")),
      cnt("hotel_images", (q) => q.eq("vision_ok", true)), cnt("hotel_images", (q) => q.eq("vision_ok", false)), cnt("hotel_images", (q) => q.is("vision_ok", null).not("url", "like", "%placehold.co%")),
    ]);
    const reviewCache = readJson("scripts/backups/review-cache.json") || {};
    const reviewedHotels = Object.values(reviewCache).filter((v) => Array.isArray(v) && v.length).length;
    const faqData = readJson("src/data/hotelFaqs.json") || {};
    cache.coverage = { scored, s5, s78, s8, withDesc, imgTrue, imgFalse, imgNull, reviewedHotels, bespokeFaq: Object.keys(faqData).length };
    cache.err = null;
  } catch (e) { cache.err = String(e.message); }
  // ---- real spend (Apify billing API + Haiku estimate) -------------------------------------------
  try {
    const tok = process.env.APIFY_TOKEN;
    if (tok) {
      const [u, me] = await Promise.all([
        fetch(`https://api.apify.com/v2/users/me/usage/monthly?token=${tok}`).then((r) => r.json()),
        fetch(`https://api.apify.com/v2/users/me?token=${tok}`).then((r) => r.json()),
      ]);
      const apifyUsd = u?.data?.totalUsageCreditsUsdAfterVolumeDiscount ?? null;
      const cap = me?.data?.plan?.maxMonthlyUsageUsd ?? null;
      const included = me?.data?.plan?.monthlyUsageCreditsUsd ?? null;
      const faqN = cache.coverage?.bespokeFaq || 0;
      const copyN = readJson("scripts/backups/generate-copy-progress.json")?.written || 0;
      const haikuEstUsd = +(faqN * 0.003 + copyN * 0.0015).toFixed(2); // rough est, Haiku 4.5
      cache.spend = { apifyUsd, included, cap, headroom: (cap != null && apifyUsd != null) ? +(cap - apifyUsd).toFixed(2) : null, cycleEnd: u?.data?.usageCycle?.endAt || null, haikuEstUsd };
    }
  } catch { /* keep last spend */ }
  for (const j of JOBS) cache.jobs[j.key] = readJson(j.file);
  cache.updatedAt = Date.now();
}
refresh(); setInterval(refresh, 30000);

const OUTREACH = "scripts/backups/outreach.json";
const server = createServer((req, res) => {
  // update an outreach contact's status (queued/contacted/replied/won/declined)
  if (req.method === "POST" && req.url === "/outreach/status") {
    let body = ""; req.on("data", (c) => (body += c)); req.on("end", () => {
      try { const { id, status } = JSON.parse(body || "{}"); const list = readJson(OUTREACH) || []; const row = list.find((r) => String(r.id) === String(id)); if (row) { row.status = status; writeFileSync(OUTREACH, JSON.stringify(list, null, 2)); } res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ ok: !!row })); } catch (e) { res.writeHead(400); res.end(String(e.message)); }
    });
    return;
  }
  if (req.url.startsWith("/status")) { for (const j of JOBS) cache.jobs[j.key] = readJson(j.file); cache.chain = readJson("scripts/backups/haiku-chain-status.json"); cache.outreach = readJson(OUTREACH) || []; res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(cache)); return; }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(HTML);
});
server.listen(PORT, () => console.log(`Command Center → http://localhost:${PORT}`));

const JOBMETA = JSON.stringify(JOBS.map((j) => ({ key: j.key, title: j.title, kind: j.kind })));
const HTML = `<!doctype html><meta charset="utf8"><title>Got Cosy — Command Center</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,system-ui,sans-serif;padding:24px;max-width:1000px;margin:0 auto}
  h1{font-size:24px;margin:0 0 2px;font-family:Georgia,serif} h1 em{font-style:italic;color:var(--ember)}
  .sub{color:var(--mut);font-size:12px;margin-bottom:20px}
  h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:22px 0 10px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}
  .stat{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px}
  .stat .n{font-family:Georgia,serif;font-size:23px;font-weight:700} .stat .l{font-size:11px;color:var(--mut);margin-top:2px;line-height:1.3}
  .stat .bar{height:5px;background:#0a0e0c;border-radius:3px;margin-top:7px;overflow:hidden} .stat .bar>div{height:100%;background:linear-gradient(90deg,var(--sage),var(--gold))}
  .job{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 15px;margin-bottom:9px}
  .job .top{display:flex;justify-content:space-between;align-items:baseline} .job .t{font-weight:600} .job .st{font-size:11px}
  .job .pct{font-family:Georgia,serif;font-size:18px;font-weight:700;margin-top:2px} .job .pct small{font-size:12px;color:var(--mut);font-weight:400}
  .track{height:8px;background:#0a0e0c;border-radius:5px;overflow:hidden;margin:7px 0 4px;border:1px solid var(--line)} .fill{height:100%;border-radius:5px;transition:width .6s}
  .fill.scrape{background:linear-gradient(90deg,var(--sage),var(--gold))} .fill.haiku{background:linear-gradient(90deg,var(--clay),var(--ember))}
  .meta{font-size:11px;color:var(--mut);display:flex;gap:14px;flex-wrap:wrap}
  .meta b{color:var(--ink);font-variant-numeric:tabular-nums}
  .live{color:var(--sage)} .idle{color:var(--mut)} .done{color:var(--gold)} .queued{color:var(--clay)}
  .links{display:flex;flex-wrap:wrap;gap:8px} .links a{font-size:12.5px;color:var(--ink);text-decoration:none;background:var(--card);border:1px solid var(--line);border-radius:9px;padding:7px 12px}
  .links a:hover{border-color:var(--ember)}
  .ocard{background:var(--card);border:1px solid var(--line);border-radius:11px;padding:11px 13px;margin-bottom:8px}
  .ocard .ohead{display:flex;justify-content:space-between;align-items:baseline;gap:10px}
  .ocard .oname{font-weight:600;font-size:14px} .ocard .onote{font-size:12px;color:var(--mut);margin-top:3px}
  .chip{font-size:10.5px;color:var(--mut);border:1px solid var(--line);border-radius:6px;padding:1px 6px;margin-right:5px;text-transform:uppercase;letter-spacing:.04em}
  .oact{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px;align-items:center}
  .oact a,.oact button{font-size:12px;border:1px solid var(--line);border-radius:8px;padding:5px 10px;background:transparent;color:var(--ink);cursor:pointer;text-decoration:none}
  .oact a.send{background:var(--ember);color:#16201c;border-color:var(--ember);font-weight:600}
  .oact button:hover,.oact a:hover{border-color:var(--ember)}
  .oact button.on{background:var(--sage);color:#16201c;border-color:var(--sage)}
  .stbadge{font-size:10.5px;padding:2px 8px;border-radius:999px;font-weight:600}
  .st-queued{background:#2a332d;color:var(--mut)} .st-contacted{background:color-mix(in srgb,var(--gold) 25%,var(--card));color:var(--gold)}
  .st-replied{background:color-mix(in srgb,var(--sage) 25%,var(--card));color:var(--sage)} .st-won{background:var(--sage);color:#16201c} .st-declined{background:#2a332d;color:var(--clay)}
</style>
<h1>Got <em>cosy?</em> — Command Center <span class="live" style="font-size:12px">● live</span></h1>
<div class="sub" id="upd">—</div>

<h2>Operations</h2>
<div class="sub" id="pipe">—</div>
<div id="jobs"></div>

<h2>Spend</h2>
<div class="grid" id="spend"></div>

<h2>Growth &amp; Outreach <span style="text-transform:none;letter-spacing:0;color:var(--clay);font-size:11px">· draft opens in your mail app — you review &amp; send</span></h2>
<div class="links" style="margin-bottom:8px">
  <a href="https://gotcosy.com/en/what-makes-a-hotel-cosy" target="_blank">Hook: Data study ↗</a>
  <a href="https://gotcosy.com/en/make-your-hotel-look-cosy" target="_blank">Hook: Hotelier asset ↗</a>
  <a href="https://gotcosy.com/en/cosy-index" target="_blank">Hook: Cosy Index ↗</a>
  <a href="https://gotcosy.com/en/blog" target="_blank">Hook: Blog ↗</a>
</div>
<div class="grid" id="outreach-summary"></div>
<div id="outreach" style="margin-top:10px"></div>

<h2>Data coverage</h2>
<div class="grid" id="cov"></div>

<h2>Live site</h2>
<div class="links">
  <a href="https://gotcosy.com/en" target="_blank">Home ↗</a>
  <a href="https://gotcosy.com/en/cosy-index" target="_blank">Cosy Index ↗</a>
  <a href="https://gotcosy.com/en/what-makes-a-hotel-cosy" target="_blank">Data study ↗</a>
  <a href="https://gotcosy.com/en/make-your-hotel-look-cosy" target="_blank">Hotelier guide ↗</a>
  <a href="https://gotcosy.com/llms.txt" target="_blank">llms.txt ↗</a>
  <a href="https://gotcosy.com/sitemap.xml" target="_blank">Sitemap ↗</a>
</div>

<h2>Blog posts <span style="text-transform:none;letter-spacing:0;color:var(--clay)">· localhost · not yet published</span></h2>
<div class="links">
  <a href="http://localhost:3000/en/blog" target="_blank">Journal index ↗</a>
  <a href="http://localhost:3000/en/blog/cosiest-hotels-for-solo-travellers" target="_blank">Solo travellers ↗</a>
  <a href="http://localhost:3000/en/blog/cosiest-hotels-for-a-workation" target="_blank">Workation ↗</a>
  <a href="http://localhost:3000/en/blog/cosiest-hotels-for-a-family-stay" target="_blank">Family stay ↗</a>
  <a href="http://localhost:3000/en/blog/cosiest-hotels-for-a-quiet-escape" target="_blank">Quiet escape ↗</a>
  <a href="http://localhost:3000/en/blog/are-hotel-chains-ever-cosy" target="_blank">Cosy chains ↗</a>
  <a href="http://localhost:3000/en/blog/how-to-make-any-hotel-room-feel-cosy" target="_blank">DIY: make a room cosy ↗</a>
</div>

<h2>Social — Instagram / Pinterest</h2>
<div class="links">
  <a href="http://localhost:3000/posts" target="_blank">Pin gallery (→ Blotato) ↗</a>
  <a href="http://localhost:3000/today" target="_blank">Pinterest queue (manual) ↗</a>
</div>

<script>
  const JOBS=${JOBMETA};
  const hist={};
  // ---- outreach: pitch templates (review-then-send) + status tracking -----------------------------
  const SITE="https://gotcosy.com";
  const TEMPLATES={
    "data-study":o=>({s:'Data: we scored 17,000 hotels on "cosiness" — stars barely matter',b:'Hi,\\n\\nI run gotcosy.com — we used AI to score 17,000+ hotels on how cosy they are (warmth, intimacy, character), from their photos and guest reviews. A few findings that might suit '+o+':\\n\\n- Stars barely predict cosiness: a 4-star is on average ~0.2 of a point cosier than a 2-star\\n- Independent hotels beat chains by ~45%\\n- Only about 1 in 150 hotels is genuinely cosy\\n\\nFull study and method: '+SITE+'/en/what-makes-a-hotel-cosy\\nHappy to share the underlying data, charts or a quote.\\n\\nThanks,\\nPer — Got Cosy'}),
    "hotelier-asset":o=>({s:'The photos that make a hotel look "cold" — data from 17,000 listings',b:'Hi,\\n\\nI run gotcosy.com. From scoring 17,000+ hotel listings we found the exact photo types that make a hotel look cold — logos, landmarks, stock people, award badges — and what reads as genuinely cosy instead. Could make a useful, data-backed piece for '+o+'.\\n\\nThe guide: '+SITE+'/en/make-your-hotel-look-cosy\\nHappy to share the reject data or real examples.\\n\\nThanks,\\nPer — Got Cosy'}),
    "listicle":o=>({s:'The cosiest hotels, ranked — happy to share data with '+o,b:'Hi,\\n\\nI run gotcosy.com — AI cosiness rankings across 17,000+ hotels. Happy to put together a "cosiest hotels in [your city/region]" list for '+o+', or share the rankings / Cosy Index for you to reference.\\n\\nThe Index: '+SITE+'/en/cosy-index\\n\\nThanks,\\nPer — Got Cosy'}),
    "expert-source":o=>({s:'Source on cosy hotels / hygge travel (data-backed)',b:'Hi,\\n\\nI run gotcosy.com — I have scored 17,000+ hotels on cosiness and can speak, with data, on what actually makes a hotel cosy, where they cluster, cosy vs luxury, hygge travel and more. Happy to be a source for '+o+'.\\n\\n'+SITE+'\\n\\nThanks,\\nPer — Got Cosy'}),
  };
  const enc=encodeURIComponent;
  const mailto=r=>{const t=(TEMPLATES[r.fit]||TEMPLATES['data-study'])(r.outlet);return 'mailto:'+(r.email||'')+'?subject='+enc(t.s)+'&body='+enc(t.b);};
  async function setStatus(id,status){try{await fetch('/outreach/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,status})});}catch{} tick();}
  function renderOutreach(d){
    const list=d.outreach||[];const el=document.getElementById('outreach');const sum=document.getElementById('outreach-summary');
    if(!list.length){el.innerHTML='<div class="sub">No targets yet — the research agent is compiling the list.</div>';sum.innerHTML='';return;}
    const by={};for(const r of list){const s=r.status||'queued';by[s]=(by[s]||0)+1;}
    const order=['queued','contacted','replied','won','declined'];
    sum.innerHTML=order.filter(s=>by[s]).map(s=>'<div class="stat"><div class="n">'+by[s]+'</div><div class="l">'+s+'</div></div>').join('')+'<div class="stat"><div class="n">'+list.length+'</div><div class="l">total targets</div></div>';
    const recRank={'start-here':0,'if-budget':2,'skip':3};
    el.innerHTML=[...list].sort((a,b)=>(recRank[a.rec]!=null?recRank[a.rec]:1)-(recRank[b.rec]!=null?recRank[b.rec]:1)).map(r=>{
      const st=r.status||'queued';
      const recL=r.rec==='start-here'?'★ start here':r.rec==='if-budget'?'if budget':r.rec==='skip'?'skip':'';
      const recC=r.rec==='start-here'?'st-won':r.rec==='if-budget'?'st-contacted':'st-declined';
      const rec=recL?'<span class="stbadge '+recC+'" style="margin-left:5px">'+recL+'</span>':'';
      const isUrl=r.contactRoute&&/^https?:/.test(r.contactRoute);
      const send=r.email?('<a class="send" href="'+mailto(r)+'">✉ Draft email</a>'):(isUrl?('<a class="send" href="'+r.contactRoute+'" target="_blank">Open pitch page ↗</a>'):'');
      const route=r.email?('<span class="chip">'+r.email+'</span>'):(!isUrl&&r.contactRoute?('<span class="onote">route: '+r.contactRoute+'</span>'):'');
      const btns=['queued','contacted','replied','won'].map(s=>'<button class="'+(st===s?'on':'')+'" data-id="'+r.id+'" data-st="'+s+'">'+s+'</button>').join('');
      return '<div class="ocard"><div class="ohead"><div><span class="oname">'+r.outlet+'</span> <span class="stbadge st-'+st+'">'+st+'</span>'+rec+'<div style="margin-top:4px"><span class="chip">'+r.type+'</span><span class="chip">'+r.fit+'</span>'+(r.region?'<span class="chip">'+r.region+'</span>':'')+'</div></div></div>'+
        (r.notes?'<div class="onote">'+r.notes+'</div>':'')+(route?'<div style="margin-top:3px">'+route+'</div>':'')+
        '<div class="oact">'+send+btns+'</div></div>';
    }).join('');
  }
  document.getElementById('outreach').addEventListener('click',e=>{const b=e.target.closest('button[data-st]');if(b)setStatus(b.dataset.id,b.dataset.st);});
  const fmtEta=m=>{if(!isFinite(m)||m<=0)return '—';if(m<60)return Math.round(m)+'m';return Math.floor(m/60)+'h '+Math.round(m%60)+'m';};
  const pctOf=(a,b)=>b?Math.round(100*a/b):0;
  async function tick(){
    let d;try{d=await(await fetch('/status',{cache:'no-store'})).json();}catch{return;}
    document.getElementById('upd').textContent='updated '+new Date(d.updatedAt).toLocaleTimeString()+(d.err?(' · DB error: '+d.err):'');
    const ch=d.chain; document.getElementById('pipe').innerHTML=ch?('Pipeline phase: <b style="color:var(--ember)">'+ch.phase+'</b>'+(ch.job?' · '+ch.job:'')+(ch.scrapeDone!=null?' · waiting on scrape '+ch.scrapeDone+'/'+ch.scrapeTotal:'')):'chain idle';
    // jobs
    document.getElementById('jobs').innerHTML=JOBS.map(j=>{
      const x=d.jobs[j.key]; if(!x) return '<div class="job"><div class="top"><span class="t">'+j.title+'</span><span class="st idle">not started</span></div></div>';
      const total=x.total||0,done=(x.done!=null?x.done:x.processed)||0,pct=total?done/total*100:0,stale=Date.now()-(x.updatedAt||0)>30000;
      hist[j.key]=hist[j.key]||[];const now=Date.now();hist[j.key].push({t:now,done});hist[j.key]=hist[j.key].filter(h=>now-h.t<120000);
      let rate='—',eta='—';if(hist[j.key].length>=2){const a=hist[j.key][0],z=hist[j.key][hist[j.key].length-1];const pm=(z.done-a.done)/((z.t-a.t)/60000);if(pm>0){rate=pm.toFixed(0);eta=fmtEta((total-done)/pm);}}
      const st=x.queued?'<span class="queued">queued</span>':x.finished?'<span class="done">✓ complete</span>':(stale?'<span class="idle">idle</span>':'<span class="live">● running</span>');
      const costNow=(x.costUsd!=null?x.costUsd:x.estCostUSD);
      const costEst=j.key==='scrape'?x.projectedFullUsd:(j.key==='rescore'?+(total*0.002).toFixed(2):(j.key==='faq'?+(total*0.003).toFixed(2):(j.key==='copy'?+(total*0.0015).toFixed(2):null)));
      const extra=j.kind==='scrape'?('reviews <b>'+(x.reviews||0).toLocaleString()+'</b> · matched <b>'+(x.matched||0).toLocaleString()+'</b>'+(x.noPlace!=null?' · noPlace <b>'+x.noPlace+'</b>':'')+' · google <b>'+(x.googleCalls||0).toLocaleString()+'</b> free · REAL <b>$'+(x.costUsd||0).toFixed(2)+'</b>'+(x.projectedFullUsd?' · proj <b>$'+x.projectedFullUsd+'</b>':'')):('written <b>'+(x.written||x.kept||0).toLocaleString()+'</b>'+(x.failed!=null?' · failed <b>'+x.failed+'</b>':'')+(x.rejected!=null?' · rejected <b>'+x.rejected+'</b>':''));
      return '<div class="job"><div class="top"><span class="t">'+j.title+'</span>'+st+'</div>'+
        '<div class="pct">'+pct.toFixed(1)+'% <small>'+done.toLocaleString()+' / '+total.toLocaleString()+'</small></div>'+
        '<div class="track"><div class="fill '+j.kind+'" style="width:'+pct+'%"></div></div>'+
        '<div class="meta"><span>'+extra+'</span><span>rate <b>'+rate+'</b>/min</span><span>time left <b>'+(x.finished?'done':eta)+'</b></span>'+((costNow!=null||costEst!=null)?'<span>cost <b>$'+(costNow!=null?Number(costNow).toFixed(2):'—')+'</b>'+(costEst!=null?' / est $'+Number(costEst).toFixed(2):'')+'</span>':'')+'</div></div>';
    }).join('');
    // coverage
    const c=d.coverage; if(c){
      const cells=[
        {n:c.scored.toLocaleString(),l:'hotels scored'},
        {n:c.s5.toLocaleString(),l:'clear cosy bar (5+)',p:pctOf(c.s5,c.scored)},
        {n:c.s78.toLocaleString(),l:'Seal of Approval (7.8+)'},
        {n:c.s8.toLocaleString(),l:'in the Index (8.0+)'},
        {n:c.imgTrue.toLocaleString(),l:'cosy images (vision_ok)'},
        {n:c.imgNull.toLocaleString(),l:'images awaiting QA'},
        {n:c.reviewedHotels.toLocaleString(),l:'hotels with reviews',p:pctOf(c.reviewedHotels,c.s5)},
        {n:c.bespokeFaq.toLocaleString(),l:'bespoke FAQs',p:pctOf(c.bespokeFaq,c.s5)},
        {n:c.withDesc.toLocaleString(),l:'with a description',p:pctOf(c.withDesc,c.scored)},
      ];
      document.getElementById('cov').innerHTML=cells.map(x=>'<div class="stat"><div class="n">'+x.n+'</div><div class="l">'+x.l+'</div>'+(x.p!=null?'<div class="bar"><div style="width:'+x.p+'%"></div></div>':'')+'</div>').join('');
    }
    // spend
    const sp=d.spend; if(sp){
      const cap=sp.cap, used=sp.apifyUsd, sc=[];
      if(used!=null) sc.push({n:'$'+used.toFixed(2),l:'Apify this cycle (real)'+(cap?' / $'+cap+' cap':''),p:cap?Math.min(100,Math.round(100*used/cap)):null});
      if(sp.headroom!=null) sc.push({n:'$'+sp.headroom.toFixed(2),l:'Apify headroom left'+(sp.cycleEnd?' · resets '+new Date(sp.cycleEnd).toLocaleDateString():'')});
      sc.push({n:'~$'+(sp.haikuEstUsd||0).toFixed(2),l:'Haiku / Anthropic (est)'});
      if(used!=null) sc.push({n:'~$'+(used+(sp.haikuEstUsd||0)).toFixed(2),l:'total (Apify real + Haiku est)'});
      document.getElementById('spend').innerHTML=sc.map(x=>'<div class="stat"><div class="n">'+x.n+'</div><div class="l">'+x.l+'</div>'+(x.p!=null?'<div class="bar"><div style="width:'+x.p+'%"></div></div>':'')+'</div>').join('');
    }
    renderOutreach(d);
  }
  tick();setInterval(tick,3000);
</script>`;
