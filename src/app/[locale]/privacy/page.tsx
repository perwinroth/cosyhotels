import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <div className="prose prose-zinc mt-6">
        <p>We respect your privacy and only collect the minimum data needed to operate and improve the site.</p>

        <h2>What we collect</h2>
        <ul>
          <li><strong>Usage analytics</strong>: anonymous page views and events (e.g. filter usage). Used to understand what’s working and fix issues.</li>
          <li><strong>Outbound clicks</strong>: when you click a booking link, we record a basic log (time, hotel slug, referral parameters). Used for performance reporting and fraud prevention.</li>
          <li><strong>Shortlists</strong>: if you create a public shortlist, the title and included hotels are stored under a public URL slug. No personal information is required.</li>
        </ul>

        <h2>Cookies and local storage</h2>
        <p>We may use cookies for analytics and affiliate attribution. We also use local storage on your device to remember your most recent shortlist slug so you can keep adding to it. You can clear these at any time in your browser.</p>

        <h2>Lawful basis</h2>
        <p>Our lawful basis for processing is legitimate interests: operating the website, measuring performance, and preventing abuse. Where required, we will request consent for analytics cookies.</p>

        <h2>Retention</h2>
        <p>Analytics events are retained in aggregate. Affiliate click logs are retained as required for reporting. Public shortlists remain accessible until removed by us.</p>

        <h2>Third parties</h2>
        <p>We work with analytics providers and affiliate networks (e.g., Impact/Booking.com). These services may receive basic event or click information to attribute bookings and measure traffic.</p>

        <h2>Your rights</h2>
        <p>You may contact us to request removal of public shortlist pages you created or to ask questions about this policy.</p>

        <h2>Contact</h2>
        <p>Email: support@cosyhotelroom.com</p>
      </div>
    </div>
  );
}
