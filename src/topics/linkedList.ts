import type { Callout, EdgeState, Frame, Marker, NodeState, Question, Run, VEdge, VNode, Vec3 } from "../algorithms/types";
import { ask, collect, randomInts, rowX } from "../algorithms/util";
import { num, still } from "./helpers";
import type { TopicDef } from "./types";

const GAP = 2.1;
const MAX = 9;

const CODE = {
  insert: [
    "insertAt(head, pos, x):",
    "  node = new Node(x)",
    "  if pos == 0:",
    "    node.next = head;  head = node",
    "    return",
    "  p = head",
    "  for k = 1 to pos - 1: p = p.next",
    "  node.next = p.next",
    "  p.next = node",
  ],
  delete: [
    "delete(head, x):",
    "  if head == null: return",
    "  if head.val == x: head = head.next; return",
    "  p = head",
    "  while p.next != null and p.next.val != x:",
    "    p = p.next",
    "  if p.next != null:",
    "    p.next = p.next.next     // unlink",
  ],
  search: ["search(head, x):", "  p = head", "  while p != null:", "    if p.val == x: return p", "    p = p.next", "  return null"],
  reverse: [
    "reverse(head):",
    "  prev = null",
    "  curr = head",
    "  while curr != null:",
    "    next = curr.next",
    "    curr.next = prev",
    "    prev = curr",
    "    curr = next",
    "  head = prev",
  ],
};

type Op = keyof typeof CODE;

const NOTES: Record<Op, string[]> = {
  insert: [
    "Insert x so that it becomes the node at index pos.",
    "Allocate the node anywhere in memory; only pointers decide where it sits in the list.",
    "Inserting at the front needs no walking.",
    "The new node points at the old first node, then becomes the new head: O(1).",
    "Nothing else to do.",
    "Start at the head: a linked list can only be walked, never indexed.",
    "Stop at the node just before the insertion point (pos − 1 steps). This walk is what makes insertion O(n) in general.",
    "Link the new node to the rest of the list first. If p.next were overwritten first, the rest of the list would be lost.",
    "Now point p at the new node. Two pointer changes, and no element moved.",
  ],
  delete: [
    "Remove the first node holding x.",
    "Nothing to delete in an empty list.",
    "Deleting the head only moves the head pointer: O(1).",
    "Stand on a node and look one ahead: to unlink a node you need the node before it.",
    "Walk until the next node holds x, or until there is no next node.",
    "Move one step along the list.",
    "If there is a next node, it is the one holding x.",
    "Point p past the target. Nothing points to the target any more, so it drops out of the list.",
  ],
  search: [
    "Find the first node holding x.",
    "Start at the head.",
    "Keep going until we fall off the end of the list.",
    "Compare the current node's value.",
    "Follow the next pointer: the only way to reach later nodes.",
    "Fell off the end without a match: x isn't in the list. Search is O(n).",
  ],
  reverse: [
    "Reverse the list in place by flipping every next pointer to point backwards.",
    "prev is the already-reversed part; it starts empty (null), which will become the new tail's next.",
    "curr is the node whose pointer we flip next.",
    "Each iteration flips exactly one pointer.",
    "Save the rest of the list first: flipping curr.next would otherwise lose it.",
    "Flip: curr now points backwards to the reversed part.",
    "The reversed part now ends at curr.",
    "Move on to the saved rest of the list.",
    "prev is the last node we flipped, which was the old tail: it is the new head. O(n) time, O(1) extra space.",
  ],
};

const LEGEND: Run["legend"] = { current: "curr / p", visited: "already passed / reversed", found: "new node / match", pending: "next to check", removing: "being removed", idle: "list node", ghost: "null" };
const COMPLEXITY: Record<Op, string> = { insert: "O(pos) walk · O(1) relink", delete: "O(n) walk · O(1) unlink", search: "O(n)", reverse: "O(n) time · O(1) space" };

interface LNode {
  v: number;
  next: string | null;
}

interface FOpts {
  states?: Record<string, NodeState>;
  edges?: Record<string, EdgeState>;
  ptrs?: Record<string, string | null>;
  /** Position overrides, e.g. a new node hovering above the list. */
  at?: Record<string, Vec3>;
  question?: Question;
  callouts?: Callout[];
}

let uid = 0;

class ListModel {
  nodes = new Map<string, LNode>();
  head: string | null = null;
  /** Left-to-right drawing order. Kept fixed during an operation so pointer changes are easy to follow. */
  order: string[] = [];

  constructor(values: number[]) {
    let prev: string | null = null;
    for (const v of values) {
      const id = `ln${uid++}`;
      this.nodes.set(id, { v, next: null });
      if (prev) this.nodes.get(prev)!.next = id;
      else this.head = id;
      prev = id;
    }
    this.relayout();
  }

  relayout() {
    this.order = [];
    for (let p = this.head; p; p = this.nodes.get(p)!.next) this.order.push(p);
  }

  values() {
    return this.order.map((id) => this.nodes.get(id)!.v);
  }

  f(line: number, message: string, o: FOpts = {}): Frame {
    const n = this.order.length;
    const pos = (id: string): Vec3 => o.at?.[id] ?? [rowX(this.order.indexOf(id), n, GAP), 0, 0];
    const nodes: VNode[] = [];
    const edges: VEdge[] = [];
    for (const [id, nd] of this.nodes) {
      const p = pos(id);
      nodes.push({ id, label: String(nd.v), pos: p, state: o.states?.[id] ?? "idle", shape: "box", size: [1.1, 0.9, 0.9] });
      if (nd.next) {
        const eid = `${id}->${nd.next}`;
        edges.push({ id: eid, from: id, to: nd.next, state: o.edges?.[eid] ?? "idle", directed: true });
      } else {
        nodes.push({ id: `null-${id}`, label: "null", pos: [p[0] + 1.05, p[1] - 1.1, p[2]], state: "ghost", shape: "sphere" });
        edges.push({ id: `${id}->null`, from: id, to: `null-${id}`, state: "idle", directed: true });
      }
    }
    const markers: Marker[] = [];
    const ptrs = { head: this.head, ...o.ptrs };
    const count: Record<string, number> = {};
    for (const [name, id] of Object.entries(ptrs)) {
      if (id === undefined) continue;
      if (id === null) {
        markers.push({ id: `ptr-${name}`, text: `${name} = null`, pos: [rowX(-1, n, GAP), 1.2 + (count["null"] = (count["null"] ?? 0) + 1) * 0.45 - 0.45, 0.3], color: name === "head" ? "#4f6bff" : "#d97706" });
        continue;
      }
      const p = pos(id);
      const k = (count[id] = (count[id] ?? 0) + 1) - 1;
      markers.push({ id: `ptr-${name}`, text: name, arrow: k === 0 ? "down" : undefined, pos: [p[0], p[1] + 1.05 + k * 0.45, 0.3], color: name === "head" ? "#4f6bff" : name === "curr" || name === "p" ? "#ff4f9a" : name === "prev" ? "#22a06b" : "#d97706" });
    }
    return { nodes, edges, markers, callouts: o.callouts?.map((c) => ({ below: true, ...c })), line, message, aux: [{ label: "List (from head)", items: this.walk().map(String) }], question: o.question };
  }

  /** Values reachable from head right now (may be partial mid-reversal). */
  walk(): number[] {
    const out: number[] = [];
    const seen = new Set<string>();
    for (let p = this.head; p && !seen.has(p); p = this.nodes.get(p)!.next) {
      seen.add(p);
      out.push(this.nodes.get(p)!.v);
    }
    return out;
  }

  private v(id: string | null) {
    return id ? String(this.nodes.get(id)!.v) : "null";
  }

  *insertAt(pos: number, x: number): Generator<Frame> {
    const id = `ln${uid++}`;
    const n = this.order.length;
    const hover: Vec3 = [rowX(pos - 0.5, n, GAP), 2.4, 0.3];
    this.nodes.set(id, { v: x, next: null });
    yield this.f(1, `Create a new node holding ${x}. It isn't connected to anything yet.`, { at: { [id]: hover }, states: { [id]: "found" } });
    if (pos === 0) {
      yield this.f(2, "Position 0 means it becomes the new first node.", { at: { [id]: hover }, states: { [id]: "found" } });
      this.nodes.get(id)!.next = this.head;
      yield this.f(3, `Point the new node at the current head (${this.v(this.head)}).`, { at: { [id]: hover }, states: { [id]: "found" }, edges: { [`${id}->${this.head}`]: "active" }, callouts: [{ at: id, text: "node.next = head", tone: "info" }] });
      this.head = id;
      yield this.f(3, `Move head to the new node. No walking at all: inserting at the head is O(1).`, { at: { [id]: hover }, states: { [id]: "found" }, callouts: [{ at: id, text: "head = node", tone: "good" }] });
      this.relayout();
      yield this.f(4, `Done: ${this.values().join(" → ")}.`, { states: { [id]: "found" } });
      return;
    }
    let p = this.head!;
    const path: Record<string, NodeState> = {};
    yield this.f(5, `To insert at position ${pos} we need the node before it (position ${pos - 1}). Start walking at the head.`, { at: { [id]: hover }, states: { [id]: "found", [p]: "current" }, ptrs: { p } });
    for (let k = 1; k <= pos - 1; k++) {
      path[p] = "visited";
      const nx = this.nodes.get(p)!.next!;
      yield this.f(6, `Step ${k} of ${pos - 1}: follow p.next to ${this.v(nx)}.`, { at: { [id]: hover }, states: { [id]: "found", ...path, [nx]: "current" }, edges: { [`${p}->${nx}`]: "tree" }, ptrs: { p: nx } });
      p = nx;
    }
    const pn = this.nodes.get(p)!.next;
    this.nodes.get(id)!.next = pn;
    yield this.f(7, `First link the new node to what comes after ${this.v(p)} (${this.v(pn)}), so the rest of the list stays reachable.`, { at: { [id]: hover }, states: { [id]: "found", [p]: "current" }, edges: pn ? { [`${id}->${pn}`]: "active" } : {}, ptrs: { p }, callouts: [{ at: id, text: "node.next = p.next", tone: "info" }] });
    this.nodes.get(p)!.next = id;
    yield this.f(8, `Then point ${this.v(p)} at the new node. ${x} is now in the list.`, { at: { [id]: hover }, states: { [id]: "found", [p]: "current" }, edges: { [`${p}->${id}`]: "active" }, ptrs: { p }, callouts: [{ at: p, text: "p.next = node", tone: "good" }] });
    this.relayout();
    yield this.f(8, `Done: ${this.values().join(" → ")}. Two pointer changes, but ${pos - 1} step${pos - 1 === 1 ? "" : "s"} of walking to get there.`, { states: { [id]: "found" } });
  }

  *delete(x: number): Generator<Frame> {
    yield this.f(0, `Delete the first node holding ${x}.`);
    if (!this.head) {
      yield this.f(1, "The list is empty: nothing to delete.");
      return;
    }
    const h = this.nodes.get(this.head)!;
    if (h.v === x) {
      const old = this.head;
      yield this.f(2, `The head holds ${x}. Just move head to the second node.`, { states: { [old]: "removing" }, callouts: [{ at: old, text: "head = head.next", tone: "warn" }] });
      this.head = h.next;
      this.nodes.delete(old);
      this.relayout();
      yield this.f(2, `The old head is unlinked: ${this.values().join(" → ") || "empty list"}. O(1).`);
      return;
    }
    let p = this.head;
    const path: Record<string, NodeState> = {};
    yield this.f(3, `Start at the head. We always look one node ahead, because unlinking needs the node before the target.`, { states: { [p]: "current" }, ptrs: { p } });
    for (;;) {
      const nx = this.nodes.get(p)!.next;
      const hit = !!nx && this.nodes.get(nx)!.v === x;
      const q = nx ? ask(`p.next holds ${this.v(nx)}. Does the loop stop here?`, hit ? "Yes" : "No", ["Yes", "No"], hit ? `p.next holds ${x}, the value we're deleting. We stop one node early, on purpose: to unlink a node you need its predecessor.` : `p.next holds ${this.v(nx)}, not ${x}, so the loop moves p forward and looks one node further.`) : undefined;
      yield this.f(4, nx ? `Look ahead: p.next holds ${this.v(nx)}.` : "p.next is null: we reached the end.", { states: { ...path, [p]: "current", ...(nx ? { [nx]: hit ? "removing" : "pending" } : {}) }, ptrs: { p }, question: q, callouts: nx ? [{ at: nx, text: hit ? `${this.v(nx)} = ${x} ✓` : `${this.v(nx)} ≠ ${x}`, tone: hit ? "good" : "info" }] : undefined });
      if (!nx || hit) break;
      path[p] = "visited";
      yield this.f(5, `Not it. Move p forward to ${this.v(nx)}.`, { states: { ...path, [nx]: "current" }, edges: { [`${p}->${nx}`]: "tree" }, ptrs: { p: nx } });
      p = nx;
    }
    const target = this.nodes.get(p)!.next;
    if (!target) {
      yield this.f(6, `Reached the end without finding ${x}: it isn't in the list.`, { states: path });
      return;
    }
    const after = this.nodes.get(target)!.next;
    this.nodes.get(p)!.next = after;
    yield this.f(7, `Bypass it: point ${this.v(p)} straight at ${this.v(after)}. Nothing points to ${x} any more.`, { states: { ...path, [p]: "current", [target]: "removing" }, edges: after ? { [`${p}->${after}`]: "active" } : {}, ptrs: { p }, at: { [target]: [rowX(this.order.indexOf(target), this.order.length, GAP), -2.1, 0] }, callouts: [{ at: p, text: "p.next = p.next.next", tone: "warn" }] });
    this.nodes.delete(target);
    this.relayout();
    yield this.f(7, `${x} is gone and the list closes up: ${this.values().join(" → ")}.`);
  }

  *search(x: number): Generator<Frame> {
    let p = this.head;
    const path: Record<string, NodeState> = {};
    yield this.f(1, `Search for ${x}. There's no index to jump to, so start at the head and follow the pointers.`, { states: p ? { [p]: "current" } : {}, ptrs: { p } });
    while (p) {
      const nd = this.nodes.get(p)!;
      const hit = nd.v === x;
      yield this.f(3, `Compare ${nd.v} with ${x}.`, { states: { ...path, [p]: hit ? "found" : "current" }, ptrs: { p }, callouts: [{ at: p, text: hit ? `${nd.v} = ${x} ✓` : `${nd.v} ≠ ${x}`, tone: hit ? "good" : "info" }] });
      if (hit) {
        yield this.f(3, `Found ${x}.`, { states: { ...path, [p]: "found" }, ptrs: { p } });
        return;
      }
      path[p] = "visited";
      yield this.f(4, nd.next ? `Follow the next pointer to ${this.v(nd.next)}.` : "The next pointer is null.", { states: { ...path, ...(nd.next ? { [nd.next]: "current" } : {}) }, edges: nd.next ? { [`${p}->${nd.next}`]: "tree" } : {}, ptrs: { p: nd.next } });
      p = nd.next;
    }
    yield this.f(5, `We walked off the end: ${x} isn't in the list. Linked lists have no random access, so search is O(n).`, { states: path, ptrs: { p: null } });
  }

  *reverse(): Generator<Frame> {
    let prev: string | null = null;
    let curr = this.head;
    const done: Record<string, NodeState> = {};
    yield this.f(0, "Reverse the list in place: walk along it once and flip every next pointer to point backwards.");
    yield this.f(1, "prev = null: the reversed part starts empty.", { ptrs: { prev } });
    yield this.f(2, `curr = head (${this.v(curr)}): the first pointer to flip.`, { ptrs: { prev, curr }, states: curr ? { [curr]: "current" } : {} });
    while (curr) {
      const c: string = curr;
      const next: string | null = this.nodes.get(c)!.next;
      yield this.f(4, `Save next = curr.next (${this.v(next)}) before we overwrite curr's pointer.`, { ptrs: { prev, curr, next }, states: { ...done, [c]: "current" }, callouts: [{ at: c, text: `next = ${this.v(next)}`, tone: "info" }] });
      this.nodes.get(c)!.next = prev;
      yield this.f(5, `Flip: ${this.v(c)} now points back to ${this.v(prev)}.`, { ptrs: { prev, curr, next }, states: { ...done, [c]: "current" }, edges: prev ? { [`${c}->${prev}`]: "active" } : {}, callouts: [{ at: c, text: `curr.next = ${prev ? this.v(prev) : "null"}`, tone: "warn" }] });
      done[c] = "visited";
      prev = c;
      const nextVal: string = this.v(next);
      yield this.f(6, `${this.v(c)} joins the reversed part: prev = ${this.v(c)}.`, { ptrs: { prev, curr, next }, states: { ...done }, question: next ? ask("After the next line, which node will curr point to?", nextVal, [...this.values().map(String), "null"], `curr = next, and next was saved before the pointer flip: it is ${nextVal}. Saving it first is what keeps the rest of the list reachable.`) : undefined });
      curr = next;
      yield this.f(7, curr ? `Move on: curr = ${nextVal}.` : "curr = null: we ran off the end.", { ptrs: { prev, curr, next }, states: { ...done, ...(curr ? { [curr]: "current" } : {}) } });
    }
    this.head = prev;
    yield this.f(8, `Every pointer is flipped. The old tail ${this.v(prev)} is the new head.`, { ptrs: { prev }, states: done, callouts: prev ? [{ at: prev, text: "new head", tone: "good" }] : undefined });
    this.relayout();
    yield this.f(8, `Reversed: ${this.values().join(" → ")}. One pass, O(n) time and O(1) extra space.`, { states: done });
  }
}

export const linkedListTopic: TopicDef = {
  id: "linked-list",
  name: "Linked list",
  category: "Linear structures",
  icon: "🔗",
  blurb: "Nodes joined by next pointers. O(1) insert at head, O(n) search, no random access.",
  create() {
    let m = new ListModel(randomInts(5));
    const run = (op: Op, title: string, variant: string, g: Generator<Frame>): Run => ({ title, variant, code: CODE[op], notes: NOTES[op], legend: LEGEND, complexity: COMPLEXITY[op], frames: collect(g) });
    const variant = "Singly linked list with a head pointer and no tail pointer or sentinel.";
    const insert = (pos: number, x: number | string) => {
      if (typeof x === "string") return x;
      if (m.order.length >= MAX) return `The demo list holds at most ${MAX} nodes.`;
      return run("insert", `Insert ${x} at position ${pos}`, variant, m.insertAt(pos, x));
    };
    return {
      fields: [
        { id: "value", label: "Value", kind: "number", default: "42" },
        { id: "pos", label: "Position", kind: "number", default: "2" },
      ],
      actions: [
        { id: "head", label: "Insert at head", run: (v) => insert(0, num(v.value, "Value", 0, 999)) },
        { id: "tail", label: "Append", run: (v) => insert(m.order.length, num(v.value, "Value", 0, 999)) },
        { id: "insert", label: "Insert at position", run: (v) => { const p = num(v.pos, "Position", 0, m.order.length); return typeof p === "string" ? p : insert(p, num(v.value, "Value", 0, 999)); } },
        { id: "delete", label: "Delete value", run: (v) => { const x = num(v.value, "Value", 0, 999); return typeof x === "string" ? x : run("delete", `Delete ${x}`, variant, m.delete(x)); } },
        { id: "search", label: "Search", run: (v) => { const x = num(v.value, "Value", 0, 999); return typeof x === "string" ? x : run("search", `Search ${x}`, variant, m.search(x)); } },
        { id: "reverse", label: "Reverse", run: () => run("reverse", "Reverse list", "Iterative in-place reversal with prev / curr / next pointers.", m.reverse()) },
      ],
      presets: [
        { label: "Random list", run: () => { m = new ListModel(randomInts(5)); return still("Linked list", m.f(-1, "A fresh list.")); } },
        { label: "Clear", run: () => { m = new ListModel([]); return still("Linked list", m.f(-1, "Empty list: head = null.")); } },
      ],
      view: () => still("Linked list", m.f(-1, "Each node stores a value and a pointer to the next node. Try Reverse, the classic interview question.")),
    };
  },
};
