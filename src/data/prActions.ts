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
  },
  "boutique-hotel-news-12": {
    outlet: "Boutique Hotel News",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified info@; its own note says the independents stat is tailor-made; Lane-2 host story in reserve.",
  },
  "phocuswire-10": {
    outlet: "PhocusWire",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified editor@; data-research-friendly trade; methodology-led Lane-2 pitch.",
  },
  "quartz-ideas-23": {
    outlet: "Quartz Ideas",
    actionType: "email",
    priority: 4,
    priorityWhy: "Public ideas@ inbox; formed economics angle (4.6 vs 3.1, 367 chains).",
  },
  "lonely-planet-3": {
    outlet: "Lonely Planet",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified editorial@; huge authority; Lane-3 towns cut as the backbone of a clusters piece, one finding only.",
  },
  "dwell-8": {
    outlet: "Dwell",
    actionType: "email",
    priority: 4,
    priorityWhy: "Verified edit@; Lane-4 design-cues angle matches their pitch guidance.",
  },
  "hospitality-design-hd-14": {
    outlet: "Hospitality Design",
    actionType: "email",
    priority: 4,
    priorityWhy: "Named exec editor email; Lane 4 plus the look-cosy asset.",
  },
  "hospitality-interiors-26": {
    outlet: "Hospitality Interiors",
    actionType: "email",
    priority: 4,
    priorityWhy: "Named editor email; a perfect practical feature per its note.",
  },
  "travelperk-trends-statistics-b19": {
    outlet: "TravelPerk stats hub",
    actionType: "email",
    priority: 4,
    priorityWhy: "Public press@; high DR, likely dofollow, hyperlinks originals; exactly our citation goal.",
  },
  "flowingdata-21": {
    outlet: "FlowingData",
    actionType: "email",
    priority: 4,
    priorityWhy: "Solo blogger, contact on the about page; pitch the score distribution and methodology as a dataset worth featuring (r=0.10 is analysis shared on request).",
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
  },
  "ttg-media-17": {
    outlet: "TTG Media",
    actionType: "email",
    priority: 3,
    priorityWhy: "General support@ first, then find the news editor; the 1-in-44 hook works for UK agents.",
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
  },
  "slow-travel-repeat-35": {
    outlet: "Slow Travel Repeat",
    actionType: "email",
    priority: 2,
    priorityWhy: "Verified email but the site takes barter and paid collabs; likely wants payment.",
  },
  "mycloud-hospitality-blog-b25": {
    outlet: "mycloud blog",
    actionType: "email",
    priority: 2,
    priorityWhy: "A real trade blog but it demands 1000-plus words plus a link exchange; mid value for the effort.",
  },
  "hotelogix-blog-b24": {
    outlet: "Hotelogix blog",
    actionType: "email",
    priority: 2,
    priorityWhy: "Wants 2000-plus words and a DA35-plus reciprocal; high effort for one dofollow bio link.",
  },
  "gonomad-travel-b27": {
    outlet: "GoNOMAD",
    actionType: "email",
    priority: 1,
    priorityWhy: "The board note said they are not publishing new stories, but the Challenger confirmed the guidelines DO accept podcast scripts, so the draft below is sendable.",
    pitch: {
      to: "editorial@gonomad.com",
      route: "email (verified in their writer guidelines; query letter, one page)",
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
      route: "email (press, verified on their contact page)",
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
  },
  "fodor-s-travel-4": {
    outlet: "Fodor's",
    actionType: "form",
    priority: 3,
    priorityWhy: "A Google Form route exists; Lane-3 towns-beat-capitals is a clean one-finding pitch.",
    instructions: "Use the Google Form linked from fodors.com/about-us. Paste a Lane-3 pitch: towns beat capitals only (one finding) and offer the towns cut.",
  },
  "sleeper-magazine-15": {
    outlet: "Sleeper",
    actionType: "form",
    priority: 3,
    priorityWhy: "Editorial form route; the Lane-2 host story with design framing fits the title.",
    instructions: "Editorial form at sleepermagazine.com/contact; pitch the Lane-2 host story with design framing.",
  },
  "hotel-designs-25": {
    outlet: "Hotel Designs",
    actionType: "form",
    priority: 3,
    priorityWhy: "Its own note suggests the 17,727-hotels-scored framing; a Lane-4 pitch fits.",
    instructions: "Use hoteldesigns.net/contact-us; Lane-4 pitch with the 17,727 hotels scored, what the data reveals framing from its note.",
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
  },
  "condor-ferries-travel-statistics-b21": {
    outlet: "Condor Ferries stats",
    actionType: "form",
    priority: 3,
    priorityWhy: "A classic link magnet: their 100-plus-statistics round-up hyperlinks sources.",
    instructions: "Via condorferries.co.uk/contact-us: pitch adding our cosiness stats (with links) to their statistics round-up.",
  },
  "siteminder-hotel-industry-statistics-b20": {
    outlet: "SiteMinder stats guide",
    actionType: "form",
    priority: 3,
    priorityWhy: "No public email; inclusion in the stats guide with attribution is the ask.",
    instructions: "Pitch the content or PR team via the site contact; ask for inclusion in the stats guide with attribution, citing the free CSVs.",
  },
  "bl-thehotelguru": {
    outlet: "The Hotel Guru",
    actionType: "form",
    priority: 3,
    priorityWhy: "A citation ask, not a story pitch: be cited or listed as a cosiness data source.",
    instructions: "Site contact; ask to be cited or listed as a cosiness data source.",
  },
  "journohq-best-ai-travel-tools-2026-b28": {
    outlet: "JournoHQ roundup",
    actionType: "form",
    priority: 3,
    priorityWhy: "Inclusion ask for Best AI Travel Tools 2026 as the cosiness-scoring layer alongside Layla, Mindtrip and Wanderlog.",
    instructions: "Contact via the About page or media kit; ask for inclusion in Best AI Travel Tools 2026 as the cosiness-scoring layer.",
  },
  "the-aficionados-27": {
    outlet: "The Aficionados",
    actionType: "form",
    priority: 3,
    priorityWhy: "Anti-chain design site; the Cosy Score works as a data layer on their curation.",
    instructions: "Via theaficionados.com/contact: offer the Cosy Score as a data layer on their curation.",
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
  },
  "kelly-s-cosy-life-31": {
    outlet: "Kelly's Cosy Life",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small lifestyle blogger; Lane-3 pitch.",
    instructions: "Contact page; Lane-3 pitch.",
  },
  "her-happy-habitat-34": {
    outlet: "Her Happy Habitat",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small blog; Lane-4 bring-it-home framing.",
    instructions: "Contact form; Lane-4 bring-it-home framing.",
  },
  "roam-and-reside-29": {
    outlet: "Roam and Reside",
    actionType: "form",
    priority: 2,
    priorityWhy: "Small blog, but the owner is an interior designer; Lane-4 visual-signals angle.",
    instructions: "Contact form; Lane-4 visual-signals angle.",
  },
  "lighthouse-travel-trends-blog-b22": {
    outlet: "Lighthouse trends blog",
    actionType: "form",
    priority: 2,
    priorityWhy: "No public email; medium-hard route for a modest gain.",
    instructions: "Pitch the content team via the site contact.",
  },
  "locals-insider-best-ai-travel-tools-b29": {
    outlet: "LOCALS Insider",
    actionType: "form",
    priority: 2,
    priorityWhy: "Contact route unconfirmed (the board's flag).",
    instructions: "Confirm the contact route first, then send a short inclusion ask.",
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
  },
  "bl-secornwall": {
    outlet: "Enjoying SE Cornwall",
    actionType: "form",
    priority: 1,
    priorityWhy: "Honest: we have no Cornwall cut and the lane story has no local hook. Weak fit, bottom of the pile.",
    instructions: "Site contact, only if everything else is exhausted.",
  },
  "how-to-hygge-the-british-way-32": {
    outlet: "How to Hygge the British Way",
    actionType: "form",
    priority: 1,
    priorityWhy: "No contact page; blog comments or the Facebook group only. The route is too weak to prioritise.",
    instructions: "Blog comments or the Facebook group only.",
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
    instructions: "Reach out via the Buzzsprout page or LinkedIn.",
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
    priorityWhy: "Signups may still be closed (board flag), and a product-age rule may apply.",
    instructions: "Check signups have reopened, then submit.",
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
    actionType: "directory-submit",
    priority: 2,
    priorityWhy: "Free means a two-to-four-week review; the roughly 100-dollar fast lane is not worth it.",
    instructions: "Submit on the free tier and wait out the review.",
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
