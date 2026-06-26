#!/usr/bin/env node
// Live dashboard for the Qwen warmth-grounding pass. Reads the running pass's progress log and
// serves a self-updating HTML page (progress bar + a feed of each hotel as it's judged).
//   node scripts/qwen-monitor.mjs            # auto-finds the active scoring log
//   node scripts/qwen-monitor.mjs <logfile>  # or point it at a specific .output
// Then open http://localhost:4848
import { createServer } from "http";
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

const PORT = 4848;
const argLog = process.argv[2];

// Find the newest task .output that is a Qwen scoring run (contains the pass's header line).
function findLog() {
  if (argLog && existsSync(argLog)) return argLog;
  const roots = [];
  try { for (const d of readdirSync("/private/tmp")) if (d.startsWith("claude-")) roots.push(join("/private/tmp", d)); } catch {}
  let best = null, bestMtime = 0;
  const walkTasks = (dir) => {
    let entries = []; try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name === "node_modules") continue; walkTasks(p); }
      else if (e.name.endsWith(".output")) {
        try {
          const st = statSync(p);
          if (st.mtimeMs <= bestMtime) continue;
          const head = readFileSync(p, "utf8").slice(0, 4000);
          if (/blind hotels with a usable photo to assess|warmth grounding|warmth \d/.test(head)) { best = p; bestMtime = st.mtimeMs; }
        } catch {}
      }
    }
  };
  for (const r of roots) walkTasks(r);
  return best;
}

// Parse the pass's stdout into {total, done, junk, skipped, finished, recent[]}.
function parse(log) {
  const txt = readFileSync(log, "utf8");
  const lines = txt.split("\n");
  let total = 0, done = 0, junk = 0, skipped = 0;
  const recent = [];
  const finished = /\ndone — /.test(txt);
  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\/(\d+)\s+(.*)$/);
    if (!m) continue;
    const n = Number(m[1]); total = Number(m[2]); const rest = m[3];
    if (/^SKIP/.test(rest)) { skipped++; recent.push({ n, skip: true, name: rest.replace(/^SKIP\s*/, "").slice(0, 40) }); continue; }
    done = Math.max(done, n);
    const s = rest.match(/(\d+(?:\.\d)?)\s*→\s*(\d+(?:\.\d)?)\s+warmth\s+(\d+)(.*)$/);
    if (!s) continue;
    const isJunk = /JUNK/.test(s[4]); if (isJunk) junk++;
    const tail = s[4].replace(/JUNK→flag img/, "").trim();
    const parts = tail.split(/\s{2,}/).filter(Boolean);
    const name = parts[0] || ""; const note = parts.slice(1).join(" ") || (isJunk ? "junk photo — image flagged" : "");
    recent.push({ n, cur: Number(s[1]), next: Number(s[2]), warmth: Number(s[3]), junk: isJunk, name, note });
  }
  return { total, done, junk, skipped, finished, recent: recent.slice(-16).reverse() };
}

const server = createServer((req, res) => {
  if (req.url.startsWith("/status")) {
    const log = findLog();
    if (!log) { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify({ error: "no active scoring log found" })); }
    try { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ log, ...parse(log) })); }
    catch (e) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ error: String(e.message) })); }
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(HTML);
});
server.listen(PORT, () => console.log(`Qwen monitor → http://localhost:${PORT}  (log: ${findLog() || "not found yet"})`));

const HTML = `<!doctype html><meta charset="utf8"><title>Qwen warmth grounding — live</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2;--gold:#d8b25a;--clay:#b07a4a}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:28px;max-width:920px;margin:0 auto}
  h1{font-size:24px;margin:0 0 2px;font-family:Georgia,serif} .sub{color:var(--mut);margin-bottom:20px;font-size:14px}
  .barwrap{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}
  .pct{font-size:34px;font-weight:700;font-family:Georgia,serif} .pct small{font-size:15px;color:var(--mut);font-weight:400;font-family:-apple-system,sans-serif}
  .track{height:14px;background:#0a0e0c;border-radius:8px;overflow:hidden;margin:12px 0 4px;border:1px solid var(--line)}
  .fill{height:100%;background:linear-gradient(90deg,var(--clay),var(--ember),var(--gold));border-radius:8px;transition:width .6s ease}
  .stats{display:flex;gap:22px;flex-wrap:wrap;color:var(--mut);font-size:13px;margin-top:8px}
  .stats b{color:var(--ink);font-variant-numeric:tabular-nums}
  .now{display:flex;gap:16px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:18px}
  .gauge{flex:none;width:64px;height:64px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Georgia,serif;font-weight:700;font-size:24px;color:#16201c}
  .gauge small{font-family:-apple-system,sans-serif;font-size:8px;font-weight:700;letter-spacing:.1em;opacity:.8}
  .now .nm{font-size:17px;font-weight:600} .now .nt{color:var(--mut);font-size:13px}
  .feed{display:flex;flex-direction:column;gap:7px}
  .row{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:11px;padding:9px 13px;animation:in .4s ease}
  @keyframes in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
  .w{flex:none;width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#16201c;font-variant-numeric:tabular-nums}
  .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500}
  .nt{color:var(--mut);font-size:12px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .chg{font-variant-numeric:tabular-nums;font-size:13px;flex:none}
  .down{color:var(--clay)} .same{color:var(--mut)} .junk{color:var(--gold)}
  .idx{color:var(--mut);font-size:12px;flex:none;width:54px;text-align:right;font-variant-numeric:tabular-nums}
  .dim{opacity:.5}
</style>
<h1>Qwen warmth grounding <span style="color:var(--sage);font-size:14px">● live</span></h1>
<div class="sub" id="logline">Each hotel's real photo is scored 0–10 for warmth; an inflated blind score is pulled down to match. Junk photos flag the image instead.</div>
<div class="barwrap">
  <div class="pct"><span id="pct">—</span>% <small id="counts"></small></div>
  <div class="track"><div class="fill" id="fill" style="width:0%"></div></div>
  <div class="stats"><span>grounded <b id="done">—</b></span><span>remaining <b id="rem">—</b></span><span>rate <b id="rate">—</b>/min</span><span>ETA <b id="eta">—</b></span><span>junk flagged <b id="junk">—</b></span><span>skipped <b id="skip">—</b></span></div>
</div>
<div class="now" id="now" style="display:none">
  <div class="gauge" id="gauge">—<small>WARMTH</small></div>
  <div><div class="nm" id="nowname">—</div><div class="nt" id="nownote">waiting…</div></div>
</div>
<div class="feed" id="feed"></div>
<script>
  const warmColor = w => w>=8?'#d8b25a':w>=6?'#7fb7a2':w>=4?'#b07a4a':'#a89b8c';
  let hist = []; // {t, done}
  function fmtEta(min){ if(!isFinite(min)||min<=0) return '—'; if(min<60) return Math.round(min)+'m'; const h=Math.floor(min/60); return h+'h '+Math.round(min%60)+'m'; }
  async function tick(){
    let d; try { d = await (await fetch('/status',{cache:'no-store'})).json(); } catch { return; }
    if(d.error){ document.getElementById('logline').textContent = d.error; return; }
    const pct = d.total? (d.done/d.total*100):0;
    document.getElementById('pct').textContent = pct.toFixed(1);
    document.getElementById('fill').style.width = pct+'%';
    document.getElementById('counts').textContent = d.done.toLocaleString()+' / '+d.total.toLocaleString()+' hotels'+(d.finished?' · ✓ complete':'');
    document.getElementById('done').textContent = d.done.toLocaleString();
    document.getElementById('rem').textContent = (d.total-d.done).toLocaleString();
    document.getElementById('junk').textContent = d.junk;
    document.getElementById('skip').textContent = d.skipped;
    // rate + ETA from history
    const now = Date.now(); hist.push({t:now,done:d.done}); hist = hist.filter(h=>now-h.t<120000);
    if(hist.length>=2){ const a=hist[0], b=hist[hist.length-1]; const perMin=(b.done-a.done)/((b.t-a.t)/60000);
      document.getElementById('rate').textContent = perMin>0?perMin.toFixed(1):'—';
      document.getElementById('eta').textContent = fmtEta((d.total-d.done)/perMin); }
    // now-scoring = newest real (non-skip) entry
    const live = (d.recent||[]).find(r=>!r.skip);
    if(live){ document.getElementById('now').style.display='flex';
      const g=document.getElementById('gauge'); g.style.background=warmColor(live.warmth); g.firstChild.textContent=live.warmth;
      document.getElementById('nowname').textContent=live.name; document.getElementById('nownote').textContent=live.junk?'junk photo — image flagged (score kept)':(live.note||''); }
    // feed
    const feed = document.getElementById('feed');
    feed.innerHTML = (d.recent||[]).map(r=>{
      if(r.skip) return '<div class="row dim"><span class="idx">#'+r.n+'</span><span class="nm">'+esc(r.name)+'</span><span class="same">skipped (bad image)</span></div>';
      const dir = r.junk?'junk':(r.next<r.cur?'down':'same');
      const chg = r.junk?'junk → flag':(r.cur.toFixed(1)+' → '+r.next.toFixed(1));
      return '<div class="row"><span class="idx">#'+r.n+'</span><span class="w" style="background:'+warmColor(r.warmth)+'">'+r.warmth+'</span><span class="nm">'+esc(r.name)+'</span><span class="nt">'+esc(r.note||'')+'</span><span class="chg '+dir+'">'+chg+'</span></div>';
    }).join('');
  }
  function esc(s){ return String(s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  tick(); setInterval(tick, 2500);
</script>`;
