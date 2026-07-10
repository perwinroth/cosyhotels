// Directory / listing submission targets for the /growth/listings board. Curated 2026-07-09 from
// launch-directory research (die-validation session): the backl.io play, built ourselves and
// travel-fit. Tier 1 = entity anchors that Google's Knowledge Graph and AI crawlers actually read;
// Tier 2 = free-or-cheap startup directories with real DR and (mostly) dofollow links; Tier 3 =
// niche fit (AI-tool and travel directories). DR figures are approximate Ahrefs numbers from the
// research pass, kept for prioritising only. Some targets also have a PR-board card from the
// 2026-07-08 action plan; their notes say so, tick both boards when done.

export type ListingTarget = {
  id: string;
  name: string;
  submitUrl: string;
  tier: 1 | 2 | 3;
  dr: number | null;
  cost: string; // "free" | "freemium" | "$39" ...
  dofollow: boolean | null; // null = unverified
  effort: "5min" | "10min" | "15min" | "20min" | "30min+";
  fields: string; // what the submission form asks for
  note: string;
};

// ── The copy kit: pre-approved text for every field a directory form asks for ────────────────────
// Rules honoured (copywriting skill): no em dashes, plain prose, sanctioned facts only (17,727
// hotels, 164-city tiers, host/owner and quiet themes, free CSVs). The unpublished r=0.10 number is
// deliberately NOT here: qualitative phrasing only until it is on a live page.

export type KitField = { label: string; value: string; hint?: string };

export const LISTING_KIT: KitField[] = [
  { label: "Name", value: "Got Cosy" },
  { label: "URL", value: "https://gotcosy.com" },
  {
    label: "Tagline (max 60 chars)",
    value: "Find genuinely cosy hotels, scored from real guest reviews",
    hint: "58 chars. General-purpose one-liner.",
  },
  {
    label: "Tagline, AI directories (max 60 chars)",
    value: "AI reads guest reviews and scores hotels for cosiness",
    hint: "54 chars. Use on AI-tool directories where the AI angle is the category fit.",
  },
  {
    label: "Short description (max 160 chars)",
    value: "Got Cosy scores 17,727 hotels for cosiness by reading what guests wrote in reviews. Star ratings barely predict how warm a stay feels; guest language does.",
    hint: "156 chars.",
  },
  {
    label: "Medium description (max 300 chars)",
    value: "Got Cosy read the guest reviews of 17,727 hotels and scored each for cosiness against a fixed rubric: warmth, quiet, character, and whether guests mention a host or owner. Free city guides, a 164-city ranking, and the methodology (including its limitations) published openly.",
    hint: "274 chars.",
  },
  {
    label: "Long description",
    value:
      "I got tired of hotels that look warm in photos and feel like airports in person, so I built Got Cosy. It reads what guests actually wrote in their reviews across 17,727 hotels and scores each one for cosiness against a fixed rubric: warmth, quiet, character, and whether guests mention a host or an owner by name. The site has city guides, a ranking of 164 towns and cities, and the full methodology published openly, including its limitations. It is free to use, and the underlying data is downloadable as CSVs.",
    hint: "Use wherever the form allows 400+ chars.",
  },
  {
    label: "Founder bio",
    value:
      "Per Winroth is the founder of Got Cosy, which scored 17,727 hotels by reading what guests wrote in reviews against a fixed rubric. He can speak to why star ratings barely predict how warm a stay feels, and what guests actually describe when a hotel feels like home.",
    hint: "Same text as the PR-board register playbook; keep them identical.",
  },
  {
    label: "Launch / first comment (Product Hunt, Indie Hackers, forums)",
    value:
      "I kept booking hotels that looked cosy in photos and were not. The truth was usually in the reviews, but nobody reads 400 of them. So I had a model read them for me: 17,727 hotels, each scored against the same rubric for warmth, quiet and character, with the methodology and its limitations published. Nothing scores an 8; the honest ceiling in the data is 7.8. It is free. I would genuinely like to know where the scoring feels wrong; that feedback improves the rubric.",
    hint: "First-person Per. Invite criticism; do not sell. The 7.8 ceiling is verified against cosy_scores (2026-07-09).",
  },
  { label: "Categories / tags", value: "Travel, Hotels, AI, Search and Discovery, Data" },
  { label: "Alternative to (comparison directories)", value: "Booking.com, TripAdvisor, Mr and Mrs Smith" },
  { label: "Pricing", value: "Free" },
  {
    label: "Proof links (paste where a form asks for press/data)",
    value: "https://gotcosy.com/en/data/cosiest-hotel-towns",
    hint: "The data page with methodology, 164-city tiers and free CSVs.",
  },
  {
    label: "Account to register with",
    value: "gotcosy@gmail.com",
    hint: "ALWAYS this account (default send-as per@gotcosy.com). Never the personal address; see the 2026-07-09 sender incident.",
  },
];

// ── Targets, ranked within tier by DR × dofollow × fit ───────────────────────────────────────────

export const LISTING_TARGETS: ListingTarget[] = [
  // Tier 1: entity anchors. These build "Got Cosy is a real thing" in the systems AI answers and
  // Knowledge Panels read from. Do these first; most are 5-15 minutes.
  { id: "crunchbase", name: "Crunchbase", submitUrl: "https://www.crunchbase.com/add-new", tier: 1, dr: 92, cost: "free", dofollow: true, effort: "15min", fields: "company name, short description, website, HQ location, industry tags, founding date, founder profile, logo", note: "Knowledge Panels and AI crawlers pull from Crunchbase heavily; the single most valuable profile on this board." },
  { id: "trustpilot", name: "Trustpilot business profile", submitUrl: "https://business.trustpilot.com/signup", tier: 1, dr: 91, cost: "free", dofollow: true, effort: "15min", fields: "business name, website (domain verification), category, logo, description, contact email", note: "Consumer review platform, directly relevant to a hotel-discovery product; Google and LLMs cite it." },
  { id: "sourceforge", name: "SourceForge", submitUrl: "https://sourceforge.net/software/new", tier: 1, dr: 92, cost: "free", dofollow: true, effort: "15min", fields: "product name, short summary, category, website, logo, screenshots", note: "Odd fit for a consumer travel site but a very high-DR entity anchor; list under business/travel software." },
  { id: "product-hunt", name: "Product Hunt", submitUrl: "https://www.producthunt.com/posts/new", tier: 1, dr: 91, cost: "free", dofollow: false, effort: "30min+", fields: "60-char tagline, description, gallery images, maker first comment, topics, pricing type, launch date", note: "Also a card on the PR board (tick both). Nofollow, but the strongest 'real product' signal journalists and LLMs see. Schedule the launch deliberately; use the kit's first-comment text." },
  { id: "linkedin", name: "LinkedIn company page", submitUrl: "https://www.linkedin.com/company/setup/new/", tier: 1, dr: 98, cost: "free", dofollow: false, effort: "10min", fields: "company name, URL slug, logo, cover, tagline, description, industry, size, website", note: "Where journalists verify who Per Winroth is; strong Knowledge Graph signal." },
  { id: "x-profile", name: "X (Twitter) brand profile", submitUrl: "https://x.com/i/flow/signup", tier: 1, dr: 99, cost: "free", dofollow: false, effort: "5min", fields: "handle, display name, 160-char bio, photo, header, website link", note: "Crawlable entity anchor tied to the domain; also needed for the PR board's hashtag routine." },
  { id: "pinterest", name: "Pinterest business account", submitUrl: "https://www.pinterest.com/business/create/", tier: 1, dr: 94, cost: "free", dofollow: false, effort: "10min", fields: "business name, website, category, photo, description", note: "High topical fit: Pinterest is a real discovery channel for travel imagery, not just a link." },
  { id: "instagram", name: "Instagram business profile", submitUrl: "https://www.instagram.com/accounts/emailsignup/", tier: 1, dr: 97, cost: "free", dofollow: false, effort: "10min", fields: "username, 150-char bio, website link, photo, category", note: "Already used by the Today plan's Instagram tasks; make sure the profile carries the kit bio and site link." },
  { id: "facebook", name: "Facebook page", submitUrl: "https://www.facebook.com/pages/create", tier: 1, dr: 98, cost: "free", dofollow: false, effort: "10min", fields: "page name, category, bio, photos, website, contact", note: "Still surfaces in Knowledge Panels for consumer brands." },
  { id: "youtube", name: "YouTube channel", submitUrl: "https://studio.youtube.com", tier: 1, dr: 100, cost: "free", dofollow: false, effort: "10min", fields: "channel name, handle, description, banner, photo, links", note: "Claim the entity even before any video exists; activate later with one short demo." },
  { id: "wikidata", name: "Wikidata item", submitUrl: "https://www.wikidata.org/wiki/Special:NewItem", tier: 1, dr: null, cost: "free", dofollow: false, effort: "30min+", fields: "instance of, official website, inception, country, industry, referenced statements", note: "HOLD until the first real press hit: notability needs independent published coverage. Revisit after a PR-board win." },

  // Tier 2: startup directories. Free or cheap, mostly dofollow, each 5-15 minutes with the kit.
  { id: "startup-fame", name: "Startup Fame", submitUrl: "https://startupfa.me/", tier: 2, dr: 83, cost: "freemium", dofollow: true, effort: "10min", fields: "startup URL (AI autofills), category, tier", note: "One of the highest-DR free options; AI-assisted submission from just the URL." },
  { id: "fazier", name: "Fazier", submitUrl: "https://fazier.com/submit", tier: 2, dr: 82, cost: "freemium", dofollow: true, effort: "15min", fields: "name, tagline, description, category, website, logo, launch tier", note: "Also a card on the PR board (tick both). High DR for the effort; free launch option." },
  { id: "twelve-tools", name: "Twelve Tools", submitUrl: "https://twelve.tools/submit-your-tool", tier: 2, dr: 81, cost: "free", dofollow: true, effort: "10min", fields: "tool name, URL, one-liner, category", note: "Caps at 12 tools/day; re-crawls your site to confirm the backlink stays live." },
  { id: "dang-ai", name: "Dang AI", submitUrl: "https://dang.ai/", tier: 2, dr: 81, cost: "free", dofollow: true, effort: "10min", fields: "tool name, URL, category, short description, logo", note: "AI-tools directory; legitimate fit since the scoring genuinely is AI-read reviews." },
  { id: "findly-tools", name: "findly.tools", submitUrl: "https://findly.tools/", tier: 2, dr: 80, cost: "freemium", dofollow: true, effort: "15min", fields: "name, tagline, description, category, logo, screenshot", note: "Free listing requires their badge on your site to keep the dofollow link; $9 skips that. Recommend paying the $9 over adding a badge." },
  { id: "turbo0", name: "Turbo0", submitUrl: "https://turbo0.com/submit", tier: 2, dr: 80, cost: "free", dofollow: true, effort: "5min", fields: "product URL and name (AI autofills the rest)", note: "Fastest submission on this board; paste the URL and check what the autofill wrote." },
  { id: "saashub", name: "SaaSHub", submitUrl: "https://www.saashub.com/", tier: 2, dr: 79, cost: "freemium", dofollow: true, effort: "15min", fields: "name, tagline, description, category, website, logo, screenshots, alternatives", note: "Also a card on the PR board (tick both). Use the kit's alternative-to line; permanent dofollow page on the free tier." },
  { id: "alternativeto", name: "AlternativeTo", submitUrl: "https://alternativeto.net/software/add/", tier: 2, dr: 79, cost: "free", dofollow: false, effort: "15min", fields: "app name, description, tags, platforms, pricing type, alternative-to", note: "Also a card on the PR board (tick both). Nofollow but big traffic and long-tail 'alternative to Booking' visibility." },
  { id: "peerlist", name: "Peerlist", submitUrl: "https://peerlist.io/", tier: 2, dr: 77, cost: "free", dofollow: false, effort: "15min", fields: "project name, tagline, description, media, maker profile", note: "Also a card on the PR board (tick both). Needs an active personal profile first; weekly Spotlight caps at 50." },
  { id: "toolpilot", name: "Toolpilot", submitUrl: "https://toolpilot.ai/", tier: 2, dr: 77, cost: "free", dofollow: true, effort: "10min", fields: "tool name, URL, category, short description, logo", note: "Among the best DR-to-effort ratios of the free AI directories." },
  { id: "betalist", name: "BetaList", submitUrl: "https://betalist.com/submit", tier: 2, dr: 76, cost: "$39", dofollow: true, effort: "30min+", fields: "name, one-liner, description, styled hero image, category, stage", note: "Also a card on the PR board (tick both). Fee appears at the end of the form; free path exists if submitted well before a launch push." },
  { id: "indie-hackers", name: "Indie Hackers", submitUrl: "https://www.indiehackers.com/products/new", tier: 2, dr: 75, cost: "free", dofollow: false, effort: "15min", fields: "product name, tagline, description, screenshots, story posts", note: "The build-story post is worth more than the listing; use the kit's first-comment text as the seed." },
  { id: "f6s", name: "F6S", submitUrl: "https://www.f6s.com/", tier: 2, dr: 73, cost: "free", dofollow: true, effort: "15min", fields: "startup name, description, website, team, category, stage", note: "Founder network; the profile doubles as a who-is-behind-this reference." },
  { id: "uneed", name: "Uneed", submitUrl: "https://www.uneed.best/submit-a-tool", tier: 2, dr: 72, cost: "freemium", dofollow: true, effort: "15min", fields: "name, tagline, description, category, pricing, logo, screenshot", note: "Also a card on the PR board (tick both). Daily launch board with a free tier." },
  { id: "betapage", name: "Betapage", submitUrl: "https://betapage.co/", tier: 2, dr: 66, cost: "freemium", dofollow: true, effort: "15min", fields: "name, tagline, description, category, logo, screenshot", note: "Needs 5 upvotes to surface in Recent; skip the $60 featured tier." },
  { id: "launching-next", name: "Launching Next", submitUrl: "https://launchingnext.com/submit", tier: 2, dr: 55, cost: "free", dofollow: true, effort: "15min", fields: "name, tagline, description, URL, logo, category, launch date", note: "Permanent dofollow listing that keeps surfacing in long-tail search for years; quietly high ROI." },
  { id: "startups-fm", name: "Startups.fm", submitUrl: "https://startups.fm/", tier: 2, dr: 50, cost: "free", dofollow: true, effort: "10min", fields: "name, tagline, description, category, website, logo", note: "Quick dofollow add for early link diversity." },
  { id: "sideprojectors", name: "SideProjectors", submitUrl: "https://www.sideprojectors.com/", tier: 2, dr: 46, cost: "free", dofollow: null, effort: "15min", fields: "project name, description, category, type (showcase), link", note: "Manual approval is slow; can import from a Product Hunt listing, so do PH first." },
  { id: "microlaunch", name: "Microlaunch", submitUrl: "https://microlaunch.net/submit", tier: 2, dr: 42, cost: "free", dofollow: null, effort: "20min", fields: "product name, tagline, description, media, category", note: "Month-long batches with real community feedback (Roasts and Boosts), not just a link." },
  { id: "tinylaunch", name: "TinyLaunch", submitUrl: "https://www.tinylaunch.com/", tier: 2, dr: null, cost: "free", dofollow: null, effort: "10min", fields: "name, tagline, description, URL, logo", note: "Also a card on the PR board (tick both)." },
  { id: "startupbase", name: "StartupBase", submitUrl: "https://startupbase.io/submit", tier: 2, dr: null, cost: "free", dofollow: null, effort: "10min", fields: "name, tagline, description, category, URL", note: "Also a card on the PR board (tick both). /submit redirects to login (verified 2026-07-10): sign in first (Google as gotcosy@gmail.com), then the form opens." },

  // Tier 3: niche fit. AI-tool directories (the product is genuinely AI-scored) and travel listings.
  { id: "taaft", name: "There's An AI For That", submitUrl: "https://theresanaiforthat.com/submit", tier: 3, dr: 77, cost: "free", dofollow: true, effort: "15min", fields: "tool name, URL, task tags, description, pricing, screenshot", note: "Also a card on the PR board (tick both). Largest task-based AI directory; use the AI tagline." },
  { id: "toolify", name: "Toolify.ai", submitUrl: "https://www.toolify.ai/submit", tier: 3, dr: 74, cost: "$99", dofollow: true, effort: "15min", fields: "tool name, URL, category, description, logo, screenshots", note: "Free tier REMOVED (verified on the live submit page 2026-07-10): a 99-dollar one-time fee is the only route. Skip: the audience is AI builders, not travellers; six dofollow links alone do not justify it." },
  { id: "aixploria", name: "AIxploria", submitUrl: "https://www.aixploria.com/en/add-ai/", tier: 3, dr: null, cost: "free", dofollow: null, effort: "10min", fields: "tool name, URL, category, description", note: "Also a card on the PR board (tick both)." },
  { id: "futurepedia", name: "Futurepedia", submitUrl: "https://www.futurepedia.io/submit-tool", tier: 3, dr: 70, cost: "free", dofollow: true, effort: "15min", fields: "tool name, URL, category, tagline, description, pricing, logo", note: "Human-reviewed, 3-7 day turnaround; higher-quality catalog than the volume directories." },
  { id: "slant", name: "Slant.co", submitUrl: "https://www.slant.co/", tier: 3, dr: 68, cost: "free", dofollow: null, effort: "15min", fields: "product name, URL, which 'best X for Y' question it answers, pros and cons", note: "Add Got Cosy as an answer to 'best sites for finding boutique/cosy hotels' style questions; needs a short pitch, not a form fill." },
  { id: "future-tools", name: "Future Tools", submitUrl: "https://www.futuretools.io/submit-a-tool", tier: 3, dr: 65, cost: "free", dofollow: true, effort: "10min", fields: "tool name, URL, category, description, logo", note: "Matt Wolfe's AI aggregator; simple free submission." },
  { id: "neura-travel", name: "Neura AI directory (Travel)", submitUrl: "https://www.neura.market/ai-tools-directory/travel", tier: 3, dr: null, cost: "free", dofollow: null, effort: "15min", fields: "tool name, URL, Travel category, description, logo", note: "One of the few AI directories with a dedicated Travel category." },
  { id: "startup-stash", name: "Startup Stash", submitUrl: "https://startupstash.com/", tier: 3, dr: null, cost: "free", dofollow: null, effort: "15min", fields: "tool name, URL, category, one-liner, logo", note: "Also a card on the PR board (tick both). Already lists Nomad List; good topical neighbour." },
  { id: "travelaxis", name: "TravelAxis", submitUrl: "https://www.travelaxis.org/", tier: 3, dr: null, cost: "free", dofollow: null, effort: "15min", fields: "business name, category, description, website, contact", note: "Low authority but directly on-topic travel-business directory." },
  { id: "show-hn", name: "Hacker News (Show HN)", submitUrl: "https://news.ycombinator.com/submit", tier: 3, dr: 91, cost: "free", dofollow: false, effort: "15min", fields: "plain title (no hype), URL, first-comment backstory", note: "Also a card on the PR board (tick both); work it from THERE (it has the approved framing). Never ask anyone to upvote; HN flags vote rings." },
];
