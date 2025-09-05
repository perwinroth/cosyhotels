import type { Metadata } from "next";
import "./globals.css";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-black">
        {children}
        <Footer locale="en" />
      </body>
    </html>
  );
}
