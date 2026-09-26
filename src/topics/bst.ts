import { BST, runBst, type BstOp } from "../algorithms/bst";
import { randomInts } from "../algorithms/util";
import { num, numList } from "./helpers";
import type { TopicDef } from "./types";

const PRESET = [50, 30, 70, 20, 40, 60, 80, 35, 65];

export const bstTopic: TopicDef = {
  id: "bst",
  name: "Binary search tree",
  category: "Trees",
  icon: "🌳",
  blurb: "Left < node < right. O(h) search/insert/delete, where h can be as bad as n.",
  create() {
    let tree = new BST(PRESET);
    const op = (o: BstOp) => (v: Record<string, string>) => {
      const k = num(v.key, "Key", 0, 999);
      if (typeof k === "string") return k;
      if (o === "insert" && tree.size >= 31) return "The tree is full (31 nodes max). Delete some keys first.";
      return runBst(tree, o, k);
    };
    const trav = (o: BstOp) => () => (tree.size ? runBst(tree, o, 0) : "The tree is empty.");
    return {
      fields: [
        { id: "key", label: "Key", kind: "number", default: "45" },
        { id: "list", label: "Build from keys", kind: "text", default: "", wide: true },
      ],
      actions: [
        { id: "insert", label: "Insert", run: op("insert") },
        { id: "search", label: "Search", run: op("search") },
        { id: "delete", label: "Delete", run: op("delete") },
        { id: "pre", label: "Pre-order", run: trav("pre") },
        { id: "in", label: "In-order", run: trav("in") },
        { id: "post", label: "Post-order", run: trav("post") },
        { id: "level", label: "Level-order", run: trav("level") },
      ],
      presets: [
        { label: "Preset tree", run: () => { tree = new BST(PRESET); return tree.view(`Tree built by inserting ${PRESET.join(", ")}.`); } },
        { label: "Random", run: () => { const k = randomInts(9); tree = new BST(k); return tree.view(`Inserted ${k.join(", ")} in that order.`); } },
        { label: "Sorted input (degenerate)", run: () => { tree = new BST([10, 20, 30, 40, 50, 60]); return tree.view("Inserting sorted keys makes a BST degenerate into a linked list: height = n. Compare with the AVL tree."); } },
        { label: "Build from keys", run: (v) => { const l = numList(v.list, "Keys", 1, 31, 0, 999); if (typeof l === "string") return tree.view(l); tree = new BST(l); return tree.view(`Inserted ${l.join(", ")} in that order.`); } },
        { label: "Clear", run: () => { tree = new BST([]); return tree.view("Empty tree."); } },
      ],
      view: () => tree.view("Insert, search or delete a key, or run a traversal."),
    };
  },
};
