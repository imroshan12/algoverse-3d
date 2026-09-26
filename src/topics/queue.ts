import type { Callout, Frame, Marker, NodeState, Question, Run, VNode, Vec3 } from "../algorithms/types";
import { ask, collect, randomInts } from "../algorithms/util";
import { newItem, type Item } from "./arrayView";
import { num, still } from "./helpers";
import type { TopicDef } from "./types";

const N = 8;
const R = 3.2;

const CODE = {
  enqueue: [
    "enqueue(Q, x):",
    "  if count == N: overflow",
    "  Q[rear] = x",
    "  rear = (rear + 1) mod N",
    "  count = count + 1",
  ],
  dequeue: [
    "dequeue(Q):",
    "  if count == 0: underflow",
    "  x = Q[front]",
    "  front = (front + 1) mod N",
    "  count = count - 1",
    "  return x",
  ],
};

const NOTES: Record<keyof typeof CODE, string[]> = {
  enqueue: [
    "Add x at the back of the queue.",
    "count tells a full queue apart from an empty one (in both, front == rear).",
    "rear always points at the next free slot, so x goes there.",
    "Advance rear by one; mod N wraps it from the last slot back to slot 0, reusing freed space.",
    "One more element is waiting. Nothing else moved: O(1).",
  ],
  dequeue: [
    "Remove the element that has waited longest.",
    "An empty queue has nothing to remove (underflow).",
    "front always points at the oldest element: first in, first out.",
    "Advance front by one; mod N wraps it around the ring.",
    "One fewer element is waiting.",
    "Hand back the value. Only pointers moved, nothing shifted: O(1).",
  ],
};

const LEGEND: Run["legend"] = { found: "just enqueued", current: "being dequeued", removing: "leaving / overflow", idle: "waiting in queue", ghost: "free slot" };

const ang = (i: number) => Math.PI / 2 - (i * 2 * Math.PI) / N;
const ringPos = (i: number, r = R): Vec3 => [Math.cos(ang(i)) * r, Math.sin(ang(i)) * r, 0];

/** Circular queue drawn as a ring of N slots, so wrap-around is visible. */
class QueueModel {
  slots: (Item | null)[] = Array(N).fill(null);
  front = 0;
  rear = 0;
  count = 0;

  constructor(values: number[]) {
    for (const v of values) {
      this.slots[this.rear] = newItem(v);
      this.rear = (this.rear + 1) % N;
      this.count++;
    }
  }

  f(line: number, message: string, o: { states?: Record<string, NodeState>; floating?: { item: Item; state?: NodeState; out?: boolean }; question?: Question; callouts?: Callout[] } = {}): Frame {
    const nodes: VNode[] = [];
    for (let i = 0; i < N; i++) {
      const p = ringPos(i);
      nodes.push({ id: `slot-${i}`, label: "", sub: String(i), pos: [p[0], p[1], -0.35], state: "ghost", shape: "box", size: [1.05, 1.05, 0.2] });
      const it = this.slots[i];
      if (it) nodes.push({ id: it.id, label: String(it.v), pos: p, state: o.states?.[it.id] ?? "idle", shape: "box", size: [0.9, 0.9, 0.9] });
    }
    if (o.floating) nodes.push({ id: o.floating.item.id, label: String(o.floating.item.v), pos: o.floating.out ? [R + 3, -R, 0.3] : [0, 0, 0.3], state: o.floating.state ?? "found", shape: "box", size: [0.9, 0.9, 0.9] });
    const fp = ringPos(this.front, R + 1.35);
    const rp = ringPos(this.rear, R + 1.35);
    const same = this.front === this.rear;
    const markers: Marker[] = [
      { id: "front", text: "front", pos: [fp[0], fp[1] + (same ? 0.25 : 0), 0.3], color: "#22a06b" },
      { id: "rear", text: "rear", pos: [rp[0], rp[1] - (same ? 0.25 : 0), 0.3], color: "#d97706" },
    ];
    const contents: string[] = [];
    for (let k = 0; k < this.count; k++) {
      const s = this.slots[(this.front + k) % N];
      if (s) contents.push(String(s.v));
    }
    return {
      nodes,
      edges: [],
      markers,
      callouts: o.callouts,
      line,
      message,
      aux: [
        { label: "Queue (front → rear)", items: contents },
        { label: "Pointers", items: [`front=${this.front}`, `rear=${this.rear}`, `count=${this.count}`] },
      ],
      question: o.question,
    };
  }

  *enqueue(x: number): Generator<Frame> {
    const it = newItem(x);
    yield this.f(0, `Enqueue ${x}: it joins the back of the queue, at the slot rear points to.`, { floating: { item: it }, question: this.count < N ? ask(`At which index will ${x} be stored?`, this.rear, [...Array(N).keys()], `rear always points at the next free slot, which is index ${this.rear}. After storing, rear moves to (${this.rear} + 1) mod ${N} = ${(this.rear + 1) % N}.`) : undefined });
    if (this.count === N) {
      yield this.f(1, `All ${N} slots are full (count = ${N}). Queue overflow: ${x} can't be added.`, { floating: { item: it, state: "removing" }, callouts: [{ at: it.id, text: "overflow!", tone: "bad" }] });
      return;
    }
    yield this.f(1, `count = ${this.count} of ${N}, so there's room.`, { floating: { item: it } });
    this.slots[this.rear] = it;
    yield this.f(2, `Store ${x} in Q[${this.rear}], the slot rear points to.`, { states: { [it.id]: "found" }, callouts: [{ at: it.id, text: `Q[${this.rear}] = ${x}`, tone: "good" }] });
    const old = this.rear;
    this.rear = (this.rear + 1) % N;
    const wrapped = this.rear < old;
    yield this.f(3, `Move rear on: (${old} + 1) mod ${N} = ${this.rear}.${wrapped ? " It wrapped around from the last slot to slot 0!" : ""}`, { states: { [it.id]: "found" }, callouts: wrapped ? [{ at: it.id, text: "rear wraps to 0", tone: "warn" }] : undefined });
    this.count++;
    yield this.f(4, `count = ${this.count}. Enqueue touched one slot: O(1).`, { states: { [it.id]: "found" } });
  }

  *dequeue(): Generator<Frame> {
    const it = this.slots[this.front];
    const pool = this.slots.filter(Boolean).map((s) => String(s!.v));
    yield this.f(0, "Dequeue: remove the element at the front, the one that has waited longest.", { question: it && this.count > 1 ? ask("Which value will be dequeued?", String(it.v), pool, `A queue is first in, first out. front points at the oldest element, Q[${this.front}] = ${it.v}, so it leaves first.`) : undefined });
    if (!it || this.count === 0) {
      yield this.f(1, "count = 0: the queue is empty. Queue underflow, nothing to remove.");
      return;
    }
    yield this.f(1, `count = ${this.count}, so the queue isn't empty.`);
    yield this.f(2, `The front element is Q[${this.front}] = ${it.v}.`, { states: { [it.id]: "current" }, callouts: [{ at: it.id, text: `x = ${it.v}`, tone: "info" }] });
    this.slots[this.front] = null;
    const old = this.front;
    this.front = (this.front + 1) % N;
    const wrapped = this.front < old;
    yield this.f(3, `${it.v} leaves; front moves on: (${old} + 1) mod ${N} = ${this.front}.${wrapped ? " Wrapped around to slot 0!" : ""}`, { floating: { item: it, state: "removing", out: true } });
    this.count--;
    yield this.f(4, `count = ${this.count}.`, { floating: { item: it, state: "removing", out: true } });
    yield this.f(5, `Return ${it.v}. First in, first out, and nothing had to shift.`, { floating: { item: it, state: "removing", out: true }, callouts: [{ at: it.id, text: `returns ${it.v}`, tone: "good" }] });
  }
}

export const queueTopic: TopicDef = {
  id: "queue",
  name: "Queue (circular)",
  category: "Linear structures",
  icon: "🔄",
  blurb: "First in, first out. A circular buffer reuses freed slots with mod N arithmetic.",
  create() {
    let m = new QueueModel(randomInts(3));
    const run = (op: keyof typeof CODE, title: string, g: Generator<Frame>): Run => ({ title, variant: "Circular array queue of size N = 8 with front, rear and count. rear is the next free slot; front is the oldest element.", code: CODE[op], notes: NOTES[op], legend: LEGEND, complexity: "O(1) per operation", frames: collect(g) });
    return {
      fields: [{ id: "value", label: "Value", kind: "number", default: "5" }],
      actions: [
        { id: "enqueue", label: "Enqueue", run: (v) => { const x = num(v.value, "Value", 0, 999); return typeof x === "string" ? x : run("enqueue", `Enqueue ${x}`, m.enqueue(x)); } },
        { id: "dequeue", label: "Dequeue", run: () => run("dequeue", "Dequeue", m.dequeue()) },
      ],
      presets: [
        { label: "Near wrap-around", run: () => { m = new QueueModel([]); m.front = m.rear = 6; for (const v of [11, 22]) { m.slots[m.rear] = newItem(v); m.rear = (m.rear + 1) % N; m.count++; } return still("Circular queue", m.f(-1, "front = 6. The next enqueues will wrap past index 7 back to 0.")); } },
        { label: "Clear", run: () => { m = new QueueModel([]); return still("Circular queue", m.f(-1, "Empty queue.")); } },
      ],
      view: () => still("Circular queue", m.f(-1, "Enqueue at rear, dequeue at front. Keep going to watch the pointers wrap around the ring.")),
    };
  },
};
