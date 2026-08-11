import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infinite Breaker · Supreme Edition",
  description: "A premium retro brick-breaker roguelite with campaign, bosses, builds and infinite arcade modes.",
  manifest: "/manifest.webmanifest",
  other: { "codex-preview": "development" },
};

export const viewport: Viewport = { themeColor: "#0e0a20", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
