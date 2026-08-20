// Effect Presentation (F1) — 세계의 사건을 어떤 이펙트 게놈으로 드러낼지 정한다.
//
// 세계는 이펙트를 모른다. 세계가 보내는 것은 의미뿐이다 — 이 타격은 무엇으로 쳤고
// (damageType), 얼마나 들어갔고(amount), 막혔는지 무너졌는지(guard), 크게 터졌는지
// (critical). 그것을 "무슨 이펙트를 얼마나 세게" 로 옮기는 자리가 여기다.
// role-presentation 이 역할의 표현을, kind-presentation 이 종의 표현을 정하듯이.
//
// ── 왜 세계에 이펙트를 넣지 않는가 ────────────────────────────────────
// 이펙트를 세계에 두면 세계가 그림을 알게 된다. 그러면 같은 규칙에 두 개의 진실이
// 생긴다 — 판정의 진실(피해 12)과 화면의 진실(어떤 이펙트). 관찰자마다 다른 그림을
// 쓰고 싶어지는 순간(저사양·접근성·다른 팩) 세계를 고쳐야 한다.
// 세계는 사건을 낳고, 이펙트는 그 사건의 *읽는 법*이다 (DC-WORLD-OWNS-THE-SURFACE-LIST
// 의 반대편: 표면 목록은 세계의 것, 표면의 그림은 View 의 것).
//
// ── 왜 새 이펙트에 코드가 필요 없는가 ────────────────────────────────
// 이펙트의 *모양*은 게놈이다 (engine/view-kernel/fx/splat/fx.js FX_PRESETS).
// 이 파일이 정하는 것은 "어떤 사건이 어떤 게놈을 켜는가" 하나다.
// 새 Cycle 이 새 사건을 만들면 여기 한 줄이 늘고, 새 모양이 필요하면 FX_PRESETS 에
// 게놈 한 줄이 는다. 어느 쪽도 셰이더·엔진·렌더러를 건드리지 않는다.

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../../engine/protocol-core/gameview';
import type { SceneEffect } from '../../../engine/view-kernel/scene/scene-state';
import type { EntityView, GameViewSnapshot, StrikeEventView } from '../protocol/gameview';

/**
 * 이 게임이 화면에 올리는 이펙트 세트 = **예산**.
 *
 * 스플랫 풀은 슬라이스 8개로 나뉘고 이펙트마다 한 슬라이스를 쓴다 (fx.js 주석).
 * 그래서 "전부 올린다" 는 선택지가 아니라 *무엇을 같이 쓸지* 의 결정이다.
 * 굴절 이펙트(굴절 파면)는 빠져 있다 — 오버레이 뒤에는 휘게 할 배경이 없다
 * (engine/view-kernel/fx/effect-layer.ts 의 "왜 캔버스가 둘인가").
 */
export const EFFECT_SET = [
  '타격', // 물리 타격 — 방사 가시별 (검격을 동반으로 켠다)
  '검격', // 칼자국 — 타격의 동반. 각도는 사건이 준다
  '물결파', // 막아 낸 파문 — 튕겨 나가는 고리
  '전격', // 아우라 타격 — 지글거리는 방전
  '삼중 파문', // 방어가 무너진 순간 — 겹 고리가 터져 나간다
  '파이어볼 폭발', // 크게 터진 한 방 — 부푸는 화구
  '회복 오라', // 알게 된 순간 — 몸을 감싸고 떠오른다
] as const;

// 한 방의 세기를 이펙트의 세기로 옮기는 기준 피해량.
// 이 값이 곧 "정통 한 방" 이다 — 이보다 크면 굵고 밝고 오래 남는다 (F6).
const REFERENCE_DAMAGE = 18;
const MIN_STRENGTH = 0.4; // 스침 — 아래로 더 내려가면 이펙트가 보이지 않는다
const MAX_STRENGTH = 2.6; // 정통 — 위로 더 올라가면 화면을 뒤덮는다

// 맞은 자리 = 그림 한가운데쯤 (타격 숫자가 뜨는 높이와 같은 규칙)
const STRIKE_ELEVATION_RATIO = 0.55;

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
      marks.push({
        id: `mine:${entity.id}@${was}`,
        effect: '타격',
        position: entity.position,
        elevation: spriteSizeOf(entity) * 0.45,
        // 위로 튄다 — 캐는 사람의 자리를 세계가 사건으로 주지 않으므로 방향을 지어내지 않는다
        direction: { x: 0, y: 1, z: 0 },
        strength: 0.7,
        roll: rollOf(`mine:${entity.id}@${was}`),
      });
    }

    // 알게 된 순간 (C014 살펴봄 · C016 통찰) — 가려져 있던 것이 열렸다.
    // 이것도 사건이 아니라 *뒤집힘*이다: acquainted 거짓 → 참.
    const knewBefore = before.acquainted[entity.id];
    const knowsNow = entity.attributes?.acquainted;
    if (knewBefore === false && knowsNow === true) {
      marks.push({
        id: `acquaint:${entity.id}`,
        effect: '회복 오라',
        position: entity.position,
        elevation: spriteSizeOf(entity) * 0.25,
        direction: { x: 0, y: 1, z: 0 },
        strength: 1,
      });
    }
  }

  return marks;
}

// 한 번의 타격이 낳는 이펙트들 — 하나일 수도, 둘일 수도 있다.
//
// 무엇이 무엇을 고르는지가 이 함수의 전부다:
//   C012 damageType   physical → 타격(가시별+검격) · aura → 전격
//   C011 guard        막힘 → 물결파(튕겨 냈다) · 무너짐 → 삼중 파문(겹이 터져 나간다)
//   C015 critical     터짐 → 파이어볼 폭발이 얹히고, 세기가 한 단 더 오른다
//   C010/C013         피해량이 곧 세기다 — 관통이 방어를 걷어 피해가 커지면 이펙트도 커진다
function strikeEffects(
  strike: StrikeEventView,
  entityOf: (id: string) => EntityView | undefined,
  spriteSizeOf: (entity: EntityView | undefined) => number,
): SceneEffect[] {
  const target = entityOf(strike.targetId);
  const attacker = entityOf(strike.attackerId);
  const elevation = spriteSizeOf(target) * STRIKE_ELEVATION_RATIO;
  const guard = strike.breakdown.guard;
  const critical = strike.breakdown.critical;

  // 막힌 타격은 몸에 덜 들어갔다 — 그 사실이 세기로 읽혀야 한다.
  // amount 는 이미 막고 난 뒤의 값이므로 따로 깎지 않는다 (C011 appliedDamage).
  const base = clamp(
    MIN_STRENGTH + strike.amount / REFERENCE_DAMAGE,
    MIN_STRENGTH,
    MAX_STRENGTH,
  );
  const strength = clamp(base * (critical.occurred ? 1.35 : 1), MIN_STRENGTH, MAX_STRENGTH);

  // 축 = 맞은 쪽 법선. 때린 자리에서 맞은 자리로 향하는 쪽이며, 살짝 위로 든다 —
  // 정확히 수평이면 원판이 지면과 나란해져 위에서만 보인다.
  const direction = normalOf(attacker?.position, strike.at);
  const roll = rollOf(strike.since + strike.targetId);
  const at = { x: strike.at.x, z: strike.at.z };

  const effects: SceneEffect[] = [
    {
      id: `strike:${strike.attackerId}->${strike.targetId}@${strike.since}`,
      effect: strike.breakdown.damageType === 'aura' ? '전격' : '타격',
      position: at,
      elevation,
      direction,
      strength,
      roll,
    },
  ];

  // 막기가 한 일 (C011) — 숫자만으로는 "막았다" 가 순간에 읽히지 않는다.
  // 막힌 것과 무너진 것은 눈에 띄게 달라야 한다 (04 strikeEvents.meaning).
  if (guard?.blocked) {
    effects.push({
      id: `blocked:${strike.attackerId}->${strike.targetId}@${strike.since}`,
      effect: '물결파',
      position: at,
      elevation,
      direction,
      // 막아 낸 파문의 크기는 *덜 들어간 만큼*이다 — 많이 막았을수록 크게 튕긴다
      strength: clamp(MIN_STRENGTH + guard.prevented / REFERENCE_DAMAGE, MIN_STRENGTH, MAX_STRENGTH),
    });
  } else if (guard?.broken) {
    effects.push({
      id: `broken:${strike.attackerId}->${strike.targetId}@${strike.since}`,
      effect: '삼중 파문',
      position: at,
      elevation,
      direction,
      strength: 1.6, // 무너짐은 피해량과 무관하게 큰 사건이다
    });
  }

  // 크게 터진 한 방 (C015) — 숫자가 커지는 것과 같은 자리에서 화구가 얹힌다
  if (critical.occurred) {
    effects.push({
      id: `critical:${strike.attackerId}->${strike.targetId}@${strike.since}`,
      effect: '파이어볼 폭발',
      position: at,
      elevation,
      direction: { x: 0, y: 1, z: 0 },
      strength: clamp(critical.multiplier, 1, MAX_STRENGTH),
    });
  }

  return effects;
}

function normalOf(
  from: { x: number; z: number } | undefined,
  to: { x: number; z: number },
): { x: number; y: number; z: number } {
  if (!from) return { x: 0, y: 1, z: 0 };
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-4) return { x: 0, y: 1, z: 0 };
  return { x: dx / length, y: 0.25, z: dz / length };
}

// 칼날 각도 — 매 프레임 흔들리면 안 되므로 사건의 키에서 결정론적으로 뽑는다.
// (무작위로 뽑으면 같은 타격이 프레임마다 다른 각으로 그려진다.)
function rollOf(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return ((Math.abs(hash) % 1000) / 1000 - 0.5) * 1.4; // ±0.7 rad
}

function clamp(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
