import type { AuxList, Callout, Frame, Marker, NodeState, Question, Run, VNode, Vec3 } from "../algorithms/types";
import { ask, collect } from "../algorithms/util";
import { arrayNodes, GAP as TOKEN_GAP, newItem } from "./arrayView";
import { num, numList, still } from "./helpers";
import type { TopicDef, TopicInstance, Values } from "./types";

/**
 * Bit manipulation, drawn as 8-bit registers: one row of boxes per value, bit 0 on the right.
 * A 1 bit is a solid box and a 0 bit a faded one. A header over the columns shows each bit's index and place value.
 */

const W = 8;
const GAP = 1.05;
const colX = (i: number, w = W) => ((w - 1) / 2 - i) * GAP;
const rowY = (r: number) => 2.2 - r * 1.3;

interface Bit {
  id: string;
  v: 0 | 1;
  /** Where the bit flies in from when it first appears. */
  from?: Vec3;
}

let uid = 0;
const mk = (v: number, from?: Vec3): Bit => ({ id: `bit${uid++}`, v: v ? 1 : 0, from });
const bitAt = (n: number, i: number) => ((n >> i) & 1) as 0 | 1;
const bitsOf = (n: number, w = W, from?: (i: number) => Vec3): Bit[] => Array.from({ length: w }, (_, i) => mk(bitAt(n, i), from?.(i)));

export const u8 = (n: number) => ((n % 256) + 256) % 256;
export const s8 = (n: number) => {
  const u = u8(n);
  return u >= 128 ? u - 256 : u;
};
const bin = (n: number, w = W) => (n & ((1 << w) - 1)).toString(2).padStart(w, "0");
const spaced = (s: string) => (s.length === 8 ? `${s.slice(0, 4)} ${s.slice(4)}` : s);
const hexOf = (n: number) => `0x${u8(n).toString(16).toUpperCase().padStart(2, "0")}`;
/** Real minus sign for negative numbers. */
const fmt = (x: number) => (x < 0 ? `−${-x}` : String(x));
const onesOf = (n: number, w = W) => Array.from({ length: w }, (_, i) => i).filter((i) => bitAt(n, i));
const popcount = (n: number) => onesOf(u8(n)).length;
const lowestBit = (n: number) => onesOf(u8(n))[0] ?? -1;
const placeSum = (n: number) => (n ? onesOf(n).reverse().map((i) => 2 ** i).join(" + ") : "0");
const signedSum = (u: number) => {
  const parts = onesOf(u).reverse().map((i) => (i === 7 ? "−128" : String(2 ** i)));
  return parts.length ? parts.join(" + ") : "0";
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** A question whose distractors are topped up from `fallback` when the meaningful ones coincide with the answer. */
function qa(prompt: string, answer: string | number, primary: (string | number)[], explain: string, fallback?: (string | number)[]): Question {
  const a = String(answer);
  const pool = [...new Set(primary.map(String))].filter((p) => p !== a);
  const extra = fallback ?? (typeof answer === "number" ? [answer + 1, answer - 1, answer + 2, answer * 2] : []);
  for (const f of extra.map(String)) if (pool.length < 3 && f !== a && !pool.includes(f)) pool.push(f);
  return ask(prompt, answer, pool, explain);
}

// ---------------------------------------------------------------------------
// Register rendering
// ---------------------------------------------------------------------------

interface Row {
  key: string;
  label: string;
  bits: (Bit | null)[];
  value?: string;
  /** Fixed height, for rows that come and go without moving the others. */
  y?: number;
}

interface BitOpts {
  line: number;
  message: string;
  states?: Record<string, NodeState>;
  callouts?: Callout[];
  question?: Question;
  aux?: AuxList[];
  /** Draw a result line just above rows[rule]. */
  rule?: number;
  width?: number;
  /** Two's complement header: bit 7 is worth −128. */
  signed?: boolean;
  header?: boolean;
  /** Column pointer over this bit index. */
  col?: number;
  /** Columns receiving a +1 carry, written above `carryRow` like carries on paper. */
  carries?: number[];
  carryRow?: number;
  extraNodes?: VNode[];
  extraMarkers?: Marker[];
}

const INK = "#33415c";
const MUTED = "#5b6886";

function bitFrame(rows: Row[], o: BitOpts): Frame {
  const w = o.width ?? W;
  const nodes: VNode[] = [];
  const markers: Marker[] = [];
  const ys = rows.map((r, k) => r.y ?? rowY(k));
  rows.forEach((row, k) => {
    const y = ys[k];
    for (let i = 0; i < w; i++) {
      nodes.push({ id: `${row.key}:slot${i}`, label: "", pos: [colX(i, w), y, -0.36], state: "ghost", shape: "box", size: [0.98, 0.98, 0.16] });
      const b = row.bits[i];
      if (b) nodes.push({ id: b.id, label: String(b.v), pos: [colX(i, w), y, 0], state: o.states?.[b.id] ?? (b.v ? "idle" : "ghost"), shape: "box", size: [0.84, 0.84, 0.56], from: b.from });
    }
    markers.push({ id: `${row.key}:label`, text: row.label, pos: [colX(w - 1, w) - 0.72, y, 0], align: "right", size: 0.3, color: INK });
    if (row.value) markers.push({ id: `${row.key}:value`, text: row.value, pos: [colX(0, w) + 0.72, y, 0], align: "left", size: 0.28, color: MUTED });
  });
  const top = Math.max(...ys) + 0.82;
  if (o.header !== false) {
    for (let i = 0; i < w; i++) {
      markers.push({ id: `hdr:${i}`, text: `b${i}`, pos: [colX(i, w), top, 0], size: 0.19, color: "#8b95ad" });
      const neg = o.signed && i === w - 1;
      markers.push({ id: `pv:${i}`, text: neg ? `−${2 ** i}` : String(2 ** i), pos: [colX(i, w), top + 0.36, 0], size: 0.2, color: neg ? "#e5484d" : MUTED });
    }
  }
  if (o.rule !== undefined && o.rule > 0 && o.rule < rows.length) {
    const y = (ys[o.rule - 1] + ys[o.rule]) / 2;
    nodes.push({ id: "rule", label: "", pos: [0, y, 0.1], state: "ghost", shape: "box", size: [w * GAP + 0.3, 0.05, 0.05] });
  }
  if (o.col !== undefined) markers.push({ id: "colptr", text: `bit ${o.col}`, arrow: "down", pos: [colX(o.col, w), top + 0.95, 0.3], color: "#ff4f9a", size: 0.24 });
  for (const c of o.carries ?? []) if (c < w) markers.push({ id: `carry:${c}`, text: "+1", pos: [colX(c, w) + 0.3, ys[o.carryRow ?? 0] + 0.64, 0.35], color: "#d97706", size: 0.22 });
  return {
    nodes: [...nodes, ...(o.extraNodes ?? [])],
    edges: [],
    markers: [...markers, ...(o.extraMarkers ?? [])],
    callouts: o.callouts,
    line: o.line,
    message: o.message,
    aux: o.aux ?? [],
    question: o.question,
  };
}

/** Shift a register by s places. Bits pushed past either end come back in `out` with the column they'd have landed in. */
function shiftBits(bits: Bit[], s: number, dir: "left" | "right", fill: (i: number) => Bit): { next: Bit[]; out: { bit: Bit; col: number }[] } {
  const w = bits.length;
  const next: (Bit | undefined)[] = Array(w).fill(undefined);
  const out: { bit: Bit; col: number }[] = [];
  bits.forEach((b, i) => {
    const j = dir === "left" ? i + s : i - s;
    if (j < 0 || j >= w) out.push({ bit: b, col: j });
    else next[j] = b;
  });
  return { next: next.map((b, i) => b ?? fill(i)), out };
}

/** Bits that just fell off a register, drawn just outside it for one frame. */
const fallen = (out: { bit: Bit; col: number }[], y: number, w = W): VNode[] =>
  out.map(({ bit, col }) => ({ id: bit.id, label: String(bit.v), pos: [colX(col, w), y - 0.95, 0.4], state: "removing", shape: "box", size: [0.84, 0.84, 0.56] }));

const BIT_LEGEND = { idle: "bit = 1", ghost: "bit = 0" };

const run = (title: string, variant: string, code: string[], notes: string[], legend: Run["legend"], complexity: string, frames: Frame[]): Run => ({ title, variant, code, notes, legend, complexity, frames });

// ---------------------------------------------------------------------------
// Topic 1: binary & bitwise operators
// ---------------------------------------------------------------------------

type Op = "&" | "|" | "^";
const OPNAME: Record<Op, string> = { "&": "AND", "|": "OR", "^": "XOR" };
export const applyOp = (op: Op, x: number, y: number) => (op === "&" ? x & y : op === "|" ? x | y : x ^ y);
const TRUTH: Record<Op, string[]> = {
  "&": ["0 & 0 = 0", "0 & 1 = 0", "1 & 0 = 0", "1 & 1 = 1"],
  "|": ["0 | 0 = 0", "0 | 1 = 1", "1 | 0 = 1", "1 | 1 = 1"],
  "^": ["0 ^ 0 = 0", "0 ^ 1 = 1", "1 ^ 0 = 1", "1 ^ 1 = 0"],
};
const RULE: Record<Op, string> = {
  "&": "a result bit is 1 only where both bits are 1",
  "|": "a result bit is 1 where at least one of the bits is 1",
  "^": "a result bit is 1 where the two bits are different",
};

const BASICS_CODE = {
  toBinary: ["toBinary(n):", "  i = 0", "  while n > 0:", "    bit[i] = n mod 2        // the remainder", "    n = floor(n / 2)", "    i = i + 1", "  bits i … 7 stay 0"],
  and: ["and(a, b):", "  for i = 0 to 7:          // every column on its own", "    r[i] = a[i] & b[i]", "  return r"],
  or: ["or(a, b):", "  for i = 0 to 7:", "    r[i] = a[i] | b[i]", "  return r"],
  xor: ["xor(a, b):", "  for i = 0 to 7:", "    r[i] = a[i] ^ b[i]", "  return r"],
  not: ["not(a):", "  for i = 0 to 7:", "    r[i] = 1 − a[i]          // flip", "  return r                 // unsigned: 255 − a"],
  shl: ["shiftLeft(a, k):", "  copy a into r", "  repeat k times:", "    every bit moves up one place; bit 7 falls off", "    bit 0 = 0", "  // a << k = a × 2^k (mod 256)"],
  shr: ["shiftRight(a, k):        // logical", "  copy a into r", "  repeat k times:", "    every bit moves down one place; bit 0 falls off", "    bit 7 = 0", "  // a >> k = floor(a / 2^k)"],
};

const BASICS_NOTES: Record<keyof typeof BASICS_CODE, string[]> = {
  toBinary: [
    "Binary is base 2: bit i is worth 2^i. Repeated division by 2 peels the bits off from the right.",
    "Start filling from bit 0, the rightmost (least significant) bit.",
    "Stop when nothing is left to divide.",
    "The remainder of n ÷ 2 is n's lowest bit: 1 if n is odd, 0 if n is even.",
    "Dividing by 2 (dropping the remainder) shifts every remaining bit down one place.",
    "The next remainder is the next bit up.",
    "Once the quotient is 0 there are no more 1 bits: the higher bits are all 0.",
  ],
  and: ["AND works column by column; there are no carries between columns.", "Each of the 8 columns is independent.", "1 only if both bits are 1: think \"both\".", "The result is a new 8-bit value."],
  or: ["OR works column by column; there are no carries between columns.", "Each of the 8 columns is independent.", "1 if either bit is 1 (or both): think \"at least one\".", "The result is a new 8-bit value."],
  xor: ["XOR (exclusive or) works column by column; there are no carries.", "Each of the 8 columns is independent.", "1 when the bits differ, 0 when they're the same: it's addition that forgets the carry.", "The result is a new 8-bit value."],
  not: ["NOT flips every bit of a single value.", "Each column is flipped on its own.", "0 becomes 1 and 1 becomes 0.", "For 8-bit unsigned values ~a = 255 − a; read as signed two's complement it's −a − 1."],
  shl: [
    "Shift every bit k places towards the top.",
    "Work on a copy so the original stays visible.",
    "One place at a time, k times.",
    "Moving up one place doubles each bit's value. A 1 pushed past bit 7 is lost (overflow).",
    "The empty bottom place is filled with 0.",
    "So a << k multiplies by 2^k, keeping only the lowest 8 bits.",
  ],
  shr: [
    "Shift every bit k places towards the bottom. Logical shift: zeros come in at the top.",
    "Work on a copy so the original stays visible.",
    "One place at a time, k times.",
    "Moving down one place halves each bit's value. The bit pushed out of bit 0 is the remainder of ÷ 2.",
    "The empty top place is filled with 0.",
    "So a >> k divides by 2^k and rounds down.",
  ],
};

function* toBinary(n: number): Generator<Frame> {
  const bits: (Bit | null)[] = Array(W).fill(null);
  const steps: string[] = [];
  const y = rowY(0);
  let q = n;
  const rows = (): Row[] => [{ key: "n", label: String(n), bits, value: bits.every(Boolean) ? `= ${hexOf(n)}` : `q = ${q}` }];
  const aux = (): AuxList[] => [{ label: "Divisions", items: [...steps] }];
  const correct = bin(n);
  const flip = (s: string, i: number) => s.slice(0, i) + (s[i] === "0" ? "1" : "0") + s.slice(i + 1);
  yield bitFrame(rows(), {
    line: 0,
    message: `Convert ${n} to binary. Divide by 2 again and again: each remainder is the next bit, starting from bit 0 on the right.`,
    aux: aux(),
    question: qa(
      `What is ${n} in 8-bit binary?`,
      spaced(correct),
      [[...correct].reverse().join(""), flip(correct, 7), flip(correct, 5), flip(correct, 2)].map(spaced),
      `${n} = ${placeSum(n)}. Those place values are ${onesOf(n).length ? `bits ${onesOf(n).reverse().join(", ")}` : "none of the bits"}, so ${n} = ${spaced(correct)}. Watch the order: the first remainder is bit 0, the rightmost bit, so reading the remainders top to bottom gives the bits backwards.`,
      ["0000 0000", "1111 1111", "0000 0001"],
    ),
  });
  let i = 0;
  while (q > 0) {
    const r = q % 2;
    const nq = Math.floor(q / 2);
    if (i === 1) yield bitFrame(rows(), { line: 3, col: i, message: `Next division: ${q} ÷ 2.`, aux: aux(), question: ask(`What is bit ${i}, the remainder of ${q} ÷ 2?`, r, [0, 1], `${q} is ${r ? "odd" : "even"}, so ${q} ÷ 2 leaves remainder ${r}: bit ${i} = ${r}. Only the last decimal digit decides whether a number is odd, so this is quick to spot.`) });
    const b = mk(r, [colX(i), y + 1.9, 0.6]);
    bits[i] = b;
    steps.push(`${q} ÷ 2 = ${nq} r ${r}`);
    const prev = q;
    q = nq;
    yield bitFrame(rows(), { line: 3, col: i, message: `${prev} ÷ 2 = ${nq} remainder ${r} (${prev} is ${r ? "odd" : "even"}), so bit ${i} = ${r}. Carry on with ${nq}.`, states: { [b.id]: "found" }, callouts: [{ at: b.id, text: `${prev} mod 2 = ${r}`, tone: "info", below: true }], aux: aux() });
    i++;
  }
  const filled = i;
  for (; i < W; i++) bits[i] = mk(0, [colX(i), y + 1.9, 0.6]);
  if (filled < W) yield bitFrame(rows(), { line: 6, message: n === 0 ? "n is already 0, so the loop never runs: all 8 bits are 0." : `The quotient reached 0, so bits ${filled} to 7 are all 0.`, aux: aux() });
  const ones = (bits as Bit[]).filter((b) => b.v).map((b) => b.id);
  yield bitFrame(rows(), { line: 6, message: `Check: add up the place values of the 1 bits: ${placeSum(n)} = ${n}. ✓`, states: Object.fromEntries(ones.map((id) => [id, "found" as NodeState])), aux: aux() });
  const hi = correct.slice(0, 4);
  const lo = correct.slice(4);
  const digit = (s: string) => parseInt(s, 2).toString(16).toUpperCase();
  const nibble = (id: string, text: string, from: number): Marker => ({ id, text, pos: [(colX(from) + colX(from + 3)) / 2, y - 0.85, 0.2], size: 0.34, color: "#8b5cf6" });
  yield bitFrame(rows(), {
    line: 6,
    message: `${n} = ${spaced(correct)}. For hexadecimal, split the bits into groups of 4: ${hi} = ${digit(hi)} and ${lo} = ${digit(lo)}, so ${n} = ${hexOf(n)}.`,
    aux: aux(),
    extraMarkers: [nibble("nib-hi", `hex ${digit(hi)}`, 4), nibble("nib-lo", `hex ${digit(lo)}`, 0)],
  });
}

function* bitwise(op: Op, a: number, b: number): Generator<Frame> {
  const A = bitsOf(a);
  const B = bitsOf(b);
  const R: (Bit | null)[] = Array(W).fill(null);
  const res = applyOp(op, a, b);
  const rows = (): Row[] => [
    { key: "a", label: "a", bits: A, value: `= ${a}` },
    { key: "b", label: `${op} b`, bits: B, value: `= ${b}` },
    { key: "r", label: `a ${op} b`, bits: R, value: R.every(Boolean) ? `= ${res}` : undefined },
  ];
  const aux = [{ label: `${OPNAME[op]} truth table`, items: TRUTH[op] }];
  yield bitFrame(rows(), {
    line: 0,
    rule: 2,
    message: `a ${op} b: ${RULE[op]}. Each column is worked out on its own, with no carries.`,
    aux,
    question: qa(`What is ${a} ${op} ${b}?`, res, [applyOp("&", a, b), applyOp("|", a, b), applyOp("^", a, b), u8(a + b), Math.abs(a - b)], `${spaced(bin(a))} ${op} ${spaced(bin(b))} = ${spaced(bin(res))} = ${res}, because ${RULE[op]}.`),
  });
  const asked = new Set<string>();
  for (let i = 0; i < W; i++) {
    const ai = A[i].v;
    const bi = B[i].v;
    const ri = applyOp(op, ai, bi);
    const kind = ai !== bi ? "different" : ai ? "both 1" : "";
    const focus: Record<string, NodeState> = { [A[i].id]: "current", [B[i].id]: "current" };
    if (kind && !asked.has(kind) && (kind === "both 1" || i >= 1)) {
      asked.add(kind);
      yield bitFrame(rows(), { line: 2, rule: 2, col: i, message: `Column ${i}: a has ${ai}, b has ${bi}.`, states: focus, aux, question: ask(`What is bit ${i} of a ${op} b, i.e. ${ai} ${op} ${bi}?`, ri, [0, 1], `${ai} ${op} ${bi} = ${ri}: ${RULE[op]}.`) });
    }
    const rb = mk(ri, [colX(i), rowY(1), 0.5]);
    R[i] = rb;
    yield bitFrame(rows(), { line: 2, rule: 2, col: i, message: `Column ${i}: ${ai} ${op} ${bi} = ${ri}.`, states: { ...focus, [rb.id]: "found" }, callouts: [{ at: rb.id, text: `${ai} ${op} ${bi} = ${ri}`, tone: ri ? "good" : "info", below: true }], aux });
  }
  const USE: Record<Op, string> = {
    "&": "AND is how you test or clear bits: AND with 1 keeps a bit, AND with 0 forces it to 0.",
    "|": "OR is how you set bits: OR with 1 forces a bit to 1, OR with 0 keeps it.",
    "^": "XOR flips bits and spots differences: x ^ x = 0 and x ^ 0 = x.",
  };
  yield bitFrame(rows(), { line: 3, rule: 2, message: `${a} ${op} ${b} = ${res} (${spaced(bin(res))}). ${USE[op]}`, aux });
}

function* notOp(a: number): Generator<Frame> {
  const A = bitsOf(a);
  const R: (Bit | null)[] = Array(W).fill(null);
  const res = 255 - a;
  const rows = (): Row[] => [
    { key: "a", label: "a", bits: A, value: `= ${a}` },
    { key: "r", label: "~a", bits: R, value: R.every(Boolean) ? `= ${res}` : undefined },
  ];
  yield bitFrame(rows(), {
    line: 0,
    rule: 1,
    message: "~a flips every bit: each 0 becomes 1 and each 1 becomes 0.",
    question: qa(`What is ~${a} as an unsigned 8-bit number?`, res, [a, 256 - a, 254 - a, a ^ 1], `Flipping all 8 bits turns ${spaced(bin(a))} into ${spaced(bin(res))}. Every column holds a 1 in exactly one of a and ~a, so a + ~a = 1111 1111 = 255, giving ~${a} = 255 − ${a} = ${res}.`),
  });
  for (let i = 0; i < W; i++) {
    const rb = mk(1 - A[i].v, [colX(i), rowY(0), 0.5]);
    R[i] = rb;
    yield bitFrame(rows(), { line: 2, rule: 1, col: i, message: `Bit ${i}: ~${A[i].v} = ${rb.v}.`, states: { [A[i].id]: "current", [rb.id]: "found" }, callouts: [{ at: rb.id, text: `~${A[i].v} = ${rb.v}`, tone: "info", below: true }] });
  }
  yield bitFrame(rows(), { line: 3, rule: 1, message: `~${a} = ${spaced(bin(res))} = ${res} = 255 − ${a}. Read as a signed 8-bit number it's ${fmt(s8(res))} = −${a} − 1, which is why −a = ~a + 1 in two's complement.` });
}

function* shiftOp(dir: "left" | "right", a: number, k: number): Generator<Frame> {
  const A = bitsOf(a);
  let R: (Bit | null)[] = Array(W).fill(null);
  let val = a;
  let s = 0;
  const sym = dir === "left" ? "<<" : ">>";
  const final = dir === "left" ? u8(a << k) : a >> k;
  const rows = (): Row[] => [
    { key: "a", label: "a", bits: A, value: `= ${a}` },
    { key: "r", label: `a ${sym} ${s}`, bits: R, value: R.every(Boolean) ? `= ${val}` : undefined },
  ];
  const big = a * 2 ** k;
  const explain =
    dir === "left"
      ? `Each shift doubles the value: ${a} × 2^${k} = ${big}.${big > 255 ? ` That doesn't fit in 8 bits: the 1s pushed past bit 7 are lost, leaving ${big} mod 256 = ${final}.` : ""}`
      : `Each shift halves the value and rounds down: ⌊${a} / ${2 ** k}⌋ = ${final}. The ${plural(k, "bit")} that fall off (${bin(a & ((1 << k) - 1), k)}) are the remainder ${a % 2 ** k}.`;
  yield bitFrame(rows(), {
    line: 0,
    message: dir === "left" ? `a << ${k}: every bit moves ${plural(k, "place")} towards the top. Zeros fill in at the bottom, and anything pushed past bit 7 is lost.` : `a >> ${k}: every bit moves ${plural(k, "place")} towards the bottom. Zeros fill in at the top, and bits pushed past bit 0 are lost.`,
    question: qa(`What is ${a} ${sym} ${k}?`, final, dir === "left" ? [big, u8(a << (k + 1)), u8(a << Math.max(k - 1, 0)), a + k] : [a / 2 ** k, a >> (k + 1), a >> Math.max(k - 1, 0), Math.max(a - k, 0)].map((x) => Math.round(x * 100) / 100), explain),
  });
  R = A.map((b, i) => mk(b.v, [colX(i), rowY(0), 0.4]));
  yield bitFrame(rows(), { line: 1, message: "Copy a into the result register." });
  for (s = 1; s <= k; s++) {
    const prev = val;
    const { next, out } = shiftBits(R as Bit[], 1, dir, (i) => mk(0, [colX(dir === "left" ? i - 1 : i + 1), rowY(1), 0.3]));
    const incoming = next[dir === "left" ? 0 : W - 1];
    R = next;
    val = dir === "left" ? u8(val << 1) : val >> 1;
    const lost = out[0]?.bit;
    const msg =
      dir === "left"
        ? `Shift ${s}: every bit moves up one place and a 0 comes in at bit 0.${lost?.v ? " The 1 that was in bit 7 falls off: overflow!" : ""} ${prev} × 2 = ${prev * 2}${prev * 2 > 255 ? `, which wraps to ${val}` : ""}.`
        : `Shift ${s}: every bit moves down one place and a 0 comes in at bit 7.${lost?.v ? " The 1 in bit 0 falls off: it was the remainder of ÷ 2." : ""} ⌊${prev} / 2⌋ = ${val}.`;
    yield bitFrame(rows(), {
      line: 3,
      message: msg,
      states: { [incoming.id]: "found" },
      extraNodes: fallen(out, rowY(1)),
      callouts: lost?.v ? [{ at: lost.id, text: dir === "left" ? "overflow: lost" : "remainder: lost", tone: "bad", below: true }] : [{ at: incoming.id, text: "0 shifts in", tone: "info", below: true }],
    });
  }
  s = k;
  yield bitFrame(rows(), {
    line: 5,
    message: dir === "left" ? `${a} << ${k} = ${final}${big > 255 ? ` (not ${big}: 8 bits keep only the value mod 256)` : ` = ${a} × ${2 ** k}`}. Shifting left by k multiplies by 2^k.` : `${a} >> ${k} = ${final} = ⌊${a} / ${2 ** k}⌋. Shifting right by k divides by 2^k and rounds down.`,
  });
}

export const bitsBasicsTopic: TopicDef = {
  id: "bits-basics",
  name: "Binary & bitwise operators",
  category: "Bit manipulation",
  icon: "🔢",
  blurb: "Numbers as bits. AND, OR, XOR and NOT work column by column; shifts multiply and divide by 2.",
  create(): TopicInstance {
    const byte = (v: Values, id: string) => num(v[id], id, 0, 255);
    const op = (o: Op) => (v: Values): Run | string => {
      const a = byte(v, "a");
      const b = byte(v, "b");
      if (typeof a === "string") return a;
      if (typeof b === "string") return b;
      const key = o === "&" ? "and" : o === "|" ? "or" : "xor";
      return run(`${a} ${o} ${b}`, `8-bit bitwise ${OPNAME[o]}, evaluated column by column from bit 0 to bit 7.`, BASICS_CODE[key], BASICS_NOTES[key], { ...BIT_LEGEND, current: "column being worked on", found: "result bit just written" }, "O(1): one machine instruction", collect(bitwise(o, a, b)));
    };
    const sh = (dir: "left" | "right") => (v: Values): Run | string => {
      const a = byte(v, "a");
      const k = num(v.k, "k", 1, 7);
      if (typeof a === "string") return a;
      if (typeof k === "string") return k;
      const key = dir === "left" ? "shl" : "shr";
      return run(`${a} ${dir === "left" ? "<<" : ">>"} ${k}`, `8-bit unsigned ${dir} shift by ${k}, shown one place at a time (${dir === "right" ? "logical: zeros come in at the top" : "zeros come in at the bottom; bits past bit 7 are lost"}).`, BASICS_CODE[key], BASICS_NOTES[key], { ...BIT_LEGEND, found: "0 shifted in", removing: "falling off the end" }, dir === "left" ? "O(1) · multiplies by 2^k" : "O(1) · divides by 2^k", collect(shiftOp(dir, a, k)));
    };
    const blank = (a: number, b: number, msg: string) => still("Binary & bitwise operators", bitFrame([{ key: "a", label: "a", bits: bitsOf(a), value: `= ${a}` }, { key: "b", label: "b", bits: bitsOf(b), value: `= ${b}` }], { line: -1, message: msg }));
    const current = (v: Values, id: string, fallback: number) => {
      const x = byte(v, id);
      return typeof x === "string" ? fallback : x;
    };
    return {
      fields: [
        { id: "a", label: "a (0–255)", kind: "number", default: "12" },
        { id: "b", label: "b (0–255)", kind: "number", default: "10" },
        { id: "k", label: "Shift k (1–7)", kind: "number", default: "2" },
      ],
      actions: [
        { id: "binary", label: "a → binary", run: (v) => { const a = byte(v, "a"); return typeof a === "string" ? a : run(`${a} in binary`, "Decimal to binary by repeated division by 2 (remainders give the bits from bit 0 upwards), shown in an 8-bit register.", BASICS_CODE.toBinary, BASICS_NOTES.toBinary, { ...BIT_LEGEND, found: "bit just found / 1 bits being added up" }, "O(log n) divisions", collect(toBinary(a))); } },
        { id: "and", label: "a AND b", run: op("&") },
        { id: "or", label: "a OR b", run: op("|") },
        { id: "xor", label: "a XOR b", run: op("^") },
        { id: "not", label: "NOT a", run: (v) => { const a = byte(v, "a"); return typeof a === "string" ? a : run(`~${a}`, "8-bit bitwise NOT (one's complement), flipping one column at a time.", BASICS_CODE.not, BASICS_NOTES.not, { ...BIT_LEGEND, current: "bit being flipped", found: "flipped bit" }, "O(1)", collect(notOp(a))); } },
        { id: "shl", label: "a << k", run: sh("left") },
        { id: "shr", label: "a >> k", run: sh("right") },
      ],
      presets: [
        { label: "12 and 10", fill: { a: "12", b: "10", k: "2" }, run: () => blank(12, 10, "a = 12 (0000 1100) and b = 10 (0000 1010). Try AND, OR and XOR and compare the results.") },
        { label: "45 and 27", fill: { a: "45", b: "27" }, run: () => blank(45, 27, "a = 45 (0010 1101) and b = 27 (0001 1011): more columns where the bits differ.") },
        { label: "Mask: 181 and 15", fill: { a: "181", b: "15" }, run: () => blank(181, 15, "b = 15 = 0000 1111 is a mask for the low 4 bits. a AND b keeps them (5); a XOR b flips them (186).") },
        { label: "Overflow: 200 << 1", fill: { a: "200", k: "1" }, run: (v) => blank(200, current(v, "b", 10), "200 << 1 would be 400, which doesn't fit in 8 bits. Press a << k to watch the top bit fall off.") },
        { label: "Remainder: 37 >> 2", fill: { a: "37", k: "2" }, run: (v) => blank(37, current(v, "b", 10), "37 >> 2 divides by 4 and rounds down. Press a >> k to watch the two low bits (the remainder, 1) fall off.") },
      ],
      view: () => blank(12, 10, "Each row is an 8-bit register: bit 0 on the right is worth 1, bit 7 on the left is worth 128. Solid boxes are 1s, faded boxes are 0s."),
    };
  },
};

// ---------------------------------------------------------------------------
// Topic 2: single-bit tricks
// ---------------------------------------------------------------------------

type MaskKind = "check" | "set" | "clear" | "toggle";

const TRICK_CODE = {
  check: ["isSet(n, k):", "  mask = 1 << k           // only bit k is 1", "  return (n & mask) != 0"],
  set: ["setBit(n, k):", "  mask = 1 << k", "  return n | mask         // OR with 1 forces a 1"],
  clear: ["clearBit(n, k):", "  mask = 1 << k", "  return n & ~mask        // AND with 0 forces a 0"],
  toggle: ["toggleBit(n, k):", "  mask = 1 << k", "  return n ^ mask         // XOR with 1 flips"],
  pow2: ["isPowerOfTwo(n):", "  if n == 0: return false", "  return (n & (n − 1)) == 0"],
  count: ["countOnes(n):            // Kernighan", "  count = 0", "  while n != 0:", "    n = n & (n − 1)       // clears the lowest 1", "    count = count + 1", "  return count"],
  lowest: ["lowestSetBit(n):", "  neg = ~n + 1            // −n in two's complement", "  return n & neg"],
};

const TRICK_NOTES: Record<keyof typeof TRICK_CODE, string[]> = {
  check: ["Test one bit without caring about the others.", "1 << k is a mask with a single 1, at bit k.", "AND with the mask zeroes every other column; the result is nonzero exactly when bit k of n is 1."],
  set: ["Force bit k to 1 and leave the others alone.", "1 << k is a mask with a single 1, at bit k.", "x | 1 = 1 forces bit k on; x | 0 = x leaves every other bit unchanged."],
  clear: ["Force bit k to 0 and leave the others alone.", "1 << k is a mask with a single 1, at bit k.", "~mask has a 0 only at bit k: x & 0 = 0 clears it, x & 1 = x keeps the rest."],
  toggle: ["Flip bit k and leave the others alone.", "1 << k is a mask with a single 1, at bit k.", "x ^ 1 flips bit k; x ^ 0 = x leaves the rest. Toggling twice restores n."],
  pow2: ["A power of two has exactly one 1 bit.", "0 has no 1 bits, and needs its own check because 0 & (0 − 1) is also 0.", "n − 1 turns the lowest 1 into 0 and the bits below it into 1s. If that lowest 1 was the only one, nothing survives the AND."],
  count: ["Count the 1 bits (population count) using Brian Kernighan's trick.", "No bits counted yet.", "Each loop clears one 1 bit, so it stops after exactly popcount(n) rounds.", "n − 1 flips the lowest 1 and the zeros below it; ANDing with n wipes out exactly that lowest 1.", "One more 1 bit removed.", "The loop ran once per 1 bit, not once per bit position."],
  lowest: ["Isolate the lowest 1 bit of n.", "In two's complement −n = ~n + 1: the +1 ripples through the trailing 1s of ~n, so −n matches n at the lowest 1 and below, and is the opposite of n above it.", "AND keeps only the columns where both are 1: just the lowest set bit."],
};

export const maskResult = (kind: MaskKind, n: number, k: number) => (kind === "check" ? n & (1 << k) : kind === "set" ? n | (1 << k) : kind === "clear" ? n & ~(1 << k) & 255 : n ^ (1 << k));

function* maskOp(kind: MaskKind, n: number, k: number): Generator<Frame> {
  const N = bitsOf(n);
  let M: (Bit | null)[] = Array(W).fill(null);
  let NM: Bit[] | null = null;
  let R: Bit[] | null = null;
  const mask = 1 << k;
  const result = maskResult(kind, n, k);
  const sym = kind === "set" ? "|" : kind === "toggle" ? "^" : "&";
  const rows = (): Row[] => {
    const rs: Row[] = [
      { key: "n", label: "n", bits: N, value: `= ${n}` },
      { key: "m", label: "mask", bits: M, value: M.every(Boolean) ? `= ${(M as Bit[]).reduce((s, b, i) => s + b.v * 2 ** i, 0)}` : undefined },
    ];
    if (NM) rs.push({ key: "nm", label: "~mask", bits: NM, value: `= ${~mask & 255}` });
    if (R) rs.push({ key: "r", label: `n ${sym} ${NM ? "~mask" : "mask"}`, bits: R, value: `= ${result}` });
    return rs;
  };
  const nk = bitAt(n, k);
  const intro: Record<MaskKind, string> = {
    check: `Is bit ${k} of ${n} set? Build a mask with a single 1 at bit ${k}, then AND it with n.`,
    set: `Set bit ${k} of ${n} (make it 1) without touching any other bit: OR with a mask.`,
    clear: `Clear bit ${k} of ${n} (make it 0) without touching any other bit: AND with the inverted mask.`,
    toggle: `Toggle (flip) bit ${k} of ${n} without touching any other bit: XOR with a mask.`,
  };
  const other = kind === "clear" ? ~mask & 255 : mask;
  const q =
    kind === "check"
      ? ask(`Is bit ${k} of ${n} set?`, nk ? "Yes" : "No", ["Yes", "No"], `${n} = ${spaced(bin(n))}. Counting from bit 0 on the right, bit ${k} is ${nk}. Equivalently ${n} & ${mask} = ${n & mask}, which is ${n & mask ? "nonzero" : "zero"}.`)
      : qa(`What is the result?`, result, [n, n | mask, n & ~mask & 255, n ^ mask, n + mask, n - mask].filter((x) => x >= 0 && x <= 255), `n ${sym} ${kind === "clear" ? "~mask" : "mask"} = ${spaced(bin(n))} ${sym} ${spaced(bin(other))} = ${spaced(bin(result))} = ${result}. Only bit ${k} can change: every other column is combined with the value that leaves it alone.`);
  yield bitFrame(rows(), { line: 0, message: intro[kind], question: q });
  const one = mk(1, [colX(0), rowY(0), 0.6]);
  M = Array.from({ length: W }, (_, i) => (i === 0 ? one : mk(0)));
  yield bitFrame(rows(), { line: 1, message: "Start the mask from 1 = 0000 0001.", states: { [one.id]: "found" } });
  if (k > 0) {
    M = shiftBits(M as Bit[], k, "left", (i) => mk(0, [colX(i - k), rowY(1), 0.3])).next;
    yield bitFrame(rows(), { line: 1, message: `Shift it left ${plural(k, "place")}: 1 << ${k} = ${mask} = ${spaced(bin(mask))}. Now only bit ${k} is 1.`, states: { [one.id]: "found" }, callouts: [{ at: one.id, text: `1 << ${k} = ${mask}`, tone: "info", below: true }] });
  }
  if (kind === "clear") {
    NM = (M as Bit[]).map((b, i) => mk(1 - b.v, [colX(i), rowY(1), 0.5]));
    yield bitFrame(rows(), { line: 2, message: `Invert the mask: ~mask = ${spaced(bin(~mask & 255))}. Every bit is 1 except bit ${k}.`, states: { [NM[k].id]: "current" } });
  }
  const operand = (NM ?? M) as Bit[];
  const operandRow = NM ? 2 : 1;
  R = N.map((_, i) => mk(bitAt(result, i), [colX(i), rowY(operandRow), 0.5]));
  const rk = R[k].v;
  const applyMsg: Record<MaskKind, string> = {
    check: `n & mask: every other column is ANDed with 0 and becomes 0. Column ${k} keeps n's bit: ${nk} & 1 = ${rk}.`,
    set: `n | mask: column ${k} becomes ${nk} | 1 = 1. Every other column is ORed with 0 and keeps n's bit.`,
    clear: `n & ~mask: column ${k} becomes ${nk} & 0 = 0. Every other column is ANDed with 1 and keeps n's bit.`,
    toggle: `n ^ mask: column ${k} flips, ${nk} ^ 1 = ${rk}. Every other column is XORed with 0 and keeps n's bit.`,
  };
  const ruleAt = rows().length - 1;
  yield bitFrame(rows(), { line: 2, rule: ruleAt, col: k, message: applyMsg[kind], states: { [N[k].id]: "current", [operand[k].id]: "current", [R[k].id]: "found" }, callouts: [{ at: R[k].id, text: `${nk} ${sym} ${operand[k].v} = ${rk}`, tone: "good", below: true }] });
  const done: Record<MaskKind, string> = {
    check: `n & mask = ${result} ${result ? `≠ 0, so bit ${k} of ${n} is set.` : `= 0, so bit ${k} of ${n} is not set.`}`,
    set: `Result ${result}: ${n} with bit ${k} set.${nk ? " It was already 1, so nothing changed." : ` That added ${mask} (= 2^${k}).`}`,
    clear: `Result ${result}: ${n} with bit ${k} cleared.${nk ? ` That removed ${mask} (= 2^${k}).` : " It was already 0, so nothing changed."}`,
    toggle: `Result ${result}: bit ${k} went from ${nk} to ${rk}. Toggling the result again gives back ${n}.`,
  };
  yield bitFrame(rows(), { line: 2, rule: ruleAt, message: done[kind] });
}

function* powerOfTwo(n: number): Generator<Frame> {
  const N = bitsOf(n);
  let M1: Bit[] | null = null;
  let R: Bit[] | null = null;
  const m1 = u8(n - 1);
  const res = n & m1;
  const rows = (): Row[] => {
    const rs: Row[] = [{ key: "n", label: "n", bits: N, value: `= ${n}` }];
    if (M1) rs.push({ key: "m", label: "n − 1", bits: M1, value: `= ${m1}` });
    if (R) rs.push({ key: "r", label: "n & (n − 1)", bits: R, value: `= ${res}` });
    return rs;
  };
  const isPow = n > 0 && res === 0;
  yield bitFrame(rows(), {
    line: 0,
    message: `Is ${n} a power of two? A power of two has exactly one 1 bit, and n & (n − 1) == 0 tests exactly that.`,
    question: ask(`Is ${n} a power of two?`, isPow ? "Yes" : "No", ["Yes", "No"], n === 0 ? "0 has no 1 bits at all, so it isn't a power of two. That's why the test also checks n > 0." : `${n} = ${spaced(bin(n))} has ${plural(popcount(n), "set bit")}. A power of two has exactly one.`),
  });
  if (n === 0) {
    yield bitFrame(rows(), { line: 1, message: "n = 0 has no 1 bits, so it isn't a power of two. The special case matters: 0 − 1 wraps to 255 in 8 bits, and 0 & 255 = 0 would otherwise wrongly pass the test." });
    return;
  }
  const low = lowestBit(n);
  M1 = bitsOf(m1, W, (i) => [colX(i), rowY(0), 0.4]);
  const st: Record<string, NodeState> = { [N[low].id]: "current", [M1[low].id]: "removing" };
  for (let i = 0; i < low; i++) st[M1[i].id] = "found";
  yield bitFrame(rows(), { line: 2, message: `n − 1 = ${m1}. Subtracting 1 turns the lowest 1 bit (bit ${low}) into 0 and every bit below it into 1; higher bits don't change.`, states: st, callouts: [{ at: M1[low].id, text: low ? `bit ${low}: 1 → 0, below: 0s → 1s` : "bit 0: 1 → 0", tone: "info", below: true }] });
  R = bitsOf(res, W, (i) => [colX(i), rowY(1), 0.4]);
  const survivors = onesOf(res);
  yield bitFrame(rows(), {
    line: 2,
    rule: 2,
    message: `AND them. At bit ${low} and below, n and n − 1 never both have a 1, so those columns become 0. What's left are n's other 1 bits: ${res}.`,
    states: Object.fromEntries(survivors.map((i) => [R![i].id, "pending" as NodeState])),
    callouts: [{ at: R[survivors.length ? survivors[survivors.length - 1] : low].id, text: survivors.length ? `${plural(survivors.length, "1")} survive${survivors.length === 1 ? "s" : ""}` : "nothing survives", tone: survivors.length ? "bad" : "good", below: true }],
  });
  yield bitFrame(rows(), { line: 2, rule: 2, message: isPow ? `n & (n − 1) = 0 and n > 0: ${n} has a single 1 bit, so it's a power of two (2^${low}). ✓` : `n & (n − 1) = ${res} ≠ 0: ${n} has more than one 1 bit, so it isn't a power of two.` });
}

function* countOnes(n: number): Generator<Frame> {
  let cur = bitsOf(n);
  let val = n;
  let count = 0;
  let M1: Bit[] | null = null;
  let R: Bit[] | null = null;
  const rows = (): Row[] => {
    const rs: Row[] = [{ key: "n", label: "n", bits: cur, value: `= ${val}` }];
    if (M1) rs.push({ key: "m", label: "n − 1", bits: M1, value: `= ${u8(val - 1)}` });
    if (R) rs.push({ key: "r", label: "n & (n − 1)", bits: R, value: `= ${val & (val - 1)}` });
    return rs;
  };
  const aux = (): AuxList[] => [{ label: "count", items: [String(count)] }];
  const pc = popcount(n);
  yield bitFrame(rows(), { line: 0, message: `Count the 1 bits of ${n}. Kernighan's trick: n & (n − 1) removes the lowest 1 bit, so count how many times that happens before n reaches 0.`, aux: aux(), question: qa(`How many 1 bits does ${n} have?`, pc, [pc - 1, pc + 1, 8 - pc, pc + 2].filter((x) => x >= 0 && x <= 8), `${n} = ${spaced(bin(n))}: counting the 1s gives ${pc}. Kernighan's loop runs exactly ${plural(pc, "time")}, once per 1 bit.`) });
  yield bitFrame(rows(), { line: 1, message: "count = 0.", aux: aux() });
  while (val) {
    const low = lowestBit(val);
    M1 = bitsOf(u8(val - 1), W, (i) => [colX(i), rowY(0), 0.4]);
    const st: Record<string, NodeState> = { [cur[low].id]: "current", [M1[low].id]: "removing" };
    for (let i = 0; i < low; i++) st[M1[i].id] = "found";
    yield bitFrame(rows(), { line: 3, message: `n = ${val}. Its lowest 1 is bit ${low}. n − 1 = ${val - 1} turns that bit into 0 and the bits below it into 1s.`, states: st, aux: aux() });
    const rv = val & (val - 1);
    R = bitsOf(rv, W, (i) => [colX(i), rowY(1), 0.4]);
    yield bitFrame(rows(), { line: 3, rule: 2, message: `n & (n − 1) = ${rv}: bit ${low} is gone and every higher bit is unchanged.`, states: { [cur[low].id]: "removing", [R[low].id]: "found" }, callouts: [{ at: R[low].id, text: `bit ${low} cleared`, tone: "good", below: true }], aux: aux() });
    count++;
    cur = R;
    val = rv;
    M1 = null;
    R = null;
    yield bitFrame(rows(), { line: 4, message: `count = ${count}. The result moves up to become the new n${val ? "" : ", which is now 0"}.`, aux: aux() });
  }
  yield bitFrame(rows(), { line: 5, message: `n reached 0 after ${plural(count, "round")}: ${n} has ${plural(count, "set bit")}. The loop ran once per 1 bit, not once per bit position.`, aux: aux() });
}

function* lowestSetBit(n: number): Generator<Frame> {
  const N = bitsOf(n);
  let INV: Bit[] | null = null;
  let NEG: Bit[] | null = null;
  let R: Bit[] | null = null;
  const neg = u8(-n);
  const res = n & neg;
  const rows = (): Row[] => {
    const rs: Row[] = [{ key: "n", label: "n", bits: N, value: `= ${n}` }];
    if (INV) rs.push({ key: "inv", label: "~n", bits: INV, value: `= ${u8(~n)}` });
    if (NEG) rs.push({ key: "neg", label: "−n = ~n + 1", bits: NEG, value: `= ${neg}` });
    if (R) rs.push({ key: "r", label: "n & −n", bits: R, value: `= ${res}` });
    return rs;
  };
  const low = lowestBit(n);
  yield bitFrame(rows(), {
    line: 0,
    message: "n & −n keeps only the lowest 1 bit of n. In two's complement, −n = ~n + 1.",
    question: qa(`What is ${n} & −${n}?`, res, [n, neg, low >= 0 ? 2 ** Math.min(low + 1, 7) : 1, 1, 0], n ? `${n} = ${spaced(bin(n))}; its lowest 1 is bit ${low}, worth ${2 ** low}. −n agrees with n from bit ${low} down and is the opposite above it, so the AND leaves just ${2 ** low}.` : "0 has no 1 bits, so the result is 0."),
  });
  INV = N.map((b, i) => mk(1 - b.v, [colX(i), rowY(0), 0.4]));
  yield bitFrame(rows(), { line: 1, message: `Flip every bit: ~n = ${spaced(bin(u8(~n)))}.` });
  NEG = bitsOf(neg, W, (i) => [colX(i), rowY(1), 0.4]);
  const changed: Record<string, NodeState> = {};
  const upto = n ? low : W - 1;
  for (let i = 0; i <= upto; i++) changed[NEG[i].id] = "found";
  yield bitFrame(rows(), { line: 1, message: n ? `Add 1. ~n ends in ${plural(low, "1")} (n's trailing zeros): the carry turns them into 0s and stops at bit ${low}, which becomes 1. So −n matches n at bit ${low} and below, and is the opposite of n above it.` : "Add 1: ~0 = 1111 1111, and +1 carries out of every bit, giving 0 again (the final carry falls off).", states: changed });
  R = bitsOf(res, W, (i) => [colX(i), rowY(2), 0.4]);
  yield bitFrame(rows(), { line: 2, rule: 3, message: n ? `AND n with −n. Above bit ${low} they're opposite, so those columns are 0. Below bit ${low} both are 0. Only bit ${low} survives.` : "0 & 0 = 0.", states: n ? { [R[low].id]: "found" } : {}, callouts: n ? [{ at: R[low].id, text: `only bit ${low} survives`, tone: "good", below: true }] : undefined });
  yield bitFrame(rows(), { line: 2, rule: 3, message: n ? `${n} & −${n} = ${res} = 2^${low}: the value of the lowest set bit. Fenwick trees use i & −i to jump between ranges.` : "0 & −0 = 0: there is no lowest set bit." });
}

export const bitsTricksTopic: TopicDef = {
  id: "bits-tricks",
  name: "Bit tricks",
  category: "Bit manipulation",
  icon: "🎯",
  blurb: "Test, set, clear and toggle single bits with masks; the n & (n − 1) and n & −n tricks.",
  create(): TopicInstance {
    const nk = (v: Values) => {
      const n = num(v.n, "n", 0, 255);
      const k = num(v.k, "k", 0, 7);
      return typeof n === "string" ? n : typeof k === "string" ? k : ([n, k] as const);
    };
    const maskAction = (kind: MaskKind, label: string) => (v: Values): Run | string => {
      const p = nk(v);
      if (typeof p === "string") return p;
      return run(`${label} ${p[1]} of ${p[0]}`, `${label} k with a mask built as 1 << k (8-bit values, bit 0 is the least significant).`, TRICK_CODE[kind], TRICK_NOTES[kind], { ...BIT_LEGEND, current: "bit k", found: "mask bit / result bit" }, "O(1)", collect(maskOp(kind, p[0], p[1])));
    };
    const nOnly = (v: Values) => num(v.n, "n", 0, 255);
    const blank = (n: number, msg: string) => still("Bit tricks", bitFrame([{ key: "n", label: "n", bits: bitsOf(n), value: `= ${n}` }], { line: -1, message: msg }));
    return {
      fields: [
        { id: "n", label: "n (0–255)", kind: "number", default: "44" },
        { id: "k", label: "Bit k (0–7)", kind: "number", default: "3" },
      ],
      actions: [
        { id: "check", label: "Check bit k", run: maskAction("check", "Check bit") },
        { id: "set", label: "Set bit k", run: maskAction("set", "Set bit") },
        { id: "clear", label: "Clear bit k", run: maskAction("clear", "Clear bit") },
        { id: "toggle", label: "Toggle bit k", run: maskAction("toggle", "Toggle bit") },
        { id: "pow2", label: "Power of two?", run: (v) => { const n = nOnly(v); return typeof n === "string" ? n : run(`Is ${n} a power of two?`, "Power-of-two test: n > 0 and (n & (n − 1)) == 0, on 8-bit values.", TRICK_CODE.pow2, TRICK_NOTES.pow2, { ...BIT_LEGEND, current: "lowest 1 bit of n", found: "0 that became 1", removing: "1 that became 0", pending: "1 that survives the AND" }, "O(1)", collect(powerOfTwo(n))); } },
        { id: "count", label: "Count 1 bits", run: (v) => { const n = nOnly(v); return typeof n === "string" ? n : run(`Count the 1 bits of ${n}`, "Brian Kernighan's population count: repeat n = n & (n − 1), counting iterations.", TRICK_CODE.count, TRICK_NOTES.count, { ...BIT_LEGEND, current: "lowest 1 bit", found: "changed bit", removing: "bit being cleared" }, "O(number of 1 bits)", collect(countOnes(n))); } },
        { id: "lowest", label: "Lowest set bit", run: (v) => { const n = nOnly(v); return typeof n === "string" ? n : run(`${n} & −${n}`, "Isolate the lowest set bit with n & −n, where −n is the 8-bit two's complement ~n + 1.", TRICK_CODE.lowest, TRICK_NOTES.lowest, { ...BIT_LEGEND, found: "bits changed by the +1 / surviving bit" }, "O(1)", collect(lowestSetBit(n))); } },
      ],
      presets: [
        { label: "n = 44, k = 3", fill: { n: "44", k: "3" }, run: () => blank(44, "44 = 0010 1100: bits 5, 3 and 2 are set.") },
        { label: "Bit already off: k = 4", fill: { n: "44", k: "4" }, run: () => blank(44, "Bit 4 of 44 is 0. Clear bit k changes nothing; Set bit k and Toggle bit k add 16.") },
        { label: "Power of two: 64", fill: { n: "64" }, run: () => blank(64, "64 = 0100 0000 has a single 1 bit. Try Power of two?") },
        { label: "Not a power: 96", fill: { n: "96" }, run: () => blank(96, "96 = 0110 0000 has two 1 bits. Try Power of two? and Lowest set bit.") },
        { label: "Edge case: 0", fill: { n: "0" }, run: () => blank(0, "0 has no 1 bits: a classic edge case for the power-of-two test.") },
        { label: "All ones: 255", fill: { n: "255" }, run: () => blank(255, "255 = 1111 1111. Count 1 bits needs 8 rounds; Lowest set bit gives 1.") },
      ],
      view: () => blank(44, "Pick a trick. Each one builds a mask and combines it with AND, OR or XOR."),
    };
  },
};

// ---------------------------------------------------------------------------
// Topic 3: two's complement & XOR tricks
// ---------------------------------------------------------------------------

const XOR_CODE = {
  negate: ["negate(n):               // 8-bit two's complement", "  r = ~n                  // flip every bit", "  carry = 1               // then add 1", "  for i = 0 to 7:", "    r[i], carry = r[i] XOR carry, r[i] AND carry", "  return r                // bit 7 is worth −128"],
  ashr: ["arithmeticShiftRight(n, k):", "  copy n into r", "  repeat k times:", "    every bit moves down one place; bit 0 falls off", "    bit 7 = copy of the old bit 7      // keeps the sign", "  // = floor(n / 2^k)"],
  swap: ["xorSwap(a, b):", "  a = a ^ b", "  b = a ^ b      // (a ^ b) ^ b = original a", "  a = a ^ b      // (a ^ b) ^ a = original b"],
  single: ["singleNumber(nums):", "  acc = 0", "  for x in nums:", "    acc = acc ^ x        // x ^ x = 0: pairs cancel", "  return acc"],
  add: ["add(a, b):", "  while b != 0:", "    sum = a ^ b            // adds each column, drops carries", "    carry = (a & b) << 1   // carries move one column up", "    a, b = sum, carry", "  return a"],
};

const XOR_NOTES: Record<keyof typeof XOR_CODE, string[]> = {
  negate: [
    "Two's complement: the top bit is worth −128 instead of +128, so adding a negative number works with the ordinary adder.",
    "Flipping every bit gives ~n = −n − 1.",
    "Adding 1 fixes the −1: ~n + 1 = −n.",
    "The +1 is an ordinary addition, column by column.",
    "Sum bit = bit XOR carry; new carry = bit AND carry. The carry ripples through 1s and stops at the first 0.",
    "The result reads as −n. Check: n + (−n) wraps around to 0 in 8 bits.",
  ],
  ashr: [
    "Divide a signed number by 2^k, rounding down, by shifting.",
    "Work on a copy so the original stays visible.",
    "One place at a time, k times.",
    "Each bit moves to half its value; bit 0 falls off.",
    "Copying the sign bit keeps negative numbers negative (a logical shift would fill with 0 and turn them positive).",
    "Rounding is towards −∞: −5 >> 1 = −3, not −2.",
  ],
  swap: ["Swap two values with no temporary variable, using x ^ x = 0 and x ^ 0 = x.", "a now holds a ^ b: 1 wherever the two values differ.", "b ^ (a ^ b) = a: the two copies of b cancel.", "(a ^ b) ^ a = b: the two copies of a cancel."],
  single: ["Every number appears twice except one: find it in O(n) time and O(1) space.", "0 is the identity for XOR: 0 ^ x = x.", "Go through the numbers once.", "XOR is commutative and associative, so pairs cancel no matter how far apart they are.", "Only the unpaired number is left."],
  add: [
    "Add two numbers using only bit operations, the way an adder circuit does.",
    "When there are no carries left, a holds the answer.",
    "XOR adds each column but forgets the carry: 1 + 1 gives 0.",
    "A carry appears exactly where both bits are 1, and it belongs one column higher.",
    "Now add the carries to the partial sum in the next round.",
    "No carries left: a = a + b (mod 256).",
  ],
};

function* negate(n: number): Generator<Frame> {
  const N = bitsOf(u8(n));
  let INV: Bit[] | null = null;
  const R: (Bit | null)[] = Array(W).fill(null);
  const target = s8(-n);
  const tbits = bin(u8(-n));
  const rows = (): Row[] => {
    const rs: Row[] = [{ key: "n", label: "n", bits: N, value: `= ${fmt(n)}` }];
    if (INV) {
      rs.push({ key: "inv", label: "~n", bits: INV, value: `= ${fmt(s8(~n))}` });
      rs.push({ key: "r", label: "~n + 1", bits: R, value: R.every(Boolean) ? `= ${fmt(target)}` : undefined });
    }
    return rs;
  };
  const signed = true;
  yield bitFrame(rows(), {
    signed,
    line: 0,
    message: `Negate ${fmt(n)} in 8-bit two's complement. Recipe: flip every bit, then add 1. Note bit 7 is worth −128, not +128.`,
    question: qa(`What is −(${fmt(n)}) in 8-bit two's complement?`, spaced(tbits), [bin(u8(~n)), bin(u8(n) ^ 128), bin(u8(n)), bin(u8(-n) ^ 1)].map(spaced), `~n = ${spaced(bin(u8(~n)))}, and adding 1 gives ${spaced(tbits)} = ${signedSum(u8(-n))} = ${fmt(target)}. Just flipping the sign bit (sign-magnitude) is not how two's complement works.`),
  });
  INV = N.map((b, i) => mk(1 - b.v, [colX(i), rowY(0), 0.4]));
  yield bitFrame(rows(), { signed, line: 1, message: `Flip every bit: ~n = ${spaced(bin(u8(~n)))}, which is ${fmt(s8(~n))} = −n − 1. One more step to go.` });
  const stop = n === 0 ? "it falls off the top" : `bit ${lowestBit(u8(n))}`;
  yield bitFrame(rows(), {
    signed,
    line: 2,
    rule: 2,
    message: "Now add 1: a carry of 1 goes into bit 0.",
    carries: [0],
    carryRow: 1,
    question: qa(`The +1 ripples up through ~n until it meets a 0. Where does it stop?`, stop, ["bit 0", "bit 1", "bit 2", "bit 3", "bit 7", "it falls off the top"], `A carry turns every 1 it meets into 0 and stops at the first 0. ~n has 0s exactly where n has 1s, so it stops at n's lowest 1 bit${n === 0 ? ". n = 0 has none, so the carry runs off the top" : `: ${stop}`}.`),
  });
  let carry = 1;
  let i = 0;
  for (; i < W && carry; i++) {
    const x = INV[i].v;
    const rb = mk(x ^ 1, [colX(i), rowY(1), 0.4]);
    R[i] = rb;
    const last = i === W - 1 && x === 1;
    yield bitFrame(rows(), {
      signed,
      line: 4,
      rule: 2,
      col: i,
      message: `Bit ${i}: ${x} + 1 = ${x + 1}${x ? ` → write 0, carry 1 into bit ${i + 1}` : " → write 1, no carry"}.${last ? " The carry out of bit 7 has nowhere to go and is dropped." : ""}`,
      states: { [INV[i].id]: "current", [rb.id]: "found" },
      carries: x && i + 1 < W ? [i + 1] : [],
      carryRow: 1,
      callouts: [{ at: rb.id, text: x ? `${x} + 1 = 10₂` : `${x} + 1 = 1`, tone: x ? "warn" : "good", below: true }],
    });
    carry = x;
  }
  if (i < W) {
    for (let j = i; j < W; j++) R[j] = mk(INV[j].v, [colX(j), rowY(1), 0.4]);
    yield bitFrame(rows(), { signed, line: 4, rule: 2, message: `No carry left, so bits ${i} to 7 are copied from ~n unchanged.` });
  }
  const note = n === -128 ? " −(−128) would be +128, which needs 9 bits: the result wraps back to −128. It's the one value with no positive partner." : n === 0 ? " The carry fell off the top, so −0 = 0: two's complement has only one zero." : ` Check: ${fmt(n)} + (${fmt(target)}) = 0 in 8 bits.`;
  yield bitFrame(rows(), { signed, line: 5, rule: 2, message: `−(${fmt(n)}) = ${spaced(tbits)} = ${signedSum(u8(-n))} = ${fmt(target)}.${note}` });
}

function* arithmeticShift(n: number, k: number): Generator<Frame> {
  const N = bitsOf(u8(n));
  let R: (Bit | null)[] = Array(W).fill(null);
  let L: Bit[] | null = null;
  let val = n;
  let s = 0;
  const res = n >> k;
  const logical = u8(n) >>> k;
  const rows = (): Row[] => {
    const rs: Row[] = [
      { key: "n", label: "n", bits: N, value: `= ${fmt(n)}` },
      { key: "r", label: `n >> ${s}`, bits: R, value: R.every(Boolean) ? `= ${fmt(val)}` : undefined },
    ];
    if (L) rs.push({ key: "l", label: `n >>> ${k}`, bits: L, value: `= ${logical}` });
    return rs;
  };
  const signed = true;
  yield bitFrame(rows(), {
    signed,
    line: 0,
    message: `Arithmetic right shift of ${fmt(n)} by ${k}: bits move down, and the sign bit (bit 7 = ${bitAt(u8(n), 7)}) is copied into the empty top places, so the sign is kept.`,
    question: qa(`What is ${fmt(n)} >> ${k} (arithmetic)?`, fmt(res), [logical, Math.trunc(n / 2 ** k), res + 1, n * 2 ** k].map(fmt), `Each shift divides by 2 rounding down (towards −∞): ⌊${fmt(n)} / ${2 ** k}⌋ = ${fmt(res)}.${n < 0 ? ` A logical shift would fill with 0s and give ${logical} instead.` : ""}`, [res - 1, res + 2].map(fmt)),
  });
  R = N.map((b, i) => mk(b.v, [colX(i), rowY(0), 0.4]));
  yield bitFrame(rows(), { signed, line: 1, message: "Copy n into the result register." });
  for (s = 1; s <= k; s++) {
    const prev = val;
    const sign = (R[W - 1] as Bit).v;
    const { next, out } = shiftBits(R as Bit[], 1, "right", () => mk(sign, [colX(W - 1), rowY(1), 0.3]));
    R = next;
    val = prev >> 1;
    yield bitFrame(rows(), { signed, line: 4, message: `Shift ${s}: bits move down one place, bit 0 falls off, and bit 7 gets a copy of the sign bit (${sign}). ⌊${fmt(prev)} / 2⌋ = ${fmt(val)}.`, states: { [next[W - 1].id]: "found" }, extraNodes: fallen(out, rowY(1)), callouts: [{ at: next[W - 1].id, text: `sign ${sign} copied`, tone: "info", below: true }] });
  }
  s = k;
  L = bitsOf(logical, W, (i) => [colX(i), rowY(0), 0.4]);
  yield bitFrame(rows(), { signed, line: 5, message: `${fmt(n)} >> ${k} = ${fmt(res)} = ⌊${fmt(n)} / ${2 ** k}⌋.${n < 0 ? ` Compare the logical shift (>>> in Java and JavaScript), which fills with 0s: the same bits read as ${logical}. Same movement, very different meaning.` : " n isn't negative, so the sign bit is 0 and this matches a logical shift."}` });
}

function* xorSwap(a: number, b: number): Generator<Frame> {
  let A = bitsOf(a);
  let B = bitsOf(b);
  let va = a;
  let vb = b;
  const rows = (): Row[] => [
    { key: "a", label: "a", bits: A, value: `= ${va}` },
    { key: "b", label: "b", bits: B, value: `= ${vb}` },
  ];
  const header = false;
  yield bitFrame(rows(), { header, line: 0, message: `Swap a = ${a} and b = ${b} with three XORs and no temporary variable. It relies on x ^ x = 0 and x ^ 0 = x.`, question: qa(`After the first step a = a ^ b, what does a hold?`, a ^ b, [a, b, a & b, a | b], `${spaced(bin(a))} ^ ${spaced(bin(b))} = ${spaced(bin(a ^ b))} = ${a ^ b}: 1 wherever a and b differ.`) });
  const flipWhere = (row: Bit[], by: Bit[]) => row.map((x, i) => (by[i].v ? { ...x, v: (1 - x.v) as 0 | 1 } : x));
  const flipped = (by: Bit[], row: Bit[]): Record<string, NodeState> => Object.fromEntries(row.filter((_, i) => by[i].v).map((x) => [x.id, "current" as NodeState]));
  A = flipWhere(A, B);
  va = a ^ b;
  yield bitFrame(rows(), { header, line: 1, message: `a = a ^ b = ${va}. a's bits flip wherever b has a 1. a now holds the "difference" of the two numbers.`, states: flipped(B, A), callouts: [{ at: A[0].id, text: `a = ${a} ^ ${b} = ${va}`, tone: "info" }] });
  B = flipWhere(B, A);
  vb = va ^ b;
  yield bitFrame(rows(), { header, line: 2, message: `b = a ^ b = (${a} ^ ${b}) ^ ${b} = ${vb}. The two copies of ${b} cancel, so b now holds the original a.`, states: flipped(A, B), callouts: [{ at: B[0].id, text: `b = ${vb} (old a)`, tone: "good", below: true }] });
  A = flipWhere(A, B);
  va = va ^ vb;
  yield bitFrame(rows(), { header, line: 3, message: `a = a ^ b = (${a} ^ ${b}) ^ ${a} = ${va}. The two copies of ${a} cancel, so a now holds the original b.`, states: flipped(B, A), callouts: [{ at: A[0].id, text: `a = ${va} (old b)`, tone: "good" }] });
  yield bitFrame(rows(), { header, line: 3, message: `Swapped: a = ${va}, b = ${vb}, with no extra variable. (In real code a temporary is clearer and just as fast. And if a and b are the same variable, the first XOR sets it to 0.)` });
}

function* singleNumber(nums: number[]): Generator<Frame> {
  const items = nums.map(newItem);
  let acc = bitsOf(0);
  let va = 0;
  let X: Bit[] | null = null;
  let xv = 0;
  const seen = new Map<number, number>();
  const tokenY = rowY(0) + 2.3;
  const rows = (): Row[] => [
    { key: "x", label: "x", bits: X ?? Array(W).fill(null), value: X ? `= ${xv}` : undefined, y: rowY(0) },
    { key: "acc", label: "acc", bits: acc, value: `= ${va}`, y: rowY(1) },
  ];
  const tokens = (states: Record<string, NodeState> = {}) => {
    const r = arrayNodes({ slots: items, y: tokenY, prefix: "num", states, showIndex: false });
    return { extraNodes: r.nodes, extraMarkers: [...r.markers, { id: "nums-label", text: "nums", pos: [(-(items.length - 1) / 2) * TOKEN_GAP - 0.78, tokenY, 0] as Vec3, align: "right" as const, size: 0.3, color: INK }] };
  };
  const done: Record<string, NodeState> = {};
  let asked = false;
  yield bitFrame(rows(), { line: 0, message: `Every number in [${nums.join(", ")}] appears twice except one. XOR them all together: each pair cancels (x ^ x = 0), and the single number is what's left.`, ...tokens() });
  yield bitFrame(rows(), { line: 1, message: "acc = 0.", ...tokens() });
  for (let t = 0; t < items.length; t++) {
    const x = nums[t];
    const tokenX = (t - (items.length - 1) / 2) * TOKEN_GAP;
    X = bitsOf(x, W, () => [tokenX, tokenY, 0.4]);
    xv = x;
    const cnt = (seen.get(x) ?? 0) + 1;
    seen.set(x, cnt);
    const second = cnt % 2 === 0;
    const nv = va ^ x;
    let q: Question | undefined;
    if (!asked && second) {
      asked = true;
      q = qa(`acc = ${va}. What will acc be after XORing ${x} again?`, nv, [va, x, va | x, va & x], `${x} was already XORed in once. Doing it again cancels it (x ^ x = 0), so acc drops back to ${nv}: the XOR of the numbers seen an odd number of times so far.`);
    }
    yield bitFrame(rows(), { line: 2, message: `Next number: x = ${x} = ${spaced(bin(x))}.${second ? ` ${x} has been seen before.` : ""}`, ...tokens({ ...done, [items[t].id]: "current" }), question: q });
    const flip: Record<string, NodeState> = Object.fromEntries(acc.filter((_, i) => bitAt(x, i)).map((b) => [b.id, "current" as NodeState]));
    acc = acc.map((b, i) => ({ ...b, v: bitAt(nv, i) }));
    const prev = va;
    va = nv;
    done[items[t].id] = "visited";
    yield bitFrame(rows(), { line: 3, message: `acc = ${prev} ^ ${x} = ${va}: acc's bits flip wherever x has a 1.${second ? ` This is the second ${x}, so it cancels the first one.` : ""}`, states: flip, ...tokens({ ...done, [items[t].id]: second ? "found" : "visited" }), callouts: [{ at: items[t].id, text: second ? `second ${x}: cancels` : `acc ^= ${x}`, tone: second ? "good" : "info" }] });
  }
  X = null;
  yield bitFrame(rows(), { line: 4, message: `Every pair cancelled, leaving acc = ${va}: the number that appears only once. One pass, O(n) time and O(1) extra space.`, states: Object.fromEntries(acc.filter((b) => b.v).map((b) => [b.id, "found" as NodeState])), ...tokens(done) });
}

function* addNoPlus(a: number, b: number): Generator<Frame> {
  let A = bitsOf(a);
  let B = bitsOf(b);
  let va = a;
  let vb = b;
  let S: Bit[] | null = null;
  let C: Bit[] | null = null;
  let cLabel = "a & b";
  let cv = 0;
  let round = 0;
  const rows = (): Row[] => {
    const rs: Row[] = [
      { key: "a", label: "a", bits: A, value: `= ${va}` },
      { key: "b", label: "b", bits: B, value: `= ${vb}` },
    ];
    if (S) rs.push({ key: "s", label: "a ^ b", bits: S, value: `= ${va ^ vb}` });
    if (C) rs.push({ key: "c", label: cLabel, bits: C, value: `= ${cv}` });
    return rs;
  };
  const aux = (): AuxList[] => [{ label: "round", items: [String(round)] }];
  yield bitFrame(rows(), { line: 0, message: `Add ${a} + ${b} without +. XOR adds each column but drops the carries; AND finds where carries happen; << 1 moves each carry to the next column. Repeat until there are no carries.`, aux: aux(), question: qa(`First round: what is a ^ b = ${a} ^ ${b}?`, a ^ b, [u8(a + b), a & b, a | b, Math.abs(a - b)], `${spaced(bin(a))} ^ ${spaced(bin(b))} = ${spaced(bin(a ^ b))} = ${a ^ b}. It's the sum with every carry thrown away.`) });
  while (vb !== 0) {
    round++;
    yield bitFrame(rows(), { line: 1, message: `Round ${round}: b = ${vb} ≠ 0, so there are carries left to add.`, aux: aux() });
    const sum = va ^ vb;
    S = bitsOf(sum, W, (i) => [colX(i), rowY(1), 0.4]);
    const carryCols = onesOf(va & vb);
    const st: Record<string, NodeState> = {};
    for (const i of carryCols) {
      st[A[i].id] = "current";
      st[B[i].id] = "current";
    }
    yield bitFrame(rows(), { line: 2, rule: 2, message: `sum = a ^ b = ${sum}. ${carryCols.length ? `Columns with 1 + 1 (${carryCols.map((i) => `bit ${i}`).join(", ")}) give 0 here: their carries are handled next.` : "No column has 1 + 1, so nothing is lost."}`, states: st, aux: aux() });
    const and = va & vb;
    cLabel = "a & b";
    cv = and;
    C = bitsOf(and, W, (i) => [colX(i), rowY(1), 0.4]);
    yield bitFrame(rows(), { line: 3, rule: 2, message: `a & b = ${and}: a 1 exactly where both a and b have a 1, which is where a carry is produced.`, states: Object.fromEntries(carryCols.map((i) => [C![i].id, "found" as NodeState])), aux: aux() });
    const { next, out } = shiftBits(C, 1, "left", (i) => mk(0, [colX(i - 1), rowY(3), 0.3]));
    C = next;
    cv = u8(and << 1);
    cLabel = "(a & b) << 1";
    yield bitFrame(rows(), { line: 3, rule: 2, message: `Shift left by 1: each carry belongs one column higher. carry = ${cv}.${out[0]?.bit.v ? " A carry fell off the top: the true sum is 256 or more, and 8 bits keep it mod 256." : ""}`, states: Object.fromEntries(C.filter((x) => x.v).map((x) => [x.id, "found" as NodeState])), extraNodes: fallen(out.filter((o) => o.bit.v), rowY(3)), aux: aux() });
    A = S;
    B = C;
    va = sum;
    vb = cv;
    S = null;
    C = null;
    yield bitFrame(rows(), { line: 4, message: `a = sum = ${va}, b = carry = ${vb}.${vb ? " Add these in the next round." : ""}`, aux: aux() });
  }
  yield bitFrame(rows(), { line: 5, message: `b = 0: no carries left. a = ${va} = ${a} + ${b}${a + b > 255 ? ` mod 256 (the true sum ${a + b} needs 9 bits)` : ""}. It took ${plural(round, "round")}: each round pushes the carries one column further up.`, states: Object.fromEntries(A.filter((x) => x.v).map((x) => [x.id, "found" as NodeState])), aux: aux() });
}

export const bitsXorTopic: TopicDef = {
  id: "bits-xor",
  name: "Two's complement & XOR",
  category: "Bit manipulation",
  icon: "±",
  blurb: "Negative numbers in binary, sign-keeping shifts, and XOR tricks: swap, single number, add without +.",
  create(): TopicInstance {
    const signedN = (v: Values) => num(v.n, "n", -128, 127);
    const pair = (v: Values) => {
      const a = num(v.a, "a", 0, 255);
      const b = num(v.b, "b", 0, 255);
      return typeof a === "string" ? a : typeof b === "string" ? b : ([a, b] as const);
    };
    const blank = (n: number, msg: string) => still("Two's complement & XOR", bitFrame([{ key: "n", label: "n", bits: bitsOf(u8(n)), value: `= ${fmt(n)}` }], { line: -1, signed: true, message: msg }));
    const shown = (v: Values) => {
      const n = signedN(v);
      return typeof n === "string" ? -20 : n;
    };
    return {
      fields: [
        { id: "n", label: "n (−128–127)", kind: "number", default: "-20" },
        { id: "k", label: "Shift k (1–7)", kind: "number", default: "2" },
        { id: "a", label: "a (0–255)", kind: "number", default: "13" },
        { id: "b", label: "b (0–255)", kind: "number", default: "6" },
        { id: "list", label: "Numbers (pairs + one single)", kind: "text", default: "5, 3, 7, 3, 5", wide: true },
      ],
      actions: [
        { id: "negate", label: "Negate n", run: (v) => { const n = signedN(v); return typeof n === "string" ? n : run(`−(${fmt(n)}) in two's complement`, "8-bit two's complement negation: invert all bits, then add 1 with carry propagation. Bit 7 has weight −128.", XOR_CODE.negate, XOR_NOTES.negate, { ...BIT_LEGEND, current: "bit being added", found: "result bit" }, "O(1) in hardware · up to 8 carry steps by hand", collect(negate(n))); } },
        { id: "ashr", label: "Arithmetic n >> k", run: (v) => { const n = signedN(v); const k = num(v.k, "k", 1, 7); if (typeof n === "string") return n; if (typeof k === "string") return k; return run(`${fmt(n)} >> ${k} (arithmetic)`, "Arithmetic (sign-extending) right shift of an 8-bit two's complement value, compared with a logical shift at the end.", XOR_CODE.ashr, XOR_NOTES.ashr, { ...BIT_LEGEND, found: "copied sign bit", removing: "falling off the end" }, "O(1)", collect(arithmeticShift(n, k))); } },
        { id: "swap", label: "XOR swap a, b", run: (v) => { const p = pair(v); return typeof p === "string" ? p : run(`XOR swap ${p[0]} and ${p[1]}`, "XOR swap: a ^= b; b ^= a; a ^= b on 8-bit values.", XOR_CODE.swap, XOR_NOTES.swap, { ...BIT_LEGEND, current: "bit that just flipped" }, "O(1) · 3 XORs", collect(xorSwap(p[0], p[1]))); } },
        {
          id: "single",
          label: "Single number",
          run: (v) => {
            const l = numList(v.list, "Numbers", 3, 9, 0, 255);
            if (typeof l === "string") return l;
            const counts = new Map<number, number>();
            for (const x of l) counts.set(x, (counts.get(x) ?? 0) + 1);
            if ([...counts.values()].filter((c) => c % 2).length !== 1) return "Every number should appear twice except exactly one, e.g. 5, 3, 7, 3, 5.";
            return run(`Single number in [${l.join(", ")}]`, "XOR every element: pairs cancel, leaving the element that appears an odd number of times.", XOR_CODE.single, XOR_NOTES.single, { ...BIT_LEGEND, current: "bit that just flipped / number being read", visited: "number already XORed", found: "second copy / answer" }, "O(n) time · O(1) space", collect(singleNumber(l)));
          },
        },
        { id: "add", label: "Add a + b without +", run: (v) => { const p = pair(v); return typeof p === "string" ? p : run(`${p[0]} + ${p[1]} without +`, "Bitwise addition: repeat sum = a ^ b, carry = (a & b) << 1 until the carry is 0 (8-bit, so sums wrap mod 256).", XOR_CODE.add, XOR_NOTES.add, { ...BIT_LEGEND, current: "column producing a carry", found: "carry bit / answer" }, "O(word size) rounds", collect(addNoPlus(p[0], p[1]))); } },
      ],
      presets: [
        { label: "n = −20", fill: { n: "-20", k: "2" }, run: () => blank(-20, "−20 = 1110 1100 = −128 + 64 + 32 + 8 + 4. Negate it, or shift it right arithmetically.") },
        { label: "Rounding: −21 >> 2", fill: { n: "-21", k: "2" }, run: () => blank(-21, "−21 / 4 = −5.25. An arithmetic shift rounds towards −∞, giving −6, not −5.") },
        { label: "Edge: n = −128", fill: { n: "-128" }, run: () => blank(-128, "−128 = 1000 0000 is the most negative 8-bit value. What happens when you negate it?") },
        { label: "Edge: n = 0", fill: { n: "0" }, run: () => blank(0, "Negating 0: the carry runs off the top.") },
        { label: "Long carry: 127 + 1", fill: { a: "127", b: "1" }, run: (v) => blank(shown(v), "a = 127, b = 1: a carry ripples through seven columns. Press Add a + b without +.") },
        { label: "Overflow: 200 + 100", fill: { a: "200", b: "100" }, run: (v) => blank(shown(v), "200 + 100 = 300 doesn't fit in 8 bits. Watch a carry fall off the top.") },
        { label: "Swap 9 and 14", fill: { a: "9", b: "14" }, run: (v) => blank(shown(v), "Loaded a = 9 and b = 14 for the XOR swap.") },
        { label: "Single in 4, 1, 2, 1, 2", fill: { list: "4, 1, 2, 1, 2" }, run: (v) => blank(shown(v), "Loaded 4, 1, 2, 1, 2. Press Single number.") },
      ],
      view: () => blank(-20, "Signed 8-bit numbers: bit 7 is worth −128 (shown in red). Pick a scenario."),
    };
  },
};

// ---------------------------------------------------------------------------
// Topic 4: subsets as bitmasks
// ---------------------------------------------------------------------------

const SUBSET_CODE = {
  all: ["allSubsets(items):", "  for mask = 0 to 2^n − 1:", "    subset = []", "    for i = 0 to n − 1:", "      if mask & (1 << i): subset.add(items[i])", "    output subset"],
  sum: ["subsetSum(nums, target):", "  for mask = 0 to 2^n − 1:", "    s = sum of nums[i] for every bit i set in mask", "    if s == target: record the subset"],
  decode: ["decode(mask, items):", "  for i = 0 to n − 1:", "    if (mask >> i) & 1: include items[i]"],
};

const SUBSET_NOTES: Record<keyof typeof SUBSET_CODE, string[]> = {
  all: [
    "Each of the n items is either in or out: 2^n subsets, one per n-bit number.",
    "Counting from 0 to 2^n − 1 runs through every combination of bits exactly once.",
    "Build the subset for this mask.",
    "Look at each bit of the mask.",
    "1 << i is the single bit for item i; AND tests whether the mask contains it.",
    "Every mask gives a different subset, so all 2^n are produced: O(2^n · n).",
  ],
  sum: ["Brute force over all subsets: fine for small n.", "Every mask is one subset.", "Add up the items whose bits are set.", "Keep the subsets that hit the target exactly."],
  decode: ["Turn a mask back into the items it selects.", "Check each bit position.", "Shift the mask down so bit i lands in position 0, then AND with 1 to read it."],
};

const setText = (names: string[]) => (names.length ? `{${names.join(", ")}}` : "∅");

function subsetFrame(items: string[], M: Bit[], o: BitOpts & { itemStates?: Record<number, NodeState> }): Frame {
  const n = items.length;
  const elY = rowY(0) + 2.6;
  const extraNodes: VNode[] = items.map((name, i) => ({ id: `el:${i}`, label: name, pos: [colX(i, n), elY, 0], state: o.itemStates?.[i] ?? "idle", shape: "box", size: [0.84, 0.84, 0.56] }));
  const extraMarkers: Marker[] = [{ id: "items-label", text: "items", pos: [colX(n - 1, n) - 0.72, elY, 0], align: "right", size: 0.3, color: INK }];
  return bitFrame([{ key: "mask", label: "mask", bits: M, value: `= ${M.reduce((s, b, i) => s + b.v * 2 ** i, 0)}` }], { ...o, width: n, extraNodes: [...extraNodes, ...(o.extraNodes ?? [])], extraMarkers: [...extraMarkers, ...(o.extraMarkers ?? [])] });
}

/** Wrong readings of a mask: bits read left to right, the complement, and off by one place. */
function subsetDistractors(items: string[], mask: number): string[] {
  const n = items.length;
  const full = (1 << n) - 1;
  const pick = (m: number) => setText(onesOf(m, n).map((i) => items[i]));
  const mirrored = onesOf(mask, n).reduce((m, i) => m | (1 << (n - 1 - i)), 0);
  return [pick(mirrored), pick(~mask & full), pick((mask << 1) & full), pick(mask >> 1)];
}

const inOut = (items: string[], mask: number): Record<number, NodeState> => Object.fromEntries(items.map((_, i) => [i, (bitAt(mask, i) ? "found" : "ghost") as NodeState]));

function* allSubsets(items: string[]): Generator<Frame> {
  const n = items.length;
  let M = bitsOf(0, n);
  const out: string[] = [];
  const total = 2 ** n;
  const aux = (): AuxList[] => [{ label: `Subsets so far (${out.length}/${total})`, items: [...out] }];
  const qMasks = new Set([Math.floor(total / 3) + 1, total - 3].filter((m) => m > 0 && m < total - 1 && popcount(m) >= 2));
  yield subsetFrame(items, M, { line: 0, message: `Each of the ${n} items is either in or out, so there are 2^${n} = ${total} subsets. Mask bit i says whether items[i] is in (bit 0 is the rightmost).`, aux: aux(), question: qa(`How many subsets does a set of ${n} items have?`, total, [n * n, total - 1, 2 * n, total * 2], `Each item has 2 choices (in or out), made independently: 2 × 2 × … = 2^${n} = ${total}, including the empty set and the full set.`) });
  for (let mask = 0; mask < total; mask++) {
    M = M.map((b, i) => ({ ...b, v: bitAt(mask, i) }));
    const sel = onesOf(mask, n);
    const names = sel.map((i) => items[i]);
    const setBits = Object.fromEntries(M.filter((b) => b.v).map((b) => [b.id, "current" as NodeState]));
    if (qMasks.has(mask)) yield subsetFrame(items, M, { line: 1, message: `mask = ${mask} = ${bin(mask, n)}.`, states: setBits, aux: aux(), question: qa(`Which subset does mask ${bin(mask, n)} select?`, setText(names), subsetDistractors(items, mask), `Read the bits from the right: bit 0 is ${items[0]}, bit 1 is ${items[1]}, and so on. The 1 bits are at positions ${sel.join(", ")}, so the subset is ${setText(names)}.`, [setText(items), "∅"]) });
    out.push(setText(names));
    yield subsetFrame(items, M, { line: 4, message: `mask = ${mask} = ${bin(mask, n)}: ${sel.length ? `${sel.length > 1 ? "bits" : "bit"} ${sel.join(", ")} set → ${setText(names)}` : "no bits set → the empty set ∅"}.`, itemStates: inOut(items, mask), states: setBits, aux: aux() });
  }
  yield subsetFrame(items, M, { line: 5, message: `All ${total} subsets visited, from ∅ (mask 0) to the full set (mask ${total - 1} = ${bin(total - 1, n)}). Each mask costs O(n) to decode, so O(2^n · n) in total.`, itemStates: inOut(items, total - 1), aux: aux() });
}

export const subsetSums = (nums: number[], target: number) => {
  const n = nums.length;
  const hits: number[] = [];
  for (let m = 0; m < 2 ** n; m++) if (onesOf(m, n).reduce((s, i) => s + nums[i], 0) === target) hits.push(m);
  return hits;
};

function* subsetSum(nums: number[], target: number): Generator<Frame> {
  const n = nums.length;
  const items = nums.map(String);
  let M = bitsOf(0, n);
  const matches: string[] = [];
  const total = 2 ** n;
  const aux = (): AuxList[] => [{ label: `Subsets summing to ${target}`, items: [...matches] }];
  const answers = subsetSums(nums, target).map((m) => setText(onesOf(m, n).map((i) => items[i])));
  yield subsetFrame(items, M, { line: 0, message: `Which subsets of [${nums.join(", ")}] add up to ${target}? Try all ${total} masks.`, aux: aux(), question: qa(`How many subsets of [${nums.join(", ")}] sum to ${target}?`, answers.length, [answers.length + 1, answers.length + 2, Math.max(answers.length - 1, 0), total], answers.length ? `They are ${answers.join(" and ")}. Every other mask misses the target.` : `None of the ${total} subsets adds up to ${target}.`) });
  for (let mask = 0; mask < total; mask++) {
    M = M.map((b, i) => ({ ...b, v: bitAt(mask, i) }));
    const sel = onesOf(mask, n);
    const s = sel.reduce((acc, i) => acc + nums[i], 0);
    const hit = s === target;
    if (hit) matches.push(setText(sel.map((i) => items[i])));
    yield subsetFrame(items, M, {
      line: hit ? 3 : 2,
      message: `mask ${bin(mask, n)}: ${sel.length ? `${sel.map((i) => nums[i]).join(" + ")} = ${s}` : "empty, sum 0"}${hit ? ` = ${target} ✓` : ""}.`,
      itemStates: Object.fromEntries(items.map((_, i) => [i, (sel.includes(i) ? (hit ? "visited" : "pending") : "ghost") as NodeState])),
      states: Object.fromEntries(M.filter((b) => b.v).map((b) => [b.id, "current" as NodeState])),
      callouts: hit && sel.length ? [{ at: `el:${sel[sel.length - 1]}`, text: `sum = ${target} ✓`, tone: "good" }] : undefined,
      aux: aux(),
    });
  }
  yield subsetFrame(items, M, { line: 3, message: matches.length ? `Found ${plural(matches.length, "subset")} summing to ${target}: ${matches.join(", ")}. Brute force checks all 2^n masks, so it only suits small n.` : `No subset of [${nums.join(", ")}] sums to ${target}.`, aux: aux() });
}

function* decodeMask(items: string[], mask: number): Generator<Frame> {
  const n = items.length;
  const M = bitsOf(mask, n);
  const sel = onesOf(mask, n);
  const names = sel.map((i) => items[i]);
  const decided: Record<number, NodeState> = {};
  yield subsetFrame(items, M, { line: 0, message: `Decode mask ${mask} = ${bin(mask, n)} over [${items.join(", ")}]: bit i tells whether items[i] is in.`, question: qa(`Which subset is mask ${bin(mask, n)}?`, setText(names), subsetDistractors(items, mask), `Read the bits from the right: bit 0 is ${items[0]}. The 1 bits are at positions ${sel.join(", ") || "none"}, so the subset is ${setText(names)}.`, [setText(items), "∅"]) });
  for (let i = 0; i < n; i++) {
    const b = bitAt(mask, i);
    decided[i] = b ? "found" : "ghost";
    yield subsetFrame(items, M, { line: 2, col: i, message: `Bit ${i}: (${mask} >> ${i}) & 1 = ${b}, so ${items[i]} is ${b ? "in" : "out"}.`, itemStates: { ...decided }, states: { [M[i].id]: "current" }, callouts: [{ at: `el:${i}`, text: b ? "in ✓" : "out", tone: b ? "good" : "info" }] });
  }
  yield subsetFrame(items, M, { line: 2, message: `Mask ${mask} = ${bin(mask, n)} selects ${setText(names)}.`, itemStates: inOut(items, mask) });
}

export const bitsSubsetsTopic: TopicDef = {
  id: "bits-subsets",
  name: "Bitmask subsets",
  category: "Bit manipulation",
  icon: "🧩",
  blurb: "Every subset of n items is an n-bit number. Loop over masks to try every combination.",
  create(): TopicInstance {
    const itemsOf = (v: Values): string[] | string => {
      const parts = (v.items ?? "").split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2 || parts.length > 5) return "Enter 2 to 5 items, e.g. a b c d.";
      if (parts.some((p) => p.length > 3)) return "Keep item names short (up to 3 characters).";
      if (new Set(parts).size !== parts.length) return "Item names must be different.";
      return parts;
    };
    const blank = (items: string[], mask: number, msg: string) => still("Bitmask subsets", subsetFrame(items, bitsOf(mask, items.length), { line: -1, message: msg, itemStates: inOut(items, mask) }));
    const ABCD = ["a", "b", "c", "d"];
    return {
      fields: [
        { id: "items", label: "Items (2–5)", kind: "text", default: "a b c d" },
        { id: "mask", label: "Mask", kind: "number", default: "11" },
        { id: "nums", label: "Numbers (2–5)", kind: "text", default: "3, 5, 6, 8" },
        { id: "target", label: "Target sum", kind: "number", default: "11" },
      ],
      actions: [
        { id: "all", label: "All subsets", run: (v) => { const it = itemsOf(v); return typeof it === "string" ? it : run(`All subsets of {${it.join(", ")}}`, "Enumerate subsets by counting mask from 0 to 2^n − 1; bit i (bit 0 = rightmost) selects items[i].", SUBSET_CODE.all, SUBSET_NOTES.all, { current: "set bit", ghost: "bit = 0 / item left out", found: "item in the subset" }, "O(2^n · n)", collect(allSubsets(it))); } },
        {
          id: "sum",
          label: "Subset sum",
          run: (v) => {
            const l = numList(v.nums, "Numbers", 2, 5, 0, 99);
            const t = num(v.target, "Target", 0, 500);
            if (typeof l === "string") return l;
            if (typeof t === "string") return t;
            return run(`Subsets of [${l.join(", ")}] summing to ${t}`, "Brute-force subset sum over all bitmasks (bit i selects nums[i]).", SUBSET_CODE.sum, SUBSET_NOTES.sum, { current: "set bit", ghost: "bit = 0 / number left out", pending: "number in this subset", visited: "subset hits the target" }, "O(2^n · n)", collect(subsetSum(l, t)));
          },
        },
        {
          id: "decode",
          label: "Decode mask",
          run: (v) => {
            const it = itemsOf(v);
            if (typeof it === "string") return it;
            const m = num(v.mask, "Mask", 0, 2 ** it.length - 1);
            if (typeof m === "string") return m;
            return run(`Decode mask ${m}`, "Decode a bitmask into the subset it represents: items[i] is included when (mask >> i) & 1 == 1.", SUBSET_CODE.decode, SUBSET_NOTES.decode, { idle: "bit = 1 / item not decided yet", ghost: "bit = 0 / item left out", current: "bit being read", found: "item in the subset" }, "O(n)", collect(decodeMask(it, m)));
          },
        },
      ],
      presets: [
        { label: "Items a b c d, mask 11", fill: { items: "a b c d", mask: "11" }, run: () => blank(ABCD, 11, "4 items → 16 subsets. Mask 11 = 1011 selects a, b and d.") },
        { label: "3 items, mask 5", fill: { items: "x y z", mask: "5" }, run: () => blank(["x", "y", "z"], 5, "3 items → 8 subsets. Mask 5 = 101 selects x and z.") },
        { label: "5 items → 32 subsets", fill: { items: "a b c d e", mask: "21" }, run: () => blank(["a", "b", "c", "d", "e"], 21, "5 items → 32 subsets. Mask 21 = 10101 selects a, c and e.") },
        { label: "Subset sum 3, 5, 6, 8 → 11", fill: { nums: "3, 5, 6, 8", target: "11" }, run: () => blank(ABCD, 11, "Which subsets of 3, 5, 6, 8 add up to 11? Press Subset sum.") },
        { label: "No solution: 2, 4, 6 → 5", fill: { nums: "2, 4, 6", target: "5" }, run: () => blank(ABCD, 11, "All of 2, 4, 6 are even, so no subset can sum to 5. Press Subset sum to confirm.") },
      ],
      view: () => blank(ABCD, 11, "Each item gets one bit of the mask: bit 0 (rightmost) is the first item. Mask 11 = 1011 selects a, b and d."),
    };
  },
};
