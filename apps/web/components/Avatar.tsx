type Props = {
  url: string | null;
  name: string | null;
  size?: number;
};

// Circular profile photo. Empty state: a colored disc with the user's
// first initial — color is deterministic from the name string so the
// same user always gets the same fallback color.
export function Avatar({ url, name, size = 96 }: Props) {
  const initial = (name?.trim() || "?").charAt(0).toUpperCase();
  const bg = bgColorFor(name ?? "");
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full"
      style={{ width: size, height: size, backgroundColor: bg }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name ? `${name}'s avatar` : "User avatar"}
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center font-semibold text-white"
          style={{ fontSize: Math.round(size * 0.4) }}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

// Hash-based pick from a small palette. Stable per name + dark-mode safe.
function bgColorFor(seed: string): string {
  if (!seed) return "#71717a";
  const palette = [
    "#10b981", // emerald
    "#3b82f6", // blue
    "#8b5cf6", // violet
    "#f59e0b", // amber
    "#ec4899", // pink
    "#06b6d4", // cyan
    "#14b8a6", // teal
    "#84cc16", // lime
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return palette[Math.abs(hash) % palette.length]!;
}
