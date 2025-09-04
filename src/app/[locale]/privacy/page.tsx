import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <div className="prose prose-zinc mt-6">
        <p>We respect your privacy. This page outlines what we collect and why.</p>
        <h2>Data we collect</h2>
        <ul>
          <li>Anonymous analytics (page views, events) to improve the product.</li>
          <li>Outbound click logs to affiliate partners to measure performance.</li>
        </ul>
        <h2>Cookies</h2>
        <p>We may use cookies for analytics and attribution. You can block cookies in your browser settings.</p>
        <h2>Third parties</h2>
        <p>We work with affiliate networks and analytics providers. They may receive basic click and pageview data.</p>
        <h2>Contact</h2>
        <p>If you have questions, contact us at support@cosyhotelroom.com.</p>
      </div>
    </div>
  );
}

