// Character-lane data-brief outreach campaign (die-validation: character-brief-final-2026-07-07.md,
// character-brief-targets-2026-07-07.json). Challenger-approved text — DO NOT edit the body without
// re-review. Sends are MANUAL by Per from per@gotcosy.com (Zoho — never Gmail send-as; SPF only
// authorizes zohomail.eu). One send per target, personalized, no follow-up chasing. Scoreboard:
// the weekly mention tracker (baseline ~0). Send status lives in localStorage (see DataBriefBoard).

export const CAMPAIGN = {
  id: "character-brief-2026-07",
  landing: "https://gotcosy.com/en/data/cosiest-hotel-towns",
  from: "per@gotcosy.com (send from Zoho directly — Gmail send-as will bounce/spam-flag: SPF authorizes Zoho only)",
  // Rewritten 2026-07-08 to the email rules in .claude/skills/copywriting (pitch section): ≤7-word
  // stat-free subject, one number translated to a human scale, offer = a cut shaped for THEM,
  // one-word ask, ~110 words. Evidence: die-validation research-*-2026-07-08.md.
  subject: "Why guests remember the owner",
  // {PERSONAL} is replaced per target: an observation about THEIR work and what it connects to —
  // never a compliment ("I loved your post" reads as AI spam now).
  bodyTemplate: `Hi {FIRST},

{PERSONAL}

I run GotCosy. I score hotels for cosiness by reading what guests write about them afterwards, and one pattern won't go away: in the ten cosiest towns in my data, three out of every four hotels have guests writing about a person. The owner. A host they name. In the eight big cities I compared, one in four.

If that's useful for something you're writing, I'll cut the data whichever way serves the piece — one region, guesthouses only, the raw file. Free, credit optional. The full thing lives at https://gotcosy.com/en/data/cosiest-hotel-towns.

Worth a look?

Per
gotcosy.com

PS - if this isn't for you, ignoring it is a perfectly good answer. No follow-up coming.`,
  rules: [
    "Send from per@gotcosy.com. Gmail 'send mail as' is fine NOW THAT it relays via Zoho SMTP (fixed 2026-07-07) — verify a test mail shows signed-by gotcosy.com before the first real send.",
    "One send per target. Mon–Wed sends only (replies come in hours or never). No follow-up chasing — the PS promises that.",
    "Read it aloud as yourself before sending. If a sentence sounds like a company, cut it.",
    "If anyone asks for the underlying evidence lines: always label them “condensed by our scoring model from review text — not verbatim guest quotes.”",
    "Scoreboard: the weekly mention tracker — do not count replies as success; count citations/mentions. ~3% cold reply is the base rate; silence is normal.",
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
      "You've said your ideal trip ends at a family-run place. It turns out the guests of places like that keep proving your point, in writing.",
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
      "Idyll picks hotels for the story behind them. Here's an odd thing I can now show: small towns get cosy through a person, big cities get there through design. You cover that exact fault line.",
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
      "Your June essay argued personal connection beats amenities. I can put a number on that now — and Italy sits all over the top of the table.",
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
      "Your guidebooks pick independent hotels by eye. I think I can show what that eye is detecting: the person running the building.",
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
      "You share finds with restraint, so I'll be brief: the thing your kind of hotel has in common turns out to be measurable.",
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
      "Romania came out the single cosiest country in my data, and its evidence lines are all hosts by name. Your exact territory.",
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
      "'Eat local, travel slow' seems to extend to who runs your hotel. The stays guests warm to are the ones where they learn the owner's name.",
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
      "Your hideaways beat sits on both sides of something odd I found: small towns get cosy through a host, cities through design. Two routes, same warmth.",
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
      "Checking In notices one hotel at a time what I've been measuring across thousands — and the scale version has a twist I didn't expect.",
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
      "The places on your Accommodation Wishlist share a trait I can finally name with data: someone's name attached to the building.",
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
      "The hotels you wishlist are small, off the path, with someone's name over the door: exactly where this signal concentrates.",
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
      "You ask what makes a place feel meaningful. One measurable answer showed up in my data: a person. And Italy owns the top of the table.",
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
      "The only hotels you'll feature are small and family-run — and Italian towns hold the top of my cosiest-towns table, which I don't think is a coincidence.",
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
      "Your slow-travel lens fits the quiet half of what I found: towns where the person running the place is the experience.",
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
      "Le Marche's guesthouses are the kind of places my data keeps surfacing: host-run, small, remembered by name.",
    email: null,
    route: "Substack subscribe/DM",
    activity: "UNCONFIRMED",
    flag: "Verify 2025–26 activity before sending; drop if none found.",
  },
];
