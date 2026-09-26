import type { AuxList, Callout, EdgeState, Frame, NodeState, Question, Run, VEdge, VNode, Vec3 } from "./types";
import { collect, makeOptions } from "./util";

interface TNode {
  id: string;
  key: number;
  left: TNode | null;
  right: TNode | null;
}

export const BST_CODE = {
  insert: [
    "insert(root, key):",
    "  if root is null:",
    "    return new Node(key)",
    "  if key < root.key:",
    "    root.left = insert(root.left, key)",
    "  else if key > root.key:",
    "    root.right = insert(root.right, key)",
    "  return root   // duplicates ignored",
  ],
  search: [
    "search(root, key):",
    "  while root is not null:",
    "    if key == root.key: return root",
    "    if key < root.key: root = root.left",
    "    else: root = root.right",
    "  return null",
  ],
  delete: [
    "delete(root, key):",
    "  if root is null: return null",
    "  if key < root.key:",
    "    root.left = delete(root.left, key)",
    "  elif key > root.key:",
    "    root.right = delete(root.right, key)",
    "  else:",
    "    if root.left is null: return root.right",
    "    if root.right is null: return root.left",
    "    succ = minNode(root.right)  // successor",
    "    root.key = succ.key",
    "    root.right = delete(root.right, succ.key)",
    "  return root",
  ],
};

const BST_NOTES: Record<keyof typeof BST_CODE, string[]> = {
  insert: [
    "Insert the key while keeping the BST rule: smaller keys go left, larger keys go right.",
    "An empty spot (null) is exactly where the new key belongs.",
    "Create the node there. New keys always become leaves.",
    "Smaller keys must live in the left subtree.",
    "Recurse left; whatever comes back is re-attached as the left child.",
    "Larger keys must live in the right subtree.",
    "Recurse right; whatever comes back is re-attached as the right child.",
    "Equal key: it is already present, so nothing changes.",
  ],
  search: [
    "Walk down from the root. Each comparison rules out a whole subtree.",
    "Falling off the tree (null) means the key isn't there.",
    "Found it.",
    "The key is smaller, so it can only be in the left subtree.",
    "The key is larger, so it can only be in the right subtree.",
    "Reached null: the key isn't in the tree. That took one comparison per level, O(h).",
  ],
  delete: [
    "Delete the key and keep the BST rule intact.",
    "Fell off the tree: the key isn't present.",
    "Smaller key: it can only be in the left subtree.",
    "Delete from the left subtree and re-attach whatever comes back.",
    "Larger key: it can only be in the right subtree.",
    "Delete from the right subtree and re-attach whatever comes back.",
    "Found the node. How to remove it depends on how many children it has.",
    "No left child: the right subtree (maybe empty) simply takes the node's place.",
    "No right child: the left subtree takes the node's place.",
    "Two children: the in-order successor (the smallest key in the right subtree) is the next larger key, so it can replace this one without breaking the BST rule.",
    "Copy the successor's key into this node.",
    "The successor has no left child, so deleting it from the right subtree is one of the easy cases.",
    "Return this subtree's (possibly new) root to the caller.",
  ],
};

const X_GAP = 1.25;
const Y_GAP = 1.6;
const TOP = 3.2;

interface Highlights {
  nodes?: Record<string, NodeState>;
  edges?: Record<string, EdgeState>;
  /** A floating "probe" sphere carrying the key being inserted/searched. */
  probe?: { id: string; label: string; near?: string; state?: NodeState };
  callouts?: Callout[];
}

export class BST {
  root: TNode | null = null;
  private nextId = 0;

  constructor(keys: number[] = []) {
    for (const k of keys) collect(this.insert(k));
  }

  get size() {
    let n = 0;
    const walk = (t: TNode | null) => {
      if (t) {
        n++;
        walk(t.left);
        walk(t.right);
      }
    };
    walk(this.root);
    return n;
  }

  keys(): number[] {
    const out: number[] = [];
    const walk = (t: TNode | null) => {
      if (!t) return;
      walk(t.left);
      out.push(t.key);
      walk(t.right);
    };
    walk(this.root);
    return out;
  }

  // ---------- layout & snapshots ----------

  private layout(): Map<string, Vec3> {
    const order: { id: string; depth: number }[] = [];
    const walk = (t: TNode | null, d: number) => {
      if (!t) return;
      walk(t.left, d + 1);
      order.push({ id: t.id, depth: d });
      walk(t.right, d + 1);
    };
    walk(this.root, 0);
    const mid = (order.length - 1) / 2;
    const pos = new Map<string, Vec3>();
    order.forEach((o, i) => pos.set(o.id, [(i - mid) * X_GAP, TOP - o.depth * Y_GAP, 0]));
    return pos;
  }

  private snap(line: number, message: string, h: Highlights = {}, aux: AuxList[] = [], question?: Question): Frame {
    const pos = this.layout();
    const nodes: VNode[] = [];
    const edges: VEdge[] = [];
    const walk = (t: TNode | null) => {
      if (!t) return;
      nodes.push({ id: t.id, label: String(t.key), pos: pos.get(t.id)!, state: h.nodes?.[t.id] ?? "idle" });
      for (const c of [t.left, t.right]) {
        if (c) {
          const id = `${t.id}-${c.id}`;
          edges.push({ id, from: t.id, to: c.id, state: h.edges?.[id] ?? "idle" });
        }
      }
      walk(t.left);
      walk(t.right);
    };
    walk(this.root);
    if (h.probe) {
      const anchor = h.probe.near ? pos.get(h.probe.near) : undefined;
      const p: Vec3 = anchor ? [anchor[0] + 0.8, anchor[1] + 0.8, 0.45] : [0, TOP + 1.5, 0];
      nodes.push({ id: h.probe.id, label: h.probe.label, pos: p, state: h.probe.state ?? "pending" });
    }
    return { nodes, edges, callouts: h.callouts, line, message, aux, question };
  }

  private static dirQuestion(key: number, node: TNode, verb: string): Question {
    const answer = key < node.key ? "Go left" : key > node.key ? "Go right" : "Stop here (equal)";
    const explain =
      key === node.key
        ? `${key} = ${node.key}: this is the key we're looking for.`
        : `${key} ${key < node.key ? "<" : ">"} ${node.key}. In a BST every key in ${node.key}'s ${key < node.key ? "left" : "right"} subtree is ${key < node.key ? "smaller" : "larger"} than ${node.key}, so ${key} can only be there.`;
    return {
      prompt: `${verb} ${key}: we are at ${node.key}. What happens next?`,
      options: ["Go left", "Go right", "Stop here (equal)"],
      answer,
      explain,
    };
  }

  private static compareText(key: number, node: TNode): Callout {
    if (key === node.key) return { at: node.id, text: `${key} = ${node.key} ✓`, tone: "good" };
    return { at: node.id, text: key < node.key ? `${key} < ${node.key} → left` : `${key} > ${node.key} → right`, tone: "info" };
  }

  /** A single still frame of the current tree, used before any operation runs. */
  view(message: string): Run {
    return { title: "Binary search tree", variant: "Unbalanced binary search tree.", code: [], frames: [this.snap(-1, message)] };
  }

  // ---------- operations (step generators) ----------

  *insert(key: number): Generator<Frame> {
    const probeId = `n${this.nextId}`;
    const probe = (near?: string) => ({ id: probeId, label: String(key), near });
    const path: string[] = [];
    const aux = () => [{ label: "Path", items: [...path] }];

    yield this.snap(0, `Insert ${key}. Start at the root and let the BST rule steer it: smaller keys go left, larger keys go right.`, { probe: probe() }, aux());

    if (!this.root) {
      yield this.snap(1, "The tree is empty: the root itself is the empty spot.", { probe: probe() }, aux());
      this.root = { id: probeId, key, left: null, right: null };
      this.nextId++;
      yield this.snap(2, `${key} becomes the root.`, { nodes: { [probeId]: "found" } }, aux());
      return;
    }

    let cur = this.root;
    const visited: Record<string, NodeState> = {};
    const tree: Record<string, EdgeState> = {};
    for (;;) {
      path.push(String(cur.key));
      const nodes = { ...visited, [cur.id]: "current" as NodeState };
      yield this.snap(key < cur.key ? 3 : key > cur.key ? 5 : 7, `Compare ${key} with ${cur.key}.`, { nodes, edges: tree, probe: probe(cur.id), callouts: [BST.compareText(key, cur)] }, aux(), BST.dirQuestion(key, cur, "Inserting"));

      if (key === cur.key) {
        yield this.snap(7, `${key} is already in the tree. Duplicates are ignored, so nothing changes.`, { nodes: { ...visited, [cur.id]: "found" }, edges: tree }, aux());
        return;
      }
      const goLeft = key < cur.key;
      const child = goLeft ? cur.left : cur.right;
      if (!child) {
        yield this.snap(1, `${cur.key} has no ${goLeft ? "left" : "right"} child. That empty spot is where ${key} belongs.`, { nodes, edges: tree, probe: probe(cur.id) }, aux());
        const n: TNode = { id: probeId, key, left: null, right: null };
        this.nextId++;
        if (goLeft) cur.left = n;
        else cur.right = n;
        const eid = `${cur.id}-${n.id}`;
        yield this.snap(2, `Create ${key} as the ${goLeft ? "left" : "right"} child of ${cur.key}. New keys always land as leaves.`, { nodes: { ...visited, [cur.id]: "visited", [n.id]: "found" }, edges: { ...tree, [eid]: "tree" }, callouts: [{ at: n.id, text: `new leaf ${key}`, tone: "good" }] }, aux());
        return;
      }
      visited[cur.id] = "visited";
      tree[`${cur.id}-${child.id}`] = "tree";
      yield this.snap(goLeft ? 4 : 6, `${key} ${goLeft ? "<" : ">"} ${cur.key}, so it belongs somewhere in ${cur.key}'s ${goLeft ? "left" : "right"} subtree. Move down to ${child.key}.`, { nodes: { ...visited, [child.id]: "current" }, edges: tree, probe: probe(child.id) }, aux());
      cur = child;
    }
  }

  *search(key: number): Generator<Frame> {
    const path: string[] = [];
    const aux = () => [{ label: "Path", items: [...path] }];
    const probe = (near?: string) => ({ id: "probe", label: String(key), near });
    const visited: Record<string, NodeState> = {};
    const tree: Record<string, EdgeState> = {};
    yield this.snap(0, `Search for ${key}. Each comparison sends us left or right, ruling out the other subtree entirely.`, { probe: probe() }, aux());

    let cur = this.root;
    while (cur) {
      path.push(String(cur.key));
      const nodes = { ...visited, [cur.id]: (key === cur.key ? "found" : "current") as NodeState };
      yield this.snap(key === cur.key ? 2 : key < cur.key ? 3 : 4, `Compare ${key} with ${cur.key}.`, { nodes, edges: tree, probe: probe(cur.id), callouts: [BST.compareText(key, cur)] }, aux(), BST.dirQuestion(key, cur, "Searching for"));
      if (key === cur.key) {
        yield this.snap(2, `Found ${key} after ${path.length} comparison${path.length > 1 ? "s" : ""}: one per level we went down.`, { nodes: { ...visited, [cur.id]: "found" }, edges: tree }, aux());
        return;
      }
      const goLeft = key < cur.key;
      const next: TNode | null = goLeft ? cur.left : cur.right;
      visited[cur.id] = "visited";
      if (next) {
        tree[`${cur.id}-${next.id}`] = "tree";
        yield this.snap(goLeft ? 3 : 4, `${key} ${goLeft ? "<" : ">"} ${cur.key}: go ${goLeft ? "left" : "right"} to ${next.key}.`, { nodes: { ...visited, [next.id]: "current" }, edges: tree, probe: probe(next.id) }, aux());
      } else {
        yield this.snap(goLeft ? 3 : 4, `${key} ${goLeft ? "<" : ">"} ${cur.key}, but ${cur.key} has no ${goLeft ? "left" : "right"} child.`, { nodes: visited, edges: tree, probe: probe(cur.id) }, aux());
      }
      cur = next;
    }
    yield this.snap(5, `Fell off the tree: ${key} is not stored. If it were, it would have been exactly on this path.`, { nodes: visited, edges: tree }, aux());
  }

  *delete(key: number): Generator<Frame> {
    const path: string[] = [];
    const visited: Record<string, NodeState> = {};
    const tree: Record<string, EdgeState> = {};
    const aux = () => [{ label: "Call path", items: [...path] }];
    yield this.snap(0, `Delete ${key}. First find it, then remove it in a way that keeps smaller keys on the left and larger keys on the right.`, {}, aux());
    this.root = yield* this.deleteRec(this.root, key, visited, tree, path, aux);
    yield this.snap(12, `Done: ${this.keys().join(", ")} in order. The BST rule still holds.`, {}, aux());
  }

  private *deleteRec(
    node: TNode | null,
    key: number,
    visited: Record<string, NodeState>,
    tree: Record<string, EdgeState>,
    path: string[],
    aux: () => AuxList[],
  ): Generator<Frame, TNode | null> {
    if (!node) {
      yield this.snap(1, `Fell off the tree: ${key} isn't in it, so nothing changes.`, { nodes: visited, edges: tree }, aux());
      return null;
    }
    path.push(String(node.key));
    const here = { ...visited, [node.id]: "current" as NodeState };
    yield this.snap(key < node.key ? 2 : key > node.key ? 4 : 6, `Compare ${key} with ${node.key}.`, { nodes: here, edges: tree, callouts: [BST.compareText(key, node)] }, aux(), BST.dirQuestion(key, node, "Deleting"));

    if (key !== node.key) {
      const goLeft = key < node.key;
      const child = goLeft ? node.left : node.right;
      visited[node.id] = "visited";
      if (child) tree[`${node.id}-${child.id}`] = "tree";
      const res = yield* this.deleteRec(child, key, visited, tree, path, aux);
      if (goLeft) node.left = res;
      else node.right = res;
      return node;
    }

    const doomed = { ...visited, [node.id]: "removing" as NodeState };
    if (!node.left || !node.right) {
      const line = !node.left ? 7 : 8;
      const replacement = node.left ?? node.right;
      const msg = replacement
        ? `${node.key} has only one child, so ${replacement.key}'s subtree moves up and takes its place.`
        : `${node.key} is a leaf, so it can simply be removed.`;
      yield this.snap(line, msg, { nodes: { ...doomed, ...(replacement ? { [replacement.id]: "found" } : {}) }, edges: tree, callouts: [{ at: node.id, text: replacement ? `replace with ${replacement.key}` : "leaf → remove", tone: "bad" }] }, aux());
      return replacement;
    }

    // Two children: find the in-order successor.
    yield this.snap(9, `${node.key} has two children. Its replacement must be the next larger key: the smallest key in its right subtree (the in-order successor).`, { nodes: doomed, edges: tree, callouts: [{ at: node.id, text: "two children", tone: "warn" }] }, aux());
    let succ = node.right;
    const walk: Record<string, NodeState> = {};
    const walkEdges: Record<string, EdgeState> = { [`${node.id}-${succ.id}`]: "active" };
    for (;;) {
      const last = !succ.left;
      yield this.snap(9, last ? `${succ.key} has no left child, so it is the smallest key on the right: the successor.` : `${succ.key} has a left child, and smaller keys are always to the left. Keep going left.`, { nodes: { ...doomed, ...walk, [succ.id]: last ? "found" : "current" }, edges: { ...tree, ...walkEdges }, callouts: [{ at: succ.id, text: last ? `successor = ${succ.key}` : "go left", tone: last ? "good" : "info" }] }, aux());
      if (last) break;
      walk[succ.id] = "pending";
      walkEdges[`${succ.id}-${succ.left!.id}`] = "active";
      succ = succ.left!;
    }
    const old = node.key;
    node.key = succ.key;
    yield this.snap(10, `Copy ${succ.key} into the node that held ${old}. Every key on the left is still smaller and every key on the right is still larger.`, { nodes: { ...visited, [node.id]: "found", [succ.id]: "removing" }, edges: tree, callouts: [{ at: node.id, text: `${old} → ${succ.key}`, tone: "good" }] }, aux());
    const succKey = succ.key;
    yield this.snap(11, `Now the old ${succKey} is a duplicate. Delete it from the right subtree; it has no left child, so that's an easy case.`, { nodes: { ...visited, [node.id]: "found", [succ.id]: "removing" }, edges: tree }, aux());
    visited[node.id] = "visited";
    node.right = yield* this.deleteRec(node.right, succKey, visited, tree, path, aux);
    return node;
  }

  /**
   * Depth-first traversals share one recursive walker; level-order uses a queue.
   * After the walk, each output step gets a "which key comes next?" question on the step before it.
   */
  traverse(kind: Traversal): Frame[] {
    const out: string[] = [];
    const stack: string[] = [];
    const queue: TNode[] = [];
    const states: Record<string, NodeState> = {};
    const edges: Record<string, EdgeState> = {};
    const outputAt: number[] = [];
    const frames: Frame[] = [];
    const aux = (): AuxList[] =>
      kind === "level"
        ? [{ label: "Output", items: [...out], tray: true }, { label: "Queue", items: queue.map((q) => String(q.key)), tray: true }]
        : [{ label: "Output", items: [...out], tray: true }, { label: "Call stack", items: [...stack], tray: true }];
    const emit = (line: number, msg: string, callouts?: Callout[], isOutput = false) => {
      if (isOutput) outputAt.push(frames.length);
      frames.push(this.snap(line, msg, { nodes: { ...states }, edges: { ...edges }, callouts }, aux()));
    };
    const intro: Record<Traversal, string> = {
      pre: "Pre-order: visit a node first, then its left subtree, then its right subtree. The call stack below shows the recursion.",
      in: "In-order: left subtree, then the node, then its right subtree. On a BST this lists the keys in sorted order.",
      post: "Post-order: left subtree, right subtree, and only then the node itself. Children are always finished before their parent.",
      level: "Level-order (breadth-first): visit the tree level by level, left to right, using a queue.",
    };
    emit(0, intro[kind]);

    if (kind === "level") {
      if (this.root) {
        queue.push(this.root);
        states[this.root.id] = "pending";
      }
      emit(1, `Start with the root${this.root ? ` (${this.root.key})` : ""} waiting in the queue.`);
      while (queue.length) {
        const t = queue.shift()!;
        states[t.id] = "current";
        emit(3, `Take ${t.key} from the front of the queue.`);
        out.push(String(t.key));
        emit(4, `Visit ${t.key}: it is output #${out.length}.`, [{ at: t.id, text: `output #${out.length}`, tone: "good" }], true);
        for (const [c, line] of [[t.left, 5], [t.right, 6]] as const) {
          if (!c) continue;
          queue.push(c);
          states[c.id] = "pending";
          edges[`${t.id}-${c.id}`] = "tree";
          emit(line, `${line === 5 ? "Left" : "Right"} child ${c.key} joins the back of the queue.`);
        }
        states[t.id] = "visited";
      }
      emit(2, `The queue is empty. Level-order: ${out.join(", ")}.`);
    } else {
      const seq = kind === "pre" ? ["V", "L", "R"] : kind === "in" ? ["L", "V", "R"] : ["L", "R", "V"];
      const lineOf = (step: string) => 2 + seq.indexOf(step);
      const rec = (t: TNode | null, from?: TNode) => {
        if (!t) return;
        stack.push(String(t.key));
        states[t.id] = "pending";
        if (from) edges[`${from.id}-${t.id}`] = "tree";
        emit(1, `Call ${kind}(${t.key}). It goes on the call stack.`);
        for (const step of seq) {
          if (step === "V") {
            states[t.id] = "current";
            out.push(String(t.key));
            emit(lineOf("V"), `Visit ${t.key}: it is output #${out.length}.`, [{ at: t.id, text: `output #${out.length}`, tone: "good" }], true);
            states[t.id] = "visited";
          } else {
            const c = step === "L" ? t.left : t.right;
            const side = step === "L" ? "left" : "right";
            emit(lineOf(step), c ? `Now the whole ${side} subtree of ${t.key}, starting at ${c.key}.` : `${t.key} has no ${side} child: nothing to do there.`);
            rec(c, t);
          }
        }
        if (states[t.id] !== "visited") states[t.id] = "visited";
        stack.pop();
        if (stack.length) emit(1, `${kind}(${t.key}) is finished and leaves the call stack; back in ${stack[stack.length - 1]}.`);
      };
      rec(this.root);
      emit(0, `Done: ${out.join(", ")}.${kind === "in" ? " Sorted, as expected for a BST." : ""}`);
    }

    outputAt.forEach((_, k) => {
      const qi = k === 0 ? 0 : outputAt[k - 1];
      const remaining = out.slice(k);
      const rule = { pre: "Pre-order visits a node before its subtrees (node, left, right)", in: "In-order visits the left subtree, then the node, then the right subtree, so on a BST it lists keys in sorted order", post: "Post-order visits both subtrees before the node (left, right, node)", level: "Level-order visits the tree level by level, left to right, taking nodes from a FIFO queue" }[kind];
      if (remaining.length > 1) frames[qi].question = { prompt: k === 0 ? "Which key is output first?" : `After ${out[k - 1]}, which key is output next?`, options: makeOptions(out[k], remaining), answer: out[k], explain: `${rule}. The full order is ${out.join(", ")}, so ${k === 0 ? "the first key" : `the key after ${out[k - 1]}`} is ${out[k]}.` };
    });
    return frames;
  }
}

export type Traversal = "pre" | "in" | "post" | "level";
export type BstOp = "insert" | "search" | "delete" | Traversal;

const TRAVERSAL_CODE: Record<Traversal, string[]> = {
  pre: ["preorder(node):", "  if node is null: return", "  visit(node)", "  preorder(node.left)", "  preorder(node.right)"],
  in: ["inorder(node):", "  if node is null: return", "  inorder(node.left)", "  visit(node)", "  inorder(node.right)"],
  post: ["postorder(node):", "  if node is null: return", "  postorder(node.left)", "  postorder(node.right)", "  visit(node)"],
  level: [
    "levelOrder(root):",
    "  Q = [root]",
    "  while Q is not empty:",
    "    node = Q.dequeue()",
    "    visit(node)",
    "    if node.left: Q.enqueue(node.left)",
    "    if node.right: Q.enqueue(node.right)",
  ],
};

const EMPTY_NOTE = "A missing child is an empty subtree: nothing to visit, so the call returns straight away.";
const TRAVERSAL_NOTES: Record<Traversal, string[]> = {
  pre: [
    "Pre-order: node first, then its left subtree, then its right subtree. Handy for copying or serialising a tree.",
    EMPTY_NOTE,
    "Visit the node before either of its children.",
    "Then the entire left subtree, recursively.",
    "Then the entire right subtree.",
  ],
  in: [
    "In-order: left subtree, node, right subtree. On a BST this visits the keys in sorted order.",
    EMPTY_NOTE,
    "First everything smaller: the left subtree.",
    "Then the node itself.",
    "Then everything larger: the right subtree.",
  ],
  post: [
    "Post-order: left subtree, right subtree, then the node. Children are finished before their parent, which is what you need to free a tree or evaluate an expression tree.",
    EMPTY_NOTE,
    "First the entire left subtree.",
    "Then the entire right subtree.",
    "Visit the node last, after both children.",
  ],
  level: [
    "Level-order visits the tree level by level, left to right, using a FIFO queue.",
    "Start with just the root waiting in the queue.",
    "Keep going while nodes are waiting.",
    "Take the node that has waited longest.",
    "Visit it.",
    "Its left child joins the back of the queue.",
    "Then its right child. Children are visited one level later, in left-to-right order.",
  ],
};

const TRAVERSAL_NAME: Record<Traversal, string> = { pre: "Pre-order", in: "In-order", post: "Post-order", level: "Level-order" };

export function runBst(tree: BST, op: BstOp, key: number): Run {
  if (op === "pre" || op === "in" || op === "post" || op === "level") {
    return {
      title: `${TRAVERSAL_NAME[op]} traversal`,
      variant: op === "level" ? "Breadth-first level-order traversal with a FIFO queue, left child enqueued before right." : `Recursive ${TRAVERSAL_NAME[op].toLowerCase()} depth-first traversal of a binary tree.`,
      code: TRAVERSAL_CODE[op],
      notes: TRAVERSAL_NOTES[op],
      legend: op === "level" ? { pending: "waiting in the queue", current: "being visited", visited: "already output", idle: "not reached yet" } : { pending: "on the call stack", current: "being visited", visited: "already output", idle: "not reached yet" },
      complexity: op === "level" ? "O(n) time · O(width) queue" : "O(n) time · O(h) call stack",
      frames: tree.traverse(op),
    };
  }
  const titles = { insert: `BST insert ${key}`, search: `BST search ${key}`, delete: `BST delete ${key}` };
  const variants = {
    insert: "Unbalanced binary search tree, recursive insert, duplicate keys ignored.",
    search: "Unbalanced binary search tree, iterative search.",
    delete: "Unbalanced binary search tree, recursive delete (Hibbard deletion): nodes with two children are replaced by their in-order successor (min of right subtree).",
  };
  const legend: Run["legend"] =
    op === "delete"
      ? { current: "being compared", visited: "on the path", removing: "being deleted", pending: "walking to the successor", found: "successor / replacement", idle: "untouched" }
      : { current: "being compared", visited: "on the path", pending: "key being placed", found: op === "insert" ? "new node" : "found", idle: "untouched" };
  return { title: titles[op], variant: variants[op], code: BST_CODE[op], notes: BST_NOTES[op], legend, complexity: "O(h): O(log n) balanced, O(n) worst", frames: collect(tree[op](key)) };
}
