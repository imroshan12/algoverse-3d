import { arrayTopic } from "./array";
import { avlTopic } from "./avl";
import { bitsBasicsTopic, bitsSubsetsTopic, bitsTricksTopic, bitsXorTopic } from "./bits";
import { bstTopic } from "./bst";
import { dp1Topic, knapsackTopic, lcsTopic } from "./dp";
import { mstTopic, shortestPathTopic, topoTopic, traversalTopic } from "./graphs";
import { hashChainTopic, hashOpenTopic } from "./hashing";
import { heapTopic } from "./heap";
import { linkedListTopic } from "./linkedList";
import { queueTopic } from "./queue";
import { searchingTopic } from "./searching";
import { sortingTopic } from "./sorting";
import { stackTopic } from "./stack";
import { trieTopic } from "./trie";
import type { Category, TopicDef } from "./types";

export const TOPICS: TopicDef[] = [
  arrayTopic,
  stackTopic,
  queueTopic,
  linkedListTopic,
  hashChainTopic,
  hashOpenTopic,
  searchingTopic,
  sortingTopic,
  bstTopic,
  avlTopic,
  heapTopic,
  trieTopic,
  traversalTopic,
  shortestPathTopic,
  mstTopic,
  topoTopic,
  dp1Topic,
  lcsTopic,
  knapsackTopic,
  bitsBasicsTopic,
  bitsTricksTopic,
  bitsXorTopic,
  bitsSubsetsTopic,
];

export const CATEGORIES: Category[] = ["Linear structures", "Searching & sorting", "Trees", "Graphs", "Dynamic programming", "Bit manipulation"];
