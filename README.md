# AlgoVerse 3D

Learn data structures and algorithms by watching them run, one step at a time, in 3D.

AlgoVerse covers 23 topics, from arrays and linked lists to shortest paths, dynamic programming and bit manipulation. Every animation is produced by running the real algorithm, and every step is narrated: the matching pseudocode line lights up, a note explains why that line does what it does, and speech bubbles in the scene point at the values involved.

## Features

- **81 operations across 23 topics**, each with its own inputs and 70 presets in total for classic examples and edge cases.
- **Full playback control**: play, pause, step forward and back, scrub to any step, and change the speed from 0.5× to 4×.
- **Pseudocode panel** that highlights the running line, with a plain-English note for every line.
- **Narration** under the scene and **speech bubbles** in 3D, e.g. "45 > 30 → right" or "4 + 5 = 9 < ∞ ✓".
- **Step explained panel**: the line being run, what just happened, why, what happens next, the steps just before, and the exact variant of the algorithm on screen.
- **Questions during playback**: many steps ask "what happens next?". With *Pause for questions* ticked, playback waits for your answer and then shows the reasoning; untick it to play straight through.
- **138 practice questions** with step-by-step worked answers, at Easy, Medium and Hard levels for every topic.
- **Concept card** for every topic: the core idea, how it works, a complexity table and common pitfalls.
- **Readable 3D**: a fixed camera per run, colour-coded states with a legend, and trays that show hidden structures such as BFS queues, DFS call stacks and priority queues. Tick *Free camera* to orbit and zoom.
- **Runs entirely in the browser**: no backend and no sign-up.

## Topics

| Category | Topic | Operations |
|---|---|---|
| Linear structures | Array | access, insert at index (shift right), delete (shift left), linear search |
| | Stack | push, pop, peek, balanced brackets, postfix evaluation |
| | Queue (circular) | enqueue, dequeue on a ring buffer with wrap-around |
| | Linked list | insert at head / tail / position, delete, search, in-place reverse |
| | Hashing: chaining | insert, search, delete with `k mod 7` buckets |
| | Hashing: open addressing | linear / quadratic / double-hash probing, tombstone delete |
| Searching & sorting | Searching | binary search (lo / mid / hi) vs linear search |
| | Sorting | bubble, selection, insertion, merge (with visible temp array), quick (Lomuto), heap |
| Trees | Binary search tree | insert, search, delete (successor), pre / in / post / level-order |
| | AVL tree | insert and delete with LL / RR / LR / RL rotations, live balance factors |
| | Binary heap | min / max heap: insert (sift up), extract (sift down), bottom-up build; tree + array views |
| | Trie | insert, search, starts-with |
| Graphs | Graph traversal | BFS, DFS |
| | Shortest paths | Dijkstra, Bellman-Ford (negative edges, negative-cycle detection) |
| | Minimum spanning tree | Prim, Kruskal (union-find) |
| | Topological sort | Kahn (in-degrees), DFS finish order |
| Dynamic programming | Fibonacci & coin change | 1-D tables |
| | Longest common subsequence | 2-D table + traceback |
| | 0/1 knapsack | items × capacity table + traceback |
| Bit manipulation | Binary & bitwise operators | decimal → binary by division (+ hex), AND / OR / XOR / NOT column by column, `<<` and `>>` one place at a time with overflow and remainder bits falling off |
| | Bit tricks | check / set / clear / toggle bit k with a mask, power-of-two test `n & (n − 1)`, Kernighan's bit count, lowest set bit `n & −n` |
| | Two's complement & XOR | negation (`~n + 1` with a rippling carry, −128 edge case), arithmetic vs logical right shift, XOR swap, single number, addition without `+` |
| | Bitmask subsets | all 2ⁿ subsets by counting masks, brute-force subset sum, decoding a mask |

## Getting started

You need [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open the address the dev server prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check and build a static site into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm run check` | Run every operation of every topic headlessly and verify the results |

The build is a plain static site, so `dist/` can be hosted anywhere, e.g. GitHub Pages, Netlify or Vercel.

## Using it

1. Pick a topic from the sidebar (or the dropdown on small screens).
2. Enter your own values or choose a preset, then press an operation button.
3. Watch it play, or step through with the controls and the scrubber. Keyboard: <kbd>Space</kbd> plays and pauses, <kbd>←</kbd> and <kbd>→</kbd> step.
4. Follow along in the narration, the highlighted pseudocode and the *Step explained* panel.
5. In graph traversal, shortest paths and minimum spanning tree, click a vertex to start from it.
6. Test yourself with the practice questions at the bottom of the side panel; filter them by difficulty and press *Show answer* for a worked solution. Your answers are saved in this browser only (localStorage).

## Project structure

```
src/
  algorithms/    core types (Frame, Run), helpers, BST and graph algorithms
  topics/        one module per topic, plus concept cards (learn.ts) and practice questions (quiz.ts)
  components/    3D scene, camera layout, side panels and the practice-question panel
  usePlayer.ts   playback state: play, pause, step, scrub, questions
  App.tsx        page layout
scripts/
  check-topics.ts   the headless checks behind `npm run check`
```

## How it works

- **Algorithms are step generators.** Each `yield` produces an immutable `Frame`: node and edge states, pointer markers, the pseudocode line, a caption, side lists (queue, stack, output…) and an optional question. A run is collected into an array up front, so stepping backward is free and the animation is always the real algorithm.
- **A topic** (`src/topics/types.ts`) declares its input fields, operations and presets, and owns its data structure between runs. `src/topics/index.ts` is the registry, and the UI is generated from it.
- **One renderer** (`src/components/Scene.tsx`) draws every topic with [three.js](https://threejs.org/) through [React Three Fiber](https://r3f.docs.pmnd.rs/) and [drei](https://github.com/pmndrs/drei): spheres and boxes (bars, cells, slots, bits), tube edges with arrowheads and weights, pointer markers, speech bubbles and trays. Moving elements swing along arcs so swaps never pass through each other, nodes and edges grow in and shrink out, and edges fill from the vertex that explores them. The camera frames the whole run once, so it stays still while you step.

Built with React 19, TypeScript and Vite.

## Checks

`npm run check` runs every operation of every topic without a browser and verifies, among other things:

- every pseudocode line has an explanation, every speech bubble points at a real node, and there are no dangling edges;
- every question's answer is one of its options, and every topic has a concept card and practice questions at all three difficulty levels;
- all six sorting algorithms on 300 random arrays, Bellman-Ford distances and negative-cycle detection, equal Prim and Kruskal weights on 30 random graphs, and valid topological orders;
- for bit manipulation, that the registers drawn in the final step match JavaScript's own `& | ^ ~ << >> >>>`, negation, XOR swap, addition and subset enumeration on 120 random inputs plus edge cases (0, 255, −128).

## Adding a topic

1. Write a generator that yields `Frame`s for each operation (see `src/topics/array.ts` for a small example).
2. Wrap it in a `TopicDef`: input fields, operations, presets and a `view()` for the idle state.
3. Register it in `src/topics/index.ts`, and add a concept card to `src/topics/learn.ts` and practice questions to `src/topics/quiz.ts`.
4. Run `npm run check`.
