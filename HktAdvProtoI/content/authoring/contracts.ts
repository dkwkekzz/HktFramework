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

import type { WorldContracts } from '../../engine/world-authoring/grade';
import { REGION_GRAPH, REGION_SPECS } from '../regions';

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

/** 붙잡는 것 · 맡은 자리 — resource-ecology 의 CarrierKind · OpportunityRole 과 같은 목록이다 */
const CARRIERS = ['residue', 'terrain', 'plant', 'fungus', 'water'] as const;
const ROLES = ['baseline', 'risk', 'conditional', 'by-product'] as const;

/**
 * 세계가 이미 품은 규칙의 이름들. 지금은 하나다 — 환상의 미로의 통로 재배열(C008).
 * 규칙을 가진 방에서 읽으므로 방이 늘면 이 목록도 저절로 는다.
 */
const STANDING_RULES = REGION_SPECS.filter((spec) => spec.rule).map((spec) => `${spec.id} 의 규칙`);

export const WORLD_CONTRACTS: WorldContracts = {
  hazardKinds: HAZARD_KINDS,
  depths: DEPTHS,
  // 지금 서 있는 이음의 종류 — 손으로 옮기지 않고 graph 에서 읽는다
  transitions: [...new Set(REGION_GRAPH.connectors.map((c) => c.transition))].sort(),
  carriers: CARRIERS,
  roles: ROLES,
  regions: REGION_SPECS.map((spec) => spec.id),
  frontiers: [...(REGION_GRAPH.frontiers ?? [])],
  rules: STANDING_RULES,
  returnTo: {
    vocabulary: 'design/ · Human — 어휘를 넓히는 것은 층의 일이다',
    rule: 'Cycle 하나 (Play 아님) — 그 규칙을 세우고 나면 이 방은 데이터가 된다',
    axis: '기반 층의 그 행 — 그 축이 서면 이 방은 등급 A 로 온다',
    contract: '그 공통 계약을 세우는 Play/Cycle',
    brief: 'brief 를 쓴 사람 — 이을 자리를 고쳐 적는다',
    pending: 'brief 를 쓴 사람 — Reason 이 가리키는 것이 서면 답할 수 있다',
  },
};
