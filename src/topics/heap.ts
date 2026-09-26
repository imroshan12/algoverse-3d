import type { Callout, EdgeState, Frame, Marker, NodeState, Question, Run, VEdge, VNode, Vec3 } from "../algorithms/types";
import { ask, collect, randomInts, rowX } from "../algorithms/util";
import { newItem, type Item } from "./arrayView";
import { num, numList, still } from "./helpers";
import type { TopicDef, Values } from "./types";

type Kind = "Min-heap" | "Max-heap";
const MAX = 15;

const treePos = (i: number): Vec3 => {
  const d = Math.floor(Math.log2(i + 1));
  const p = i - (2 ** d - 1);
  return [((p + 0.5) / 2 ** d - 0.5) * 11, 3.6 - d * 1.55, 0];
};
const ARR_Y = -3.4;

function code(kind: Kind) {
  const lt = kind === "Min-heap" ? ">" : "<";
  const pick = kind === "Min-heap" ? "smaller" : "larger";
  const root = kind === "Min-heap" ? "extractMin" : "extractMax";
  const ok = kind === "Min-heap" ? "<=" : ">=";
  return {
    insert: [
      "insert(H, x):",
      "  H[n] = x;  i = n;  n = n + 1",
      `  while i > 0 and H[parent(i)] ${lt} H[i]:   // parent(i) = (i-1)/2`,
      "    swap(H[i], H[parent(i)])",
      "    i = parent(i)",
    ],
    extract: [
      `${root}(H):`,
      "  top = H[0]",
      "  H[0] = H[n - 1];  n = n - 1",
      "  siftDown(H, 0)",
      "  return top",
      "",
      "siftDown(H, i):",
      "  while left(i) < n:             // left(i) = 2i + 1",
      `    c = ${pick} child of i`,
      `    if H[i] ${ok} H[c]: break`,
      "    swap(H[i], H[c]);  i = c",
    ],
    build: [
      "buildHeap(A):",
      "  for i = floor(n/2) - 1 down to 0:",
      "    siftDown(A, i)",
      "",
      "siftDown(H, i):",
      "  while left(i) < n:",
      `    c = ${pick} child of i`,
      `    if H[i] ${ok} H[c]: break`,
      "    swap(H[i], H[c]);  i = c",
    ],
  };
}

function notes(kind: Kind) {
  const min = kind === "Min-heap";
  const sift = [
    "Move H[i] down until it is in order with both of its children.",
    "Keep going while i still has a child (left(i) = 2i + 1).",
    min ? "Pick the smaller child: only it can sit above the other child." : "Pick the larger child: only it can sit above the other child.",
    "If H[i] is already in order with that child, the heap property holds from here down.",
    "Otherwise swap them and continue sifting from the child's position.",
  ];
  return {
    insert: [
      "Add x while keeping the tree complete and the heap order intact.",
      "Put x in the first free slot: the next position on the bottom level, so the tree stays complete.",
      min ? "Min-heap rule: a parent may not be larger than its child. If x is smaller than its parent, the rule is broken here." : "Max-heap rule: a parent may not be smaller than its child. If x is larger than its parent, the rule is broken here.",
      "Swap x with its parent: x moves up one level (sift up).",
      "Continue from x's new position. There are at most log₂ n levels to climb.",
    ],
    extract: [
      `Remove the root: the ${min ? "minimum" : "maximum"}.`,
      `The heap rule guarantees the root holds the ${min ? "smallest" : "largest"} value.`,
      "Fill the hole at the root with the last element, so the tree stays complete.",
      "That element is probably too far up: sift it down.",
      "Return the old root. Total cost O(log n).",
      "",
      ...sift,
    ],
    build: [
      "Floyd's method: turn an arbitrary array into a heap in O(n).",
      "Indices ⌊n/2⌋ and above are leaves, which are valid heaps already. Work backwards over the internal nodes.",
      "Sift each internal node down. Most nodes are near the bottom and move only a little, so the total is O(n), not O(n log n).",
      "",
      ...sift,
    ],
  };
}

const LEGEND: Run["legend"] = { current: "being sifted", pending: "compared with", removing: "being swapped", found: "new value / removed root", visited: "settled", idle: "in the heap" };

class HeapModel {
  h: Item[] = [];
  constructor(public kind: Kind, values: number[] = []) {
    this.h = values.map(newItem);
    collect(this.buildGen(0));
  }
  /** True if a should sit above b. */
  above(a: Item, b: Item) {
    return this.kind === "Min-heap" ? (a.v as number) < (b.v as number) : (a.v as number) > (b.v as number);
  }

  f(line: number, message: string, o: { states?: Record<string, NodeState>; edges?: Record<string, EdgeState>; flows?: Record<string, string>; ptrs?: Record<string, number>; out?: Item; question?: Question; callouts?: Callout[] } = {}): Frame {
    const n = this.h.length;
    const nodes: VNode[] = [];
    const edges: VEdge[] = [];
    this.h.forEach((it, i) => {
      const st = o.states?.[it.id] ?? "idle";
      nodes.push({ id: `t-${it.id}`, label: String(it.v), pos: treePos(i), state: st });
      nodes.push({ id: `slot-${i}`, label: "", sub: String(i), pos: [rowX(i, Math.max(n, 7), 1.1), ARR_Y, -0.35], state: "ghost", shape: "box", size: [1, 1, 0.2] });
      nodes.push({ id: `a-${it.id}`, label: String(it.v), pos: [rowX(i, Math.max(n, 7), 1.1), ARR_Y, 0], state: st, shape: "box", size: [0.9, 0.9, 0.9] });
      if (i > 0) {
        const p = Math.floor((i - 1) / 2);
        const eid = `e${p}-${i}`;
        edges.push({ id: eid, from: `t-${this.h[p].id}`, to: `t-${it.id}`, state: o.edges?.[eid] ?? "idle", flowFrom: o.flows?.[eid] });
      }
    });
    if (o.out) nodes.push({ id: `t-${o.out.id}`, label: String(o.out.v), pos: [6.5, 4.4, 0.4], state: "found" });
    const markers: Marker[] = [{ id: "arr", text: "array H", pos: [rowX(-1.5, Math.max(n, 7), 1.1), ARR_Y, 0], color: "#5b6886" }];
    for (const [name, i] of Object.entries(o.ptrs ?? {})) {
      if (i < 0 || i >= n) continue;
      markers.push({ id: `ptr-${name}`, text: name, arrow: "up", pos: [rowX(i, Math.max(n, 7), 1.1), ARR_Y - 1.3, 0.3], color: "#ff4f9a" });
    }
    return { nodes, edges, markers, callouts: o.callouts, line, message, question: o.question, aux: [{ label: this.kind, items: this.h.map((x) => String(x.v)) }] };
  }

  private get cmp() {
    return this.kind === "Min-heap" ? { lt: "<", ge: "≥", better: "smaller", best: "minimum" } : { lt: ">", ge: "≤", better: "larger", best: "maximum" };
  }

  *siftDown(i: number, L: { loop: number; pick: number; stop: number; swap: number }): Generator<Frame> {
    const n = this.h.length;
    const { better } = this.cmp;
    for (;;) {
      const l = 2 * i + 1;
      if (l >= n) {
        yield this.f(L.loop, `${this.h[i].v} is now a leaf (index ${i} has no children), so it can't go any lower.`, { ptrs: { i }, states: { [this.h[i].id]: "visited" } });
        return;
      }
      const r = l + 1;
      const c = r < n && this.above(this.h[r], this.h[l]) ? r : l;
      const cur = this.h[i];
      const child = this.h[c];
      const willSwap = this.above(child, cur);
      yield this.f(L.pick, `${cur.v}'s children are ${this.h[l].v}${r < n ? ` and ${this.h[r].v}` : ""}. The ${better} one, ${child.v}, is the only one that could take ${cur.v}'s place.`, {
        ptrs: { i, c },
        states: { [cur.id]: "current", [child.id]: "pending" },
        edges: { [`e${i}-${c}`]: "active" },
        question: ask(`Will ${cur.v} swap with ${child.v}?`, willSwap ? "Yes" : "No", ["Yes", "No"], willSwap ? `In a ${this.kind.toLowerCase()} the parent must be ${this.kind === "Min-heap" ? "≤" : "≥"} its children. ${cur.v} vs ${child.v} breaks that, so the ${better} child ${child.v} moves up and ${cur.v} moves down.` : `${cur.v} is already ${this.kind === "Min-heap" ? "≤" : "≥"} its ${better} child ${child.v}, so it is ${this.kind === "Min-heap" ? "≤" : "≥"} both children: the heap property holds and sifting stops.`),
        callouts: [{ at: `t-${cur.id}`, text: willSwap ? `${cur.v} vs ${child.v} → swap down` : `${cur.v} vs ${child.v} ✓ in order`, tone: willSwap ? "warn" : "good" }],
      });
      if (!willSwap) {
        yield this.f(L.stop, `${cur.v} is already in order with its ${better} child, so the heap property holds from here down. Stop.`, { ptrs: { i }, states: { [cur.id]: "visited" } });
        return;
      }
      [this.h[i], this.h[c]] = [this.h[c], this.h[i]];
      yield this.f(L.swap, `Swap: ${child.v} moves up, ${cur.v} moves down to index ${c}.`, { ptrs: { i: c }, states: { [cur.id]: "removing", [child.id]: "removing" }, edges: { [`e${i}-${c}`]: "active" } });
      i = c;
    }
  }

  *insert(x: number): Generator<Frame> {
    const it = newItem(x);
    this.h.push(it);
    let i = this.h.length - 1;
    const { lt } = this.cmp;
    yield this.f(1, `Put ${x} in the next free slot, index ${i}. In the tree that's the next spot on the bottom level, so the tree stays complete.`, { ptrs: { i }, states: { [it.id]: "found" }, callouts: [{ at: `t-${it.id}`, text: `new at index ${i}`, tone: "info" }] });
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      const par = this.h[p];
      const swap = this.above(it, par);
      yield this.f(2, `Compare ${x} with its parent: index ⌊(${i} − 1) / 2⌋ = ${p}, value ${par.v}.`, {
        ptrs: { i, parent: p },
        states: { [it.id]: "current", [par.id]: "pending" },
        edges: { [`e${p}-${i}`]: "active" },
        flows: { [`e${p}-${i}`]: `t-${it.id}` },
        question: ask(`Will ${x} swap with its parent ${par.v}?`, swap ? "Yes" : "No", ["Yes", "No"], swap ? `${x} ${lt} ${par.v}: a ${this.kind === "Min-heap" ? "smaller" : "larger"} value can't sit below its parent in a ${this.kind.toLowerCase()}, so they swap and ${x} moves up a level.` : `${x} is not ${this.kind === "Min-heap" ? "smaller" : "larger"} than its parent ${par.v}, so the heap property already holds and sifting up stops.`),
        callouts: [{ at: `t-${it.id}`, text: swap ? `${x} ${lt} ${par.v} → swap up` : `${x} vs ${par.v} ✓ in order`, tone: swap ? "warn" : "good" }],
      });
      if (!swap) break;
      [this.h[i], this.h[p]] = [this.h[p], this.h[i]];
      yield this.f(3, `Swap: ${x} moves up to index ${p}, ${par.v} moves down to index ${i}.`, { ptrs: { i: p }, states: { [it.id]: "removing", [par.id]: "removing" } });
      i = p;
    }
    yield this.f(2, i === 0 ? `${x} reached the root: it's the new ${this.cmp.best}. At most ${Math.floor(Math.log2(this.h.length))} swaps were possible: O(log n).` : `${x} is in order with its parent, so it stops at index ${i}. Insert is O(log n).`, { states: { [it.id]: "visited" } });
  }

  *extract(): Generator<Frame> {
    const top = this.h[0];
    yield this.f(1, `The ${this.cmp.best} is always at the root: ${top.v}. Take it out.`, { states: { [top.id]: "found" }, callouts: [{ at: `t-${top.id}`, text: `${this.cmp.best} = ${top.v}`, tone: "good" }] });
    const last = this.h.pop()!;
    if (last !== top) this.h[0] = last;
    yield this.f(2, this.h.length ? `The root is now empty. Move the last element, ${last.v}, into it so the tree stays complete.` : "That was the only element.", { out: top, states: this.h.length ? { [last.id]: "current" } : {}, callouts: this.h.length ? [{ at: `t-${last.id}`, text: "last → root", tone: "warn" }] : undefined });
    if (this.h.length) {
      yield this.f(3, `${last.v} came from the bottom, so it's probably ${this.kind === "Min-heap" ? "too big" : "too small"} for the top. Sift it down.`, { out: top, states: { [last.id]: "current" } });
      yield* this.siftDown(0, { loop: 7, pick: 8, stop: 9, swap: 10 });
    }
    yield this.f(4, `Return ${top.v}. One path from root to leaf at most: O(log n).`, { out: top });
  }

  *buildGen(line0: number): Generator<Frame> {
    const n = this.h.length;
    yield this.f(line0, `Build a ${this.kind.toLowerCase()} from ${this.h.map((x) => x.v).join(", ")}. Leaves (indices ${Math.floor(n / 2)} to ${n - 1}) are already heaps, so fix the other nodes from the bottom up.`);
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
      yield this.f(1, `Sift down index ${i} (${this.h[i].v}). Everything below it is already a heap.`, { ptrs: { i }, states: { [this.h[i].id]: "current" }, callouts: [{ at: `t-${this.h[i].id}`, text: `sift down ${this.h[i].v}`, tone: "info" }] });
      yield* this.siftDown(i, { loop: 5, pick: 6, stop: 7, swap: 8 });
    }
    yield this.f(1, `Done: a valid ${this.kind.toLowerCase()} with ${this.h[0]?.v ?? "nothing"} at the root. Bottom-up building is O(n), faster than n separate inserts (O(n log n)).`);
  }
}

export const heapTopic: TopicDef = {
  id: "heap",
  name: "Binary heap",
  category: "Trees",
  icon: "⛰️",
  blurb: "A complete tree stored in an array. Parent of i is (i-1)/2. Insert and extract are O(log n).",
  create() {
    let m = new HeapModel("Min-heap", [15, 40, 10, 30, 50, 20]);
    const kindOf = (v: Values) => (v.kind as Kind) ?? "Min-heap";
    const ensure = (v: Values) => {
      if (m.kind !== kindOf(v)) m = new HeapModel(kindOf(v), m.h.map((x) => x.v as number));
    };
    const variant = () => `Array-based binary ${m.kind.toLowerCase()} (0-indexed: parent(i) = floor((i-1)/2), children 2i+1 and 2i+2).`;
    return {
      fields: [
        { id: "value", label: "Value", kind: "number", default: "5" },
        { id: "kind", label: "Type", kind: "select", default: "Min-heap", options: () => ["Min-heap", "Max-heap"] },
        { id: "list", label: "Build from", kind: "text", default: "35, 33, 42, 10, 14, 19, 27, 44", wide: true },
      ],
      actions: [
        { id: "insert", label: "Insert", run: (v) => {
          ensure(v);
          const x = num(v.value, "Value", 0, 999);
          if (typeof x === "string") return x;
          if (m.h.length >= MAX) return `The demo heap holds at most ${MAX} values.`;
          return { title: `${m.kind} insert ${x}`, variant: variant(), code: code(m.kind).insert, notes: notes(m.kind).insert, legend: LEGEND, complexity: "O(log n)", frames: collect(m.insert(x)) };
        } },
        { id: "extract", label: "Extract root", run: (v) => { ensure(v); return m.h.length ? { title: `${m.kind} extract`, variant: variant(), code: code(m.kind).extract, notes: notes(m.kind).extract, legend: LEGEND, complexity: "O(log n)", frames: collect(m.extract()) } : "The heap is empty."; } },
        { id: "build", label: "Build heap", run: (v) => {
          const l = numList(v.list, "Values", 2, MAX, 0, 999);
          if (typeof l === "string") return l;
          m = new HeapModel(kindOf(v));
          m.h = l.map(newItem);
          return { title: `Build ${m.kind.toLowerCase()}`, variant: variant() + " Floyd's bottom-up heap construction.", code: code(m.kind).build, notes: notes(m.kind).build, legend: LEGEND, complexity: "O(n) total", frames: collect(m.buildGen(0)) };
        } },
      ],
      presets: [
        { label: "Random", run: (v) => { m = new HeapModel(kindOf(v), randomInts(7)); return still("Binary heap", m.f(-1, "A random heap.")); } },
        { label: "Clear", run: (v) => { m = new HeapModel(kindOf(v)); return still("Binary heap", m.f(-1, "Empty heap.")); } },
      ],
      view: () => still("Binary heap", m.f(-1, "The same heap shown as a tree and as the array it is stored in. Insert, extract, or build from a list.")),
    };
  },
};
