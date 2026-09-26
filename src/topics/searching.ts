import type { Frame, NodeState, Run } from "../algorithms/types";
import { ask, collect, randomInts } from "../algorithms/util";
import { arrayFrame, newItem, type Item } from "./arrayView";
import { num, numList, still } from "./helpers";
import type { TopicDef } from "./types";

const CODE = {
  linear: ["linearSearch(A, x):", "  for i = 0 to n - 1:", "    if A[i] == x: return i", "  return -1"],
  binary: [
    "binarySearch(A, x):     // A is sorted",
    "  lo = 0;  hi = n - 1",
    "  while lo <= hi:",
    "    mid = floor((lo + hi) / 2)",
    "    if A[mid] == x: return mid",
    "    if A[mid] < x: lo = mid + 1",
    "    else: hi = mid - 1",
    "  return -1",
  ],
};

const NOTES = {
  linear: [
    "Works on any array, sorted or not.",
    "Look at every position in turn, from left to right.",
    "Stop at the first element equal to x.",
    "Every element was checked without a match, so x is not in the array.",
  ],
  binary: [
    "Only works on sorted data: comparing with one element tells us which half the target must be in.",
    "The target, if present, is somewhere in A[lo..hi]. Start with the whole array.",
    "While the range still has at least one element, keep halving it.",
    "Look at the middle of the range. Rounding down keeps mid inside the range.",
    "Lucky hit: the middle element is the target.",
    "A[mid] is too small, and everything left of it is even smaller: throw away mid and the whole left side.",
    "A[mid] is too big, and everything right of it is even bigger: throw away mid and the whole right side.",
    "The range became empty (lo passed hi): the target isn't in the array.",
  ],
};

function* linear(items: Item[], x: number): Generator<Frame> {
  const st: Record<string, NodeState> = {};
  const aux = (c: number) => [{ label: "Comparisons", items: [String(c)] }];
  yield arrayFrame({ slots: items, line: 0, message: `Linear search for ${x}: check the elements one by one, left to right.`, aux: aux(0) });
  for (let i = 0; i < items.length; i++) {
    const hit = items[i].v === x;
    yield arrayFrame({ slots: items, line: 2, message: `Check A[${i}] = ${items[i].v}.`, pointers: [{ text: "i", index: i }], states: { ...st, [items[i].id]: hit ? "found" : "current" }, aux: aux(i + 1), callouts: [{ at: items[i].id, text: hit ? `${x} found ✓` : `${items[i].v} ≠ ${x}`, tone: hit ? "good" : "info" }] });
    if (hit) {
      yield arrayFrame({ slots: items, line: 2, message: `Found ${x} at index ${i} after ${i + 1} comparison${i ? "s" : ""}.`, pointers: [{ text: "i", index: i }], states: { ...st, [items[i].id]: "found" }, aux: aux(i + 1) });
      return;
    }
    st[items[i].id] = "visited";
  }
  yield arrayFrame({ slots: items, line: 3, message: `All ${items.length} elements checked, no match: ${x} is not present. That's ${items.length} comparisons, O(n).`, states: st, aux: aux(items.length) });
}

function* binary(items: Item[], x: number): Generator<Frame> {
  let lo = 0;
  let hi = items.length - 1;
  let comps = 0;
  const states = () => Object.fromEntries(items.map((it, k) => [it.id, (k < lo || k > hi ? "ghost" : "pending") as NodeState]));
  const aux = () => [
    { label: "Search range", items: [`lo=${lo}`, `hi=${hi}`, `${Math.max(hi - lo + 1, 0)} left`] },
    { label: "Comparisons", items: [String(comps)] },
  ];
  const ptrs = (mid?: number) => [
    { text: "lo", index: lo, color: "#22a06b" },
    { text: "hi", index: hi, color: "#d97706" },
    ...(mid !== undefined ? [{ text: "mid", index: mid, color: "#ff4f9a" }] : []),
  ];
  yield arrayFrame({ slots: items, line: 0, message: `Binary search for ${x}. The array is sorted, so every comparison can rule out half of what's left: at most ${Math.floor(Math.log2(items.length)) + 1} comparisons for ${items.length} elements.`, aux: aux() });
  yield arrayFrame({ slots: items, line: 1, message: `The target could be anywhere: lo = 0, hi = ${hi}.`, pointers: ptrs(), states: states(), aux: aux() });
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    yield arrayFrame({ slots: items, line: 2, message: `${hi - lo + 1} candidate${hi === lo ? "" : "s"} left (indices ${lo}..${hi}).`, pointers: ptrs(), states: states(), aux: aux(), question: ask(`lo = ${lo}, hi = ${hi}. What is mid?`, mid, [mid - 1, mid + 1, Math.ceil((lo + hi) / 2) === mid ? mid + 2 : Math.ceil((lo + hi) / 2), lo, hi], `mid = ⌊(lo + hi) / 2⌋ = ⌊${lo + hi} / 2⌋ = ${mid}. Always round down, so mid stays inside the range even when it has two elements.`) });
    comps++;
    const v = items[mid].v as number;
    const hit = v === x;
    yield arrayFrame({
      slots: items,
      line: 3,
      message: `mid = ⌊(${lo} + ${hi}) / 2⌋ = ${mid}. Compare A[${mid}] = ${v} with ${x}.`,
      pointers: ptrs(mid),
      states: { ...states(), [items[mid].id]: hit ? "found" : "current" },
      aux: aux(),
      callouts: [{ at: items[mid].id, text: hit ? `${v} = ${x} ✓` : v < x ? `${v} < ${x} → go right` : `${v} > ${x} → go left`, tone: hit ? "good" : "info" }],
      question: hit ? undefined : ask(`A[mid] = ${v}, target = ${x}. Where does the search continue?`, v < x ? "right half (lo = mid + 1)" : "left half (hi = mid - 1)", ["left half (hi = mid - 1)", "right half (lo = mid + 1)"], v < x ? `${v} < ${x}. The array is sorted, so everything at or left of index ${mid} is ≤ ${v} < ${x}: the target can only be to the right. lo = ${mid} + 1.` : `${v} > ${x}. The array is sorted, so everything at or right of index ${mid} is ≥ ${v} > ${x}: the target can only be to the left. hi = ${mid} − 1.`),
    });
    if (hit) {
      yield arrayFrame({ slots: items, line: 4, message: `Found ${x} at index ${mid} after ${comps} comparison${comps > 1 ? "s" : ""}.`, pointers: ptrs(mid), states: { ...states(), [items[mid].id]: "found" }, aux: aux() });
      return;
    }
    const dropped = v < x ? mid - lo + 1 : hi - mid + 1;
    if (v < x) lo = mid + 1;
    else hi = mid - 1;
    yield arrayFrame({ slots: items, line: v < x ? 5 : 6, message: v < x ? `${v} < ${x}, so ${x} can only be to the right. Discard ${dropped} element${dropped === 1 ? "" : "s"}: lo = ${lo}.` : `${v} > ${x}, so ${x} can only be to the left. Discard ${dropped} element${dropped === 1 ? "" : "s"}: hi = ${hi}.`, pointers: ptrs(), states: states(), aux: aux() });
  }
  yield arrayFrame({ slots: items, line: 7, message: `lo (${lo}) passed hi (${hi}): nothing left to check, so ${x} is not present. Only ${comps} comparisons.`, pointers: ptrs(), states: states(), aux: aux() });
}

export const searchingTopic: TopicDef = {
  id: "searching",
  name: "Searching",
  category: "Searching & sorting",
  icon: "🔎",
  blurb: "Linear search is O(n). Binary search on a sorted array is O(log n).",
  create() {
    let items = randomInts(13, 1, 99).sort((a, b) => a - b).map(newItem);
    const view = (msg: string) => still("Sorted array", arrayFrame({ slots: items, line: -1, message: msg }));
    const target = (v: Record<string, string>) => num(v.target, "Target", 0, 999);
    const run = (kind: "binary" | "linear", x: number, frames: Frame[]): Run => ({
      title: `${kind === "binary" ? "Binary" : "Linear"} search for ${x}`,
      variant: kind === "binary" ? "Iterative binary search on a sorted array with inclusive bounds lo..hi and mid = floor((lo+hi)/2)." : "Linear search from index 0.",
      code: CODE[kind],
      notes: NOTES[kind],
      legend: kind === "binary" ? { current: "middle element", pending: "still possible", found: "target", ghost: "ruled out" } : { current: "being checked", visited: "checked, no match", found: "target", idle: "not checked yet" },
      complexity: kind === "binary" ? "O(log n) · needs sorted data" : "O(n) · works on any array",
      frames,
    });
    return {
      fields: [
        { id: "target", label: "Target", kind: "number", default: "50" },
        { id: "list", label: "Custom array", kind: "text", default: "", wide: true },
      ],
      actions: [
        { id: "binary", label: "Binary search", run: (v) => { const x = target(v); return typeof x === "string" ? x : run("binary", x, collect(binary(items, x))); } },
        { id: "linear", label: "Linear search", run: (v) => { const x = target(v); return typeof x === "string" ? x : run("linear", x, collect(linear(items, x))); } },
      ],
      presets: [
        { label: "Random sorted array", run: () => { items = randomInts(13, 1, 99).sort((a, b) => a - b).map(newItem); return view("New sorted array."); } },
        { label: "Use custom array", run: (v) => { const l = numList(v.list, "Custom array", 2, 16); if (typeof l !== "string") items = [...l].sort((a, b) => a - b).map(newItem); return view(typeof l === "string" ? l : "Custom array loaded (sorted for binary search)."); } },
      ],
      view: () => view("Enter a target and compare how many steps linear and binary search need. Tip: pick a value from the array, or one that is missing."),
    };
  },
};
