import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
