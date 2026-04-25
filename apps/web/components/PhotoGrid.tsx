type Props = {
  urls: string[];
};

// Lightweight responsive photo grid — 1 photo full-width, 2 side-by-side,
// 3 stacked-with-strip, 4 in a 2x2. No lightbox yet.
export function PhotoGrid({ urls }: Props) {
  if (urls.length === 0) return null;
  return (
    <div className={`mt-3 grid gap-1 ${gridCls(urls.length)}`}>
      {urls.map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt={`Session photo ${i + 1}`}
          loading="lazy"
          className={`block h-full w-full rounded-md object-cover ${aspectCls(urls.length, i)}`}
        />
      ))}
    </div>
  );
}

function gridCls(n: number): string {
  if (n === 1) return "grid-cols-1";
  if (n === 2) return "grid-cols-2";
  if (n === 3) return "grid-cols-3";
  return "grid-cols-2";
}

function aspectCls(n: number, _i: number): string {
  if (n === 1) return "aspect-[16/9]";
  return "aspect-square";
}
