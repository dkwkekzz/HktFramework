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
import {
  LIFE_FORMATION_MODES,
  RECOVERY_CARCASS_DECAY,
  RECOVERY_MOLT_CYCLE,
  REGION_GRAPH,
  REGION_SPECS,
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
 * 사체 자신의 원인(`nest-kill`)은 아직 들지 않는다 — 그것을 두고 가는 포식수가 세계에 서지
 * 않았고, **밝히지 않은 것을 결손으로 세지 않는다** (spec 기본형 ④ · 넣는 것은 C025 다).
 */
export const LIFE_BOUND_RECOVERY_CAUSES: readonly string[] = [
  RECOVERY_MOLT_CYCLE,
  RECOVERY_CARCASS_DECAY,
];

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
