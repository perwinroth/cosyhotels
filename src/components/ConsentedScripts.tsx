"use client";
import { useEffect, useState } from "react";
import Script from "next/script";
import { hasAnalyticsConsent, onConsentChange } from "@/lib/consent";

// Stay22 LetMeAllez (LMA): rewrites on-page OTA links into Stay22 affiliate links client-side.
// Non-essential (affiliate tracking): must not load until the visitor accepts. Moved verbatim out
// of the root layout so it can be mounted/unmounted reactively on consent change, with no page
// reload required when the visitor clicks Accept.
export default function ConsentedScripts() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(hasAnalyticsConsent());
    return onConsentChange(() => setAllowed(hasAnalyticsConsent()));
  }, []);

  if (!allowed) return null;

  return (
    <Script id="stay22-lma" strategy="afterInteractive">
      {`(function (s, t, a, y, twenty, two) {
          s.Stay22 = s.Stay22 || {};
          s.Stay22.params = { lmaID: '${process.env.NEXT_PUBLIC_STAY22_LMAID || "6a346ecbb0b5e9d8d1e48a12"}' };
          twenty = t.createElement(a);
          two = t.getElementsByTagName(a)[0];
          twenty.async = 1;
          twenty.src = y;
          two.parentNode.insertBefore(twenty, two);
      })(window, document, 'script', 'https://scripts.stay22.com/letmeallez.js');`}
    </Script>
  );
}
