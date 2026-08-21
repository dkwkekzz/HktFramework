// World Semantic — Character Catalog
//
// CharacterKind 하나가 정하는 시뮬레이션 정적 데이터의 단일 출처.
// 몸(크기·질량·기본 방향), 자원(생명·기력), 템포(속도·배율), 거리(사거리·인지)를
// 종류마다 한 항목으로 모은다 — 흩어져 있던 BODY_SIZE_BY_KIND(collision) ·
// COMBAT_PROFILES(combat) · ATTACK_RANGE/PERCEPTION_RANGE/MOVE_SPEED(world-state) 의 통합.
//
// 새 종류 추가는 정확히 세 곳이다 (kind 정적 데이터 3원소 — CLAUDE.md):
//   1. 여기 한 항목                                  (시뮬레이션)
//   2. view/kind-presentation.ts (팩) 한 항목 (표현)
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
// C013 CHANGED — 여섯 값. 관통 둘은 상대 방어의 값어치를 떨어뜨리는 능력이며
// 자기 피해를 키우지 않는다 (INTENT-PENETRATION-001).
export interface CombatSpec {
  physicalAttack: number; // 물리 방식 피해를 키운다
  auraAttack: number; // 오라 방식 피해를 키운다
  armor: number; // 물리 방식 피해를 줄인다
  resistance: number; // 오라 방식 피해를 줄인다
  armorPenetration: number; // 상대의 Armor 를 통하지 않게 만든다 (C013)
  resistancePenetration: number; // 상대의 Resistance 를 통하지 않게 만든다 (C013)
  // C015 CHANGED — 여덟 값. Critical 둘은 결과값을 증폭할 뿐 계산에 들어가지 않는다
  // (INTENT-CRITICAL-AMPLIFY-001).
  criticalChance: number; // 0~1 — 터질 가능성
  criticalDamage: number; // 1 이상 — 터졌을 때의 배율
}

export interface CharacterDefinition {
  body: BodySpec;
  facing: Readonly<WorldPosition>; // 스폰 시 몸이 향하는 방향 (단위 벡터)
  tempo: TempoSpec;
  resources: ResourceSpec;
  combat: CombatSpec; // C010
  // C023 CHANGED — 이름이 뜻을 따라간다. 이 값은 더 이상 칼끝이 닿는 길이의 출처가
  // 아니다 (그것은 SkillDefinition.SwingReach 가 지닌다). 남은 뜻은 하나 —
  // **스스로 판단하는 존재가 상대에게 얼마나 다가가는가** (RULE-NPC-DECIDE-001).
  // 그 자리에서 어느 기술이든 닿는다는 보장은 RULE-ENGAGEMENT-REACHES-001 이 진다.
  engagementRange: number;
  perceptionRange: number; // RULE-NPC-DECIDE-001 의 인지 거리 — control = autonomous 일 때만 의미
  // C016 ADDED — 통찰. combat 안에 두지 않는다: 겨루는 힘이 아니라 아는 힘이며
  // 가려지는 목록(CONCEALABLE_ATTRIBUTE_KEYS)에 들어가지 않기 때문이다.
  // 인지 거리(perceptionRange)가 "몸이 무엇을 알아채는가" 라면 이것은
  // "눈이 무엇을 읽어내는가" 다 — 나란한 자리에 둔다.
  insight: number; // 0~100 — 살펴보지 않고도 아는 범위 (INTENT-INSIGHT-001)
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
    // C013 — 오라를 실은 검이 오라 방어를 가른다.
    // 관찰자의 몸이 이 종류다 (RULE-OBSERVER-JOIN-001) — 플레이어가 관통을 지닌 쪽이다.
    // 오라 쪽에 둔 이유: 이 종류가 마주하는 wanderer 의 단단한 쪽이 Resistance 90 이고,
    // 이 종류는 AuraAttack 40 을 지니고도 그 벽 때문에 오라를 쓸 수 없었다.
    // 관통은 그 벽을 깎아 통과하는 것이다 (MP-PIERCE-THE-HARD-DEFENSE).
    // 물리 쪽은 0 이다 — 아래 층들(C007·C010·C011)의 기준값이 물리 타격이며,
    // 그 값들이 흔들리지 않아야 각 층이 위층 없이도 서 있는 것이 확인된다
    // (DC-COMBAT-ONE-LAYER-AT-A-TIME).
    combat: {
      physicalAttack: 40,
      auraAttack: 40,
      armor: 50,
      resistance: 20,
      armorPenetration: 0,
      resistancePenetration: 60,
      // C015 — 넷에 하나꼴로 두 배가 터진다. 터뜨리는 쪽은 플레이어다 (03 BALANCE).
      // 기대 배수 1.25 라 아래 층들의 체감을 무너뜨리지 않으면서,
      // 한 번의 교전(6대 안팎) 안에서 대개 한두 번 눈에 보인다.
      criticalChance: 0.25,
      criticalDamage: 2.0,
    },
    engagementRange: 2.0,
    perceptionRange: 9.0,
    // C016 — 0 으로 시작한다. 기른 적이 없는 눈이며, 이 값이 0 인 동안
    // 세계는 C015 와 한 톨도 다르지 않다 (03 BALANCE · Regression 기준).
    // 통찰을 올리는 경로는 아직 세계에 없다 — 지금은 디버그 명령이 유일하다.
    insight: 0,
  },
  wanderer: {
    body: { radius: 0.7, height: 2.8, mass: 1.0 },
    facing: { x: 0, z: 1 },
    // 자율 존재는 더 느리게 움직인다 — 행동 관찰이 목적
    tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
    resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
    // C012 — 물리 이행값(40 · 30)은 C010 그대로다.
    // 몸은 무르나 오라는 거의 통하지 않고(Resistance 90), 오라로 치는 힘도 약하다.
    // C013 — 관통을 지니지 않는다. 이 종류가 내는 모든 피해는 C012 와 완전히 같다.
    combat: {
      physicalAttack: 40,
      auraAttack: 15,
      armor: 30,
      resistance: 90,
      armorPenetration: 0,
      resistancePenetration: 0,
      // C015 — 터뜨리지 못한다. 이 종류가 내는 모든 피해는 C013 과 완전히 같다.
      // 그래서 **관찰자가 맞는 값이 흔들리지 않는다** — C007 이래의 체감 기준값
      // (자율 존재의 기본 스킬 12대를 견딘다)이 그대로 성립한다.
      // 아래 층들이 위층 없이도 서 있다는 증거를 남기기 위한 것이며,
      // C013 이 관통을 오라 쪽에만 둔 것과 같은 판단이다 (DC-COMBAT-ONE-LAYER-AT-A-TIME).
      criticalChance: 0,
      criticalDamage: 1.0,
    },
    engagementRange: 2.0,
    perceptionRange: 9.0,
    // C016 — 자율 존재는 이 값을 쓰지 않는다. 그들은 관찰 계약이 아니라
    // 세계 상태를 직접 읽으므로 가려짐 관문 밖이다 (RULE-NPC-DECIDE-001 무변경).
    // 그래도 값을 지닌다 — 몸이 지니는 성질이지 조종자의 것이 아니기 때문이다.
    insight: 0,
  },
};

// 등록되지 않은 종류의 기본 정의 — 모르는 종류의 존재도 크기·자원 없이 서 있지 않게 한다
export const DEFAULT_CHARACTER: CharacterDefinition = {
  body: { radius: 0.6, height: 2.4, mass: 1.0 },
  facing: { x: 0, z: 1 },
  tempo: { moveSpeed: 2.5, runSpeedMultiplier: 1.4, actionSpeed: 0.85 },
  resources: { hpMax: 120, cpMax: 60, cpStart: 20 },
  // C012 · C013 · C015 — wanderer 와 같다. 미등록 종류의 폴백이며 관찰자의 몸이 아니다
  // (관찰자는 RULE-OBSERVER-JOIN-001 이 rabbit-swordsman 으로 세운다).
  combat: {
    physicalAttack: 40,
    auraAttack: 15,
    armor: 30,
    resistance: 90,
    armorPenetration: 0,
    resistancePenetration: 0,
    criticalChance: 0,
    criticalDamage: 1.0,
  },
  engagementRange: 2.0,
  perceptionRange: 9.0,
  insight: 0,
};

export function characterDefinition(kind: CharacterKind): CharacterDefinition {
  return CHARACTER_CATALOG[kind] ?? DEFAULT_CHARACTER;
}
