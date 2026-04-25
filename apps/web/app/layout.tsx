import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalHeader } from "@/components/GlobalHeader";
import { WeatherStrip } from "@/components/WeatherStrip";
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
  title: "WindSiren — kite forecasts, sessions, and friends",
  description:
    "When and where to go kite. NL spot forecasts with live wind, tides, and a community of kiters.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950">
        <GlobalHeader />
        <WeatherStrip />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
