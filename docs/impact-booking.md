# Booking.com via Impact — Step-by-step

This guide explains how to connect your Booking.com affiliate links using Impact and wire them into the app.

## 1) Join Booking.com on Impact
- Create/sign in to your Impact account and apply to the Booking.com program.
- Ensure your site URL matches your canonical domain: `https://cosyhotelroom.com`.
- Verify your site and complete compliance pages (Privacy, Affiliate disclosure).

## 2) Understand Impact link structure
- Impact tracking links redirect to a Booking.com destination URL.
- Links support sub IDs (e.g., `subId1`) for click attribution.

## 3) Store affiliate links in the app
- For each hotel, store an Impact tracking link as the base `affiliate_url` in Supabase `affiliate_overrides`.
- Use the JSON import endpoint for quick testing:

```http
POST /api/affiliate/import
{
  "records": [
    { "slug": "atelier-rivoli-paris", "affiliateUrl": "https://tracking.impact.com/...", "price": 240 }
  ]
}
```

## 4) Outbound links from the app
- All CTAs point to `/go/[id]` which builds the final URL with UTMs and Impact sub IDs.
- Example link adding sub ID: `/go/atelier-rivoli-paris?provider=impact&clickId=homepage-cta-1`
- The app maps `clickId` → Impact `subId1` and appends `utm_*` parameters.

## 5) Click logging
- `/go/[id]` logs clicks in `affiliate_clicks` (Supabase). Ensure env vars are set:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## 6) QA checklist
- Verify `/` and `/en/hotels` return 200 OK and are indexable.
- Confirm Impact sees your site at `https://cosyhotelroom.com`.
- Click a CTA and ensure the Impact report shows your `subId1`.
- Confirm final redirect lands on booking.com.

## 7) Production rollout
- Use Vercel Preview to validate redirects, UTMs, sub IDs.
- Populate overrides for top hotels and monitor impact reports.

