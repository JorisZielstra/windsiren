// Tiny TTL cache used by the Open-Meteo provider to avoid re-hitting the
// network for the same (model, lat, lng, days) within 30 min. HARMONIE
// only updates hourly, so anything tighter is wasted bandwidth and
// risks tripping Open-Meteo's free-tier rate limit.
//
// Process-local in-memory only — fine because every consumer here is
// either a Next.js server handler (per-process cache survives a request
// burst) or React Native (per-app-instance). For a worker with many
// concurrent processes you'd want Redis; out of scope for v1.

type Entry<T> = {
  value: T;
  expiresAt: number;
};

export class TtlCache<T> {
  private readonly store = new Map<string, Entry<T>>();
  private readonly ttlMs: number;

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const hit = this.store.get(key);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  // For tests — wipe everything.
  clear(): void {
    this.store.clear();
  }

  // For tests — pretend an entry expired without waiting in real time.
  expire(key: string): void {
    const hit = this.store.get(key);
    if (hit) hit.expiresAt = 0;
  }
}
