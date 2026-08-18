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

// Actor.Body — 몸 캡슐의 반경·높이·질량 (C006).
// 그림 크기는 View 가 Body.Height 에서 유도하므로(04 spec) 충돌체와 이미지가 항상 일치한다.
export interface BodySpec {
  radius: number;
  height: number;
  mass: number;
}

// TempoStats (C007) — 세계의 속도를 정하는 능력치
export interface TempoSpec {
  moveSpeed: number; // 걷는 속도 (unit/sec) — RULE-MOVE-PROGRESS-001
  runSpeedMultiplier: number; // 달릴 때 이동 속도에 곱해지는 값
  actionSpeed: number; // 스킬 행동 길이에 걸리는 배율 (클수록 빠르다)
}

// 전투 자원 (C007) — 생명은 타격만이, 기력은 스킬 수지와 달리기만이 바꾼다
export interface ResourceSpec {
  hpMax: number;
  cpMax: number;
  cpStart: number;
}

// 전투 능력치 (C010 → C012 CHANGED) — 한 방의 크기를 정하는 네 값.
// 어느 둘을 읽을지는 그 타격의 방식이 정한다 (RULE-DAMAGE-CALCULATE-001 Step 0).
export interface CombatSpec {
  physicalAttack: number; // 물리 방식 피해를 키운다
  auraAttack: number; // 오라 방식 피해를 키운다
  armor: number; // 물리 방식 피해를 줄인다
  resistance: number; // 오라 방식 피해를 줄인다
}

export interface CharacterDefinition {
  body: BodySpec;
  facing: Readonly<WorldPosition>; // 스폰 시 몸이 향하는 방향 (단위 벡터)
  tempo: TempoSpec;
  resources: ResourceSpec;
  combat: CombatSpec; // C010
  attackRange: number; // RULE-ATTACK-001 Precondition 2 의 거리 한계
  perceptionRange: number; // RULE-NPC-DECIDE-001 의 인지 거리 — control = autonomous 일 때만 의미
}

// 자원 균형 (C007 → C010 재서술) — 피해가 고정값이 아니라 공식의 결과가 되었으므로
// "몇 대에 쓰러지는가" 의 근거도 공식이다 (RULE-DAMAGE-CALCULATE-001).
//   관찰자(A40) → 자율 존재(D30)  기본 20 · 고급 55   ← C007 의 고정값과 같다
//       자율 존재(120)는 기본 6대 또는 고급 2대 + 기본 1대에 쓰러진다  (C007 그대로)
//   자율 존재(A40) → 관찰자(D50)  기본 17            ← C007 은 20 이었다
//       관찰자의 몸(200)은 자율 존재의 기본 스킬 12대를 견딘다 (C007 은 10대)
//   더 오래 버티는 것은 rabbit-swordsman 의 방어 능력(50)이 wanderer(30)보다 높기 때문이다 —
//   이 Cycle 이 만든 의미이며, 두 종류의 Attack 을 같은 값으로 둔 것도 공격 체감 보존을
//   위해서다 (C010 03-world-semantic.md 의 BALANCE · 05-review.md APPROVED).
//   고급 스킬(소모 30, 충전 8)은 기본 스킬 3대(충전 36)를 모아야 한 번 나간다.
export const CHARACTER_CATALOG: Readonly<Record<string, CharacterDefinition>> = {
  'rabbit-swordsman': {
    body: { radius: 0.85, height: 3.4, mass: 1.0 },
    facing: { x: 0, z: 1 },
    tempo: { moveSpeed: 6.0, runSpeedMultiplier: 1.8, actionSpeed: 1.0 },
    resources: { hpMax: 200, cpMax: 100, cpStart: 30 },
    // C012 — 물리 이행값(40 · 50)은 C010 그대로다. 오라 쪽이 새로 선다.
    // 검을 쓰는 단단한 몸이지만 오라를 받아내는 데는 약하다 (Resistance 20).
    combat: { physicalAttack: 40, auraAttack: 40, armor: 50, resistance: 20 },
    attackRange: 2.0,
    perceptionRange: 9.0,
  },
  wanderer: {
    body: { radius: 0.7, height: 2.8, mass: 1.0 },
    facing: { x: 0, z: 1 },
    // 자율 존재는 더 느리게 움직인다 — 행동 관찰이 목적
    tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
    resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
    // C012 — 물리 이행값(40 · 30)은 C010 그대로다.
    // 몸은 무르나 오라는 거의 통하지 않고(Resistance 90), 오라로 치는 힘도 약하다.
    combat: { physicalAttack: 40, auraAttack: 15, armor: 30, resistance: 90 },
    attackRange: 2.0,
    perceptionRange: 9.0,
  },
};

// 등록되지 않은 종류의 기본 정의 — 모르는 종류의 존재도 크기·자원 없이 서 있지 않게 한다
export const DEFAULT_CHARACTER: CharacterDefinition = {
  body: { radius: 0.6, height: 2.4, mass: 1.0 },
  facing: { x: 0, z: 1 },
  tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
  resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
  combat: { physicalAttack: 40, auraAttack: 15, armor: 30, resistance: 90 }, // C012 — wanderer 와 같다
  attackRange: 2.0,
  perceptionRange: 9.0,
};

export function characterDefinition(kind: CharacterKind): CharacterDefinition {
  return CHARACTER_CATALOG[kind] ?? DEFAULT_CHARACTER;
}
