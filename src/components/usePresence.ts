import { useEffect, useState } from "react";

export interface Presence<T> {
  item: T;
  leaving: boolean;
}

/**
 * Keeps items that just disappeared from `items` around for `exitMs`, flagged as leaving,
 * so they can animate out instead of vanishing. An item that comes back is revived.
 */
export function usePresence<T>(items: T[], keyOf: (t: T) => string, exitMs: number): Presence<T>[] {
  const [prev, setPrev] = useState(items);
  const [ghosts, setGhosts] = useState<Map<string, { item: T; since: number }>>(() => new Map());

  // "Adjust state while rendering" pattern: diff against the previous items when they change.
  if (items !== prev) {
    const live = new Set(items.map(keyOf));
    const next = new Map(ghosts);
    const now = performance.now();
    for (const it of prev) {
      const k = keyOf(it);
      if (!live.has(k) && !next.has(k)) next.set(k, { item: it, since: now });
    }
    for (const k of live) next.delete(k);
    setPrev(items);
    setGhosts(next);
  }

  useEffect(() => {
    if (!ghosts.size) return;
    const oldest = Math.min(...[...ghosts.values()].map((g) => g.since));
    const wait = Math.max(0, oldest + exitMs - performance.now()) + 16;
    const t = setTimeout(() => {
      const now = performance.now();
      setGhosts((g) => {
        const next = new Map([...g].filter(([, v]) => now - v.since < exitMs));
        return next.size === g.size ? g : next;
      });
    }, wait);
    return () => clearTimeout(t);
  }, [ghosts, exitMs]);

  const out: Presence<T>[] = items.map((item) => ({ item, leaving: false }));
  for (const g of ghosts.values()) out.push({ item: g.item, leaving: true });
  return out;
}
