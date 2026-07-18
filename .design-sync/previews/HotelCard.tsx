import HotelCard from "../../src/components/HotelCard";

const saveLabels = {
  save: "Save to collection", saveShort: "Save", added: "Added", emailPrompt: "Want to find your collections later?",
  emailLabel: "Email", emailPlaceholder: "you@example.com", consent: "Email me my collection link",
  titleLabel: "Collection name", titlePlaceholder: "Summer in Gotland", submit: "Save", cancel: "Cancel",
  copyLink: "Copy link", copied: "Copied", viewPlan: "View collection", yourPrivateLink: "Your private link",
  emailInvalid: "That email does not look right", genericError: "Something went wrong, try again",
  marketingConsent: "Send me occasional cosy finds", findByEmail: "Find my collections",
};

const photo = "data:image/svg+xml;utf8," + encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='160'><rect width='240' height='160' fill='#DCCFBF'/><circle cx='185' cy='38' r='18' fill='#F4E9DA'/><path d='M0 118 L60 70 L120 112 L170 78 L240 122 L240 160 L0 160 Z' fill='#A8B8A0'/></svg>`
);

export const RankedSearchResult = () => (
  <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: 640 }}>
    <HotelCard
      slug="hotel-stelor" name="Hotel Stelor" city="Gotland" country="Sweden" score={8.6}
      rank={1} clampSnippet snippetEyebrow="Why it's cosy" photo={photo}
      snippet="A 1700s farmhouse turned seven-room hideaway where guests praise the candlelit barn dinners, thick stone walls and hosts who remember your name at breakfast."
      locale="en" saveLabels={saveLabels} stay22Href="https://example.com/booking"
      shareTitle="Hotel Stelor" shareUrl="https://gotcosy.com/en/hotels/hotel-stelor"
    />
  </ul>
);

export const CuratedNoRank = () => (
  <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: 640 }}>
    <HotelCard
      slug="sisters-simenc-apartments" name="Sisters Šimenc Apartments" city="Bled" country="Slovenija" score={7.1}
      snippet="Family-run rooms a short stroll from the lake, with home-baked bread at breakfast and sisters who treat guests like old friends."
      locale="en" saveLabels={saveLabels} stay22Href="https://example.com/booking"
    />
  </ul>
);

export const VerifiedWrongUsesWebsite = () => (
  <ul style={{ listStyle: "none", margin: 0, padding: 0, maxWidth: 640 }}>
    <HotelCard
      slug="brae-example" name="Glenlyon Guest House" city="Edinburgh" country="United Kingdom" score={7.9}
      snippet="When the booking partner's landing page failed our real-browser verification, the primary button swaps to the hotel's own website."
      locale="en" saveLabels={saveLabels} stay22Href="https://example.com/booking"
      website="https://example-hotel-website.co.uk" isVerifiedWrong
    />
  </ul>
);
