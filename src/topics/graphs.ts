import { PRESET_GRAPH, randomGraph, runGraph, Snapper, type Graph, type GraphAlgo } from "../algorithms/graph";
import { DAG, NEG_CYCLE_GRAPH, NEG_GRAPH, randomDag, runGraph2, type Graph2Algo } from "../algorithms/graph2";
import type { Run } from "../algorithms/types";
import { still } from "./helpers";
import type { Preset, TopicDef, TopicInstance, Values } from "./types";

type Algo = GraphAlgo | Graph2Algo;
const TWO = new Set<Algo>(["bellman", "prim", "kruskal", "kahn", "topodfs"]);

function stillGraph(g: Graph, title: string, msg: string, weighted: boolean): Run {
  return still(title, new Snapper(g, weighted).snap(-1, msg, {}, {}, []));
}

/** Shared shape for the four graph topics: one current graph, a start vertex, a few algorithms. */
function graphInstance(opts: {
  title: string;
  initial: Graph;
  weighted: boolean;
  algos: { id: Algo; label: string }[];
  needsStart: boolean;
  intro: string;
  presets: { label: string; graph: () => Graph; msg: string }[];
}): TopicInstance {
  let g = opts.initial;
  const start = (v: Values) => (g.nodes.some((n) => n.id === v.start) ? v.start : g.nodes[0].id);
  const run = (a: Algo) => (v: Values): Run => {
    const s = start(v);
    const r = TWO.has(a) ? runGraph2(g, a as Graph2Algo, s) : runGraph(g, a as GraphAlgo, s);
    if (a === "dijkstra" && g.edges.some((e) => e.w < 0)) {
      r.title += " (negative edges!)";
      r.frames[0] = { ...r.frames[0], message: "Warning: this graph has negative edges. Dijkstra assumes they don't exist, so watch for wrong answers. Compare with Bellman-Ford." };
    }
    return r;
  };
  const presets: Preset[] = opts.presets.map((p) => ({ label: p.label, fill: { start: "" }, run: () => { g = p.graph(); return stillGraph(g, opts.title, p.msg, opts.weighted); } }));
  return {
    fields: opts.needsStart ? [{ id: "start", label: "Start", kind: "select", default: "A", options: () => g.nodes.map((n) => n.id) }] : [],
    actions: opts.algos.map((a) => ({ id: a.id, label: a.label, run: run(a.id) })),
    presets,
    pickField: opts.needsStart ? "start" : undefined,
    view: () => stillGraph(g, opts.title, opts.intro, opts.weighted),
  };
}

export const traversalTopic: TopicDef = {
  id: "graph-traversal",
  name: "Graph traversal",
  category: "Graphs",
  icon: "🕸️",
  blurb: "BFS explores level by level with a queue; DFS goes deep with recursion.",
  create: () =>
    graphInstance({
      title: "Graph traversal",
      initial: PRESET_GRAPH,
      weighted: false,
      needsStart: true,
      algos: [{ id: "bfs", label: "BFS" }, { id: "dfs", label: "DFS" }],
      intro: "Pick BFS or DFS. Click any node to start from it.",
      presets: [
        { label: "Preset graph", graph: () => PRESET_GRAPH, msg: "The preset graph." },
        { label: "Random graph", graph: () => randomGraph(9), msg: "A random connected graph." },
      ],
    }),
};

export const shortestPathTopic: TopicDef = {
  id: "shortest-paths",
  name: "Shortest paths",
  category: "Graphs",
  icon: "🧭",
  blurb: "Dijkstra (greedy, non-negative weights) vs Bellman-Ford (handles negative edges, detects negative cycles).",
  create: () =>
    graphInstance({
      title: "Shortest paths",
      initial: PRESET_GRAPH,
      weighted: true,
      needsStart: true,
      algos: [{ id: "dijkstra", label: "Dijkstra" }, { id: "bellman", label: "Bellman-Ford" }],
      intro: "Run Dijkstra on this graph. Then load the negative-edge graph and compare it with Bellman-Ford.",
      presets: [
        { label: "Undirected, positive", graph: () => PRESET_GRAPH, msg: "Non-negative weights: Dijkstra works." },
        { label: "Directed, negative edges", graph: () => NEG_GRAPH, msg: "Directed graph with negative edges. Start from S. Bellman-Ford gets it right; try Dijkstra too." },
        { label: "Negative cycle", graph: () => NEG_CYCLE_GRAPH, msg: "A→C→B→A now sums to -1. Bellman-Ford will detect it. Start from S." },
        { label: "Random", graph: () => randomGraph(8), msg: "A random weighted graph." },
      ],
    }),
};

export const mstTopic: TopicDef = {
  id: "mst",
  name: "Minimum spanning tree",
  category: "Graphs",
  icon: "🌲",
  blurb: "Connect every vertex with minimum total weight. Prim grows one tree; Kruskal merges forests.",
  create: () =>
    graphInstance({
      title: "Minimum spanning tree",
      initial: PRESET_GRAPH,
      weighted: true,
      needsStart: true,
      algos: [{ id: "prim", label: "Prim" }, { id: "kruskal", label: "Kruskal" }],
      intro: "Both algorithms find the same total weight. Watch how differently they get there.",
      presets: [
        { label: "Preset graph", graph: () => PRESET_GRAPH, msg: "The preset graph." },
        { label: "Random graph", graph: () => randomGraph(9), msg: "A random weighted graph." },
      ],
    }),
};

export const topoTopic: TopicDef = {
  id: "topo-sort",
  name: "Topological sort",
  category: "Graphs",
  icon: "📋",
  blurb: "Order the tasks of a DAG so every edge points forward. Kahn uses in-degrees; DFS uses finish times.",
  create: () =>
    graphInstance({
      title: "Topological sort",
      initial: DAG,
      weighted: false,
      needsStart: false,
      algos: [{ id: "kahn", label: "Kahn (BFS)" }, { id: "topodfs", label: "DFS-based" }],
      intro: "A directed acyclic graph, like course prerequisites. Arrows point from prerequisite to dependent.",
      presets: [
        { label: "Preset DAG", graph: () => DAG, msg: "The preset DAG." },
        { label: "Random DAG", graph: () => randomDag(8), msg: "A random DAG." },
      ],
    }),
};
