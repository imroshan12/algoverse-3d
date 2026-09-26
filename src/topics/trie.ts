import type { Callout, EdgeState, Frame, NodeState, Question, Run, VEdge, VNode, Vec3 } from "../algorithms/types";
import { ask, collect } from "../algorithms/util";
import { still } from "./helpers";
import type { TopicDef, Values } from "./types";

const CODE = {
  insert: [
    "insert(root, word):",
    "  node = root",
    "  for ch in word:",
    "    if ch not in node.children:",
    "      node.children[ch] = new TrieNode()",
    "    node = node.children[ch]",
    "  node.isEnd = true",
  ],
  search: [
    "search(root, word):      // or startsWith(prefix)",
    "  node = root",
    "  for ch in word:",
    "    if ch not in node.children: return false",
    "    node = node.children[ch]",
    "  return node.isEnd       // startsWith returns true here",
  ],
};

const NOTES: Record<keyof typeof CODE, string[]> = {
  insert: [
    "Add a word one character at a time, reusing any prefix that is already stored.",
    "Every word starts at the root, which holds no character.",
    "Each character moves us one level down.",
    "Is there already an edge for this character? If an earlier word shares this prefix, there is.",
    "No: branch off with a new node. Only the part of the word that isn't shared costs new nodes.",
    "Step down to the child for this character.",
    "Mark where the word ends, so a word like \"car\" is still found when \"cart\" is stored too. O(length), whatever the number of words.",
  ],
  search: [
    "Follow the word's characters from the root. startsWith is identical except for the final check.",
    "Start at the root.",
    "Each character moves us one level down.",
    "Missing edge: no stored word continues this way, so neither the word nor the prefix exists.",
    "Step down to the child for this character.",
    "All characters matched. A whole word must also be marked as a word end; a prefix doesn't need to be.",
  ],
};

const LEGEND: Run["legend"] = { current: "current node", visited: "path so far", found: "new node / word end", removing: "missing / not a word", idle: "stored node" };

interface TNode {
  id: string;
  ch: string;
  end: boolean;
  kids: Map<string, TNode>;
}

let uid = 0;
const mk = (ch: string): TNode => ({ id: `tr${uid++}`, ch, end: false, kids: new Map() });

class Trie {
  root = mk("•");
  constructor(words: string[]) {
    for (const w of words) collect(this.insert(w));
  }

  words(): string[] {
    const out: string[] = [];
    const walk = (n: TNode, pre: string) => {
      if (n.end) out.push(pre);
      for (const [c, k] of [...n.kids].sort()) walk(k, pre + c);
    };
    walk(this.root, "");
    return out;
  }

  f(line: number, message: string, o: { states?: Record<string, NodeState>; edges?: Record<string, EdgeState>; word?: string; at?: number; question?: Question; callouts?: Callout[] } = {}): Frame {
    const pos = new Map<string, Vec3>();
    let leafX = 0;
    const place = (n: TNode, d: number): number => {
      const kids = [...n.kids.values()].sort((a, b) => a.ch.localeCompare(b.ch));
      let x: number;
      if (!kids.length) x = leafX++;
      else {
        const xs = kids.map((k) => place(k, d + 1));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      pos.set(n.id, [x, 3.8 - d * 1.35, 0]);
      return x;
    };
    place(this.root, 0);
    const shift = (leafX - 1) / 2;
    const nodes: VNode[] = [];
    const edges: VEdge[] = [];
    const walk = (n: TNode) => {
      const p = pos.get(n.id)!;
      nodes.push({ id: n.id, label: n.ch, sub: n.end ? "end" : undefined, pos: [(p[0] - shift) * 1.15, p[1], 0], state: o.states?.[n.id] ?? "idle" });
      for (const k of n.kids.values()) {
        const eid = `${n.id}-${k.id}`;
        edges.push({ id: eid, from: n.id, to: k.id, state: o.edges?.[eid] ?? "idle" });
        walk(k);
      }
    };
    walk(this.root);
    // The word being processed, spelled out above the tree: done letters green, the current one pink.
    const markers = o.word ? [...o.word].map((c, i) => ({ id: `w${i}`, text: c, size: i === o.at ? 0.46 : 0.34, arrow: i === o.at ? ("down" as const) : undefined, pos: [(i - (o.word!.length - 1) / 2) * 0.6, 5.35, 0] as Vec3, color: i === o.at ? "#ff4f9a" : i < (o.at ?? -1) ? "#22a06b" : "#8b95ad" })) : [];
    return { nodes, edges, markers, callouts: o.callouts, line, message, question: o.question, aux: [{ label: "Stored words", items: this.words() }] };
  }

  *insert(word: string): Generator<Frame> {
    let node = this.root;
    const path: Record<string, NodeState> = { [node.id]: "current" };
    const edges: Record<string, EdgeState> = {};
    let created = 0;
    yield this.f(1, `Insert "${word}". Start at the root and follow (or create) one node per character.`, { states: path, word });
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const exists = node.kids.has(ch);
      yield this.f(3, `Character '${ch}': does the current node already have a '${ch}' child?`, { states: path, edges, word, at: i, question: i > 0 ? ask(`Does a '${ch}' child already exist here?`, exists ? "Yes (reuse it)" : "No (create it)", ["Yes (reuse it)", "No (create it)"], exists ? `A stored word already starts with "${word.slice(0, i + 1)}", so the '${ch}' node exists and is shared.` : `No stored word starts with "${word.slice(0, i + 1)}", so a new '${ch}' node has to branch off here.`) : undefined });
      if (!exists) {
        node.kids.set(ch, mk(ch));
        created++;
        const k = node.kids.get(ch)!;
        yield this.f(4, `No, so create a new '${ch}' node. From here on the word branches away from everything stored.`, { states: { ...path, [k.id]: "found" }, edges, word, at: i, callouts: [{ at: k.id, text: `new '${ch}'`, tone: "good" }] });
      }
      const next = node.kids.get(ch)!;
      path[node.id] = "visited";
      path[next.id] = "current";
      edges[`${node.id}-${next.id}`] = "tree";
      node = next;
      yield this.f(5, exists ? `Yes: '${ch}' is shared with a word already stored. Reuse it and move down.` : `Move down to the new '${ch}'.`, { states: path, edges, word, at: i, callouts: exists ? [{ at: next.id, text: `reuse '${ch}'`, tone: "info" }] : undefined });
    }
    node.end = true;
    yield this.f(6, `Mark this node as a word end. "${word}" cost ${created} new node${created === 1 ? "" : "s"}; the other ${word.length - created} were shared. Always O(length), no matter how many words are stored.`, { states: { ...path, [node.id]: "found" }, edges, word, at: word.length, callouts: [{ at: node.id, text: `"${word}" ends here`, tone: "good" }] });
  }

  *search(word: string, prefix: boolean): Generator<Frame> {
    let node = this.root;
    const path: Record<string, NodeState> = { [node.id]: "current" };
    const edges: Record<string, EdgeState> = {};
    yield this.f(1, `${prefix ? `Does any stored word start with "${word}"` : `Is "${word}" a stored word`}? Follow its characters from the root.`, { states: path, word });
    for (let i = 0; i < word.length; i++) {
      const ch = word[i];
      const next = node.kids.get(ch);
      if (!next) {
        yield this.f(3, `There is no '${ch}' child here, so no stored word continues this way: "${word}" is ${prefix ? "not a prefix of any stored word" : "not stored"}.`, { states: { ...path, [node.id]: "removing" }, edges, word, at: i, callouts: [{ at: node.id, text: `no '${ch}' child ✗`, tone: "bad" }] });
        return;
      }
      path[node.id] = "visited";
      path[next.id] = "current";
      edges[`${node.id}-${next.id}`] = "tree";
      node = next;
      yield this.f(4, `Follow the '${ch}' edge.`, { states: path, edges, word, at: i });
    }
    const q = !prefix ? ask(`We matched every letter of "${word}". Is it a stored word?`, node.end ? "Yes" : "No", ["Yes", "No"], node.end ? `The last node is marked as a word end, so "${word}" was inserted as a whole word.` : `The path exists only because a longer word starts with "${word}". Its last node isn't marked as a word end, so "${word}" itself isn't stored.`) : undefined;
    yield this.f(5, `Every character matched. ${prefix ? "For startsWith that's enough." : "For a whole word, the last node must also be marked as a word end."}`, { states: path, edges, word, at: word.length, question: q });
    if (prefix) yield this.f(5, `Yes: stored words start with "${word}".`, { states: { ...path, [node.id]: "found" }, edges, word, callouts: [{ at: node.id, text: "prefix exists ✓", tone: "good" }] });
    else yield this.f(5, node.end ? `The node is marked as a word end, so "${word}" is stored.` : `The node is not a word end: "${word}" is only a prefix of longer words, not a stored word itself.`, { states: { ...path, [node.id]: node.end ? "found" : "removing" }, edges, word, callouts: [{ at: node.id, text: node.end ? "word end ✓" : "not a word end ✗", tone: node.end ? "good" : "bad" }] });
  }
}

const SAMPLE = ["car", "cart", "cat", "dog", "do"];

export const trieTopic: TopicDef = {
  id: "trie",
  name: "Trie",
  category: "Trees",
  icon: "🔤",
  blurb: "A prefix tree: words share nodes for common prefixes. Lookups cost O(word length).",
  create() {
    let t = new Trie(SAMPLE);
    const word = (v: Values) => {
      const w = (v.word ?? "").trim().toLowerCase();
      return /^[a-z]{1,8}$/.test(w) ? w : "Use 1–8 lowercase letters.";
    };
    const variant = "Trie over lowercase letters, children stored in a map, with an isEnd flag per node.";
    const run = (op: keyof typeof CODE, title: string, frames: Frame[]): Run => ({ title, variant, code: CODE[op], notes: NOTES[op], legend: LEGEND, complexity: "O(L) for a word of length L", frames });
    return {
      fields: [{ id: "word", label: "Word", kind: "text", default: "care" }],
      actions: [
        { id: "insert", label: "Insert", run: (v) => { const w = word(v); if (w.includes(" ")) return w; if (t.words().length >= 14) return "The demo trie is full. Clear it first."; return run("insert", `Trie insert "${w}"`, collect(t.insert(w))); } },
        { id: "search", label: "Search", run: (v) => { const w = word(v); return w.includes(" ") ? w : run("search", `Trie search "${w}"`, collect(t.search(w, false))); } },
        { id: "prefix", label: "Starts with", run: (v) => { const w = word(v); return w.includes(" ") ? w : run("search", `Trie startsWith "${w}"`, collect(t.search(w, true))); } },
      ],
      presets: [
        { label: "Sample words", run: () => { t = new Trie(SAMPLE); return still("Trie", t.f(-1, `Stored: ${SAMPLE.join(", ")}.`)); } },
        { label: "Clear", run: () => { t = new Trie([]); return still("Trie", t.f(-1, "Empty trie: just the root.")); } },
      ],
      view: () => still("Trie", t.f(-1, "Nodes marked \"end\" finish a word. Try inserting 'care', then compare Search 'ca' with Starts with 'ca'.")),
    };
  },
};
