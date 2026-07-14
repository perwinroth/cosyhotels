# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Got Cosy?** (`gotcosy.com`) — a Next.js site that ranks hotels by *cosiness*: an AI reads real guest reviews and scores each hotel 0–10 for warmth, character and intimacy (not stars). ~6.7k live hotels across a `[locale]` city/hotel/guide structure, plus a growth engine (SEO, social auto-posting, PR outreach, blog drip). The scoring dataset is the moat.

- **Stack:** Next.js 15 App Router + React 19 + TypeScript (strict) + Tailwind v4, all built with **Turbopack**. Data in **Supabase** (Postgres, project id `ccohnukmuzgvdrygtcsq`). Scoring/description via **Anthropic SDK** (Haiku). Hosted on **Vercel**.
- **Deploys straight to prod:** pushing to `main` auto-deploys to Vercel production in ~60–80s. There is no staging branch — treat every push to `main` as shipping live. Prefer previewing before merging non-trivial UI.

## Commands

```bash
npm run dev              # local dev (Turbopack), http://localhost:3000
npm run build            # production build
npm run lint             # eslint (eslint-config-next)
npx playwright test      # E2E tests (tests/), some with axe a11y checks
npx playwright test tests/foo.spec.ts   # single test file
npm run ship --m="msg"   # add -A, commit, pull --rebase, push to main (→ prod)
```

**Running scripts** (the `scripts/` dir — 70+ one-off/pipeline `.mjs`/`.ts`):
```bash
node --env-file=.env.local scripts/X.mjs                 # plain
node --env-file=.env.local --import tsx scripts/X.ts     # if it uses @/ imports
```
Reading `.env.local` directly is deny-blocked, but running a script that loads it is fine. `scripts/` is excluded from tsconfig.

## Architecture

**Routing / i18n.** `src/app/[locale]/…` where `locale ∈ en|fr|de|es|it|pt` (`src/i18n/locales.ts`). **Only `/en` is indexed** — every non-en page canonicals to its `/en` twin, and `/en` + `/` canonical to root. Unknown locales/malformed slugs `notFound()` (guards in `src/lib/seo/slugGuard.ts`); this matters for SEO — an unvalidated `[locale]` param was previously a canonical-confusion factory.

**`src/middleware.ts`** does two critical jobs: (1) 308-redirects every non-canonical host to `gotcosy.com`; (2) **fail-closed auth** on `/api/cron/*` (needs `CRON_SECRET`, sent by Vercel Cron), `/api/admin/*` (CRON_SECRET or `gc_panel` cookie), and the internal `/growth` `/admin` `/badge-outreach` dashboards (unlock with `?key=<PANEL_KEY>`). These endpoints mutate the DB or spend money, so they must never be public.

**Data access.** `src/lib/supabase/server.ts` → `getServerSupabase()` (service-role, server-only; returns `null` if env missing — callers must handle). `src/lib/` holds all the domain logic: `scoring/` (cosy score), `seo/` (`cityHotels.ts`, `sitemapData.ts`, `slugGuard.ts`), image resolution (`hotelImages.ts`, `hotelImageFree.ts`, `imageVision.ts`), `affiliates.ts`, `hotelIdentity.ts`/`dedupeKey.ts` (geo-based dedup), social/outreach. `src/data/` is static TS/JSON (cities, guides, collections, blog posts).

**Scoring pipeline** (the core value loop): `scripts/scrape-reviews-google-apify.mjs` (reviews → `review-cache.json`, **not** the DB) → `scripts/score-and-describe.mjs` (Haiku scores + writes a review-grounded description) → `scripts/score-dashboard.mjs`. **INVARIANT:** every live hotel (score ≥ 5) MUST have both a review-grounded score and custom review-grounded copy; regenerate the description whenever the score changes; hotels that can't be verified are hidden. Scoring is dimensional (v4, `dims` jsonb).

**Crons** (`vercel.json`): daily image backfill, `ensure-featured`, `populate`, `instagram-daily`; weekly `grow`. Pinterest cron is built (`/api/cron/pinterest-daily`) but **not scheduled** yet (blocked on a Blotato account-views gate — see memory).

## Invariants & gotchas (read before touching these areas)

- **Hotel URL structure is FINAL** — clean `country-city-name` slugs (no trailing Google Place IDs). `hotel_slug_redirects` (~19.7k rows) 301s every old form; the hotel page and `/go/[id]` affiliate redirect consult it on a miss. **Do not re-migrate hotel URLs.**
- **`scripts/seo-audit.mjs` is the acceptance gate** — run it after any URL/sitemap/canonical/redirect change (`node scripts/seo-audit.mjs [--sample N]`; `BASE=http://localhost:PORT` audits local, default audits prod). Note: local `next start` ISR is stale-while-revalidate, so a single local reading can lag — prod after a fresh deploy is authoritative.
- **City matching is accent/exonym-tolerant** via Postgres `unaccent` + the `cosy_city_hotels`/`cosy_city_count` RPCs; it's a strict **superset** match (never returns fewer results). Exonym aliases in `cityHotels.ts` (`CITY_DB_ALIAS`) must be verified against the DB before adding. Non-Latin scripts (CJK/Greek) are a separate unsolved class.
- **Any script that writes to the prod DB must be reviewed by the `data-migration-guard` agent before running with `--execute`** — it enforces dry-run-default, backup-before-write, reversibility, batching. Backups land in `scripts/backups/`.
- Sitemap = static `public/sitemap.xml` index → 5 DB-driven child routes; auto-updates, nothing to resubmit unless GSC shows a broken/old-domain entry.

## Persistent memory

There's a rich session memory at `~/.claude/projects/-Users-perwinroth-cosyhotels/memory/` — **read `MEMORY.md` (index) and the newest `session-handoff-*.md` first** for current project state, decisions, and what's open. Keep it updated as decisions are made.

# Ruflo — Claude Code Configuration

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({ prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher", name: "researcher", run_in_background: true })
Agent({ prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect", name: "architect", run_in_background: true })
Agent({ prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder", name: "coder", run_in_background: true })
Agent({ prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester", name: "tester", run_in_background: true })
Agent({ prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer", name: "reviewer", run_in_background: true })

// Kick off the pipeline
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" })
```

### Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

## Swarm & Routing

### Config
- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task | Agents | Topology |
|------|--------|----------|
| Bug Fix | researcher, coder, tester | hierarchical |
| Feature | architect, coder, tester, reviewer | hierarchical |
| Refactor | architect, coder, reviewer | hierarchical |
| Performance | perf-engineer, coder | hierarchical |
| Security | security-architect, auditor | hierarchical |

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2 | Haiku | Simple tasks, low complexity |
| 3 | Sonnet/Opus | Architecture, security, complex reasoning |

## Memory & Learning

### Before Any Task
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### After Success
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker | When |
|--------|------|
| `audit` | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features |
| `map` | Every 5+ file changes |
| `document` | After API changes |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing

```bash
npm run build && npm test
```

## CLI Quick Reference

```bash
npx @claude-flow/cli@latest init --wizard           # Setup
npx @claude-flow/cli@latest swarm init --v3-mode     # Start swarm
npx @claude-flow/cli@latest memory search --query "" # Vector search
npx @claude-flow/cli@latest hooks route --task ""    # Route to agent
npx @claude-flow/cli@latest doctor --fix             # Diagnostics
npx @claude-flow/cli@latest security scan            # Security scan
npx @claude-flow/cli@latest performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

```bash
claude mcp add claude-flow -- npx -y ruflo@latest mcp start
npx ruflo@latest doctor --fix
```

> The background `daemon` is optional. It runs interval workers that each spawn
> a headless `claude` session, so it consumes tokens continuously. Start it only
> if you want those sweeps: `npx ruflo@latest daemon start` (self-stops after 12h
> by default; `--ttl 0` to disable, `daemon status --all` to audit running daemons).

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
