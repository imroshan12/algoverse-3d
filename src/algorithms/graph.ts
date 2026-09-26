import type { AuxList, Callout, EdgeState, Frame, NodeState, Question, Run, VEdge, VNode, Vec3 } from "./types";
import { collect, makeOptions } from "./util";

export interface Graph {
  nodes: { id: string; pos: Vec3 }[];
  edges: { a: string; b: string; w: number }[];
  directed?: boolean;
}

export type GraphAlgo = "bfs" | "dfs" | "dijkstra";

export const GRAPH_CODE: Record<GraphAlgo, string[]> = {
  bfs: [
    "BFS(G, s):",
    "  for each v in G: visited[v] = false",
    "  visited[s] = true",
    "  Q = [s]",
    "  while Q is not empty:",
    "    u = Q.dequeue()",
    "    for each v in adj[u]:        // alphabetical",
    "      if not visited[v]:",
    "        visited[v] = true",
    "        Q.enqueue(v)",
  ],
  dfs: [
    "DFS(G, s):",
    "  for each v in G: visited[v] = false",
    "  visit(s)",
    "",
    "visit(u):",
    "  visited[u] = true",
    "  for each v in adj[u]:          // alphabetical",
    "    if not visited[v]:",
    "      visit(v)",
    "  return                         // backtrack",
  ],
  dijkstra: [
    "Dijkstra(G, s):",
    "  dist[v] = ∞ for all v;  dist[s] = 0",
    "  PQ = {(0, s)}",
    "  while PQ is not empty:",
    "    (d, u) = PQ.extractMin()",
    "    if u is finalized: continue   // stale entry",
    "    finalize u",
    "    for each (v, w) in adj[u]:",
    "      if dist[u] + w < dist[v]:",
    "        dist[v] = dist[u] + w",
    "        PQ.insert((dist[v], v))",
  ],
};

const VARIANTS: Record<GraphAlgo, string> = {
  bfs: "Breadth-first search on an undirected, unweighted view of the graph using a FIFO queue. Nodes are marked visited when enqueued (not when dequeued). Neighbours are scanned in alphabetical order.",
  dfs: "Recursive depth-first search on an undirected graph. Nodes are marked visited on entry to visit(u). Neighbours are scanned in alphabetical order.",
  dijkstra: "Dijkstra's shortest paths on an undirected graph with non-negative weights, using a binary-heap priority queue with lazy deletion (stale entries are skipped when extracted). Ties are broken by distance, then alphabetically. Neighbours are scanned in alphabetical order.",
};

export const edgeId = (a: string, b: string) => (a < b ? `${a}-${b}` : `${b}-${a}`);
/** Edge id that respects direction for directed graphs. */
export const eid = (g: Graph, a: string, b: string) => (g.directed ? `${a}->${b}` : edgeId(a, b));

export function adjacency(g: Graph): Map<string, { v: string; w: number }[]> {
  const adj = new Map<string, { v: string; w: number }[]>();
  for (const n of g.nodes) adj.set(n.id, []);
  for (const e of g.edges) {
    adj.get(e.a)!.push({ v: e.b, w: e.w });
    if (!g.directed) adj.get(e.b)!.push({ v: e.a, w: e.w });
  }
  for (const list of adj.values()) list.sort((x, y) => x.v.localeCompare(y.v));
  return adj;
}

export class Snapper {
  constructor(
    private g: Graph,
    private weighted: boolean,
  ) {}
  snap(
    line: number,
    message: string,
    nodes: Record<string, NodeState>,
    edges: Record<string, EdgeState>,
    aux: AuxList[],
    question?: Question,
    subs?: Record<string, string>,
    extra: { callouts?: Callout[]; flows?: Record<string, string> } = {},
  ): Frame {
    const vn: VNode[] = this.g.nodes.map((n) => ({ id: n.id, label: n.id, pos: n.pos, state: nodes[n.id] ?? "idle", sub: subs?.[n.id] }));
    const ve: VEdge[] = this.g.edges.map((e) => {
      const id = eid(this.g, e.a, e.b);
      return { id, from: e.a, to: e.b, state: edges[id] ?? "idle", label: this.weighted ? String(e.w) : undefined, directed: this.g.directed, flowFrom: extra.flows?.[id] };
    });
    return { nodes: vn, edges: ve, callouts: extra.callouts, line, message, aux, question };
  }
}

export const GRAPH_NOTES: Record<GraphAlgo, string[]> = {
  bfs: [
    "Explore in waves: everything 1 edge from s, then everything 2 edges away, and so on.",
    "Nothing has been discovered yet.",
    "The start is discovered straight away.",
    "The queue holds discovered nodes whose neighbours haven't been explored yet.",
    "Keep going while discovered nodes are waiting.",
    "Take the node that has waited longest (first in, first out). That's what makes the search go level by level.",
    "Look at each neighbour, in alphabetical order here.",
    "Skip neighbours that were already discovered.",
    "Mark it visited as soon as it's discovered, so it can never be queued twice.",
    "It joins the back of the queue, behind everything already waiting (which is no farther from s).",
  ],
  dfs: [
    "Go as deep as possible along one path; back up only when there's nowhere new to go.",
    "Nothing has been visited yet.",
    "Start the recursion at s.",
    "",
    "Each call explores everything reachable from u that hasn't been visited yet.",
    "Mark u visited as soon as we enter it.",
    "Try u's neighbours one by one, in alphabetical order here.",
    "Only unvisited neighbours are explored; visited ones would lead in circles.",
    "Recurse immediately: go deeper before trying u's other neighbours. u waits on the call stack.",
    "u has no unvisited neighbours left, so return to the caller (backtrack).",
  ],
  dijkstra: [
    "Greedy: always settle the unfinished vertex with the smallest known distance.",
    "Nothing is known yet, except that s is 0 away from itself.",
    "The priority queue hands out candidates in order of tentative distance.",
    "Keep going while candidates remain.",
    "The smallest tentative distance comes out first.",
    "Lazy deletion: an older, longer entry for a vertex that is already final is simply skipped.",
    "With non-negative weights no path through a farther vertex can come back shorter, so this distance is final.",
    "Try to improve each neighbour's distance by going through u.",
    "Relaxation: is the path through u shorter than the best one known so far?",
    "Yes: remember the shorter distance.",
    "Queue the neighbour with its new distance; any older entry for it becomes stale.",
  ],
};

const LEGENDS: Record<GraphAlgo, Run["legend"]> = {
  bfs: { pending: "discovered, in the queue", current: "being expanded", visited: "fully explored", idle: "not discovered yet" },
  dfs: { pending: "waiting on the call stack", current: "current call", visited: "finished (backtracked)", idle: "not visited yet" },
  dijkstra: { pending: "in the priority queue", current: "being settled", visited: "distance is final", idle: "not reached yet" },
};

function* bfs(g: Graph, s: string): Generator<Frame> {
  const S = new Snapper(g, false);
  const adj = adjacency(g);
  const labels = g.nodes.map((n) => n.id);
  const state: Record<string, NodeState> = {};
  const edges: Record<string, EdgeState> = {};
  const flows: Record<string, string> = {};
  const visited = new Set<string>();
  const Q: string[] = [];
  const order: string[] = [];
  const level: Record<string, number> = { [s]: 0 };
  const aux = (): AuxList[] => [
    { label: "Queue", items: [...Q], tray: true },
    { label: "Visit order", items: [...order], tray: true },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, undefined, { callouts, flows });

  yield snap(0, `Breadth-first search from ${s}: first everything 1 edge away, then 2 edges away, and so on. A queue keeps the waves in order.`);
  yield snap(1, "Nothing has been discovered yet.");
  visited.add(s);
  state[s] = "pending";
  yield snap(2, `Discover the start, ${s}.`, [{ at: s, text: "start", tone: "info" }]);
  Q.push(s);
  yield snap(3, `The queue starts with just ${s}.`);

  while (Q.length) {
    const pool = labels.filter((l) => !order.includes(l));
    const question = order.length > 0 ? { prompt: "Which node is dequeued next?", options: makeOptions(Q[0], pool), answer: Q[0], explain: `The queue is first in, first out: ${Q.join(", ")} (front first). ${Q[0]} was discovered earliest, so it is dequeued next.` } : undefined;
    yield snap(4, `${Q.length} node${Q.length > 1 ? "s are" : " is"} waiting in the queue. The one that has waited longest goes next.`, undefined, question);
    const u = Q.shift()!;
    order.push(u);
    state[u] = "current";
    yield snap(5, `Take ${u} from the front of the queue (it has waited longest). It is ${level[u]} edge${level[u] === 1 ? "" : "s"} from ${s}.`, [{ at: u, text: `expand ${u}`, tone: "info" }]);
    for (const { v } of adj.get(u)!) {
      const id = eid(g, u, v);
      const prev = edges[id];
      const prevFlow = flows[id];
      edges[id] = "active";
      flows[id] = u;
      const seen = visited.has(v);
      yield snap(7, seen ? `Neighbour ${v} was already discovered, so skip it.` : `Neighbour ${v} hasn't been seen before.`, [{ at: v, text: seen ? "already seen" : "new!", tone: seen ? "info" : "good" }]);
      if (seen) {
        edges[id] = prev ?? "idle";
        if (prevFlow) flows[id] = prevFlow;
        continue;
      }
      visited.add(v);
      level[v] = level[u] + 1;
      state[v] = "pending";
      edges[id] = "tree";
      yield snap(8, `Mark ${v} as discovered right away, so it can never be queued twice. It is ${level[v]} edge${level[v] === 1 ? "" : "s"} from ${s}.`);
      Q.push(v);
      yield snap(9, `${v} joins the back of the queue.`, [{ at: v, text: `queue ← ${v}`, tone: "good" }]);
    }
    state[u] = "visited";
  }
  yield snap(4, `The queue is empty: every node reachable from ${s} has been visited. BFS order: ${order.join(" → ")}. The green edges form a shortest-path tree (by number of edges).`);
}

function* dfs(g: Graph, s: string): Generator<Frame> {
  const S = new Snapper(g, false);
  const adj = adjacency(g);
  const labels = g.nodes.map((n) => n.id);
  const state: Record<string, NodeState> = {};
  const edges: Record<string, EdgeState> = {};
  const flows: Record<string, string> = {};
  const visited = new Set<string>();
  const stack: string[] = [];
  const order: string[] = [];
  const aux = (): AuxList[] => [
    { label: "Call stack", items: [...stack], tray: true },
    { label: "Visit order", items: [...order], tray: true },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, undefined, { callouts, flows });

  // Pre-compute the full visit order so we can ask "who is next?" ahead of time.
  const fullOrder: string[] = [];
  (function pre(u: string, seen: Set<string>) {
    seen.add(u);
    fullOrder.push(u);
    for (const { v } of adj.get(u)!) if (!seen.has(v)) pre(v, seen);
  })(s, new Set());

  yield snap(0, `Depth-first search from ${s}: follow one path as deep as it goes, and back up (backtrack) only when stuck. The call stack remembers the way back.`);
  yield snap(1, "Nothing has been visited yet.");
  yield snap(2, `Call visit(${s}).`);

  function* visit(u: string): Generator<Frame> {
    stack.push(u);
    visited.add(u);
    order.push(u);
    for (const k of stack) if (k !== u) state[k] = "pending";
    state[u] = "current";
    const next = fullOrder[order.length];
    const question = next ? { prompt: "Which node will DFS visit next?", options: makeOptions(next, labels.filter((l) => !order.includes(l))), answer: next, explain: `DFS takes the first unvisited neighbour (alphabetically) of the current vertex, backtracking up the call stack when there is none. The full DFS order is ${fullOrder.join(" → ")}, so after ${u} comes ${next}.` } : undefined;
    yield snap(5, `Enter visit(${u}) and mark ${u} visited. It goes on top of the call stack.`, [{ at: u, text: `visit #${order.length}`, tone: "good" }], question);
    for (const { v } of adj.get(u)!) {
      const id = eid(g, u, v);
      const prev = edges[id];
      const prevFlow = flows[id];
      edges[id] = "active";
      flows[id] = u;
      if (visited.has(v)) {
        yield snap(7, `Neighbour ${v} is already visited, so skip it.`, [{ at: v, text: "already visited", tone: "info" }]);
        edges[id] = prev ?? "idle";
        if (prevFlow) flows[id] = prevFlow;
        continue;
      }
      edges[id] = "tree";
      yield snap(8, `Neighbour ${v} is unvisited: go deeper right away. ${u} waits on the call stack.`, [{ at: v, text: "go deeper", tone: "good" }]);
      yield* visit(v);
      state[u] = "current";
      yield snap(6, `Back in visit(${u}): try its remaining neighbours.`, [{ at: u, text: `back in ${u}`, tone: "info" }]);
    }
    state[u] = "visited";
    stack.pop();
    yield snap(9, `${u} has no unvisited neighbours left, so visit(${u}) returns: backtrack${stack.length ? ` to ${stack[stack.length - 1]}` : ""}.`, [{ at: u, text: "backtrack", tone: "warn" }]);
  }
  yield* visit(s);
  yield snap(2, `DFS complete. Visit order: ${order.join(" → ")}. The green edges form the DFS tree.`);
}

function* dijkstra(g: Graph, s: string): Generator<Frame> {
  const S = new Snapper(g, true);
  const adj = adjacency(g);
  const labels = g.nodes.map((n) => n.id);
  const state: Record<string, NodeState> = {};
  const edges: Record<string, EdgeState> = {};
  const flows: Record<string, string> = {};
  const dist: Record<string, number> = {};
  const parent: Record<string, string> = {};
  const done = new Set<string>();
  let pq: { d: number; v: string }[] = [];
  const cmp = (a: { d: number; v: string }, b: { d: number; v: string }) => a.d - b.d || a.v.localeCompare(b.v);
  const fmt = (d: number | undefined) => (d === undefined ? "∞" : String(d));
  const subs = () => Object.fromEntries(labels.map((l) => [l, `d=${fmt(dist[l])}`]));
  const aux = (): AuxList[] => [
    { label: "Priority queue", items: [...pq].sort(cmp).map((e) => `${e.v}:${e.d}`), tray: true },
    { label: "Finalized", items: labels.filter((l) => done.has(l)).sort((a, b) => dist[a] - dist[b] || a.localeCompare(b)), tray: true },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, subs(), { callouts, flows });

  yield snap(0, `Dijkstra's shortest paths from ${s}: repeatedly settle the closest vertex that isn't final yet, then try to improve its neighbours' distances.`);
  dist[s] = 0;
  yield snap(1, `Every distance starts at ∞, except dist[${s}] = 0.`);
  pq.push({ d: 0, v: s });
  state[s] = "pending";
  yield snap(2, `Put (${s}, 0) into the priority queue.`);

  while (pq.length) {
    pq.sort(cmp);
    const top = pq[0];
    const question = done.size > 0 && !done.has(top.v)
      ? { prompt: "Which node is extracted from the priority queue next?", options: makeOptions(top.v, labels.filter((l) => !done.has(l))), answer: top.v, explain: `The priority queue always hands out the smallest tentative distance. Its entries are ${[...pq].sort(cmp).map((e) => `${e.v}:${e.d}`).join(", ")}, so ${top.v} (distance ${top.d}) comes out next.` }
      : undefined;
    yield snap(3, `${pq.length} entr${pq.length === 1 ? "y" : "ies"} in the priority queue. The smallest distance comes out first.`, undefined, question);
    pq = pq.slice(1);
    const { d, v: u } = top;
    const prevState = state[u];
    state[u] = "current";
    if (done.has(u)) {
      yield snap(5, `Out comes (${u}, ${d}), but ${u} is already final with distance ${dist[u]}. This entry is stale: skip it.`, [{ at: u, text: "stale entry", tone: "info" }]);
      state[u] = prevState;
      continue;
    }
    yield snap(4, `Out comes ${u} with distance ${d}: the closest unsettled vertex.`, [{ at: u, text: `closest: ${d}`, tone: "info" }]);
    done.add(u);
    if (parent[u]) {
      edges[eid(g, parent[u], u)] = "tree";
      flows[eid(g, parent[u], u)] = parent[u];
    }
    yield snap(6, `Settle ${u}: its shortest distance is ${d}. Any other route would pass through a vertex that is already at least as far away.`, [{ at: u, text: `final: ${d}`, tone: "good" }]);
    for (const { v, w } of adj.get(u)!) {
      const id = eid(g, u, v);
      const prev = edges[id];
      const prevFlow = flows[id];
      edges[id] = "active";
      flows[id] = u;
      const alt = dist[u] + w;
      const better = dist[v] === undefined || alt < dist[v];
      yield snap(8, `Relax ${u}–${v} (weight ${w}): going through ${u} costs ${dist[u]} + ${w} = ${alt}; the best known distance to ${v} is ${fmt(dist[v])}.`, [{ at: v, text: better ? `${alt} < ${fmt(dist[v])} ✓ shorter` : `${alt} ≥ ${fmt(dist[v])} ✗`, tone: better ? "good" : "info" }]);
      if (better) {
        dist[v] = alt;
        parent[v] = u;
        pq.push({ d: alt, v });
        state[v] = "pending";
        yield snap(10, `Update dist[${v}] = ${alt} and queue (${v}, ${alt}).`);
      }
      edges[id] = prev ?? "idle";
      if (prevFlow) flows[id] = prevFlow;
    }
    state[u] = "visited";
  }
  yield snap(3, "The priority queue is empty: every reachable distance is final. The green edges form the shortest-path tree.");
}

export function runGraph(g: Graph, algo: GraphAlgo, start: string): Run {
  const gen = algo === "bfs" ? bfs(g, start) : algo === "dfs" ? dfs(g, start) : dijkstra(g, start);
  const names = { bfs: "BFS", dfs: "DFS", dijkstra: "Dijkstra" };
  return {
    title: `${names[algo]} from ${start}`,
    variant: VARIANTS[algo],
    code: GRAPH_CODE[algo],
    notes: GRAPH_NOTES[algo],
    legend: LEGENDS[algo],
    complexity: algo === "dijkstra" ? "O((V + E) log V) with a binary heap" : "O(V + E)",
    frames: collect(gen),
  };
}

// ---------- graph presets ----------

export const PRESET_GRAPH: Graph = {
  nodes: [
    { id: "A", pos: [-4.5, 2.2, 0] },
    { id: "B", pos: [-1.6, 3.2, -0.6] },
    { id: "C", pos: [-2.2, 0, 0.6] },
    { id: "D", pos: [1.2, 1.4, 0] },
    { id: "E", pos: [-4, -2.2, -0.4] },
    { id: "F", pos: [0.6, -1.6, 0.8] },
    { id: "G", pos: [4, 2.8, -0.5] },
    { id: "H", pos: [4.4, -0.4, 0.3] },
    { id: "I", pos: [2.6, -3, -0.4] },
  ],
  edges: [
    { a: "A", b: "B", w: 4 },
    { a: "A", b: "C", w: 2 },
    { a: "A", b: "E", w: 7 },
    { a: "B", b: "D", w: 5 },
    { a: "C", b: "D", w: 8 },
    { a: "C", b: "E", w: 3 },
    { a: "C", b: "F", w: 9 },
    { a: "D", b: "F", w: 2 },
    { a: "D", b: "G", w: 6 },
    { a: "D", b: "H", w: 4 },
    { a: "F", b: "I", w: 3 },
    { a: "G", b: "H", w: 1 },
    { a: "H", b: "I", w: 5 },
  ],
};

/** A random connected graph: jittered grid positions, a random spanning tree, then a few extra short edges. */
export function randomGraph(n = 9): Graph {
  const cols = Math.ceil(Math.sqrt(n));
  const nodes = Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const pos: Vec3 = [
      (c - (cols - 1) / 2) * 3.2 + (Math.random() - 0.5) * 1.2,
      ((Math.ceil(n / cols) - 1) / 2 - r) * 2.6 + (Math.random() - 0.5) * 0.9,
      (Math.random() - 0.5) * 1.4,
    ];
    return { id: String.fromCharCode(65 + i), pos };
  });
  const dist = (a: number, b: number) => Math.hypot(nodes[a].pos[0] - nodes[b].pos[0], nodes[a].pos[1] - nodes[b].pos[1]);
  const w = () => 1 + Math.floor(Math.random() * 9);
  const edges: Graph["edges"] = [];
  const has = new Set<string>();
  const add = (a: number, b: number) => {
    const id = edgeId(nodes[a].id, nodes[b].id);
    if (has.has(id)) return;
    has.add(id);
    edges.push({ a: nodes[a].id, b: nodes[b].id, w: w() });
  };
  // Prim-style spanning tree connecting each new node to its nearest in-tree node.
  const inTree = [0];
  const rest = Array.from({ length: n - 1 }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  for (const v of rest) {
    const u = inTree.reduce((best, x) => (dist(x, v) < dist(best, v) ? x : best), inTree[0]);
    add(u, v);
    inTree.push(v);
  }
  for (let k = 0; k < Math.floor(n / 2); k++) {
    const a = Math.floor(Math.random() * n);
    const b = [...Array(n).keys()].filter((x) => x !== a).sort((x, y) => dist(a, x) - dist(a, y))[1 + Math.floor(Math.random() * 2)];
    if (b !== undefined) add(a, b);
  }
  return { nodes, edges };
}
