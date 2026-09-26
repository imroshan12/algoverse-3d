export type Vec3 = [number, number, number];

/** Colour-coded role of a node in the current frame. */
export type NodeState =
  | "idle" // untouched
  | "pending" // waiting in a queue / stack / priority queue, or part of the active range
  | "current" // being processed / compared right now
  | "visited" // done
  | "found" // search hit / newly inserted / pivot
  | "removing" // about to be deleted / swapped out
  | "ghost"; // empty slot, or eliminated from consideration

export type EdgeState = "idle" | "active" | "tree";

export interface VNode {
  id: string;
  label: string;
  /** Small caption under the node (e.g. index, distance, balance factor). */
  sub?: string;
  pos: Vec3;
  state: NodeState;
  shape?: "sphere" | "box";
  /** Box dimensions (boxes only). Defaults to a 0.9 cube. */
  size?: Vec3;
  /** Put the label above the shape instead of on its face (used for sort bars). */
  labelAbove?: boolean;
  /** Where the node flies in from when it first appears (e.g. a result bit dropping out of its column). */
  from?: Vec3;
}

export interface VEdge {
  id: string;
  from: string;
  to: string;
  state: EdgeState;
  /** Text at the midpoint, e.g. a weight. */
  label?: string;
  directed?: boolean;
  /** When the edge lights up, the highlight flows out of this node (defaults to `from`). */
  flowFrom?: string;
  /** Bow the edge towards the camera by this much (used for dependency arrows between table cells). */
  bend?: number;
}

/** A floating pointer label such as "i", "mid", "head" or "top". */
export interface Marker {
  id: string;
  text: string;
  pos: Vec3;
  color?: string;
  /** Draw a small 3D arrowhead pointing from the label towards its target. */
  arrow?: "up" | "down" | "left";
  /** Horizontal anchor of the text (default centre). */
  align?: "left" | "center" | "right";
  /** Font size in world units (default 0.3). */
  size?: number;
}

/** A speech bubble attached to one node (or centred over several) explaining the current decision. */
export interface Callout {
  at: string | string[];
  text: string;
  tone?: "info" | "good" | "bad" | "warn";
  /** Put the bubble under the node instead of above it (when pointer labels sit above). */
  below?: boolean;
}

export interface AuxList {
  label: string;
  items: string[];
  /** Also draw this list as a row of tokens in the 3D scene (queues, stacks, output orders). */
  tray?: boolean;
}

/** A multiple-choice question about what the *next* steps will show. */
export interface Question {
  prompt: string;
  options: string[];
  answer: string;
  /** Worked reasoning shown after the learner answers. */
  explain?: string;
}

/** One immutable snapshot of the algorithm: what to draw and which code line is running. */
export interface Frame {
  nodes: VNode[];
  edges: VEdge[];
  markers?: Marker[];
  callouts?: Callout[];
  line: number;
  message: string;
  aux: AuxList[];
  question?: Question;
}

/** A complete, pre-computed algorithm run the player can scrub through. */
export interface Run {
  title: string;
  /** Short description of the exact variant, shown in the "Step explained" panel. */
  variant: string;
  code: string[];
  /** Plain-English explanation of each pseudocode line (same length as `code`). */
  notes?: string[];
  /** What each colour means in this particular algorithm. */
  legend?: Partial<Record<NodeState, string>>;
  /** Headline cost, e.g. "O(n log n) time · O(n) space · stable". */
  complexity?: string;
  frames: Frame[];
}
