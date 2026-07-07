// Character-lane data-brief outreach campaign (die-validation: character-brief-final-2026-07-07.md,
// character-brief-targets-2026-07-07.json). Challenger-approved text — DO NOT edit the body without
// re-review. Sends are MANUAL by Per from per@gotcosy.com (Zoho — never Gmail send-as; SPF only
// authorizes zohomail.eu). One send per target, personalized, no follow-up chasing. Scoreboard:
// the weekly mention tracker (baseline ~0). Send status lives in localStorage (see DataBriefBoard).

export const CAMPAIGN = {
  id: "character-brief-2026-07",
  landing: "https://gotcosy.com/en/data/cosiest-hotel-towns",
  from: "per@gotcosy.com (send from Zoho directly — Gmail send-as will bounce/spam-flag: SPF authorizes Zoho only)",
  subject:
    "In the cosiest small towns, 74% of hotels' reviews mention a host or owner. In big cities: 26%.",
  // {PERSONAL} is replaced per target; the rest is the Challenger-approved body, verbatim.
  bodyTemplate: `Hi {FIRST},

{PERSONAL}

I run GotCosy, a small hotel-discovery site that scores hotels for cosiness by reading guest reviews (17,700 hotels so far). One finding from our latest analysis seemed worth sending you directly:

In the ten cosiest towns in our data, 74% of hotels' review evidence mentions a host, an owner, a family member or someone by name. In eight large cities: 26%. Nearly a third of those town hotels are guesthouses or B&Bs by name (big cities: one in ten). And the big cities' cosy survivors take a different route — "boutique" appears 53 times in their review evidence against 3 in the towns', and they score well doing it — design instead of a person, both real.

Full tiers, methodology, limitations and free CSVs are here (cite anything with attribution to GotCosy; a link is appreciated but not required): https://gotcosy.com/en/data/cosiest-hotel-towns

If a different cut would be more useful for something you're writing — a region, guesthouses only, the underlying evidence lines — I'm happy to run it. No strings.

Per
gotcosy.com`,
  rules: [
    "Send from per@gotcosy.com. Gmail 'send mail as' is fine NOW THAT it relays via Zoho SMTP (fixed 2026-07-07) — verify a test mail shows signed-by gotcosy.com before the first real send.",
    "One send per target. Personalize the {PERSONAL} line further if you know their work. No follow-up chasing.",
    "If anyone asks for the underlying evidence lines: always label them “condensed by our scoring model from review text — not verbatim guest quotes.”",
    "Scoreboard: the weekly mention tracker — do not count replies as success; count citations/mentions.",
  ],
} as const;

export type BriefTarget = {
  rank: number;
  name: string; // publication — writer
  first: string; // greeting name
  url: string;
  what: string; // what they write (from their own site)
  personal: string; // the one line about THEM — why this fits their work (second person)
  email: string | null; // verified only; null = no public email
  route: string; // the contact route actually observed
  activity: string;
  flag?: string; // founder-decision flags
};

export const TARGETS: BriefTarget[] = [
  {
    rank: 1,
    name: "Travel Folk — Jenoa",
    first: "Jenoa",
    url: "https://thetravelfolk.substack.com",
    what: "Paris-based Europe travel guides; family-run boutique hotels and guesthouses by stated preference.",
    personal:
      "You've written that your ideal trip means staying at a family-run boutique hotel or guesthouse — this finding is that philosophy, quantified.",
    email: "jenoa@thetravelfolk.com",
    route: "email (verified on site)",
    activity: "ongoing monthly pipeline",
  },
  {
    rank: 2,
    name: "Idyll — Ronee Uyeshiro",
    first: "Ronee",
    url: "https://idyllmag.substack.com",
    what: "Curates soulful, design-led hotels with compelling backstories — not mass-market chains.",
    personal:
      "Idyll's whole premise — soulful hotels with backstories over chains — turns out to be what this data ended up measuring; the boutique-in-big-cities counter-finding is squarely your design beat.",
    email: "helloidyllmag@gmail.com",
    route: "email (verified on About page)",
    activity: "post Jun 30, 2026",
  },
  {
    rank: 3,
    name: "Happy Hoteling — Marissa Klurstein",
    first: "Marissa",
    url: "https://marissaklurstein.substack.com",
    what: "Hotels 'with soul, a story, a sensibility'; heavy Italy focus, country-by-country guides.",
    personal:
      "Your June essay argued personal connection beats amenities — this is that argument, in numbers (and Italy dominates the top tier).",
    email: null,
    route: "Substack DM / reply-to",
    activity: "post Jul 5, 2026",
  },
  {
    rank: 4,
    name: "Gina's Journal — Gina Jackson",
    first: "Gina",
    url: "https://ginasjournal.substack.com",
    what: "Author of two UK boutique-hotel guidebooks (Hoxton Mini Press); independents over chains, fortnightly.",
    personal:
      "Your guidebooks curate independent character hotels by eye — this data gives that eye a mechanism: the person running the place.",
    email: null,
    route: "Instagram DM @ginagoesto",
    activity: "fortnightly, active 2026",
  },
  {
    rank: 5,
    name: "From the Poolside — Stéphanie Bonnet",
    first: "Stéphanie",
    url: "https://fromthepoolside.com",
    what: "A personal edit of boutique hotels 'saved, reviewed, and shared with restraint' — small independents and B&Bs.",
    personal:
      "You share boutique finds 'with restraint' — here's a dataset that agrees with your taste and says why it works.",
    email: null,
    route: "contact form on site",
    activity: "Jan 2026",
  },
  {
    rank: 6,
    name: "Wander-Lush — Emily Lush",
    first: "Emily",
    url: "https://wander-lush.org",
    what: "Guesthouse-heavy Balkans/Caucasus coverage with a small-local-business ethos.",
    personal:
      "Your guesthouse-first Balkans and Caucasus coverage is exactly the territory where this pattern runs strongest — family-run places whose reviews name the host.",
    email: "emily@wander-lush.org",
    route: "email (published obfuscated on site) + contact form",
    activity: "10-year-anniversary post, active",
  },
  {
    rank: 7,
    name: "Travlinmad — Lori & Angelo",
    first: "Lori",
    url: "https://travlinmad.com",
    what: "'Eat Local, Travel Slow™' — dedicated Local Stays category.",
    personal:
      "'Eat local, travel slow' — the data says the same instinct applies to who runs your hotel: the places guests warm to are the ones where reviews name the owner.",
    email: "Lori@Travlinmad.com",
    route: "email (verified) + /contact page",
    activity: "ongoing",
  },
  {
    rank: 8,
    name: "Postcards from Wherever — Emma Lavelle",
    first: "Emma",
    url: "https://postcardsfromwherever.substack.com",
    what: "Slow, design-led hotels and hideaways.",
    personal:
      "Your slow, design-led hideaways beat sits on both halves of this finding — the host-run towns and the design route the big cities take instead.",
    email: null,
    route: "Instagram DM @emmajaynelavelle",
    activity: "active 2026",
  },
  {
    rank: 9,
    name: "On The Road (Sur Collective) — Allison Jervis",
    first: "Allison",
    url: "https://surcollective.substack.com",
    what: "'Checking In' reviews of independent, design-led stays.",
    personal:
      "Your Checking In reviews of independent stays are the qualitative twin of this data — it measures at scale what those reviews notice one hotel at a time.",
    email: null,
    route: "Substack DM / reply-to",
    activity: "post Jun 28, 2026",
  },
  {
    rank: 10,
    name: "Hedwig Travel — Sabine Russek",
    first: "Sabine",
    url: "https://hedwigtravel.substack.com",
    what: "'Accommodation Wishlist' series on small, characterful stays.",
    personal:
      "Your Accommodation Wishlist series is the demand side of this exact pattern — small places with someone's name attached.",
    email: null,
    route: "Substack DM / reply-to",
    activity: "active 2025–26",
  },
  {
    rank: 11,
    name: "So There's This Place — Monica Mendal",
    first: "Monica",
    url: "https://sotheresthisplace.substack.com",
    what: "Off-the-beaten-path guides + a Wishlist Hotels series.",
    personal:
      "Your off-path guides and Wishlist Hotels series map almost exactly onto where this signal concentrates — small towns, host-run places.",
    email: null,
    route: "Instagram DM @monicamendal; Substack Chat (paid)",
    activity: "Apr 2026",
  },
  {
    rank: 12,
    name: "Somewhere with Livia — Livia Hengel",
    first: "Livia",
    url: "https://liviahengel.substack.com",
    what: "Essays on what makes a place feel meaningful; Italy focus.",
    personal:
      "You write about what makes a place feel meaningful — this is one measurable answer: a person. And Italy owns the top of the table.",
    email: null,
    route: "Instagram DM @liviahengel or Substack",
    activity: "Feb 2026 (sparse)",
    flag: "Cadence gap — real and active within window, but posts are sparse.",
  },
  {
    rank: 13,
    name: "Italy Segreta",
    first: "Italy Segreta team",
    url: "https://italysegreta.com",
    what: "'Only small, family-run boutique hotels in Italy.'",
    personal:
      "You cover only small, family-run boutique hotels in Italy — Italy dominates our top tier, and this data explains why your niche keeps winning.",
    email: null,
    route: "contact via italysegreta.com/newsletter",
    activity: "active",
    flag: "BORDERLINE: a small magazine/company, not a solo writer — keep only if 'indie' ≠ strictly 'solo'.",
  },
  {
    rank: 14,
    name: "Departure — Henah Velez",
    first: "Henah",
    url: "https://henahvelez.substack.com",
    what: "Slow-travel and small-business-adjacent newsletter (~4k subs); hotels not the core beat.",
    personal:
      "Your slow-travel lens fits the quieter half of this dataset — the towns where the person running the place is the experience.",
    email: null,
    route: "Substack reply-to",
    activity: "active",
    flag: "WEAKER FIT: one research pass classified her as Quiet-lane rather than Character-lane.",
  },
  {
    rank: 15,
    name: "Time to Be Italian — Barbara Rocci",
    first: "Barbara",
    url: "https://timetobeitalian.substack.com",
    what: "Le Marche hidden gems; not hotel-specific.",
    personal:
      "Le Marche's hidden guesthouses are exactly the kind of places this data keeps surfacing — host-run, small, remembered by name.",
    email: null,
    route: "Substack subscribe/DM",
    activity: "UNCONFIRMED",
    flag: "Verify 2025–26 activity before sending; drop if none found.",
  },
];
