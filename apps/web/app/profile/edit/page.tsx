import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { EditProfileForm } from "./EditProfileForm";

export const dynamic = "force-dynamic";

export default async function EditProfilePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const { data: row } = await supabase
    .from("users")
    .select("display_name, bio")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <Link
        href="/profile"
        className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        ← Back to account
      </Link>
      <h1 className="mt-4 text-3xl font-bold tracking-tight">Edit profile</h1>
      <EditProfileForm
        userId={user.id}
        initialDisplayName={row?.display_name ?? null}
        initialBio={row?.bio ?? null}
      />
    </main>
  );
}
