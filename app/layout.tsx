import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "EONET Live | Natural Events Tracker",
  description:
    "Real-time NASA EONET natural event tracker with interactive map",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Read nonce so Next.js propagates it to its auto-injected <script> tags.
  await headers();

  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="preconnect"
          href="https://accounts.google.com"
          crossOrigin=""
        />
        <link
          rel="preconnect"
          href="https://basemaps.cartocdn.com"
          crossOrigin=""
        />
        <link
          rel="preconnect"
          href="https://tiles.basemaps.cartocdn.com"
          crossOrigin=""
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
