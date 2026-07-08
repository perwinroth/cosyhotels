// The 8 founder-reviewed Reddit/forum thread answers from the 2026-07-07 analysis pass (source:
// die-validation/memory/findings/thread-answers-draft-2026-07-07.md). Draft-only — Per reads, edits,
// and personally posts each one via his own Reddit account; nothing here auto-posts. Answer text is
// ported VERBATIM from that file (markdown blockquote markers stripped, everything else untouched —
// including the inline markdown formatting, meant to be pasted straight into a Reddit reply box).
//
// Savannah is deliberately excluded (untouched control market for the Charleston kill test) and no
// thread outside Bruges/Charleston was drafted (no other market has a shipped live guide yet) — see
// "Selection rationale" in the source file for the full picture.
export type RedditAnswerPlan = {
  threadUrl: string;
  title: string;
  market: string;
  /** Founder-assessed post-worthiness, 1 (skip) to 5 (best answer available for this thread). */
  worthiness: number;
  answer: string;
  disclosureNote: string;
};

export const REDDIT_ANSWER_PLAN: RedditAnswerPlan[] = [
  {
    threadUrl: "https://www.reddit.com/r/belgium/comments/1pc1462/hotel_recommendations_for_visiting_bruges/",
    title: "Hotel recommendations for visiting Bruges",
    market: "Bruges",
    worthiness: 3,
    answer: `Bruges' old town is tiny, so almost everywhere "central" is walkable to everything — the real trade-off is character vs. price, not neighborhood.

A few I'd actually put on a shortlist:
- **Relais Bourgondisch Cruyce** — canal-side, about 190m from the Grote Markt. One of the classic Bruges splurges, and it earns it.
- **Hotel Heritage (Relais & Chateaux)** — historic building right off the Markt (~180m), a genuine 4-5 star feel without going full chain-luxury.
- **BOUTIQUE B&B Everelmus** — small B&B about 320m from the Markt, if you want intimate over full-service. Book early, it's tiny.

Caveat: several of the nicest options in the old town are small B&Bs with 4-8 rooms, so they sell out first, especially Fri/Sat. If dates are flexible, midweek gets you better picks.

(Disclosure: I run a small site that ranks Bruges hotels by an AI-derived "cosy" score plus walking distance to the Markt — happy to link the full ranked list if useful, it's mostly the same handful of streets these picks are on.)`,
    disclosureNote:
      "State the site affiliation plainly in the first reply, not buried — r/belgium is a \"we'll sniff out an ad\" crowd; leading with 3 specific, non-linked recs before mentioning the site is what keeps this from reading as marketing.",
  },
  {
    threadUrl: "https://www.reddit.com/r/belgium/comments/bz6pc2/where_to_stay_in_bruges/",
    title: "Where to stay in Bruges?",
    market: "Bruges",
    worthiness: 3,
    answer: `For a group of 3 not familiar with Bruges: stay inside "the egg" (the old town ring within the moat) — it's small enough that you can walk everywhere and get back easily late at night.

- **Speelmansrei** — quiet canal street, ~390m from the Grote Markt, good if you want to be central but not right on top of the nightlife.
- **Hotel Malleberg** — ~250m from the Markt, solid mid-range boutique pick.
- **Huis Koning B&B** — one of the higher-rated small B&Bs in town, ~450m from the Markt — worth checking they can do a triple/twin-triple for three people, B&Bs here are small.

Bruges rewards staying inside the old walls specifically for the evenings — most day-trippers clear out by early evening and the canals at night are the actual payoff.

(I run a small site that tracks a "cosy" score across Bruges hotels if you want a longer ranked list — happy to share.)`,
    disclosureNote: "Same as above — mention only after the specific recs land.",
  },
  {
    threadUrl: "https://www.reddit.com/r/traveladvice/comments/1lkwg3e/where_to_stay_in_belgium_near_bruges/",
    title: "Where to stay in belgium near bruges?",
    market: "Bruges",
    worthiness: 4,
    answer: `Worth engaging with the Ghent-vs-Bruges comment directly, since that's the real debate on this thread: both are true — Ghent is bigger, cheaper, livelier, and has way fewer day-trippers if that's what's bugging you about Bruges. But if this is a first visit and you want the postcard version — canals, gabled townhouses, the Christmas-market square in winter — one night in Bruges' old town specifically is worth it because the evenings *after* the day-trippers leave are the actual experience, not the daytime crowds.

If doing one night each (they're 25 min apart by train, very doable):
- **Bruges:** Relais Bourgondisch Cruyce (~190m from Grote Markt) or BOUTIQUE B&B Everelmus (~320m)
- **Ghent:** Eremyten Hof or Villa Emma — both solidly rated, and noticeably cheaper than the Bruges equivalents for similar character.

(Disclosure: I run a small hotel-ranking site — I put together a longer Bruges-vs-Ghent comparison with a full top-5 each if it's useful, since this exact question comes up constantly.)`,
    disclosureNote:
      "Lead with agreeing/engaging on the actual debate before the link — this is the one draft where the link is most load-bearing (it directly answers the comparison being argued in-thread), so disclosure should be explicit and early.",
  },
  {
    threadUrl: "https://www.reddit.com/r/belgium/comments/1u6k7ty/looking_for_a_decent_hotel_in_bruges_close_to_the_station/",
    title: "Looking for a decent hotel in Bruges close to the station",
    market: "Bruges",
    worthiness: 3,
    answer: `Being straight about a limitation here: the well-reviewed "cosy"/boutique stock in Bruges clusters hard around the old-town centre (Markt/Burg), and the station is about a 15-20 min walk south of that, outside where most of the character hotels sit — I don't have a strong pick that's both genuinely close to the station AND has the charm people usually mean by "decent hotel in Bruges."

If flexible on 10-15 minutes' walk toward the station, the two options on the outer edge of the old town, still walkable both ways, are **Eco Hotel Fevery** and **Hotel Albert I** (both ~730-780m from the Markt, so roughly the midpoint toward the station). Otherwise, honestly, most people end up either staying central (old town) and taking the 10-min bus/taxi to the station on travel day, or staying at one of the chain hotels immediately by the station itself, which trades character for convenience.

Worth being clear about which one matters more to you — happy to point at the fuller list if useful, just flag it's ranked by distance to the Markt, not the station.`,
    disclosureNote:
      "Still worth a one-line disclosure (\"I run a small site that ranks these\") if any link or specific score is cited, even without a hard push — keeps it consistent with subreddit norms.",
  },
  {
    threadUrl: "https://www.reddit.com/r/Charleston/comments/1m2eriu/downtown_charleston_or_mount_pleasant_where_to/",
    title: "Downtown Charleston or Mount Pleasant - where to stay?",
    market: "Charleston",
    worthiness: 5,
    answer: `Downtown, pretty clearly, if "character" matters to you at all. I went looking specifically at what's actually available in Mount Pleasant in terms of boutique/inn-style lodging (as opposed to downtown's historic single-houses and B&Bs) and there's essentially none in the data I track — MP is almost entirely chain hotels near the shopping/Towne Centre area, which is fine if you just want a clean room and don't care about the stay itself, but it's not really a "destination" lodging area.

Downtown, within walking distance of King Street:
- **Wentworth Mansion** — ~270m off King St, a genuine Second Empire mansion, one of the highest-rated full-service options downtown.
- **The Governor's House Inn** — ~500m, historic inn, quieter side street.
- **Zero George** — ~1.05km, a cluster of restored 19th-century houses on a private lane — the quietest of the well-known options, worth the slightly longer walk.
- **15 Church Street B&B** — ~1.14km, the single highest cosy-score property in Charleston in my data (7.1/10), if you don't mind being a bit further from King St itself.

Honest trade-off: Mount Pleasant will usually be cheaper and easier for parking; downtown is what you're picturing when you imagine "cosy Charleston."`,
    disclosureNote:
      "Natural spot for \"I run a small site that tracks this stuff, that's actually where the Mount Pleasant data point comes from\" — the disclosure doubles as evidence for the claim, which reads as more credible, not more salesy.",
  },
  {
    threadUrl: "https://www.reddit.com/r/Charleston/comments/1av1i9h/best_hotels/",
    title: "Best hotels",
    market: "Charleston",
    worthiness: 4,
    answer: `Since you've already found that the search results just loop back to old threads with the same 4-5 names — here's an actual ranked list rather than a repost of those:

Small/boutique, walking distance of King St: **15 Church Street B&B** (7.1), **The Jasmine House** (6.9), **The Loutrel** (6.8), **Wentworth Mansion** (6.7), **The Governor's House Inn** (6.7), **The Spectator Hotel** (6.7).

If you want full-service/amenities over B&B intimacy: **Hotel Bennett** or **The Dewberry Charleston** are the well-known upscale picks, both under a mile from King St.

Caveat on the small B&Bs (15 Church St, Jasmine House): they're genuinely small — 4-10 rooms — so they book out first and suit couples better than groups. If you're 3+ people, lean toward Zero George or one of the full-service hotels instead.`,
    disclosureNote:
      "Given the OP explicitly complained about recycled Reddit answers, disclosing \"I actually track/rank these on a small site, that's where this list is from\" pre-empts the \"is this just another copy-paste\" reaction.",
  },
  {
    threadUrl: "https://www.reddit.com/r/chubbytravel/comments/1r9xa1o/best_hotel_recs_in_charleston/",
    title: "Best hotel recs in Charleston?",
    market: "Charleston",
    worthiness: 4,
    answer: `For a single night before heading to Kiawah, I'd optimize for "walk to dinner and back easily," not deep immersion — you're not going to explore much on a one-nighter.

- **The Restoration Charleston** — ~380m from King St, one of the closest-in options to the market/restaurant core.
- **Planters Inn** — ~560m, right on Market Square, historic and very central.
- If you want the one night to feel like an event since it's a special trip: **Wentworth Mansion** (~270m) is a genuine "wow, this is Charleston" first impression.

Since you're driving on to Kiawah the next day, I'd skip anything more than about a kilometer out — no reason to add walking time for a stay this short.`,
    disclosureNote: "Light touch fine here — one line, e.g. \"distances are from a hotel-ranking site I run, in case the full list helps.\"",
  },
  {
    threadUrl: "https://www.reddit.com/r/Charleston/comments/1clqv86/hotel_recommendation_please/",
    title: "Hotel Recommendation Please",
    market: "Charleston",
    worthiness: 4,
    answer: `For a honeymoon, "coolest" and "downtown-walkable" line up pretty well here — a few that fit both:

- **Zero George** — restored 19th-century houses on a private lane, quietest and most romantic feel of the well-known options, ~1.05km from King St.
- **The Vendue, Charleston's Art Hotel** — art-focused boutique with a well-liked rooftop, ~980m from King St, a popular honeymoon pick for that reason.
- **Planters Inn** — classic historic-inn romance, right on Market Square (~560m).
- **Wentworth Mansion** — if you want the "we're staying somewhere special" grand-mansion feel, ~270m from King St.

July heads-up: Charleston is hot and humid by then, so if you're eyeing one of the smaller B&Bs (Jasmine House, The Loutrel), double-check they have real AC and no pool — some of the small inns don't have pools, while Zero George and The Dewberry do if that matters for a summer trip.`,
    disclosureNote:
      "Standard one-liner works, e.g. \"I run a small site that ranks these by a 'cosy' score if a longer list is useful.\"",
  },
];
