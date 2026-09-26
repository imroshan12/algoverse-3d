import type { Frame, NodeState, Run } from "../algorithms/types";
import { ask, collect, nearby, randomInts } from "../algorithms/util";
import { arrayFrame, newItem, type Item } from "./arrayView";
import { num, still } from "./helpers";
import type { TopicDef } from "./types";

const CAP = 10;

type Op = "access" | "insert" | "delete" | "search";

const CODE: Record<Op, string[]> = {
  access: ["access(A, i):", "  // address = base + i * size", "  return A[i]          // O(1)"],
  insert: [
    "insert(A, n, idx, x):",
    "  if n == capacity: overflow",
    "  for i = n - 1 down to idx:",
    "    A[i + 1] = A[i]      // shift right",
    "  A[idx] = x",
    "  n = n + 1",
  ],
  delete: [
    "delete(A, n, idx):",
    "  x = A[idx]",
    "  for i = idx to n - 2:",
    "    A[i] = A[i + 1]      // shift left",
    "  n = n - 1",
    "  return x",
  ],
  search: ["linearSearch(A, n, x):", "  for i = 0 to n - 1:", "    if A[i] == x: return i", "  return -1"],
};

const NOTES: Record<Op, string[]> = {
  access: [
    "Reading one element by its index.",
    "Elements sit side by side in memory, so the address of A[i] is one multiplication and one addition away. No scanning needed.",
    "That is why array access is O(1), no matter how large the array is.",
  ],
  insert: [
    "Insert x at position idx, keeping every other element in order.",
    "A static array has a fixed number of slots; if they're all used there is no room.",
    "Walk from the last element back to idx. Going right-to-left means each value moves into a slot that has already been emptied.",
    "Each shift moves one value one slot right, opening a gap at idx.",
    "The gap is at idx now, so x can be written there.",
    "The array holds one more element. The cost was n − idx shifts: inserting at the front is the O(n) worst case.",
  ],
  delete: [
    "Remove the element at position idx and close the gap.",
    "Keep the removed value so it can be returned.",
    "Walk from idx to the end, pulling each later value one slot left.",
    "Each shift moves one value into the gap, which moves one slot right.",
    "The last slot is now unused, so the array is one element shorter.",
    "Deleting near the front costs the most shifts: O(n) worst case.",
  ],
  search: [
    "Find the index of x without assuming the array is sorted.",
    "Check each position in turn: nothing tells us where x might be.",
    "Stop at the first match.",
    "Every element was checked without a match: report −1 (not found). This is the O(n) worst case.",
  ],
};

const LEGEND: Run["legend"] = {
  current: "being moved / checked",
  pending: "just shifted",
  found: "new value / match",
  removing: "being deleted",
  visited: "checked, no match",
  idle: "stored element",
  ghost: "empty slot",
};

const COMPLEXITY: Record<Op, string> = {
  access: "O(1) time",
  insert: "O(n − idx) shifts · O(n) worst",
  delete: "O(n − idx) shifts · O(n) worst",
  search: "O(n) time",
};

class ArrayModel {
  items: Item[];
  constructor(values: number[]) {
    this.items = values.map(newItem);
  }
  private aux(): { label: string; items: string[] }[] {
    return [{ label: `n = ${this.items.length}, capacity = ${CAP}`, items: this.items.map((i) => String(i.v)) }];
  }
  frame(line: number, message: string, extra: Partial<Parameters<typeof arrayFrame>[0]> = {}): Frame {
    return arrayFrame({ slots: this.items, cap: CAP, line, message, aux: this.aux(), ...extra });
  }

  *access(i: number): Generator<Frame> {
    const it = this.items[i];
    yield this.frame(0, `Read A[${i}].`);
    yield this.frame(1, `Jump straight to slot ${i}: its address is base + ${i} × element size. No other slot is looked at.`, { pointers: [{ text: "i", index: i }], states: { [it.id]: "current" } });
    yield this.frame(2, `A[${i}] = ${it.v}. One step, whatever the array's length: O(1).`, { pointers: [{ text: "i", index: i }], states: { [it.id]: "found" }, callouts: [{ at: it.id, text: `A[${i}] = ${it.v}`, tone: "good" }] });
  }

  *insert(idx: number, x: number): Generator<Frame> {
    const n = this.items.length;
    const it = newItem(x);
    const slots: (Item | null)[] = [...this.items];
    const moves = n - idx;
    yield this.frame(0, `Insert ${x} at index ${idx}. Every element from index ${idx} onward has to move one slot right first.`, { floating: [{ item: it, index: idx }], question: ask(`How many elements must shift right to make room at index ${idx}?`, moves, nearby(moves, 3), `Every element from index ${idx} up to the last index ${n - 1} moves one slot right: ${n} − ${idx} = ${moves}. Inserting at the front is the worst case (all n move).`) });
    yield this.frame(1, `${n} of ${CAP} slots are used, so there is room for one more.`, { floating: [{ item: it, index: idx }] });
    for (let i = n - 1; i >= idx; i--) {
      const moved = slots[i]!;
      slots[i + 1] = moved;
      slots[i] = null;
      yield arrayFrame({
        slots,
        cap: CAP,
        line: 3,
        message: `Shift A[${i}] = ${moved.v} right to index ${i + 1}.${i === n - 1 ? " We start from the end so nothing gets overwritten." : ""}`,
        floating: [{ item: it, index: idx }],
        pointers: [{ text: "i", index: i }],
        states: { [moved.id]: "pending" },
        aux: this.aux(),
        callouts: [{ at: moved.id, text: `${moved.v} → index ${i + 1}`, tone: "info" }],
      });
    }
    slots[idx] = it;
    this.items = slots as Item[];
    yield this.frame(4, `The gap is at index ${idx}. Write ${x} into it.`, { states: { [it.id]: "found" }, callouts: [{ at: it.id, text: `A[${idx}] = ${x}`, tone: "good" }] });
    yield this.frame(5, `Done: n = ${this.items.length}. That took ${moves} shift${moves === 1 ? "" : "s"}; inserting at the front would shift all n elements.`, { states: { [it.id]: "found" } });
  }

  *delete(idx: number): Generator<Frame> {
    const n = this.items.length;
    const slots: (Item | null)[] = [...this.items];
    const gone = slots[idx]!;
    const moves = n - 1 - idx;
    yield this.frame(0, `Delete A[${idx}] = ${gone.v}. Every element after it will move one slot left to close the gap.`, { states: { [gone.id]: "removing" }, question: ask(`How many elements must shift left to close the gap at index ${idx}?`, moves, nearby(moves, 3), `Only the elements after index ${idx} move: indices ${idx + 1} to ${n - 1}, which is ${n} − 1 − ${idx} = ${moves}.`) });
    slots[idx] = null;
    yield arrayFrame({ slots, cap: CAP, line: 1, message: `Lift ${gone.v} out. Index ${idx} is now a gap.`, floating: [{ item: gone, index: idx, state: "removing" }], aux: this.aux(), callouts: [{ at: gone.id, text: `x = ${gone.v}`, tone: "bad" }] });
    for (let i = idx; i <= n - 2; i++) {
      const moved = slots[i + 1]!;
      slots[i] = moved;
      slots[i + 1] = null;
      yield arrayFrame({
        slots,
        cap: CAP,
        line: 3,
        message: `Shift A[${i + 1}] = ${moved.v} left into the gap at index ${i}.`,
        floating: [{ item: gone, index: idx, state: "removing" }],
        pointers: [{ text: "i", index: i }],
        states: { [moved.id]: "pending" },
        aux: this.aux(),
        callouts: [{ at: moved.id, text: `${moved.v} → index ${i}`, tone: "info" }],
      });
    }
    this.items = slots.filter((s): s is Item => s !== null);
    yield this.frame(4, `The last slot is free now: n = ${this.items.length}.`);
    yield this.frame(5, `Return ${gone.v}. That took ${moves} shift${moves === 1 ? "" : "s"}.`);
  }

  *search(x: number): Generator<Frame> {
    const states: Record<string, NodeState> = {};
    yield this.frame(0, `Linear search for ${x}: check the slots one by one from the left.`);
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const hit = it.v === x;
      yield this.frame(2, `Check A[${i}] = ${it.v}.`, {
        pointers: [{ text: "i", index: i }],
        states: { ...states, [it.id]: hit ? "found" : "current" },
        question: i > 0 && i < 4 ? ask(`Is A[${i}] equal to ${x}?`, hit ? "Yes" : "No", ["Yes", "No"], `A[${i}] holds ${it.v}, which is ${hit ? "" : "not "}equal to ${x}.${hit ? " Linear search stops at the first match." : " Linear search has no shortcut: it moves on to the next index."}`) : undefined,
        callouts: [{ at: it.id, text: hit ? `${it.v} = ${x} ✓` : `${it.v} ≠ ${x}`, tone: hit ? "good" : "info" }],
      });
      if (hit) {
        yield this.frame(2, `Found ${x} at index ${i} after ${i + 1} comparison${i ? "s" : ""}.`, { pointers: [{ text: "i", index: i }], states: { ...states, [it.id]: "found" } });
        return;
      }
      states[it.id] = "visited";
    }
    yield this.frame(3, `All ${this.items.length} elements checked, no match: ${x} isn't in the array, return −1.`, { states });
  }
}

export const arrayTopic: TopicDef = {
  id: "array",
  name: "Array",
  category: "Linear structures",
  icon: "▦",
  blurb: "Contiguous memory: O(1) access, O(n) insert/delete because elements shift.",
  create() {
    let m = new ArrayModel(randomInts(6));
    const run = (op: Op, title: string, variant: string, g: Generator<Frame>): Run => ({ title, variant, code: CODE[op], notes: NOTES[op], legend: LEGEND, complexity: COMPLEXITY[op], frames: collect(g) });
    const idx = (v: string, max: number) => num(v, "Index", 0, max);
    return {
      fields: [
        { id: "value", label: "Value", kind: "number", default: "42" },
        { id: "index", label: "Index", kind: "number", default: "2" },
      ],
      actions: [
        { id: "access", label: "Access A[i]", run: (v) => { const i = idx(v.index, m.items.length - 1); return typeof i === "string" ? i : run("access", `Access A[${i}]`, "Random access into a static array.", m.access(i)); } },
        { id: "insert", label: "Insert at", run: (v) => {
          if (m.items.length >= CAP) return "The array is full (capacity 10).";
          const i = idx(v.index, m.items.length); const x = num(v.value, "Value", 0, 999);
          if (typeof i === "string") return i; if (typeof x === "string") return x;
          return run("insert", `Insert ${x} at ${i}`, "Insert into a fixed-capacity array by shifting elements right, starting from the end.", m.insert(i, x));
        } },
        { id: "delete", label: "Delete at", run: (v) => {
          if (!m.items.length) return "The array is empty.";
          const i = idx(v.index, m.items.length - 1); if (typeof i === "string") return i;
          return run("delete", `Delete A[${i}]`, "Delete from an array by shifting later elements left.", m.delete(i));
        } },
        { id: "search", label: "Linear search", run: (v) => { const x = num(v.value, "Value", 0, 999); return typeof x === "string" ? x : run("search", `Linear search ${x}`, "Linear search from index 0, returning the first match or -1.", m.search(x)); } },
      ],
      presets: [
        { label: "Random array", run: () => { m = new ArrayModel(randomInts(6)); return still("Array", m.frame(-1, "A fresh array with 6 elements and capacity 10.")); } },
        { label: "Clear", run: () => { m = new ArrayModel([]); return still("Array", m.frame(-1, "Empty array.")); } },
      ],
      view: () => still("Array", m.frame(-1, "An array stores elements in contiguous slots. Try insert or delete to see why they cost O(n).")),
    };
  },
};
