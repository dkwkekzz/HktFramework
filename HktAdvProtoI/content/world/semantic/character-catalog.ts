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
  perceptionRange: number; // RULE-NPC-DECIDE-001 의 인지 거리 — control = autonomous 일 때만 의미
}

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
    perceptionRange: 9.0,
  },
  wanderer: {
    body: { radius: 0.7, height: 2.8, mass: 1.0 },
    facing: { x: 0, z: 1 },
    // 자율 존재는 더 느리게 움직인다 — 행동 관찰이 목적
    tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
    resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
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
  attackRange: 2.0,
  perceptionRange: 9.0,
};

export function characterDefinition(kind: CharacterKind): CharacterDefinition {
  return CHARACTER_CATALOG[kind] ?? DEFAULT_CHARACTER;
}
