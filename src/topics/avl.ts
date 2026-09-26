import type { Callout, EdgeState, Frame, NodeState, Question, Run } from "../algorithms/types";
import { ask, collect, randomInts } from "../algorithms/util";
import { num, numList, still } from "./helpers";
import { binaryFrame, height, type BNode } from "./treeView";
import type { TopicDef } from "./types";

const CODE = {
  insert: [
    "insert(node, key):",
    "  if node is null: return new Node(key)",
    "  if key < node.key: node.left = insert(node.left, key)",
    "  elif key > node.key: node.right = insert(node.right, key)",
    "  else: return node               // no duplicates",
    "  node.height = 1 + max(h(node.left), h(node.right))",
    "  bf = h(node.left) - h(node.right)",
    "  if bf > 1 and key < node.left.key:        // LL",
    "    return rotateRight(node)",
    "  if bf < -1 and key > node.right.key:      // RR",
    "    return rotateLeft(node)",
    "  if bf > 1 and key > node.left.key:        // LR",
    "    node.left = rotateLeft(node.left); return rotateRight(node)",
    "  if bf < -1 and key < node.right.key:      // RL",
    "    node.right = rotateRight(node.right); return rotateLeft(node)",
    "  return node",
  ],
  delete: [
    "delete(node, key):",
    "  if node is null: return null",
    "  if key < node.key: node.left = delete(node.left, key)",
    "  elif key > node.key: node.right = delete(node.right, key)",
    "  else:",
    "    if node has at most one child: return that child",
    "    succ = min(node.right);  node.key = succ.key",
    "    node.right = delete(node.right, succ.key)",
    "  node.height = 1 + max(h(node.left), h(node.right))",
    "  bf = h(node.left) - h(node.right)",
    "  if bf > 1:",
    "    if bf(node.left) < 0: node.left = rotateLeft(node.left)    // LR",
    "    return rotateRight(node)                                  // LL",
    "  if bf < -1:",
    "    if bf(node.right) > 0: node.right = rotateRight(node.right) // RL",
    "    return rotateLeft(node)                                   // RR",
    "  return node",
  ],
};

const NOTES: Record<keyof typeof CODE, string[]> = {
  insert: [
    "Insert as in an ordinary BST, then repair any imbalance on the way back up.",
    "An empty spot: the new key becomes a leaf here.",
    "Smaller key: insert into the left subtree.",
    "Larger key: insert into the right subtree.",
    "Equal key: it's already present, so nothing to do.",
    "Only nodes on the insertion path can change height, so heights are updated on the way back up.",
    "Balance factor = height(left) − height(right). An AVL tree only allows −1, 0 or +1.",
    "bf > 1 and the key went into the left child's left subtree: the Left-Left case.",
    "LL is fixed by one right rotation: the left child becomes the root of this subtree.",
    "bf < −1 and the key went into the right child's right subtree: the Right-Right case.",
    "RR is fixed by one left rotation: the right child becomes the root of this subtree.",
    "bf > 1 but the key went into the left child's right subtree: the Left-Right (zig-zag) case.",
    "LR needs two rotations: rotate the left child left, which turns it into LL, then rotate this node right.",
    "bf < −1 but the key went into the right child's left subtree: the Right-Left case.",
    "RL: rotate the right child right, which turns it into RR, then rotate this node left.",
    "This node is balanced; return the subtree unchanged.",
  ],
  delete: [
    "Delete as in a BST, then rebalance every node on the way back up.",
    "Fell off the tree: the key isn't present.",
    "Smaller key: delete from the left subtree.",
    "Larger key: delete from the right subtree.",
    "Found the node to delete.",
    "With at most one child, that child (or nothing) simply takes its place.",
    "With two children, copy in the in-order successor, the smallest key on the right.",
    "Then delete the successor's old node from the right subtree.",
    "Heights can only change along the path back up to the root.",
    "Balance factor = height(left) − height(right); AVL needs −1, 0 or +1.",
    "The left side is too tall.",
    "If the left child leans right, first rotate it left, turning LR into LL.",
    "Then one right rotation lifts the left child up.",
    "The right side is too tall.",
    "If the right child leans left, first rotate it right, turning RL into RR.",
    "Then one left rotation lifts the right child up.",
    "Unlike insertion, a deletion may need rotations at several levels, so keep checking all the way to the root.",
  ],
};

const LEGEND: Run["legend"] = { current: "on the search path", removing: "unbalanced (|bf| = 2) / deleted", found: "new node / new subtree root", pending: "key being placed / moved by a rotation", visited: "checked: balanced", idle: "untouched" };

let uid = 0;
type Link = (n: BNode | null) => void;

const bf = (t: BNode | null) => (t ? height(t.left) - height(t.right) : 0);

class AVL {
  root: BNode | null = null;

  constructor(keys: number[]) {
    for (const k of keys) collect(this.insert(k));
  }

  f(line: number, message: string, o: { states?: Record<string, NodeState>; edges?: Record<string, EdgeState>; probe?: { id: string; label: string; near?: string }; question?: Question; callouts?: Callout[] } = {}): Frame {
    const subs: Record<string, string> = {};
    const states: Record<string, NodeState> = {};
    const walk = (t: BNode | null) => {
      if (!t) return;
      const b = bf(t);
      subs[t.id] = `bf=${b > 0 ? "+" : ""}${b}`;
      if (Math.abs(b) > 1) states[t.id] = "removing";
      walk(t.left);
      walk(t.right);
    };
    walk(this.root);
    return binaryFrame(this.root, { line, message, subs, states: { ...states, ...o.states }, edges: o.edges, probe: o.probe, question: o.question, callouts: o.callouts, aux: [{ label: "Height", items: [String(height(this.root))] }, { label: "In-order", items: this.keys().map(String) }] });
  }

  keys(): number[] {
    const out: number[] = [];
    const w = (t: BNode | null) => {
      if (t) {
        w(t.left);
        out.push(t.key);
        w(t.right);
      }
    };
    w(this.root);
    return out;
  }

  private rotateRight(y: BNode): BNode {
    const x = y.left!;
    y.left = x.right;
    x.right = y;
    return x;
  }

  private rotateLeft(x: BNode): BNode {
    const y = x.right!;
    x.right = y.left;
    y.left = x;
    return y;
  }

  *insert(key: number): Generator<Frame> {
    const probeId = `avl${uid}`;
    yield this.f(0, `Insert ${key}: first exactly like a BST, then walk back up checking every balance factor.`, { probe: { id: probeId, label: String(key) } });
    yield* this.insertRec(this.root, key, (n) => (this.root = n), probeId);
    yield this.f(15, `Done. Every node has a balance factor of −1, 0 or +1, so the height stays about log₂ n (${height(this.root)} levels for ${this.keys().length} keys).`);
  }

  private *insertRec(node: BNode | null, key: number, link: Link, probeId: string): Generator<Frame, BNode> {
    if (!node) {
      const n: BNode = { id: probeId, key, left: null, right: null };
      uid++;
      link(n);
      yield this.f(1, `Reached an empty spot: ${key} becomes a new leaf here.`, { states: { [n.id]: "found" }, callouts: [{ at: n.id, text: `new leaf ${key}`, tone: "good" }] });
      return n;
    }
    const probe = { id: probeId, label: String(key), near: node.id };
    if (key === node.key) {
      yield this.f(4, `${key} is already in the tree, so nothing changes.`, { states: { [node.id]: "found" } });
      return node;
    }
    const left = key < node.key;
    yield this.f(left ? 2 : 3, `${key} ${left ? "<" : ">"} ${node.key}: go ${left ? "left" : "right"}.`, { states: { [node.id]: "current" }, probe, callouts: [{ at: node.id, text: `${key} ${left ? "<" : ">"} ${node.key} → ${left ? "left" : "right"}`, tone: "info" }] });
    if (left) yield* this.insertRec(node.left, key, (n) => (node.left = n), probeId);
    else yield* this.insertRec(node.right, key, (n) => (node.right = n), probeId);
    return yield* this.rebalance(node, link, (b) => {
      if (b > 1) return key < node.left!.key ? "LL" : "LR";
      return key > node.right!.key ? "RR" : "RL";
    }, { update: 5, bf: 6, LL: 8, RR: 10, LR: 12, RL: 14, LR2: 12, RL2: 14 });
  }

  /** Shared by insert and delete: update height, check balance, rotate if needed. */
  private *rebalance(node: BNode, link: Link, whichCase: (b: number) => "LL" | "LR" | "RR" | "RL", L: { update: number; bf: number; LL: number; RR: number; LR: number; RL: number; LR2: number; RL2: number }): Generator<Frame, BNode> {
    const hl = height(node.left);
    const hr = height(node.right);
    yield this.f(L.update, `Back up at ${node.key}: its subtrees have heights ${hl} (left) and ${hr} (right), so its height is ${height(node)}.`, { states: { [node.id]: "current" } });
    const b = bf(node);
    const sign = (x: number) => `${x > 0 ? "+" : ""}${x}`;
    if (Math.abs(b) <= 1) {
      yield this.f(L.bf, `bf(${node.key}) = ${hl} − ${hr} = ${sign(b)}. That's allowed, so no rotation here.`, { states: { [node.id]: "visited" }, callouts: [{ at: node.id, text: `bf = ${sign(b)} ✓`, tone: "good" }] });
      return node;
    }
    const c = whichCase(b);
    yield this.f(L.bf, `bf(${node.key}) = ${hl} − ${hr} = ${sign(b)}. The ${b > 0 ? "left" : "right"} side is two levels taller: unbalanced!`, { states: { [node.id]: "removing" }, question: ask(`Node ${node.key} is unbalanced (bf = ${b}). Which case is this?`, c, ["LL", "RR", "LR", "RL"], `bf = ${sign(b)} means the ${b > 0 ? "left" : "right"} side is too tall, so the first letter is ${b > 0 ? "L" : "R"}. The heavy child ${b > 0 ? node.left!.key : node.right!.key} leans ${c[1] === "L" ? "left" : "right"}, so the second letter is ${c[1]}: ${c}. ${c[0] === c[1] ? "A straight line needs one rotation." : "A zig-zag needs two rotations."}`), callouts: [{ at: node.id, text: `bf = ${sign(b)} → ${c} case`, tone: "bad" }] });
    const desc = { LL: "Left-Left case: one right rotation fixes it", RR: "Right-Right case: one left rotation fixes it", LR: "Left-Right (zig-zag) case: two rotations", RL: "Right-Left (zig-zag) case: two rotations" }[c];
    if (c === "LR") {
      const child = node.left!;
      node.left = this.rotateLeft(child);
      yield this.f(L.LR, `${desc}. Step 1: rotate ${child.key} left, so ${node.left.key} moves up and the zig-zag becomes a straight Left-Left line.`, { states: { [node.id]: "removing", [node.left.id]: "pending", [child.id]: "pending" }, callouts: [{ at: node.left.id, text: `rotate ${child.key} left`, tone: "warn" }] });
    }
    if (c === "RL") {
      const child = node.right!;
      node.right = this.rotateRight(child);
      yield this.f(L.RL, `${desc}. Step 1: rotate ${child.key} right, so ${node.right.key} moves up and the zig-zag becomes a straight Right-Right line.`, { states: { [node.id]: "removing", [node.right.id]: "pending", [child.id]: "pending" }, callouts: [{ at: node.right.id, text: `rotate ${child.key} right`, tone: "warn" }] });
    }
    const newRoot = c === "LL" || c === "LR" ? this.rotateRight(node) : this.rotateLeft(node);
    link(newRoot);
    const dir = c === "LL" || c === "LR" ? "right" : "left";
    yield this.f(c === "LR" ? L.LR2 : c === "RL" ? L.RL2 : L[c], `${c === "LR" || c === "RL" ? "Step 2: rotate" : `${desc}: rotate`} ${node.key} ${dir}. ${newRoot.key} moves up to take its place and ${node.key} becomes its ${dir} child. In-order order is unchanged, and the subtree is balanced again.`, { states: { [newRoot.id]: "found", [node.id]: "pending" }, callouts: [{ at: newRoot.id, text: `rotate ${dir} → ${newRoot.key} on top`, tone: "good" }] });
    return newRoot;
  }

  *delete(key: number): Generator<Frame> {
    yield this.f(0, `Delete ${key}: remove it exactly as in a BST, then rebalance on the way back up.`);
    yield* this.deleteRec(this.root, key, (n) => (this.root = n));
    yield this.f(16, `Done. Every balance factor is −1, 0 or +1 again (height ${height(this.root)}).`);
  }

  private *deleteRec(node: BNode | null, key: number, link: Link): Generator<Frame, BNode | null> {
    if (!node) {
      yield this.f(1, `Fell off the tree: ${key} is not in it.`);
      return null;
    }
    if (key !== node.key) {
      const left = key < node.key;
      yield this.f(left ? 2 : 3, `${key} ${left ? "<" : ">"} ${node.key}: go ${left ? "left" : "right"}.`, { states: { [node.id]: "current" }, callouts: [{ at: node.id, text: `${key} ${left ? "<" : ">"} ${node.key} → ${left ? "left" : "right"}`, tone: "info" }] });
      if (left) yield* this.deleteRec(node.left, key, (n) => (node.left = n));
      else yield* this.deleteRec(node.right, key, (n) => (node.right = n));
    } else if (!node.left || !node.right) {
      const child = node.left ?? node.right;
      yield this.f(5, `Found ${key}. It has ${child ? "one child" : "no children"}, so ${child ? `${child.key} takes its place` : "it can simply be removed"}.`, { states: { [node.id]: "removing" }, callouts: [{ at: node.id, text: child ? `replace with ${child.key}` : "remove leaf", tone: "bad" }] });
      link(child);
      if (child) yield this.f(5, `${child.key} moved up.`, { states: { [child.id]: "found" } });
      return child;
    } else {
      let s = node.right;
      while (s.left) s = s.left;
      yield this.f(6, `Found ${key}, and it has two children. Its in-order successor (smallest key on the right) is ${s.key}.`, { states: { [node.id]: "removing", [s.id]: "pending" }, callouts: [{ at: s.id, text: `successor = ${s.key}`, tone: "info" }] });
      const sk = s.key;
      node.key = sk;
      yield this.f(6, `Copy ${sk} into this node.`, { states: { [node.id]: "found", [s.id]: "removing" }, callouts: [{ at: node.id, text: `${key} → ${sk}`, tone: "good" }] });
      yield this.f(7, `Now delete the old ${sk} from the right subtree.`, { states: { [node.id]: "found" } });
      yield* this.deleteRec(node.right, sk, (n) => (node.right = n));
    }
    return yield* this.rebalance(node, link, (b) => {
      if (b > 1) return bf(node.left) < 0 ? "LR" : "LL";
      return bf(node.right) > 0 ? "RL" : "RR";
    }, { update: 8, bf: 9, LL: 12, LR: 11, RR: 15, RL: 14, LR2: 12, RL2: 15 });
  }
}

export const avlTopic: TopicDef = {
  id: "avl",
  name: "AVL tree",
  category: "Trees",
  icon: "⚖️",
  blurb: "A self-balancing BST: rotations keep every balance factor in {-1, 0, +1}.",
  create() {
    let t = new AVL([30, 20, 40, 10]);
    const variant = "AVL tree with balance factor = height(left) - height(right); heights count nodes (a leaf has height 1). Insert uses the key to pick LL/LR/RR/RL; delete uses the child's balance factor.";
    const run = (op: keyof typeof CODE, title: string, frames: Frame[]): Run => ({ title, variant, code: CODE[op], notes: NOTES[op], legend: LEGEND, complexity: op === "insert" ? "O(log n) guaranteed · ≤ 1 (double) rotation" : "O(log n) · may rotate at several levels", frames });
    return {
      fields: [
        { id: "key", label: "Key", kind: "number", default: "5" },
        { id: "list", label: "Insert sequence", kind: "text", default: "10, 20, 30, 40, 50, 25", wide: true },
      ],
      actions: [
        { id: "insert", label: "Insert", run: (v) => { const k = num(v.key, "Key", 0, 999); return typeof k === "string" ? k : run("insert", `AVL insert ${k}`, collect(t.insert(k))); } },
        { id: "delete", label: "Delete", run: (v) => { const k = num(v.key, "Key", 0, 999); return typeof k === "string" ? k : run("delete", `AVL delete ${k}`, collect(t.delete(k))); } },
        { id: "sequence", label: "Insert sequence", run: (v) => {
          const l = numList(v.list, "Sequence", 1, 15, 0, 999);
          if (typeof l === "string") return l;
          t = new AVL([]);
          const frames = l.flatMap((k) => collect(t.insert(k)));
          return run("insert", `AVL insert ${l.join(", ")}`, frames);
        } },
      ],
      presets: [
        { label: "Small tree", run: () => { t = new AVL([30, 20, 40, 10]); return still("AVL tree", t.f(-1, "Insert 5 for an LL rotation, or 15 for LR.")); } },
        { label: "Random", run: () => { t = new AVL(randomInts(8)); return still("AVL tree", t.f(-1, "A random AVL tree.")); } },
        { label: "Clear", run: () => { t = new AVL([]); return still("AVL tree", t.f(-1, "Empty tree.")); } },
      ],
      view: () => still("AVL tree", t.f(-1, "Each node shows its balance factor. Insert 5 to trigger a rotation, or run the sequence 10…50 that would make a plain BST a line.")),
    };
  },
};
