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
 * **뿌리의 알**의 자연 형태 코드 (C023 ADDED · Play §5.4 · spec SPEC-008).
 *
 * 결속(알집)과 계승(알)은 **눈으로 갈린다** — 큰 알집과 작은 붉은 점이다. 규칙은 둘을 같은
 * 한 규칙으로 굴리므로(W40), 갈리는 자리는 이 형태 코드와 그것을 읽는 View 의 표뿐이다.
 */
export const FORM_ROOT_EGGS = 'root-eggs';

/**
 * **떼의 의미 코드** (C023 ADDED · Play §5.3 ⑥ · V21 · Time §2.6).
 *
 * 개체군이 값만큼의 자락으로 그 방에 선다 — 관찰 결과의 `presences[].presence` 가 이 값이고,
 * 지나가는 것의 코드(sky-whale · blind-hunter)와 **같은 자리 · 같은 갈래**다.
 *
 * 개체군의 id(ORE_EATER)를 그대로 쓰지 않는 이유는 하나다 — 세계는 **개체군의 값도 그 이름도
 * 투영하지 않는다** (spec Observable). 관찰자가 보는 것은 "여기 무엇이 돌고 있다" 는 코드
 * 하나이고, 그것이 얼마나 되는지는 선 자락의 넓이로만 읽힌다.
 */
export const PRESENCE_ORE_EATER_SWARM = 'ore-eater-swarm';

// ── C024 ADDED — 둘째 생명 (Play §5.7 · Concept §4 의 사슬) ──────────────
//
// **새 이름을 지어내지 않았다** — 이 세계는 이미 거목균(GIANT_TREE_FUNGUS)이라는 재료를
// 내고 있었고(C014), 그것을 내는 것이 무엇인가의 답이 이것이다. 광식충이 허물의 주인이었던
// 그 자리와 같은 어법이다: 재료가 먼저 서고 주인이 뒤에 온다.

/**
 * 거목균 — 사체를 삭여 흙을 붉게 되돌리는 균류 (Concept §4 · Play §5.7 · Life F3 변성형).
 *
 * 이것이 **개체군으로 서는** 이유는 하나다 — 변성형 탄생(사체 → 균류)이 값을 올릴 곳을
 * 가져야 성립하고, 둥지의 균사가 다시 피는 것도 그 값에 매이기 때문이다 (검사 ㉛ 의 둘째 대상).
 * 광식충과 갈리는 것은 **돌지 않는다**는 것이다: 떼의 자락도 소란도 밝히지 않는다.
 */
export const TREE_FUNGUS = 'TREE_FUNGUS';

/**
 * 사체에서 피어난 것의 자연 형태 코드 (C024 ADDED · Play §5.7 · spec 데이터 값 표).
 *
 * 알집(FORM_ROOT_CLUTCH) · 알(FORM_ROOT_EGGS)과 **같은 갈래**다 — 탄생지의 자리에 난 것이
 * 눈에 무엇으로 보이는가이고, 규칙은 셋을 갈라 보지 않는다 (W40 — mode 는 데이터의 글자다).
 * 갈리는 자리는 이 코드와 그것을 읽는 View 의 표뿐이다.
 */
export const FORM_CARCASS_BLOOM = 'carcass-bloom';

// ── C025 ADDED — 사슬의 나머지 둘 (Play §5.6 · Concept §4 의 숲의 생태 사슬) ──
//
// 앞의 둘과 갈리는 것이 하나 있다 — **태어나지 않는다.** 광식충은 결속과 계승으로,
// 거목균은 변성으로 그 자리에 나지만 이 둘은 탄생지를 가지지 않는다: 값을 굴리는 것이
// **관계**이기 때문이다 (spec World Change 2 · R1). 그래서 여기 적히는 것도 앞의 둘과
// 한 글자도 다르지 않다 — 무엇이 · 어느 원인에서 · 어느 개체군으로 사는가까지다.

/**
 * 대형 조류 — 광식충이 불어난 숲 안쪽으로 드는 것 (Concept §4 · Play §5.6 · 확정 6).
 *
 * 이것이 **개체군으로 서는** 이유는 광식충과 같다 — 값이 오르내릴 곳을 가져야 사슬의
 * 한 마디가 성립하기 때문이다. 갈리는 것은 **무엇이 그 값을 굴리는가**다: 광식충은
 * 태어남과 조건 결핍이 굴리고, 이것은 부름(CALLS)과 먹힘(EATS)이 굴린다.
 */
export const BIG_BIRD = 'BIG_BIRD';

/**
 * 포식수 — 새가 모인 곳으로 오는 둥지의 주인 (Concept §4 · Play §5.7 · 확정 6).
 *
 * 이 방의 이름이 처음부터 말하던 것이 이제 값으로 선다 — C014 가 세운 사체(NEST_CARCASS)가
 * **무엇이 두고 간 것인가**의 답이 이것이다 (광식충이 허물의 주인이었던 그 어법 그대로:
 * 원천이 먼저 서고 주인이 뒤에 온다). 걸어 다니며 사냥하는 몸은 3층의 몫이다 (Life F10).
 */
export const PREDATOR = 'PREDATOR';

/**
 * **떼의 의미 코드 둘** (C025 ADDED · V21 · Time §2.6) — 관찰 결과의 `presences[].presence`.
 *
 * 광식충의 떼(PRESENCE_ORE_EATER_SWARM)와 **같은 자리 · 같은 갈래**다. 개체군의 id 를 그대로
 * 쓰지 않는 까닭도 그대로다 — 세계는 개체군의 값도 그 이름도 투영하지 않으므로(spec
 * Observable), 관찰자가 읽는 것은 "여기 무엇이 돌고 있다" 는 코드 하나와 선 자락의 넓이뿐이다.
 */
export const PRESENCE_BIG_BIRD = 'big-bird-flock';
/** 둥지를 도는 것의 코드 — 위의 것과 같은 갈래다 */
export const PRESENCE_PREDATOR = 'predator-prowl';

/**
 * 이 세계가 아는 생명들 — C025 CHANGED: 넷이다.
 *
 * 넷 다 숲의 사슬 안에서 산다 (FOREST_CHAIN) — 거목이 빨아올린 것을 먹고 허물을 남기는
 * 자리, 그 거목이 빨아올릴 것을 사체에서 되돌리는 자리, 그리고 그 둘 사이를 잇는 두 마디다
 * (Concept §4 · D2 거목균 ②). 하나의 원인 아래 넷이 서므로 사슬이 한 바퀴로 닫힌다.
 */
export const LIFE_SEEDS: readonly LifeSeed[] = [
  { id: ORE_EATER, worldCause: FOREST_CHAIN },
  { id: TREE_FUNGUS, worldCause: FOREST_CHAIN },
  { id: BIG_BIRD, worldCause: FOREST_CHAIN },
  { id: PREDATOR, worldCause: FOREST_CHAIN },
];
