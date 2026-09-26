import type { AuxList, Callout, EdgeState, Frame, NodeState, Question, Run, Vec3 } from "./types";
import { adjacency, eid, Snapper, type Graph } from "./graph";
import { ask, collect } from "./util";

export type Graph2Algo = "bellman" | "prim" | "kruskal" | "kahn" | "topodfs";

export const GRAPH2_CODE: Record<Graph2Algo, string[]> = {
  bellman: [
    "BellmanFord(G, s):",
    "  dist[v] = ∞ for all v;  dist[s] = 0",
    "  repeat |V| - 1 times:",
    "    for each edge (u, v, w):",
    "      if dist[u] + w < dist[v]:",
    "        dist[v] = dist[u] + w",
    "    if nothing changed: stop early",
    "  for each edge (u, v, w):",
    "    if dist[u] + w < dist[v]: negative cycle!",
    "  return dist",
  ],
  prim: [
    "Prim(G, s):",
    "  inTree = {s};  PQ = edges leaving s",
    "  while PQ not empty and |inTree| < |V|:",
    "    (w, u, v) = PQ.extractMin()",
    "    if v in inTree: continue      // would form a cycle",
    "    add edge (u, v) to MST;  inTree += v",
    "    for each edge (v, x, w') with x not in inTree:",
    "      PQ.insert((w', v, x))",
  ],
  kruskal: [
    "Kruskal(G):",
    "  sort edges by weight",
    "  make each vertex its own set",
    "  for each edge (u, v, w) in sorted order:",
    "    if find(u) != find(v):",
    "      add (u, v) to MST",
    "      union(u, v)",
    "    else: skip           // same set: would form a cycle",
  ],
  kahn: [
    "Kahn(G):",
    "  compute indegree[v] for every v",
    "  Q = all v with indegree 0",
    "  while Q not empty:",
    "    u = Q.dequeue();  output u",
    "    for each edge (u, v):",
    "      indegree[v] = indegree[v] - 1",
    "      if indegree[v] == 0: Q.enqueue(v)",
    "  if fewer than |V| output: G has a cycle",
  ],
  topodfs: [
    "topoSortDFS(G):",
    "  for each v in G:              // alphabetical",
    "    if not visited[v]: visit(v)",
    "  return finish order reversed",
    "",
    "visit(u):",
    "  visited[u] = true",
    "  for each edge (u, v):",
    "    if not visited[v]: visit(v)",
    "  push u onto finish list      // after all descendants",
  ],
};

export const GRAPH2_VARIANTS: Record<Graph2Algo, string> = {
  bellman: "Bellman-Ford with possibly negative weights (undirected edges are relaxed in both directions). Edges are relaxed in the fixed order listed in the aux panel. Stops early if a full pass changes nothing, then does one extra pass to detect negative cycles.",
  prim: "Lazy Prim's algorithm on an undirected weighted graph: a priority queue of edges; stale edges whose both ends are already in the tree are skipped. Ties broken by weight then alphabetically.",
  kruskal: "Kruskal's algorithm with a union-find (disjoint set) structure. Edges sorted by weight, ties broken alphabetically.",
  kahn: "Kahn's algorithm for topological sorting of a DAG using in-degrees and a FIFO queue. Nodes with in-degree 0 are enqueued in alphabetical order.",
  topodfs: "DFS-based topological sort: run DFS from every unvisited vertex in alphabetical order, record each vertex when it finishes, and reverse the finish order.",
};

export const GRAPH2_NOTES: Record<Graph2Algo, string[]> = {
  bellman: [
    "Bellman-Ford relaxes every edge again and again. It is slower than Dijkstra but copes with negative weights.",
    "At the start only the source's distance is known.",
    "A shortest path uses at most |V| − 1 edges, so |V| − 1 rounds of relaxing every edge are always enough.",
    "Every edge gets a chance to improve its endpoint in each pass.",
    "Relaxation: is going through u shorter than the best path to v known so far?",
    "Yes: record the shorter distance, and remember u as v's predecessor.",
    "If a whole pass changes nothing, later passes can't either: stop early.",
    "After |V| − 1 passes every shortest path is known, unless a negative cycle keeps making paths cheaper.",
    "If an edge can still be relaxed, a negative cycle is reachable and 'shortest path' has no meaning.",
    "No negative cycle: these distances are final.",
  ],
  prim: [
    "Grow one tree from the start vertex, always adding the cheapest edge that leaves the tree.",
    "The tree starts as just s; its edges are the first candidates.",
    "Continue until every vertex is in the tree (or the candidates run out).",
    "The cheapest candidate edge comes out of the priority queue first.",
    "If both ends are already in the tree, the edge would close a cycle: skip it (lazy deletion).",
    "Cut property: the cheapest edge leaving the tree is always safe to add to an MST.",
    "The new vertex brings new candidate edges to vertices still outside the tree.",
    "Only edges to vertices outside the tree can ever be useful.",
  ],
  kruskal: [
    "Grow a forest: go through the edges from cheapest to most expensive, keeping each one that connects two separate pieces.",
    "Sorting the edges is the dominant cost: O(E log E).",
    "Union-find keeps track of which vertices are already connected.",
    "Look at the next cheapest edge.",
    "find returns each endpoint's set representative. Equal representatives mean the ends are already connected.",
    "Different sets: the edge joins two components without closing a cycle, so it belongs in the MST.",
    "Merge the two sets: their vertices are now connected.",
    "Same set: the ends are already connected, so this edge would close a cycle.",
  ],
  kahn: [
    "Repeatedly take a task that has no unfinished prerequisites.",
    "In-degree = number of edges pointing into a vertex = its unfinished prerequisites.",
    "Vertices with no prerequisites can go first.",
    "Continue while some vertex is ready.",
    "Output the vertex at the front of the queue.",
    "Its outgoing edges are prerequisites that are now satisfied.",
    "Remove the edge: v has one fewer prerequisite.",
    "Once v has no prerequisites left, it is ready too.",
    "If some vertices were never output, they are waiting on each other in a cycle.",
  ],
  topodfs: [
    "Run DFS and note when each vertex finishes; reversing that order gives a topological order.",
    "Start a DFS from every vertex not yet visited (alphabetical order here), so every part of the graph is covered.",
    "Vertices that an earlier DFS already reached are skipped.",
    "Each vertex finishes after everything reachable from it, so in reverse finish order every edge points forward.",
    "",
    "Explore everything reachable from u.",
    "Mark u visited as soon as we arrive.",
    "Follow each outgoing edge.",
    "Explore an unvisited successor first (go deeper).",
    "Everything reachable from u has finished, so u finishes now.",
  ],
};

const LEGENDS2: Record<Graph2Algo, Run["legend"]> = {
  bellman: { found: "source", pending: "distance improved", visited: "final distance", idle: "not reached yet" },
  prim: { visited: "in the tree", pending: "reachable by a candidate edge", idle: "not reached yet" },
  kruskal: { visited: "touched by an MST edge", idle: "no MST edge yet" },
  kahn: { pending: "ready, in the queue", current: "being output", visited: "output", idle: "waiting on prerequisites" },
  topodfs: { current: "current call", pending: "on the call stack", visited: "finished", idle: "not visited yet" },
};

const COMPLEXITY2: Record<Graph2Algo, string> = {
  bellman: "O(V · E)",
  prim: "O(E log V) with a binary heap",
  kruskal: "O(E log E), sorting dominates",
  kahn: "O(V + E)",
  topodfs: "O(V + E)",
};

const INF = Infinity;
const fmt = (d: number) => (d === INF ? "∞" : String(d));

function* bellman(g: Graph, s: string): Generator<Frame> {
  const S = new Snapper(g, true);
  // An undirected edge can be used both ways, so relax it in both directions.
  const edgeList = g.directed ? g.edges : g.edges.flatMap((e) => [e, { a: e.b, b: e.a, w: e.w }]);
  const labels = g.nodes.map((n) => n.id);
  const dist: Record<string, number> = Object.fromEntries(labels.map((l) => [l, INF]));
  const parent: Record<string, string> = {};
  const state: Record<string, NodeState> = {};
  let edges: Record<string, EdgeState> = {};
  let flows: Record<string, string> = {};
  let qLeft = 5;
  const subs = () => Object.fromEntries(labels.map((l) => [l, `d=${fmt(dist[l])}`]));
  const treeEdges = () => Object.fromEntries(Object.entries(parent).map(([v, u]) => [eid(g, u, v), "tree" as EdgeState]));
  const treeFlows = () => Object.fromEntries(Object.entries(parent).map(([v, u]) => [eid(g, u, v), u]));
  let pass = 0;
  const aux = () => [
    { label: "Edge order", items: edgeList.map((e) => `${e.a}→${e.b}(${e.w})`) },
    { label: "Pass", items: [pass ? `${pass} of ${labels.length - 1}` : "–"] },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, subs(), { callouts, flows });

  yield snap(0, `Bellman-Ford from ${s}. Instead of picking vertices greedily like Dijkstra, it relaxes every edge, pass after pass. That's why negative weights are fine.`);
  dist[s] = 0;
  state[s] = "found";
  yield snap(1, `dist[${s}] = 0; every other distance starts at ∞.`);
  for (pass = 1; pass <= labels.length - 1; pass++) {
    let changed = false;
    yield snap(2, `Pass ${pass} of at most ${labels.length - 1}: try every edge once.`);
    for (const e of edgeList) {
      const id = eid(g, e.a, e.b);
      edges = { ...treeEdges(), [id]: "active" };
      flows = { ...treeFlows(), [id]: e.a };
      const can = dist[e.a] !== INF && dist[e.a] + e.w < dist[e.b];
      const q = dist[e.a] !== INF && qLeft > 0 ? (qLeft--, ask(`Edge ${e.a}→${e.b} (w=${e.w}): will dist[${e.b}] improve?`, can ? "Yes" : "No", ["Yes", "No"], `Going through ${e.a} costs dist[${e.a}] + ${e.w} = ${dist[e.a]} + ${e.w} = ${dist[e.a] + e.w}, compared with the current dist[${e.b}] = ${fmt(dist[e.b])}. ${can ? "That's smaller, so it improves." : "That's not smaller, so nothing changes."}`)) : undefined;
      if (dist[e.a] === INF) {
        yield snap(3, `Edge ${e.a}→${e.b}: ${e.a} hasn't been reached yet (∞), so there's nothing to pass on.`, [{ at: e.a, text: "∞: skip", tone: "info" }], q);
        continue;
      }
      const alt = dist[e.a] + e.w;
      if (q) yield snap(3, `Edge ${e.a}→${e.b} with weight ${e.w}. Can it improve dist[${e.b}]?`, undefined, q);
      yield snap(4, `Edge ${e.a}→${e.b} (weight ${e.w}): ${dist[e.a]} + ${e.w} = ${alt}, compared with dist[${e.b}] = ${fmt(dist[e.b])}.`, [{ at: e.b, text: can ? `${alt} < ${fmt(dist[e.b])} ✓` : `${alt} ≥ ${fmt(dist[e.b])} ✗`, tone: can ? "good" : "info" }]);
      if (can) {
        dist[e.b] = alt;
        parent[e.b] = e.a;
        state[e.b] = "pending";
        changed = true;
        edges = { ...treeEdges(), [id]: "active" };
        flows = { ...treeFlows(), [id]: e.a };
        yield snap(5, `Shorter path found: dist[${e.b}] = ${alt}, reached via ${e.a}.`);
      }
    }
    edges = treeEdges();
    flows = treeFlows();
    if (!changed) {
      yield snap(6, `Pass ${pass} changed nothing, so no later pass can change anything either. Stop early.`);
      break;
    }
  }
  yield snap(7, "One extra check: if any edge can still be relaxed, some cycle keeps making paths cheaper.");
  for (const e of edgeList) {
    if (dist[e.a] !== INF && dist[e.a] + e.w < dist[e.b]) {
      edges = { [eid(g, e.a, e.b)]: "active" };
      flows = { [eid(g, e.a, e.b)]: e.a };
      yield snap(8, `Edge ${e.a}→${e.b} can still be relaxed: a negative cycle is reachable. Going round it forever keeps lowering the cost, so shortest paths are undefined.`, [{ at: e.b, text: "negative cycle!", tone: "bad" }]);
      return;
    }
  }
  for (const l of labels) if (dist[l] !== INF) state[l] = "visited";
  yield snap(9, `No edge improves anything: no negative cycle. Final distances: ${labels.map((l) => `${l}=${fmt(dist[l])}`).join(", ")}.`);
}

function* prim(g: Graph, s: string): Generator<Frame> {
  const S = new Snapper(g, true);
  const adj = adjacency(g);
  const labels = g.nodes.map((n) => n.id);
  const inTree = new Set([s]);
  const state: Record<string, NodeState> = { [s]: "visited" };
  const edges: Record<string, EdgeState> = {};
  const flows: Record<string, string> = {};
  type PE = { w: number; u: string; v: string };
  let pq: PE[] = [];
  let total = 0;
  const cmp = (a: PE, b: PE) => a.w - b.w || a.u.localeCompare(b.u) || a.v.localeCompare(b.v);
  const aux = (): AuxList[] => [
    { label: "Candidate edges", items: [...pq].sort(cmp).map((e) => `${e.u}${e.v}:${e.w}`), tray: true },
    { label: "MST weight", items: [String(total)] },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, undefined, { callouts, flows });
  yield snap(0, `Prim's algorithm grows one tree from ${s}, always adding the cheapest edge that reaches a new vertex.`);
  for (const { v, w } of adj.get(s)!) pq.push({ w, u: s, v });
  for (const e of pq) state[e.v] = "pending";
  yield snap(1, `The tree is just {${s}}. Its edges become the first candidates.`, [{ at: s, text: "start", tone: "info" }]);
  while (pq.length && inTree.size < labels.length) {
    pq.sort(cmp);
    const valid = pq.find((e) => !inTree.has(e.v));
    yield snap(2, `${inTree.size} of ${labels.length} vertices are in the tree. Which candidate is cheapest?`, undefined, valid ? ask("Which edge will be added to the MST next?", `${valid.u}–${valid.v}`, pq.map((e) => `${e.u}–${e.v}`), `Prim adds the cheapest edge leaving the tree. The cheapest candidate that reaches a new vertex is ${valid.u}–${valid.v} (weight ${valid.w})${pq[0] !== valid ? "; cheaper candidates lead back into the tree and would close a cycle" : ""}.`) : undefined);
    const e = pq.shift()!;
    const id = eid(g, e.u, e.v);
    const prev = edges[id];
    edges[id] = "active";
    flows[id] = e.u;
    if (inTree.has(e.v)) {
      yield snap(4, `The cheapest candidate is ${e.u}–${e.v} (${e.w}), but ${e.v} is already in the tree: it would close a cycle. Skip it.`, [{ at: [e.u, e.v], text: "cycle ✗ skip", tone: "bad" }]);
      edges[id] = prev ?? "idle";
      continue;
    }
    yield snap(3, `The cheapest candidate is ${e.u}–${e.v} with weight ${e.w}.`, [{ at: [e.u, e.v], text: `cheapest: ${e.w}`, tone: "info" }]);
    inTree.add(e.v);
    total += e.w;
    edges[id] = "tree";
    state[e.v] = "visited";
    yield snap(5, `Add ${e.u}–${e.v}: ${e.v} joins the tree. Total weight so far: ${total}.`, [{ at: e.v, text: `${e.v} joins ✓`, tone: "good" }]);
    const added: string[] = [];
    for (const { v: x, w } of adj.get(e.v)!) {
      if (inTree.has(x)) continue;
      pq.push({ w, u: e.v, v: x });
      state[x] = "pending";
      added.push(`${e.v}${x}:${w}`);
    }
    yield snap(6, added.length ? `${e.v} brings new candidates: ${added.join(", ")}.` : `${e.v} has no edges to vertices outside the tree.`);
  }
  yield snap(2, inTree.size === labels.length ? `MST complete: ${labels.length - 1} edges, total weight ${total}.` : "The candidates ran out but some vertices are unreachable: the graph is disconnected.");
}

function* kruskal(g: Graph): Generator<Frame> {
  const S = new Snapper(g, true);
  const labels = g.nodes.map((n) => n.id);
  const parent: Record<string, string> = Object.fromEntries(labels.map((l) => [l, l]));
  const find = (x: string): string => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const sorted = [...g.edges].sort((a, b) => a.w - b.w || (a.a + a.b).localeCompare(b.a + b.b));
  const state: Record<string, NodeState> = {};
  const edges: Record<string, EdgeState> = {};
  let total = 0;
  let taken = 0;
  let qLeft = 5;
  let idx = -1;
  const sets = () => {
    const groups: Record<string, string[]> = {};
    for (const l of labels) (groups[find(l)] ??= []).push(l);
    return Object.values(groups).map((gr) => `{${gr.join(",")}}`);
  };
  const aux = () => [
    { label: "Sorted edges", items: sorted.map((e, i) => `${i === idx ? "▶" : ""}${e.a}${e.b}:${e.w}`) },
    { label: "Disjoint sets", items: sets() },
    { label: "MST weight", items: [String(total)] },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, undefined, { callouts });
  yield snap(0, "Kruskal's algorithm: go through the edges from cheapest to most expensive and keep every edge that joins two separate pieces.");
  yield snap(1, `Sort the ${sorted.length} edges by weight: ${sorted.map((e) => `${e.a}${e.b}(${e.w})`).join(", ")}.`);
  yield snap(2, `Each vertex starts as its own piece: ${labels.length} separate sets.`);
  for (const e of sorted) {
    idx++;
    const id = eid(g, e.a, e.b);
    edges[id] = "active";
    const ra = find(e.a);
    const rb = find(e.b);
    const ok = ra !== rb;
    if (qLeft > 0) {
      qLeft--;
      yield snap(3, `Next cheapest edge: ${e.a}–${e.b} (${e.w}). Will it be added?`, undefined, ask(`Will ${e.a}–${e.b} be added to the MST?`, ok ? "Yes" : "No (cycle)", ["Yes", "No (cycle)"], ok ? `${e.a} and ${e.b} are in different components (find gives ${ra} and ${rb}), so the edge can't close a cycle. It's the cheapest remaining edge, so Kruskal takes it.` : `${e.a} and ${e.b} are already connected through cheaper edges (both in ${ra}'s set). Adding ${e.a}–${e.b} would close a cycle.`));
    }
    yield snap(4, `Edge ${e.a}–${e.b} (${e.w}): are ${e.a} and ${e.b} already connected? find(${e.a}) = ${ra}, find(${e.b}) = ${rb}.`, [{ at: [e.a, e.b], text: ok ? `${ra} ≠ ${rb}: different sets` : `both in ${ra}'s set`, tone: ok ? "good" : "bad" }]);
    if (ok) {
      edges[id] = "tree";
      state[e.a] = state[e.b] = "visited";
      total += e.w;
      taken++;
      parent[ra] = rb;
      yield snap(6, `Different pieces, so the edge can't close a cycle: add it and merge the two sets. MST weight ${total}, ${taken} of ${labels.length - 1} edges.`, [{ at: [e.a, e.b], text: `add +${e.w}`, tone: "good" }]);
      if (taken === labels.length - 1) {
        idx = -1;
        yield snap(3, `${taken} edges = |V| − 1: every vertex is connected. The MST is complete with weight ${total}.`);
        return;
      }
    } else {
      edges[id] = "idle";
      yield snap(7, `${e.a} and ${e.b} are already connected through earlier edges, so this one would close a cycle. Skip it.`, [{ at: [e.a, e.b], text: "cycle ✗ skip", tone: "bad" }]);
    }
  }
  yield snap(3, "Out of edges. The graph is disconnected, so the result is a minimum spanning forest.");
}

function* kahn(g: Graph): Generator<Frame> {
  const S = new Snapper(g, false);
  const adj = adjacency(g);
  const labels = g.nodes.map((n) => n.id);
  const indeg: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0]));
  const state: Record<string, NodeState> = {};
  const edges: Record<string, EdgeState> = {};
  const Q: string[] = [];
  const out: string[] = [];
  const subs = () => Object.fromEntries(labels.map((l) => [l, `in=${indeg[l]}`]));
  const aux = (): AuxList[] => [
    { label: "Queue", items: [...Q], tray: true },
    { label: "Output", items: [...out], tray: true },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, subs(), { callouts });
  yield snap(0, "Kahn's algorithm: repeatedly output a vertex whose prerequisites are all done, then cross it off everyone else's list.");
  for (const e of g.edges) indeg[e.b]++;
  yield snap(1, "Count each vertex's incoming edges (its unfinished prerequisites): the 'in=' labels.");
  for (const l of [...labels].sort()) if (indeg[l] === 0) (Q.push(l), (state[l] = "pending"));
  yield snap(2, `${Q.join(", ") || "Nothing"} ${Q.length === 1 ? "has" : "have"} no prerequisites, so ${Q.length === 1 ? "it goes" : "they go"} into the queue.`, Q.map((l) => ({ at: l, text: "ready", tone: "good" as const })));
  while (Q.length) {
    yield snap(3, `${Q.length} vertex${Q.length === 1 ? " is" : "es are"} ready. The queue decides which goes first.`, undefined, out.length ? ask("Which vertex is output next?", Q[0], labels.filter((l) => !out.includes(l)), `The ready vertices wait in a FIFO queue: ${Q.join(", ")}. ${Q[0]} became ready first, so it is output next.`) : undefined);
    const u = Q.shift()!;
    out.push(u);
    state[u] = "current";
    yield snap(4, `Output ${u}: position ${out.length} in the order.`, [{ at: u, text: `#${out.length}`, tone: "good" }]);
    for (const { v } of adj.get(u)!) {
      const id = eid(g, u, v);
      edges[id] = "active";
      indeg[v]--;
      const ready = indeg[v] === 0;
      yield snap(6, `${u} is done, so remove ${u}→${v}: ${v} now waits on ${indeg[v]} prerequisite${indeg[v] === 1 ? "" : "s"}.`, [{ at: v, text: ready ? "in = 0 → ready!" : `in = ${indeg[v]}`, tone: ready ? "good" : "info" }]);
      edges[id] = "tree";
      if (ready) {
        Q.push(v);
        state[v] = "pending";
        yield snap(7, `${v} has no prerequisites left: it joins the queue.`);
      }
    }
    state[u] = "visited";
  }
  yield snap(8, out.length === labels.length ? `Topological order: ${out.join(" → ")}.` : `Only ${out.length} of ${labels.length} vertices were output: the rest wait on each other in a cycle.`);
}

function* topoDfs(g: Graph): Generator<Frame> {
  const S = new Snapper(g, false);
  const adj = adjacency(g);
  const labels = [...g.nodes.map((n) => n.id)].sort();
  const state: Record<string, NodeState> = {};
  const edges: Record<string, EdgeState> = {};
  const visited = new Set<string>();
  const stack: string[] = [];
  const finish: string[] = [];
  const aux = (): AuxList[] => [
    { label: "Call stack", items: [...stack], tray: true },
    { label: "Finish order", items: [...finish], tray: true },
  ];
  const snap = (line: number, msg: string, callouts?: Callout[], q?: Question) => S.snap(line, msg, state, edges, aux(), q, undefined, { callouts });
  yield snap(0, "DFS-based topological sort: a vertex finishes only after everything reachable from it has finished, so the reversed finish order puts every edge forwards.");
  function* visit(u: string): Generator<Frame> {
    visited.add(u);
    stack.push(u);
    state[u] = "current";
    yield snap(6, `Visit ${u}.`, [{ at: u, text: "visit", tone: "info" }]);
    for (const { v } of adj.get(u)!) {
      const id = eid(g, u, v);
      edges[id] = "active";
      if (!visited.has(v)) {
        edges[id] = "tree";
        state[u] = "pending";
        yield snap(8, `Edge ${u}→${v}: ${v} is unvisited, so explore it first. ${u} waits on the call stack.`, [{ at: v, text: "go deeper", tone: "good" }]);
        yield* visit(v);
        state[u] = "current";
      } else {
        yield snap(7, `Edge ${u}→${v}: ${v} is already visited.`, [{ at: v, text: "already visited", tone: "info" }]);
        edges[id] = "idle";
      }
    }
    stack.pop();
    finish.push(u);
    state[u] = "visited";
    yield snap(9, `Everything reachable from ${u} is done, so ${u} finishes (#${finish.length}).`, [{ at: u, text: `finish #${finish.length}`, tone: "good" }]);
  }
  for (const l of labels) {
    if (visited.has(l)) {
      yield snap(2, `${l} was already reached by an earlier DFS: skip it.`);
      continue;
    }
    yield snap(1, `${l} hasn't been visited: start a DFS from it.`);
    yield* visit(l);
  }
  yield snap(3, `Reverse the finish order: ${[...finish].reverse().join(" → ")}.`);
}

export function runGraph2(g: Graph, algo: Graph2Algo, start: string): Run {
  const gen = algo === "bellman" ? bellman(g, start) : algo === "prim" ? prim(g, start) : algo === "kruskal" ? kruskal(g) : algo === "kahn" ? kahn(g) : topoDfs(g);
  const names: Record<Graph2Algo, string> = { bellman: `Bellman-Ford from ${start}`, prim: `Prim's MST from ${start}`, kruskal: "Kruskal's MST", kahn: "Topological sort (Kahn)", topodfs: "Topological sort (DFS)" };
  return { title: names[algo], variant: GRAPH2_VARIANTS[algo], code: GRAPH2_CODE[algo], notes: GRAPH2_NOTES[algo], legend: LEGENDS2[algo], complexity: COMPLEXITY2[algo], frames: collect(gen) };
}

// ---------- presets ----------

const P = (x: number, y: number, z = 0): Vec3 => [x, y, z];

export const NEG_GRAPH: Graph = {
  directed: true,
  nodes: [
    { id: "S", pos: P(-5, 0, 0) },
    { id: "A", pos: P(-1.5, 2.6, -0.4) },
    { id: "B", pos: P(3.8, 2.4, 0.3) },
    { id: "C", pos: P(1.4, 0, 0.5) },
    { id: "D", pos: P(-0.5, -2.8, 0) },
    { id: "E", pos: P(-3.8, -3, -0.3) },
  ],
  edges: [
    { a: "S", b: "A", w: 10 },
    { a: "S", b: "E", w: 8 },
    { a: "A", b: "C", w: 2 },
    { a: "B", b: "A", w: 1 },
    { a: "C", b: "B", w: -2 },
    { a: "D", b: "A", w: -4 },
    { a: "D", b: "C", w: -1 },
    { a: "E", b: "D", w: 1 },
  ],
};

export const NEG_CYCLE_GRAPH: Graph = {
  ...NEG_GRAPH,
  edges: NEG_GRAPH.edges.map((e) => (e.a === "B" && e.b === "A" ? { ...e, w: -1 } : e)),
};

export const DAG: Graph = {
  directed: true,
  nodes: [
    { id: "A", pos: P(-6, 2) },
    { id: "B", pos: P(-6, -2) },
    { id: "C", pos: P(-2.5, 1.2, 0.4) },
    { id: "D", pos: P(-2.5, -2.5, -0.3) },
    { id: "E", pos: P(1, 2.4) },
    { id: "F", pos: P(1.2, -1.2, 0.4) },
    { id: "G", pos: P(4.6, 2.2, -0.3) },
    { id: "H", pos: P(5, -1.6) },
  ],
  edges: [
    { a: "A", b: "C", w: 1 },
    { a: "B", b: "C", w: 1 },
    { a: "B", b: "D", w: 1 },
    { a: "C", b: "E", w: 1 },
    { a: "D", b: "F", w: 1 },
    { a: "E", b: "F", w: 1 },
    { a: "E", b: "G", w: 1 },
    { a: "F", b: "H", w: 1 },
    { a: "G", b: "H", w: 1 },
  ],
};

/** Random DAG: vertices in layers, edges only go left to right. */
export function randomDag(n = 8): Graph {
  const layers = 4;
  const nodes = Array.from({ length: n }, (_, i) => {
    const layer = Math.floor((i * layers) / n);
    const inLayer = Array.from({ length: n }, (_, k) => k).filter((k) => Math.floor((k * layers) / n) === layer);
    const pos = inLayer.indexOf(i);
    return { id: String.fromCharCode(65 + i), layer, pos: P(layer * 3.6 - 5.4, (pos - (inLayer.length - 1) / 2) * 3 + (Math.random() - 0.5), (Math.random() - 0.5) * 1.2) };
  });
  const edges: Graph["edges"] = [];
  for (const a of nodes)
    for (const b of nodes)
      if (b.layer === a.layer + 1 && Math.random() < 0.55) edges.push({ a: a.id, b: b.id, w: 1 });
  // Make sure every non-first-layer node has a prerequisite.
  for (const b of nodes) if (b.layer > 0 && !edges.some((e) => e.b === b.id)) edges.push({ a: nodes.filter((x) => x.layer === b.layer - 1)[0].id, b: b.id, w: 1 });
  return { directed: true, nodes: nodes.map(({ id, pos }) => ({ id, pos })), edges };
}
