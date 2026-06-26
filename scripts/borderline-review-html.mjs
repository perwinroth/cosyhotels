#!/usr/bin/env node
// Turn the borderline review JSON (written by dedup-hotels.mjs) into a visual page. Each cluster
// defaults to MERGE; click "Keep separate" on any genuine non-dupe. The page live-builds the exact
// command to run — it only ever adds the ones you kept separate to --reject, so a human decision
// gates every borderline merge. No server: open the file, decide, copy the command.
//   node scripts/borderline-review-html.mjs [scripts/backups/dedup-borderline-<ts>.json]
import { readFileSync, writeFileSync, readdirSync } from 'fs'

const arg = process.argv[2]
const file = arg || 'scripts/backups/' + readdirSync('scripts/backups').filter((f) => f.startsWith('dedup-borderline-')).sort().pop()
const clusters = JSON.parse(readFileSync(file, 'utf8'))

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const card = (c, i) => `
  <div class="cl" data-keeper="${esc(c.keeperId)}" data-merge="1">
    <div class="hd"><span class="n">#${i + 1}</span>
      <button class="tog" onclick="tog(this)">Merge ✓</button></div>
    <div class="rows">${c.members.map((m) => `
      <div class="row ${m.keeper ? 'keep' : ''}">
        <span class="sc">${m.score.toFixed(1)}</span>
        <span class="nm">${esc(m.name)}${m.keeper ? ' <em>keeper</em>' : ''}</span>
        <span class="meta">${esc(m.city || '')} · ${m.dist}m</span>
      </div>`).join('')}</div>
  </div>`

const html = `<!doctype html><meta charset="utf8"><title>Borderline dedup review</title>
<style>
  :root{--bg:#0f1512;--card:#18201c;--line:#2a332d;--ink:#f3eee6;--mut:#9da89f;--ember:#e08a4b;--sage:#7fb7a2}
  *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,sans-serif;padding:24px}
  h1{font-size:22px;margin:0 0 4px} .sub{color:var(--mut);margin-bottom:18px}
  .bar{position:sticky;top:0;background:var(--bg);padding:12px 0;border-bottom:1px solid var(--line);margin-bottom:16px;z-index:5}
  .cmd{width:100%;background:#0a0e0c;color:var(--sage);border:1px solid var(--line);border-radius:10px;padding:12px;font:13px/1.5 ui-monospace,monospace;min-height:64px}
  .btn{background:var(--ember);color:#16201c;border:0;border-radius:9px;padding:9px 16px;font-weight:600;cursor:pointer;margin-top:8px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:12px}
  .cl{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px}
  .cl[data-merge="0"]{opacity:.5;border-style:dashed}
  .hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px} .n{color:var(--mut);font-size:13px}
  .tog{background:var(--sage);color:#16201c;border:0;border-radius:7px;padding:5px 11px;font-weight:600;cursor:pointer;font-size:13px}
  .cl[data-merge="0"] .tog{background:#3a3f3b;color:var(--mut)}
  .row{display:flex;gap:9px;align-items:baseline;padding:3px 0} .row.keep .nm{color:var(--ember)}
  .sc{width:30px;color:var(--sage);font-weight:600;font-variant-numeric:tabular-nums} .nm{flex:1} em{color:var(--mut);font-style:normal;font-size:12px}
  .meta{color:var(--mut);font-size:12px}
</style>
<h1>Borderline dedup review</h1>
<div class="sub">${clusters.length} clusters the geo+name rule flagged as <em>probably</em> the same hotel, but not confidently enough to auto-merge. Default is <b>Merge</b>. Click <b>Keep separate</b> on any that are genuinely different properties.</div>
<div class="bar">
  <div style="color:var(--mut);font-size:13px;margin-bottom:6px">Run this to merge everything still set to <b>Merge</b> (held-back ones go to --reject):</div>
  <textarea class="cmd" id="cmd" readonly></textarea>
  <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('cmd').value)">Copy command</button>
  <span id="cnt" style="color:var(--mut);margin-left:12px"></span>
</div>
<div class="grid">${clusters.map(card).join('')}</div>
<script>
  function tog(b){const c=b.closest('.cl');const m=c.dataset.merge==='1'?'0':'1';c.dataset.merge=m;b.textContent=m==='1'?'Merge ✓':'Keep separate';build()}
  function build(){
    const reject=[...document.querySelectorAll('.cl')].filter(c=>c.dataset.merge==='0').map(c=>c.dataset.keeper);
    const merging=document.querySelectorAll('.cl').length-reject.length;
    const base='node --import tsx --env-file=.env.local scripts/dedup-hotels.mjs --borderline --execute';
    document.getElementById('cmd').value=reject.length?base+' --reject '+reject.join(','):base;
    document.getElementById('cnt').textContent=merging+' merging · '+reject.length+' kept separate';
  }
  build();
</script>`

const out = 'borderline-review.html'
writeFileSync(out, html)
console.log(`Wrote ${out} from ${file} (${clusters.length} clusters). Open it:  open ${out}`)
