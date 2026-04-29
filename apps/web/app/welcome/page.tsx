import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabase } from "@/lib/supabase";
import { dbRowToSpot } from "@windsiren/core";
import { WelcomeForm } from "./WelcomeForm";

export const dynamic = "force-dynamic";

export default async function WelcomePage() {
  // The middleware already redirects unauthenticated visitors to /auth/sign-in
  // before we get here, but guard anyway in case the middleware is bypassed.
  const authed = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: profileRow } = await authed
    .from("users")
    .select("display_name, bio, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const { data: spotRows } = await supabase
    .from("spots")
    .select("*")
    .eq("active", true)
    .order("name");
  const spots = (spotRows ?? []).map(dbRowToSpot);

  // Default the display name to the email's local-part so the user has
  // something sensible pre-filled rather than a blank field.
  const defaultName =
    profileRow?.display_name?.trim() || user.email?.split("@")[0] || "";

  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold tracking-tight">Welcome to WindSiren</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Two things to set up — both optional, both editable later.
      </p>

      <WelcomeForm
        userId={user.id}
        spots={spots}
        defaultDisplayName={defaultName}
        defaultBio={profileRow?.bio ?? ""}
        defaultAvatarUrl={profileRow?.avatar_url ?? null}
      />
    </main>
  );
}
