---
name: pr-source-triage
description: Triage journalist-request digests (Source of Sources, SourceBottle, HARO, Featured, #JournoRequest) in the user's Gmail, find the queries that fit Got Cosy, and draft ready-to-send replies grounded in the cosiness data. Human reviews + sends — NEVER auto-send. Invoke when the user says "check SoS / my PR emails / journalist queries".
---

# PR source triage — turn journalist digests into ready replies

You process the daily media-query digests and hand back approval-ready replies. The user hits send.

## Hard rules
- **NEVER auto-send.** Draft only. Present each reply with its source query; the user reviews and sends (or you create a Gmail *draft* for them — only with explicit per-item go-ahead). Sending on their behalf needs their explicit yes, per query.
- **Only claim what the data supports.** Ground every stat in the real findings below. If a query needs a number we don't have, say so or skip it — never invent a figure or a hotel feature.
- **Relevance is strict.** Source of Sources removes off-topic responders permanently, no appeals. Only reply to queries genuinely in the lane. When unsure, skip.

## Process
1. **Fetch.** Search Gmail (connector must be authenticated) for recent/unread messages from the source platforms: `peter@sourceofsources.com`, SourceBottle, Help a Reporter / Featured, and any `#journorequest` forwards. Read each digest fully.
2. **Parse** each digest into individual queries: journalist, outlet, the actual question, the deadline, and required response format (word count, "reply to X", etc.).
3. **Filter — keep ONLY queries in Got Cosy's lane:** cosy / boutique / independent hotels; what makes a hotel (or space) feel cosy; hygge / slow / cosy travel; cosiest cities or destinations; hotel photos / design / "what makes a listing look inviting"; romantic, quiet, or winter/autumn getaways; hotel-industry data & trends; cosy vs luxury. **Discard** generic travel, flights, points/deals, unrelated lifestyle — anything you'd have to stretch for.
4. **Draft** a reply per kept query:
   - Answer the specific question in 2–4 tight sentences, leading with the single most relevant real stat/finding.
   - Add one concrete example (a real cosy hotel or the reject-data point) only if it strengthens it.
   - Match any required format/word-count; note the deadline at the top of the draft for the user.
   - Close with the credential + name + gotcosy.com so the citation links back.
   - Apply [[copywriting]] voice: specific, honest, no fluff.
5. **Present** all drafts to the user, each above its source query, ordered by soonest deadline. Offer to create Gmail drafts on their say-so.

## The credential (use verbatim or trim)
Per Winroth, founder of Got Cosy (gotcosy.com) — an AI that has scored 17,000+ hotels worldwide on "cosiness" (warmth, intimacy, character) from their real photos and guest reviews.

## The data to draw on (all real, verified — see [[pr-outreach]] / the data study)
- **Stars barely predict cosiness:** 2★ avg 4.9, 3★ 5.0, 4★ 5.1 (n≈2,141). A 4-star is ~0.2pt cosier than a 2-star.
- **Independents beat chains ~45%:** independents avg 4.6/10, chain-branded 3.1 (n=17,727). Chains are also rare in the cosy set.
- **Genuine cosiness is rare:** only ~1 in 150 scored hotels reaches elite-cosy (8+/10).
- **Geography:** Italy is the cosiest country by volume; Japan has the highest concentration of elite-cosy stays (~1 in 27); the USA has the lowest average of the big markets (~3.5). Cosiness clusters in old, small, pre-car cities.
- **What drives it:** warm light, natural materials, fireplaces, small/intimate scale, independent ownership, and guest-review language about feeling genuinely welcomed.
- **The photo reject-data** ("what makes a listing look cold"): logos, landmarks-not-the-hotel, stock people, award badges — for design/marketing/hotelier angles.
- **Honest ceiling (say it if asked about accuracy):** the score agrees with human raters about as well as two humans agree with each other (~0.43) — cosiness is subjective; we don't claim past that.

## Cadence
SoS/most platforms send Mon–Fri. Queries are time-sensitive (reply within the first hour beats a polished late reply). Run this once each morning when the user asks; prioritise the nearest deadlines.
