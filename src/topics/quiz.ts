/**
 * Hand-written practice questions for every topic, each with a worked explanation.
 * The correct option is always written first; the quiz panel shuffles options for display.
 */

export type Level = "Easy" | "Medium" | "Hard";

export interface QuizQ {
  q: string;
  options: string[];
  /** Index of the correct option in `options`. */
  answer: number;
  /** Worked explanation; one step per line. */
  explain: string;
  level: Level;
}

const mcq = (level: Level, q: string, correct: string, wrong: string[], explain: string[]): QuizQ => ({ q, options: [correct, ...wrong], answer: 0, explain: explain.join("\n"), level });

export const QUIZ: Record<string, QuizQ[]> = {
  array: [
    mcq("Easy", "An int array starts at address 1000 and each int takes 4 bytes. What is the address of A[7]?", "1028", ["1007", "1032", "1024"], [
      "address(A[i]) = base + i × element size.",
      "A[7] = 1000 + 7 × 4 = 1028.",
      "Indices start at 0, so 7 elements (A[0] to A[6]) come before A[7]. 1032 would be A[8].",
    ]),
    mcq("Easy", "An array holds n = 10 elements (indices 0–9) and has spare capacity. How many elements must shift to insert a new value at index 3?", "7", ["3", "6", "10"], [
      "Every element from index 3 to index 9 moves one slot right to open a gap at index 3.",
      "That's indices 3, 4, 5, 6, 7, 8 and 9: 10 − 3 = 7 shifts.",
      "In general, inserting at index i costs n − i shifts, so inserting at the front is the worst case (all n move).",
    ]),
    mcq("Easy", "Which operation is O(1) on an unsorted array with spare capacity?", "Append at the end", ["Insert at the front", "Search for a value", "Delete the first element"], [
      "Appending writes into slot n and increments n: nothing else moves.",
      "Inserting or deleting at the front shifts all n elements: O(n).",
      "Searching an unsorted array may have to look at every element: O(n).",
    ]),
    mcq("Easy", "Why is reading A[i] O(1) for an array but O(n) for the i-th node of a linked list?", "Array elements are contiguous, so A[i]'s address is computed directly", ["Arrays are always sorted", "Arrays keep a separate index table", "Linked lists are stored on disk"], [
      "Array elements sit back to back in memory, so address = base + i × size is a single calculation.",
      "Linked-list nodes can be anywhere in memory; the only way to reach node i is to follow i next-pointers from the head.",
    ]),
    mcq("Medium", "You must delete A[2] from an array whose order doesn't matter (it's used as a bag). What is the fastest way?", "Copy the last element into A[2], then decrease n by 1", ["Shift every later element one slot left", "Set A[2] to 0", "Sort the array, then remove it"], [
      "Since order doesn't matter, the gap can be filled by any element; the last one is free to move.",
      "One copy plus n = n − 1 makes the delete O(1) instead of O(n) shifts.",
      "Setting A[2] = 0 leaves a hole: the array would still claim to hold n elements.",
    ]),
    mcq("Hard", "A dynamic array starts with capacity 1 and doubles whenever it is full. How many element copies happen in total while appending 16 elements?", "15", ["8", "16", "120"], [
      "Resizes happen on the 2nd, 3rd, 5th and 9th appends (capacity 1 → 2 → 4 → 8 → 16).",
      "Each resize copies all current elements: 1 + 2 + 4 + 8 = 15 copies.",
      "That's fewer copies than appends, so each append costs O(1) amortised, even though a single append can cost O(n).",
    ]),
  ],

  stack: [
    mcq("Easy", "Starting with an empty stack: push 1, push 2, pop, push 3, push 4, pop, pop. What is left (bottom to top)?", "[1]", ["[1, 3]", "[3]", "[1, 2]"], [
      "push 1 → [1]",
      "push 2 → [1, 2]",
      "pop removes 2 → [1]",
      "push 3 → [1, 3], push 4 → [1, 3, 4]",
      "pop removes 4 → [1, 3], pop removes 3 → [1]",
    ]),
    mcq("Easy", "Which of these naturally uses a stack?", "Undo in a text editor", ["A printer's job list", "Breadth-first search", "Round-robin CPU scheduling"], [
      "Undo reverses the most recent change first: last in, first out.",
      "A printer serves jobs in arrival order, BFS explores in order of discovery and round-robin cycles through tasks in turn: all of those are queues (FIFO).",
    ]),
    mcq("Easy", "Which bracket string is balanced?", "{[()()]}", ["{[(])}", "(()", "{[}]"], [
      "Push every opener; each closer must match the opener on top of the stack, which is then popped.",
      "{[()()]}: every closer matches the top, and the stack ends empty. ✓",
      "{[(])}: at ']' the top is '(' — mismatch.",
      "(() ends with '(' still on the stack; {[}] fails at '}' because the top is '['.",
    ]),
    mcq("Medium", "Evaluate the postfix expression  6 2 3 + − 3 8 2 / + *", "7", ["1", "12", "−7"], [
      "Push numbers; an operator pops b (top) then a, and pushes a op b.",
      "6 2 3 + → 2 + 3 = 5, stack [6, 5]",
      "− → 6 − 5 = 1, stack [1]",
      "3 8 2 / → 8 / 2 = 4, stack [1, 3, 4]",
      "+ → 3 + 4 = 7, stack [1, 7]",
      "* → 1 × 7 = 7",
    ]),
    mcq("Medium", "Convert the infix expression A + B * C to postfix.", "A B C * +", ["A B + C *", "A B C + *", "+ A * B C"], [
      "* binds tighter than +, so B * C is computed first and then added to A.",
      "Postfix writes both operands, then the operator: B * C becomes B C *, and A + (…) becomes A (B C *) +.",
      "A B + C * would mean (A + B) * C; + A * B C is prefix notation.",
    ]),
    mcq("Hard", "The numbers 1, 2, 3, 4 are pushed in that order, and pops may happen at any time. Which output order is impossible?", "3 1 2 4", ["1 2 3 4", "4 3 2 1", "2 1 4 3"], [
      "To output 3 first, you must push 1, 2, 3 and pop 3.",
      "Now 2 sits on top of 1, so 1 can't come out before 2: 3 1 … is impossible.",
      "The others work, e.g. 2 1 4 3: push 1, push 2, pop, pop, push 3, push 4, pop, pop.",
    ]),
  ],

  queue: [
    mcq("Easy", "Which algorithm relies on a queue?", "Breadth-first search", ["Depth-first search (iterative)", "Evaluating a postfix expression", "Checking balanced brackets"], [
      "BFS must explore vertices in the order they were discovered, so the nearest ones are finished first: first in, first out.",
      "Iterative DFS, postfix evaluation and bracket matching all use a stack (LIFO).",
    ]),
    mcq("Easy", "Why does a circular queue advance its indices with (i + 1) mod N?", "So slots freed by dequeues at the front can be reused", ["To keep the elements sorted", "To make dequeue O(log n)", "To detect duplicate values"], [
      "Without wrapping, rear would run off the end of the array even when dequeues have freed slots at the start.",
      "mod N sends index N back to 0, so the array is used as a ring and every slot gets reused.",
      "Enqueue and dequeue both stay O(1).",
    ]),
    mcq("Medium", "A circular queue has N = 8 slots, front = 6 and count = 3. At which index does the next enqueue write?", "1", ["9", "0", "7"], [
      "The 3 elements sit at indices 6, 7 and 0 (wrapping past the end).",
      "The next free slot is (front + count) mod N = (6 + 3) mod 8 = 9 mod 8 = 1.",
      "Index 9 doesn't exist: mod N wraps it back to the start of the array.",
    ]),
    mcq("Medium", "N = 5, starting empty with front = rear = 0. After 4 enqueues, 3 dequeues and 3 more enqueues, what are front and count?", "front = 3, count = 4", ["front = 0, count = 4", "front = 3, count = 7", "front = 2, count = 4"], [
      "4 enqueues fill indices 0–3: front = 0, count = 4, rear = 4.",
      "3 dequeues advance front to 3: count = 1 (only index 3 remains).",
      "3 enqueues write at indices 4, 0 and 1 (wrapping): count = 4, rear = 2.",
      "Enqueues never move front, so front stays 3.",
    ]),
    mcq("Medium", "A circular queue stores only front and rear (rear = next free slot) and no count. Which test usually means 'full'?", "(rear + 1) mod N == front", ["rear == front", "rear == N − 1", "front == 0"], [
      "rear == front already means empty, so 'full' can't use the same test.",
      "The usual fix is to leave one slot unused: the queue is full when advancing rear would make it equal front.",
      "The alternative is a separate count, as this visualiser does, which lets all N slots be used.",
    ]),
    mcq("Hard", "A queue is built from two stacks: enqueue pushes onto S1; dequeue pops from S2, first moving every element of S1 onto S2 if S2 is empty. Starting empty: enqueue 1, 2, 3; dequeue; enqueue 4, 5; then dequeue three times. How many stack pushes and pops happen in total?", "19", ["15", "13", "22"], [
      "enqueue 1, 2, 3: 3 pushes onto S1.",
      "1st dequeue: S2 is empty, so pop 3, 2, 1 off S1 and push each onto S2 (6 operations, leaving 1 on top), then pop 1: 7 operations.",
      "enqueue 4, 5: 2 pushes onto S1.",
      "2nd and 3rd dequeues: S2 still holds 2 and 3, so just pop them: 2 operations.",
      "4th dequeue: S2 is empty again, so move 5 and 4 across (4 operations) and pop 4: 5 operations.",
      "Total: 3 + 7 + 2 + 2 + 5 = 19. Each element is pushed and popped at most twice, so every queue operation is O(1) amortised.",
    ]),
  ],

  "linked-list": [
    mcq("Easy", "A singly linked list has only a head pointer. Which operation is O(1)?", "Insert at the head", ["Insert at the tail", "Read the k-th node", "Delete the last node"], [
      "Insert at head: new.next = head, then head = new. Two pointer writes, whatever the length.",
      "Reaching the tail or the k-th node means walking the list: O(n).",
      "Deleting the last node needs the node before it, which also takes a walk.",
    ]),
    mcq("Medium", "To insert node x right after node p, which order of steps is correct?", "x.next = p.next; then p.next = x", ["p.next = x; then x.next = p.next", "x.next = p; then p.next = x", "p.next = x.next; then x.next = p"], [
      "First make x point at p's old successor, then point p at x.",
      "The other way round, p.next = x overwrites the only reference to the rest of the list; x.next = p.next would then make x point to itself.",
    ]),
    mcq("Medium", "Reversing 1 → 2 → 3 → 4 iteratively with prev, cur and next pointers (prev starts as null). After 2 iterations, which node is prev?", "Node 2", ["Node 1", "Node 3", "null"], [
      "Each iteration: next = cur.next; cur.next = prev; prev = cur; cur = next.",
      "Iteration 1: 1.next = null, prev = 1, cur = 2.",
      "Iteration 2: 2.next = 1, prev = 2, cur = 3.",
      "The reversed part is 2 → 1, and prev is its head.",
    ]),
    mcq("Medium", "How can you find the middle node of a singly linked list in one pass?", "Move a slow pointer 1 step and a fast pointer 2 steps until fast reaches the end", ["Count the nodes, then stop at n / 2 in the same pass", "Walk backwards from the tail", "Binary search on the node values"], [
      "When fast has covered the whole list, slow has covered half of it, so slow is at the middle.",
      "Counting first needs a second walk to reach n / 2.",
      "A singly linked list can't be walked backwards, and binary search needs random access.",
    ]),
    mcq("Medium", "Floyd's cycle detection moves slow 1 step and fast 2 steps at a time. What happens if the list has a cycle?", "fast eventually meets slow inside the cycle", ["fast reaches null", "slow reaches null", "They can never meet"], [
      "Once both pointers are inside the cycle, fast gains exactly one node on slow per step.",
      "The gap shrinks by 1 each step, so they must meet within one lap.",
      "Without a cycle, fast simply reaches null.",
    ]),
    mcq("Hard", "You only have a pointer to a node (not the last one) of a singly linked list, not the head. How do you delete that node?", "Copy the next node's value into it, then unlink the next node", ["Set the node to null", "Walk from the head to find its predecessor", "It can't be done"], [
      "Without the head you can't reach the predecessor to relink it.",
      "Instead, make this node become its successor: copy next's value, then node.next = node.next.next.",
      "It's O(1), but it can't work for the last node, which has no successor to copy.",
    ]),
  ],

  "hash-chaining": [
    mcq("Easy", "With h(k) = k mod 7, where do the keys 10, 17 and 24 go?", "All three in bucket 3", ["Buckets 3, 4 and 5", "Buckets 1, 2 and 3", "Bucket 0"], [
      "10 mod 7 = 3, 17 mod 7 = 3, 24 mod 7 = 3.",
      "They differ by 7, a multiple of the table size, so they collide.",
      "With chaining, bucket 3 simply holds a list of all three keys.",
    ]),
    mcq("Easy", "20 keys are stored in a table with 8 buckets. What is the load factor α?", "2.5", ["0.4", "8", "20"], [
      "α = n / m = number of keys / number of buckets = 20 / 8 = 2.5.",
      "With chaining α can exceed 1, because each bucket holds a list.",
      "Tables usually grow when α passes a threshold (Java's HashMap uses 0.75).",
    ]),
    mcq("Easy", "What is the worst-case time of a lookup in a hash table with chaining?", "O(n)", ["O(1)", "O(log n)", "O(n log n)"], [
      "If every key hashes to the same bucket, that chain holds all n keys and a lookup may walk all of them.",
      "The O(1) average assumes a good hash function and a bounded load factor.",
      "(Java's HashMap turns long chains into balanced trees to cap this at O(log n).)",
    ]),
    mcq("Medium", "n = 12 keys are spread evenly over m = 4 buckets. On average, how many keys does an unsuccessful search examine?", "3", ["12", "1", "6"], [
      "The load factor is α = n / m = 12 / 4 = 3 keys per bucket.",
      "A miss hashes to one bucket and checks every key in its chain: about α = 3 keys.",
      "That's why lookups cost O(1 + α): keep α small by growing the table.",
    ]),
    mcq("Medium", "A table with m = 10 buckets and h(k) = k mod 10 stores prices that all end in 0 (10, 20, 30, …). What happens?", "Every key lands in bucket 0", ["The keys spread evenly", "The table resizes automatically", "Lookups become O(log n)"], [
      "k mod 10 is the last decimal digit, and every key's last digit is 0.",
      "All keys share one chain, so lookups degrade to O(n).",
      "A prime table size (e.g. 11) or a better hash function breaks up such patterns.",
    ]),
    mcq("Hard", "m = 5 buckets, h(k) = k mod 5, separate chaining. Insert 12, 7, 22, 3, 17, 5. What is the average number of key comparisons for a successful search, taken over all 6 keys?", "2", ["1.2", "2.5", "4"], [
      "12, 7, 22 and 17 all go to bucket 2 (each leaves remainder 2); 3 goes to bucket 3; 5 goes to bucket 0.",
      "Finding the 4 keys of bucket 2's chain costs 1, 2, 3 and 4 comparisons: 10 in total. The two keys that are alone cost 1 each.",
      "Average = (10 + 1 + 1) / 6 = 12 / 6 = 2.",
      "Inserting at the head or the tail of a chain doesn't change this: the positions are 1 to 4 either way. (1.2 is the load factor 6 / 5: the average chain length, not the search cost.)",
    ]),
  ],

  "hash-open": [
    mcq("Easy", "Linear probing, m = 11, h(k) = k mod 11. Insert 22, 33, 44 into an empty table. Where does 44 go?", "Slot 2", ["Slot 0", "Slot 1", "Slot 4"], [
      "All three keys hash to slot 0 (they are multiples of 11).",
      "22 takes slot 0. 33 probes slot 0 (taken), then slot 1.",
      "44 probes slots 0 and 1 (both taken), then slot 2.",
    ]),
    mcq("Medium", "Same keys 22, 33, 44 in m = 11, but with quadratic probing: slot = (h(k) + i²) mod 11 for i = 0, 1, 2, … Where does 44 go?", "Slot 4", ["Slot 2", "Slot 3", "Slot 9"], [
      "22 → slot 0. 33 probes 0 (taken), then 0 + 1² = 1.",
      "44 probes 0 (taken), 0 + 1² = 1 (taken), then 0 + 2² = 4.",
      "The growing jumps let keys escape a crowded run faster than linear probing.",
    ]),
    mcq("Medium", "In open addressing, why is a deleted key marked with a tombstone (DELETED) instead of being set back to EMPTY?", "An EMPTY slot would stop later searches early, hiding keys stored past it", ["To save memory", "Because EMPTY slots can never be reused", "To keep the table sorted"], [
      "A search follows the same probe sequence as the insert did and stops at the first EMPTY slot.",
      "If a slot in the middle of a probe chain became EMPTY, keys placed after it would become unreachable.",
      "A tombstone tells searches to keep probing, and inserts may reuse it.",
    ]),
    mcq("Medium", "Assuming uniform hashing, an unsuccessful search at load factor α expects about 1 / (1 − α) probes. How many is that at α = 0.75?", "4", ["1.33", "0.75", "8"], [
      "1 / (1 − 0.75) = 1 / 0.25 = 4 probes.",
      "Intuition: each probe hits an occupied slot with probability α, so you keep probing until you find one of the empty 25%.",
      "As α approaches 1 this blows up, which is why open-addressing tables resize well before they are full. (Linear probing's clustering makes it worse: about 8.5 probes at 0.75.)",
    ]),
    mcq("Medium", "What does double hashing (a second hash function that sets each key's step size) mainly reduce?", "Clustering: keys piling up along the same probe sequences", ["The cost of computing the hash", "Memory use", "The need to track the load factor"], [
      "Linear probing uses step 1 for every key, so colliding keys form long runs (primary clustering).",
      "Quadratic probing breaks up those runs, but keys with the same home slot still follow identical sequences (secondary clustering).",
      "Double hashing gives each key its own step size, so their probe sequences diverge.",
    ]),
    mcq("Hard", "m = 7, h(k) = k mod 7, linear probing. Insert 10, 17, 24, 3, then delete 17 (its slot becomes a tombstone). How many slots does a search for 3 examine?", "4", ["2", "3", "1"], [
      "All four keys hash to slot 3, so they fill slots 3, 4, 5 and 6 in order: 10, 17, 24, 3.",
      "Deleting 17 turns slot 4 into a tombstone.",
      "Search for 3: slot 3 (10, no), slot 4 (tombstone, keep going), slot 5 (24, no), slot 6 (3, found): 4 slots.",
      "Had slot 4 been reset to EMPTY, the search would stop there after 2 slots and wrongly report that 3 is missing.",
    ]),
  ],

  searching: [
    mcq("Easy", "Binary search for 30 in [3, 8, 15, 21, 30, 42, 57] with lo = 0, hi = 6 and mid = ⌊(lo + hi) / 2⌋. Which indices are checked, in order?", "3, 5, 4", ["3, 4", "0, 3, 4", "3, 5, 6, 4"], [
      "mid = ⌊(0 + 6) / 2⌋ = 3: A[3] = 21 < 30, so lo = 4.",
      "mid = ⌊(4 + 6) / 2⌋ = 5: A[5] = 42 > 30, so hi = 4.",
      "mid = ⌊(4 + 4) / 2⌋ = 4: A[4] = 30. Found after 3 comparisons.",
    ]),
    mcq("Easy", "At most how many comparisons does binary search need on a sorted array of 1000 elements?", "10", ["500", "1000", "32"], [
      "Each comparison halves what's left: 1000 → 500 → 250 → 125 → 62 → 31 → 15 → 7 → 3 → 1.",
      "That's ⌊log₂ 1000⌋ + 1 = 10 comparisons in the worst case.",
      "Linear search might need all 1000.",
    ]),
    mcq("Easy", "What does binary search require?", "Sorted data with random (index) access", ["Sorted data in a linked list", "All values distinct", "An array whose length is a power of two"], [
      "Sorted order is what lets one comparison rule out half of the range.",
      "Jumping to the middle needs O(1) index access; in a linked list, reaching the middle costs O(n).",
      "Duplicates and any length are fine.",
    ]),
    mcq("Medium", "Why do many implementations write mid = lo + (hi − lo) / 2 instead of (lo + hi) / 2?", "lo + hi can overflow a fixed-size integer on huge arrays", ["It's faster", "It rounds up instead of down", "It makes it work on unsorted arrays"], [
      "With 32-bit ints, lo + hi can exceed 2³¹ − 1 on arrays of over about a billion elements, wrapping to a negative number.",
      "hi − lo never overflows, and adding half of it to lo gives the same midpoint.",
      "This bug sat unnoticed in Java's standard binary search for years.",
    ]),
    mcq("Medium", "To find the FIRST index of 4 in [2, 4, 4, 4, 7] with binary search, what should you do when A[mid] == 4?", "Record mid and continue left with hi = mid − 1", ["Return mid immediately", "Continue right with lo = mid + 1", "Switch to linear search"], [
      "Returning immediately could return any of the 4s (here the first mid is index 2).",
      "Recording mid and searching the left half keeps looking for an earlier 4.",
      "Trace: mid = 2 (4, record 2) → mid = 0 (2 < 4) → mid = 1 (4, record 1) → stop. The first 4 is at index 1.",
    ]),
    mcq("Hard", "Binary search with lo = 0, hi = n − 1 and mid = ⌊(lo + hi) / 2⌋ on a sorted array of n = 10 elements. How many elements does it inspect when the target is larger than every element, and when it is smaller than every element?", "4 when larger, 3 when smaller", ["4 in both cases", "3 in both cases", "5 when larger, 5 when smaller"], [
      "Larger than everything, so it always goes right: (0, 9) → mid 4; (5, 9) → mid 7; (8, 9) → mid 8; (9, 9) → mid 9; then lo = 10 > hi. 4 inspections.",
      "Smaller than everything, so it always goes left: (0, 9) → mid 4; (0, 3) → mid 1; (0, 0) → mid 0; then hi = −1 < lo. 3 inspections.",
      "Rounding mid down leaves the right part one element bigger than the left, so searches that keep going right can take one extra step. The worst case is ⌊log₂ 10⌋ + 1 = 4.",
    ]),
  ],

  sorting: [
    mcq("Easy", "After one pass of bubble sort on [5, 1, 4, 2, 8], what is the array?", "[1, 4, 2, 5, 8]", ["[1, 2, 4, 5, 8]", "[1, 5, 4, 2, 8]", "[5, 1, 4, 2, 8]"], [
      "Compare neighbours left to right, swapping when the left one is bigger:",
      "(5, 1) swap → [1, 5, 4, 2, 8]; (5, 4) swap → [1, 4, 5, 2, 8]; (5, 2) swap → [1, 4, 2, 5, 8]; (5, 8) no swap.",
      "The pass carries 5 right until it meets something bigger; the largest value, 8, ends in its final place.",
    ]),
    mcq("Easy", "Quicksort always picks the last element as the pivot. What is its running time on an already sorted array?", "O(n²)", ["O(n log n)", "O(n)", "O(log n)"], [
      "The last element is the maximum, so every partition puts all remaining elements on one side.",
      "The subproblems only shrink by 1 each time: n + (n − 1) + … + 1 = O(n²) comparisons.",
      "Random or median-of-three pivots avoid this worst case.",
    ]),
    mcq("Easy", "How many comparisons does insertion sort make on an already sorted array of n elements?", "n − 1", ["n² / 2", "n log n", "0"], [
      "Each new element is compared once with its left neighbour, is already in place, and stops.",
      "Elements 2 to n cost one comparison each: n − 1 in total, so the best case is O(n).",
      "That's why insertion sort is a good choice for nearly sorted data.",
    ]),
    mcq("Medium", "Which of these sorting algorithms is stable (equal keys keep their original order)?", "Merge sort", ["Quicksort (Lomuto partition)", "Heap sort", "Selection sort"], [
      "Merge sort takes from the left half when keys are equal, so equal keys never swap order.",
      "Quicksort's partition swaps, heap sort's sift-downs and selection sort's long-distance swaps can all jump an element over an equal one.",
    ]),
    mcq("Medium", "Merge sort on n = 8 elements: how many levels of merging are there?", "3", ["8", "4", "2"], [
      "The array is halved until the pieces have size 1: 8 → 4 → 2 → 1.",
      "That's log₂ 8 = 3 levels, and each level merges all 8 elements.",
      "So the total work is n log n = 8 × 3 = 24 element moves.",
    ]),
    mcq("Hard", "Build a max-heap from [4, 10, 3, 5, 1] with bottom-up heapify. What is the resulting array?", "[10, 5, 3, 4, 1]", ["[10, 4, 3, 5, 1]", "[1, 3, 4, 5, 10]", "[10, 5, 4, 3, 1]"], [
      "Sift down each internal node, from the last one (index 1) back to the root.",
      "Index 1 (10) is already larger than its children 5 and 1.",
      "Index 0 (4): swap with its larger child 10 → [10, 4, 3, 5, 1].",
      "4 is now at index 1 with children 5 and 1: swap with 5 → [10, 5, 3, 4, 1].",
    ]),
  ],

  bst: [
    mcq("Easy", "Insert 50, 30, 70, 20, 40, 60, 80 into an empty BST. What does an in-order traversal print?", "20 30 40 50 60 70 80", ["50 30 20 40 70 60 80", "20 40 30 60 80 70 50", "50 30 70 20 40 60 80"], [
      "In-order visits the left subtree, then the node, then the right subtree.",
      "In a BST, everything on the left is smaller and everything on the right is larger, so in-order always prints the keys in sorted order.",
      "The other options are pre-order, post-order and level order.",
    ]),
    mcq("Easy", "Same tree (50, 30, 70, 20, 40, 60, 80). What is its pre-order traversal?", "50 30 20 40 70 60 80", ["20 30 40 50 60 70 80", "20 40 30 60 80 70 50", "50 30 70 20 40 60 80"], [
      "Pre-order visits the node first, then its left subtree, then its right subtree.",
      "50, then the left subtree (30, 20, 40), then the right subtree (70, 60, 80).",
      "Inserting keys in pre-order rebuilds exactly the same tree, which makes it handy for copying.",
    ]),
    mcq("Easy", "What is the time to search a BST of height h?", "O(h)", ["O(n²)", "O(1)", "O(n log n)"], [
      "Each comparison moves one level down, so a search visits at most h + 1 nodes.",
      "In a balanced tree h ≈ log₂ n; in a degenerate chain h = n − 1, so O(h) can be O(n).",
    ]),
    mcq("Medium", "Same tree (50, 30, 70, 20, 40, 60, 80). Delete the root 50 using its in-order successor. Which key replaces it?", "60", ["40", "70", "80"], [
      "50 has two children, so it's replaced by its in-order successor: the smallest key in its right subtree.",
      "Go right to 70, then left as far as possible: 60.",
      "Copy 60 into the root and delete the old 60, a leaf. (The predecessor 40, the largest key on the left, would also work.)",
    ]),
    mcq("Medium", "Insert 1, 2, 3, 4, 5, 6, 7 in that order into an empty, unbalanced BST. How many nodes are on the longest root-to-leaf path?", "7", ["3", "4", "6"], [
      "Each key is larger than all previous ones, so it always goes right: the tree is a chain 1 → 2 → … → 7.",
      "The longest path contains all 7 nodes, and search becomes O(n).",
      "A balanced tree (AVL, red-black) holding these keys would have only 3 levels.",
    ]),
    mcq("Hard", "How many structurally different BSTs can store the keys {1, 2, 3}?", "5", ["6", "3", "8"], [
      "Try each key as the root.",
      "Root 1: 2 and 3 go right, in 2 possible shapes. Root 3: 2 shapes on the left. Root 2: 1 left, 3 right, 1 shape.",
      "2 + 1 + 2 = 5, the Catalan number C₃.",
      "It isn't 3! = 6 because different insertion orders can build the same tree: 2, 1, 3 and 2, 3, 1 both give root 2 with two leaves.",
    ]),
  ],

  avl: [
    mcq("Easy", "A node's left subtree has height 3 and its right subtree has height 1. What is its balance factor (left − right), and what does it mean?", "+2: it's unbalanced and needs a rotation", ["−2: it's unbalanced", "+2: that's still allowed", "4: it's unbalanced"], [
      "Balance factor = height(left) − height(right) = 3 − 1 = +2.",
      "AVL trees allow only −1, 0 or +1, so this node must be rebalanced.",
      "A positive factor means left-heavy, so the fix is a right rotation (or a left-right double rotation).",
    ]),
    mcq("Easy", "What is the worst-case time to search an AVL tree with n nodes?", "O(log n)", ["O(n)", "O(1)", "O(n log n)"], [
      "Rotations keep every node's two subtrees within one level of each other, so the height stays O(log n).",
      "A search walks one root-to-leaf path: O(log n) even in the worst case, unlike a plain BST.",
    ]),
    mcq("Medium", "Insert 10, 20, 30 into an empty AVL tree. What happens?", "A left rotation at 10; 20 becomes the root", ["A right rotation at 10; 20 becomes the root", "A left-right rotation; 30 becomes the root", "No rotation; 10 stays the root"], [
      "After inserting 30, node 10 has balance factor 0 − 2 = −2.",
      "The new key went right, then right again (the RR case), so one left rotation at 10 fixes it.",
      "20 becomes the root, with 10 on its left and 30 on its right.",
    ]),
    mcq("Medium", "Insert 30, 10, 20 into an empty AVL tree. Which case is it?", "Left-right: rotate left at 10, then right at 30", ["Left-left: one right rotation at 30", "Right-right: one left rotation at 30", "Right-left: rotate right at 10, then left at 30"], [
      "30 becomes unbalanced (+2) and the new key 20 went left (to 10), then right: the LR case.",
      "A single right rotation at 30 would just make the tree lean the other way.",
      "First rotate left at 10 (giving the LL shape 30 → 20 → 10), then rotate right at 30. 20 becomes the root.",
    ]),
    mcq("Hard", "What is the minimum number of nodes in an AVL tree of height 5 (a single node has height 1)?", "12", ["31", "16", "7"], [
      "The sparsest AVL tree of height h has subtrees of heights h − 1 and h − 2: N(h) = N(h − 1) + N(h − 2) + 1.",
      "N(1) = 1, N(2) = 2, N(3) = 4, N(4) = 7, N(5) = 12.",
      "These grow like Fibonacci numbers, which is why an AVL tree's height is at most about 1.44 log₂ n. (31 is the maximum: a perfect tree.)",
    ]),
  ],

  heap: [
    mcq("Easy", "In a 0-indexed array heap, where are the children of index 4?", "Indices 9 and 10", ["Indices 8 and 9", "Indices 5 and 6", "Indices 2 and 3"], [
      "The children of i are at 2i + 1 and 2i + 2: 2·4 + 1 = 9 and 2·4 + 2 = 10.",
      "The parent of i is ⌊(i − 1) / 2⌋, so both 9 and 10 lead back to 4.",
      "With 1-indexing the formulas become 2i and 2i + 1 instead.",
    ]),
    mcq("Medium", "Insert 5 into the min-heap [10, 20, 15, 40, 50, 30]. What is the array afterwards?", "[5, 20, 10, 40, 50, 30, 15]", ["[5, 10, 15, 20, 30, 40, 50]", "[10, 20, 15, 40, 50, 30, 5]", "[5, 10, 20, 40, 50, 30, 15]"], [
      "Append 5 at index 6, then sift it up.",
      "Its parent is index 2 (15): 5 < 15, swap → [10, 20, 5, 40, 50, 30, 15].",
      "Its new parent is index 0 (10): 5 < 10, swap → [5, 20, 10, 40, 50, 30, 15].",
      "5 is at the root, so stop. Only one root-to-leaf path was touched: O(log n).",
    ]),
    mcq("Medium", "Extract the minimum from the min-heap [5, 20, 10, 40, 50, 30, 15]. What is the array afterwards?", "[10, 20, 15, 40, 50, 30]", ["[15, 20, 10, 40, 50, 30]", "[10, 15, 20, 30, 40, 50]", "[20, 10, 15, 40, 50, 30]"], [
      "Remove the root 5 and move the last element, 15, to the root: [15, 20, 10, 40, 50, 30].",
      "Sift down: 15's smaller child is 10 (index 2), so swap → [10, 20, 15, 40, 50, 30].",
      "15's only child is now 30, which is larger, so stop.",
    ]),
    mcq("Medium", "What is the time to build a heap from n unsorted elements with bottom-up heapify?", "O(n)", ["O(n log n)", "O(log n)", "O(n²)"], [
      "Half the nodes are leaves and need no work; a quarter sift down at most 1 level, an eighth at most 2, and so on.",
      "n/4 · 1 + n/8 · 2 + n/16 · 3 + … adds up to less than n.",
      "Inserting the elements one at a time would cost O(n log n) instead.",
    ]),
    mcq("Medium", "Where is the largest element of a min-heap?", "Somewhere among the leaves", ["At the root", "At index 1", "At the last internal node"], [
      "Every parent is smaller than its children, so a node that has a child can't be the maximum.",
      "The maximum must be a leaf: one of the last ⌈n / 2⌉ positions in the array.",
      "Finding it takes O(n), so a min-heap doesn't help with max queries.",
    ]),
    mcq("Hard", "The max-heap [25, 14, 16, 13, 10, 8, 12] is stored 0-indexed. Insert 15, then delete the maximum. What is the array?", "[16, 15, 13, 14, 10, 8, 12]", ["[16, 15, 12, 14, 10, 8, 13]", "[16, 14, 13, 15, 10, 8, 12]", "[15, 16, 13, 14, 10, 8, 12]"], [
      "Insert 15 at index 7. Its parent is index 3 (13): 15 > 13, swap. The new parent is index 1 (14): 15 > 14, swap. The next parent is index 0 (25): stop.",
      "After the insert: [25, 15, 16, 14, 10, 8, 12, 13].",
      "Delete the maximum: remove 25 and move the last element, 13, to the root: [13, 15, 16, 14, 10, 8, 12].",
      "Sift down: 13's larger child is 16 (index 2), so swap → [16, 15, 13, 14, 10, 8, 12]. 13's children are now 8 and 12, both smaller: stop.",
    ]),
  ],

  trie: [
    mcq("Easy", "Insert car, cat and cart into an empty trie. How many nodes are there, not counting the root?", "5", ["10", "4", "7"], [
      "car creates c → a → r: 3 nodes.",
      "cat shares c → a and adds t: 1 node.",
      "cart shares c → a → r and adds t: 1 node.",
      "3 + 1 + 1 = 5: shared prefixes are stored only once.",
    ]),
    mcq("Easy", "A trie contains only the word 'cart'. What does search('car') return?", "false: the r node isn't marked as the end of a word", ["true: the path c-a-r exists", "true: every prefix of a stored word counts", "It depends on the insertion order"], [
      "search follows c → a → r successfully, then checks the end-of-word flag on r.",
      "Only t, the end of 'cart', has that flag, so the answer is false.",
      "startsWith('car') would return true: it only needs the path to exist.",
    ]),
    mcq("Medium", "What is the time to search a trie of n words for a word of length L?", "O(L)", ["O(log n)", "O(n)", "O(n · L)"], [
      "The search follows one child pointer per character: L steps.",
      "The number of stored words doesn't matter at all.",
      "A balanced BST of strings would need O(log n) string comparisons, each up to L characters long.",
    ]),
    mcq("Medium", "For which task does a trie clearly beat a hash set of words?", "Listing every word that starts with a given prefix", ["Checking whether one exact word exists", "Counting how many words are stored", "Storing the words in the least memory"], [
      "A trie walks down the prefix once, and every word below that node shares it: autocomplete costs O(prefix length + output).",
      "A hash set would have to scan every word to find the matches.",
      "For exact lookups a hash set is just as fast, and it usually uses less memory.",
    ]),
    mcq("Hard", "Each trie node has an array of 26 child pointers. A trie holding one 10-letter word has how many pointer slots in total, including the root?", "286", ["260", "10", "26"], [
      "A 10-letter word needs 10 nodes, plus the root: 11 nodes.",
      "Each node has 26 slots: 11 × 26 = 286, of which only 10 are used.",
      "That waste is why real tries often keep children in a hash map, or compress chains into single edges (radix tries).",
    ]),
  ],

  "graph-traversal": [
    mcq("Easy", "Undirected graph A–B, A–C, B–D, C–D, D–E. BFS from A, visiting neighbours in alphabetical order. What is the visit order?", "A B C D E", ["A B D C E", "A C B D E", "A B D E C"], [
      "Queue [A]. Visit A, enqueue B and C.",
      "Visit B, enqueue D. Visit C: its neighbour D is already queued.",
      "Visit D, enqueue E. Visit E.",
      "BFS goes by distance: A (0), then B and C (1), then D (2), then E (3).",
    ]),
    mcq("Easy", "What does BFS from s find in an unweighted graph?", "Shortest paths (fewest edges) from s to every reachable vertex", ["Shortest paths by total edge weight", "A minimum spanning tree", "A topological order"], [
      "BFS finishes every vertex at distance d before any at distance d + 1, so it first reaches each vertex along a shortest path.",
      "The BFS tree's parent pointers hold one shortest path to each vertex.",
      "With weighted edges this breaks down: use Dijkstra.",
    ]),
    mcq("Easy", "What is the running time of BFS or DFS on a graph stored as adjacency lists?", "O(V + E)", ["O(V²)", "O(V · E)", "O(E log V)"], [
      "Each vertex is visited once: O(V).",
      "Each adjacency list is scanned once, touching every edge once (directed) or twice (undirected): O(E).",
      "With an adjacency matrix, finding neighbours costs V per vertex, so O(V²).",
    ]),
    mcq("Medium", "Same graph (A–B, A–C, B–D, C–D, D–E). Recursive DFS from A, neighbours in alphabetical order. What is the visit order?", "A B D C E", ["A B C D E", "A C D B E", "A B D E C"], [
      "A → B (A's first neighbour) → D (B's first unvisited neighbour).",
      "D's neighbours are B (visited), C and E: go to C first.",
      "C's neighbours A and D are both visited, so backtrack to D, whose next unvisited neighbour is E.",
      "Order: A B D C E.",
    ]),
    mcq("Medium", "During DFS on an undirected graph you reach an already visited vertex that isn't the current vertex's parent. What does that tell you?", "The graph has a cycle", ["The graph is disconnected", "The graph is a tree", "The graph is bipartite"], [
      "That edge leads back to a vertex you'd already reached another way, so there are two different routes between the two vertices: a cycle.",
      "The parent is excluded because in an undirected graph the edge you just came along always leads back to it.",
    ]),
    mcq("Hard", "Directed graph A→B, A→C, B→D, D→A, C→D. DFS from A, neighbours in alphabetical order. How are the edges D→A and C→D classified?", "D→A is a back edge, C→D is a cross edge", ["D→A is a back edge, C→D is a forward edge", "D→A is a cross edge, C→D is a tree edge", "Both are back edges"], [
      "Discovery / finish times: A 1/8, B 2/5, D 3/4, C 6/7 (A → B → D, back up to A, then A → C).",
      "D→A: when D looks at A, A is still open (an ancestor on the current path), so it's a back edge. A back edge in a directed graph means a cycle: A → B → D → A.",
      "C→D: D had already finished before C was even discovered, and D isn't below C in the DFS tree, so it's a cross edge.",
      "A forward edge would lead down to an already finished descendant; D is not a descendant of C.",
    ]),
  ],

  "shortest-paths": [
    mcq("Easy", "Undirected edges A–B 4, A–C 1, C–B 2, B–D 5, C–D 8. In what order does Dijkstra from A settle the vertices?", "A, C, B, D", ["A, B, C, D", "A, C, D, B", "A, B, D, C"], [
      "Dijkstra always settles the unsettled vertex with the smallest tentative distance.",
      "A (0), then C (1), then B (3: improved from 4 via C), then D (8).",
      "Once settled, a vertex's distance never changes, as long as no edge is negative.",
    ]),
    mcq("Easy", "Bellman-Ford relaxes every edge once per pass. How many passes guarantee correct distances on a graph with V vertices and no negative cycles?", "V − 1", ["V", "E", "log V"], [
      "A shortest path never needs to repeat a vertex, so it has at most V − 1 edges.",
      "After pass k, every shortest path that uses at most k edges is correct, so V − 1 passes cover them all.",
      "Total cost: O(V · E).",
    ]),
    mcq("Medium", "Same graph (A–B 4, A–C 1, C–B 2, B–D 5, C–D 8). What is the shortest distance from A to D?", "8", ["9", "10", "13"], [
      "dist[C] = 1 (A–C).",
      "dist[B] = min(4 directly, 1 + 2 via C) = 3.",
      "dist[D] = min(1 + 8 via C, 3 + 5 via B) = 8.",
      "The shortest path is A → C → B → D.",
    ]),
    mcq("Medium", "Directed edges A→B 2, A→C 5, C→B −4. Why does Dijkstra from A get dist[B] wrong?", "It settles B at 2 before visiting C, but A → C → B costs 5 − 4 = 1", ["Negative edges disconnect the graph", "It loops forever", "It can't handle directed edges"], [
      "Dijkstra settles B first (2 < 5) and never looks at it again.",
      "Relaxing C → B later would give 5 + (−4) = 1 < 2, but B is already final.",
      "The greedy choice assumes paths only get longer as edges are added, which negative weights break. Bellman-Ford handles them.",
    ]),
    mcq("Medium", "How does Bellman-Ford detect a negative cycle?", "After V − 1 passes, some edge can still be relaxed", ["Some distance becomes negative", "Some vertex is never reached", "The queue becomes empty"], [
      "Without a negative cycle, every distance is final after V − 1 passes.",
      "If one more pass still improves a distance, some route keeps getting cheaper by going round a cycle: a negative cycle.",
      "A negative distance on its own is fine: negative edges can make a true shortest distance negative.",
    ]),
    mcq("Hard", "Bellman-Ford from A on the path A→B→C→D (every weight 1), relaxing the edges in the order C→D, B→C, A→B in every pass. How many passes change at least one distance?", "3", ["1", "2", "4"], [
      "Pass 1: C→D and B→C do nothing (C and B are still ∞); A→B sets dist[B] = 1.",
      "Pass 2: C→D still does nothing; B→C sets dist[C] = 2.",
      "Pass 3: C→D sets dist[D] = 3. A 4th pass would change nothing.",
      "With the edges listed as A→B, B→C, C→D, one pass would settle everything. V − 1 = 3 passes are needed because of worst-case edge orders like this one.",
    ]),
  ],

  mst: [
    mcq("Easy", "Edges A–B 1, B–C 2, A–C 3, C–D 4, B–D 5. What is the total weight of the minimum spanning tree?", "7", ["6", "8", "10"], [
      "Kruskal: take edges in weight order, skipping any that would close a cycle.",
      "A–B (1) ✓, B–C (2) ✓, A–C (3) ✗ (A and C are already connected), C–D (4) ✓.",
      "4 vertices need 3 edges, so stop: 1 + 2 + 4 = 7.",
    ]),
    mcq("Easy", "How many edges does a spanning tree of a connected graph with V vertices have?", "V − 1", ["V", "E − 1", "V / 2"], [
      "Start with V separate vertices. Each tree edge joins two separate pieces, reducing the count by 1.",
      "After V − 1 edges everything is connected; one more edge would create a cycle.",
    ]),
    mcq("Easy", "Which data structure lets Kruskal's algorithm check quickly whether an edge would form a cycle?", "Union-find (disjoint set union)", ["A stack", "A min-heap of vertices", "A trie"], [
      "Each connected piece is a set. Edge (u, v) closes a cycle exactly when find(u) == find(v).",
      "Otherwise union(u, v) merges the two pieces.",
      "With path compression and union by rank each operation is nearly O(1), so sorting the edges (O(E log E)) dominates.",
    ]),
    mcq("Medium", "Same graph (A–B 1, B–C 2, A–C 3, C–D 4, B–D 5). Prim's algorithm starts at D. In what order are edges added?", "C–D, B–C, A–B", ["A–B, B–C, C–D", "C–D, A–C, A–B", "B–D, A–B, B–C"], [
      "Prim grows a single tree, always adding the cheapest edge that leaves it.",
      "From {D}: C–D (4) beats B–D (5).",
      "From {D, C}: B–C (2) is the cheapest edge out.",
      "From {D, C, B}: A–B (1). Same total as Kruskal (7), in a different order.",
    ]),
    mcq("Medium", "If all edge weights are different, the minimum spanning tree is…", "unique", ["not necessarily unique", "always a path", "the same as the shortest-path tree"], [
      "With distinct weights, every cut has exactly one cheapest crossing edge, and the cut property says that edge is in every MST.",
      "So no choice is ever left open. Ties are what allow several MSTs with the same total.",
      "An MST also differs from a shortest-path tree: it minimises total weight, not the distances from one source.",
    ]),
    mcq("Hard", "A 4-cycle has edges A–B 1, B–C 2, C–D 2, D–A 2. How many different minimum spanning trees does it have, and what do they weigh?", "3 MSTs, each of weight 5", ["1 MST of weight 5", "4 MSTs, each of weight 5", "3 MSTs, each of weight 7"], [
      "A spanning tree of a cycle keeps every edge but one, so the cycle has 4 spanning trees.",
      "Dropping A–B (weight 1) leaves 2 + 2 + 2 = 6. Dropping any one of the three weight-2 edges leaves 1 + 2 + 2 = 5.",
      "So 3 different trees share the minimum weight 5. Equal weights are what allow several MSTs; with all weights distinct there would be exactly one.",
    ]),
  ],

  "topo-sort": [
    mcq("Easy", "Edges A→B, A→C, B→D, C→D. Kahn's algorithm, taking ready vertices in alphabetical order. What order results?", "A B C D", ["A C B D", "D B C A", "B A C D"], [
      "In-degrees: A 0, B 1, C 1, D 2. Start with A.",
      "Removing A frees B and C. Take B: D drops to 1.",
      "Take C: D drops to 0. Take D.",
      "Order: A B C D.",
    ]),
    mcq("Easy", "How many valid topological orders does that graph (A→B, A→C, B→D, C→D) have?", "2", ["1", "4", "24"], [
      "A has no incoming edges and must come first; D depends on both B and C, so it must come last.",
      "B and C don't depend on each other, so either can go first: A B C D or A C B D.",
    ]),
    mcq("Easy", "Which vertices does Kahn's algorithm put in its queue at the start?", "Every vertex with in-degree 0", ["Every vertex with out-degree 0", "The vertex with the most edges", "Only the first vertex"], [
      "A vertex with no incoming edges has no prerequisites, so it can go first.",
      "Each time a vertex is output, its outgoing edges are removed; any neighbour whose in-degree drops to 0 joins the queue.",
    ]),
    mcq("Medium", "Kahn's algorithm stops after outputting only 4 of the graph's 6 vertices. What does that mean?", "The graph has a cycle, so no topological order exists", ["The graph is disconnected", "The last 2 vertices can go in any order", "Nothing: Kahn's algorithm always outputs every vertex"], [
      "Vertices on a cycle wait for each other, so none of them ever reaches in-degree 0.",
      "They never enter the queue, and the output stops short.",
      "Comparing the output count with V is the standard cycle check.",
    ]),
    mcq("Medium", "In the DFS-based topological sort, when is a vertex added to the list?", "When it finishes (everything reachable from it is done); the list is reversed at the end", ["When it is first discovered", "When its in-degree becomes 0", "In alphabetical order"], [
      "A vertex finishes only after everything reachable from it has finished, so it lands after all of its dependants in the finish order.",
      "Reversing the finish order puts every vertex before the vertices that depend on it.",
      "Adding vertices when they're discovered doesn't work in general.",
    ]),
    mcq("Hard", "Edges A→C, B→C, B→D, C→E, D→E. DFS-based topological sort: start DFS from unvisited vertices in alphabetical order, visit neighbours alphabetically, then reverse the finish order. What order results?", "B D A C E", ["A B C D E", "E C A D B", "A C E B D"], [
      "DFS from A: A → C → E. E finishes, then C, then A.",
      "DFS from B: C is already done, so go B → D; E is done too. D finishes, then B.",
      "Finish order: E, C, A, D, B. Reversed: B D A C E.",
      "Every edge (A→C, B→C, B→D, C→E, D→E) points forward in B D A C E, so it's valid. Kahn's algorithm finds a different valid order, A B C D E. E C A D B is the finish order before reversing, and A C E B D is the discovery order.",
    ]),
  ],

  "dp-1d": [
    mcq("Easy", "With F(0) = 0 and F(1) = 1, what is F(10)?", "55", ["34", "89", "10"], [
      "Build up from the bottom: F(2) = 1, F(3) = 2, F(4) = 3, F(5) = 5, F(6) = 8, F(7) = 13, F(8) = 21, F(9) = 34.",
      "F(10) = F(9) + F(8) = 34 + 21 = 55.",
      "Each value takes one addition, so the table method is O(n).",
    ]),
    mcq("Easy", "Why is the naive recursive fib(n) so slow?", "It recomputes the same subproblems exponentially many times", ["Recursion is always slower than loops", "Adding big numbers is slow", "It needs O(n) memory"], [
      "fib(n) calls fib(n − 1) and fib(n − 2), and each of those calls both of its own again.",
      "fib(n − 2) is computed from scratch in both branches, and so on down: the call tree has about 1.6ⁿ nodes.",
      "Storing each result once (memoisation or a table) makes it O(n).",
    ]),
    mcq("Easy", "You can climb 1 or 2 stairs at a time. How many ways are there to climb 5 stairs?", "8", ["5", "13", "10"], [
      "The last move is either 1 stair or 2, so ways(n) = ways(n − 1) + ways(n − 2).",
      "ways(1) = 1, ways(2) = 2, ways(3) = 3, ways(4) = 5, ways(5) = 8.",
      "It's the Fibonacci sequence, shifted by one.",
    ]),
    mcq("Medium", "Coins {1, 3, 4}, amount 6. What is the minimum number of coins?", "2", ["3", "4", "6"], [
      "Greedy takes the biggest coin first: 4 + 1 + 1 = 3 coins.",
      "DP tries every possible last coin: best(6) = 1 + min(best(5), best(3), best(2)) = 1 + min(2, 1, 2) = 2.",
      "That's 3 + 3. Greedy fails for coin sets like this one.",
    ]),
    mcq("Medium", "Which two properties make a problem a good fit for dynamic programming?", "Overlapping subproblems and optimal substructure", ["Sorted input and random access", "A greedy choice and a heap", "Independent subproblems and recursion"], [
      "Optimal substructure: the best answer is built from best answers to smaller subproblems.",
      "Overlapping subproblems: the same subproblems come up again and again, so storing their answers pays off.",
      "Independent subproblems (as in merge sort) call for plain divide and conquer, not DP.",
    ]),
    mcq("Hard", "Coins {1, 2, 5}, amount 5. How many ways are there if the order of the coins doesn't matter, and how many if it does?", "4 and 9", ["4 and 4", "9 and 9", "3 and 8"], [
      "Order doesn't matter (combinations): {5}, {2, 2, 1}, {2, 1, 1, 1}, {1, 1, 1, 1, 1}: 4 ways.",
      "Order matters (sequences): ways(n) = ways(n − 1) + ways(n − 2) + ways(n − 5), with ways(0) = 1. That gives 1, 1, 2, 3, 5 for amounts 0 to 4, then ways(5) = 5 + 3 + 1 = 9.",
      "In code the only difference is the loop order: coins in the outer loop counts combinations; amounts in the outer loop counts sequences.",
    ]),
  ],

  "dp-lcs": [
    mcq("Easy", "Filling the LCS table, what is L[i][j] when x[i] ≠ y[j]?", "max(L[i−1][j], L[i][j−1])", ["L[i−1][j−1] + 1", "L[i−1][j−1]", "0"], [
      "If the last characters differ, at least one of them isn't part of the LCS.",
      "So drop the last character of x (L[i−1][j]) or of y (L[i][j−1]), and keep whichever is better.",
      "L[i−1][j−1] + 1 is the rule for matching characters.",
    ]),
    mcq("Easy", "What are the time and space costs of the standard LCS table for strings of lengths m and n?", "O(mn) time and O(mn) space", ["O(m + n) time and O(1) space", "O(2^(m+n)) time", "O(mn) time and O(1) space"], [
      "There are (m + 1)(n + 1) cells, each filled in O(1) from its neighbours.",
      "Keeping the whole table allows the traceback that recovers the subsequence.",
      "If you only need the length, two rows are enough: O(min(m, n)) space.",
    ]),
    mcq("Medium", "What is the length of the longest common subsequence of ABCBDAB and BDCABA?", "4", ["3", "5", "6"], [
      "BCBA appears in order in both: A[B][C][B]D[A]B and [B]D[C]A[B][A].",
      "Other LCSs of the same length exist, such as BDAB and BCAB.",
      "No common subsequence of length 5 exists; the DP table confirms L[7][6] = 4.",
    ]),
    mcq("Medium", "Which of these is a longest common subsequence of AGGTAB and GXTXAYB?", "GTAB", ["GXTB", "AGTB", "GTAYB"], [
      "GTAB appears in order in AGGTAB (G, T, A, B) and in GXTXAYB (G, T, A, B), and the table gives length 4.",
      "GXTB and GTAYB use X or Y, which AGGTAB doesn't contain.",
      "AGTB would need an A before a G in GXTXAYB, but its only A comes after its only G.",
    ]),
    mcq("Medium", "The edit distance (insert, delete or substitute one character, cost 1 each) from kitten to sitting is…", "3", ["2", "4", "6"], [
      "kitten → sitten (substitute k → s)",
      "sitten → sittin (substitute e → i)",
      "sittin → sitting (insert g)",
      "The DP table (the same shape as LCS's) confirms nothing shorter works.",
    ]),
    mcq("Hard", "X = ABAB and Y = BABA. What is the length of their longest common subsequence, and how many different LCS strings are there?", "Length 3, with 2 different strings (ABA and BAB)", ["Length 3, with just 1 string", "Length 4, with 1 string", "Length 2, with 4 strings"], [
      "The table gives L[4][4] = 3, so the LCS has length 3 (length 4 would need X = Y).",
      "ABA fits both: A-B-A at positions 1–3 of ABAB and 2–4 of BABA.",
      "BAB fits both: positions 2–4 of ABAB and 1–3 of BABA.",
      "No other length-3 string works (AAB, ABB, BBA and BAA each fail in one of the strings), so there are exactly 2. Tracebacks that break ties differently find different ones.",
    ]),
  ],

  "dp-knapsack": [
    mcq("Easy", "In the 0/1 knapsack table, what is K[i][c] when item i weighs more than c?", "K[i−1][c]", ["K[i−1][c − w[i]] + v[i]", "0", "K[i][c−1]"], [
      "Item i can't fit, so the only option is to skip it.",
      "The best value is whatever the first i − 1 items achieve with the same capacity: the cell directly above.",
    ]),
    mcq("Medium", "Weights {1, 3, 4, 5}, values {1, 4, 5, 7}, capacity 7. What is the best total value (0/1 knapsack)?", "9", ["8", "10", "11"], [
      "Combinations that fit in 7: {3, 4} → 4 + 5 = 9; {1, 5} → 1 + 7 = 8; {5} → 7; {1, 3} → 5; {1, 4} → 6.",
      "No three items fit: the lightest three already weigh 1 + 3 + 4 = 8.",
      "The best is 9: the items weighing 3 and 4.",
    ]),
    mcq("Medium", "Capacity 50; items (weight, value): (10, 60), (20, 100), (30, 120). Greedy by value per weight gets 160. What is the true optimum?", "220", ["160", "280", "180"], [
      "Greedy takes (10, 60) and (20, 100): weight 30, value 160. (30, 120) then doesn't fit.",
      "Taking (20, 100) and (30, 120) fills the knapsack exactly: 220.",
      "Greedy by ratio is only optimal for the fractional knapsack, where you could take 2/3 of the last item.",
    ]),
    mcq("Medium", "In the unbounded knapsack (unlimited copies of each item), how does the recurrence change?", "max(K[i−1][c], v[i] + K[i][c − w[i]])", ["max(K[i−1][c], v[i] + K[i−1][c − w[i]])", "K[i−1][c] + v[i]", "min(K[i−1][c], K[i][c − w[i]])"], [
      "In the 0/1 version, taking item i reads from row i − 1, so item i can't be used twice.",
      "Reading from the same row i (K[i][c − w[i]]) lets the smaller capacity already contain item i, so it can be taken any number of times.",
    ]),
    mcq("Hard", "The knapsack DP runs in O(n × W). Why is that called pseudo-polynomial?", "W is a number written in about log W bits, so the time is exponential in the input's size", ["It only works when n is small", "It uses recursion", "It only approximates the answer"], [
      "Running time is measured against the length of the input. The capacity W takes only about log₂ W bits to write down.",
      "Adding one bit to W doubles W, and the table grows with it.",
      "So the algorithm is polynomial in W's value, not in its size. 0/1 knapsack is NP-hard, so no truly polynomial algorithm is known.",
    ]),
  ],

  "bits-basics": [
    mcq("Easy", "What is 45 in 8-bit binary?", "0010 1101", ["1011 0100", "0010 1011", "0011 1101"], [
      "Take the largest place values first: 45 = 32 + 13 = 32 + 8 + 5 = 32 + 8 + 4 + 1.",
      "Those are bits 5, 3, 2 and 0: 0010 1101.",
      "By repeated division: 45 → 22 r 1, 11 r 0, 5 r 1, 2 r 1, 1 r 0, 0 r 1. The remainders are bits 0, 1, 2, …, so read them bottom-up: 101101.",
      "1011 0100 is 0010 1101 written backwards: bit 0 belongs on the right, not the left.",
    ]),
    mcq("Easy", "What is 12 & 10?", "8", ["14", "6", "22"], [
      "12 = 1100 and 10 = 1010.",
      "AND keeps a 1 only where both numbers have a 1: 1000 = 8.",
      "14 is 12 | 10, 6 is 12 ^ 10 and 22 is 12 + 10.",
    ]),
    mcq("Easy", "What is 13 ^ 7?", "10", ["15", "5", "20"], [
      "13 = 1101 and 7 = 0111.",
      "XOR gives 1 where the bits differ: 1010 = 10.",
      "15 would be 13 | 7 and 5 would be 13 & 7.",
    ]),
    mcq("Easy", "What is 6 << 3?", "48", ["18", "9", "24"], [
      "Shifting left by 3 multiplies by 2³ = 8: 6 × 8 = 48.",
      "In bits: 0000 0110 → 0011 0000.",
      "6 × 3 = 18 is a common mix-up: << 3 means 'times 2, three times'.",
    ]),
    mcq("Easy", "What is 37 >> 2?", "9", ["9.25", "148", "10"], [
      "Shifting right by 2 divides by 4 and rounds down: 37 / 4 = 9.25 → 9.",
      "In bits: 0010 0101 → 0000 1001.",
      "The two bits that fell off, 01, are the remainder: 37 = 9 × 4 + 1. (148 would be 37 << 2.)",
    ]),
    mcq("Medium", "In an 8-bit unsigned register, what is 200 << 1?", "144", ["400", "100", "255"], [
      "200 = 1100 1000. Shifting left gives 1 1001 0000, a 9-bit number (400).",
      "The top bit doesn't fit in 8 bits and is lost, leaving 1001 0000 = 144 = 400 − 256.",
      "That's overflow: shifts wrap around modulo 256 rather than stopping at 255.",
    ]),
    mcq("Hard", "What is (0xB6 >> 3) & 0x0F?", "6", ["22", "11", "5"], [
      "0xB6 = 1011 0110 (182).",
      "Shifting right by 3 moves bits 3–6 down to positions 0–3: 1011 0110 >> 3 = 0001 0110 (22).",
      "AND with 0x0F = 0000 1111 keeps only the low 4 bits: 0110 = 6.",
      "Together, (x >> k) & mask extracts a bit field: here bits 3 to 6 of 0xB6. (22 forgets the mask; 11 is 0xB6 >> 4, the top four bits.)",
    ]),
  ],

  "bits-tricks": [
    mcq("Easy", "Which expression tests whether bit k of n is set?", "(n & (1 << k)) != 0", ["(n | (1 << k)) != 0", "(n ^ (1 << k)) == 1", "(n & k) != 0"], [
      "1 << k has a single 1, at bit k. AND keeps n's bit k and zeroes everything else.",
      "The result is 2^k if the bit is set and 0 if not, so compare with 0, not with 1.",
      "n | (1 << k) is never 0, so it tells you nothing; n & k tests the bits of the number k, not bit k.",
    ]),
    mcq("Easy", "What is 44 with bit 3 cleared?", "36", ["44", "52", "40"], [
      "44 = 0010 1100. Bit 3 is worth 8 and is set.",
      "n & ~(1 << 3) = 0010 1100 & 1111 0111 = 0010 0100 = 36.",
      "If bit 3 had been 0, clearing it would change nothing. (52 = 44 + 8 is what adding 8 gives: a carry, not a bit operation.)",
    ]),
    mcq("Easy", "n = 7 (0111). What does n ^ 1 give?", "6", ["8", "7", "1"], [
      "XOR with 1 flips bit 0 and leaves every other bit alone: 0111 → 0110 = 6.",
      "Doing it again flips it back: 6 ^ 1 = 7.",
      "x ^ 1 pairs up 0↔1, 2↔3, 4↔5, 6↔7.",
    ]),
    mcq("Medium", "Which is a correct power-of-two test for an integer n?", "n > 0 && (n & (n − 1)) == 0", ["(n & (n − 1)) == 0", "n % 2 == 0", "(n & (n + 1)) == 0"], [
      "A power of two has exactly one 1 bit. n − 1 turns that bit off and the 0s below it on, so the AND is 0.",
      "Without n > 0, n = 0 would also pass, since 0 & anything = 0.",
      "n % 2 == 0 only tests evenness: 6 is even but isn't a power of two.",
    ]),
    mcq("Medium", "Kernighan's loop (n = n & (n − 1) until n is 0) runs on n = 1011 0010. How many iterations?", "4", ["8", "7", "3"], [
      "Each iteration clears the lowest 1 bit:",
      "1011 0010 → 1011 0000 → 1010 0000 → 1000 0000 → 0000 0000.",
      "It runs once per 1 bit (4), not once per bit position (8).",
    ]),
    mcq("Medium", "What is 40 & −40?", "8", ["40", "0", "32"], [
      "n & −n isolates the lowest 1 bit of n.",
      "40 = 0010 1000; −40 = ~40 + 1 = 1101 0111 + 1 = 1101 1000.",
      "They share only bit 3, so the AND is 0000 1000 = 8.",
    ]),
    mcq("Hard", "n = 0101 0111. What is n & (n + 1)?", "0101 0000", ["0101 0110", "0101 1000", "0101 1111"], [
      "n + 1: the trailing 1s (bits 0–2) turn into 0s and the first 0 above them (bit 3) turns into 1: 0101 1000.",
      "AND with n: bits 0–2 are 0 in n + 1, bit 3 is 0 in n, and the higher bits are the same in both.",
      "Result: 0101 0000 (80). n & (n + 1) clears the trailing 1s, the mirror image of n & (n − 1), which clears the lowest 1.",
      "0101 0110 is n & (n − 1), 0101 1000 is n + 1, and 0101 1111 is n | (n + 1), which sets the lowest 0.",
    ]),
  ],

  "bits-xor": [
    mcq("Easy", "What is −20 in 8-bit two's complement?", "1110 1100", ["1001 0100", "1110 1011", "0001 0100"], [
      "20 = 0001 0100.",
      "Flip every bit: 1110 1011. Add 1: 1110 1100.",
      "Check: −128 + 64 + 32 + 8 + 4 = −20.",
      "1001 0100 only flips the top bit (sign-magnitude); in two's complement it means −108.",
    ]),
    mcq("Easy", "What range of values can an 8-bit two's complement number hold?", "−128 to 127", ["−127 to 127", "−128 to 128", "0 to 255"], [
      "Bit 7 is worth −128, and bits 0–6 add up to at most 127.",
      "Most negative: 1000 0000 = −128. Most positive: 0111 1111 = 127.",
      "There's one more negative value because zero uses one of the patterns with sign bit 0. (0 to 255 is the unsigned range.)",
    ]),
    mcq("Easy", "What is the XOR of all the numbers in [4, 1, 2, 1, 2]?", "4", ["0", "10", "7"], [
      "XOR is commutative and associative, so regroup: 4 ^ (1 ^ 1) ^ (2 ^ 2) = 4 ^ 0 ^ 0 = 4.",
      "Pairs cancel wherever they are in the list.",
      "That's the one-pass, O(1)-space way to find the number that appears once.",
    ]),
    mcq("Medium", "What is −20 >> 2 with an arithmetic shift, and with a logical shift (8-bit)?", "−5 and 59", ["−5 and −5", "5 and 59", "−80 and 176"], [
      "−20 = 1110 1100.",
      "Arithmetic: copy the sign bit into the top: 1111 1011 = −5 = ⌊−20 / 4⌋.",
      "Logical: shift in zeros: 0011 1011 = 59, which is 236 / 4 for the unsigned reading 236.",
    ]),
    mcq("Medium", "XOR swap with a = 9 and b = 14: a ^= b; b ^= a; a ^= b. What does each step produce?", "a = 7, then b = 9, then a = 14", ["a = 5, then b = 9, then a = 14", "a = 23, then b = 9, then a = 14", "a = 7, then b = 14, then a = 9"], [
      "a = 9 ^ 14 = 1001 ^ 1110 = 0111 = 7.",
      "b = 14 ^ 7 = 1110 ^ 0111 = 1001 = 9 (the old a).",
      "a = 7 ^ 9 = 0111 ^ 1001 = 1110 = 14 (the old b).",
      "(23 = 9 + 14 would be the first step of the add/subtract swap.)",
    ]),
    mcq("Hard", "Add 5 + 3 using only sum = a ^ b and carry = (a & b) << 1, repeating until carry is 0. How many rounds does it take?", "4", ["1", "2", "3"], [
      "Round 1: 101 ^ 011 = 110 (6); carry = (101 & 011) << 1 = 010 (2).",
      "Round 2: 110 ^ 010 = 100 (4); carry = (110 & 010) << 1 = 100 (4).",
      "Round 3: 100 ^ 100 = 000 (0); carry = (100 & 100) << 1 = 1000 (8).",
      "Round 4: 0000 ^ 1000 = 1000 (8); carry = 0. Done: 8.",
    ]),
  ],

  "bits-subsets": [
    mcq("Easy", "Items [a, b, c, d] with bit 0 = a. Which subset is mask 1010 (binary)?", "{b, d}", ["{a, c}", "{a, b}", "{c, d}"], [
      "1010 has 1s at bit 1 and bit 3, counting from the right and starting at 0.",
      "Bit 1 is b and bit 3 is d: {b, d}.",
      "Reading the bits left to right would wrongly give {a, c}, which here is also the complement.",
    ]),
    mcq("Easy", "How many subsets does a set of 5 elements have?", "32", ["25", "10", "31"], [
      "Each element is either in or out: 2 × 2 × 2 × 2 × 2 = 2⁵ = 32.",
      "Masks 0 (the empty set) to 31 (all five) list each subset exactly once.",
      "31 forgets the empty set, 25 is 5², and 10 only counts the pairs.",
    ]),
    mcq("Easy", "Items [a, b, c, d] with bit 0 = a. Which mask represents {a, c, d}?", "13", ["11", "7", "14"], [
      "a is bit 0 (1), c is bit 2 (4) and d is bit 3 (8).",
      "mask = 1 + 4 + 8 = 13 = 1101 in binary.",
      "11 = 1011 would be {a, b, d}.",
    ]),
    mcq("Medium", "Which pair of expressions adds item i to a mask, and tests whether item i is in a mask?", "mask | (1 << i) to add, mask & (1 << i) to test", ["mask & (1 << i) to add, mask | (1 << i) to test", "mask ^ i to add, mask & i to test", "mask + i to add, mask == i to test"], [
      "OR with item i's single bit forces that bit to 1: the item is added, and nothing changes if it was already there.",
      "AND with the same bit is nonzero exactly when the item is present.",
      "Beware mask + (1 << i): if the item is already present, the addition carries into the next item's bit.",
    ]),
    mcq("Medium", "Items [a, b, c], bit 0 = a. Counting masks from 0 to 7, which subset comes right after {a, b}?", "{c}", ["{a, b, c}", "{a, c}", "{b, c}"], [
      "{a, b} is 011 = 3, so the next mask is 4 = 100: just {c}.",
      "Counting in binary doesn't add one item at a time; it rolls over like an odometer, with the lowest bits changing fastest.",
      "Every subset still appears exactly once.",
    ]),
    mcq("Medium", "What is the time to enumerate all subsets of n items and list each one's elements?", "O(2ⁿ · n)", ["O(n²)", "O(n!)", "O(2ⁿ)"], [
      "There are 2ⁿ masks, and decoding each one checks n bits.",
      "Just counting through the masks is O(2ⁿ), but listing the elements means looking at the bits.",
      "n! counts orderings (permutations), not subsets.",
    ]),
    mcq("Hard", "The loop  for (s = m; s > 0; s = (s − 1) & m)  visits every non-empty submask of m. For m = 11 (1011), in what order?", "11, 10, 9, 8, 3, 2, 1", ["11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1", "1, 2, 3, 8, 9, 10, 11", "11, 3, 2, 1"], [
      "s − 1 turns the lowest 1 of s into 0 and the 0s below it into 1s; & m then drops every bit that isn't in m.",
      "11 → 10 & 11 = 10 → 9 & 11 = 9 → 8 & 11 = 8 → 7 & 11 = 3 → 2 & 11 = 2 → 1 & 11 = 1 → 0, stop.",
      "m has 3 set bits, so it has 2³ − 1 = 7 non-empty submasks, visited from largest to smallest while skipping the non-submasks 7, 6, 5 and 4.",
      "Running this for every mask of n bits costs O(3ⁿ) in total, a standard trick in bitmask DP.",
    ]),
  ],
};

/** A stable pseudo-random order for a question's options, so the correct one isn't always first. */
export function optionOrder(seed: string, n: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
    const j = h % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}
