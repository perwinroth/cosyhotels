// "Run them all, then start with Haiku." Waits for the unified Google+Apify review scrape to finish,
// then runs the Haiku jobs in order: bespoke FAQ, then grounded copy — each over the now-complete
// review set. Both are resumable/idempotent. Writes a small status file so the command center can
// show this orchestration too.
//   nohup node --env-file=.env.local scripts/run-haiku-after-scrape.mjs > log 2>&1 & disown
import { readFileSync, writeFileSync, existsSync } from "fs";
import { spawn } from "child_process";

const PROG = "scripts/backups/apify-scrape-progress.json";
const STATUS = "scripts/backups/haiku-chain-status.json";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const status = (s) => { try { writeFileSync(STATUS, JSON.stringify({ ...s, updatedAt: Date.now() }, null, 2)); } catch {} console.log(new Date().toISOString(), JSON.stringify(s)); };

function scrapeState() {
  try { return JSON.parse(readFileSync(PROG, "utf8")); } catch { return null; }
}
function scrapeDone() {
  const d = scrapeState(); if (!d) return false;
  if (d.finished === true) return true;
  if (typeof d.done === "number" && typeof d.total === "number" && d.total > 0 && d.done >= d.total) return true;
  // stale fallback: no progress update for 60 min → assume the scrape stopped, proceed with what we have
  if (d.updatedAt && Date.now() - d.updatedAt > 60 * 60 * 1000) return true;
  return false;
}

status({ phase: "waiting-for-scrape" });
while (!scrapeDone()) {
  const d = scrapeState();
  status({ phase: "waiting-for-scrape", scrapeDone: d?.done ?? 0, scrapeTotal: d?.total ?? 0, reviews: d?.reviews ?? 0, realCost: d?.costUsd ?? 0 });
  await sleep(90000);
}
status({ phase: "scrape-complete-starting-haiku", scrape: scrapeState() });

function run(label, cmd, args) {
  return new Promise((res) => {
    status({ phase: "running", job: label });
    const p = spawn(cmd, args, { stdio: "inherit" });
    p.on("exit", (code) => { status({ phase: "job-done", job: label, exit: code }); res(code); });
    p.on("error", (e) => { status({ phase: "job-error", job: label, error: String(e.message) }); res(-1); });
  });
}

// Rescoring (review-grounding) + blog-picks regen are owned by scripts/rescore-live.mjs, which runs
// continuously from now. This chain only does FAQ + grounded copy over the complete review set.
await run("faq", "node", ["--env-file=.env.local", "scripts/generate-faqs.mjs", "--execute"]);
await run("copy", "node", ["--env-file=.env.local", "scripts/generate-copy.mjs", "--execute"]);
status({ phase: "all-done" });
console.log("Haiku pipeline complete.");
