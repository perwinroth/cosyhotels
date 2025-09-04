import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Affiliate Disclosure",
};

export default function DisclosurePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Affiliate Disclosure</h1>
      <div className="prose prose-zinc mt-6">
        <p>
          We may earn a commission when you click links to book hotels through our partners (such as Booking.com) at no extra cost to you.
          This supports our work curating cosy, characterful stays.
        </p>
        <p>
          Links are marked as sponsored and include tracking parameters so partners can attribute bookings to us. We do not sell personal data.
        </p>
        <p>
          For questions, contact support@cosyhotelroom.com.
        </p>
      </div>
    </div>
  );
}

