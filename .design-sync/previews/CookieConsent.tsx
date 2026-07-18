import CookieConsent from "../../src/components/CookieConsent";

// transform creates a containing block, so the component's position:fixed
// banner renders inside the card cell instead of escaping to the viewport.
export const Banner = () => (
  <div style={{ transform: "translateZ(0)", position: "relative", minHeight: 180, width: "100%", maxWidth: 720 }}>
    <CookieConsent labels={{
      message: "We use a few cookies to understand what helps you find a cosy stay. No ad tracking, ever.",
      accept: "Accept", reject: "Only essentials", privacy: "Privacy policy",
    }} />
  </div>
);
