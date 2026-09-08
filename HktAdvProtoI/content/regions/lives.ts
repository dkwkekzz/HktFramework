// content/regions — 이 세계의 **생명 계통** (C022 ADDED · L2-World-Life §3.2 · Play §5.2 · §5.6).
//
// resource-ecology 가 "이 방이 무엇을 낳는가" 를 적는 자리라면, 여기는 **무엇이 태어나는가**를
// 적는 자리다. world 와 view 가 함께 읽는 정적 사실이고 세계 State 에 들어가지 않는다 —
// 저장되는 것은 탄생지의 phase 와 진행 · 개체군의 값뿐이다 (semantic/region-state.ts).
//
// **규칙 코드는 어떤 생명도 이름으로 알지 못한다** (Life F13 · R13 · C004 가 세운 규율).
// 규칙이 아는 것은 "탄생지를 밝힌 방" · "요구를 밝힌 탄생지" 라는 형뿐이고, 그것이 광식충인지
// 무엇인지는 이 파일과 View 의 문구 표에만 있다.
//
// 생명을 하나 더 만드는 것 · 탄생지를 더하는 것 · 결속의 길이를 바꾸는 것은 전부 데이터
// 편집이다 (Play 불변 조건 — 코드 변경 없이 폴리싱).

import { FOREST_CHAIN } from './resource-ecology';

/**
 * 무엇이 어떻게 태어나는가 — **탄생 방식 넷** (Life §3.2 가 준 어휘 그대로).
 *
 * 이 세계가 지금 쓰는 것은 결속(ENVIRONMENTAL_BINDING) 하나뿐이나 어휘는 넷 다 선다 —
 * 어휘를 새로 짓는 것이 아니라 확정 문서가 이름해 둔 넷을 옮겨 적은 것이고, 빈 칸을
 * 채우는 것은 그 방식을 처음 쓰는 Cycle 의 일이다 (C018 이 `phenomenon` 에 한 그대로).
 *
 *   INHERITED             이미 있는 것이 낳는다 (계승 — 최초 다음부터의 길)
 *   ENVIRONMENTAL_BINDING 환경의 조건들이 맺혀 태어난다 (최초의 길 · 확정 2)
 *   TRANSFORMATION        있던 것이 다른 것으로 바뀐다 (사체 → 균류)
 *   SEPARATION            큰 것에서 갈라져 나온다 (분화)
 */
export type LifeFormationMode =
  | 'INHERITED'
  | 'ENVIRONMENTAL_BINDING'
  | 'TRANSFORMATION'
  | 'SEPARATION';

/** 탄생 방식 넷의 **실행 값** 목록 — 형(LifeFormationMode)은 실행 때 목록이 없다 */
export const LIFE_FORMATION_MODES: readonly LifeFormationMode[] = [
  'INHERITED',
  'ENVIRONMENTAL_BINDING',
  'TRANSFORMATION',
  'SEPARATION',
];

/**
 * Life Seed — 이 세계에 사는 것 하나 (MaterialSeed 와 같은 갈래 · A.1 의 어법).
 *
 * **몸도 걸음도 감각도 적지 않는다** — 그것은 3층의 몫이다 (Life F10). 이 층이 넘기는 것은
 * "무엇이 · 어느 원인에서 · 어느 개체군으로 사는가" 까지다. 요구에 답할 성질 태그(properties)도
 * 아직 없다 — 그것을 묻는 Play 가 서면 그때 난다 (선행 추상화 금지).
 */
export interface LifeSeed {
  /** 그 생명의 코드이자 **개체군의 id** 다 — 개체군은 그 생명의 수이므로 이름이 갈리지 않는다 */
  id: string;
  /** 그 생명이 **어느 세계 원인에서 사는가** — 재료의 worldCause 와 같은 갈래의 코드다 */
  worldCause: string;
}

/**
 * 광식충 — 생체 광석을 먹고 허물을 벗는 것 (Concept §4 · Play §5.6 · 확정 6).
 *
 * 이 세계가 이미 그 이름을 쓰고 있었다 — 숲 가장자리의 허물(MOLT_LITTER)이 **무엇이 벗은
 * 것인가**의 답이 이것이다 (C011 이 그 원천을 세울 때 이름만 있고 주인이 없었다).
 */
export const ORE_EATER = 'ORE_EATER';

/** 붉은 알집의 자연 형태 코드 — 관찰의 kind 가 이것이다 (재료의 FORM_* 와 같은 갈래) */
export const FORM_ROOT_CLUTCH = 'root-clutch';

/**
 * 이 세계가 아는 생명들 — 지금은 하나다.
 *
 * 숲의 사슬 안에서 산다 (FOREST_CHAIN) — 거목이 빨아올린 것을 먹고 허물을 남기는 그 자리다.
 */
export const LIFE_SEEDS: readonly LifeSeed[] = [{ id: ORE_EATER, worldCause: FOREST_CHAIN }];
