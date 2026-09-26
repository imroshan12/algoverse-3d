import type { Callout, EdgeState, Frame, Marker, NodeState, Question, Run, VEdge, VNode } from "../algorithms/types";
import { ask, collect, randomInts } from "../algorithms/util";
import { arrayFrame, newItem, type Item } from "./arrayView";
import { num, still } from "./helpers";
import type { TopicDef, Values } from "./types";

// ---------------- separate chaining ----------------

const M = 7;
const CHAIN_CODE = {
  insert: [
    "insert(T, k):",
    "  i = h(k) = k mod m",
    "  for node in T[i]:",
    "    if node.key == k: return    // no duplicates",
    "  append k to the chain T[i]",
  ],
  search: ["search(T, k):", "  i = h(k) = k mod m", "  for node in T[i]:", "    if node.key == k: return node", "  return null"],
  delete: ["delete(T, k):", "  i = h(k) = k mod m", "  for node in T[i]:", "    if node.key == k:", "      unlink node from T[i];  return", "  // not found"],
};

const CHAIN_NOTES: Record<keyof typeof CHAIN_CODE, string[]> = {
  insert: [
    "Add key k to the table.",
    "The hash function turns the key into a bucket number between 0 and m − 1.",
    "Only this bucket's chain can contain k, so only it is searched.",
    "Keys are unique here: if k is already stored there is nothing to insert.",
    "Colliding keys simply share the bucket's linked list. The average chain length is α = n / m.",
  ],
  search: [
    "Look up key k.",
    "Recompute the same hash: k can only live in bucket h(k).",
    "Walk just that chain; the other buckets are never touched.",
    "Found it.",
    "End of the chain without a match: k isn't in the table.",
  ],
  delete: [
    "Remove key k from the table.",
    "k can only be in bucket h(k).",
    "Walk that chain looking for it.",
    "Found the node holding k.",
    "Unlink it from the chain, exactly like deleting from a linked list.",
    "k isn't in the chain, so nothing changes.",
  ],
};
const CHAIN_LEGEND: Run["legend"] = { current: "bucket / key being compared", found: "new or found key", visited: "compared, no match", removing: "being deleted", idle: "stored key", ghost: "bucket" };

const BX = -4.5;
const bucketY = (i: number) => 3.3 - i * 1.15;

class ChainModel {
  buckets: Item[][] = Array.from({ length: M }, () => []);
  constructor(keys: number[]) {
    for (const k of keys) this.buckets[k % M].push(newItem(k));
  }
  f(line: number, message: string, o: { states?: Record<string, NodeState>; edges?: Record<string, EdgeState>; bucket?: number; floating?: Item; near?: string; question?: Question; drop?: string; callouts?: Callout[] } = {}): Frame {
    const nodes: VNode[] = [];
    const edges: VEdge[] = [];
    const markers: Marker[] = [];
    this.buckets.forEach((chain, i) => {
      const y = bucketY(i);
      nodes.push({ id: `b${i}`, label: String(i), pos: [BX, y, 0], state: o.bucket === i ? "current" : "ghost", shape: "box", size: [1, 0.95, 0.9] });
      let prev = `b${i}`;
      chain.forEach((it, k) => {
        const drop = o.drop === it.id;
        nodes.push({ id: it.id, label: String(it.v), pos: [BX + 1.9 * (k + 1), drop ? y - 0.55 : y, drop ? 0.9 : 0], state: o.states?.[it.id] ?? "idle", shape: "sphere" });
        const eid = `${prev}->${it.id}`;
        edges.push({ id: eid, from: prev, to: it.id, state: o.edges?.[eid] ?? "idle", directed: true });
        prev = it.id;
      });
    });
    if (o.floating) {
      // The key being looked up travels to its bucket, then hovers over each chain node it is compared with.
      const near = o.near ? nodes.find((n) => n.id === o.near) : undefined;
      const pos: [number, number, number] = near ? [near.pos[0] + 0.55, near.pos[1] + 0.95, 0.6] : [BX - 2.2, o.bucket !== undefined ? bucketY(o.bucket) : 4.6, 0.3];
      nodes.push({ id: o.floating.id, label: String(o.floating.v), pos, state: "found", shape: "sphere" });
    }
    markers.push({ id: "hdr", text: `m = ${M} buckets`, pos: [BX, 4.35, 0], color: "#5b6886" });
    const load = this.buckets.reduce((s, c) => s + c.length, 0) / M;
    return { nodes, edges, markers, callouts: o.callouts, line, message, question: o.question, aux: [{ label: "Load factor α = n / m", items: [load.toFixed(2)] }, { label: "Longest chain", items: [String(Math.max(...this.buckets.map((c) => c.length)))] }] };
  }

  private *walk(k: number, it: Item | undefined, line0: number, verb: string): Generator<Frame, { i: number; idx: number }> {
    const i = k % M;
    const probe = it ?? newItem(k);
    yield this.f(0, `${verb} ${k}. First, the hash function picks the one bucket it can be in.`, { floating: probe, question: ask(`Which bucket does ${k} hash to? (m = ${M})`, i, [...Array(M).keys()], `h(${k}) = ${k} mod ${M}. ${k} = ${M} × ${Math.floor(k / M)} + ${i}, so the remainder is ${i}.`) });
    yield this.f(1, `h(${k}) = ${k} mod ${M} = ${i}: go to bucket ${i}.${this.buckets[i].length ? ` Its chain has ${this.buckets[i].length} key${this.buckets[i].length > 1 ? "s" : ""}.` : " Its chain is empty."}`, { floating: probe, bucket: i, callouts: [{ at: `b${i}`, text: `${k} mod ${M} = ${i}`, tone: "info" }] });
    const chain = this.buckets[i];
    const seen: Record<string, NodeState> = {};
    let prev = `b${i}`;
    for (let idx = 0; idx < chain.length; idx++) {
      const node = chain[idx];
      const hit = node.v === k;
      yield this.f(line0, `Compare ${k} with chain entry ${idx + 1}: ${node.v}.`, { floating: probe, near: node.id, bucket: i, states: { ...seen, [node.id]: hit ? "found" : "current" }, edges: { [`${prev}->${node.id}`]: "tree" }, callouts: [{ at: node.id, text: hit ? `${node.v} = ${k} ✓` : `${node.v} ≠ ${k}`, tone: hit ? "good" : "info" }] });
      if (hit) return { i, idx };
      seen[node.id] = "visited";
      prev = node.id;
    }
    return { i, idx: -1 };
  }

  *insert(k: number): Generator<Frame> {
    const it = newItem(k);
    const { i, idx } = yield* this.walk(k, it, 2, "Insert");
    if (idx >= 0) {
      yield this.f(3, `${k} is already in bucket ${i}, so there is nothing to insert.`, { bucket: i, states: { [this.buckets[i][idx].id]: "found" } });
      return;
    }
    const collide = this.buckets[i].length > 0;
    this.buckets[i].push(it);
    yield this.f(4, collide ? `Collision: other keys also hash to ${i}. No problem, ${k} is added to the end of bucket ${i}'s chain.` : `Bucket ${i} was empty, so ${k} starts its chain.`, { bucket: i, states: { [it.id]: "found" }, callouts: [{ at: it.id, text: collide ? "collision → chain it" : `bucket ${i}`, tone: collide ? "warn" : "good" }] });
  }

  *search(k: number): Generator<Frame> {
    const { i, idx } = yield* this.walk(k, undefined, 2, "Search for");
    if (idx >= 0) yield this.f(3, `Found ${k} in bucket ${i} after ${idx + 1} comparison${idx ? "s" : ""}. The other ${M - 1} buckets were never looked at.`, { bucket: i, states: { [this.buckets[i][idx].id]: "found" } });
    else yield this.f(4, `End of bucket ${i}'s chain without a match: ${k} is not in the table.`, { bucket: i });
  }

  *delete(k: number): Generator<Frame> {
    const { i, idx } = yield* this.walk(k, undefined, 2, "Delete");
    if (idx < 0) {
      yield this.f(5, `${k} is not in bucket ${i}'s chain, so there's nothing to delete.`, { bucket: i });
      return;
    }
    const node = this.buckets[i][idx];
    yield this.f(3, `Found ${k} in bucket ${i}.`, { bucket: i, states: { [node.id]: "removing" } });
    yield this.f(4, "Unlink it: the previous link now skips over it.", { bucket: i, states: { [node.id]: "removing" }, drop: node.id, callouts: [{ at: node.id, text: "unlink", tone: "bad" }] });
    this.buckets[i].splice(idx, 1);
    yield this.f(4, `Deleted ${k}; bucket ${i}'s chain closes up.`, { bucket: i });
  }
}

export const hashChainTopic: TopicDef = {
  id: "hash-chaining",
  name: "Hashing: chaining",
  category: "Linear structures",
  icon: "#",
  blurb: "h(k) = k mod m picks a bucket; collisions share a linked list. O(1 + α) average.",
  create() {
    let m = new ChainModel(randomInts(8, 1, 99));
    const variant = `Hash table with separate chaining, m = ${M}, h(k) = k mod ${M}, new keys appended to the end of the chain, no duplicates.`;
    const act = (op: keyof typeof CHAIN_CODE, title: string, g: (k: number) => Generator<Frame>) => (v: Values): Run | string => {
      const k = num(v.key, "Key", 0, 999);
      return typeof k === "string" ? k : { title: `${title} ${k}`, variant, code: CHAIN_CODE[op], notes: CHAIN_NOTES[op], legend: CHAIN_LEGEND, complexity: "O(1 + α) average · O(n) worst", frames: collect(g(k)) };
    };
    return {
      fields: [{ id: "key", label: "Key", kind: "number", default: "38" }],
      actions: [
        { id: "insert", label: "Insert", run: act("insert", "Insert", (k) => m.insert(k)) },
        { id: "search", label: "Search", run: act("search", "Search", (k) => m.search(k)) },
        { id: "delete", label: "Delete", run: act("delete", "Delete", (k) => m.delete(k)) },
      ],
      presets: [
        { label: "Random table", run: () => { m = new ChainModel(randomInts(8, 1, 99)); return still("Hash table (chaining)", m.f(-1, "New table.")); } },
        { label: "Many collisions", run: () => { m = new ChainModel([7, 14, 21, 28, 3, 10]); return still("Hash table (chaining)", m.f(-1, "Multiples of 7 all land in bucket 0: a bad key set for this hash function.")); } },
        { label: "Clear", run: () => { m = new ChainModel([]); return still("Hash table (chaining)", m.f(-1, "Empty table.")); } },
      ],
      view: () => still("Hash table (chaining)", m.f(-1, `Keys are hashed with k mod ${M}. Keys that collide share a chain.`)),
    };
  },
};

// ---------------- open addressing ----------------

const OM = 11;
type Probe = "Linear" | "Quadratic" | "Double hashing";
const PROBE_TEXT: Record<Probe, string> = {
  Linear: "i = (h(k) + j) mod m",
  Quadratic: "i = (h(k) + j²) mod m",
  "Double hashing": "i = (h(k) + j·h2(k)) mod m",
};
const h2 = (k: number) => 7 - (k % 7);
const probeAt = (p: Probe, k: number, j: number) => (k % OM + (p === "Linear" ? j : p === "Quadratic" ? j * j : j * h2(k))) % OM;

const openCode = (p: Probe) => ({
  insert: [
    "insert(T, k):",
    "  for j = 0 to m - 1:",
    `    ${PROBE_TEXT[p]}`,
    "    if T[i] is EMPTY or DELETED:",
    "      T[i] = k;  return i",
    "  error: table full",
  ],
  search: [
    "search(T, k):",
    "  for j = 0 to m - 1:",
    `    ${PROBE_TEXT[p]}`,
    "    if T[i] == k: return i",
    "    if T[i] is EMPTY: return -1   // DELETED doesn't stop us",
    "  return -1",
  ],
  delete: ["delete(T, k):", "  i = search(T, k)", "  if i != -1:", "    T[i] = DELETED        // tombstone, not EMPTY"],
});

const PROBE_NOTE: Record<Probe, string> = {
  Linear: "Linear probing: try the very next slot each time. Simple, but full slots bunch together into clusters (primary clustering).",
  Quadratic: "Quadratic probing: jump 1, 4, 9, … slots away from h(k). This breaks up clusters, but it may never reach some free slots.",
  "Double hashing": "Double hashing: step by h2(k), a second hash of the key, so keys that collide still follow different probe sequences.",
};

const openNotes = (p: Probe) => ({
  insert: [
    "Store key k in the table itself; a collision is resolved by probing other slots.",
    "Try at most m slots: j counts the attempts.",
    PROBE_NOTE[p],
    "A free slot, or a tombstone left by a deletion, can take the key.",
    "Store it here. The expected number of probes grows fast as the table fills: about 1 / (1 − α).",
    "Every probe hit an occupied slot: nowhere left to put the key.",
  ],
  search: [
    "Look up key k by following exactly the probe sequence insert would have used.",
    "Try at most m slots: j counts the attempts.",
    PROBE_NOTE[p],
    "Found the key.",
    "An EMPTY slot means insert would have stopped here, so k can't be further along. Tombstones don't stop the search.",
    "Probed every slot without finding k.",
  ],
  delete: [
    "Remove key k from the table.",
    "First find its slot by searching along its probe sequence.",
    "Only a key that was found can be deleted.",
    "Leave a DELETED marker instead of EMPTY: keys inserted after k may have probed past this slot, and their searches must keep going.",
  ],
});
const OPEN_LEGEND: Run["legend"] = { current: "slot being probed", found: "key being placed / found", removing: "collision / deleted", idle: "stored key", ghost: "empty slot or tombstone" };

const DEL = "DEL";

class OpenModel {
  slots: (Item | null)[] = Array(OM).fill(null);
  probe: Probe = "Linear";

  constructor(keys: number[]) {
    for (const k of keys) collect(this.insert(k));
  }

  f(line: number, message: string, o: { states?: Record<string, NodeState>; at?: number; j?: number; floating?: Item; question?: Question; callouts?: Callout[] } = {}): Frame {
    const states: Record<string, NodeState> = { ...o.states };
    for (const s of this.slots) if (s && s.v === DEL && !states[s.id]) states[s.id] = "ghost";
    const fr = arrayFrame({ slots: this.slots, cap: OM, states, line, message, question: o.question, callouts: o.callouts, pointers: o.at !== undefined ? [{ text: `i (j=${o.j})`, index: o.at, color: "#ff4f9a" }] : [], floating: o.floating ? [{ item: o.floating, index: o.at ?? 0 }] : [] });
    const n = this.slots.filter((s) => s && s.v !== DEL).length;
    fr.aux = [
      { label: "Probing", items: [this.probe, `h(k) = k mod ${OM}`, ...(this.probe === "Double hashing" ? ["h2(k) = 7 − (k mod 7)"] : [])] },
      { label: "Load factor α = n / m", items: [(n / OM).toFixed(2)] },
    ];
    return fr;
  }

  private stepText(k: number, j: number) {
    const h = k % OM;
    if (j === 0) return `h(${k}) = ${h}`;
    if (this.probe === "Linear") return `(${h} + ${j}) mod ${OM} = ${probeAt(this.probe, k, j)}`;
    if (this.probe === "Quadratic") return `(${h} + ${j}²) mod ${OM} = ${probeAt(this.probe, k, j)}`;
    return `(${h} + ${j}·${h2(k)}) mod ${OM} = ${probeAt(this.probe, k, j)}`;
  }

  *insert(k: number): Generator<Frame> {
    const it = newItem(k);
    yield this.f(0, `Insert ${k}. The probe sequence starts at its home slot h(${k}) = ${k} mod ${OM}.`, { floating: it, question: ask(`Which slot is probed first for ${k}?`, k % OM, [...Array(OM).keys()], `The first probe (j = 0) is always the home slot h(${k}) = ${k} mod ${OM} = ${k % OM}, whatever the probing strategy.`) });
    for (let j = 0; j < OM; j++) {
      const i = probeAt(this.probe, k, j);
      const s = this.slots[i];
      const nextFree = (() => { for (let jj = j; jj < OM; jj++) { const ii = probeAt(this.probe, k, jj); if (!this.slots[ii] || this.slots[ii]!.v === DEL) return ii; } return -1; })();
      const free = !s || s.v === DEL;
      yield this.f(2, `Probe ${j + 1}: slot ${this.stepText(k, j)}.`, {
        floating: it,
        at: i,
        j,
        states: s ? { [s.id]: free ? "current" : "removing" } : {},
        question: j === 1 && nextFree >= 0 ? ask(`Slot ${probeAt(this.probe, k, 0)} was taken. Where will ${k} finally land?`, nextFree, [...Array(OM).keys()], `Follow the ${this.probe.toLowerCase()} probe sequence until a free slot (or tombstone): ${(() => { const seq: string[] = []; for (let jj = 0; jj < OM; jj++) { const ii = probeAt(this.probe, k, jj); const occ = this.slots[ii]; seq.push(`${ii}${occ && occ.v !== DEL ? " (taken)" : " (free)"}`); if (!occ || occ.v === DEL) break; } return seq.join(" → "); })()}.`) : undefined,
        callouts: [{ at: s ? s.id : `slot-${i}`, text: !s ? `slot ${i} is free ✓` : s.v === DEL ? "tombstone → reuse ✓" : `taken by ${s.v} → probe on`, tone: free ? "good" : "warn" }],
      });
      if (free) {
        this.slots[i] = it;
        yield this.f(4, `Store ${k} in slot ${i}${s ? " (reusing the tombstone)" : ""} after ${j + 1} probe${j ? "s" : ""}.`, { at: i, j, states: { [it.id]: "found" } });
        return;
      }
    }
    yield this.f(5, `All ${OM} probes hit occupied slots. ${this.probe === "Quadratic" ? "Quadratic probing may never visit some free slots." : "The table is full."}`);
  }

  *search(k: number, line0 = 0): Generator<Frame, number> {
    const it = newItem(k);
    yield this.f(line0, `Search for ${k}: follow the same probe sequence, starting at h(${k}) = ${k % OM}.`, { floating: it, at: k % OM, j: 0 });
    for (let j = 0; j < OM; j++) {
      const i = probeAt(this.probe, k, j);
      const s = this.slots[i];
      const hit = !!s && s.v === k;
      yield this.f(!s ? 4 : hit ? 3 : 2, `Probe ${j + 1}: slot ${this.stepText(k, j)}${s ? ` holds ${s.v === DEL ? "a tombstone" : s.v}` : " is EMPTY"}.`, {
        floating: it,
        at: i,
        j,
        states: s ? { [s.id]: hit ? "found" : "current" } : {},
        callouts: [{ at: s ? s.id : `slot-${i}`, text: hit ? `found ${k} ✓` : !s ? "EMPTY → stop" : s.v === DEL ? "tombstone → keep going" : `${s.v} ≠ ${k} → keep going`, tone: hit ? "good" : !s ? "bad" : "info" }],
      });
      if (hit) {
        yield this.f(3, `Found ${k} in slot ${i} after ${j + 1} probe${j ? "s" : ""}.`, { at: i, j, states: { [s!.id]: "found" } });
        return i;
      }
      if (!s) {
        yield this.f(4, `An empty slot ends the search: if ${k} were stored, insert would have put it here or earlier. Not found.`, { at: i, j });
        return -1;
      }
    }
    yield this.f(5, "Probed every slot without finding it.");
    return -1;
  }

  *delete(k: number): Generator<Frame> {
    yield this.f(0, `Delete ${k}: find it first, then leave a tombstone.`);
    const i = yield* this.search(k, 1);
    if (i < 0) {
      yield this.f(2, `${k} isn't in the table, so there's nothing to delete.`);
      return;
    }
    const tomb = newItem(DEL);
    this.slots[i] = tomb;
    yield this.f(3, `Mark slot ${i} DELETED rather than EMPTY. A key inserted later may have probed past this slot, and its search must not stop here.`, { at: i, j: 0, states: { [tomb.id]: "removing" }, callouts: [{ at: tomb.id, text: "tombstone", tone: "bad" }] });
  }
}

export const hashOpenTopic: TopicDef = {
  id: "hash-open",
  name: "Hashing: open addressing",
  category: "Linear structures",
  icon: "⌗",
  blurb: "All keys live in the table. Collisions probe for another slot: linear, quadratic or double hashing.",
  create() {
    let m = new OpenModel(randomInts(5, 1, 99));
    const variant = () => `Open addressing, m = ${OM}, h(k) = k mod ${OM}, ${m.probe} probing (${PROBE_TEXT[m.probe]}${m.probe === "Double hashing" ? ", h2(k) = 7 - (k mod 7)" : ""}). Deletion leaves a DELETED tombstone. Insert does not check for duplicates (CLRS HASH-INSERT).`;
    const setProbe = (v: Values) => {
      m.probe = (v.probe as Probe) ?? "Linear";
    };
    const act = (title: string, code: (p: Probe) => string[], g: (k: number) => Generator<Frame, unknown>) => (v: Values) => {
      setProbe(v);
      const k = num(v.key, "Key", 0, 999);
      if (typeof k === "string") return k;
      if (title === "Insert" && m.slots.every((s) => s && s.v !== DEL)) return "The table is full.";
      const key = title.toLowerCase() as "insert" | "search" | "delete";
      return { title: `${title} ${k} (${m.probe.toLowerCase()})`, variant: variant(), code: code(m.probe), notes: openNotes(m.probe)[key], legend: OPEN_LEGEND, complexity: "≈ 1 / (1 − α) probes · O(n) worst", frames: collect(g(k)) };
    };
    return {
      fields: [
        { id: "key", label: "Key", kind: "number", default: "24" },
        { id: "probe", label: "Probing", kind: "select", default: "Linear", options: () => ["Linear", "Quadratic", "Double hashing"] },
      ],
      actions: [
        { id: "insert", label: "Insert", run: act("Insert", (p) => openCode(p).insert, (k) => m.insert(k)) },
        { id: "search", label: "Search", run: act("Search", (p) => openCode(p).search, (k) => m.search(k)) },
        { id: "delete", label: "Delete", run: act("Delete", (p) => openCode(p).delete, (k) => m.delete(k)) },
      ],
      presets: [
        { label: "Random table", run: (v) => { m = new OpenModel([]); setProbe(v); for (const k of randomInts(5, 1, 99)) collect(m.insert(k)); return still("Open addressing", m.f(-1, "New table.")); } },
        { label: "Clustering demo", run: (v) => { m = new OpenModel([]); setProbe(v); for (const k of [22, 33, 44, 13]) collect(m.insert(k)); return still("Open addressing", m.f(-1, "22, 33 and 44 all hash to 0 and 13 hashes to 2. Insert 55 and compare linear vs quadratic probing.")); }, fill: { key: "55" } },
        { label: "Clear", run: () => { m = new OpenModel([]); return still("Open addressing", m.f(-1, "Empty table.")); } },
      ],
      view: () => still("Open addressing", m.f(-1, `m = ${OM} slots. Pick a probing strategy, then insert keys that collide.`)),
    };
  },
};
