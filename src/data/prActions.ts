// PR action plan for the /growth/pr board. Source of truth: die-validation
// memory/findings/pr-action-plan-2026-07-08.md (all 105 outreach rows classified and prioritised)
// and pr-pitch-drafts-2026-07-08.md (12 Challenger-passed pitches, ported VERBATIM; do not rewrite).
// Four rows the Challenger or drafting agent killed with evidence (bl-yourfrenchstay, travlinmad-36,
// bl-ethicaltraveller, bl-familyfrance) are classified skip here with the documented reason.
// Keyed by outreach row id; merged with the live outreach table on the page.

export type PrActionType =
  | "email"
  | "form"
  | "register"
  | "hashtag"
  | "community-post"
  | "podcast-pitch"
  | "directory-submit"
  | "skip";

export type PrPitch = {
  to: string | null;
  route: string;
  subject: string;
  body: string;
  hold?: string;
};

export type PrAction = {
  outlet: string;
  actionType: PrActionType;
  priority: 1 | 2 | 3 | 4 | 5;
  priorityWhy: string;
  instructions?: string;
  pitch?: PrPitch;
};

// Monday-morning order from the action plan; breaks ties inside the same priority.
export const TOP10_ORDER: string[] = [
  "travel-leisure-2",
  "ehotelier-16",
  "bl-walesonline",
  "the-bootstrapped-founder-arvid-kahl-b33",
  "hacker-news-show-hn-b13",
  "boutique-hotel-news-12",
  "phocuswire-10",
  "quartz-ideas-23",
  "hospitality-net-11",
  "qwoted-40",
];

// ── Shared playbooks (surfaced once per section on the board, not per card) ──────────────────────

export const REGISTER_PLAYBOOK = `1. Sign up with perwinroth@gmail.com (or hello@gotcosy.com if preferred for filtering).
2. Profile text, then tailor per platform: "Per Winroth is the founder of Got Cosy, which scored 17,727 hotels by reading what guests wrote in reviews against a fixed rubric. He can speak to why star ratings barely predict how warm a stay feels, and what guests actually describe when a hotel feels like home."
3. Verticals and keywords: travel, hotels, hospitality, data and statistics, interior design.
4. Reply rule: ONE finding per reply, matched to the query. The findings: stars vs warmth (r=0.10, n=7,048); host and owner effect (74% vs 26%); quiet as the top atmosphere theme (35.6% of 9,437); owner-run vs chain (4.6 vs 3.1, n=367 chains); small towns vs capitals. The rest is "happy to share the data."
5. Always link https://gotcosy.com/en/data/cosiest-hotel-towns or /en/cosiness-report as proof.`;

export const HASHTAG_PLAYBOOK = `10 minutes a week, or two 5-minute passes.
1. Bookmark: x.com/search?q=%23JournoRequest travel OR hotel, the same for #PRRequest and #bloggerswanted/#bloggerrequest; on Bluesky search the same tags.
2. Twice a week, scan for hotel, travel, cosy, hygge and interior queries.
3. Reply from Per's account with ONE matched finding, the credential line, and "data and methodology at gotcosy.com, happy to share the file."
4. Move real conversations to email fast. Never reply to off-topic queries.`;

export const COMMUNITY_PLAYBOOK = `The post everywhere is the Lane-6 story: "Nothing scores an 8: what I learned reading the reviews of 17,727 hotels" (max 7.8; honest rubric; limitations published).
Show HN: title "Show HN: Got Cosy: I scored 17,727 hotels by reading their reviews; nothing scores an 8", URL in the URL field, backstory in the first comment, never ask for upvotes.
Indie Hackers: post the dataset origin story as a milestone, not a bare link.
r/SideProject: story plus a feedback ask. r/InternetIsBeautiful: read the sidebar; frame as a fun no-signup web tool.
r/travel and r/solotravel: NO link posts; answer questions genuinely, weekly promo threads only.
Quora: links only inside genuinely helpful answers; disclose affiliation.
Sequencing: r/SideProject, then Indie Hackers, then Show HN (rehearse the story where the stakes are low, then spend the HN shot).`;

export const DIRECTORY_PLAYBOOK = `THIS SECTION HAS MOVED: work directory submissions from /growth/listings (fuller target list, a copy button per form field, its own status pills). When you finish one there that also has a card here, mark this card done too so the boards agree.`;

// ── All 105 classified rows ──────────────────────────────────────────────────────────────────────

export const PR_ACTIONS: Record<string, PrAction> = {
  // ── EMAIL (send a real pitch) ──
  "travel-leisure-2": {
    outlet: "Travel + Leisure",
    actionType: "email",
    priority: 5,
    priorityWhy: "Verified submissions inbox; the corrected 1-in-44 rarity hook is a clean trends story; top-tier authority.",
    instructions: "PARKED, do not send. This card sits in batch-1b, which is formally parked until the eHotelier verdict lands (Lane-4 article submitted 2026-07-11; park recorded in HANDOVER-2026-07-12-FABLE5.md Part 3 and HANDOFF.md). What unparks it: the eHotelier editor says yes or no. Once that verdict arrives, this card gets a fresh pitch drafted to the 1-in-44 rarity trends angle (only 1 in 44 hotels is genuinely cosy: 404 of 17,727 score 7.0 or higher, 2.3 percent), taken through Challenger, then placed in the gotcosy@gmail.com Drafts folder for you to send Mon-Wed. No draft exists yet; the spec lives in the card row (cosyhotels/src/data/outreach.json, id travel-leisure-2) plus the corrected rarity wording in die-validation/memory/findings/pr-story-angles-2026-07-08.md. Two things to fix at draft time: the card note still says \"1-in-150\", which the Challenger killed (real figure is 1 in 44); and the on-file address submissions@travelandleisure.com must be re-verified against the live submissions page that morning (addresses rot; program rule). One-send-ever is clear: no Travel + Leisure row in the 2026-07-12 delivery audit and the card is still queued.",
  },
  "boutique-hotel-news-12": {
    outlet: "Boutique Hotel News",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified info@; its own note says the independents stat is tailor-made; Lane-2 host story in reserve.",
    pitch: {
      to: "eloise@internationalhospitality.media",
      route: "Raw-verified 2026-07-12 at https://www.boutiquehotelnews.com/contact/ (curl, raw HTML): eloise@internationalhospitality.media is the ONLY address on the page, under the verbatim invite \"If you have a story to tell the industry, whether as an owner, developer, operator or supplier, email us!\" The board's old info@ address does not appear anywhere on the current page and is stale. Recipient is Eloise Hanson (raw-verified: meta author tag on the hooked article; listed on /authors/).",
      subject: "What guests say independents do better",
      body: `Hi Eloise,

Your soft brands comment ends on a line I kept turning over: independents differentiate through design, F&B and local storytelling, but distribution decides who wins. The differentiation half is measurable. I run Got Cosy; we scored 17,727 hotels by reading what guests write in reviews.

The gap is not subtle. Chain-affiliated hotels average 3.1 on our cosiness score; independents average 4.6 (367 chains scored).

For BHN's owners and operators I can build a trade cut of what drives that gap in guest language, with the review evidence behind each part.

Want it?

Per
gotcosy.com

PS. One email only. If this isn't for you, I won't chase.`,
    },
  },
  "phocuswire-10": {
    outlet: "PhocusWire",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified editor@; data-research-friendly trade; methodology-led Lane-2 pitch.",
    pitch: {
      to: "editor@phocuswire.com",
      route: "editor@phocuswire.com (\"Main editorial: editor@phocuswire.com\" raw-verified 2026-07-12 on https://www.phocuswire.com/about-us, live page text via browser)",
      subject: "Measuring hospitality's human last mile",
      body: `Morgan Hines's commoditisation piece kept pulling me back to Narula's last mile: the execution layer stays human, and nobody puts a number on that layer.

We do. I run Got Cosy: 17,727 hotels scored by reading what guests write, and the methodology is public.

In the ten cosiest towns in our data, three hotels out of four have guests pointing to a person by name. In eight large cities it's closer to one in four. The differentiator is a person, and you can't standardise a person.

For PhocusWire I can cut that by chains against independents and towns against cities, raw file on request.

Worth a look?

Per
gotcosy.com

PS. One email only. If this isn't for you, I won't chase.`,
    },
  },
  "quartz-ideas-23": {
    outlet: "Quartz Ideas",
    actionType: "email",
    priority: 4,
    priorityWhy: "Public ideas@ inbox; formed economics angle (4.6 vs 3.1, 367 chains).",
    pitch: {
      to: "ideas@qz.com (VERIFY-AT-SEND)",
      route: "VERIFY-AT-SEND. ideas@qz.com is the historic Quartz Ideas pitch inbox (per the qz.com/635686 \"complete guide to writing for Quartz Ideas\"), but it could NOT be raw-verified this session: qz.com/about/contact AND the guide page both return HTTP 403, so the address is search-summary-derived only. STRONGER caution before any send: Quartz was sold to Redbrick in April 2025 and fired every editorial staffer except the editor-in-chief and executive editor; the site now publishes largely AI-generated content (Futurism; TechCrunch 27 Jan 2025; Talking Biz News). The human-edited Ideas section is very likely defunct and ideas@qz.com likely unmonitored. Founder action: confirm a live human Ideas editor still exists before spending this exclusive cut. If it cannot be confirmed, PARK the card and redirect the economics-of-hospitality angle to a live business/data outlet (e.g. the Wave-2 Axios/Skift lane) rather than burning the one send on a dead inbox.",
      subject: "Why chains can't buy back cosiness",
      body: `I run Got Cosy. I scored 17,727 hotels by reading what guests wrote, and the gap I did not expect was the one between chains and independents.

Across 367 chain hotels, the chains average 3.1 out of 10 for warmth. The independents average 4.6. What chains are built for, scale and sameness, is what guests stop writing warmly about.

For Quartz Ideas I can build the economics cut: what independents sell that no capex buys back, with the review evidence behind each number (condensed from guest reviews by our scoring model, not verbatim quotes).

Want it?

Per
gotcosy.com

PS. One email only. If it's not for you, I won't chase.`,
    },
  },
  "lonely-planet-3": {
    outlet: "Lonely Planet",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified editorial@; huge authority; Lane-3 towns cut as the backbone of a clusters piece, one finding only.",
    pitch: {
      to: "editorial@lonelyplanet.com (UNVERIFIED on LP's own current pages — confirm live address before send; see route note)",
      route: "VERIFY-AT-SEND. The board's editorial@lonelyplanet.com could NOT be raw-verified on Lonely Planet's own live site: www.lonelyplanet.com/contact 301-redirects to a support portal (support.lonelyplanet.com/hc/en-us) that publishes no general editorial address; www.lonelyplanet.com/about/contribute shows no email or pitch instructions; the \"How do I become a Lonely Planet writer\" support article returns HTTP 403. editorial@lonelyplanet.com now appears ONLY in third-party writing-market listings (markets.litworth.com/publishers/1577, freedomwithwriting.com), and litworth itself states there is no single main editorial@ anymore, listing topic-specific editor addresses instead (e.g. sarah.stocking@, alicia.johnson@, melissa.yeager@lonelyplanet.com). LP restructured post-acquisition. Founder must confirm the current route at send: for this multi-destination clusters piece the \"multiple destinations / travel tips\" desk applies, so editorial@lonelyplanet.com is the best candidate if still live, otherwise the relevant Europe/destinations editor. Do not guess an address pattern.",
      subject: "The cosiest towns beat Europe's capitals",
      body: `I built Got Cosy expecting the big-name capitals to win: Rome, Paris, the cities your readers plan whole trips around. They didn't.

We scored 17,727 hotels by reading what guests write. Town for town, small places like Alberobello and San Gimignano land cosier than the capitals that overshadow them.

For your readers I can build a clusters piece: where cosiness collects on the map, with the town-by-town evidence behind it.

Want it?

Per
gotcosy.com

PS. One email only. If it's not for you, I won't chase.`,
    },
  },
  "dwell-8": {
    outlet: "Dwell",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified edit@; Lane-4 design-cues angle matches their pitch guidance.",
    pitch: {
      to: "Dwell (edit@dwell.com)",
      route: "edit@dwell.com — RAW-VERIFIED 2026-07-13",
      subject: "Why small hotels read as cosy",
      body: `I went hunting for the design features that make a hotel feel warm, and kept landing on one that isn't a decorative feature at all: how small the building is.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote. In big cities, the stays guests call boutique average 6.30 out of 10 for warmth; the big-city average is 6.01. Small scale is what earns the feeling.

For a piece on how design earns cosiness, I can build you a ranked cut of the cosiest big-city boutique stays, each with the condensed review evidence behind it.

Worth a look?

Per
gotcosy.com

PS. One email only. If it's not your thing, I won't chase.`,
    },
  },
  "hospitality-design-hd-14": {
    outlet: "Hospitality Design",
    actionType: "email",
    priority: 4,
    priorityWhy: "Named exec editor email; Lane 4 plus the look-cosy asset.",
    pitch: {
      to: "Alissa Ponchione, Editor in Chief, Hospitality Design (the board's \"named exec editor\" — title updated from Executive Editor since the 2026-07-08 board build; raw-verified on the current masthead)",
      route: "VERIFY-AT-SEND. hospitalitydesign.com/contact-us obfuscates every editorial email via Cloudflare email-protection, so no address is raw-verifiable from the source page. Strong candidate alissa.ponchione@hospitalitydesign.com appears only on third-party aggregators (ZoomInfo/Prowly), NOT the outlet page — do not send until the exact local-part is confirmed by unmasking the Cloudflare mailto on the live contact page (or a reply-scrape). Fallback if it will not unmask: Managing Editor Caitlin St John via the same page.",
      subject: "The rarest detail in cosy hotels",
      body: `I built Got Cosy by reading what guests write, hunting for the design moves that actually make a room feel warm, not the ones brochures brag about.

We scored 17,727 hotels this way. One thing surprised me: a fireplace is the single rarest detail guests mention, yet it shows up about eight times more often in the stays that genuinely read as cosy, our top 2.3%.

For HD I can build a ranked cut of the design signals guests name when a hotel feels warm, each with the review evidence behind it.

Worth a look?

Per
gotcosy.com

PS. One email only. If it's not for you, I won't chase.`,
    },
  },
  "hospitality-interiors-26": {
    outlet: "Hospitality Interiors",
    actionType: "email",
    priority: 4,
    priorityWhy: "Named editor email; a perfect practical feature per its note.",
    pitch: {
      to: "Vicky Doe, Editor, Hospitality Interiors <vicky@lewisbusinessmedia.co.uk>",
      route: "RAW-VERIFIED. Editorial address vicky@lewisbusinessmedia.co.uk (Vicky Doe, Editor) extracted as the literal string from a raw curl of https://www.hospitality-interiors.net/contact-us/ (not a summarising fetch). Contact page is the outlet's own current feature-idea route. Send per canon from Got Cosy <per@gotcosy.com> via the gotcosy@gmail.com mailbox.",
      subject: "What makes a hotel room feel cosy",
      body: `I run Got Cosy. For months I've been reading what hotel guests actually write about their rooms: not the fit-out spec, the feeling it leaves. That's your patch, so here's what surfaced.

We scored 17,727 hotels for cosiness from their reviews. The independent, owner-shaped hotels beat the chains for it, 4.6 to 3.1. Character reads as warmth; the standardised room rarely does.

For your pages I can build a practical piece: the design choices that actually move guests to call a room cosy, each with the review evidence behind it. The calm, characterful room people now go looking for, made concrete.

Worth a look?

Per
gotcosy.com`,
    },
  },
  "travelperk-trends-statistics-b19": {
    outlet: "TravelPerk stats hub",
    actionType: "email",
    priority: 4,
    priorityWhy: "Public press@; high DR, likely dofollow, hyperlinks originals; exactly our citation goal.",
    pitch: {
      to: "Perk media team (press@perk.com)",
      route: "press@perk.com — RAW-VERIFIED 2026-07-13 at https://www.perk.com/press/ (\"For interviews, press requests or more information, please reach out to our media team\"). travelperk.com/press/ issues a 301 to perk.com/press/: the brand has rebranded from TravelPerk to Perk. FOUNDER-CONFIRM-FIT-BEFORE-SEND (see register): the outlet's focus is now corporate travel/expense, not the leisure travel-stats hub this card assumed.",
      subject: "What a hotel's stars don't tell you",
      body: `I built Got Cosy because a hotel's star rating never told me the thing I actually wanted to know: would the place feel warm, or like an airport lounge. So we read the guest reviews instead.

We scored 17,727 hotels on how cosy they feel. Not one clears an 8 out of 10, and only 1 in 44 reaches a 7. Genuine warmth turns out to be rare, and it tracks almost nothing a hotel puts on its own website.

I can pull a citable cut for your travel-stats readers, each figure linking back to the method. Useful?

Per
gotcosy.com`,
    },
  },
  "flowingdata-21": {
    outlet: "FlowingData",
    actionType: "email",
    priority: 4,
    priorityWhy: "Solo blogger, contact on the about page; pitch the score distribution and methodology as a dataset worth featuring (r=0.10 is analysis shared on request).",
    pitch: {
      to: "FlowingData (Nathan Yau) — suggestions@flowingdata.com",
      route: "suggestions@flowingdata.com — RAW-VERIFIED live in-browser (screenshot) at https://flowingdata.com/contact/ on 2026-07-13. The address is served as an anti-scrape IMAGE, not selectable text, so it was read visually. The page states: \"Send all post suggestions to the first address below... Suggestions sent to any other address won't be read.\" Our pitch IS a post suggestion (a dataset for a FlowingData post), so suggestions@ is the correct route, NOT nathan@flowingdata.com (that one is for membership/viz/collaboration inquiries). Note for the founder: the same page says \"I usually don't reply, but you can be sure I'll see your email\" — silence is doubly the norm here; a non-reply is not a fail and there is no follow-up (one-send-ever).",
      subject: "The cosiness scale with an empty top",
      body: `Your Fox 8 post, where a baseline just under 92°F makes a two-degree gap look huge, made me look again at my own scale. Mine runs the opposite way.

I run Got Cosy. We scored 17,727 hotels by reading guest reviews, on a 0-to-10 cosiness scale.

The surprise is the empty top: nothing clears 7.8. You'd expect a few nines. There are none.

For a FlowingData post I can send the full distribution, the method behind the scores, and the raw file to plot yourself.

Worth a look?

Per
gotcosy.com

PS. One email only. If it's not for you, I won't chase.`,
    },
  },
  "afar-coziest-us-hotels-b30": {
    outlet: "AFAR coziest-US page",
    actionType: "email",
    priority: 4,
    priorityWhy: "Bespoke checking-source offer (US table, Stowe); a low-friction want-the-file ask; high-authority page.",
    pitch: {
      to: "jennifer@afar.com",
      route: "email (hotels editor Jennifer Flowers, decoded from their pitch page)",
      subject: "A checking source for your cozy list",
      body: `Nicholas DeRenzo's coziest-US-hotels list has grown from 10 hotels to 13 across its refreshes, so it clearly has an appetite for new candidates. I can feed the next one.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote in reviews, and our US table happens to hold exactly 13 qualifying cities, led by Stowe, Vermont. Our scores come from review language, not star ratings, so the list comes out different from everyone else's.

For your next refresh I'll send the US city table plus the top-scored US hotels as a checking source. Free to cite, no link needed.

Want the file?

Per
gotcosy.com`,
    },
  },
  "afar-0": {
    outlet: "AFAR (trends desk)",
    actionType: "email",
    priority: 4,
    priorityWhy: "Their pitch-guidelines page lists section-editor emails; Lane 1 is stronger once r=0.10 is on a live page (wave-2 draft).",
    instructions: "Step 1 is grabbing the travel-news editor's address from the pitch-guidelines page. Draft in wave 2, once r=0.10 is live.",
  },
  "hello-hygge-30": {
    outlet: "Hello Hygge",
    actionType: "email",
    priority: 3,
    priorityWhy: "Verified personal email and the exact niche; small reach, a cheap and likely win.",
    pitch: {
      to: "Kayleigh Tanner, Hello Hygge <kayleigh_tanner@hotmail.co.uk>",
      route: "kayleigh_tanner@hotmail.co.uk — RAW-VERIFIED 2026-07-13 against page text of https://hellohygge.com/contact/ (\"drop me an email at kayleigh_tanner@hotmail.co.uk\") and https://hellohygge.com/pr/ (same address). Solo blog run by Kayleigh Tanner (Brighton); no editorial submission form, personal email is the only route. Send Mon-Wed from gotcosy@gmail.com (From: Got Cosy <per@gotcosy.com>); founder sends.",
      subject: "The towns with the cosiest hotels",
      body: `I went looking in our data for where the cosiest stays cluster, expecting the famous cities. It kept landing on small towns instead, the kind most people drive straight through.

I run Got Cosy. We read 68,269 guest reviews to score 17,727 hotels for how cosy they feel.

In the ten cosiest towns, three stays in four have guests naming a person: the owner, someone at the front desk. In big cities it's closer to one in four. Who runs the place is most of the feeling.

For your readers I can build a cut of those towns, each with the review evidence behind it.

Want it?

Per
gotcosy.com

PS One email only. If it's not for you, I won't chase.`,
    },
  },
  "atlas-obscura-7": {
    outlet: "Atlas Obscura",
    actionType: "email",
    priority: 3,
    priorityWhy: "Verified pitches@ plus the quirky 1-in-44 hook, BUT they are reportedly pausing freelance pitches.",
    instructions: "Verify their freelance-pitch status before sending; draft in wave 2 once confirmed.",
  },
  "axios-22": {
    outlet: "Axios",
    actionType: "email",
    priority: 3,
    priorityWhy: "Generic news and tips route; the Smart-Brevity data scoop is real but the hit rate is low without a named reporter.",
    instructions: "Wave 2: find a named reporter first, then send the data scoop.",
  },
  "the-agenda-by-tablet-hotels-24": {
    outlet: "Tablet Hotels",
    actionType: "email",
    priority: 3,
    priorityWhy: "Verified editors@; independent-hotel editorial fit; modest reach.",
    pitch: {
      to: "The Agenda by Tablet Hotels — editors@tablethotels.com",
      route: "editors@tablethotels.com — RAW-verified 2026-07-13 against Tablet's own submission page (magazine.tablethotels.com/en/2016/08/writing-for-the-agenda: \"Write to editors(at)tablethotels(dot)com and include your story pitches in the form of a title, subtitle, and a paragraph or two\"). Their model is a freelance story submission (they commission and pay ~$400-500 for ~1000 words), so this is shaped as a story idea Per would author, not a press release. Founder sends from gotcosy@gmail.com (per@gotcosy.com), Mon-Wed.",
      subject: "Why small hotels measure warmer",
      body: `Your Independents Day piece made the case that small-batch hotels deserve the attention, low room count and all. I kept coming back to it while scoring 17,727 hotels from their guest reviews.

Across big cities, the hotels guests describe as boutique average 6.30 out of 10 for warmth; their bigger neighbours sit at 6.01. The small independents win the feeling, and the reviews say why.

For The Agenda I could write that up, each claim carrying the guest-review language behind it.

Worth a look?

Per
gotcosy.com

PS. One email only. If it isn't for you, I won't chase.`,
    },
  },
  "ttg-media-17": {
    outlet: "TTG Media",
    actionType: "email",
    priority: 3,
    priorityWhy: "General support@ first, then find the news editor; the 1-in-44 hook works for UK agents.",
    pitch: {
      to: "TTG Media newsdesk / news editor (UK travel trade) — address unverified, see route",
      route: "VERIFY-AT-SEND. TTG Media's route could not be raw-verified. curl https://www.ttgmedia.com/contact-us returns 200 but is a JS-rendered SPA shell (no mailto/address in the DOM); WebFetch on the same URL 404s. Homepage (https://www.ttgmedia.com) is live. AT SEND: open the rendered Contact us page in a browser and grab the current newsdesk/news-editor address (do NOT assume news@ttgmedia.com from memory — it is unverified); if only a general/support inbox is exposed, send there addressed to the news editor by name. Do not send until an address is confirmed on the live page.",
      subject: "Why independents book warmer than chains",
      body: `I run Got Cosy, where we scored 17,727 hotels by reading what guests actually wrote, not their star ratings.

One pattern matters for the agents you write for. Independent hotels average 4.6 out of 10 for warmth; chain-affiliated ones average 3.1, across 367 chains. Character is what guests write warmly about, and standardisation rarely is.

So an agent chasing warmth for a client should lean independent. I can build you a bookable cut: the warmest independents by region, each with the review evidence. Want it?

Per
gotcosy.com`,
    },
  },
  "the-guardian-travel-data-18": {
    outlet: "Guardian Travel/Data",
    actionType: "email",
    priority: 3,
    priorityWhy: "The strongest UK prize plus the corrected rarity hook, but no public inbox.",
    instructions: "Needs Muck Rack or byline-format guesswork to find a named contact first; wave-2 draft.",
  },
  "bbc-travel-6": {
    outlet: "BBC Travel",
    actionType: "email",
    priority: 2,
    priorityWhy: "No public inbox; Muck Rack required; format constraints (titles of 39 characters or fewer).",
  },
  "cond-nast-traveler-traveller-1": {
    outlet: "Conde Nast Traveler",
    actionType: "email",
    priority: 2,
    priorityWhy: "No public inbox; firstname.surname guessing only.",
  },
  "bl-telegraph": {
    outlet: "The Telegraph",
    actionType: "email",
    priority: 2,
    priorityWhy: "The board's own word: aspirational; homepage-only route.",
  },
  "bl-thetimes": {
    outlet: "The Times",
    actionType: "email",
    priority: 2,
    priorityWhy: "Same as the Telegraph: the data study is the only realistic hook, and there is no named route.",
  },
  "the-points-guy-5": {
    outlet: "The Points Guy",
    actionType: "email",
    priority: 2,
    priorityWhy: "No public pitch inbox; the points-bookable-cosy angle needs a custom cut not yet built.",
    pitch: {
      to: "tips@thepointsguy.com",
      route: "email (tips@, verified on their contact page)",
      subject: "Romantic stays your star filter misses",
      body: `Blair and Melissa's romantic-getaways piece opens on the misconception that romance needs a flight. Our data points the same way: the feeling hides where the booking filters don't look.

I run Got Cosy. We scored 17,727 hotels by reading what guests write; the scores barely track star ratings, so our lists surface places the usual filters miss.

For a follow-up or a refresh I can build a cut of the cosiest romantic stays within reach of major US cities, with the guest evidence behind each.

Want a sample city?

Per
gotcosy.com`,
    },
  },
  "lauren-belzer-laurenbelz-com-28": {
    outlet: "Lauren Belzer",
    actionType: "email",
    priority: 2,
    priorityWhy: "Email needs verifying first (the board's own flag); niche blogger.",
    pitch: {
      to: "lauren@laurenbelz.com",
      route: "email (partnerships page, verified)",
      subject: "Solo stays where someone knows your name",
      body: `Your San Diego guide starts with the city feeling like two different places depending on who you're visiting. Hotels split the same way, and guests write it down.

I run Got Cosy. We scored 17,727 hotels by reading guest reviews.

In the cosiest towns in our data, three out of four hotels have guests writing about a person: the owner, someone by name.

If it fits a future guide, I can build you a solo-friendly cut of the cosiest stays for any city you're covering, with the review evidence behind each.

Worth a look?

Per
gotcosy.com`,
    },
  },
  "project-nord-37": {
    outlet: "Project Nord",
    actionType: "email",
    priority: 2,
    priorityWhy: "Verified hello@ but it is a design-shop blog; 17k hotels scored for hygge is a maybe.",
    pitch: {
      to: "Project Nord (Scandinavian design blog, Project Nord ApS, Copenhagen) — contact form; no public email on the live page",
      route: "https://projectnord.com/pages/contact (contact form, raw-verified 2026-07-13) — email route VERIFY-AT-SEND (no public address on live page)",
      subject: "What makes a stay feel calm",
      body: `I'd like to write a short piece for your blog on what actually makes a place feel calm, hooked to your studio-apartment piece on small cosy spaces.

I run Got Cosy. I scored 17,727 hotels by reading what guests wrote about how a stay feels.

The feeling they name most is quiet, in more than a third of the hotels where they describe the atmosphere at all.

I'd bring the review evidence and the full data behind it.

Want it?

Per
gotcosy.com`,
    },
  },
  "slow-travel-repeat-35": {
    outlet: "Slow Travel Repeat",
    actionType: "email",
    priority: 2,
    priorityWhy: "Verified email but the site takes barter and paid collabs; likely wants payment.",
    pitch: {
      to: "Sini Hietaharju, Slow Travel Repeat <sini@slowtravelrepeat.com>",
      route: "sini@slowtravelrepeat.com — raw-verified at https://www.slowtravelrepeat.com/contact (WebFetch 2026-07-13): \"Got a question or a collaboration idea? Send me an email to sini@slowtravelrepeat.com\". Founder/sole editor: Sini Hietaharju. Send from per@gotcosy.com via the gotcosy@gmail.com mailbox; founder sends, Mon-Wed (today Mon 2026-07-13 qualifies). NOTE: board flag on this row is \"takes barter/paid collabs — likely wants payment\"; this is an EDITORIAL pitch offering a story, no payment. If she replies asking for paid/sponsored placement, decline per strategy (sponsored/nofollow = no SEO value; GoNOMAD precedent) — do not pay for coverage.",
      subject: "Small towns outscore the famous capitals",
      body: `You send readers to the lesser-known corners of Spain and Finland, not the postcard capitals. I built a hotel score that landed on the same instinct from a different direction.

I run Got Cosy. We read the guest reviews for 17,727 hotels and scored each for cosiness.

Small towns keep beating the big names for it: Alberobello and San Gimignano score higher than Rome, Paris or Vienna, town for town.

I could build you a ranked cut of the cosiest slow-travel towns, each with the review evidence behind it.

Want it?

Per
gotcosy.com

PS. One email only. If it's not for you, I won't chase.`,
    },
  },
  "mycloud-hospitality-blog-b25": {
    outlet: "mycloud blog",
    actionType: "email",
    priority: 2,
    priorityWhy: "A real trade blog but it demands 1000-plus words plus a link exchange; mid value for the effort.",
    pitch: {
      to: "harvey@mycloudhospitality.co.uk",
      route: "Guest-post submission by email to harvey@mycloudhospitality.co.uk. RAW-verified from the outlet's own write-for-us page: https://www.mycloudhospitality.com/blog/hospitality-technology-write-for-us (address obfuscated on-page as \"harvey {@} mycloudhospitality.co.uk\"; confirmed in raw HTML via curl, not a summarising fetch). Page-stated requirements to honour if commissioned: minimum 1,000 words, non-promotional/informative, exclusive (no republishing elsewhere), 25-50 word author bio, one dofollow backlink to gotcosy.com. This is a guest-post OFFER; the 1,000-word article is written only on a yes.",
      subject: "The score no hotel has beaten",
      body: `I built Got Cosy by reading what guests actually write about hotels, not the star ratings. One number stopped me: across 17,727 hotels, none clears an eight for warmth. The cosiest stay we found stops at 7.8.

For your hoteliers that ceiling is the interesting part: it says warmth is the hardest thing a property earns and the easiest to fake. I'd like to write a piece on what the highest-scoring hotels do that the rest don't, with the review evidence behind each point.

Want it?

Per
gotcosy.com

PS. One email only. If it's not a fit, I won't chase.`,
    },
  },
  "hotelogix-blog-b24": {
    outlet: "Hotelogix blog",
    actionType: "email",
    priority: 2,
    priorityWhy: "Wants 2000-plus words and a DA35-plus reciprocal; high effort for one dofollow bio link.",
    pitch: {
      to: "Sakshi Sharma, Hotelogix guest blog <sakshi.sharma@hotelogix.com>",
      route: "sakshi.sharma@hotelogix.com — RAW-verified 2026-07-13 verbatim on blog.hotelogix.com/hotelogix-guest-blogging-guidelines/ (their stated route: email a topic first, agree outline before writing). Addresses rot: re-verify against the live guidelines page on send morning.",
      subject: "The person in your warmest reviews",
      body: `I run Got Cosy. We scored 17,727 hotels by reading what guests write, 68,269 reviews in. As more travellers pick stays for how a place feels over its stars, one review pattern surfaced that your readers could use.

In the ten cosiest hotel towns, three hotels out of four have guests writing about a person by name: the owner, someone on the desk. In large cities it's closer to one in four. Warmth, in a review, is usually a person.

I'd like to write you a 2,000-word piece: how to read your own reviews for that signal, and what the warmest properties do to earn it.

Worth an outline?

Per
gotcosy.com`,
    },
  },
  "gonomad-travel-b27": {
    outlet: "GoNOMAD",
    actionType: "email",
    priority: 1,
    priorityWhy: "The board note said they are not publishing new stories, but the Challenger confirmed the guidelines DO accept podcast scripts, so the draft below is sendable.",
    pitch: {
      to: "max.gonomad@gmail.com",
      route: "email (Max Hartshorne, Editor; verified gonomad.com/contact-us 2026-07-09 after editorial@ hard-bounced)",
      subject: "Small towns beat the famous capitals",
      body: `Your guidelines ask for a query letter first, one page, podcast scripts over travel stories. So here's the query.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote, and the cosiest hotel towns are places nobody thinks to look: Alberobello and San Gimignano outscore Rome and Paris.

I'd like to script that for the GoNOMAD Travel Podcast: how small towns quietly beat the capitals, told through what guests actually wrote. Methodology's public and free to cite.

Want the full pitch?

Per
gotcosy.com`,
    },
  },

  // ── Verified-email rows the drafting agent upgraded from the form pile ──
  "bl-walesonline": {
    outlet: "WalesOnline",
    actionType: "email",
    priority: 5,
    priorityWhy: "Tenby beats Paris is exactly the regional-data-pride story this outlet runs; the highest hit-probability pitch on the board.",
    instructions: "Send-day condition from the Challenger: confirm the Welsh-beaches headline referenced in the first line is still live on their What's On page, and if rotated, swap in whatever regional-superlative story is up (the construction survives the swap).",
    pitch: {
      to: "kathryn.williams@walesonline.co.uk",
      route: "email (What's On and Lifestyle editor, verified on their contact page)",
      subject: "Tenby's hotels just outscored Paris",
      body: `"Full list of Welsh beaches crowned best in UK" is sitting on your What's On page right now, and it's exactly the kind of story I can hand you for hotels: Tenby's small hotels outscore Paris's.

I read the guest reviews of 17,727 hotels for a project called Got Cosy, scoring each for cosiness. Tenby's qualifying hotels average 6.40 on that score, above Paris and Rome. Cardiff makes the table too.

Caveat up front: that's a mean across 14 hotels, and the table works in tiers rather than strict ranks. I'll send the full Wales cut with the named top-scoring Welsh hotels and the methodology.

Want the list?

Per
gotcosy.com`,
    },
  },
  "bl-sheerluxe": {
    outlet: "SheerLuxe",
    actionType: "email",
    priority: 4,
    priorityWhy: "The boutique-effect pitch (6.30 vs 6.01) plus the exclusive big-city boutique cut fits their hotel edit.",
    pitch: {
      to: "press@sheerluxe.com",
      route: "email (press@, per their contact page) BOUNCED 2026-07-09 NoSuchUser; site lists NO working editorial route; HOLD pending another channel (LinkedIn/contributor)",
      hold: "press@ bounced 2026-07-09; no working route on their site",
      subject: "What makes a boutique hotel feel warm",
      body: `Your June piece on how the SL team would spend a weekend at a luxury hotel is the test I trust: what you'd actually do there, not the room specs. I built a dataset that asks the same question.

I run Got Cosy. We scored 17,727 hotels by reading what guests write.

In big cities, the stays guests call boutique average 6.30 out of 10 for warmth; the big-city average is 6.01. Small scale is what earns the feeling.

For your next hotel edit I can build a ranked cut of the cosiest big-city boutique stays, with the review evidence behind each.

Want it?

Per
gotcosy.com`,
    },
  },
  "bl-greentraveller": {
    outlet: "Green Traveller",
    actionType: "email",
    priority: 4,
    priorityWhy: "Independents beat chains (4.6 vs 3.1, 367 chains) is their founding premise with numbers; verified personal email.",
    pitch: {
      to: "richard@greentraveller.co.uk",
      route: "email (Richard Hammond; verified on their contact page)",
      subject: "Independent hotels and what guests remember",
      body: `I'd like to offer Green Traveller a number I think you'll want on record: independent hotels average 4.6 out of 10 for warmth in guest reviews; chains average 3.1.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote.

If it's useful I'll build you the highest-scoring independent stays with the guest evidence behind each, and I'm happy to go on the record. Methodology and limitations are public.

Worth a look?

Per
gotcosy.com

PS. One email only. If this isn't for you, I won't chase.`,
    },
  },
  "bl-homesantiques": {
    outlet: "Homes & Antiques",
    actionType: "email",
    priority: 4,
    priorityWhy: "The fireplace tell (roughly 8.5x more common in 7.0-plus hotels) plus the interiors-signal cut offer; verified editorial email.",
    pitch: {
      to: "homesandantiques@ourmedia.co.uk",
      route: "email (editorial address on their contact page)",
      subject: "The fireplace tell in hotel reviews",
      body: `Jenny Oldaker's January piece on boutique hotels has a line I kept: "architectural touches of old rub shoulders with thoroughly modern luxuries". Our data has a name for what those touches do to guests.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote.

Guests rarely mention a fireplace, yet it's roughly 8.5 times more common in hotels that score genuinely cosy (7.0 and up) than in the rest.

I can build you an interiors-signal cut: fireplaces, courtyards, and the towns where they cluster, with the guest evidence behind each.

Interested?

Per
gotcosy.com

PS. One email, no follow-ups from me.`,
    },
  },
  "time-out-cozy-hotels-b31": {
    outlet: "Time Out cozy page",
    actionType: "email",
    priority: 3,
    priorityWhy: "Bespoke per-city-cuts offer for their cozy-hotel refreshes; the board flags this as hard, so expect silence, but it costs little to try.",
    pitch: {
      to: "hello-us@timeout.com",
      route: "email (US editorial mailto, verified on their contact page)",
      subject: "A different kind of cozy hotel list",
      body: `Alex Sims' Chicago guide praises The Guesthouse for "cozy touches like wood salvaged from a Wisconsin barn". That's exactly the kind of detail our whole dataset is built to catch.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote in reviews; the scores barely track star ratings, so our per-city lists come out different from everyone else's.

Time Out works city by city, and so do we. I can send per-city cosiest-hotel cuts for any cozy-hotel page refresh, free to cite, no link needed.

Want a sample city?

Per
gotcosy.com`,
    },
  },

  // ── FORM (contact or submission form) ──
  "ehotelier-16": {
    outlet: "eHotelier",
    actionType: "form",
    priority: 5,
    priorityWhy: "Open contributor model means near-guaranteed placement of the Lane-4 byline article in front of 200k-plus hospitality pros.",
    instructions: "Go to insights.ehotelier.com/submit-an-article and submit the Lane-4 piece (How big-city hotels earn cosiness without beams and fireplaces; 6.30 vs 6.01; link /en/make-your-hotel-look-cosy) as a full Insights article. Placement is effectively self-serve.",
  },
  "hospitality-net-11": {
    outlet: "Hospitality Net",
    actionType: "form",
    priority: 4,
    priorityWhy: "Self-serve publishing means guaranteed global hotelier placement of the Lane-4 asset; one submission also covers the Hospitality Net syndicate row.",
    instructions: "Use the press-release and article flow at help.hospitalitynet.org and publish the Lane-4 asset directly. Do this ONCE; it also satisfies the Hospitality Net (release) row.",
  },
  "the-pudding-19": {
    outlet: "The Pudding",
    actionType: "form",
    priority: 4,
    priorityWhy: "Their pitch form is reviewed monthly; per the Challenger, the visual-essay premise is a genuine fit.",
    instructions: "Submit via the pudding.cool/pitch form. Pitch what actually makes a hotel cosy as the visual-essay premise: signal lifts, the host gap and the score histogram as raw material, with r=0.10 as one beat, not the headline.",
    pitch: {
      to: null,
      route: "pitch form at pudding.cool/pitch (reviewed monthly; paste, no email)",
      subject: "The cosiest hotels come with a person",
      body: `What makes a hotel cosy turns out to be a person, and the data draws beautifully. In the cosiest towns in our scoring, three out of four hotels have guests writing about the owner or a host, often by name; in the big cities it's one in four.

I run Got Cosy, a small hotel-discovery site. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

For a visual essay I can hand over everything raw: the host gap by town, plus the full score histogram and the signal data behind it.

Interested?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "bl-shuttersunflowers": {
    outlet: "Shutters & Sunflowers",
    actionType: "form",
    priority: 3,
    priorityWhy: "Provence-specific pitch (Avignon, Aix) with a shared-byline offer; genuinely Provence-only blog.",
    instructions: "Paste the pitch into the contact form at shuttersandsunflowers.com/contact (no public email; the form is verified on the page).",
    pitch: {
      to: null,
      route: "contact form at https://shuttersandsunflowers.com/contact/",
      subject: "Provence, according to hotel guests",
      body: `An English girl in California, in love with Provence: your own tagline. Lourmarin runs right through the blog, and your Uzès and St-Rémy restaurant lists read like notes to a friend. Our data just paid your patch a compliment.

I read the guest reviews of 17,727 hotels for a project called Got Cosy, scoring each for cosiness. Avignon sits in our global top tier at 6.64, and Aix-en-Provence qualifies too. Provence holds its own against every capital in Europe.

I'd love to build a Provence cosy-stays piece with you: our picks and the guest evidence behind each, your Provence on top, shared byline.

Worth exploring?

Per
gotcosy.com`,
    },
  },
  "skift-9": {
    outlet: "Skift",
    actionType: "form",
    priority: 3,
    priorityWhy: "No unsolicited pitches; the tip form or a Muck Rack contact is the only way in. Wave-2 draft.",
    instructions: "Use the confidential tip form at skift.com/share-a-confidential-tip-with-skift with the stars-vs-cosiness finding in trade framing (their note calls it the sweet spot), or find the hospitality reporter on Muck Rack.",
    pitch: {
      to: null,
      route: "confidential tip form at skift.com/share-a-confidential-tip-with-skift (or a Muck Rack contact)",
      subject: "Star ratings barely track guest warmth",
      body: `Hotel star ratings barely track how warm a stay feels to guests. Across 7,048 hotels, the correlation between our cosiness score and star rating is r=0.10, close to zero.

I run Got Cosy, a small hotel-discovery site. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

For the industry that's a measurement gap: the main quality label misses the quality guests describe most vividly. Methodology and free CSVs are public, and I'll share the full file with a reporter.

Want it?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
      hold: "wave-2: send only after the r=0.10 methodology page is live",
    },
  },
  "fodor-s-travel-4": {
    outlet: "Fodor's",
    actionType: "form",
    priority: 3,
    priorityWhy: "A Google Form route exists; Lane-3 towns-beat-capitals is a clean one-finding pitch.",
    instructions: "Use the Google Form linked from fodors.com/about-us. Paste a Lane-3 pitch: towns beat capitals only (one finding) and offer the towns cut.",
    pitch: {
      to: null,
      route: "Google Form linked from fodors.com/about-us (paste, no email)",
      subject: "Small towns beat the famous capitals",
      body: `Small towns beat the famous capitals for cosiness, and guest reviews prove it.

I run Got Cosy, a small hotel-discovery site. We scored 17,727 hotels by reading what guests wrote against a fixed rubric. Alberobello averages 6.75 out of 10 for warmth and San Gimignano 6.72; Rome comes in at 6.05 and Paris at 6.00.

For Fodor's I can build a towns-beat-capitals cut: the ranked towns, the hotels that earn it, and what guests actually wrote about them. Free to cite, methodology public at gotcosy.com/en/cosy-index.

Interested? I'll send the full table.

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "sleeper-magazine-15": {
    outlet: "Sleeper",
    actionType: "form",
    priority: 3,
    priorityWhy: "Editorial form route; the Lane-2 host story with design framing fits the title.",
    instructions: "Editorial form at sleepermagazine.com/contact; pitch the Lane-2 host story with design framing.",
    pitch: {
      to: null,
      route: "editorial form at sleepermagazine.com/contact",
      subject: "The owner is the design brief",
      body: `In the cosiest hotel towns in our data, three out of four hotels have guests writing about a person: the owner, a host, often by name. In the big cities it's one in four.

I run Got Cosy, a small hotel-discovery site. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

For Sleeper that's a design brief: what does a building have to do so the owner can be the experience? I can shape that host story with the guest evidence behind it.

Interested?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "hotel-designs-25": {
    outlet: "Hotel Designs",
    actionType: "form",
    priority: 3,
    priorityWhy: "Its own note suggests the 17,727-hotels-scored framing; a Lane-4 pitch fits.",
    instructions: "Use hoteldesigns.net/contact-us; Lane-4 pitch with the 17,727 hotels scored, what the data reveals framing from its note.",
    pitch: {
      to: null,
      route: "contact form at hoteldesigns.net/contact-us",
      subject: "Guests praise quiet above decor",
      body: `Among 9,437 hotel reviews that mention atmosphere, the most common theme is quiet, at 35.6%. Not decor, not fireplaces: quiet.

I run Got Cosy. We scored 17,727 hotels for cosiness by reading what guests wrote against a fixed rubric.

For Hotel Designs I can turn the dataset into a practical piece: what the scoring reveals about designing for the atmosphere guests actually praise, with the review evidence behind it. Free to cite, methodology public.

Interested?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "hotel-news-resource-13": {
    outlet: "Hotel News Resource",
    actionType: "form",
    priority: 3,
    priorityWhy: "Self-serve content submission; syndication of a Lane-4 or data-study summary as industry news.",
    instructions: "Self-serve: hotelnewsresource.com/Info-net_add_content.html; syndicate a Lane-4 or data-study summary as industry news.",
  },
  "hospitality-net-hsyndicate-b23": {
    outlet: "Hospitality Net (release)",
    actionType: "form",
    priority: 3,
    priorityWhy: "Same pipe as the Hospitality Net row; covered by that one submission.",
    instructions: "Covered by the Hospitality Net submission above. Only do separately if publishing a second piece (a Lane-2 release vs the Lane-4 article).",
  },
  "visual-capitalist-20": {
    outlet: "Visual Capitalist",
    actionType: "form",
    priority: 3,
    priorityWhy: "Creator Programme route; the cosiness-vs-stars and independents-vs-chains data works as infographic material.",
    instructions: "Creator Programme: visualcapitalist.com/creator-hub/submit; offer the cosiness-vs-stars and independents-vs-chains data as infographic material.",
    pitch: {
      to: null,
      route: "Creator Programme form at visualcapitalist.com/creator-hub/submit",
      subject: "Stars and cosiness barely correlate",
      body: `Here's a relationship your readers would expect to be strong and isn't: hotel star ratings barely track how cosy guests find a stay. Across 7,048 hotels the correlation is r=0.10.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric, and the data is free to use.

Through the Creator Programme I'd like to offer the cosiness-versus-stars dataset as infographic material, raw file included, with an independents-versus-chains cut alongside if useful.

Interested?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "condor-ferries-travel-statistics-b21": {
    outlet: "Condor Ferries stats",
    actionType: "form",
    priority: 3,
    priorityWhy: "A classic link magnet: their 100-plus-statistics round-up hyperlinks sources.",
    instructions: "Via condorferries.co.uk/contact-us: pitch adding our cosiness stats (with links) to their statistics round-up.",
    pitch: {
      to: null,
      route: "contact form at condorferries.co.uk/contact-us",
      subject: "Genuinely cosy hotels are rare",
      body: `A statistic for your travel statistics round-up: only 1 in 44 hotels scores genuinely cosy, 7.0 or higher on a 0-10 scale.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric, and we publish the data as free CSVs.

If a cosiness entry fits the page, I'll send a short set of citable stats with source links, formatted to drop straight in.

Want them?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "siteminder-hotel-industry-statistics-b20": {
    outlet: "SiteMinder stats guide",
    actionType: "form",
    priority: 3,
    priorityWhy: "No public email; inclusion in the stats guide with attribution is the ask.",
    instructions: "Pitch the content or PR team via the site contact; ask for inclusion in the stats guide with attribution, citing the free CSVs.",
    pitch: {
      to: null,
      route: "site contact form, addressed to the content or PR team",
      subject: "Quiet tops the atmosphere themes",
      body: `One for the statistics guide: among hotel reviews that mention atmosphere, quiet is the single most common theme, 35.6% of 9,437 reviews.

I run Got Cosy. We scored 17,727 hotels for cosiness by reading what guests wrote against a fixed rubric. The data ships as free CSVs, methodology public.

I'd be glad to see the stat included with attribution to Got Cosy, and I'll send the exact lines and source links if that helps.

Shall I?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "bl-thehotelguru": {
    outlet: "The Hotel Guru",
    actionType: "form",
    priority: 3,
    priorityWhy: "A citation ask, not a story pitch: be cited or listed as a cosiness data source.",
    instructions: "Site contact; ask to be cited or listed as a cosiness data source.",
    pitch: {
      to: null,
      route: "site contact form",
      subject: "A cosiness data source, free to cite",
      body: `An ask rather than a story pitch: would you cite Got Cosy as a cosiness data source?

We scored 17,727 hotels by reading what guests wrote against a fixed rubric. The score barely tracks star ratings (r=0.10 across 7,048 hotels), so it catches a quality star ratings and price bands can't see.

Methodology and free CSVs are at gotcosy.com/en/data/cosiest-hotel-towns; anything there is free to use with attribution.

Worth a look?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "journohq-best-ai-travel-tools-2026-b28": {
    outlet: "JournoHQ roundup",
    actionType: "form",
    priority: 3,
    priorityWhy: "Inclusion ask for Best AI Travel Tools 2026 as the cosiness-scoring layer alongside Layla, Mindtrip and Wanderlog.",
    instructions: "Contact via the About page or media kit; ask for inclusion in Best AI Travel Tools 2026 as the cosiness-scoring layer.",
    pitch: {
      to: null,
      route: "contact via the About page or media kit",
      subject: "The cosiness-scoring layer for your list",
      body: `I'd like to put Got Cosy forward for Best AI Travel Tools 2026, as the cosiness-scoring layer alongside the planners.

Our AI reads guest reviews and scores hotels for cosiness; 17,727 scored so far against a fixed rubric. The honesty tell: nothing scores an 8 out of 10. The ceiling is 7.8 and the limitations are published.

It's free to use with no signup, and the methodology is public.

Would you consider it?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "the-aficionados-27": {
    outlet: "The Aficionados",
    actionType: "form",
    priority: 3,
    priorityWhy: "Anti-chain design site; the Cosy Score works as a data layer on their curation.",
    instructions: "Via theaficionados.com/contact: offer the Cosy Score as a data layer on their curation.",
    pitch: {
      to: null,
      route: "contact form at theaficionados.com/contact",
      subject: "Data that agrees with your curation",
      body: `Your site argues against the chains, and our data agrees with numbers attached. Owner-run hotels average 4.6 out of 10 for cosiness in our scoring; chains average 3.1, across 367 chain properties.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

I'd like to offer the Cosy Score as a data layer on your curation: your eye, backed by scored review evidence for every property. Methodology is public.

Worth exploring?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "travlinmad-36": {
    outlet: "Travlinmad",
    actionType: "skip",
    priority: 3,
    priorityWhy: "Challenger ruling: Lori is already rank 7 in the writer data-brief campaign with a stronger, verified touch. One send per target; her contact happens through that campaign only, never both.",
  },
  "coastal-hygge-33": {
    outlet: "Coastal Hygge",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small niche blog; Lane-3 one-finding pitch.",
    instructions: "Contact form; Lane-3 one-finding pitch.",
    pitch: {
      to: null,
      route: "site contact form",
      subject: "The cosiest towns aren't the famous ones",
      body: `The cosiest hotel towns in our data aren't the famous ones. Alberobello averages 6.75 out of 10 for warmth and San Gimignano 6.72, while Rome sits at 6.05 and Paris at 6.00.

I run Got Cosy, a small hotel-discovery site. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

If it suits the blog, I can build a small-towns piece for your readers with the guest evidence behind each pick.

Worth a look?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "kelly-s-cosy-life-31": {
    outlet: "Kelly's Cosy Life",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small lifestyle blogger; Lane-3 pitch.",
    instructions: "Contact page; Lane-3 pitch.",
    pitch: {
      to: null,
      route: "site contact page",
      subject: "Small towns beat the great capitals",
      body: `Guest reviews say small towns beat the great capitals for cosiness, and not by a little. In our scoring Alberobello averages 6.75 out of 10 and San Gimignano 6.72; Rome manages 6.05, Paris 6.00.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

If you'd like material for a cosy-travel post, I'll send the ranked towns and what guests actually wrote about the winners.

Want the list?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "her-happy-habitat-34": {
    outlet: "Her Happy Habitat",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small blog; Lane-4 bring-it-home framing.",
    instructions: "Contact form; Lane-4 bring-it-home framing.",
    pitch: {
      to: null,
      route: "site contact form",
      subject: "The cosiest hotels earn it with quiet",
      body: `Among 9,437 hotel reviews that mention atmosphere, the most common theme isn't decor. It's quiet, at 35.6%.

I run Got Cosy. We scored 17,727 hotels for cosiness by reading what guests wrote against a fixed rubric.

The bring-it-home angle: the places guests call cosiest earn it with things a home can copy, and quiet tops that list. Happy to share what the reviews say if it fits a post.

Interested?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "roam-and-reside-29": {
    outlet: "Roam and Reside",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small blog, but the owner is an interior designer; Lane-4 visual-signals angle.",
    instructions: "Contact form; Lane-4 visual-signals angle.",
    pitch: {
      to: null,
      route: "site contact form",
      subject: "Warmth isn't the plaque by the door",
      body: `How warm a hotel feels barely tracks its star rating: across 7,048 hotels the correlation with our cosiness score is r=0.10. Whatever earns the feeling, it isn't the plaque by the door.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

Since you design interiors, I think the visual side of the data would interest you: the signals guests describe when a room feels warm. Happy to share the file for a post.

Worth a look?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "lighthouse-travel-trends-blog-b22": {
    outlet: "Lighthouse trends blog",
    actionType: "form",
    priority: 2,
    priorityWhy: "No public email; medium-hard route for a modest gain.",
    instructions: "Pitch the content team via the site contact.",
    pitch: {
      to: null,
      route: "site contact form, addressed to the content team",
      subject: "Genuine cosiness is genuinely scarce",
      body: `Only 1 in 44 hotels scores genuinely cosy: 7.0 or better on our 0-10 scale.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric, with methodology and free CSVs published.

For the trends blog that's a supply story: the quality guests praise most warmly is genuinely scarce, and the data shows where it clusters. I'll send the summary and the file if useful.

Want it?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "locals-insider-best-ai-travel-tools-b29": {
    outlet: "LOCALS Insider",
    actionType: "form",
    priority: 2,
    priorityWhy: "Contact route unconfirmed (the board's flag).",
    instructions: "Confirm the contact route first, then send a short inclusion ask.",
    pitch: {
      to: null,
      route: "contact route unconfirmed (the board's flag); confirm before sending",
      subject: "An honest AI for cosy stays",
      body: `A candidate for your AI travel tools list: Got Cosy, an AI that scores hotels for cosiness by reading guest reviews.

It has scored 17,727 hotels against a fixed rubric, and the grading is honest enough that nothing reaches 8 out of 10; the ceiling is 7.8, limitations published.

It does the one job the trip planners don't: telling you how warm a stay actually feels. Free, with no signup.

Would you include it?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
      hold: "confirm the contact route before sending",
    },
  },
  "nomads-world-b26": {
    outlet: "Nomads World",
    actionType: "form",
    priority: 2,
    priorityWhy: "The write-for-us flow demands an exclusive guest post; high effort for one placement.",
    instructions: "Write-for-us flow; only worth it if an exclusive guest post is acceptable.",
  },
  "bl-rachelkhoo": {
    outlet: "Rachel Khoo",
    actionType: "form",
    priority: 1,
    priorityWhy: "The board's own call: a long shot. Only the generic Lane-5 credential fits.",
    instructions: "Send one short note via the site contact and expect nothing.",
    pitch: {
      to: null,
      route: "site contact form",
      subject: "Cosy hotel data, in case it's useful",
      body: `A short note in case it's ever useful. I run Got Cosy, where we scored 17,727 hotels for cosiness by reading what guests wrote against a fixed rubric.

The finding I'd offer: how warm a stay feels barely tracks star ratings (r=0.10 across 7,048 hotels), so the two measure quite different things.

If a cosy-stays angle ever fits one of your projects, the data and methodology are free to use.

Useful?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "bl-secornwall": {
    outlet: "Enjoying SE Cornwall",
    actionType: "form",
    priority: 1,
    priorityWhy: "Honest: we have no Cornwall cut and the lane story has no local hook. Weak fit, bottom of the pile.",
    instructions: "Site contact, only if everything else is exhausted.",
    pitch: {
      to: null,
      route: "site contact form",
      subject: "Quiet is what guests praise most",
      body: `Among hotel reviews that mention atmosphere, quiet is the single most common theme: 35.6% of 9,437 reviews in our data.

I run Got Cosy. We scored 17,727 hotels for cosiness by reading what guests wrote against a fixed rubric.

Honestly: I don't have a Cornwall cut yet. But quiet is your patch's whole argument, so if a quiet-stays angle ever fits a post, I'll gladly share what the data says.

Worth a look?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "how-to-hygge-the-british-way-32": {
    outlet: "How to Hygge the British Way",
    actionType: "form",
    priority: 1,
    priorityWhy: "No contact page; blog comments or the Facebook group only. The route is too weak to prioritise.",
    instructions: "Blog comments or the Facebook group only.",
    pitch: {
      to: null,
      route: "blog comments or the Facebook group only (no contact page)",
      subject: "Hygge in a hotel is a person",
      body: `Hygge in a hotel turns out to be a person, not a look. In the cosiest towns in our data, three out of four hotels have guests writing about the owner or a host, often by name; in the big cities it's one in four.

I run Got Cosy. We scored 17,727 hotels by reading what guests wrote against a fixed rubric.

If that fits a hygge post, I'll share the data and what guests actually wrote.

Interested?

Per Winroth, founder, Got Cosy (gotcosy.com)`,
    },
  },
  "bl-byway": {
    outlet: "Byway",
    actionType: "form",
    priority: 4,
    priorityWhy: "Would be priority 4: the co-creation offer (Antwerp, Avignon, shaped around Byway's routes) is strong, but it depends on the train post being live.",
    instructions: "The day the train post ships: contact via byway.travel/about/press with the co-creation offer and add it to the draft queue. Re-verify the journal reference the day the hold lifts.",
    pitch: {
      to: null,
      route: "press page at https://www.byway.travel/about/press",
      subject: "Cosy stays you can reach by rail",
      body: `Byway built the booking flow for people who'd rather take the train, and your journal keeps making the case that the journey is the holiday. Our review data backs the stays end of that argument.

I run Got Cosy. We scored 17,727 hotels by reading guest reviews, and two of our top-tier cosy towns, Antwerp and Avignon, are easy rail stops. We've written a cosy-stays-by-train round-up, and I'd rather shape it around Byway's actual routes than guess at them.

Co-create it with us? Your routes, our scores, both names on it.

Per
gotcosy.com`,
      hold: "Train post not live yet",
    },
  },

  // ── REGISTER (platform signup, then inbound queries; see the register playbook) ──
  "qwoted-40": {
    outlet: "Qwoted",
    actionType: "register",
    priority: 4,
    priorityWhy: "Highest reported conversion of the free expert platforms; a 15-minute signup starts the inbound flywheel.",
    instructions: "Free plan at qwoted.com/for-pr-marketing-pros; register in the travel and data verticals. Do this one first.",
  },
  "haro-help-a-reporter-out-38": {
    outlet: "HARO",
    actionType: "register",
    priority: 4,
    priorityWhy: "Status is already contacted; the three-times-daily digest is a steady inbound source.",
    instructions: "Confirm the account works, then run the reply routine on the digest.",
  },
  "source-of-sources-sos-41": {
    outlet: "Source of Sources",
    actionType: "register",
    priority: 4,
    priorityWhy: "Status is already contacted; SOS has the highest dofollow rate (about 36 percent).",
    instructions: "Confirm the account works; keep replies strictly on topic.",
  },
  "featured-formerly-terkel-39": {
    outlet: "Featured",
    actionType: "register",
    priority: 3,
    priorityWhy: "Mentions and backlinks via 2,500-plus media partners.",
    instructions: "Sign up at featured.com/experts and answer travel and hotel questions.",
  },
  "mentionmatch-ex-help-a-b2b-writer-b37": {
    outlet: "MentionMatch",
    actionType: "register",
    priority: 3,
    priorityWhy: "Skews B2B and SaaS, so the AI-dataset angle leads, not consumer travel.",
    instructions: "Sign up as a Source; lead with the AI-dataset angle.",
  },
  "sourcebottle-42": {
    outlet: "SourceBottle",
    actionType: "register",
    priority: 3,
    priorityWhy: "Free to respond; covers the US, UK, AU, CA and NZ.",
    instructions: "Subscribe to the travel and hospitality callouts.",
  },
  "journofinder-journo-request-alerts-b39": {
    outlet: "JournoFinder",
    actionType: "register",
    priority: 3,
    priorityWhy: "Free tier gives keyword alerts with replies via the public feed.",
    instructions: "Set up to three keyword alerts: hotel, travel, cosy. Reply via the public feed.",
  },
  "pitchrate-b38": {
    outlet: "PitchRate",
    actionType: "register",
    priority: 3,
    priorityWhy: "An older platform with lower traffic; set and forget.",
    instructions: "Free signup; queries arrive by email.",
  },

  // ── HASHTAG (monitoring; see the hashtag playbook) ──
  "journorequest-x-twitter-46": {
    outlet: "#JournoRequest (X)",
    actionType: "hashtag",
    priority: 4,
    priorityWhy: "Very active among UK travel journalists; no signup needed. The highest-value tag.",
    instructions: "Run the weekly routine on this tag first.",
  },
  "prrequest-x-bluesky-linkedin-b40": {
    outlet: "#PRRequest (X/Bluesky/LinkedIn)",
    actionType: "hashtag",
    priority: 4,
    priorityWhy: "About 28 requests a day, UK-heavy lifestyle and travel.",
    instructions: "Same routine, second tab.",
  },
  "bloggerswanted-bloggerrequest-b41": {
    outlet: "#bloggerswanted / #bloggerrequest",
    actionType: "hashtag",
    priority: 3,
    priorityWhy: "Blogger skew: more brand mention than expert quote.",
    instructions: "Fold into the same 10-minute scan.",
  },

  // ── COMMUNITY-POST (see the community playbook; all ride the Lane-6 story) ──
  "hacker-news-show-hn-b13": {
    outlet: "Show HN",
    actionType: "community-post",
    priority: 5,
    priorityWhy: "The tool qualifies (no signup); HN threads get scraped and cited by AI engines. The biggest single AI-visibility swing on the board. High variance.",
    instructions: "Title: Show HN: Got Cosy: I scored 17,727 hotels by reading their reviews; nothing scores an 8. URL in the URL field; the backstory (rubric, max 7.8, limitations page) in the first comment; never ask for upvotes.",
  },
  "indie-hackers-b14": {
    outlet: "Indie Hackers",
    actionType: "community-post",
    priority: 4,
    priorityWhy: "The dataset origin story fits the milestone format.",
    instructions: "Product page plus a milestone post: the dataset origin story, not a link drop.",
  },
  "r-sideproject-b15": {
    outlet: "r/SideProject",
    actionType: "community-post",
    priority: 3,
    priorityWhy: "The most self-promo-friendly sub; a good rehearsal before Show HN.",
    instructions: "Post the story plus a genuine feedback ask.",
  },
  "r-internetisbeautiful-b16": {
    outlet: "r/InternetIsBeautiful",
    actionType: "community-post",
    priority: 3,
    priorityWhy: "Qualifies (no signup required), but the mods are strict.",
    instructions: "Read the sidebar first; frame as a fun, unique web tool.",
  },
  "r-travel-r-solotravel-b17": {
    outlet: "r/travel + r/solotravel",
    actionType: "community-post",
    priority: 2,
    priorityWhy: "No link posts allowed; a slow burn, do after the others.",
    instructions: "Answer hotel questions genuinely over weeks; weekly promo threads only.",
  },
  "quora-spaces-b18": {
    outlet: "Quora Spaces",
    actionType: "community-post",
    priority: 2,
    priorityWhy: "Slow burn, nofollow.",
    instructions: "Helpful answers with disclosure only.",
  },

  // ── PODCAST-PITCH ──
  "the-bootstrapped-founder-arvid-kahl-b33": {
    outlet: "The Bootstrapped Founder",
    actionType: "podcast-pitch",
    priority: 5,
    priorityWhy: "Verified host email; the Lane-6 build story is precisely his format (solo founder building an AI data product in public).",
    pitch: {
      to: "arvid@thebootstrappedfounder.com",
      route: "email (verified mailto on their podcast page)",
      subject: "Grading hotels honestly as a solo founder",
      body: `In March you asked: if building software keeps getting easier, what exactly are we building our businesses on? Mine is built on the answer you gave: data.

I bootstrapped Got Cosy, where AI reads the guest reviews of 17,727 hotels against a fixed rubric. Nothing clears an 8 out of 10, and publishing that ceiling turned out to be the product's credibility.

Solo founder, real dataset, no growth claims. Happy to unpack the rubric design and why honest grading sells.

Worth a slot?

Per
gotcosy.com`,
    },
  },
  "hospitality-daily-podcast-b32": {
    outlet: "Hospitality Daily",
    actionType: "podcast-pitch",
    priority: 4,
    priorityWhy: "The number-one hotel-industry show, and the form invites guest suggestions; the Lane-2 host and owner finding is made for hoteliers.",
    instructions: "Paste the pitch into the guest-suggestion form at podcast.hospitalitydaily.com/contact.",
    pitch: {
      to: null,
      route: "guest-suggestion form at https://podcast.hospitalitydaily.com/contact/",
      subject: "Guests remember the owner, not the lobby",
      body: `Josiah, your Aethos series with Lily Wecker kept circling hospitality as a feeling you deliver, and my data puts a name on that feeling. I read the guest reviews of 17,727 hotels for Got Cosy, and in the ten cosiest towns three out of four hotels have guests writing about the owner or a host, often by name; in the big cities it's one in four. Nobody writes home about the lobby. I'd love to come on and tell that host-gap story properly, with the scoring open on the table. Want the one-pager?

Per
gotcosy.com`,
    },
  },
  "no-vacancy-live-glenn-haussman-b34": {
    outlet: "No Vacancy Live",
    actionType: "podcast-pitch",
    priority: 3,
    priorityWhy: "Cosiness-as-differentiator (Lane 2) fits the show.",
    instructions: "Contact via novacancynews.com or DM @TravelingGlenn.",
  },
  "travel-tech-insider-b36": {
    outlet: "Travel Tech Insider",
    actionType: "podcast-pitch",
    priority: 3,
    priorityWhy: "Lane 6 with an investor and operator slant.",
    instructions: "pitch returned to drafting: the drafted pitch was incomplete and failed Challenger review (truncated with no subject, body, or finding, so it could not be audited or sent); a completed redraft must go back through the Challenger before a pitch is placed here. Contact route unchanged: reach out via the Buzzsprout page or LinkedIn, raw-verifying the address at send.",
  },
  "travel-trends-podcast-dan-christian-b35": {
    outlet: "Travel Trends",
    actionType: "podcast-pitch",
    priority: 3,
    priorityWhy: "Exec-level guests make a harder bar; the Lane-6 data-trend framing is the way in.",
    instructions: "Paste the pitch into the contact form at traveltrendspodcast.com/contact.",
    pitch: {
      to: null,
      route: "contact form at https://www.traveltrendspodcast.com/contact",
      subject: "Why no hotel earns a perfect score",
      body: `Dan, Season 7 has you charting where travel is heading, and here's a supply-side data point most rankings are built to hide. I built Got Cosy, where AI reads the guest reviews of 17,727 hotels against a fixed rubric, and after all that scoring not one hotel clears 8 out of 10. Grade honestly and perfection disappears, which says something uncomfortable about how most travel scores get made. Happy to bring the whole build story on as a guest. Interested?

Per
gotcosy.com`,
    },
  },

  // ── DIRECTORY-SUBMIT (see the directory playbook; batch in one afternoon) ──
  "uneed-b4": {
    outlet: "Uneed",
    actionType: "directory-submit",
    priority: 4,
    priorityWhy: "Free, DR about 74, and it advertises a real dofollow backlink; the best value of the set.",
    instructions: "Submit at uneed.best/submit-a-tool.",
  },
  "aixploria-travel-b10": {
    outlet: "AIxploria",
    actionType: "directory-submit",
    priority: 4,
    priorityWhy: "Usually dofollow; the easiest win.",
    instructions: "Use the submit form on the travel category page.",
  },
  "saashub-b3": {
    outlet: "SaaSHub",
    actionType: "directory-submit",
    priority: 3,
    priorityWhy: "Free, DR about 74, one-to-two-day approval, nofollow.",
    instructions: "Submit at saashub.com/services/submit.",
  },
  "tinylaunch-b6": {
    outlet: "TinyLaunch",
    actionType: "directory-submit",
    priority: 3,
    priorityWhy: "Free dofollow if the badge is embedded.",
    instructions: "Decide: badge in the gotcosy.com footer, or skip the badge and take nofollow.",
  },
  "fazier-b5": {
    outlet: "Fazier",
    actionType: "directory-submit",
    priority: 3,
    priorityWhy: "Dofollow via badge embed; the same badge decision as TinyLaunch.",
    instructions: "Submit at fazier.com/submit.",
  },
  "alternativeto-b2": {
    outlet: "AlternativeTo",
    actionType: "directory-submit",
    priority: 3,
    priorityWhy: "New accounts wait a week, so the account should exist before it is needed.",
    instructions: "Create the account NOW (one-week wait for new accounts), then suggest Got Cosy as an alternative to Booking and other hotel finders.",
  },
  "startup-stash-b8": {
    outlet: "Startup Stash",
    actionType: "directory-submit",
    priority: 3,
    priorityWhy: "Curated, DR about 68, an evergreen backlink; worth the selectivity risk.",
    instructions: "Submit at startupstash.com/add-listing.",
  },
  "product-hunt-b0": {
    outlet: "Product Hunt",
    actionType: "directory-submit",
    priority: 3,
    priorityWhy: "High effort; schedule as its own day, ideally after the Show HN learnings.",
    instructions: "Prep the gallery and the first-comment story (Lane 6); launch Tuesday to Thursday at 12:01am PST.",
  },
  "betalist-b1": {
    outlet: "BetaList",
    actionType: "directory-submit",
    priority: 2,
    priorityWhy: "Free means a two-to-four-month queue; the paid skip is not worth it.",
    instructions: "Submit now and forget (skip the 129-dollar fast lane).",
  },
  "startupbase-b12": {
    outlet: "StartupBase",
    actionType: "directory-submit",
    priority: 2,
    priorityWhy: "Free and open, but the submit page hides behind a login (verified 2026-07-10), which reads as closed if you land on it logged out.",
    instructions: "Sign in at startupbase.io first (Google as gotcosy@gmail.com), then startupbase.io/submit opens the form.",
  },
  "peerlist-launchpad-b7": {
    outlet: "Peerlist",
    actionType: "directory-submit",
    priority: 2,
    priorityWhy: "Engaged audience, but nofollow and it needs a personal profile plus a Monday launch slot.",
    instructions: "Create a personal profile, then take a Monday launch slot.",
  },
  "toolify-ai-b9": {
    outlet: "Toolify.ai",
    actionType: "skip",
    priority: 2,
    priorityWhy: "The free tier is gone (checked the live submit page 2026-07-10): 99 dollars one-time is now the only route, and their audience is AI builders rather than travellers.",
  },
  "there-s-an-ai-for-that-b11": {
    outlet: "There's An AI For That",
    actionType: "directory-submit",
    priority: 2,
    priorityWhy: "The paid submit costs roughly 347 dollars; the free route is a monthly thread.",
    instructions: "Skip the paid submit; catch the monthly free-submission thread on their X account instead.",
  },

  // ── SKIP ──
  "bl-takemeanywhere": {
    outlet: "Take Me Anywhere",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Proposed silence confirmed by the Challenger; no honest angle survives. Revisit only after reading their recent posts.",
  },
  "bl-tripulous": {
    outlet: "Tripulous",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Same as Take Me Anywhere: the generic round-up ask fails the anyone-else test.",
  },
  "journolink-44": {
    outlet: "JournoLink",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Paid PR access; the board recommends skipping. The free platforms cover the same inbound lane.",
  },
  "profnet-pr-newswire-45": {
    outlet: "ProfNet",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Paid Cision subscription; the board recommends skipping.",
  },
  "responsesource-43": {
    outlet: "ResponseSource",
    actionType: "skip",
    priority: 1,
    priorityWhy: "About 625 pounds per year per topic; skip. Optional later: the one-week free trial as a burst when a UK story is live.",
  },
  "bl-yourfrenchstay": {
    outlet: "Your French Stay",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Challenger KILL (demoted to skip): the site is one adults-only Dordogne gite with a small blog. The exclusive French cut is parked for a wave-2 target.",
  },
  "bl-ethicaltraveller": {
    outlet: "Ethical Traveller",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Dropped with evidence: the site is the dormant portfolio of a freelance writer (posts from around 2012), returns 403 and 404, and no email address exists anywhere, including Wayback snapshots.",
  },
  "bl-familyfrance": {
    outlet: "Family Holidays France",
    actionType: "skip",
    priority: 1,
    priorityWhy: "Dropped with evidence: the site is the brochure of two holiday cottages, with no blog and no readers; the board angle assumed a family-travel blog that does not exist.",
  },
};

// Section order and labels for the board.
export const SECTION_ORDER: { type: PrActionType; title: string }[] = [
  { type: "email", title: "Email pitches (one click)" },
  { type: "form", title: "Forms (paste-ready)" },
  { type: "podcast-pitch", title: "Podcasts" },
  { type: "register", title: "Register once" },
  { type: "hashtag", title: "Hashtags (weekly routine)" },
  { type: "community-post", title: "Community posts" },
  { type: "directory-submit", title: "Directories" },
];
