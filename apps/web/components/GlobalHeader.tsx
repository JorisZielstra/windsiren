import Link from "next/link";
import { getPublicProfile } from "@windsiren/core";
import { Avatar } from "@/components/Avatar";
import { createSupabaseServerClient } from "@/lib/supabase-server";

// Sticky brand + nav at the top of every page. Sits on the paper-sunk
// surface so the hero card below floats above it. Brand uses the
// display headline class for tighter tracking.
export async function GlobalHeader() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user ? await getPublicProfile(supabase, user.id) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-paper-sunk/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <Link
          href="/"
          className="headline flex items-baseline gap-1.5 text-base text-ink"
        >
          <span className="text-brand">windsiren</span>
          <span className="hidden text-[10px] font-mono uppercase tracking-[0.2em] text-ink-mute sm:inline">
            kite
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm">
          <NavLink href="/" label="Today" />
          <NavLink href="/spots" label="Spots" />
          <NavLink href="/map" label="Map" />
          {user ? <NavLink href="/feed" label="Feed" /> : null}
          {user ? (
            <Link
              href="/profile"
              aria-label="Profile"
              className="ml-1 rounded-full ring-1 ring-border-strong transition-shadow hover:ring-brand sm:ml-2"
            >
              <Avatar
                url={profile?.avatar_url ?? null}
                name={profile?.display_name ?? null}
                size={32}
              />
            </Link>
          ) : (
            <Link
              href="/auth/sign-in"
              className="ml-1 rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-strong sm:ml-2 sm:px-3.5 sm:text-sm"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-1.5 text-[13px] text-ink-2 transition-colors hover:bg-paper-2 hover:text-ink sm:px-3 sm:text-sm"
    >
      {label}
    </Link>
  );
}
