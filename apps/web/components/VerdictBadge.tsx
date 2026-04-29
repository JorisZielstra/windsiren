import type { Verdict } from "@windsiren/shared";

type Props = {
  verdict: Verdict | null;
};

// Pill-shaped GO / MAYBE / NO GO badge used wherever a single spot's
// verdict needs to be summarized at a glance: home page collapsible,
// /spots index, search results.
export function VerdictBadge({ verdict }: Props) {
  if (verdict === null) {
    return (
      <span className="rounded-full bg-paper-sunk px-3 py-1 text-xs font-medium text-ink-mute">
        No data
      </span>
    );
  }
  const styles: Record<typeof verdict.decision, string> = {
    go: "verdict-go",
    marginal: "verdict-maybe",
    no_go: "verdict-no-go",
  };
  const labels: Record<typeof verdict.decision, string> = {
    go: "GO",
    marginal: "MAYBE",
    no_go: "NO GO",
  };
  return (
    <span
      className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.15em] ${styles[verdict.decision]}`}
    >
      {labels[verdict.decision]}
    </span>
  );
}
