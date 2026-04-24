import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  // Fetch the profile row from public.users (created by our handle_new_user trigger)
  const { data: profile } = await supabase
    .from("users")
    .select("display_name, locale, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
        ← Home
      </Link>
      <h1 className="mt-4 text-4xl font-bold tracking-tight">Your account</h1>

      <dl className="mt-8 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-zinc-500">Email</dt>
        <dd className="font-mono">{user.email}</dd>

        <dt className="text-zinc-500">Display name</dt>
        <dd>{profile?.display_name ?? <span className="text-zinc-400">(not set)</span>}</dd>

        <dt className="text-zinc-500">Locale</dt>
        <dd className="font-mono">{profile?.locale ?? "nl-NL"}</dd>

        <dt className="text-zinc-500">Member since</dt>
        <dd>
          {profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString("en-NL", { dateStyle: "long" })
            : "—"}
        </dd>
      </dl>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link
          href={`/users/${user.id}`}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          View public profile
        </Link>
        <Link
          href="/profile/edit"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
        >
          Edit profile
        </Link>
        <form action="/auth/sign-out" method="post">
          <button
            type="submit"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
