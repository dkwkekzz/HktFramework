// Effect Presentation (F1) — 세계의 사건을 어떤 이펙트로 얼마나 세게 드러낼지 정한다.
//
// 세계는 이펙트를 모른다. 세계가 보내는 것은 의미뿐이다 — 무슨 스킬이었고(skill), 무엇으로
// 쳤고(damageType), 얼마나 들어갔고(amount), 막혔는지 무너졌는지(guard), 크게 터졌는지
// (critical). 그것을 "무슨 이펙트를 얼마나 세게" 로 옮기는 자리가 여기다.
//
// ── 이 파일의 전부는 네 개의 표다 ────────────────────────────────────
//
//   SKILL_EFFECTS        스킬 하나가 화면에서 어떻게 터지는가  ← 스킬마다 따로 조절한다
//   DAMAGE_TYPE_EFFECTS  등록되지 않은 스킬의 기본값 (방식으로만 가른다)
//   GUARD_EFFECTS        막힘 · 무너짐 (치는 쪽이 아니라 받는 쪽의 사건이다)
//   WORLD_EVENT_EFFECTS  타격이 아닌 사건 (채굴 · 알게 됨)
//
// 새 스킬이 생기면 SKILL_EFFECTS 에 **한 줄**이 는다. 그 줄이 그 스킬의 이펙트와 수치를
// 통째로 소유한다 — 코드에 스킬 이름으로 분기하는 곳은 이 파일 어디에도 없다.
//
// ── 왜 세계에 이펙트를 넣지 않는가 ────────────────────────────────────
// 이펙트를 세계에 두면 세계가 그림을 알게 된다. 그러면 같은 규칙에 두 개의 진실이
// 생긴다 — 판정의 진실(피해 12)과 화면의 진실(어떤 이펙트). 관찰자마다 다른 그림을
// 쓰고 싶어지는 순간(저사양·접근성·다른 팩) 세계를 고쳐야 한다.
// 세계는 사건을 낳고, 이펙트는 그 사건의 *읽는 법*이다.
//
// ── 무엇이 수치이고 무엇이 게놈인가 ──────────────────────────────────
// 여기 있는 수치는 **사건이 정하는 것**뿐이다 (세기 · 자리 · 축 · 각도 · 초기 반경).
// 이펙트의 *모양*(퍼짐·갈래·점멸·색)은 게놈이며 `splat/fx.js` 의 FX_PRESETS 가 소유한다.
// 새 모양이 필요하면 그것은 이 파일의 일이 아니라 랩(tools/fx-lab/)에서 맞출 게놈 한 줄이다.
// 이 경계를 지켜야 "새 이펙트 = 게놈 한 줄, 코드 0" 이 유지된다.

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../../engine/protocol-core/gameview';
import type { SceneEffect } from '../../../engine/view-kernel/scene/scene-state';
import type { EntityView, GameViewSnapshot, StrikeEventView } from '../protocol/gameview';

/**
 * 이 게임이 화면에 올리는 이펙트 세트 = **예산**.
 *
 * 스플랫 풀은 슬라이스 8개로 나뉘고 이펙트마다 한 슬라이스를 쓴다. 기반 개체가 하나를
 * 가져가므로 동시에 올릴 수 있는 것은 7개다 — "전부 올린다" 는 선택지가 아니라
 * *무엇을 같이 쓸지* 의 결정이다. 아래 표가 그 7칸의 지금 배정이다.
 * 굴절 이펙트(굴절 파면)는 빠져 있다 — 오버레이 뒤에는 휘게 할 배경이 없다.
 */
export const EFFECT_SET = [
  '타격', // 물리 타격 — 방사 가시별 (검격을 게놈 동반으로 함께 켠다)
  '검격', // 칼자국 — 타격의 동반. 각도는 사건이 준다
  '전격', // 아우라 타격 — 지글거리는 방전
  '파이어볼 폭발', // 무겁게 터진 한 방 — 부푸는 화구
  '물결파', // 막아 낸 파문 — 튕겨 나가는 고리
  '삼중 파문', // 방어가 무너진 순간 — 겹 고리가 터져 나간다
  '회복 오라', // 알게 된 순간 — 몸을 감싸고 떠오른다
] as const;

/**
 * 스킬 하나가 화면에서 어떻게 터지는가.
 *
 * **이 표가 스킬별 이펙트의 단일 출처다.** 값 하나하나가 그 스킬만의 것이며,
 * 다른 스킬에 영향을 주지 않는다.
 */
export interface SkillEffectTuning {
  /** 주 이펙트 게놈 */
  effect: string;
  /**
   * 함께 켜는 이펙트들 — 같은 자리·같은 축·같은 세기.
   * 게놈이 지닌 동반(FX_PRESETS 의 `with`)과는 별개다: 그쪽은 "이 모양의 일부",
   * 이쪽은 "이 스킬의 연출". 타격의 검격은 게놈 동반이므로 여기 적지 않는다.
   */
  with?: readonly string[];
  /**
   * 이 스킬의 **정통 한 방** 피해량. 세기 = floor + amount / reference.
   *
   * 기준을 스킬이 갖는 것이 핵심이다 — 고급 스킬(≈55)과 기본 스킬(≈20)을 같은 자로
   * 재면 기본 스킬은 영원히 스침으로만 보인다.
   */
  reference: number;
  /** 최소 세기 — 스치기만 해도 이만큼은 보인다 */
  floor: number;
  /** 최대 세기 — 이 위로는 화면을 뒤덮는다 */
  ceiling: number;
  /** 크게 터졌을 때(C015) 세기에 곱하는 값 */
  criticalBoost: number;
  /**
   * 터짐을 따로 그릴 이펙트. 없으면 그리지 않는다 —
   * 이미 큰 이펙트를 쓰는 스킬은 터짐이 세기로만 드러나는 편이 읽힌다.
   */
  criticalEffect?: string;
  /** 맞은 몸 높이의 몇 할에서 터지는가 */
  elevationRatio: number;
  /** 태어나는 껍질의 초기 반경 (m). 없으면 게놈 기본(0.06) */
  radius?: number;
  /** 칼날 각도의 흔들림 폭 (rad, 전폭). 0 이면 늘 같은 각으로 벤다 */
  rollSpread: number;
  /** 축을 얼마나 위로 드는가 — 0 이면 원판이 지면과 나란해져 위에서만 보인다 */
  lift: number;
}

export const SKILL_EFFECTS: Readonly<Record<string, SkillEffectTuning>> = {
  // 기본 스킬 (baseDamage 6 · ratio 0.5 · 0.6s) — 빠르고 가볍다.
  // 가시별 하나로 끝난다. 각이 넓게 흔들려 연타가 같은 그림으로 반복되지 않는다.
  attack: {
    effect: '타격',
    reference: 20, // C010 역산값: (6 + 40×0.5) × 100/130 = 20
    floor: 0.45,
    ceiling: 2.3,
    criticalBoost: 1.35,
    criticalEffect: '파이어볼 폭발',
    elevationRatio: 0.55,
    radius: 0.05,
    rollSpread: 1.4,
    lift: 0.25,
  },
  // 고급 스킬 (baseDamage 32 · ratio 1.0 · 0.9s) — 묵직하다.
  // 가시별에 **화구가 함께** 터지고, 바닥 세기부터 기본 스킬의 배다.
  // 초기 반경이 커서 점이 아니라 벌어진 자리에서 시작한다 (후려친 면적).
  // 각은 거의 흔들리지 않는다 — 큰 동작은 매번 같은 궤적으로 읽혀야 한다.
  'heavy-attack': {
    effect: '타격',
    with: ['파이어볼 폭발'],
    reference: 55, // (32 + 40×1.0) × 100/130 = 55
    floor: 0.85,
    ceiling: 2.6,
    criticalBoost: 1.25,
    // 이미 화구가 붙는 스킬이다 — 터짐은 세기로만 더 크게 드러낸다
    elevationRatio: 0.55,
    radius: 0.14,
    rollSpread: 0.5,
    lift: 0.35,
  },
  // 오라 스킬 (기본 스킬과 값이 같고 방식만 다르다 — C012) — 그래서 갈리는 것도
  // 세기가 아니라 **결**이다: 방사 가시가 아니라 지글거리는 방전이 오른다.
  // 각을 흔들지 않는다 (방전은 베는 것이 아니다).
  'aura-strike': {
    effect: '전격',
    reference: 20,
    floor: 0.5,
    ceiling: 2.3,
    criticalBoost: 1.35,
    criticalEffect: '파이어볼 폭발',
    elevationRatio: 0.55,
    radius: 0.05,
    rollSpread: 0,
    lift: 0.15,
  },
  // 발현 일격 (C-COMBAT-003 — baseDamage 10 · ratio 1.3 · 0.9s) — 오라 결의 큰 기술.
  // 오라 스킬의 **방전**에 고급 스킬의 **화구**를 함께 올린다: 방식은 오라 쪽에서,
  // 무게는 큰 기술 쪽에서 온다. 새 게놈을 만들지 않는다 (F1 규칙 2 · 예산 7 그대로).
  //
  // 기준이 60 인 것은 관문을 지난 몸이 내는 값이기 때문이다 — 사정 없이 60, 조건
  // 하나에 76, 둘에 92 (03 BALANCE ②). 고급 스킬(55)의 자로 재면 조건이 붙은 한 방이
  // 늘 천장에 붙어 **사정이 화면에서 구별되지 않는다**.
  'hatsu-burst': {
    effect: '전격',
    with: ['파이어볼 폭발'],
    reference: 60,
    floor: 0.85,
    ceiling: 2.6,
    criticalBoost: 1.25,
    elevationRatio: 0.55,
    radius: 0.12,
    rollSpread: 0,
    lift: 0.3,
  },
  // 표식 남기기 (C-COMBAT-004 — 피해 0) — **세기가 없다.**
  // 바닥과 천장을 같은 값으로 두어 언제나 같은 크기로 찍힌다: 이 기술에는 잴 피해가
  // 없으므로 세기의 기준도 없다 (F1 규칙 2 는 "세기는 사건의 값에서 나온다" 인데,
  // 값이 0 인 사건에서 나올 세기가 없다는 것이 이 표의 정직한 답이다).
  // 새 게놈을 만들지 않는다 — 오라의 결(전격)을 작고 낮게 쓴다 (예산 7 그대로).
  'mark-strike': {
    effect: '전격',
    reference: 1,
    floor: 0.55,
    ceiling: 0.55,
    criticalBoost: 1.0, // 터지지 않는다 — 터질 피해가 없다
    elevationRatio: 0.55,
    radius: 0.04,
    rollSpread: 0,
    lift: 0.1,
  },
};

/**
 * 표에 없는 스킬의 기본값 — 방식(damageType)으로만 가른다.
 * 새 스킬이 세계에 생겼는데 여기 등록이 늦어도 화면은 멈추지 않는다
 * (등록 누락이 게임을 멈추지 않는다 — view-implementation Guide).
 */
export const DAMAGE_TYPE_EFFECTS: Readonly<Record<string, SkillEffectTuning>> = {
  physical: { ...SKILL_EFFECTS['attack']! },
  aura: { ...SKILL_EFFECTS['aura-strike']! },
};

/** 막기가 한 일 (C011) — 치는 쪽이 아니라 받는 쪽의 사건이라 표가 따로다 */
export interface GuardEffectTuning {
  effect: string;
  /** 세기의 기준이 되는 값 (막힘은 *덜 들어간 만큼*, 무너짐은 고정) */
  reference: number;
  floor: number;
  ceiling: number;
  /** 참이면 피해량과 무관하게 floor 를 그대로 쓴다 */
  fixed?: boolean;
  radius?: number;
}

export const GUARD_EFFECTS: Readonly<Record<'blocked' | 'broken', GuardEffectTuning>> = {
  // 막아 낸 파문의 크기는 덜 들어간 만큼이다 — 많이 막았을수록 크게 튕긴다
  blocked: { effect: '물결파', reference: 18, floor: 0.4, ceiling: 2.2, radius: 0.1 },
  // 무너짐은 피해량과 무관하게 큰 사건이다 — 얼마나 아팠느냐가 아니라 방어가 사라졌다는 뜻
  broken: { effect: '삼중 파문', reference: 1, floor: 1.6, ceiling: 1.6, fixed: true, radius: 0.12 },
};

/** 타격이 아닌 사건 (C001 채굴 · C014·C016 알게 됨) */
export interface WorldEventEffectTuning {
  effect: string;
  strength: number;
  elevationRatio: number;
  radius?: number;
  rollSpread: number;
}

export const WORLD_EVENT_EFFECTS: Readonly<Record<'mine' | 'acquaint', WorldEventEffectTuning>> = {
  // 곡괭이가 닿은 자리 — 위로 튄다 (캐는 사람의 자리를 세계가 사건으로 주지 않는다)
  mine: { effect: '타격', strength: 0.7, elevationRatio: 0.45, radius: 0.05, rollSpread: 1.4 },
  // 가려져 있던 것이 열렸다 — 몸을 감싸고 떠오른다
  acquaint: { effect: '회복 오라', strength: 1, elevationRatio: 0.25, radius: 0.2, rollSpread: 0 },
};

/**
 * 직전 관찰 결과에서 기억해 두는 값들.
 *
 * 이펙트 가운데 일부는 세계가 *사건*으로 보내지 않는다 — 채굴은 광맥의 잔량이 줄어드는
 * 것으로만, 알게 됨은 acquainted 가 뒤집히는 것으로만 드러난다. 그런 것은 두 관찰
 * 결과의 *차이*로 읽어야 한다. C008 의 facingSides 와 같은 규칙이다 —
 * 조립 루트가 기억하고, 결정 Layer 는 읽기만 한다 (순수함이 깨지지 않는다).
 */
export interface EffectMemory {
  /** entity.id → 그때의 labelValue (광맥 잔량 등) */
  labels: Record<string, number>;
  /** entity.id → 그때 다 알고 있었는가 */
  acquainted: Record<string, boolean>;
}

export const EMPTY_EFFECT_MEMORY: EffectMemory = { labels: {}, acquainted: {} };

/**
 * 이번 관찰 결과에서 기억해 둘 것 — 다음 프레임의 기준이 된다.
 * 조립 루트가 부르므로 봉투 형으로 받아 팩 형으로 좁힌다 (resolve.ts 와 같은 규칙).
 */
export function rememberForEffects(observed: CoreGameViewSnapshot): EffectMemory {
  const snapshot = observed as GameViewSnapshot;
  const labels: Record<string, number> = {};
  const acquainted: Record<string, boolean> = {};
  for (const entity of snapshot.entities) {
    if (typeof entity.labelValue === 'number') labels[entity.id] = entity.labelValue;
    if (entity.attributes) acquainted[entity.id] = entity.attributes.acquainted;
  }
  return { labels, acquainted };
}

/** 이 스킬이 화면에서 어떻게 터지는가 — 등록이 없으면 방식으로 떨어진다 */
export function skillEffect(skill: string, damageType: string): SkillEffectTuning {
  return (
    SKILL_EFFECTS[skill] ??
    DAMAGE_TYPE_EFFECTS[damageType] ??
    DAMAGE_TYPE_EFFECTS['physical']!
  );
}

/**
 * 이번 관찰 결과가 켜야 할 이펙트들.
 *
 * 같은 타격이 여러 프레임 동안 실려 와도(TTL) id 가 같으므로 켜지는 것은 한 번뿐이다 —
 * 두 번 켜지 않게 막는 것은 capability 쪽이다 (renderer 가 id 를 기억한다).
 */
export function effectMarks(
  snapshot: GameViewSnapshot,
  before: EffectMemory,
  spriteSizeOf: (entity: EntityView | undefined) => number,
): SceneEffect[] {
  const marks: SceneEffect[] = [];
  const entityOf = (id: string): EntityView | undefined =>
    snapshot.entities.find((e) => e.id === id);

  for (const strike of snapshot.strikes) {
    marks.push(...strikeEffects(strike, entityOf, spriteSizeOf));
  }

  for (const entity of snapshot.entities) {
    // 채굴 (C001) — 세계는 "한 번 캤다" 를 사건으로 내지 않는다. 잔량이 줄어든 것이
    // 그 사건이다. 캐는 쪽이 아니라 캐이는 쪽에서 터진다 (곡괭이가 닿은 자리).
    const was = before.labels[entity.id];
    const now = entity.labelValue;
    if (was !== undefined && typeof now === 'number' && now < was) {
      const tuning = WORLD_EVENT_EFFECTS.mine;
      const id = `mine:${entity.id}@${was}`;
      marks.push({
        id,
        effect: tuning.effect,
        position: entity.position,
        elevation: spriteSizeOf(entity) * tuning.elevationRatio,
        direction: { x: 0, y: 1, z: 0 },
        strength: tuning.strength,
        roll: rollOf(id, tuning.rollSpread),
        ...(tuning.radius === undefined ? {} : { radius: tuning.radius }),
      });
    }

    // 알게 된 순간 (C014 살펴봄 · C016 통찰) — 가려져 있던 것이 열렸다.
    // 이것도 사건이 아니라 *뒤집힘*이다: acquainted 거짓 → 참.
    const knewBefore = before.acquainted[entity.id];
    const knowsNow = entity.attributes?.acquainted;
    if (knewBefore === false && knowsNow === true) {
      const tuning = WORLD_EVENT_EFFECTS.acquaint;
      marks.push({
        id: `acquaint:${entity.id}`,
        effect: tuning.effect,
        position: entity.position,
        elevation: spriteSizeOf(entity) * tuning.elevationRatio,
        direction: { x: 0, y: 1, z: 0 },
        strength: tuning.strength,
        ...(tuning.radius === undefined ? {} : { radius: tuning.radius }),
      });
    }
  }

  return marks;
}

// 한 번의 타격이 낳는 이펙트들.
//
// 무엇이 무엇을 고르는지가 이 함수의 전부이고, 고르는 값은 전부 위의 표에서 온다:
//   C010·C013  피해량 ÷ 그 스킬의 기준 = 세기 (관통이 방어를 걷어 피해가 커지면 함께 커진다)
//   C012       스킬이 정한 이펙트 — 등록이 없으면 방식으로 떨어진다
//   C011       막힘 → 물결파 · 무너짐 → 삼중 파문 (받는 쪽의 사건이라 표가 따로다)
//   C015       터짐 → 그 스킬이 정한 증폭, 그리고 그 스킬이 정한 표시 이펙트
function strikeEffects(
  strike: StrikeEventView,
  entityOf: (id: string) => EntityView | undefined,
  spriteSizeOf: (entity: EntityView | undefined) => number,
): SceneEffect[] {
  const tuning = skillEffect(strike.skill, strike.breakdown.damageType);
  const target = entityOf(strike.targetId);
  const attacker = entityOf(strike.attackerId);
  const elevation = spriteSizeOf(target) * tuning.elevationRatio;
  const guard = strike.breakdown.guard;
  const critical = strike.breakdown.critical;
  const key = `${strike.attackerId}->${strike.targetId}@${strike.since}`;

  // 막힌 타격은 몸에 덜 들어갔다 — 그 사실이 세기로 읽혀야 한다.
  // amount 는 이미 막고 난 뒤의 값이므로 따로 깎지 않는다 (C011 appliedDamage).
  const base = clamp(
    tuning.floor + strike.amount / tuning.reference,
    tuning.floor,
    tuning.ceiling,
  );
  const strength = clamp(
    base * (critical.occurred ? tuning.criticalBoost : 1),
    tuning.floor,
    tuning.ceiling,
  );

  // 축 = 맞은 쪽 법선. 때린 자리에서 맞은 자리로 향하는 쪽이며, 스킬이 정한 만큼 위로 든다.
  const direction = normalOf(attacker?.position, strike.at, tuning.lift);
  const roll = rollOf(strike.since + strike.targetId, tuning.rollSpread);
  const at = { x: strike.at.x, z: strike.at.z };
  const common = {
    position: at,
    elevation,
    direction,
    strength,
    roll,
    ...(tuning.radius === undefined ? {} : { radius: tuning.radius }),
  };

  const effects: SceneEffect[] = [{ id: `strike:${key}`, effect: tuning.effect, ...common }];

  // 이 스킬의 연출 동반 — 같은 자리·같은 축·같은 세기로 함께 깨어난다
  for (const name of tuning.with ?? []) {
    effects.push({ id: `strike-with:${name}:${key}`, effect: name, ...common });
  }

  // 막기가 한 일 (C011) — 숫자만으로는 "막았다" 가 순간에 읽히지 않는다.
  // 막힌 것과 무너진 것은 눈에 띄게 달라야 한다 (04 strikeEvents.meaning).
  const guardKind = guard?.blocked ? 'blocked' : guard?.broken ? 'broken' : null;
  if (guardKind) {
    const g = GUARD_EFFECTS[guardKind];
    effects.push({
      id: `${guardKind}:${key}`,
      effect: g.effect,
      position: at,
      elevation,
      direction,
      strength: g.fixed
        ? g.floor
        : clamp(g.floor + (guard?.prevented ?? 0) / g.reference, g.floor, g.ceiling),
      ...(g.radius === undefined ? {} : { radius: g.radius }),
    });
  }

  // 크게 터진 한 방 (C015) — 그 스킬이 표시 이펙트를 정한 경우에만 얹는다.
  // 이미 큰 이펙트를 쓰는 스킬(고급)은 터짐이 세기로만 드러난다.
  if (critical.occurred && tuning.criticalEffect) {
    effects.push({
      id: `critical:${key}`,
      effect: tuning.criticalEffect,
      position: at,
      elevation,
      direction: { x: 0, y: 1, z: 0 },
      strength: clamp(critical.multiplier, 1, tuning.ceiling),
    });
  }

  return effects;
}

function normalOf(
  from: { x: number; z: number } | undefined,
  to: { x: number; z: number },
  lift: number,
): { x: number; y: number; z: number } {
  if (!from) return { x: 0, y: 1, z: 0 };
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-4) return { x: 0, y: 1, z: 0 };
  return { x: dx / length, y: lift, z: dz / length };
}

// 칼날 각도 — 매 프레임 흔들리면 안 되므로 사건의 키에서 결정론적으로 뽑는다.
// (무작위로 뽑으면 같은 타격이 프레임마다 다른 각으로 그려진다.)
// spread 0 이면 늘 같은 각 — 방전처럼 베는 것이 아닌 이펙트의 몫이다.
function rollOf(key: string, spread: number): number {
  if (spread === 0) return 0;
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * spread;
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
