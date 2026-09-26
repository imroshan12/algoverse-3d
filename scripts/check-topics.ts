/** Headless sanity check: run every action of every topic and verify key results. */
import { TOPICS } from "../src/topics";
import type { Run } from "../src/algorithms/types";
import { runSort } from "../src/topics/sorting";
import { runGraph2, NEG_GRAPH, NEG_CYCLE_GRAPH, DAG } from "../src/algorithms/graph2";
import { PRESET_GRAPH, randomGraph } from "../src/algorithms/graph";
import { LEARN } from "../src/topics/learn";
import { optionOrder, QUIZ } from "../src/topics/quiz";
import { subsetSums } from "../src/topics/bits";
import type { Frame } from "../src/algorithms/types";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log("  ✗", msg);
};
const checkRun = (label: string, r: Run | string) => {
  if (typeof r === "string") return fail(`${label}: returned error "${r}"`);
  if (!r.frames.length) return fail(`${label}: no frames`);
  if (r.code.length) {
    if (!r.notes) fail(`${label}: pseudocode has no notes`);
    else if (r.notes.length !== r.code.length) fail(`${label}: ${r.notes.length} notes for ${r.code.length} code lines`);
    else r.code.forEach((c, i) => c.trim() && !r.notes![i].trim() && fail(`${label}: code line ${i} "${c.trim()}" has no note`));
    if (!r.complexity) fail(`${label}: no complexity`);
    if (!r.legend) fail(`${label}: no legend`);
  }
  for (const f of r.frames) {
    if (f.question && !f.question.options.includes(f.question.answer)) fail(`${label}: answer not in options (${f.question.prompt})`);
    if (f.question && new Set(f.question.options).size !== f.question.options.length) fail(`${label}: duplicate options`);
    if (f.line >= r.code.length) fail(`${label}: line ${f.line} out of range`);
    const ids = new Set<string>();
    for (const n of f.nodes) {
      if (ids.has(n.id)) fail(`${label}: duplicate node id ${n.id}`);
      ids.add(n.id);
      if (n.pos.some((x) => !Number.isFinite(x))) fail(`${label}: bad position for ${n.id}`);
    }
    for (const e of f.edges) {
      if (!ids.has(e.from) || !ids.has(e.to)) fail(`${label}: dangling edge ${e.id}`);
      if (e.flowFrom && e.flowFrom !== e.from && e.flowFrom !== e.to) fail(`${label}: edge ${e.id} flows from ${e.flowFrom}, not an endpoint`);
    }
    const edgeIds = new Set<string>();
    for (const e of f.edges) {
      if (edgeIds.has(e.id)) fail(`${label}: duplicate edge id ${e.id}`);
      edgeIds.add(e.id);
    }
    for (const c of f.callouts ?? []) for (const at of Array.isArray(c.at) ? c.at : [c.at]) if (!ids.has(at)) fail(`${label}: callout "${c.text}" points at missing node ${at}`);
  }
  return r;
};

for (const t of TOPICS) {
  if (!LEARN[t.id]) fail(`${t.id}: no concept card`);
  const inst = t.create();
  const values = Object.fromEntries(inst.fields.map((f) => [f.id, f.default]));
  checkRun(`${t.id} view`, inst.view());
  const runAll = (tag: string) => {
    for (const a of inst.actions) {
      const r = a.run(values);
      const ok = checkRun(`${t.id}.${a.id}${tag}`, r);
      if (ok && typeof ok !== "string" && !tag) console.log(`  ${t.id}.${a.id}: ${ok.frames.length} frames — ${ok.frames.at(-1)!.message.slice(0, 90)}`);
    }
  };
  runAll("");
  for (const p of inst.presets) {
    Object.assign(values, p.fill ?? {});
    checkRun(`${t.id} preset ${p.label}`, p.run(values));
    if (p.label !== "Clear") runAll(` after "${p.label}"`);
  }
}

// Sorting correctness on many random arrays.
for (const algo of ["bubble", "selection", "insertion", "merge", "quick", "heap"] as const) {
  for (let k = 0; k < 50; k++) {
    const arr = Array.from({ length: 2 + Math.floor(Math.random() * 12) }, () => Math.floor(Math.random() * 30));
    const r = runSort(algo, arr);
    const final = r.frames.at(-1)!.aux[0].items.map(Number);
    const want = [...arr].sort((a, b) => a - b);
    if (final.join() !== want.join()) { fail(`${algo} sorted ${arr} as ${final}`); break; }
  }
}

// Graph checks.
const bf = runGraph2(NEG_GRAPH, "bellman", "S").frames.at(-1)!.message;
if (!bf.includes("S=0, A=5, B=5, C=7, D=9, E=8")) fail(`Bellman-Ford: ${bf}`);
if (!runGraph2(NEG_CYCLE_GRAPH, "bellman", "S").frames.at(-1)!.message.includes("negative cycle")) fail("negative cycle not detected");
for (let k = 0; k < 30; k++) {
  const g = k === 0 ? PRESET_GRAPH : randomGraph(9);
  const w = (algo: "prim" | "kruskal") => Number(runGraph2(g, algo, "A").frames.at(-1)!.message.match(/weight (\d+)/)?.[1]);
  if (w("prim") !== w("kruskal")) fail(`MST weights differ: prim ${w("prim")} kruskal ${w("kruskal")}`);
}
for (const algo of ["kahn", "topodfs"] as const) {
  const msg = runGraph2(DAG, algo, "A").frames.at(-1)!.message;
  const order = msg.split(":")[1].replace(/\.$/, "").split("→").map((s) => s.trim());
  const pos = Object.fromEntries(order.map((v, i) => [v, i]));
  if (order.length !== 8 || DAG.edges.some((e) => pos[e.a] > pos[e.b])) fail(`${algo} order invalid: ${order}`);
}

// Practice questions: every topic has a well-formed set.
for (const t of TOPICS) {
  const qs = QUIZ[t.id];
  if (!qs || qs.length < 4) fail(`${t.id}: only ${qs?.length ?? 0} practice questions`);
  for (const level of ["Easy", "Medium", "Hard"]) if (!qs?.some((q) => q.level === level)) fail(`${t.id}: no ${level} practice question`);
  qs?.forEach((q, i) => {
    const tag = `${t.id} quiz ${i + 1}`;
    if (!q.q.trim()) fail(`${tag}: empty question`);
    if (q.options.length < 3) fail(`${tag}: fewer than 3 options`);
    if (new Set(q.options).size !== q.options.length) fail(`${tag}: duplicate options`);
    if (q.answer < 0 || q.answer >= q.options.length) fail(`${tag}: answer index out of range`);
    if (q.explain.split("\n").some((l) => !l.trim())) fail(`${tag}: empty explanation line`);
    if (!["Easy", "Medium", "Hard"].includes(q.level)) fail(`${tag}: bad level`);
    const order = optionOrder(`${t.id}:${i}`, q.options.length);
    if ([...order].sort().join() !== q.options.map((_, k) => k).join()) fail(`${tag}: option order is not a permutation`);
  });
}
for (const id of Object.keys(QUIZ)) if (!TOPICS.some((t) => t.id === id)) fail(`quiz for unknown topic ${id}`);
const firstSlots = TOPICS.flatMap((t) => QUIZ[t.id].map((q, i) => optionOrder(`${t.id}:${i}`, q.options.length).indexOf(q.answer)));
const spread = [0, 1, 2, 3].map((k) => firstSlots.filter((x) => x === k).length);
if (Math.min(...spread) < firstSlots.length / 8) fail(`correct answers bunch up in one display slot: ${spread}`);

// Bit manipulation: read the registers the scene actually draws and compare with JavaScript's own operators.
const bits = (n: number) => (n & 255).toString(2).padStart(8, "0");
/** Each register row of a frame as a string of bits, most significant first, top row first. */
const registers = (f: Frame): string[] => {
  const rows = new Map<number, { x: number; v: string }[]>();
  for (const n of f.nodes) {
    if (!/^bit\d+$/.test(n.id) || n.state === "removing") continue;
    const y = Math.round(n.pos[1] * 100);
    if (!rows.has(y)) rows.set(y, []);
    rows.get(y)!.push({ x: n.pos[0], v: n.label });
  }
  return [...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map((c) => c.v).join(""));
};
const bitTopic = (id: string) => TOPICS.find((t) => t.id === id)!.create();
const runBit = (inst: ReturnType<typeof bitTopic>, action: string, v: Record<string, string>) => {
  const values = { ...Object.fromEntries(inst.fields.map((f) => [f.id, f.default])), ...v };
  const r = inst.actions.find((a) => a.id === action)!.run(values);
  if (typeof r === "string") throw new Error(`${action}: ${r}`);
  checkRun(`bits ${action} ${JSON.stringify(v)}`, r);
  return r.frames;
};
const rnd = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const expectBits = (label: string, got: string | undefined, want: string) => got !== want && fail(`${label}: drew ${got}, expected ${want}`);

const basics = bitTopic("bits-basics");
const tricks = bitTopic("bits-tricks");
const xor = bitTopic("bits-xor");
const subsets = bitTopic("bits-subsets");
for (let k = 0; k < 120; k++) {
  const a = k < 3 ? [0, 255, 128][k] : rnd(0, 255);
  const b = k < 3 ? [255, 0, 127][k] : rnd(0, 255);
  const s = rnd(1, 7);
  const bit = rnd(0, 7);
  const n = k < 3 ? [-128, 0, 127][k] : rnd(-128, 127);
  expectBits(`binary ${a}`, registers(runBit(basics, "binary", { a: `${a}` }).at(-1)!)[0], bits(a));
  for (const [op, want] of [["and", a & b], ["or", a | b], ["xor", a ^ b]] as const) expectBits(`${a} ${op} ${b}`, registers(runBit(basics, op, { a: `${a}`, b: `${b}` }).at(-1)!).at(-1), bits(want));
  expectBits(`~${a}`, registers(runBit(basics, "not", { a: `${a}` }).at(-1)!).at(-1), bits(~a));
  expectBits(`${a} << ${s}`, registers(runBit(basics, "shl", { a: `${a}`, k: `${s}` }).at(-1)!).at(-1), bits(a << s));
  expectBits(`${a} >> ${s}`, registers(runBit(basics, "shr", { a: `${a}`, k: `${s}` }).at(-1)!).at(-1), bits(a >> s));
  const want = { check: a & (1 << bit), set: a | (1 << bit), clear: a & ~(1 << bit), toggle: a ^ (1 << bit) };
  for (const [op, w] of Object.entries(want)) expectBits(`${op} bit ${bit} of ${a}`, registers(runBit(tricks, op, { n: `${a}`, k: `${bit}` }).at(-1)!).at(-1), bits(w));
  const pow = runBit(tricks, "pow2", { n: `${a}` }).at(-1)!.message;
  if (pow.includes("so it's a power of two") !== (a > 0 && (a & (a - 1)) === 0)) fail(`power of two ${a}: ${pow}`);
  const ones = bits(a).split("").filter((c) => c === "1").length;
  if (!runBit(tricks, "count", { n: `${a}` }).at(-1)!.message.includes(`has ${ones} set bit`)) fail(`count ones ${a}`);
  expectBits(`${a} & −${a}`, registers(runBit(tricks, "lowest", { n: `${a}` }).at(-1)!).at(-1), bits(a & -a));
  expectBits(`−(${n})`, registers(runBit(xor, "negate", { n: `${n}` }).at(-1)!).at(-1), bits(-n));
  const sh = registers(runBit(xor, "ashr", { n: `${n}`, k: `${s}` }).at(-1)!);
  expectBits(`${n} >> ${s}`, sh[1], bits(n >> s));
  expectBits(`${n} >>> ${s}`, sh[2], bits((n & 255) >>> s));
  const sw = registers(runBit(xor, "swap", { a: `${a}`, b: `${b}` }).at(-1)!);
  if (sw[0] !== bits(b) || sw[1] !== bits(a)) fail(`xor swap ${a}, ${b}: ${sw}`);
  expectBits(`${a} + ${b}`, registers(runBit(xor, "add", { a: `${a}`, b: `${b}` }).at(-1)!)[0], bits(a + b));
  const pairs = [rnd(0, 255), rnd(0, 255), rnd(0, 255)];
  const single = rnd(0, 255);
  const list = [...pairs, ...pairs, single].sort(() => Math.random() - 0.5);
  expectBits(`single number in ${list}`, registers(runBit(xor, "single", { list: list.join(", ") }).at(-1)!).at(-1), bits(list.reduce((x, y) => x ^ y, 0)));
}
for (const items of ["a b", "x y z", "a b c d", "p q r s t"]) {
  const n = items.split(" ").length;
  const f = runBit(subsets, "all", { items }).at(-1)!;
  const listed = f.aux[0].items;
  if (listed.length !== 2 ** n || new Set(listed).size !== 2 ** n) fail(`all subsets of ${items}: ${listed.length} listed`);
  for (let m = 0; m < 2 ** n; m++) {
    const want = items.split(" ").filter((_, i) => (m >> i) & 1);
    const msg = runBit(subsets, "decode", { items, mask: `${m}` }).at(-1)!.message;
    if (!msg.endsWith(`selects ${want.length ? `{${want.join(", ")}}` : "∅"}.`)) fail(`decode ${m} over ${items}: ${msg}`);
  }
}
for (let k = 0; k < 40; k++) {
  const nums = Array.from({ length: rnd(2, 5) }, () => rnd(0, 20));
  const target = rnd(0, 40);
  const f = runBit(subsets, "sum", { nums: nums.join(", "), target: `${target}` }).at(-1)!;
  if (f.aux[0].items.length !== subsetSums(nums, target).length) fail(`subset sum ${nums} → ${target}`);
}

console.log(failures ? `\n${failures} FAILURES` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
