export const site = {
  name: "Got Cosy?",
  // Fallback is the CURRENT canonical host. The old default (www.cosyhotelroom.com) 308-redirects
  // to gotcosy.com, so if NEXT_PUBLIC_SITE_URL were ever unset every canonical would point at a
  // redirected host. Prod sets the env var; this hardens the default anyway.
  url: process.env.NEXT_PUBLIC_SITE_URL || "https://gotcosy.com",
  tagline: "AI-rated cosy hotels",
  description: "Hotels ranked by cosiness — scored 0–10 by AI for warmth, character and intimacy, not just stars.",
  affiliate: {
    source: "get-cosy",
    medium: "affiliate",
    campaign: "hotel_page",
  },
};
