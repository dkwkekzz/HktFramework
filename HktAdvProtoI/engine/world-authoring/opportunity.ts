// engine/world-authoring — **기회는 하나의 형이다** (Opportunity).
//
// 방이 무엇을 내미는가를 한 형으로 적는 기구다. 조건(condition.ts)이 "언제 참인가" 의 형이라면
// 이것은 "여기서 무엇을 할 수 있고 · 그것을 어떻게 알게 되며 · 무엇이 남는가" 의 형이다.
// 여기에도 게임 명사가 없다 — 방도 원천도 문도 이름으로 알지 못하고, 갈래(discovery · target ·
// action · progress · mutation · yield)와 그 갈래를 세는 어휘만 있다. 어느 id 가 실재하는지는
// 검사가 컨텐츠에게 어휘로 받는다 (`CheckOpportunityVocabulary` — Condition 의 선례 그대로).
//
// 지키는 것 셋.
//   ① **기회는 판정하지 않는다** — availability 는 여기서 평가되지 않는다. Interaction 의
//      available/reason 은 지금처럼 규칙이 유도하고, 기회 데이터는 그 판정에 **이름**(어느 기회의
//      것인가)과 **어떻게 알게 되는가**를 붙일 뿐이다. 그래서 이 파일에는 평가기가 없다.
//   ② **아무것도 저장하지 않는다** — progress 는 어디를 읽으면 그 진행을 알 수 있는가의 **경로**이지
//      값이 아니다. 같은 데이터면 언제나 같은 표기다 (결정론).
//   ③ **자리만인 것은 형에만 둔다** — NPC · KNOWLEDGE discovery 와 participants · rules 는 3층의
//      것이다. 형에는 있되 지금은 아무도 채우지 않고, 검사는 그것을 걸어낸다 (그 층이 오면 어휘가 연다).

import type { Condition } from './condition';
import { conditionLeaves } from './condition';

/** 어떻게 알게 되는가 — 넷은 지금 서고 둘(NPC · KNOWLEDGE)은 3층의 자리다 */
export type OpportunityDiscovery = 'VISIBLE' | 'SIGNAL' | 'TRACE' | 'HIDDEN' | 'NPC' | 'KNOWLEDGE';

/** 지금 서는 discovery 넷 — 이 밖의 것은 검사가 걸어낸다 */
export const DECIDABLE_DISCOVERY_KINDS: readonly OpportunityDiscovery[] = [
  'VISIBLE',
  'SIGNAL',
  'TRACE',
  'HIDDEN',
];

/** 자리만인 discovery — 3층(사람과 앎)이 오면 어휘가 연다 */
export const DEFERRED_DISCOVERY_KINDS: readonly OpportunityDiscovery[] = ['NPC', 'KNOWLEDGE'];

/** 기회가 걸리는 것의 갈래 다섯 — 무엇을 향한 기회인가 */
export type OpportunityTargetKind = 'source' | 'area' | 'connector' | 'route' | 'process';

export const OPPORTUNITY_TARGET_KINDS: readonly OpportunityTargetKind[] = [
  'source',
  'area',
  'connector',
  'route',
  'process',
];

/** 무엇을 향하는가 — 갈래와 그 id. 조건의 Target 과 달리 ref 없이 서는 갈래가 없다 */
export interface OpportunityTarget {
  kind: OpportunityTargetKind;
  ref: string;
}

/**
 * 할 수 있는 것 — **이미 있는 동사만**이다. 새 동사를 여기서 짓지 않는다:
 * 이 넷은 관찰의 Interaction role 과 같은 것을 가리키고, 어느 동사가 어느 role 인지는
 * 컨텐츠가 검사에 어휘로 건넨다 (기반은 role 의 이름을 모른다).
 */
export type OpportunityAction = 'observe' | 'gather' | 'cross' | 'move';

export const OPPORTUNITY_ACTIONS: readonly OpportunityAction[] = [
  'observe',
  'gather',
  'cross',
  'move',
];

/** 진행을 어디서 읽는가 — 세는 것(counter) · 마디(phase) · 없는 것(none) */
export type OpportunityProgressKind = 'none' | 'counter' | 'phase';

/**
 * 진행 — **값이 아니라 경로**다 (지키는 것 ②). counter · phase 는 읽을 자리(history 경로 ·
 * state 경로)를 밝히고, none 은 읽을 자리가 없으므로 ref 도 없다.
 */
export interface OpportunityProgress {
  kind: OpportunityProgressKind;
  ref?: string;
}

export const OPPORTUNITY_PROGRESS_KINDS: readonly OpportunityProgressKind[] = [
  'none',
  'counter',
  'phase',
];

/** 세계에 일어나는 변화의 군 일곱 — knowledge 는 자리만이다 (op 이 없다) */
export type MutationGroup =
  | 'property'
  | 'entity'
  | 'relation'
  | 'process'
  | 'opportunity'
  | 'ownership'
  | 'knowledge';

/** op 의 이름 — 군마다 서는 것이 다르다. 짝은 `MUTATION_OPS` 가 정한다 */
export type MutationOp =
  | 'SET'
  | 'ADD'
  | 'CLAMP'
  | 'CHANGE_STATE'
  | 'CONNECT'
  | 'DISCONNECT'
  | 'START'
  | 'STOP'
  | 'ADVANCE'
  | 'RESET'
  | 'OPEN'
  | 'CLOSE'
  | 'COMPLETE'
  | 'GRANT';

/**
 * §4.2 표에서 **2층에 서는** 군 × op 짝 — 이 목록 밖의 짝은 검사가 걸어낸다.
 *
 * 표에 자리만 있는 op(SUBTRACT · MULTIPLY · CREATE · REMOVE · MOVE · TRANSFORM · REDIRECT ·
 * PAUSE · REVEAL · FAIL · TRANSFER …)는 여기에 없다 — 이름을 짓는 것과 서는 것은 다르고,
 * 서지 않는 이름을 데이터가 쓰면 그것이 걸려야 한다. knowledge 군은 통째로 3층이라 짝이 없다.
 * 차례는 표의 차례 그대로다 (요약이 두 번 돌아도 같도록).
 */
export const MUTATION_OPS: readonly { group: MutationGroup; op: MutationOp }[] = [
  { group: 'property', op: 'SET' },
  { group: 'property', op: 'ADD' },
  { group: 'property', op: 'CLAMP' },
  { group: 'entity', op: 'CHANGE_STATE' },
  { group: 'relation', op: 'CONNECT' },
  { group: 'relation', op: 'DISCONNECT' },
  { group: 'process', op: 'START' },
  { group: 'process', op: 'STOP' },
  { group: 'process', op: 'ADVANCE' },
  { group: 'process', op: 'RESET' },
  { group: 'opportunity', op: 'OPEN' },
  { group: 'opportunity', op: 'CLOSE' },
  { group: 'opportunity', op: 'COMPLETE' },
  { group: 'ownership', op: 'GRANT' },
];

/**
 * 세계에 남는 변화 하나 — 군 · op · 무엇에(ref).
 *
 * `ref` 는 선택이다: 무엇이 바뀌는지가 기회의 target 으로 이미 정해지는 자리가 있기 때문이다.
 * 이 Cycle 은 이름만 붙이고 아무것도 굴리지 않는다 — 어느 Transition 이 어느 op 인가는
 * 컨텐츠의 표가 적는다 (기존 Transition 을 옮기지 않는다).
 */
export interface Mutation {
  group: MutationGroup;
  op: MutationOp;
  ref?: string;
}

/** 무엇이 남는가 — 2층의 네 열 (G11) */
export type OpportunityYieldKind = 'Material' | 'Access' | 'Discovery' | 'WorldInfluence';

export const OPPORTUNITY_YIELD_KINDS: readonly OpportunityYieldKind[] = [
  'Material',
  'Access',
  'Discovery',
  'WorldInfluence',
];

/** 결과 — 세계에 일어나는 것(world)과 붙잡는 사람에게 남는 것(yield) */
export interface OpportunityOutcomes {
  world: readonly Mutation[];
  yield: readonly OpportunityYieldKind[];
}

/**
 * 기회 하나 — §4.5 의 항목 여덟.
 *
 * `availability` 를 밝히지 않으면 **늘 있는 기회**다 (빈 all 이 참인 것과 같은 어법). 밝혔더라도
 * 이 층은 그것을 평가하지 않는다 — 적히고, 참조 무결만 재어진다 (지키는 것 ①).
 * participants(누가 함께 하는가) · rules(등급 B 의 세부 규칙)는 형의 자리이고 지금은 없다.
 */
export interface Opportunity {
  id: string;
  region: string;
  /** 언제 있는가 — 없으면 늘 있다. 시간 qualifier 를 가지면 Event 다 (G4) */
  availability?: Condition;
  discovery: OpportunityDiscovery;
  target: OpportunityTarget;
  possibleActions: readonly OpportunityAction[];
  progress: OpportunityProgress;
  outcomes: OpportunityOutcomes;
}

/**
 * Event 인가 — availability 의 잎 가운데 **시간 qualifier** 를 가진 것이 하나라도 있으면 참이다 (G4).
 *
 * Event 를 따로 적는 갈래를 두지 않은 까닭: "때가 되면 열리는 것" 은 기회의 다른 종류가 아니라
 * 조건에 시간이 실린 것뿐이기 때문이다. 그래서 이것은 저장된 표가 아니라 **유도**다 —
 * availability 를 고치면 Event 여부가 따라 바뀐다.
 */
export function isEventOpportunity(opportunity: Opportunity): boolean {
  const { availability } = opportunity;
  if (availability === undefined) return false;
  return conditionLeaves(availability).some((leaf) => leaf.qualifier?.kind === 'time');
}

/** 목록 한 토막 — 비면 `-` 다 (빈 자리도 자리로 보이도록 · 줄의 칸이 어긋나지 않도록) */
function listText(values: readonly string[]): string {
  return values.length === 0 ? '-' : values.join(',');
}

/**
 * 기회 하나를 한 줄로 — 사람이 읽을 말이 아니라 **기계가 읽는 표기**다
 * (`formatConditionLeaf` 의 어법 그대로 · 검사의 refs 와 기회 표가 그대로 싣는다).
 *
 *   `gather:S1[TRACE] source(S1) gather → Material`
 *   `cross:AB[VISIBLE] connector(AB) cross → Access`
 *
 * 적히지 않은 것(availability · progress · outcomes.world)은 줄에 서지 않는다 — 한 줄은 무엇을
 * 어떻게 알고 무엇이 남는가까지다. 그 밖은 걸린 까닭이 덧붙는다.
 */
export function formatOpportunity(opportunity: Opportunity): string {
  const { id, discovery, target, possibleActions, outcomes } = opportunity;
  const actions = listText(possibleActions);
  const yields = listText(outcomes.yield);
  return `${id}[${discovery}] ${target.kind}(${target.ref}) ${actions} → ${yields}`;
}
