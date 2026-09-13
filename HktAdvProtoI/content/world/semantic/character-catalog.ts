// World Semantic — Character Catalog
//
// CharacterKind 하나가 정하는 시뮬레이션 정적 데이터의 단일 출처.
// 몸(크기·질량·기본 방향), 자원(생명·기력), 템포(속도·배율), 거리(사거리·인지)를
// 종류마다 한 항목으로 모은다 — 흩어져 있던 BODY_SIZE_BY_KIND(collision) ·
// COMBAT_PROFILES(combat) · ATTACK_RANGE/PERCEPTION_RANGE/MOVE_SPEED(world-state) 의 통합.
//
// 새 종류 추가는 정확히 세 곳이다 (kind 정적 데이터 3원소 — CLAUDE.md):
//   1. 여기 한 항목                                  (시뮬레이션)
//   2. view/presentation/kind-presentation.ts 한 항목 (표현)
//   3. motions/<kind>/ 폴더                          (그림 — 없으면 placeholder 로 그려진다)
// 전체는 `npm run catalog` 로 한눈에 관찰한다 (tools/catalog).
//
// 상수는 결정론에 영향을 주므로 헤더 상수로 고정한다 — 외부 파일 로드로 바꾸지 않는다.

import type { CharacterKind } from './actor';
import type { WorldPosition } from './position';

// Actor.Body — 몸 캡슐의 반경·높이·질량.
// 그림 크기는 View 가 Body.Height 에서 유도하므로(04 spec) 충돌체와 이미지가 항상 일치한다.
export interface BodySpec {
  radius: number;
  height: number;
  mass: number;
}

// TempoStats — 세계의 속도를 정하는 능력치
export interface TempoSpec {
  moveSpeed: number; // 걷는 속도 (unit/sec) — RULE-MOVE-PROGRESS-001
  runSpeedMultiplier: number; // 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
}

// 전투 자원 — 생명은 타격만이, 기력은 스킬 수지와 달리기만이 바꾼다
export interface ResourceSpec {
  hpMax: number;
  cpMax: number;
  cpStart: number;
}

export interface CharacterDefinition {
  body: BodySpec;
  facing: Readonly<WorldPosition>; // 스폰 시 몸이 향하는 방향 (단위 벡터)
  tempo: TempoSpec;
  resources: ResourceSpec;
  attackRange: number; // RULE-ATTACK-001 Precondition 2 의 거리 한계
  /**
   * 그 종류가 인지 범위에 거는 **상한** (C039 CHANGED · RULE-AWARENESS-001 · spec 규칙 4 ②).
   *
   * 고정값이 아니라 **몫**이다: 이 수는 몸에 걸리는 Source 하나(`cap awareness`)가 되고,
   * 때와 자락이 거는 상한과 겹쳐 **가장 작은 것**이 그 몸의 인지 범위가 된다
   * (semantic/body-property.ts). `+Infinity` 는 「제한 없음」이다 — 그 종류는 스스로
   * 아무것도 좁히지 않는다는 뜻이고, 그때 인지 범위는 때와 자락만이 정한다.
   */
  perceptionRange: number;
  /**
   * 그 종류로 태어난 몸의 **Core** (C039 ADDED · RULE-BODY-CORE-001 · spec 규칙 7 ①).
   *
   * 계열을 가리키는 코드다 — 사람이 읽는 말이 아니다 (「야수계」는 View 의 표가 옮긴다).
   * 이 세계가 그 종류의 계열을 아직 말하지 않았으면 **빈 글자**다: 없는 계열을 지어내지 않는다.
   */
  core: string;
}

// ── 계열의 코드 (Expedition §1.2 — 이 세계의 글자이지 사람이 읽는 말이 아니다) ──

/** 야수계 (Q2 — 첫째 요정의 Core) */
export const CORE_BEAST = 'beast';
/** 이 세계가 아직 그 종류의 계열을 말하지 않았다 — 빈 글자가 곧 「없음」이다 */
export const CORE_UNDECLARED = '';

// 자원 균형 — 기본 스킬 20 · 고급 스킬 55 를 기준으로:
//   자율 존재(120)는 기본 6대 또는 고급 2대 + 기본 1대에 쓰러진다.
//   관찰자의 몸(200)은 자율 존재의 기본 스킬 10대를 견딘다.
//   고급 스킬(소모 30, 충전 8)은 기본 스킬 3대(충전 36)를 모아야 한 번 나간다.
export const CHARACTER_CATALOG: Readonly<Record<string, CharacterDefinition>> = {
  'rabbit-swordsman': {
    body: { radius: 0.85, height: 3.4, mass: 1.0 },
    facing: { x: 0, z: 1 },
    tempo: { moveSpeed: 6.0, runSpeedMultiplier: 1.8, actionSpeed: 1.0 },
    resources: { hpMax: 200, cpMax: 100, cpStart: 30 },
    attackRange: 2.0,
    // C039 CHANGED — **제한 없음** (spec 규칙 4 ② · 기본형 ③). 관찰자의 몸은 낮에 방 전체가
    // 보이고, 밤과 눈보라가 그것을 좁힌다 — 좁히는 수는 이제 때와 자락의 것이다.
    perceptionRange: Number.POSITIVE_INFINITY,
    core: CORE_BEAST, // 야수계 (Q2)
  },
  wanderer: {
    body: { radius: 0.7, height: 2.8, mass: 1.0 },
    facing: { x: 0, z: 1 },
    // 자율 존재는 더 느리게 움직인다 — 행동 관찰이 목적
    tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
    resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
    attackRange: 2.0,
    perceptionRange: 9.0,
    // 떠도는 자의 계열은 기획서에 없다 — 지어내지 않고 빈 글자로 둔다
    core: CORE_UNDECLARED,
  },
};

// 등록되지 않은 종류의 기본 정의 — 모르는 종류의 존재도 크기·자원 없이 서 있지 않게 한다
export const DEFAULT_CHARACTER: CharacterDefinition = {
  body: { radius: 0.6, height: 2.4, mass: 1.0 },
  facing: { x: 0, z: 1 },
  tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
  resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
  attackRange: 2.0,
  perceptionRange: 9.0,
  core: CORE_UNDECLARED,
};

export function characterDefinition(kind: CharacterKind): CharacterDefinition {
  return CHARACTER_CATALOG[kind] ?? DEFAULT_CHARACTER;
}
