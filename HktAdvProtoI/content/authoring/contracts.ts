// content/authoring/contracts — 이 세계가 이미 가진 것들 (T4 ADDED).
//
// 등급 판정기(engine/world-authoring/grade.ts)는 "어휘가 있다 · 요구에는 세 갈래가 있다" 는 형만
// 안다. **무엇이 그 어휘인지는 이 파일이 안다** — 게임 명사가 있으므로 content 다.
//
// 값의 출처는 전부 확정 문서와 지금 서 있는 세계다. 지어낸 이름이 하나도 없다:
//   갈래   Concept §3.1 이 준 일곱 (§5 의 일곱 갈래가 그대로 태그다)
//   깊이   Concept §3.2 가 준 다섯
//   이음   지금 graph 에 서 있는 종류 일곱
//   붙잡는 것 · 맡은 자리   resource-ecology 의 CarrierKind · OpportunityRole
//   방 · 경계 · 규칙   지금 세계가 가진 것 그대로 (코드에서 읽는다 — 손으로 옮기지 않는다)
//
// 이 목록을 넓히는 것이 곧 문법을 넓히는 일이다 (Tool-Scale §4). 그래서 이 파일을 고치는 것은
// 방 하나를 더하는 일이 아니라 층의 일이고, 확정 문서가 먼저 움직여야 한다.

import type { DecisionBranch, WorldContracts } from '../../engine/world-authoring/grade';
import {
  DECIDABLE_DISCOVERY_KINDS,
  DEFERRED_DISCOVERY_KINDS,
  MUTATION_OPS,
  OPPORTUNITY_ACTIONS,
} from '../../engine/world-authoring/opportunity';
import type { Lock } from '../regions';
import {
  LIFE_FORMATION_MODES,
  LOCK_AT_AREA,
  LOCK_AT_CONNECTOR,
  OPPORTUNITY_YIELD_TABLE,
  PROPERTY_ASPECTS,
  PROPERTY_RELATIONS,
  PROPERTY_TAG_SEPARATOR,
  RECOVERY_CARCASS_DECAY,
  RECOVERY_NEST_KILL,
  RECOVERY_MOLT_CYCLE,
  REGION_GRAPH,
  REGION_SPECS,
  STATEMENT_KINDS,
} from '../regions';

/** Concept §3.1 — §5 의 일곱 갈래가 그대로 hazard layer 의 태그다 */
const HAZARD_KINDS = [
  'hazard/creature',
  'hazard/terrain',
  'hazard/climate',
  'hazard/ecology',
  'hazard/matter',
  'hazard/phenomenon',
  'hazard/knowledge',
] as const;

/** Concept §3.2 — 깊이 다섯. 순서가 곧 세계의 확장 순서다 (W1) */
const DEPTHS = ['civil', 'outer', 'wild', 'deep', 'abyss'] as const;

/**
 * 붙잡는 것 · 맡은 자리 — resource-ecology 의 CarrierKind · OpportunityRole 과 같은 목록이다.
 *
 * C020 CHANGED — 붙잡는 것에 둘을 더한다 (`phenomenon` · `atmosphere`). 세계는 이미 그
 * 어휘를 쓰고 있었다: C018 이 현상을 세웠고 C020 이 대기를 세운다. 근거는 지어낸 것이
 * 아니라 **Material §6.2 가 이미 이름해 둔 어휘 여덟**이고, 이 목록은 그 가운데 이 세계가
 * 지금 쓰는 것들이다 — 세계가 쓰는 것과 여기 적힌 것이 갈리면 등급 판정기가 없는 어휘로
 * 방을 재게 된다.
 */
const CARRIERS = [
  'residue',
  'terrain',
  'plant',
  'fungus',
  'water',
  'phenomenon',
  'atmosphere',
] as const;
const ROLES = ['baseline', 'risk', 'conditional', 'by-product', 'world-event'] as const;

/**
 * 세계가 이미 품은 규칙의 이름들. 지금은 하나다 — 환상의 미로의 통로 재배열(C008).
 * 규칙을 가진 방에서 읽으므로 방이 늘면 이 목록도 저절로 는다.
 */
const STANDING_RULES = REGION_SPECS.filter((spec) => spec.rule).map((spec) => `${spec.id} 의 규칙`);

/**
 * **탄생 방식 넷** — 이 세계가 아는 어휘 (C022 ADDED · Life §3.2).
 *
 * 값의 원본은 `content/regions/lives.ts` 다 (데이터 폴더가 어휘를 소유한다). 여기 다시 서는
 * 이유는 하나 — 어휘 목록이 사는 자리가 이 파일이기 때문이다 (HAZARD_KINDS · CARRIERS ·
 * ROLES 의 선례). 등급 판정기(WorldContracts)는 아직 이것을 묻지 않는다: 물으려면 기반의
 * 형이 늘어야 하고, 그것은 이 Cycle 의 일이 아니다 (선행 추상화 금지).
 */
export const LIFE_FORMATION_KINDS: readonly string[] = LIFE_FORMATION_MODES;

/**
 * **생명을 전제하는 회복 원인** 코드들 (C022 ADDED · Material A.2 회복 원인 열 · 검사 ㉛).
 *
 * 되돌아옴의 원인 가운데 "살아 있는 것이 있어야 다시 난다" 고 말하는 것들이다. 어느 코드가
 * 그런지는 **이 계약이 고른다** — 기반은 그 어휘를 알지 못하고, 검사 ㉛ 은 여기 든 원인을
 * 밝힌 원천에게만 "무엇이 그것을 잇는가" 를 묻는다.
 *
 * C024 CHANGED — **둘이다.** 탈피 주기(`molt-cycle`) 곁에 사체의 분해(`carcass-decay`)가 선다:
 * 이 Cycle 이 둥지에 사체와 그것을 삭이는 거목균을 세웠으므로, 그 원인이 무엇을 전제하는지를
 * 이제 세계가 안다 (C022 가 "사체를 남기는 것이 세계에 없어" 비워 둔 자리다).
 *
 * C025 CHANGED — 사체 자신의 원인(`nest-kill`)이 **셋째로 든다.** 그것을 두고 가는 포식수가
 * 세계에 섰기 때문이다 (NEST_CARCASS.recoveryLife = PREDATOR). 포식수는 태어나지 않고
 * 이웃에서 **불려 오므로**(CALLS), 기반의 ㉛ 이 "탄생지가 있는가" 만 묻던 것을 "값을 올리는
 * 관계가 있는가" 까지 묻도록 넓혔다 (ENGINE GAP · Human 승인). 어느 갈래가 값을 올리는지는
 * 기반이 알지 못하므로 아래 `RAISING_LINK_KINDS` 가 그것을 고른다.
 */
export const LIFE_BOUND_RECOVERY_CAUSES: readonly string[] = [
  RECOVERY_MOLT_CYCLE,
  RECOVERY_CARCASS_DECAY,
  RECOVERY_NEST_KILL,
];

/**
 * 물음의 **세기** 둘 — `soft` 와 `hard` (T2 확장 ADDED · Access 원문 §3).
 *
 * 앞의 목록들과 달리 **읽어 올 값이 없다.** 이 어휘가 사는 자리는 `content/regions/access.ts`
 * 의 `Lock.strength` 인데 그것은 형(union)이지 값이 아니라, 자리 갈래가 상수 둘
 * (LOCK_AT_CONNECTOR · LOCK_AT_AREA)로 서 있는 것과 갈린다. 형은 실행 때 읽히지 않으므로
 * transitions 가 graph 에서 읽는 그 어법을 여기서는 쓸 수 없다.
 *
 * 그래서 **글자를 다시 적되 형에 매단다** — `Lock['strength']` 로 받으므로 그 union 에 없는
 * 말을 적으면 그 자리에서 컴파일이 걸린다. 다만 union 에 셋째가 늘어도 이 줄은 조용하다:
 * 세기가 느는 날 이 줄도 손으로 는다 (어휘를 넓히는 것은 층의 일이라는 규율 그대로).
 */
const LOCK_STRENGTHS: readonly Lock['strength'][] = ['soft', 'hard'];

/**
 * 개체군의 값을 **올리는** 관계의 갈래들 (C025 ADDED · 검사 ㉛).
 *
 * 기반은 관계의 갈래 이름을 알지 못한다 (㉜ 이 같은 자리에 세운 규율) — 그래서 "무엇이 그
 * 개체군을 세우는가" 를 물을 때 어느 갈래를 세울 쪽으로 볼지는 이 세계가 고른다.
 * 부르는 것(CALLS)만이 값을 올린다 — 먹는 것은 내리고, 남기는 것은 개체군이 아니라 원천을
 * 세운다 (Life F14).
 */
export const RAISING_LINK_KINDS: readonly string[] = ['CALLS'];

// ── 기회 계약 (C037 ADDED · spec SPEC-008 · Foundation §4.5 · §4.2 · §9) ──
//
// 방이 **무엇을 내미는가**를 적을 때 쓸 수 있는 말의 전부다 — 어떻게 알게 되는가(discovery) ·
// 무엇을 할 수 있는가(동사) · 세계에 무엇이 일어나는가(op 표) · 무엇이 남는가(Yield 열).
//
// 앞의 목록들과 **같은 어법**이다 (HAZARD_KINDS · CARRIERS · ROLES): 어휘가 사는 자리가 이
// 파일이고, 값의 출처는 기반의 형과 이 세계의 데이터다 — 손으로 옮기지 않고 읽는다.
// 등급 판정기(WorldContracts)는 아직 이 넷을 묻지 않는다: 물으려면 기반의 형이 늘어야 하고
// 그것은 이 Cycle 의 일이 아니다 (LIFE_FORMATION_KINDS 가 선 그 규율 · 선행 추상화 금지).

/** 어떻게 알게 되는가 — 지금 서는 넷과 자리만인 둘 (3층이 오면 뒤의 둘이 열린다) */
export const OPPORTUNITY_CONTRACT = {
  discovery: {
    standing: [...DECIDABLE_DISCOVERY_KINDS],
    deferred: [...DEFERRED_DISCOVERY_KINDS],
  },
  /** 할 수 있는 것 — **이미 있는 동사만**이다 (기반이 든 넷) */
  actions: [...OPPORTUNITY_ACTIONS],
  /** 세계에 남는 변화의 (군, op) 짝 — §4.2 표에서 2층에 서는 것들 */
  ops: MUTATION_OPS.map((pair) => `${pair.group} ${pair.op}`),
  /** 무엇이 남는가 — 열 열넷 (앞 넷만 값을 가진다 · 뒤 열은 0 이고 지워지지 않는다) */
  yields: OPPORTUNITY_YIELD_TABLE.map((column) => ({
    kind: column.kind,
    standing: column.standing,
  })),
} as const;

/**
 * **T4 의 결정 나무** — 요구의 갈래 여덟이 저마다 어느 등급인가 (C037 ADDED · 기획서 §14 ·
 * L2-World-Foundation §5.4).
 *
 * 판정기는 "요구에 갈래가 있다" 는 형만 안다 — **무엇을 A 로 치는가는 이 세계의 판단**이므로
 * 계약이 나무를 건넨다 (등급 판정기의 `defaultDecisionTree` 를 이것이 대신한다).
 *
 * 가르는 잣대는 하나다 — **그것이 없으면 무엇을 해야 서는가**.
 *   A  데이터로 적으면 선다 (fact · space · observation · persistence — 세계의 형이 이미 그 자리를 가졌다)
 *   B  Cycle 하나로 선다 (rule · process — 규칙 하나 · 세계 과정 하나를 세우면 된다)
 *   C  층이 와야 선다 (axis · contract — 지금 없는 의미를 요구한다)
 *
 * **지금 있는 brief 셋의 등급은 한 값도 달라지지 않는다** (SPEC-008 경계) — 그 셋이 쓰는 갈래는
 * rule · axis · contract 뿐이고, 그 셋의 등급이 앞의 기본 나무와 같기 때문이다.
 */
export const DECISION_TREE: readonly DecisionBranch[] = [
  {
    kind: 'rule',
    grade: 'B',
    returnTo: 'Cycle 하나 (Play 아님) — 그 규칙을 세우고 나면 이 방은 데이터가 된다',
    because: '그 규칙이 아직 세계에 없다',
  },
  {
    kind: 'axis',
    grade: 'C',
    returnTo: '기반 층의 그 행 — 그 축이 서면 이 방은 등급 A 로 온다',
    because: '그 층의 의미가 아직 서지 않았다',
  },
  {
    kind: 'contract',
    grade: 'C',
    returnTo: '그 공통 계약을 세우는 Play/Cycle',
    because: '그 공통 계약이 아직 데이터로 서지 않았다',
  },
  {
    kind: 'fact',
    grade: 'A',
    returnTo: 'brief 를 쓴 사람 — 세계의 사실은 데이터다 (적으면 선다)',
    because: '세계의 사실(Contents · State · Relation 의 값)은 이미 데이터로 적을 수 있다',
  },
  {
    kind: 'process',
    grade: 'B',
    returnTo: 'Cycle 하나 — 세계 과정 하나를 세우면 이 방은 데이터가 된다',
    because: '스스로 일어나는 변화는 세계 과정 하나가 서야 돈다',
  },
  {
    kind: 'space',
    grade: 'A',
    returnTo: 'brief 를 쓴 사람 — 공간은 Description 의 op 으로 적는다',
    because: '공간의 의미는 이미 땅을 짓는 어휘 안에 있다',
  },
  {
    kind: 'observation',
    grade: 'A',
    returnTo: 'brief 를 쓴 사람 — 알게 되는 방식은 discovery 로 적는다',
    because: '무엇을 어떻게 알게 되는가는 기회의 discovery 가 이미 든다',
  },
  {
    kind: 'persistence',
    grade: 'A',
    returnTo: 'brief 를 쓴 사람 — 남는 것의 종류는 수명 표의 손 다섯 가운데 하나다',
    because: '남는 것의 종류는 이미 다섯으로 서 있다 (수명 표)',
  },
];

export const WORLD_CONTRACTS: WorldContracts = {
  hazardKinds: HAZARD_KINDS,
  depths: DEPTHS,
  // 지금 서 있는 이음의 종류 — 손으로 옮기지 않고 graph 에서 읽는다
  transitions: [...new Set(REGION_GRAPH.connectors.map((c) => c.transition))].sort(),
  carriers: CARRIERS,
  roles: ROLES,
  // 성질의 축과 관계 (C031 ADDED) — 어휘의 출처는 `content/regions/properties.ts` 하나이고
  // 여기는 그것을 **읽는다** (손으로 옮기지 않는다 · transitions 가 graph 에서 읽는 그 어법).
  // 두 벌로 적으면 어느 날 하나가 늦는다.
  //
  // T2 확장 CHANGED — C031 이 "brief 가 요구와 답을 성질로 적기 전에는 대조할 입력이 없다" 며
  // **등록**만 해 둔 자리다. 그 입력이 이제 있으므로 판정기가 이 둘을 실제로 대조한다
  // (아래 넷과 같은 자리에서 쓰인다). 지금 방들의 등급은 그래도 한 값도 달라지지 않았다 —
  // 열세 brief 가 쓰는 축·관계가 전부 이 목록 안에 있기 때문이고, 그것이 대조의 뜻이다.
  propertyAspects: PROPERTY_ASPECTS.map((aspect) => aspect.id),
  propertyRelations: PROPERTY_RELATIONS.map((relation) => relation.id),
  // 성질과 물음의 어휘 넷 (T2 확장 ADDED) — C031 이 **등록만** 해 둔 축·관계를 판정기가 드디어
  // 대조한다. brief 가 요구와 답을 성질로 적게 되었으므로 대조할 입력이 이제 있다.
  //
  // 넷 다 **출처가 하나이고 여기는 그것을 읽는다** (위 두 줄과 같은 어법 · 두 벌로 적으면
  // 어느 날 하나가 늦는다):
  //   propertyTagSeparator  properties.ts 의 `PROPERTY_TAG_SEPARATOR` — 태그를 짓는 함수
  //                         `propertyTag` 가 쓰는 바로 그 글자다
  //   propertyStatements    properties.ts 의 `STATEMENT_KINDS` — 재료가 관찰되는 문장 다섯 항
  //                         (Material §6.1). ⑩ 의 `from` 이 이 다섯 중 하나여야 한다
  //   lockAtKinds           access.ts 의 `LOCK_AT_CONNECTOR` · `LOCK_AT_AREA` — 도구의 계약이
  //                         이미 그대로 받아 쓰던 상수 둘이다 (tools/world-editor/check.ts)
  //   lockStrengths         위 `LOCK_STRENGTHS` — 이 넷 가운데 유일하게 읽어 올 값이 없어
  //                         형에 매달아 적었다 (그 까닭은 그 상수의 주석에)
  propertyTagSeparator: PROPERTY_TAG_SEPARATOR,
  propertyStatements: STATEMENT_KINDS,
  lockAtKinds: [LOCK_AT_CONNECTOR, LOCK_AT_AREA],
  lockStrengths: LOCK_STRENGTHS,
  regions: REGION_SPECS.map((spec) => spec.id),
  frontiers: [...(REGION_GRAPH.frontiers ?? [])],
  rules: STANDING_RULES,
  // 요구의 갈래 여덟을 등급으로 옮기는 표 (C037 ADDED · T4) — 위 DECISION_TREE 가 그것이다.
  // 주지 않으면 판정기가 셋짜리 기본 나무를 쓰고, 그때 새 갈래 다섯은 전부 C 로 떨어진다.
  decisionTree: DECISION_TREE,
  returnTo: {
    vocabulary: 'design/ · Human — 어휘를 넓히는 것은 층의 일이다',
    rule: 'Cycle 하나 (Play 아님) — 그 규칙을 세우고 나면 이 방은 데이터가 된다',
    axis: '기반 층의 그 행 — 그 축이 서면 이 방은 등급 A 로 온다',
    contract: '그 공통 계약을 세우는 Play/Cycle',
    brief: 'brief 를 쓴 사람 — 이을 자리를 고쳐 적는다',
    pending: 'brief 를 쓴 사람 — Reason 이 가리키는 것이 서면 답할 수 있다',
  },
};
