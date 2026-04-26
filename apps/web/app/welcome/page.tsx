// Real welcome page lives in commit 2; this stub keeps /welcome routable
// so the middleware-driven redirect lands somewhere coherent.
export const dynamic = "force-dynamic";

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <p className="text-sm text-zinc-500">Loading welcome…</p>
    </main>
  );
}
