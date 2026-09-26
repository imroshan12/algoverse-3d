import type { AuxList, Callout, Frame, Marker, NodeState, Question, Run, VNode } from "../algorithms/types";
import { ask, collect, randomInts } from "../algorithms/util";
import { arrayNodes, newItem, type Item } from "./arrayView";
import { num, still } from "./helpers";
import type { TopicDef } from "./types";

const CAP = 8;
const BASE_Y = -2.2;
const H = 1.05;

const CODE = {
  push: ["push(S, x):", "  if top == capacity - 1: overflow", "  top = top + 1", "  S[top] = x"],
  pop: ["pop(S):", "  if top == -1: underflow", "  x = S[top]", "  top = top - 1", "  return x"],
  peek: ["peek(S):", "  if top == -1: underflow", "  return S[top]    // no removal"],
  brackets: [
    "balanced(s):",
    "  S = empty stack",
    "  for ch in s:",
    "    if ch is an opener ( [ {:",
    "      S.push(ch)",
    "    else if S is empty or S.pop() doesn't match ch:",
    "      return false",
    "  return S is empty",
  ],
  postfix: [
    "evalPostfix(tokens):",
    "  S = empty stack",
    "  for t in tokens:",
    "    if t is a number:",
    "      S.push(t)",
    "    else:",
    "      b = S.pop();  a = S.pop()",
    "      S.push(a t b)",
    "  return S.pop()",
  ],
};

type Op = keyof typeof CODE;

const NOTES: Record<Op, string[]> = {
  push: [
    "Add x on top of the stack.",
    "An array stack has a fixed number of slots; if top is already at the last one there's no room (overflow).",
    "Move top up to the next free slot.",
    "Store x there. No other element moves, so push is O(1).",
  ],
  pop: [
    "Remove and return the most recently pushed value.",
    "top = −1 means the stack is empty: popping now would be an underflow.",
    "The top element is the last one pushed: last in, first out.",
    "Move top down. The old slot is simply reused by the next push.",
    "Only one element was touched, so pop is O(1).",
  ],
  peek: [
    "Look at the top value without removing it.",
    "An empty stack has no top to read.",
    "Read S[top]; top stays where it is.",
  ],
  brackets: [
    "Brackets balance when every closer matches the most recent unmatched opener, which is exactly what a stack tracks.",
    "The stack holds openers still waiting for their partner.",
    "Scan the string from left to right.",
    "An opener can't be checked yet: its partner comes later.",
    "Push it; the most recent opener is always on top.",
    "A closer must match the most recent unmatched opener, the top of the stack. An empty stack means there is nothing to match.",
    "A mismatch, or a closer with nothing to close, means the string can't be balanced.",
    "Any openers left on the stack were never closed: balanced only if the stack is empty.",
  ],
  postfix: [
    "Postfix (reverse Polish) writes operators after their operands, so no brackets or precedence rules are needed.",
    "The stack holds numbers waiting for an operator.",
    "Read the tokens from left to right.",
    "Numbers are operands.",
    "Operands wait on the stack until an operator needs them.",
    "An operator combines the two most recent operands.",
    "The first pop is the right operand b, the second is the left operand a. The order matters for − and /.",
    "The result is an operand for later operators, so it goes back on the stack.",
    "A valid expression leaves exactly one value on the stack: the answer.",
  ],
};

const LEGEND: Run["legend"] = { found: "just pushed / result", current: "being used", removing: "popped / mismatch", visited: "already read", idle: "on the stack", ghost: "free slot" };
const COMPLEXITY: Record<Op, string> = { push: "O(1)", pop: "O(1)", peek: "O(1)", brackets: "O(n) time · O(n) stack", postfix: "O(n) time · O(n) stack" };

interface StackOpts {
  items: Item[];
  states?: Record<string, NodeState>;
  /** Item hovering just above the stack (being pushed or popped). */
  floating?: { item: Item; state?: NodeState };
  line: number;
  message: string;
  aux?: AuxList[];
  question?: Question;
  extraNodes?: VNode[];
  extraMarkers?: Marker[];
  callouts?: Callout[];
}

function stackFrame(o: StackOpts): Frame {
  const nodes: VNode[] = [];
  for (let i = 0; i < CAP; i++) {
    nodes.push({ id: `slot-${i}`, label: "", sub: undefined, pos: [0, BASE_Y + i * H, -0.35], state: "ghost", shape: "box", size: [1.5, 1, 0.2] });
    const it = o.items[i];
    if (it) nodes.push({ id: it.id, label: String(it.v), pos: [0, BASE_Y + i * H, 0], state: o.states?.[it.id] ?? "idle", shape: "box", size: [1.4, 0.95, 0.9] });
  }
  if (o.floating) nodes.push({ id: o.floating.item.id, label: String(o.floating.item.v), pos: [2.2, BASE_Y + CAP * H + 0.2, 0.3], state: o.floating.state ?? "found", shape: "box", size: [1.4, 0.95, 0.9] });
  const top = o.items.length - 1;
  const markers: Marker[] = [
    { id: "top", text: `top = ${top}`, arrow: "left", pos: [2.2, BASE_Y + Math.max(top, -0.6) * H, 0.3], color: "#ff4f9a" },
    ...(o.extraMarkers ?? []),
  ];
  return { nodes: [...nodes, ...(o.extraNodes ?? [])], edges: [], markers, callouts: o.callouts, line: o.line, message: o.message, aux: o.aux ?? [{ label: "Stack (bottom → top)", items: o.items.map((i) => String(i.v)) }], question: o.question };
}

class StackModel {
  items: Item[] = [];
  constructor(values: number[]) {
    this.items = values.map(newItem);
  }
  f(line: number, message: string, extra: Partial<StackOpts> = {}) {
    return stackFrame({ items: this.items, line, message, ...extra });
  }
  *push(x: number): Generator<Frame> {
    const it = newItem(x);
    yield this.f(0, `Push ${x} onto the stack.`, { floating: { item: it }, callouts: [{ at: it.id, text: `push ${x}`, tone: "info" }] });
    if (this.items.length === CAP) {
      yield this.f(1, `Every slot is used (top = ${CAP - 1}). Stack overflow: ${x} can't be pushed.`, { floating: { item: it, state: "removing" }, callouts: [{ at: it.id, text: "overflow!", tone: "bad" }] });
      return;
    }
    yield this.f(1, `top = ${this.items.length - 1}, and there are ${CAP - this.items.length} free slots.`, { floating: { item: it } });
    yield this.f(2, `Move top up to ${this.items.length}.`, { floating: { item: it } });
    this.items = [...this.items, it];
    yield this.f(3, `${x} drops into S[${this.items.length - 1}]. Nothing else moved: O(1).`, { states: { [it.id]: "found" }, callouts: [{ at: it.id, text: `S[${this.items.length - 1}] = ${x}`, tone: "good" }] });
  }
  *pop(): Generator<Frame> {
    const pool = this.items.map((i) => String(i.v));
    const topItem = this.items.at(-1);
    yield this.f(0, "Pop: remove the value on top.", { question: topItem && this.items.length > 1 ? ask("Which value will pop return?", String(topItem.v), pool, `A stack is last in, first out: pop always removes the most recently pushed value, which sits on top (S[${this.items.length - 1}] = ${topItem.v}).`) : undefined });
    if (!topItem) {
      yield this.f(1, "top = −1: the stack is empty. Stack underflow, nothing to pop.");
      return;
    }
    yield this.f(1, `top = ${this.items.length - 1}, so the stack isn't empty.`);
    yield this.f(2, `The top is ${topItem.v}, the most recently pushed value.`, { states: { [topItem.id]: "current" }, callouts: [{ at: topItem.id, text: `x = ${topItem.v}`, tone: "info" }] });
    this.items = this.items.slice(0, -1);
    yield this.f(3, `${topItem.v} comes off; top moves down to ${this.items.length - 1}.`, { floating: { item: topItem, state: "removing" } });
    yield this.f(4, `Return ${topItem.v}. Last in, first out.`, { floating: { item: topItem, state: "removing" }, callouts: [{ at: topItem.id, text: `returns ${topItem.v}`, tone: "good" }] });
  }
  *peek(): Generator<Frame> {
    const t = this.items.at(-1);
    yield this.f(0, "Peek: read the top value without removing it.");
    if (!t) {
      yield this.f(1, "The stack is empty, so there's no top to read.");
      return;
    }
    yield this.f(2, `The top is ${t.v}. It stays on the stack.`, { states: { [t.id]: "found" }, callouts: [{ at: t.id, text: `top = ${t.v}`, tone: "good" }] });
  }
}

const OPEN: Record<string, string> = { ")": "(", "]": "[", "}": "{" };

function* brackets(s: string): Generator<Frame> {
  const chars = [...s].map((c) => newItem(c));
  let items: Item[] = [];
  const row = (i: number, states: Record<string, NodeState> = {}) => {
    const r = arrayNodes({ slots: chars, y: -4.4, prefix: "s", pointers: i >= 0 ? [{ text: "ch", index: i }] : [], states, showIndex: false });
    return { extraNodes: r.nodes, extraMarkers: r.markers };
  };
  const done: Record<string, NodeState> = {};
  const aux = () => [{ label: "Stack (bottom → top)", items: items.map((i) => String(i.v)) }];
  yield stackFrame({ items, line: 0, message: `Is "${s}" balanced? Every closer must match the most recent opener that hasn't been closed yet.`, aux: aux(), ...row(-1) });
  yield stackFrame({ items, line: 1, message: "Start with an empty stack of waiting openers.", aux: aux(), ...row(-1) });
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const ch = String(c.v);
    const isOpen = "([{".includes(ch);
    const matchTop = !isOpen && items.length > 0 && items.at(-1)!.v === OPEN[ch];
    yield stackFrame({
      items,
      line: isOpen ? 3 : 5,
      message: isOpen ? `Read '${ch}': an opener.` : `Read '${ch}': a closer. It needs '${OPEN[ch] ?? "?"}' on top of the stack.`,
      aux: aux(),
      ...row(i, { ...done, [c.id]: "current" }),
      question: !isOpen && items.length ? ask(`'${ch}' is a closer. Does it match the top of the stack?`, matchTop ? "Yes" : "No", ["Yes", "No"], `'${ch}' needs '${OPEN[ch]}' as the most recent unmatched opener. The top of the stack is '${items.at(-1)!.v}', so ${matchTop ? "they pair up and the opener is popped" : "the brackets are crossed or unbalanced"}.`) : undefined,
      callouts: [{ at: `${c.id}`, text: isOpen ? "opener → push" : items.length ? `top '${items.at(-1)!.v}' ${matchTop ? "matches ✓" : "doesn't match ✗"}` : "nothing to match ✗", tone: isOpen ? "info" : matchTop ? "good" : "bad" }],
    });
    if (isOpen) {
      const it = newItem(ch);
      items = [...items, it];
      done[c.id] = "visited";
      yield stackFrame({ items, line: 4, message: `Push '${ch}'. It waits for its closer.`, aux: aux(), states: { [it.id]: "found" }, ...row(i, done) });
      continue;
    }
    if (!"()[]{}".includes(ch)) {
      done[c.id] = "visited";
      continue;
    }
    const t = items.at(-1);
    if (!t || t.v !== OPEN[ch]) {
      yield stackFrame({ items, line: 6, message: t ? `Top is '${t.v}', which doesn't match '${ch}'. Not balanced.` : `The stack is empty, so '${ch}' has no opener. Not balanced.`, aux: aux(), states: t ? { [t.id]: "removing" } : {}, ...row(i, { ...done, [c.id]: "removing" }) });
      return;
    }
    items = items.slice(0, -1);
    done[c.id] = "visited";
    yield stackFrame({ items, line: 5, message: `Pop '${t.v}': it pairs with '${ch}'.`, aux: aux(), floating: { item: t, state: "visited" }, ...row(i, done) });
  }
  yield stackFrame({ items, line: 7, message: items.length ? `End of the string, but ${items.length} opener${items.length > 1 ? "s were" : " was"} never closed. Not balanced.` : "End of the string and the stack is empty: every opener was closed in the right order. Balanced!", aux: aux(), ...row(-1, done), states: Object.fromEntries(items.map((x) => [x.id, "removing" as NodeState])) });
}

function* postfix(expr: string): Generator<Frame> {
  const toks = expr.trim().split(/\s+/).map((t) => newItem(t));
  let items: Item[] = [];
  const done: Record<string, NodeState> = {};
  const row = (i: number, states: Record<string, NodeState> = {}) => {
    const r = arrayNodes({ slots: toks, y: -4.4, prefix: "t", pointers: i >= 0 ? [{ text: "t", index: i }] : [], states, showIndex: false });
    return { extraNodes: r.nodes, extraMarkers: r.markers };
  };
  const aux = () => [{ label: "Stack (bottom → top)", items: items.map((i) => String(i.v)) }];
  yield stackFrame({ items, line: 0, message: `Evaluate "${expr}". Numbers wait on the stack; each operator uses the two most recent ones.`, aux: aux(), ...row(-1) });
  for (let i = 0; i < toks.length; i++) {
    const t = String(toks[i].v);
    if (/^-?\d+$/.test(t)) {
      const it = newItem(Number(t));
      items = [...items, it];
      done[toks[i].id] = "visited";
      yield stackFrame({ items, line: 4, message: `${t} is a number: push it.`, aux: aux(), states: { [it.id]: "found" }, ...row(i, done), callouts: [{ at: it.id, text: `push ${t}`, tone: "info" }] });
      continue;
    }
    if (!"+-*/".includes(t) || t.length !== 1) throw new Error(`Unknown token "${t}". Use integers and + - * /.`);
    if (items.length < 2) throw new Error(`Operator "${t}" needs two operands but the stack has ${items.length}.`);
    const b = items.at(-1)!;
    const a = items.at(-2)!;
    const av = a.v as number;
    const bv = b.v as number;
    if (t === "/" && bv === 0) throw new Error("Division by zero.");
    const r = t === "+" ? av + bv : t === "-" ? av - bv : t === "*" ? av * bv : Math.trunc(av / bv);
    yield stackFrame({ items, line: 6, message: `'${t}' is an operator: pop b = ${bv} (right operand), then a = ${av} (left operand).`, aux: aux(), states: { [a.id]: "current", [b.id]: "current" }, ...row(i, { ...done, [toks[i].id]: "current" }), question: ask(`What will be pushed for ${av} ${t} ${bv}?`, r, [av + bv, av - bv, av * bv, bv - av].filter((x) => x !== r), `The first value popped (${bv}) is the right operand and the second (${av}) is the left operand, so the result is ${av} ${t} ${bv} = ${r}${t === "/" ? " (integer division)" : ""}. Getting the order backwards gives the wrong answer for − and /.`), callouts: [{ at: [a.id, b.id], text: `a = ${av}, b = ${bv}`, tone: "info" }] });
    items = items.slice(0, -2);
    const it = newItem(r);
    items = [...items, it];
    done[toks[i].id] = "visited";
    yield stackFrame({ items, line: 7, message: `Compute ${av} ${t} ${bv} = ${r} and push the result.${t === "/" ? " (integer division)" : ""}`, aux: aux(), states: { [it.id]: "found" }, ...row(i, done), callouts: [{ at: it.id, text: `${av} ${t} ${bv} = ${r}`, tone: "good" }] });
  }
  if (items.length !== 1) throw new Error(`The expression leaves ${items.length} values on the stack. Check it is valid postfix.`);
  yield stackFrame({ items, line: 8, message: `Out of tokens, and exactly one value is left: the result is ${items[0].v}.`, aux: aux(), states: { [items[0].id]: "found" }, ...row(-1, done), callouts: [{ at: items[0].id, text: `result = ${items[0].v}`, tone: "good" }] });
}

export const stackTopic: TopicDef = {
  id: "stack",
  name: "Stack",
  category: "Linear structures",
  icon: "🥞",
  blurb: "Last in, first out. Push and pop are O(1). Used for brackets, expressions, recursion.",
  create() {
    let m = new StackModel(randomInts(3));
    const run = (op: Op, title: string, variant: string, g: Generator<Frame>): Run => ({ title, variant, code: CODE[op], notes: NOTES[op], legend: LEGEND, complexity: COMPLEXITY[op], frames: collect(g) });
    return {
      fields: [
        { id: "value", label: "Value", kind: "number", default: "7" },
        { id: "brackets", label: "Brackets", kind: "text", default: "{[()()]}" },
        { id: "postfix", label: "Postfix", kind: "text", default: "2 3 1 * + 9 -", wide: true },
      ],
      actions: [
        { id: "push", label: "Push", run: (v) => { const x = num(v.value, "Value", 0, 999); return typeof x === "string" ? x : run("push", `Push ${x}`, "Array-based stack with capacity 8; top starts at -1.", m.push(x)); } },
        { id: "pop", label: "Pop", run: () => run("pop", "Pop", "Array-based stack with capacity 8; top starts at -1.", m.pop()) },
        { id: "peek", label: "Peek", run: () => run("peek", "Peek", "Array-based stack.", m.peek()) },
        { id: "brackets", label: "Check brackets", run: (v) => {
          const s = (v.brackets ?? "").replace(/\s/g, "");
          if (!s || s.length > 12) return "Enter 1–12 bracket characters, e.g. {[()]}";
          return run("brackets", `Balanced brackets: ${s}`, "Stack-based bracket matching for (), [] and {}. Non-bracket characters are skipped.", brackets(s));
        } },
        { id: "postfix", label: "Evaluate postfix", run: (v) => {
          const e = v.postfix ?? "";
          if (e.trim().split(/\s+/).length > 12) return "Use at most 12 tokens.";
          try {
            collect(postfix(e)); // validate first so errors surface as messages
            return run("postfix", `Postfix: ${e}`, "Postfix (reverse Polish) evaluation with a stack. The first pop is the right operand b, the second is a. Division is integer division.", postfix(e));
          } catch (err) {
            return (err as Error).message + " Example: 2 3 1 * + 9 -";
          }
        } },
      ],
      presets: [
        { label: "Unbalanced example", fill: { brackets: "{[(])}" }, run: () => still("Stack", m.f(-1, 'Loaded "{[(])}". Press Check brackets to see where it fails.')) },
        { label: "Clear", run: () => { m = new StackModel([]); return still("Stack", m.f(-1, "Empty stack. top = -1.")); } },
      ],
      view: () => still("Stack", m.f(-1, "A stack only touches its top. Push, pop, or try the bracket checker.")),
    };
  },
};
