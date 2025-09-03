import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Get Cosy – Find cosy hotel rooms",
  description: "Curated cosy getaways.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header style={{ borderBottom: "1px solid #e5e5e5" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Link href="/en" style={{ fontWeight: 600, textDecoration: "none", color: "inherit" }}>Get Cosy</Link>
            <nav style={{ display: "flex", gap: 12 }}>
              <Link href="/en/hotels" style={{ textDecoration: "none", color: "inherit" }}>Explore</Link>
              <Link href="/admin/candidates" style={{ textDecoration: "none", color: "inherit" }}>Admin</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer style={{ borderTop: "1px solid #e5e5e5", marginTop: 24 }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "16px 24px", color: "#666", fontSize: 14 }}>
            © {new Date().getFullYear()} Get Cosy · Find cosy hotel rooms
          </div>
        </footer>
      </body>
    </html>
  );
}
