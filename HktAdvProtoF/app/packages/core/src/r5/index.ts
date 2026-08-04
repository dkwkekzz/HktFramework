// R5 기억과 관계 — 다시 볼 수 없게 된 것이 기억이 되고, 겪은 자가 상대를 짚는다.

export {
  MEMORY_GROUNDS,
  MEMORY_TRUTH_FIELDS,
  checkMemory,
  groundLabel,
  liveMemory,
  livedSlots,
  memoryConfidence,
  memoryIdOf,
  memoryLine,
  narrowingCap,
  orderMemories,
  sealAll,
  sealMemory,
  suffered,
  type Attribution,
  type Memory,
  type MemoryGround,
  type Sealing,
} from './memory.ts';

export {
  memoryViolationVerdict,
  violateMemory,
  type MemoryViolation,
  type MemoryViolationRule,
} from './violation.ts';
