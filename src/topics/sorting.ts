import type { Callout, Frame, Marker, NodeState, Question, Run, VEdge, VNode, Vec3 } from "../algorithms/types";
import { ask, randomInts, rowX } from "../algorithms/util";
import { newItem, type Item } from "./arrayView";
import { numList, still } from "./helpers";
import type { TopicDef } from "./types";

type Algo = "bubble" | "selection" | "insertion" | "merge" | "quick" | "heap";

const CODE: Record<Algo, string[]> = {
  bubble: [
    "bubbleSort(A):",
    "  for i = 0 to n - 2:",
    "    swapped = false",
    "    for j = 0 to n - 2 - i:",
    "      if A[j] > A[j + 1]:",
    "        swap(A[j], A[j + 1]);  swapped = true",
    "    if not swapped: break     // already sorted",
  ],
  selection: [
    "selectionSort(A):",
    "  for i = 0 to n - 2:",
    "    min = i",
    "    for j = i + 1 to n - 1:",
    "      if A[j] < A[min]: min = j",
    "    swap(A[i], A[min])",
  ],
  insertion: [
    "insertionSort(A):",
    "  for i = 1 to n - 1:",
    "    key = A[i]",
    "    j = i - 1",
    "    while j >= 0 and A[j] > key:",
    "      A[j + 1] = A[j]      // shift right",
    "      j = j - 1",
    "    A[j + 1] = key",
  ],
  merge: [
    "mergeSort(A, lo, hi):",
    "  if lo >= hi: return",
    "  mid = floor((lo + hi) / 2)",
    "  mergeSort(A, lo, mid)",
    "  mergeSort(A, mid + 1, hi)",
    "  merge(A, lo, mid, hi)",
    "",
    "merge(A, lo, mid, hi):",
    "  i = lo;  j = mid + 1;  k = lo",
    "  while i <= mid and j <= hi:",
    "    if A[i] <= A[j]: T[k++] = A[i++]",
    "    else:            T[k++] = A[j++]",
    "  copy leftovers of A[i..mid] / A[j..hi] to T",
    "  copy T[lo..hi] back into A[lo..hi]",
  ],
  quick: [
    "quickSort(A, lo, hi):",
    "  if lo < hi:",
    "    p = partition(A, lo, hi)",
    "    quickSort(A, lo, p - 1)",
    "    quickSort(A, p + 1, hi)",
    "",
    "partition(A, lo, hi):     // Lomuto",
    "  pivot = A[hi]",
    "  i = lo - 1",
    "  for j = lo to hi - 1:",
    "    if A[j] <= pivot:",
    "      i = i + 1;  swap(A[i], A[j])",
    "  swap(A[i + 1], A[hi])",
    "  return i + 1",
  ],
  heap: [
    "heapSort(A):",
    "  for i = n/2 - 1 down to 0:     // build max-heap",
    "    siftDown(A, i, n)",
    "  for end = n - 1 down to 1:",
    "    swap(A[0], A[end])         // max to its final place",
    "    siftDown(A, 0, end)",
    "",
    "siftDown(A, i, size):",
    "  while 2i + 1 < size:",
    "    c = larger child of i",
    "    if A[i] >= A[c]: return",
    "    swap(A[i], A[c]);  i = c",
  ],
};

const NOTES: Record<Algo, string[]> = {
  bubble: [
    "Sorts in place by repeatedly swapping neighbours that are in the wrong order.",
    "After pass i the largest i + 1 values have bubbled to the end and are final, so each pass can stop one step earlier.",
    "Track whether this pass changes anything: if nothing moves, the array is already sorted.",
    "Walk through the unsorted part, comparing each neighbouring pair.",
    "A larger value before a smaller one is out of order. Equal values are left alone, which keeps bubble sort stable.",
    "Swapping carries the larger value one step to the right, like a bubble rising.",
    "A whole pass without swaps proves every neighbour is in order, so stop early. That's why the best case is O(n).",
  ],
  selection: [
    "Sorts by repeatedly selecting the smallest remaining value.",
    "Position i gets the smallest value among A[i..n−1]; everything before i is already final.",
    "Start by assuming the first unsorted value is the smallest.",
    "Scan the rest of the unsorted part for anything smaller.",
    "Remember the index of the smallest value seen so far.",
    "Move the minimum into position i: one swap per pass, at most n − 1 in total. This long-distance swap is what makes selection sort unstable.",
  ],
  insertion: [
    "Builds a sorted prefix one element at a time, like sorting playing cards in your hand.",
    "A[0..i−1] is already sorted; now insert A[i] into it.",
    "Lift the new value out so its slot can be reused while larger values shift right.",
    "Start comparing with the last element of the sorted prefix.",
    "Every value bigger than the key must move right. Stopping at a smaller-or-equal value keeps the sort stable.",
    "Shift the larger value one slot right, into the gap.",
    "Move left to compare with the next value in the sorted prefix.",
    "The gap is exactly where the key belongs: everything to its left is ≤ key, everything to its right is > key.",
  ],
  merge: [
    "Divide and conquer: sort each half, then merge the two sorted halves.",
    "A range with zero or one element is already sorted, so the recursion stops here.",
    "Split into two halves of (almost) equal size, so the recursion is only log₂ n levels deep.",
    "Recursively sort the left half.",
    "Recursively sort the right half.",
    "Both halves are sorted now, so one linear pass can combine them.",
    "",
    "Merging walks both sorted halves from the front, always taking the smaller head.",
    "i scans the left half, j the right half, and k is the next free slot in the temp array T.",
    "While both halves have values left, the smaller of the two heads is the next smallest overall.",
    "Ties take the left value (≤), so equal keys keep their original order: merge sort is stable.",
    "The right head is strictly smaller, so it goes next.",
    "When one half runs out, the rest of the other half is already sorted and larger than everything taken, so it is copied as is.",
    "T[lo..hi] now holds the merged, sorted range; write it back into A.",
  ],
  quick: [
    "Divide and conquer around a pivot: after partitioning, the pivot sits in its final place and each side is sorted separately.",
    "A range with zero or one element is already sorted.",
    "partition moves the pivot to its final index p and returns it.",
    "Everything left of p is ≤ pivot: sort it on its own.",
    "Everything right of p is > pivot: sort it on its own.",
    "",
    "Lomuto partitioning uses the last element as the pivot and grows a '≤ pivot' zone from the left.",
    "The last element is the pivot. On already-sorted input every split is lopsided, which is the O(n²) worst case.",
    "i marks the end of the '≤ pivot' zone, which starts empty.",
    "j visits every other element in the range exactly once.",
    "Values ≤ pivot belong in the left zone; larger values stay where they are for now.",
    "Grow the zone by one and swap the small value into it. These long jumps are why quicksort isn't stable.",
    "Put the pivot right after the zone: everything before it is ≤ pivot and everything after is > pivot, so it's in its final position.",
    "Report where the pivot landed so the recursion can split there.",
  ],
  heap: [
    "Treat the array as a complete binary tree: the children of index i are 2i + 1 and 2i + 2.",
    "Indices n/2 and above are leaves, which are already heaps; fix the internal nodes from the bottom up.",
    "Push A[i] down until it beats both children. Doing this bottom-up builds the heap in O(n).",
    "Each round the heap shrinks by one and the sorted suffix grows from the right.",
    "The root of a max-heap is the largest remaining value, so it belongs at the end of the unsorted part.",
    "The value swapped into the root breaks the heap property; sifting it down repairs the heap in O(log n).",
    "",
    "Restores the max-heap property below index i, looking only at the first size elements.",
    "Keep going while i still has a child inside the heap.",
    "Compare with the larger child: if the parent has to move, only the larger child can replace it.",
    "The parent already beats both children, so the heap property holds here and below.",
    "Swap the parent down and continue from the child's position.",
  ],
};

const LEGENDS: Record<Algo, Run["legend"]> = {
  bubble: { current: "being compared", removing: "being swapped", visited: "in final position", idle: "unsorted" },
  selection: { current: "being checked", found: "smallest so far", removing: "swapped out", visited: "in final position", idle: "unsorted" },
  insertion: { found: "key being inserted", current: "being compared", pending: "just shifted right", visited: "sorted prefix", idle: "not inserted yet" },
  merge: { current: "heads being compared", pending: "in temp array T", found: "merged run", visited: "sorted", ghost: "outside the current range", idle: "waiting" },
  quick: { found: "pivot", current: "being compared", removing: "being swapped", visited: "in final position", ghost: "outside the current range", idle: "unsorted" },
  heap: { current: "sifting down", pending: "larger child", removing: "being swapped", found: "heap root = max", visited: "sorted suffix", ghost: "outside the heap", idle: "in the heap" },
};

const COMPLEXITY: Record<Algo, string> = {
  bubble: "O(n²) · best O(n) · in place · stable",
  selection: "O(n²) always · in place · not stable",
  insertion: "O(n²) · best O(n) · in place · stable",
  merge: "O(n log n) · O(n) extra space · stable",
  quick: "O(n log n) avg · O(n²) worst · not stable",
  heap: "O(n log n) · in place · not stable",
};

const VARIANTS: Record<Algo, string> = {
  bubble: "Bubble sort with the early-exit 'swapped' flag. Stable, O(n²) worst case, O(n) best case.",
  selection: "Selection sort choosing the minimum of the unsorted suffix each pass. Not stable, always O(n²) comparisons, at most n-1 swaps.",
  insertion: "Insertion sort that shifts larger elements right and drops the key into the gap. Stable, O(n²) worst, O(n) on sorted input.",
  merge: "Top-down recursive merge sort with mid = floor((lo+hi)/2) and an auxiliary array T. Stable (ties take the left element), O(n log n).",
  quick: "Quicksort with Lomuto partitioning and the last element as the pivot. Not stable, O(n log n) average, O(n²) worst case on sorted input.",
  heap: "In-place heap sort: build a max-heap bottom-up, then repeatedly swap the root to the end and sift down. Not stable, O(n log n).",
};

export const SORT_NAMES: Record<Algo, string> = { bubble: "Bubble", selection: "Selection", insertion: "Insertion", merge: "Merge", quick: "Quick", heap: "Heap" };

const GAP = 1.0;
const TEMP_Y = -6;
const TREE_NODE: Vec3 = [0.7, 0.7, 0.7];

interface FrameOpts {
  states?: Record<string, NodeState>;
  ptrs?: { text: string; index: number; color?: string }[];
  temp?: (Item | null)[];
  lift?: { item: Item; index: number };
  question?: Question;
  range?: [number, number];
  callouts?: Callout[];
  /** Heap sort: draw the first `heap` elements as a binary tree above the bars. */
  heap?: number;
}

class Sorter {
  a: Item[];
  max: number;
  comps = 0;
  writes = 0;
  qLeft = 6;
  sorted = new Set<string>();
  frames: Frame[] = [];
  barScale = 4;

  constructor(values: number[]) {
    this.a = values.map(newItem);
    this.max = Math.max(...values, 1);
  }

  h(v: number) {
    return 0.5 + (v / this.max) * this.barScale;
  }

  /** Ask at most a handful of questions per run so playback stays snappy. */
  q(prompt: string, answer: string | number, pool: (string | number)[], explain?: string): Question | undefined {
    if (this.qLeft <= 0) return undefined;
    this.qLeft--;
    return ask(prompt, answer, pool, explain);
  }

  frame(line: number, message: string, o: FrameOpts = {}): Frame {
    const n = this.a.length;
    const nodes: VNode[] = [];
    const edges: VEdge[] = [];
    const bar = (it: Item, pos: Vec3, st: NodeState): VNode => {
      const h = this.h(it.v as number);
      return { id: it.id, label: String(it.v), pos: [pos[0], pos[1] + h / 2, pos[2]], state: st, shape: "box", size: [0.78, h, 0.78], labelAbove: true };
    };
    const inTemp = new Set((o.temp ?? []).filter(Boolean).map((t) => t!.id));
    const stateOf = (it: Item, i: number): NodeState => {
      const dim = o.range && (i < o.range[0] || i > o.range[1]);
      return o.states?.[it.id] ?? (this.sorted.has(it.id) ? "visited" : dim ? "ghost" : "idle");
    };
    this.a.forEach((it, i) => {
      if (!it || inTemp.has(it.id) || o.lift?.item.id === it.id) return;
      nodes.push(bar(it, [rowX(i, n, GAP), 0, 0], stateOf(it, i)));
    });
    (o.temp ?? []).forEach((it, k) => {
      if (it) nodes.push(bar(it, [rowX(k, n, GAP), TEMP_Y, 0], o.states?.[it.id] ?? "pending"));
    });
    if (o.lift) nodes.push(bar(o.lift.item, [rowX(o.lift.index, n, GAP), 0.6, 1.6], "found"));

    // Heap sort: the heap part of the array drawn as the tree it represents.
    if (o.heap !== undefined) {
      const levels = Math.floor(Math.log2(Math.max(n, 1))) + 1;
      const width = Math.max(2 ** (levels - 1) * 0.95, 3);
      const top = 0.5 + this.barScale + 1.6 + (levels - 1) * 1.15;
      const treePos = (i: number): Vec3 => {
        const d = Math.floor(Math.log2(i + 1));
        const p = i - (2 ** d - 1);
        return [((p + 0.5) / 2 ** d - 0.5) * width, top - d * 1.15, 0];
      };
      for (let i = 0; i < o.heap; i++) {
        const it = this.a[i];
        const st = stateOf(it, i);
        nodes.push({ id: `ht-${it.id}`, label: String(it.v), pos: treePos(i), state: st === "ghost" ? "idle" : st, size: TREE_NODE });
        if (i > 0) {
          const p = Math.floor((i - 1) / 2);
          edges.push({ id: `hte-${i}`, from: `ht-${this.a[p].id}`, to: `ht-${it.id}`, state: "idle" });
        }
      }
    }

    const markers: Marker[] = [];
    const stack: Record<number, number> = {};
    for (const p of o.ptrs ?? []) {
      const k = (stack[p.index] = (stack[p.index] ?? 0) + 1) - 1;
      markers.push({ id: `ptr-${p.text}`, text: p.text, arrow: k === 0 ? "up" : undefined, pos: [rowX(p.index, n, GAP), -0.55 - k * 0.45, 0.3], color: p.color });
    }
    if (o.temp) markers.push({ id: "temp-label", text: "temp array T", pos: [rowX(-0.7, n, GAP), TEMP_Y + 0.4, 0], color: "#5b6886", align: "right", size: 0.26 });
    return {
      nodes,
      edges,
      markers,
      callouts: o.callouts,
      line,
      message,
      question: o.question,
      aux: [
        { label: "Array", items: this.a.map((i) => (i ? String(i.v) : "_")) },
        { label: "Cost so far", items: [`${this.comps} comparisons`, `${this.writes} swaps/writes`] },
      ],
    };
  }

  push(line: number, message: string, o: FrameOpts = {}) {
    this.frames.push(this.frame(line, message, o));
  }

  swap(i: number, j: number) {
    [this.a[i], this.a[j]] = [this.a[j], this.a[i]];
    if (i !== j) this.writes++;
  }

  v(i: number) {
    return this.a[i].v as number;
  }

  allSorted(msg: string, line: number) {
    for (const it of this.a) this.sorted.add(it.id);
    this.push(line, msg);
  }

  // ---------------- algorithms ----------------

  bubble() {
    const n = this.a.length;
    this.push(0, "Bubble sort: compare neighbours and swap them when they're out of order. Each pass carries the largest remaining value to the end.");
    for (let i = 0; i <= n - 2; i++) {
      let swapped = false;
      this.push(1, `Pass ${i + 1}: the last ${i} value${i === 1 ? " is" : "s are"} already in place, so we only scan up to index ${n - 1 - i}.`, { ptrs: [{ text: "i", index: i }] });
      this.push(2, "No swaps yet in this pass.");
      for (let j = 0; j <= n - 2 - i; j++) {
        const [x, y] = [this.a[j], this.a[j + 1]];
        this.comps++;
        const will = this.v(j) > this.v(j + 1);
        this.push(4, `Compare neighbours A[${j}] = ${x.v} and A[${j + 1}] = ${y.v}.`, {
          states: { [x.id]: "current", [y.id]: "current" },
          ptrs: [{ text: "j", index: j }],
          question: this.q(`Will ${x.v} and ${y.v} be swapped?`, will ? "Yes" : "No", ["Yes", "No"], will ? `${x.v} > ${y.v}: the bigger value is on the left, so they swap and ${x.v} carries on moving right.` : `${x.v} ≤ ${y.v}: they're already in order. Bubble sort only swaps when the left value is strictly bigger, which also keeps equal values in order (stable).`),
          callouts: [{ at: [x.id, y.id], text: will ? `${x.v} > ${y.v} → swap` : `${x.v} ≤ ${y.v} → keep`, tone: will ? "warn" : "info" }],
        });
        if (will) {
          this.swap(j, j + 1);
          swapped = true;
          this.push(5, `${x.v} is bigger, so it moves right past ${y.v}.`, { states: { [x.id]: "removing", [y.id]: "removing" }, ptrs: [{ text: "j", index: j }] });
        }
      }
      const done = this.a[n - 1 - i];
      this.sorted.add(done.id);
      this.push(3, `End of pass ${i + 1}: ${done.v} is the largest value left, and it has bubbled to its final place.`, { callouts: [{ at: done.id, text: `${done.v} is final`, tone: "good" }] });
      if (!swapped) {
        this.allSorted(`Pass ${i + 1} made no swaps, so every neighbour is already in order. Stop early.`, 6);
        return;
      }
    }
    this.allSorted("Sorted! Every pass fixed one more value at the end.", 0);
  }

  selection() {
    const n = this.a.length;
    this.push(0, "Selection sort: find the smallest value in the unsorted part and swap it to the front of that part.");
    for (let i = 0; i <= n - 2; i++) {
      const rest = this.a.slice(i).map((it) => it.v as number);
      const minV = Math.min(...rest);
      this.push(1, `Pass ${i + 1}: find the value that belongs at index ${i}.`, { ptrs: [{ text: "i", index: i }], question: this.q(`Which value will end up at index ${i}?`, minV, rest, `Selection sort puts the smallest value of the unsorted part A[${i}..${n - 1}] at index ${i}. The smallest of ${rest.join(", ")} is ${minV}.`) });
      let min = i;
      this.push(2, `Start with A[${i}] = ${this.v(i)} as the smallest so far.`, { states: { [this.a[i].id]: "found" }, ptrs: [{ text: "i", index: i }, { text: "min", index: i, color: "#8b5cf6" }] });
      for (let j = i + 1; j < n; j++) {
        this.comps++;
        const smaller = this.v(j) < this.v(min);
        this.push(4, `Is A[${j}] = ${this.v(j)} smaller than the current minimum ${this.v(min)}?`, {
          states: { [this.a[min].id]: "found", [this.a[j].id]: "current" },
          ptrs: [{ text: "i", index: i }, { text: "min", index: min, color: "#8b5cf6" }, { text: "j", index: j }],
          callouts: [{ at: this.a[j].id, text: smaller ? `${this.v(j)} < ${this.v(min)} → new min` : `${this.v(j)} ≥ ${this.v(min)}`, tone: smaller ? "good" : "info" }],
        });
        if (smaller) min = j;
      }
      const [x, y] = [this.a[i], this.a[min]];
      this.swap(i, min);
      this.sorted.add(this.a[i].id);
      this.push(
        5,
        min === i ? `${x.v} was already the smallest, so it stays. Index ${i} is final.` : `The minimum is ${y.v}. Swap it with ${x.v} so index ${i} holds it for good.`,
        { states: { [x.id]: min === i ? "visited" : "removing", [y.id]: "visited" }, ptrs: [{ text: "i", index: i }], callouts: [{ at: y.id, text: min === i ? "already in place" : `swap → index ${i}`, tone: "good" }] },
      );
    }
    this.allSorted("Sorted! Each pass placed the next smallest value.", 0);
  }

  insertion() {
    const n = this.a.length;
    this.sorted.add(this.a[0].id);
    this.push(0, "Insertion sort: the left part is kept sorted. Take the next value and slide it left into its place.");
    for (let i = 1; i < n; i++) {
      const key = this.a[i];
      const target = this.a.slice(0, i).filter((it) => (it.v as number) <= (key.v as number)).length;
      this.push(1, `A[0..${i - 1}] is sorted. Next to insert: A[${i}] = ${key.v}.`, { ptrs: [{ text: "i", index: i }] });
      this.push(2, `Lift ${key.v} out, leaving a gap behind it.`, { lift: { item: key, index: i }, ptrs: [{ text: "i", index: i }], question: this.q(`At which index will ${key.v} be inserted?`, target, [...Array(i + 1).keys()], `${target} of the sorted values ${this.a.slice(0, i).map((x) => x.v).join(", ")} are ≤ ${key.v}, so ${key.v} goes right after them, at index ${target}. Equal values stay in front of it, which keeps the sort stable.`), callouts: [{ at: key.id, text: `key = ${key.v}`, tone: "info" }] });
      let j = i - 1;
      this.push(3, `Compare with the sorted values from right to left, starting at j = ${j}.`, { lift: { item: key, index: i }, ptrs: [{ text: "j", index: j }] });
      const row: (Item | null)[] = [...this.a];
      row[i] = null;
      for (;;) {
        this.comps += j >= 0 ? 1 : 0;
        if (j < 0 || (row[j]!.v as number) <= (key.v as number)) {
          this.a = row as Item[];
          this.push(4, j < 0 ? `Reached the front: ${key.v} is the smallest so far.` : `${row[j]!.v} ≤ ${key.v}, so everything to the left is smaller too. Stop shifting.`, {
            lift: { item: key, index: j + 1 },
            ptrs: j >= 0 ? [{ text: "j", index: j }] : [],
            states: j >= 0 ? { [row[j]!.id]: "current" } : {},
            callouts: j >= 0 ? [{ at: row[j]!.id, text: `${row[j]!.v} ≤ ${key.v} → stop`, tone: "good" }] : undefined,
          });
          break;
        }
        const moved = row[j]!;
        this.a = row as Item[];
        this.push(4, `${moved.v} > ${key.v}, so ${moved.v} has to move right.`, { lift: { item: key, index: j + 1 }, ptrs: [{ text: "j", index: j }], states: { [moved.id]: "current" }, callouts: [{ at: moved.id, text: `${moved.v} > ${key.v} → shift`, tone: "warn" }] });
        row[j + 1] = moved;
        row[j] = null;
        this.writes++;
        this.a = row as Item[];
        this.push(5, `Shift ${moved.v} one slot right; the gap moves left to index ${j}.`, { lift: { item: key, index: j }, states: { [moved.id]: "pending" } });
        j--;
        this.push(6, j >= 0 ? `Next compare with A[${j}] = ${row[j]!.v}.` : "No more values to the left.", { lift: { item: key, index: j + 1 }, ptrs: j >= 0 ? [{ text: "j", index: j }] : [] });
      }
      row[j + 1] = key;
      this.writes++;
      this.a = row as Item[];
      for (let k = 0; k <= i; k++) this.sorted.add(this.a[k].id);
      this.push(7, `Drop ${key.v} into the gap at index ${j + 1}. Now A[0..${i}] is sorted.`, { states: { [key.id]: "found" }, callouts: [{ at: key.id, text: `inserted at ${j + 1}`, tone: "good" }] });
    }
    this.allSorted("Sorted! Every value was slid into place in the growing sorted prefix.", 0);
  }

  merge() {
    this.push(0, "Merge sort: split the array in half, sort each half, then merge the two sorted halves into one.");
    this.mergeRec(0, this.a.length - 1);
    this.allSorted("Sorted! log₂ n levels of splitting, each merged in linear time: O(n log n).", 0);
  }

  private mergeRec(lo: number, hi: number) {
    this.push(1, lo >= hi ? `A[${lo}..${hi}] has a single value, which is already sorted.` : `Sort A[${lo}..${hi}] (${hi - lo + 1} values).`, { range: [lo, hi], ptrs: [{ text: "lo", index: lo, color: "#22a06b" }, { text: "hi", index: hi, color: "#d97706" }] });
    if (lo >= hi) return;
    const mid = Math.floor((lo + hi) / 2);
    this.push(2, `Split at mid = ${mid}: left half A[${lo}..${mid}], right half A[${mid + 1}..${hi}].`, { range: [lo, hi], ptrs: [{ text: "lo", index: lo, color: "#22a06b" }, { text: "mid", index: mid, color: "#8b5cf6" }, { text: "hi", index: hi, color: "#d97706" }] });
    this.push(3, `First sort the left half A[${lo}..${mid}].`, { range: [lo, mid] });
    this.mergeRec(lo, mid);
    this.push(4, `Now sort the right half A[${mid + 1}..${hi}].`, { range: [mid + 1, hi] });
    this.mergeRec(mid + 1, hi);
    this.mergeRuns(lo, mid, hi);
  }

  private mergeRuns(lo: number, mid: number, hi: number) {
    const n = this.a.length;
    const temp: (Item | null)[] = Array(n).fill(null);
    let i = lo;
    let j = mid + 1;
    let k = lo;
    const ptrs = () => [...(i <= mid ? [{ text: "i", index: i, color: "#22a06b" }] : []), ...(j <= hi ? [{ text: "j", index: j, color: "#d97706" }] : [])];
    this.push(8, `Both halves are sorted. Merge A[${lo}..${mid}] and A[${mid + 1}..${hi}] into the temp array T.`, { range: [lo, hi], ptrs: ptrs(), temp });
    while (i <= mid && j <= hi) {
      const [x, y] = [this.a[i], this.a[j]];
      this.comps++;
      const takeLeft = this.v(i) <= this.v(j);
      const pick = takeLeft ? x : y;
      this.push(9, `Compare the two heads: ${x.v} (left) and ${y.v} (right). The smaller one goes to T next.`, {
        range: [lo, hi],
        ptrs: ptrs(),
        temp,
        states: { [x.id]: "current", [y.id]: "current" },
        question: this.q("Which value goes into T next?", pick.v, [x.v, y.v], `Both halves are sorted, so their heads ${x.v} and ${y.v} are the smallest remaining values of each half. The smaller head, ${pick.v}, is the smallest value left overall${x.v === y.v ? "; on a tie the left one wins, keeping the sort stable" : ""}.`),
        callouts: [{ at: [x.id, y.id], text: `${Math.min(this.v(i), this.v(j))} is smaller → take it${takeLeft && x.v === y.v ? " (left wins ties)" : ""}`, tone: "info" }],
      });
      if (takeLeft) {
        temp[k++] = x;
        i++;
      } else {
        temp[k++] = y;
        j++;
      }
      this.writes++;
      this.push(takeLeft ? 10 : 11, `${pick.v} drops into T.`, { range: [lo, hi], ptrs: ptrs(), temp: [...temp] });
    }
    const left = i <= mid ? this.a.slice(i, mid + 1) : this.a.slice(j, hi + 1);
    while (i <= mid) (temp[k++] = this.a[i++]), this.writes++;
    while (j <= hi) (temp[k++] = this.a[j++]), this.writes++;
    this.push(12, `One half is used up. The rest (${left.map((x) => x.v).join(", ")}) is already sorted, so it goes straight into T.`, { range: [lo, hi], temp: [...temp] });
    for (let t = lo; t <= hi; t++) this.a[t] = temp[t]!;
    const merged = this.a.slice(lo, hi + 1);
    this.push(13, `Copy T back: A[${lo}..${hi}] = ${merged.map((x) => x.v).join(", ")} is sorted.`, { range: [lo, hi], states: Object.fromEntries(merged.map((it) => [it.id, "found" as NodeState])) });
  }

  quick() {
    this.push(0, "Quicksort: pick a pivot, move smaller values to its left and larger ones to its right, then sort each side the same way.");
    this.quickRec(0, this.a.length - 1);
    this.allSorted("Sorted! Every pivot landed in its final place and split the work.", 0);
  }

  private quickRec(lo: number, hi: number) {
    if (lo > hi) return;
    this.push(1, lo < hi ? `Sort A[${lo}..${hi}].` : `A[${lo}] is a single value: it's already in place.`, { range: [lo, hi] });
    if (lo === hi) {
      this.sorted.add(this.a[lo].id);
      return;
    }
    const pivot = this.a[hi];
    const pv = pivot.v as number;
    const finalIdx = lo + this.a.slice(lo, hi).filter((it) => (it.v as number) <= pv).length;
    this.push(7, `The pivot is the last value, ${pv}. Values ≤ ${pv} will gather on the left.`, { range: [lo, hi], states: { [pivot.id]: "found" }, question: this.q(`Which index will pivot ${pv} end up at?`, finalIdx, Array.from({ length: hi - lo + 1 }, (_, k) => lo + k), `${finalIdx - lo} of the other values in A[${lo}..${hi - 1}] are ≤ ${pv}. They end up to its left, so the pivot lands at ${lo} + ${finalIdx - lo} = ${finalIdx}, its final sorted position.`), callouts: [{ at: pivot.id, text: `pivot = ${pv}`, tone: "info" }] });
    let i = lo - 1;
    this.push(8, `The '≤ ${pv}' zone starts empty (i = ${i}).`, { range: [lo, hi], states: { [pivot.id]: "found" } });
    for (let j = lo; j <= hi - 1; j++) {
      const ptr = [...(i >= lo ? [{ text: "i", index: i, color: "#22a06b" }] : []), { text: "j", index: j }];
      this.comps++;
      const small = this.v(j) <= pv;
      this.push(10, `Is ${this.v(j)} ≤ ${pv}?`, { range: [lo, hi], ptrs: ptr, states: { [pivot.id]: "found", [this.a[j].id]: "current" }, callouts: [{ at: this.a[j].id, text: small ? `${this.v(j)} ≤ ${pv} → left zone` : `${this.v(j)} > ${pv} → stays`, tone: small ? "good" : "info" }] });
      if (small) {
        i++;
        const [x, y] = [this.a[i], this.a[j]];
        this.swap(i, j);
        this.push(11, i === j ? `${y.v} is already at the end of the zone, so the zone just grows to include it.` : `Swap ${y.v} into the zone (index ${i}); ${x.v} moves out to index ${j}.`, { range: [lo, hi], ptrs: [{ text: "i", index: i, color: "#22a06b" }, { text: "j", index: j }], states: { [pivot.id]: "found", [x.id]: "removing", [y.id]: "removing" } });
      }
    }
    const p = i + 1;
    const other = this.a[p];
    this.swap(p, hi);
    this.sorted.add(pivot.id);
    this.push(12, `Swap the pivot ${pv} to index ${p}, right after the zone. Everything left of it is ≤ ${pv}, everything right is larger.`, { range: [lo, hi], states: { [pivot.id]: "visited", [other.id]: "removing" }, callouts: [{ at: pivot.id, text: `${pv} is in its final place`, tone: "good" }] });
    this.push(13, `partition returns ${p}. Now sort the two sides separately.`, { range: [lo, hi], ptrs: [{ text: "p", index: p, color: "#8b5cf6" }] });
    if (lo <= p - 1) this.push(3, `Left side: A[${lo}..${p - 1}].`, { range: [lo, p - 1] });
    this.quickRec(lo, p - 1);
    if (p + 1 <= hi) this.push(4, `Right side: A[${p + 1}..${hi}].`, { range: [p + 1, hi] });
    this.quickRec(p + 1, hi);
  }

  heap() {
    const n = this.a.length;
    this.barScale = 3;
    this.push(0, "Heap sort: the array is also a binary tree (drawn above). First turn it into a max-heap, where every parent is at least as big as its children.", { heap: n });
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      this.push(1, `Build the heap bottom-up: sift down index ${i} (${this.v(i)}).`, { ptrs: [{ text: "i", index: i }], heap: n, states: { [this.a[i].id]: "current" } });
      this.siftDown(i, n);
    }
    this.push(1, `Done: a max-heap. The root A[0] = ${this.v(0)} is the largest value.`, { states: { [this.a[0].id]: "found" }, heap: n, callouts: [{ at: `ht-${this.a[0].id}`, text: `max = ${this.v(0)}`, tone: "good" }] });
    for (let end = n - 1; end >= 1; end--) {
      const top = this.a[0];
      this.push(3, `The heap is A[0..${end}]. Its root is always the largest value left, and it belongs at index ${end}.`, { range: [0, end], ptrs: [{ text: "end", index: end, color: "#d97706" }], question: this.q("Which value is moved to the end next?", top.v, this.a.slice(0, end + 1).map((x) => x.v), `In a max-heap the root is always the largest remaining value: ${top.v}. It is swapped with the last heap slot (index ${end}), its final sorted position.`), heap: end + 1, callouts: [{ at: `ht-${top.id}`, text: `max = ${top.v}`, tone: "good" }] });
      const other = this.a[end];
      this.swap(0, end);
      this.sorted.add(top.id);
      this.push(4, `Swap the max ${top.v} with the last heap value ${other.v}. ${top.v} is now in its final place and leaves the heap.`, { range: [0, end - 1], states: { [top.id]: "visited", [other.id]: "removing" }, heap: end, callouts: [{ at: top.id, text: `${top.v} → final`, tone: "good" }] });
      this.siftDown(0, end);
    }
    this.allSorted("Sorted! Each round moved the heap's maximum to the end.", 0);
  }

  private siftDown(i: number, size: number) {
    for (;;) {
      if (2 * i + 1 >= size) {
        this.push(8, `${this.v(i)} has no children in the heap, so it stops here.`, { range: [0, size - 1], ptrs: [{ text: "i", index: i }], heap: size });
        return;
      }
      const l = 2 * i + 1;
      const r = l + 1;
      const c = r < size && this.v(r) > this.v(l) ? r : l;
      this.comps += r < size ? 2 : 1;
      const parent = this.a[i];
      const child = this.a[c];
      const ok = this.v(i) >= this.v(c);
      this.push(9, `Children of ${parent.v}: ${this.v(l)}${r < size ? ` and ${this.v(r)}` : ""}. The larger child is ${child.v}.`, {
        range: [0, size - 1],
        ptrs: [{ text: "i", index: i }, { text: "c", index: c, color: "#8b5cf6" }],
        states: { [parent.id]: "current", [child.id]: "pending" },
        heap: size,
        callouts: [{ at: `ht-${parent.id}`, text: ok ? `${parent.v} ≥ ${child.v} ✓` : `${parent.v} < ${child.v} → swap down`, tone: ok ? "good" : "warn" }],
      });
      if (ok) {
        this.push(10, `${parent.v} ≥ ${child.v}: the heap property holds here, stop.`, { range: [0, size - 1], ptrs: [{ text: "i", index: i }], heap: size });
        return;
      }
      this.swap(i, c);
      this.push(11, `Swap ${parent.v} down with ${child.v}.`, { range: [0, size - 1], ptrs: [{ text: "i", index: c }], states: { [parent.id]: "removing", [child.id]: "removing" }, heap: size });
      i = c;
    }
  }
}

export function runSort(algo: Algo, values: number[]): Run {
  const s = new Sorter(values);
  s[algo]();
  return { title: `${SORT_NAMES[algo]} sort`, variant: VARIANTS[algo], code: CODE[algo], notes: NOTES[algo], legend: LEGENDS[algo], complexity: COMPLEXITY[algo], frames: s.frames };
}

export const sortingTopic: TopicDef = {
  id: "sorting",
  name: "Sorting",
  category: "Searching & sorting",
  icon: "📊",
  blurb: "Six classic sorts on the same bars. Compare comparisons, swaps and stability.",
  create() {
    let values = randomInts(9, 5, 99);
    const view = (msg: string) => still("Sorting", new Sorter(values).frame(-1, msg));
    const act = (algo: Algo) => () => runSort(algo, values);
    return {
      fields: [{ id: "list", label: "Custom array", kind: "text", default: "", wide: true }],
      actions: (Object.keys(SORT_NAMES) as Algo[]).map((a) => ({ id: a, label: SORT_NAMES[a], run: act(a) })),
      presets: [
        { label: "Random", run: () => { values = randomInts(9, 5, 99); return view("New random array. Pick an algorithm."); } },
        { label: "Nearly sorted", run: () => { values = [10, 20, 30, 50, 40, 60, 70, 90, 80]; return view("Nearly sorted input: insertion and bubble sort shine here."); } },
        { label: "Reversed", run: () => { values = [90, 80, 70, 60, 50, 40, 30, 20, 10]; return view("Reversed input: worst case for insertion sort, and for quicksort with a last-element pivot."); } },
        { label: "Use custom", run: (v) => { const l = numList(v.list, "Custom array", 2, 14, 1, 99); if (typeof l !== "string") values = l; return view(typeof l === "string" ? l : "Custom array loaded."); } },
      ],
      view: () => view("Pick a sorting algorithm. Every run uses the same array, so you can compare their costs."),
    };
  },
};
