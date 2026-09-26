import type { AuxList, Callout, Frame, Marker, NodeState, Question, VEdge, VNode } from "../algorithms/types";
import { ask, nearby, rowX } from "../algorithms/util";
import { num, numList, still } from "./helpers";
import type { Run } from "../algorithms/types";
import type { TopicDef, TopicInstance, Values } from "./types";

const CODE = {
  fib: ["fib(n):            // bottom-up tabulation", "  F[0] = 0;  F[1] = 1", "  for i = 2 to n:", "    F[i] = F[i-1] + F[i-2]", "  return F[n]"],
  coins: [
    "minCoins(coins, A):",
    "  dp[0] = 0;  dp[a] = ∞ for a > 0",
    "  for a = 1 to A:",
    "    for c in coins:",
    "      if c <= a and dp[a - c] + 1 < dp[a]:",
    "        dp[a] = dp[a - c] + 1",
    "  return dp[A]",
  ],
  lcs: [
    "LCS(X, Y):",
    "  L[i][0] = L[0][j] = 0",
    "  for i = 1 to m:",
    "    for j = 1 to n:",
    "      if X[i] == Y[j]: L[i][j] = L[i-1][j-1] + 1",
    "      else: L[i][j] = max(L[i-1][j], L[i][j-1])",
    "  trace back from L[m][n] to read the subsequence",
  ],
  knap: [
    "knapsack(w, v, W):",
    "  K[0][c] = 0 for every capacity c",
    "  for i = 1 to n:",
    "    for c = 0 to W:",
    "      K[i][c] = K[i-1][c]                    // skip item i",
    "      if w[i] <= c:",
    "        K[i][c] = max(K[i][c], v[i] + K[i-1][c - w[i]])  // take it",
    "  return K[n][W]",
  ],
};

const NOTES: Record<keyof typeof CODE, string[]> = {
  fib: [
    "Bottom-up DP: compute every smaller Fibonacci number once, from the smallest up.",
    "The base cases are known without any computation.",
    "Fill the table left to right, so both values needed are always ready.",
    "The recurrence: each value is the sum of the two before it. Nothing is ever recomputed.",
    "The answer is the last cell: O(n) additions instead of O(2ⁿ) recursive calls.",
  ],
  coins: [
    "dp[a] = the fewest coins that add up to amount a.",
    "Amount 0 needs no coins; every other amount is unknown (∞) until a way is found.",
    "Solve amounts in increasing order, so every smaller amount is already solved.",
    "Try every coin as the last coin used.",
    "Using coin c on top of the best way to make a − c costs dp[a − c] + 1 coins. Keep it if it beats the best so far.",
    "Record the improvement.",
    "dp[A] is the answer (∞ would mean the amount can't be made).",
  ],
  lcs: [
    "L[i][j] = length of the longest common subsequence of X's first i letters and Y's first j letters.",
    "If either prefix is empty, the LCS is empty: row 0 and column 0 are all 0.",
    "Fill the table row by row, so the cells above, to the left and diagonally up-left are always ready.",
    "Each cell compares one letter of X with one letter of Y.",
    "Matching letters extend the best LCS of the two shorter prefixes by one: the diagonal cell + 1.",
    "Different letters: at least one of them isn't in the LCS, so drop a letter from X (the cell above) or from Y (the cell to the left) and keep the better.",
    "Walk back from the bottom-right corner: the diagonal steps on matching letters spell out the LCS.",
  ],
  knap: [
    "K[i][c] = the best total value using only the first i items with capacity c.",
    "With no items nothing can be packed: value 0 for every capacity.",
    "Add items one at a time; each row considers one more item.",
    "Solve every capacity from 0 to W for this item.",
    "Option 1, skip item i: the best value is whatever it was without it (the cell above).",
    "Option 2 is only possible if the item fits.",
    "Option 2, take item i: its value plus the best for the remaining capacity using earlier items only (the row above, so each item is used at most once). Keep the better option.",
    "The bottom-right cell is the answer; walking back shows which items were taken.",
  ],
};

const LEGEND: Run["legend"] = { current: "being computed", pending: "cells it depends on", found: "answer / traceback path", idle: "already computed", ghost: "not computed yet" };
const COMPLEXITY: Record<keyof typeof CODE, string> = { fib: "O(n) time · O(n) table", coins: "O(A × k) time", lcs: "O(m × n) time and space", knap: "O(n × W) time and space" };

const G = 1.0;

interface TableOpts {
  states?: Record<string, NodeState>;
  aux?: AuxList[];
  question?: Question;
  callouts?: Callout[];
  /** Cells the current cell is computed from: drawn as curved arrows into it. */
  deps?: { from: string; to: string }[];
  /** A traceback path, drawn as arrows between consecutive cells. */
  trace?: string[];
}

/** A rows × cols table of boxes with row/column header markers. */
class Table {
  vals: (number | string | null)[][];
  constructor(
    public rows: number,
    public cols: number,
    public rowHead: string[],
    public colHead: string[],
    public rowTitle = "",
    public colTitle = "",
  ) {
    this.vals = Array.from({ length: rows }, () => Array(cols).fill(null));
  }
  headOffset() {
    return 0.75 + 0.1 * Math.max(...this.rowHead.map((h) => h.length));
  }
  x(j: number) {
    return rowX(j, this.cols, G);
  }
  y(i: number) {
    return ((this.rows - 1) / 2 - i) * G;
  }
  frame(line: number, message: string, o: TableOpts = {}): Frame {
    const nodes: VNode[] = [];
    for (let i = 0; i < this.rows; i++)
      for (let j = 0; j < this.cols; j++) {
        const v = this.vals[i][j];
        const id = `c-${i}-${j}`;
        nodes.push({ id, label: v === null ? "" : String(v), pos: [this.x(j), this.y(i), 0], state: o.states?.[id] ?? (v === null ? "ghost" : "idle"), shape: "box", size: [0.88, 0.88, 0.5] });
      }
    const edges: VEdge[] = (o.deps ?? []).map((d) => ({ id: `dep|${d.from}|${d.to}`, from: d.from, to: d.to, state: "active", directed: true, bend: 0.75 }));
    (o.trace ?? []).slice(1).forEach((to, k) => edges.push({ id: `trace|${o.trace![k]}|${to}`, from: o.trace![k], to, state: "tree", directed: true, bend: 0.45 }));
    const markers: Marker[] = [
      ...this.colHead.map((h, j) => ({ id: `ch${j}`, text: h, pos: [this.x(j), this.y(0) + 0.85, 0] as [number, number, number], color: "#33415c" })),
      ...this.rowHead.map((h, i) => ({ id: `rh${i}`, text: h, pos: [this.x(0) - this.headOffset(), this.y(i), 0] as [number, number, number], color: "#33415c" })),
    ];
    if (this.colTitle) markers.push({ id: "ct", text: this.colTitle, pos: [0, this.y(0) + 1.5, 0], color: "#5b6886" });
    if (this.rowTitle) markers.push({ id: "rt", text: this.rowTitle, pos: [this.x(0) - this.headOffset(), this.y(0) + 0.85, 0], color: "#5b6886" });
    // Bubbles go under the cell: the cells above and to the left are the ones it depends on.
    return { nodes, edges, markers, callouts: o.callouts?.map((c) => ({ below: true, ...c })), line, message, aux: o.aux ?? [], question: o.question };
  }
}

const cell = (i: number, j: number) => `c-${i}-${j}`;
const blank = (msg: string): Run => still("Dynamic programming", new Table(1, 11, [""], [...Array(11).keys()].map((i) => `F${i}`)).frame(-1, msg));

function fib(n: number): Frame[] {
  const t = new Table(1, n + 1, [""], [...Array(n + 1).keys()].map((i) => `F${i}`));
  const fr: Frame[] = [];
  let q = 5;
  fr.push(t.frame(0, `Compute F(${n}) bottom-up. Plain recursion would recompute the same values exponentially often; the table computes each one exactly once.`));
  t.vals[0][0] = 0;
  if (n >= 1) t.vals[0][1] = 1;
  fr.push(t.frame(1, "Base cases: F(0) = 0 and F(1) = 1.", { states: { [cell(0, 0)]: "found", [cell(0, 1)]: "found" } }));
  for (let i = 2; i <= n; i++) {
    const a = t.vals[0][i - 1] as number;
    const b = t.vals[0][i - 2] as number;
    const deps = [{ from: cell(0, i - 1), to: cell(0, i) }, { from: cell(0, i - 2), to: cell(0, i) }];
    fr.push(t.frame(2, `F(${i}) needs the two values just before it: F(${i - 1}) = ${a} and F(${i - 2}) = ${b}.`, { states: { [cell(0, i)]: "current", [cell(0, i - 1)]: "pending", [cell(0, i - 2)]: "pending" }, deps, question: q-- > 0 ? ask(`What is F(${i})?`, a + b, nearby(a + b, 3), `F(${i}) = F(${i - 1}) + F(${i - 2}) = ${a} + ${b} = ${a + b}. Both values are already in the table, so nothing is recomputed.`) : undefined }));
    t.vals[0][i] = a + b;
    fr.push(t.frame(3, `F(${i}) = ${a} + ${b} = ${a + b}.`, { states: { [cell(0, i)]: "found" }, callouts: [{ at: cell(0, i), text: `${a} + ${b} = ${a + b}`, tone: "good" }] }));
  }
  fr.push(t.frame(4, `F(${n}) = ${t.vals[0][n]}. That took ${Math.max(n - 1, 0)} additions: O(n) instead of O(2ⁿ).`, { states: { [cell(0, n)]: "found" } }));
  return fr;
}

function coins(cs: number[], A: number): Frame[] {
  const t = new Table(1, A + 1, [""], [...Array(A + 1).keys()].map(String), "", "amount");
  const fr: Frame[] = [];
  let q = 5;
  const dp: number[] = Array(A + 1).fill(Infinity);
  const show = () => dp.forEach((v, a) => (t.vals[0][a] = v === Infinity ? "∞" : v));
  const aux = [{ label: "Coins", items: cs.map(String) }];
  fr.push(t.frame(0, `Fewest coins from {${cs.join(", ")}} that add up to ${A}. Greedy (largest coin first) can fail; DP tries every coin as the last one.`, { aux }));
  dp[0] = 0;
  show();
  fr.push(t.frame(1, "dp[0] = 0: no coins needed for amount 0. Every other amount starts at ∞ (not reachable yet).", { aux, states: { [cell(0, 0)]: "found" } }));
  for (let a = 1; a <= A; a++) {
    const usable = cs.filter((c) => c <= a);
    const options = usable.filter((c) => dp[a - c] !== Infinity).map((c) => dp[a - c] + 1);
    const best = options.length ? Math.min(...options) : Infinity;
    const deps = usable.map((c) => ({ from: cell(0, a - c), to: cell(0, a) }));
    fr.push(t.frame(2, `Amount ${a}: the last coin could be ${usable.length ? usable.join(", ") : "none of them (all too big)"}. Each option needs dp[${a} − coin] + 1 coins.`, { aux, deps, states: { [cell(0, a)]: "current", ...Object.fromEntries(usable.map((c) => [cell(0, a - c), "pending" as NodeState])) }, question: q-- > 0 && best !== Infinity ? ask(`What is dp[${a}]?`, best, nearby(best, 2), `Try each coin as the last one: ${usable.map((c) => `coin ${c} → dp[${a - c}] + 1 = ${dp[a - c] === Infinity ? "∞" : dp[a - c] + 1}`).join(", ")}. The minimum is ${best}.`) : undefined }));
    let bestCoin = 0;
    for (const c of usable) {
      const cand = dp[a - c] + 1;
      if (cand < dp[a]) {
        dp[a] = cand;
        bestCoin = c;
      }
    }
    show();
    const parts = usable.map((c) => `dp[${a - c}]+1`).join(", ");
    fr.push(t.frame(dp[a] === Infinity ? 3 : 5, dp[a] === Infinity ? `No coin fits, so amount ${a} can't be made.` : `Best: a ${bestCoin}-coin on top of dp[${a - bestCoin}] = ${dp[a - bestCoin]}, so dp[${a}] = ${dp[a]}.`, { aux, states: { [cell(0, a)]: "found" }, callouts: [{ at: cell(0, a), text: dp[a] === Infinity ? "∞" : `min(${parts}) = ${dp[a]}`, tone: "good" }] }));
  }
  fr.push(t.frame(6, dp[A] === Infinity ? `${A} can't be made from these coins.` : `The answer is dp[${A}] = ${dp[A]} coin${dp[A] === 1 ? "" : "s"}. O(A × number of coins) time.`, { aux, states: { [cell(0, A)]: "found" } }));
  return fr;
}

function lcs(X: string, Y: string): Frame[] {
  const m = X.length;
  const n = Y.length;
  const t = new Table(m + 1, n + 1, ["∅", ...X], ["∅", ...Y], "X \\ Y");
  const L = t.vals as number[][];
  const fr: Frame[] = [];
  let q = 6;
  fr.push(t.frame(0, `Longest common subsequence of "${X}" and "${Y}". Cell L[i][j] holds the LCS length of X's first i letters and Y's first j letters.`));
  for (let i = 0; i <= m; i++) L[i][0] = 0;
  for (let j = 0; j <= n; j++) L[0][j] = 0;
  fr.push(t.frame(1, "An empty prefix shares nothing: row 0 and column 0 are all 0."));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const match = X[i - 1] === Y[j - 1];
      const up = L[i - 1][j];
      const left = L[i][j - 1];
      const val = match ? L[i - 1][j - 1] + 1 : Math.max(up, left);
      const deps = match ? [{ from: cell(i - 1, j - 1), to: cell(i, j) }] : [{ from: cell(i - 1, j), to: cell(i, j) }, { from: cell(i, j - 1), to: cell(i, j) }];
      const states: Record<string, NodeState> = { [cell(i, j)]: "current", ...Object.fromEntries(deps.map((d) => [d.from, "pending" as NodeState])) };
      const question = q-- > 0 ? ask(`What is L[${i}][${j}]?`, val, nearby(val, 2), match ? `X[${i}] = Y[${j}] = '${X[i - 1]}', so extend the diagonal: L[${i - 1}][${j - 1}] + 1 = ${L[i - 1][j - 1]} + 1 = ${val}.` : `'${X[i - 1]}' ≠ '${Y[j - 1]}', so take the better neighbour: max(above ${up}, left ${left}) = ${val}.`) : undefined;
      if (question) fr.push(t.frame(match ? 4 : 5, match ? `X[${i}] = '${X[i - 1]}' and Y[${j}] = '${Y[j - 1]}' match.` : `X[${i}] = '${X[i - 1]}' and Y[${j}] = '${Y[j - 1]}' differ.`, { states, deps, question }));
      L[i][j] = val;
      fr.push(
        t.frame(match ? 4 : 5, match ? `'${X[i - 1]}' = '${Y[j - 1]}': extend the diagonal. L[${i}][${j}] = ${L[i - 1][j - 1]} + 1 = ${val}.` : `'${X[i - 1]}' ≠ '${Y[j - 1]}': take the better of above (${up}) and left (${left}). L[${i}][${j}] = ${val}.`, {
          states,
          deps,
          callouts: [{ at: cell(i, j), text: match ? `match: ${L[i - 1][j - 1]} + 1 = ${val}` : `max(${up}, ${left}) = ${val}`, tone: match ? "good" : "info" }],
        }),
      );
    }
    fr.push(t.frame(2, `Row ${i} ('${X[i - 1]}') is complete.`));
  }
  // Trace back.
  const pathCells: string[] = [];
  const path: Record<string, NodeState> = {};
  let i = m;
  let j = n;
  const out: string[] = [];
  while (i > 0 && j > 0) {
    pathCells.push(cell(i, j));
    path[cell(i, j)] = "found";
    if (X[i - 1] === Y[j - 1]) {
      out.unshift(X[i - 1]);
      i--;
      j--;
    } else if (L[i - 1][j] >= L[i][j - 1]) i--;
    else j--;
  }
  fr.push(t.frame(6, `LCS length = ${L[m][n]}. Tracing back from the corner, each diagonal step on a match contributes a letter: "${out.join("")}". O(m × n) time.`, { states: path, trace: pathCells, aux: [{ label: "LCS", items: out }], callouts: [{ at: cell(m, n), text: `LCS = "${out.join("")}"`, tone: "good" }] }));
  return fr;
}

function knapsack(items: { w: number; v: number }[], W: number): Frame[] {
  const n = items.length;
  const t = new Table(n + 1, W + 1, ["0", ...items.map((it, k) => `#${k + 1} w${it.w} v${it.v}`)], [...Array(W + 1).keys()].map(String), "item", "capacity c");
  const K = t.vals as number[][];
  const fr: Frame[] = [];
  let q = 6;
  const aux = [{ label: "Items (weight, value)", items: items.map((it, k) => `#${k + 1}: ${it.w}, ${it.v}`) }];
  fr.push(t.frame(0, `0/1 knapsack with capacity ${W}. Cell K[i][c] = the best value using only the first i items with capacity c.`, { aux }));
  for (let c = 0; c <= W; c++) K[0][c] = 0;
  fr.push(t.frame(1, "With no items nothing can be packed: row 0 is all 0.", { aux }));
  for (let i = 1; i <= n; i++) {
    const { w, v } = items[i - 1];
    for (let c = 0; c <= W; c++) {
      const fits = w <= c;
      const skip = K[i - 1][c];
      const take = fits ? v + K[i - 1][c - w] : -1;
      const val = Math.max(skip, take);
      const deps = [{ from: cell(i - 1, c), to: cell(i, c) }, ...(fits ? [{ from: cell(i - 1, c - w), to: cell(i, c) }] : [])];
      const states: Record<string, NodeState> = { [cell(i, c)]: "current", ...Object.fromEntries(deps.map((d) => [d.from, "pending" as NodeState])) };
      const question = fits && q-- > 0 ? ask(`What is K[${i}][${c}]?`, val, [skip, take, ...nearby(val, 2)], `Skip item ${i}: K[${i - 1}][${c}] = ${skip}. Take it: ${v} + K[${i - 1}][${c - w}] = ${v} + ${K[i - 1][c - w]} = ${take}. The better option gives ${val}.`) : undefined;
      if (question) fr.push(t.frame(6, `Item ${i} (weight ${w}, value ${v}) fits in capacity ${c}. Skip it, or take it?`, { aux, states, deps, question }));
      K[i][c] = val;
      fr.push(
        t.frame(fits ? 6 : 4, fits ? `Skip item ${i}: ${skip}. Take it: ${v} + K[${i - 1}][${c - w}] = ${take}. Keep the better: ${val}.` : `Item ${i} (weight ${w}) doesn't fit in capacity ${c}: copy ${skip} from the row above.`, {
          aux,
          states,
          deps,
          callouts: [{ at: cell(i, c), text: fits ? `max(${skip}, ${v}+${K[i - 1][c - w]}) = ${val}` : `too heavy → ${skip}`, tone: fits && take > skip ? "good" : "info" }],
        }),
      );
    }
  }
  const pathCells: string[] = [];
  const path: Record<string, NodeState> = {};
  const chosen: string[] = [];
  let c = W;
  for (let i = n; i >= 1; i--) {
    pathCells.push(cell(i, c));
    path[cell(i, c)] = "found";
    if (K[i][c] !== K[i - 1][c]) {
      chosen.unshift(`#${i}`);
      c -= items[i - 1].w;
    }
  }
  fr.push(t.frame(7, `Best value ${K[n][W]}. Walking back, a change from the row above means that item was taken: ${chosen.join(", ") || "nothing"}. O(n × W) time.`, { aux: [...aux, { label: "Chosen", items: chosen }], states: path, trace: pathCells, callouts: [{ at: cell(n, W), text: `best = ${K[n][W]}`, tone: "good" }] }));
  return fr;
}

const mk = (title: string, variant: string, code: string[], frames: Frame[]): Run => {
  const key = (Object.keys(CODE) as (keyof typeof CODE)[]).find((k) => CODE[k] === code)!;
  return { title, variant, code, notes: NOTES[key], legend: LEGEND, complexity: COMPLEXITY[key], frames };
};

export const dp1Topic: TopicDef = {
  id: "dp-1d",
  name: "DP: Fibonacci & coins",
  category: "Dynamic programming",
  icon: "🧮",
  blurb: "1-D tables: each entry is built from a few earlier entries.",
  create(): TopicInstance {
    return {
      fields: [
        { id: "n", label: "n / amount", kind: "number", default: "10" },
        { id: "coins", label: "Coins", kind: "text", default: "1, 3, 4" },
      ],
      actions: [
        { id: "fib", label: "Fibonacci F(n)", run: (v) => { const n = num(v.n, "n", 2, 14); return typeof n === "string" ? n : mk(`Fibonacci F(${n})`, "Bottom-up tabulation of Fibonacci numbers with F(0)=0, F(1)=1.", CODE.fib, fib(n)); } },
        { id: "coins", label: "Min coins for amount", run: (v) => {
          const A = num(v.n, "Amount", 1, 14);
          const cs = numList(v.coins, "Coins", 1, 5, 1, 14);
          if (typeof A === "string") return A;
          if (typeof cs === "string") return cs;
          return mk(`Min coins for ${A}`, "Unbounded coin change, minimum number of coins, 1-D bottom-up table.", CODE.coins, coins([...new Set(cs)].sort((x, y) => x - y), A));
        } },
      ],
      presets: [
        { label: "Greedy fails", fill: { coins: "1, 3, 4", n: "6" }, run: () => blank("Coins 1, 3, 4 and amount 6. Greedy picks 4+1+1 (3 coins); DP finds 3+3 (2 coins). Press Min coins.") },
      ],
      view: () => blank("Compute Fibonacci numbers or the fewest coins for an amount, one table cell at a time."),
    };
  },
};

export const lcsTopic: TopicDef = {
  id: "dp-lcs",
  name: "DP: Longest common subsequence",
  category: "Dynamic programming",
  icon: "🧬",
  blurb: "A 2-D table over two strings. Matches extend the diagonal; mismatches take the best neighbour.",
  create(): TopicInstance {
    const text = (v: Values, k: string) => (v[k] ?? "").trim().toUpperCase();
    return {
      fields: [
        { id: "x", label: "X", kind: "text", default: "ABCBDAB" },
        { id: "y", label: "Y", kind: "text", default: "BDCABA" },
      ],
      actions: [
        { id: "lcs", label: "Compute LCS", run: (v) => {
          const X = text(v, "x");
          const Y = text(v, "y");
          if (!/^[A-Z]{1,8}$/.test(X) || !/^[A-Z]{1,8}$/.test(Y)) return "X and Y must each be 1–8 letters.";
          return mk(`LCS("${X}", "${Y}")`, "Longest common subsequence with an (m+1)×(n+1) table; traceback prefers moving up on ties.", CODE.lcs, lcs(X, Y));
        } },
      ],
      presets: [
        { label: "CLRS example", fill: { x: "ABCBDAB", y: "BDCABA" }, run: () => blank('X = "ABCBDAB", Y = "BDCABA" (the classic textbook example). Press Compute LCS.') },
        { label: "Short example", fill: { x: "AGGTAB", y: "GXTXAYB" }, run: () => blank('X = "AGGTAB", Y = "GXTXAYB". The answer is "GTAB".') },
      ],
      view: () => blank("Enter two words and press Compute LCS."),
    };
  },
};

export const knapsackTopic: TopicDef = {
  id: "dp-knapsack",
  name: "DP: 0/1 knapsack",
  category: "Dynamic programming",
  icon: "🎒",
  blurb: "Items × capacity table: for each cell, skip the item or take it and look one row up.",
  create(): TopicInstance {
    return {
      fields: [
        { id: "w", label: "Weights", kind: "text", default: "1, 3, 4, 5" },
        { id: "v", label: "Values", kind: "text", default: "1, 4, 5, 7" },
        { id: "W", label: "Capacity", kind: "number", default: "7" },
      ],
      actions: [
        { id: "knap", label: "Solve", run: (v) => {
          const ws = numList(v.w, "Weights", 1, 5, 1, 10);
          const vs = numList(v.v, "Values", 1, 5, 1, 99);
          const W = num(v.W, "Capacity", 1, 10);
          if (typeof ws === "string") return ws;
          if (typeof vs === "string") return vs;
          if (typeof W === "string") return W;
          if (ws.length !== vs.length) return "Weights and values need the same number of entries.";
          return mk(`0/1 knapsack, W = ${W}`, "0/1 knapsack with a 2-D table K[i][c] over items and capacities; each item used at most once.", CODE.knap, knapsack(ws.map((w, i) => ({ w, v: vs[i] })), W));
        } },
      ],
      presets: [
        { label: "Textbook example", fill: { w: "1, 3, 4, 5", v: "1, 4, 5, 7", W: "7" }, run: () => blank("Weights 1,3,4,5 and values 1,4,5,7 with W = 7. The best is 9 (items 2 and 3).") },
      ],
      view: () => blank("Enter item weights and values (up to 5 items) and a capacity up to 10, then press Solve."),
    };
  },
};
