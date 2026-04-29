import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalHeader } from "@/components/GlobalHeader";
import { StartSessionFab } from "@/components/StartSessionFab";
import { WeatherStrip } from "@/components/WeatherStrip";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

// Resolves the user's preference into a concrete light|dark class and
// applies it to <html> BEFORE the first paint. Auto mode (no localStorage
// entry) consults prefers-color-scheme exactly once here — never lets
// CSS @media queries handle it independently — so the class is the
// SINGLE source of truth across both our CSS-var system and Tailwind's
// `dark:` variant. Without that single source you get the bug where
// "force light + OS dark" leaves text inputs dark because legacy
// `dark:bg-zinc-900` classes still fire off the OS.
const NO_FLASH_THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('windsiren.theme');
    var resolved;
    if (stored === 'light' || stored === 'dark') {
      resolved = stored;
    } else {
      resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add('theme-' + resolved);
  } catch (e) {
    document.documentElement.classList.add('theme-light');
  }
})();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        <GlobalHeader />
        <WeatherStrip />
        <div className="flex-1">{children}</div>
        <footer className="mt-12 border-t border-border bg-paper-sunk/60 px-6 py-6 text-center text-[11px] text-ink-mute">
          <p>
            Weather data by{" "}
            <a
              href="https://open-meteo.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-link underline-offset-2 hover:underline"
            >
              Open-Meteo.com
            </a>{" "}
            · KNMI HARMONIE-AROME ·{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-link underline-offset-2 hover:underline"
            >
              CC BY 4.0
            </a>
          </p>
          <p className="mt-1 font-mono text-[10px] tracking-wider text-ink-faint">
            WINDSIREN — KITE FORECASTS FOR THE NETHERLANDS
          </p>
        </footer>
        <StartSessionFab signedIn={!!user} />
      </body>
    </html>
  );
}
