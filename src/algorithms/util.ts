/** Drain a step generator into an array so the player can scrub backwards. */
export function collect<T>(gen: Generator<T, unknown>): T[] {
  const out: T[] = [];
  for (let r = gen.next(); !r.done; r = gen.next()) out.push(r.value);
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The correct answer plus up to three distractors drawn from `pool`, shuffled. */
export function makeOptions(answer: string, pool: string[]): string[] {
  const distractors = shuffle(pool.filter((p) => p !== answer)).slice(0, 3);
  return shuffle([answer, ...distractors]);
}

export function shuffled<T>(arr: T[]): T[] {
  return shuffle(arr);
}

/** Build a question whose correct answer is `answer`, with distractors from `pool`. */
export function ask(prompt: string, answer: string | number, pool: (string | number)[], explain?: string) {
  const a = String(answer);
  return { prompt, answer: a, options: makeOptions(a, [...new Set(pool.map(String))]), explain };
}

/** Numeric distractors near the true value, for "what value goes here?" questions. */
export function nearby(n: number, spread = 3): number[] {
  const out = new Set<number>();
  for (let d = -spread; d <= spread; d++) if (d !== 0 && n + d >= 0) out.add(n + d);
  return [...out];
}

/** Centre `n` items spaced `gap` apart; returns x for index i. */
export const rowX = (i: number, n: number, gap: number) => (i - (n - 1) / 2) * gap;

export function randomInts(n: number, lo = 1, hi = 99, unique = true): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  while (out.length < n) {
    const v = lo + Math.floor(Math.random() * (hi - lo + 1));
    if (unique && seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
