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
      "Your Lake Como stay was Alessandro and Andrea and their grandmother's house; your Bologna hotel picks are stained glass and quirky interiors, no names. You've already written both halves of the pattern I've been measuring.",
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
      "Your Ha(a)ïtza review runs on William and Sylvie; your El Cortés review runs on ironwork and stained glass, and no owner gets named. That difference between a seaside town and a big city turns out to be measurable.",
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
      "You wrote that people you send to La Minerva who don't know the owners still leave 'feeling like they did.' That effect shows up at scale in my review data, and Italy sits all over the top of the table.",
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
      "In April you wrote you'd much rather support hotels that invest in local talent than fly in senior management. The places that do have something measurable: guests write about the person running the building, by name.",
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
      "You went back to Lundies House and wrote that it 'doesn't feel like a hotel. It feels like staying with someone.' Guests across my review data keep saying exactly that about small remote places, and almost never about city ones.",
    email: null,
    route: "Substack DM / reply-to at fromthepoolside.substack.com; site contact form as fallback",
    activity: "post Jun 22, 2026 (fromthepoolside.substack.com)",
  },
  {
    rank: 6,
    name: "Wander-Lush — Emily Lush",
    first: "Emily",
    url: "https://wander-lush.org",
    what: "Guesthouse-heavy Balkans/Caucasus coverage with a small-local-business ethos.",
    personal:
      "In your Akhaltsikhe guide, the Chobareti farmstay is Aluda and his family first, the buildings second. That ordering is the pattern my review data keeps finding in guesthouse country — and Romania, where you've covered the same kind of places, tops the whole table.",
    email: "emily@wander-lush.org",
    route: "email (published obfuscated on site) + contact form",
    activity: "guides updated/posted Jun 17–25, 2026",
  },
  {
    rank: 7,
    name: "Travlinmad — Lori & Angelo",
    first: "Lori",
    url: "https://travlinmad.com",
    what: "'Eat Local, Travel Slow™' — dedicated Local Stays category.",
    personal:
      "Your Mary Day piece gives the captains more ink than the schooner, and 'connections to people and place' is the payoff you land on. Hotel guests do the same thing in their reviews, it turns out — but only in some places.",
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
      "In your Late Spring Edit, Hotel Sundal is Caroline and Harold before it's ten bedrooms, and Off Grid Girona earns its spot by 'operating more of a guest house than a hotel.' My review data backs that up: it's how small places get warm.",
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
      "Your Checking In on Pulitzer Paris gave the family behind it (hoteliers since 1967) as much attention as the rooms. My review data puts numbers on that instinct — maybe an angle for the series now that you're posting again.",
    email: null,
    route: "Substack DM / reply-to",
    activity: "post Jun 28, 2026 (comeback after ~5-month hiatus; Checking In series dormant since Feb 2025)",
  },
  {
    rank: 10,
    name: "Hedwig Travel — Sabine Russek",
    first: "Sabine",
    url: "https://icouldlivehere.substack.com",
    what: "'Accommodation Wishlist' series on small, characterful stays.",
    personal:
      "Six volumes into your Accommodation Wishlist, you almost always say who runs the place — Willy Aziz's Nile boats, the 'locally owned, locally managed' guesthouse in Taghit. My review data suggests that habit is the whole finding.",
    email: null,
    route: "Substack DM / reply-to at icouldlivehere.substack.com (hedwigtravel.substack.com is stale — 302s to a bare profile)",
    activity: "post May 6, 2026 (Wishlist Vol. 06)",
  },
  {
    rank: 11,
    name: "So There's This Place — Monica Mendal",
    first: "Monica",
    url: "https://sotheresthisplace.substack.com",
    what: "Off-the-beaten-path guides + a Wishlist Hotels series.",
    personal:
      "The figure who steals your love letter to Porquerolles is a fisherman nicknamed the pirate, not the beaches. That's the pattern in my hotel-review data too: in the cosiest small towns, the person is the place.",
    email: null,
    route: "Instagram DM @monicamendal; Substack Chat (paid)",
    activity: "post Jun 9, 2026 (Travel Field Notes 05)",
  },
  {
    rank: 12,
    name: "Somewhere with Livia — Livia Hengel",
    first: "Livia",
    url: "https://liviahengel.substack.com",
    what: "Essays on what makes a place feel meaningful; Italy focus.",
    personal:
      "In your soul-place essay you wrote that we talk about soulmates like they're only people, but sometimes they're a place. My review data found the reverse hiding inside that: when a small-town hotel feels that way, there's usually a named person carrying it.",
    email: null,
    route: "Instagram DM @liviahengel or Substack",
    activity: "last post Feb 4, 2026; ~5-month gap as of Jul 2026",
    flag: "CADENCE GAP CONFIRMED — founder call: send vs defer. Cited post retitled 'What It Feels Like to Find Your Soul Place'.",
  },
  {
    rank: 13,
    name: "Italy Segreta",
    first: "Italy Segreta team",
    url: "https://italysegreta.com",
    what: "'Only small, family-run boutique hotels in Italy.'",
    personal:
      "You built the Selection on a claim: places that feel 'less like hotels and more like homes', run by a 'community of owners'. My review data just tested that claim across thousands of hotels, and it holds — with Italian towns crowding the top.",
    email: null,
    route: "contact via italysegreta.com/newsletter",
    activity: "active",
    flag: "BORDERLINE: a small magazine/company, not a solo writer — keep only if 'indie' ≠ strictly 'solo'.",
  },
  {
    rank: 14,
    name: "Departure — Henah Velez",
    first: "Henah",
    url: "https://www.joindeparture.com",
    what: "Slow-travel and small-business-adjacent newsletter (~4k subs); hotels not the core beat.",
    personal:
      "You called independent bookstores the epitome of slow travel. Hotels run on the same mechanism, it turns out: in the cosiest small towns in my review data, guests write about the owner by name.",
    email: "henah@henahvelez.com",
    route: "email (from her Substack profile — re-verify deliverability before send) or reply-to at joindeparture.com",
    activity: "post Jun 25, 2026",
    flag: "WEAKER FIT: one research pass classified her as Quiet-lane rather than Character-lane.",
  },
  {
    rank: 15,
    name: "Time to Be Italian — Barbara Rocci",
    first: "Barbara",
    url: "https://timetobeitalian.substack.com",
    what: "Le Marche hidden gems; not hotel-specific.",
    personal:
      "You promised your October Le Marche group 'a family-run winery where the owners sit down with us'. That's the pattern my hotel-review data keeps finding in the cosiest small towns — guests remember the owner, by name.",
    email: null,
    route: "Substack subscribe/DM",
    activity: "post Jul 8, 2026 (12 posts Mar–Jul 2026)",
  },
];
