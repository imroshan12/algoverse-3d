import type { Run } from "../algorithms/types";

export type Values = Record<string, string>;

export interface Field {
  id: string;
  label: string;
  kind: "number" | "text" | "select";
  default: string;
  /** Options for selects; evaluated on render so they can depend on topic state. */
  options?: () => string[];
  wide?: boolean;
}

export interface Action {
  id: string;
  label: string;
  /** Returns a run to play, or an error message to show. */
  run: (v: Values) => Run | string;
}

export interface Preset {
  label: string;
  /** Field values to fill in when the preset is chosen. */
  fill?: Values;
  run: (v: Values) => Run;
}

export interface TopicInstance {
  fields: Field[];
  actions: Action[];
  presets: Preset[];
  /** A still frame of the current state. */
  view(): Run;
  /** Clicking a node in the scene writes its id into this field and reruns the last action. */
  pickField?: string;
}

export type Category = "Linear structures" | "Searching & sorting" | "Trees" | "Graphs" | "Dynamic programming" | "Bit manipulation";

export interface TopicDef {
  id: string;
  name: string;
  category: Category;
  icon: string;
  blurb: string;
  create(): TopicInstance;
}
