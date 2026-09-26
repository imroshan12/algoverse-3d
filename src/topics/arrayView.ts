import type { AuxList, Callout, Frame, Marker, NodeState, Question, VNode, Vec3 } from "../algorithms/types";
import { rowX } from "../algorithms/util";

export interface Item {
  id: string;
  v: number | string;
}

export const GAP = 1.1;

export interface PtrSpec {
  text: string;
  index: number;
  color?: string;
}

export interface ArrayFrameOpts {
  /** Slot contents; null = hole. Length defines how many slots are drawn (plus ghosts up to `cap`). */
  slots: (Item | null)[];
  cap?: number;
  states?: Record<string, NodeState>;
  /** Items hovering above a slot (e.g. the value being inserted). */
  floating?: { item: Item; index: number; state?: NodeState }[];
  pointers?: PtrSpec[];
  line: number;
  message: string;
  aux?: AuxList[];
  question?: Question;
  callouts?: Callout[];
  y?: number;
  /** Horizontal offset of the row's centre. */
  x?: number;
  /** Prefix for slot ids so two arrays can share a frame. */
  prefix?: string;
  showIndex?: boolean;
}

export function slotPos(i: number, n: number, y = 0): Vec3 {
  return [rowX(i, n, GAP), y, 0];
}

export function arrayNodes(o: Omit<ArrayFrameOpts, "line" | "message">): { nodes: VNode[]; markers: Marker[] } {
  const n = Math.max(o.cap ?? 0, o.slots.length, ...(o.floating ?? []).map((f) => f.index + 1));
  const y = o.y ?? 0;
  const x0 = o.x ?? 0;
  const pre = o.prefix ?? "";
  const nodes: VNode[] = [];
  for (let i = 0; i < n; i++) {
    const it = o.slots[i];
    const x = slotPos(i, n, y)[0] + x0;
    // Faint slot frame so holes and spare capacity stay visible.
    nodes.push({ id: `${pre}slot-${i}`, label: "", sub: o.showIndex === false ? undefined : String(i), pos: [x, y, -0.35], state: "ghost", shape: "box", size: [1, 1, 0.2] });
    if (it) nodes.push({ id: it.id, label: String(it.v), pos: [x, y, 0], state: o.states?.[it.id] ?? "idle", shape: "box", size: [0.9, 0.9, 0.9] });
  }
  for (const f of o.floating ?? []) {
    const x = slotPos(f.index, n, y)[0] + x0;
    nodes.push({ id: f.item.id, label: String(f.item.v), pos: [x, y + 1.5, 0.3], state: f.state ?? "found", shape: "box", size: [0.9, 0.9, 0.9] });
  }
  const markers: Marker[] = [];
  const stack: Record<number, number> = {};
  for (const p of o.pointers ?? []) {
    if (p.index < -1 || p.index > n) continue;
    const k = (stack[p.index] = (stack[p.index] ?? 0) + 1) - 1;
    const x = rowX(p.index, n, GAP) + x0;
    markers.push({ id: `${pre}ptr-${p.text}`, text: p.text, pos: [x, y - 1.35 - k * 0.45, 0.3], color: p.color, arrow: k === 0 ? "up" : undefined });
  }
  return { nodes, markers };
}

export function arrayFrame(o: ArrayFrameOpts): Frame {
  const { nodes, markers } = arrayNodes(o);
  return { nodes, edges: [], markers, callouts: o.callouts, line: o.line, message: o.message, aux: o.aux ?? [], question: o.question };
}

let counter = 0;
export const newItem = (v: number | string): Item => ({ id: `it${counter++}`, v });
