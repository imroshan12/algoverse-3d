/** Concept cards: the textbook summary shown next to each topic's visualisation. */
export interface Learn {
  idea: string;
  how: string[];
  complexity: { op: string; cost: string; note?: string }[];
  pitfalls: string[];
}

export const LEARN: Record<string, Learn> = {
  array: {
    idea: "A fixed block of memory holding elements side by side. The address of A[i] is base + i × element size, so any element can be reached directly.",
    how: [
      "Access by index is one address calculation, no scanning.",
      "Inserting at index i shifts every element from i onward one slot right, starting from the end so nothing is overwritten.",
      "Deleting at index i shifts every later element one slot left to close the gap.",
      "Searching an unsorted array means checking elements one by one.",
    ],
    complexity: [
      { op: "Access A[i]", cost: "O(1)" },
      { op: "Search (unsorted)", cost: "O(n)" },
      { op: "Insert / delete at the end", cost: "O(1)", note: "if there is spare capacity" },
      { op: "Insert / delete at index i", cost: "O(n)", note: "n − i elements shift" },
    ],
    pitfalls: [
      "When inserting, shift from the back towards i; shifting from the front overwrites values.",
      "Inserting at the front is the worst case: all n elements move.",
      "Dynamic arrays (ArrayList, Python list) double their capacity when full, so appending is O(1) amortised.",
    ],
  },
  stack: {
    idea: "A last-in, first-out (LIFO) collection: you only ever touch the top element.",
    how: [
      "push puts a value on top; pop removes the top value; peek reads it without removing it.",
      "An array-based stack keeps an index `top`, starting at −1 for an empty stack.",
      "Typical uses: undo, the function call stack, matching brackets, evaluating expressions, iterative DFS.",
    ],
    complexity: [
      { op: "push / pop / peek", cost: "O(1)" },
      { op: "Search", cost: "O(n)" },
    ],
    pitfalls: [
      "Pop on an empty stack is underflow; push on a full array stack is overflow.",
      "In postfix evaluation the first pop is the right operand: for a − b, b comes off first.",
      "Bracket matching fails if a closer meets an empty stack, or if openers remain at the end.",
    ],
  },
  queue: {
    idea: "A first-in, first-out (FIFO) collection: add at the rear, remove from the front. A circular array reuses freed slots by wrapping indices with mod N.",
    how: [
      "enqueue writes Q[rear] and moves rear = (rear + 1) mod N.",
      "dequeue reads Q[front] and moves front = (front + 1) mod N.",
      "A count (or one deliberately empty slot) tells a full queue apart from an empty one.",
      "Used for BFS, scheduling, buffering streams.",
    ],
    complexity: [
      { op: "enqueue / dequeue / peek", cost: "O(1)" },
      { op: "Space", cost: "O(N)", note: "fixed capacity" },
    ],
    pitfalls: [
      "Without wrap-around, a linear array queue runs out of room even when early slots are free.",
      "If you track only front and rear, front == rear is ambiguous: use a count or keep one slot empty (capacity N − 1).",
      "Exam traces of front/rear after a sequence of operations: apply mod N at every step.",
    ],
  },
  "linked-list": {
    idea: "A chain of nodes, each holding a value and a pointer to the next node. Nodes can live anywhere in memory; the pointers hold the list together.",
    how: [
      "Insert at the head in O(1): point the new node at the old head, then move head.",
      "Insert after node p: node.next = p.next first, then p.next = node.",
      "Delete the node after p by bypassing it: p.next = p.next.next.",
      "Reverse in place by walking prev / curr / next and flipping each pointer.",
    ],
    complexity: [
      { op: "Access i-th element", cost: "O(n)" },
      { op: "Search", cost: "O(n)" },
      { op: "Insert / delete at head", cost: "O(1)" },
      { op: "Insert / delete after a known node", cost: "O(1)" },
      { op: "Append without a tail pointer", cost: "O(n)" },
    ],
    pitfalls: [
      "Link the new node to the rest of the list before re-pointing p.next, or the rest is lost.",
      "When reversing, save curr.next before overwriting it.",
      "In a singly linked list you need the node before the one you delete.",
    ],
  },
  "hash-chaining": {
    idea: "A hash function maps each key to a bucket. Keys that collide share a linked list (a chain) in that bucket.",
    how: [
      "index = h(k), here k mod m.",
      "Search, insert and delete only look at the one chain the key hashes to.",
      "The load factor α = n / m is the average chain length.",
      "With a good hash function and small α, operations take constant time on average.",
    ],
    complexity: [
      { op: "Search / insert / delete", cost: "O(1 + α) average" },
      { op: "Worst case", cost: "O(n)", note: "every key in one chain" },
    ],
    pitfalls: [
      "A poor m (e.g. keys that are all multiples of m) sends everything into one bucket.",
      "Chaining still works when α > 1; open addressing cannot.",
      "Expected comparisons: about 1 + α/2 for a successful search, α for an unsuccessful one.",
    ],
  },
  "hash-open": {
    idea: "Every key is stored in the table itself. On a collision the key probes a fixed sequence of other slots until it finds a free one.",
    how: [
      "Linear probing tries h, h + 1, h + 2, …; quadratic tries h, h + 1, h + 4, h + 9, …; double hashing steps by a second hash h2(k).",
      "Search follows the same probe sequence and stops at an EMPTY slot.",
      "Delete leaves a DELETED marker (tombstone) so later searches keep probing past it.",
    ],
    complexity: [
      { op: "Search / insert", cost: "O(1) average", note: "when α is well below 1" },
      { op: "Unsuccessful search", cost: "≈ 1 / (1 − α) probes", note: "uniform hashing" },
      { op: "Worst case", cost: "O(n)" },
    ],
    pitfalls: [
      "Linear probing suffers primary clustering: long runs of full slots grow and slow everything down.",
      "Quadratic probing may miss free slots unless m is prime and α ≤ 1/2.",
      "Marking a deleted slot EMPTY breaks searches for keys that probed past it.",
      "α must stay below 1: the table can't hold more keys than slots.",
    ],
  },
  searching: {
    idea: "Linear search checks every element. Binary search repeatedly halves a sorted range by comparing the target with the middle element.",
    how: [
      "Keep a range lo..hi that must contain the target if it exists.",
      "mid = ⌊(lo + hi) / 2⌋. If A[mid] = x, done.",
      "If A[mid] < x, the target can only be to the right: lo = mid + 1. Otherwise hi = mid − 1.",
      "When lo > hi the range is empty: the target is absent.",
    ],
    complexity: [
      { op: "Linear search", cost: "O(n)" },
      { op: "Binary search", cost: "O(log n)", note: "≤ ⌊log₂ n⌋ + 1 comparisons" },
    ],
    pitfalls: [
      "Binary search only works on sorted, randomly accessible data.",
      "Use lo = mid + 1 and hi = mid − 1; lo = mid can loop forever.",
      "With fixed-size integers, mid = lo + (hi − lo) / 2 avoids overflow.",
    ],
  },
  sorting: {
    idea: "Six classic ways to put values in order. They differ in comparisons, data moves, extra memory, and stability (whether equal keys keep their original order).",
    how: [
      "Bubble: swap adjacent out-of-order pairs; the largest value bubbles to the end each pass.",
      "Selection: find the minimum of the unsorted part and swap it to the front.",
      "Insertion: slide each new key left into the sorted prefix.",
      "Merge: split in half, sort both halves, merge them. Quick: partition around a pivot, then recurse. Heap: build a max-heap and repeatedly move the max to the end.",
    ],
    complexity: [
      { op: "Bubble", cost: "O(n²)", note: "O(n) best with early exit · stable" },
      { op: "Selection", cost: "O(n²)", note: "always · not stable · ≤ n − 1 swaps" },
      { op: "Insertion", cost: "O(n²)", note: "O(n) best · stable" },
      { op: "Merge", cost: "O(n log n)", note: "O(n) extra space · stable" },
      { op: "Quick", cost: "O(n log n) avg", note: "O(n²) worst · not stable" },
      { op: "Heap", cost: "O(n log n)", note: "in place · not stable" },
    ],
    pitfalls: [
      "Quicksort with the last element as pivot degrades to O(n²) on already-sorted input.",
      "Insertion sort is the best simple choice for nearly sorted data.",
      "Any comparison sort needs Ω(n log n) comparisons in the worst case.",
    ],
  },
  bst: {
    idea: "A binary tree where every node's left subtree holds smaller keys and its right subtree holds larger keys.",
    how: [
      "Search and insert walk down from the root, going left or right at each node.",
      "Delete: a leaf is removed; a node with one child is replaced by that child; a node with two children takes its in-order successor's key, and the successor is deleted instead.",
      "In-order traversal visits keys in sorted order.",
    ],
    complexity: [
      { op: "Search / insert / delete", cost: "O(h)" },
      { op: "Balanced (h ≈ log n)", cost: "O(log n)" },
      { op: "Degenerate (sorted inserts)", cost: "O(n)" },
      { op: "Any traversal", cost: "O(n)" },
    ],
    pitfalls: [
      "Inserting keys in sorted order builds a chain of height n.",
      "In-order + pre-order (or in-order + post-order) uniquely determine a binary tree; pre-order + post-order generally don't.",
      "The in-order successor of a node with a right child is the leftmost node of its right subtree.",
    ],
  },
  avl: {
    idea: "A self-balancing BST: at every node the heights of the left and right subtrees differ by at most 1.",
    how: [
      "Insert or delete as in a BST, then walk back up updating heights.",
      "Balance factor bf = height(left) − height(right). If |bf| = 2, rotate.",
      "LL → rotate right. RR → rotate left. LR → rotate the child left, then the node right. RL → the mirror image.",
    ],
    complexity: [
      { op: "Search / insert / delete", cost: "O(log n)", note: "guaranteed" },
      { op: "Height", cost: "≤ 1.44 log₂ n" },
      { op: "Rotations per insert", cost: "at most 1 (single or double)" },
      { op: "Rotations per delete", cost: "O(log n)" },
    ],
    pitfalls: [
      "Name the case by the path from the unbalanced node towards the new key: left child, then its left subtree = LL.",
      "After a rotation, recompute heights bottom-up (the lower node first).",
      "Minimum nodes in an AVL tree of height h: N(h) = N(h − 1) + N(h − 2) + 1.",
    ],
  },
  heap: {
    idea: "A complete binary tree stored in an array where every parent is ≤ its children (min-heap) or ≥ them (max-heap). The root is always the minimum (or maximum).",
    how: [
      "Children of index i are 2i + 1 and 2i + 2; its parent is ⌊(i − 1) / 2⌋.",
      "Insert: append at the end, then sift up while it beats its parent.",
      "Extract: move the last element to the root, then sift down towards the better child.",
      "Build: sift down every non-leaf, from the last one back to the root.",
    ],
    complexity: [
      { op: "Peek root", cost: "O(1)" },
      { op: "Insert / extract", cost: "O(log n)" },
      { op: "Build heap (bottom-up)", cost: "O(n)" },
      { op: "Heap sort", cost: "O(n log n)" },
    ],
    pitfalls: [
      "Bottom-up build is O(n), not O(n log n).",
      "A heap is not sorted: only parent/child order is guaranteed.",
      "In a max-heap the smallest element is always a leaf.",
    ],
  },
  trie: {
    idea: "A tree of characters where each root-to-node path spells a prefix. Words that share a prefix share nodes.",
    how: [
      "Insert walks (or creates) one node per character, then marks the last node as end-of-word.",
      "Search follows the characters and checks the end-of-word mark.",
      "startsWith only checks that the path exists.",
    ],
    complexity: [
      { op: "Insert / search / startsWith", cost: "O(L)", note: "L = word length, independent of word count" },
      { op: "Space", cost: "O(total characters)" },
    ],
    pitfalls: [
      "A path existing doesn't mean the word exists: \"ca\" is a prefix of \"car\" but not a word unless marked.",
      "Tries answer prefix queries (autocomplete) that hash tables can't.",
    ],
  },
  "graph-traversal": {
    idea: "BFS explores a graph level by level with a queue. DFS goes as deep as possible along each branch with recursion (a stack), then backtracks.",
    how: [
      "BFS: mark the start, enqueue it; repeatedly dequeue a vertex and enqueue its unvisited neighbours.",
      "DFS: visit a vertex, then recursively visit each unvisited neighbour.",
      "The edges used to discover new vertices (green) form a BFS or DFS tree.",
    ],
    complexity: [
      { op: "Time (adjacency list)", cost: "O(V + E)" },
      { op: "Time (adjacency matrix)", cost: "O(V²)" },
      { op: "Extra space", cost: "O(V)" },
    ],
    pitfalls: [
      "BFS finds shortest paths by number of edges in unweighted graphs; DFS does not.",
      "Mark vertices visited when they are enqueued, or they can be enqueued twice.",
      "Visit orders depend on neighbour order; exam questions usually fix it (alphabetical here).",
    ],
  },
  "shortest-paths": {
    idea: "Dijkstra greedily finalises the closest unfinished vertex. Bellman-Ford relaxes every edge |V| − 1 times and copes with negative weights.",
    how: [
      "Relax (u, v): if dist[u] + w < dist[v], a shorter path to v exists, so update dist[v].",
      "Dijkstra pulls the smallest tentative distance from a priority queue and never revisits a finalised vertex.",
      "Bellman-Ford makes |V| − 1 passes over all edges, then one more: any further improvement means a negative cycle.",
    ],
    complexity: [
      { op: "Dijkstra (binary heap)", cost: "O((V + E) log V)" },
      { op: "Bellman-Ford", cost: "O(V · E)" },
    ],
    pitfalls: [
      "Dijkstra can return wrong distances with negative edges, even without a negative cycle.",
      "With a reachable negative cycle, shortest paths are undefined.",
      "In an unweighted graph, plain BFS already gives shortest paths.",
    ],
  },
  mst: {
    idea: "A minimum spanning tree connects every vertex using |V| − 1 edges with the smallest possible total weight.",
    how: [
      "Prim grows one tree from a start vertex, always adding the cheapest edge that leaves the tree.",
      "Kruskal sorts all edges and keeps each one that joins two different components (tracked with union-find).",
      "Both are correct because of the cut property: the lightest edge across any cut is safe to add.",
    ],
    complexity: [
      { op: "Prim (binary heap)", cost: "O(E log V)" },
      { op: "Kruskal", cost: "O(E log E)", note: "sorting dominates" },
    ],
    pitfalls: [
      "If all edge weights are distinct, the MST is unique.",
      "An MST is not a shortest-path tree: it minimises total weight, not distances from a source.",
      "Kruskal's skipped edges are exactly those that would close a cycle.",
    ],
  },
  "topo-sort": {
    idea: "An ordering of a DAG's vertices in which every edge u → v puts u before v, like scheduling tasks with prerequisites.",
    how: [
      "Kahn: repeatedly output a vertex with in-degree 0 and delete its outgoing edges.",
      "DFS: a vertex finishes only after all its descendants, so reversed finishing order is a valid order.",
      "If Kahn's algorithm can't output every vertex, the graph has a cycle.",
    ],
    complexity: [{ op: "Kahn or DFS-based", cost: "O(V + E)" }],
    pitfalls: [
      "Only DAGs have a topological order.",
      "A DAG can have many valid orders; tie-breaking decides which one you get.",
      "Counting valid orders is a common exam question: count choices at each in-degree-0 step.",
    ],
  },
  "dp-1d": {
    idea: "Dynamic programming solves a problem by combining answers to smaller overlapping subproblems, computing each answer once and storing it in a table.",
    how: [
      "Define the state, e.g. F[i] or dp[a] = fewest coins for amount a.",
      "Write the recurrence: F[i] = F[i − 1] + F[i − 2]; dp[a] = min over coins c of dp[a − c] + 1.",
      "Fill the table in an order where every dependency is already computed; read the answer from the last cell.",
    ],
    complexity: [
      { op: "Fibonacci (table)", cost: "O(n)", note: "O(1) space if you keep two values" },
      { op: "Fibonacci (plain recursion)", cost: "O(2ⁿ)" },
      { op: "Min coins", cost: "O(A × k)", note: "k coin types" },
    ],
    pitfalls: [
      "Plain recursion recomputes the same subproblems exponentially many times.",
      "Greedy coin change fails for coins like {1, 3, 4} and amount 6.",
      "Unreachable amounts stay ∞.",
    ],
  },
  "dp-lcs": {
    idea: "The longest common subsequence of two strings: characters that appear in both, in the same order, not necessarily next to each other.",
    how: [
      "L[i][j] = LCS length of the first i letters of X and the first j letters of Y.",
      "If X[i] = Y[j]: L[i][j] = L[i − 1][j − 1] + 1 (extend the diagonal).",
      "Otherwise L[i][j] = max(L[i − 1][j], L[i][j − 1]) (drop a letter from one string).",
      "Trace back from L[m][n] to read one LCS.",
    ],
    complexity: [
      { op: "Time", cost: "O(m × n)" },
      { op: "Space", cost: "O(m × n)", note: "O(min(m, n)) for the length only" },
    ],
    pitfalls: [
      "Subsequence ≠ substring: characters need not be contiguous.",
      "Several LCSs can have the same length; the traceback's tie-breaking picks one.",
      "Row 0 and column 0 are all zeros (an empty prefix).",
    ],
  },
  "dp-knapsack": {
    idea: "Pick items, each at most once, to maximise total value without exceeding capacity W.",
    how: [
      "K[i][c] = best value using only the first i items with capacity c.",
      "Skip item i: K[i − 1][c]. Take it (if it fits): v[i] + K[i − 1][c − w[i]].",
      "K[i][c] is the larger of the two. Tracing back, a change from the row above means the item was taken.",
    ],
    complexity: [
      { op: "Time and space", cost: "O(n × W)", note: "pseudo-polynomial" },
    ],
    pitfalls: [
      "Greedy by value/weight works for fractional knapsack, not 0/1.",
      "Reading from the previous row keeps each item single-use; reading from the same row gives the unbounded version.",
      "0/1 knapsack is NP-hard; this DP is only polynomial in the numeric value W.",
    ],
  },
  "bits-basics": {
    idea: "Every integer is stored as bits: bit i is worth 2^i. Bitwise operators work on all the bits at once, column by column, with no carries between columns.",
    how: [
      "To convert to binary, divide by 2 repeatedly; the remainders are the bits from bit 0 (rightmost) upwards.",
      "AND (&) gives 1 only where both bits are 1; OR (|) gives 1 where either is 1; XOR (^) gives 1 where they differ.",
      "NOT (~) flips every bit. For 8-bit unsigned values ~a = 255 − a.",
      "a << k moves every bit k places up, multiplying by 2^k; bits pushed past the top are lost.",
      "a >> k moves every bit k places down, dividing by 2^k and rounding down; the bits that fall off are the remainder.",
      "Group bits in fours to read hexadecimal: 1011 0101 = 0xB5.",
    ],
    complexity: [
      { op: "&, |, ^, ~, <<, >>", cost: "O(1)", note: "one CPU instruction on a whole word" },
      { op: "Decimal → binary by hand", cost: "O(log n)", note: "one division per bit" },
    ],
    pitfalls: [
      "Bit 0 is the rightmost bit. Reading remainders in the order you found them gives the bits backwards.",
      "Don't mix up & with && or | with ||: the logical operators return true/false, not bits.",
      "In C, Java and JavaScript, & and | bind more loosely than ==, so write (x & mask) == 0 with brackets.",
      "Shifting by the word size or more is undefined in C; Java and JavaScript use only the low 5 bits of the count, so 1 << 32 is 1.",
    ],
  },
  "bits-tricks": {
    idea: "A mask is a number with 1s only in the bits you care about. Combining it with AND, OR or XOR tests, sets, clears or flips exactly those bits.",
    how: [
      "1 << k is the mask for bit k alone.",
      "Test: (n & (1 << k)) != 0. Set: n | (1 << k). Clear: n & ~(1 << k). Toggle: n ^ (1 << k).",
      "n − 1 flips the lowest 1 bit to 0 and every 0 below it to 1.",
      "So n & (n − 1) clears the lowest 1 bit; it's 0 exactly when n has at most one 1 bit.",
      "n & −n keeps only the lowest 1 bit, because −n = ~n + 1 matches n up to that bit and is its opposite above.",
    ],
    complexity: [
      { op: "Test / set / clear / toggle bit k", cost: "O(1)" },
      { op: "Power-of-two test", cost: "O(1)" },
      { op: "Count set bits (Kernighan)", cost: "O(number of 1 bits)", note: "hardware popcount is O(1)" },
    ],
    pitfalls: [
      "Clearing needs the inverted mask: n & ~(1 << k), not n & (1 << k).",
      "n & (n − 1) == 0 is also true for n = 0, so the power-of-two test must check n > 0.",
      "Testing bit k: compare with != 0, not == 1, because n & (1 << k) equals 2^k when the bit is set.",
      "On a 32-bit int, 1 << 31 is negative; use 1L << k or unsigned types for high bits.",
    ],
  },
  "bits-xor": {
    idea: "Two's complement stores negative numbers so the ordinary adder still works: the top bit is worth −2^(w−1). XOR's cancelling rule x ^ x = 0 powers several classic tricks.",
    how: [
      "−n = ~n + 1: flip every bit, then add 1 (the carry ripples through the trailing 1s of ~n).",
      "An 8-bit signed value ranges from −128 (1000 0000) to 127 (0111 1111).",
      "An arithmetic right shift copies the sign bit into the top, so it divides negative numbers by 2^k rounding towards −∞.",
      "XOR is commutative and associative, x ^ x = 0 and x ^ 0 = x: pairs cancel wherever they appear.",
      "a + b = (a ^ b) + ((a & b) << 1): XOR adds without carries, AND << 1 is the carries. Repeat until the carry is 0.",
    ],
    complexity: [
      { op: "Negate, shift, XOR", cost: "O(1)" },
      { op: "Single number (XOR everything)", cost: "O(n) time", note: "O(1) space" },
      { op: "Add without +", cost: "O(word size) rounds" },
    ],
    pitfalls: [
      "The most negative value has no positive partner: −(−128) overflows back to −128.",
      "Flipping only the sign bit is sign-magnitude, not two's complement: 1001 0100 is −108, not −20.",
      "−5 >> 1 is −3 (rounds towards −∞), while integer division −5 / 2 is −2 in C and Java (truncates towards 0).",
      "XOR swap of a variable with itself zeroes it; in real code, a temporary variable is clearer and just as fast.",
    ],
  },
  "bits-subsets": {
    idea: "A set of n items has 2^n subsets, and each one is an n-bit number: bit i says whether item i is in. Counting from 0 to 2^n − 1 visits every subset exactly once.",
    how: [
      "Include item i: mask | (1 << i). Exclude it: mask & ~(1 << i). Test it: mask & (1 << i).",
      "Loop mask from 0 to (1 << n) − 1 and decode each mask to try every combination.",
      "Union is |, intersection is &, and the complement within n items is mask ^ ((1 << n) − 1).",
      "Bitmask DP stores results per subset, e.g. dp[mask] for travelling-salesman-style problems.",
    ],
    complexity: [
      { op: "Enumerate all subsets", cost: "O(2^n · n)" },
      { op: "Decode one mask", cost: "O(n)" },
      { op: "Union / intersection / membership", cost: "O(1)" },
    ],
    pitfalls: [
      "2^n grows fast: 20 items is about a million subsets, 30 items about a billion.",
      "Mask 0 is the empty set; don't skip it when it's a valid answer.",
      "Keep n below the word size (e.g. 31 for a signed int) or use a wider type.",
    ],
  },
};
