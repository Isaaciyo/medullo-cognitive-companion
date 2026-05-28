import type { Metadata } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const dancing = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Medullo — Second Brain",
  description: "A quiet second working memory. Pick up where you left off.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${dancing.variable}`}>
      <body className="font-sans bg-canvas text-ink-900 min-h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
