import type { AuxList, Callout, EdgeState, Frame, Marker, NodeState, Question, VEdge, VNode, Vec3 } from "../algorithms/types";

export interface BNode {
  id: string;
  key: number;
  left: BNode | null;
  right: BNode | null;
}

const X_GAP = 1.25;
const Y_GAP = 1.6;
const TOP = 3.2;

/** In-order index gives x, depth gives y: never overlaps, and rotations animate naturally. */
export function binaryLayout(root: BNode | null): Map<string, Vec3> {
  const order: { id: string; depth: number }[] = [];
  const walk = (t: BNode | null, d: number) => {
    if (!t) return;
    walk(t.left, d + 1);
    order.push({ id: t.id, depth: d });
    walk(t.right, d + 1);
  };
  walk(root, 0);
  const mid = (order.length - 1) / 2;
  const pos = new Map<string, Vec3>();
  order.forEach((o, i) => pos.set(o.id, [(i - mid) * X_GAP, TOP - o.depth * Y_GAP, 0]));
  return pos;
}

export interface TreeFrameOpts {
  line: number;
  message: string;
  states?: Record<string, NodeState>;
  edges?: Record<string, EdgeState>;
  subs?: Record<string, string>;
  /** A floating sphere carrying the key being inserted/searched, anchored beside `near`. */
  probe?: { id: string; label: string; near?: string; state?: NodeState };
  /** Extra detached subtrees drawn at an offset (e.g. mid-rotation). */
  markers?: Marker[];
  aux?: AuxList[];
  question?: Question;
  callouts?: Callout[];
}

export function binaryFrame(root: BNode | null, o: TreeFrameOpts): Frame {
  const pos = binaryLayout(root);
  const nodes: VNode[] = [];
  const edges: VEdge[] = [];
  const walk = (t: BNode | null) => {
    if (!t) return;
    nodes.push({ id: t.id, label: String(t.key), sub: o.subs?.[t.id], pos: pos.get(t.id)!, state: o.states?.[t.id] ?? "idle" });
    for (const c of [t.left, t.right]) {
      if (!c) continue;
      const id = `${t.id}-${c.id}`;
      edges.push({ id, from: t.id, to: c.id, state: o.edges?.[id] ?? "idle" });
    }
    walk(t.left);
    walk(t.right);
  };
  walk(root);
  if (o.probe) {
    const anchor = o.probe.near ? pos.get(o.probe.near) : undefined;
    const p: Vec3 = anchor ? [anchor[0] + 0.8, anchor[1] + 0.8, 0.45] : [0, TOP + 1.5, 0];
    nodes.push({ id: o.probe.id, label: o.probe.label, pos: p, state: o.probe.state ?? "pending" });
  }
  return { nodes, edges, markers: o.markers, callouts: o.callouts, line: o.line, message: o.message, aux: o.aux ?? [], question: o.question };
}

export const height = (t: BNode | null): number => (t ? 1 + Math.max(height(t.left), height(t.right)) : 0);
