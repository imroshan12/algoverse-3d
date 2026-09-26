import * as THREE from "three";
import type { Frame, Marker, Run, VNode, Vec3 } from "../algorithms/types";

/**
 * Run-level layout: one camera frame for the whole run (so the view never drifts between steps)
 * and a row in 3D for every aux list marked `tray` (queues, stacks, output orders).
 */

export const DEFAULT_BOX: Vec3 = [0.9, 0.9, 0.9];
export const TRAY_GAP = 0.86;
export const TRAY_SIZE: Vec3 = [0.74, 0.52, 0.36];
const TRAY_ROW_GAP = 1.15;
const CHAR_W = 0.165; // approximate width of one character at font size 0.3

export interface TrayRow {
  label: string;
  x0: number;
  y: number;
  slots: number;
}

export interface RunLayout {
  view: THREE.Box3;
  trays: TrayRow[];
  floorY: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

function nodeSize(n: VNode): Vec3 {
  return n.shape === "box" ? (n.size ?? DEFAULT_BOX) : n.size ?? [0.9, 0.9, 0.9];
}

function addNode(n: VNode, box: THREE.Box3) {
  const s = nodeSize(n);
  const top = n.pos[1] + s[1] / 2 + (n.labelAbove ? 0.6 : 0);
  const bottom = n.pos[1] - s[1] / 2 - (n.sub ? 0.55 : 0);
  box.expandByPoint(V(n.pos[0] - s[0] / 2, bottom, n.pos[2] - s[2] / 2));
  box.expandByPoint(V(n.pos[0] + s[0] / 2, top, n.pos[2] + s[2] / 2));
}

function addMarker(m: Marker, box: THREE.Box3) {
  const w = m.text.length * CHAR_W * ((m.size ?? 0.3) / 0.3);
  const [x, y, z] = m.pos;
  const left = m.align === "right" ? x - w : m.align === "left" ? x : x - w / 2;
  const extra = m.arrow === "up" || m.arrow === "down" ? 0.4 : 0;
  box.expandByPoint(V(left - (m.arrow === "left" ? 0.4 : 0), y - 0.2 - (m.arrow === "down" ? extra : 0), z));
  box.expandByPoint(V(left + w, y + 0.2 + (m.arrow === "up" ? extra : 0), z));
}

export function computeLayout(run: Run): RunLayout {
  const box = new THREE.Box3();
  for (const f of run.frames) {
    for (const n of f.nodes) addNode(n, box);
    for (const m of f.markers ?? []) addMarker(m, box);
    // Leave headroom for speech bubbles above the nodes they point at.
    for (const c of f.callouts ?? []) {
      for (const id of Array.isArray(c.at) ? c.at : [c.at]) {
        const n = f.nodes.find((x) => x.id === id);
        if (n && c.below) box.expandByPoint(V(n.pos[0], n.pos[1] - nodeSize(n)[1] / 2 - 1.1, n.pos[2]));
        else if (n) box.expandByPoint(V(n.pos[0], n.pos[1] + nodeSize(n)[1] / 2 + (n.labelAbove ? 0.6 : 0) + 1.1, n.pos[2]));
      }
    }
  }
  if (box.isEmpty()) box.set(V(-2, -1, 0), V(2, 1, 0));

  const order: string[] = [];
  const slots = new Map<string, number>();
  for (const f of run.frames)
    for (const a of f.aux) {
      if (!a.tray) continue;
      if (!slots.has(a.label)) order.push(a.label);
      slots.set(a.label, Math.max(slots.get(a.label) ?? 1, a.items.length));
    }

  const view = box.clone();
  const trays: TrayRow[] = [];
  const x0 = box.min.x + 0.45;
  let y = box.min.y - 1.0;
  for (const label of order) {
    const n = slots.get(label)!;
    trays.push({ label, x0, y, slots: n });
    view.expandByPoint(V(x0 - 0.6 - label.length * CHAR_W * 0.8, y - 0.45, 0));
    view.expandByPoint(V(x0 + (n - 1) * TRAY_GAP + 0.5, y + 0.45, 0));
    y -= TRAY_ROW_GAP;
  }
  return { view, trays, floorY: view.min.y - 0.45 };
}

/** Tokens for this frame's tray lists. Tokens take the colour of the node they name, and fly in from it. */
export function buildTrays(frame: Frame, layout: RunLayout) {
  const nodes: VNode[] = [];
  const markers: Marker[] = [];
  const spawn = new Map<string, Vec3>();
  const byLabel = new Map(frame.nodes.map((n) => [n.label, n]));
  for (const row of layout.trays) {
    markers.push({ id: `tray-label|${row.label}`, text: row.label, pos: [row.x0 - 0.6, row.y, 0], align: "right", color: "#5b6886", size: 0.24 });
    const list = frame.aux.find((a) => a.tray && a.label === row.label);
    const seen = new Map<string, number>();
    (list?.items ?? []).forEach((text, k) => {
      const occ = seen.get(text) ?? 0;
      seen.set(text, occ + 1);
      const id = `tray|${row.label}|${text}#${occ}`;
      const match = byLabel.get(text.split(":")[0]);
      const state = match && match.state !== "ghost" ? match.state : "idle";
      nodes.push({ id, label: text, pos: [row.x0 + k * TRAY_GAP, row.y, 0], state, shape: "box", size: TRAY_SIZE });
      if (match) spawn.set(id, match.pos);
    });
  }
  return { nodes, markers, spawn };
}
