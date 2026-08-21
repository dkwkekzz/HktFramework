// World Semantic — World.ItemCatalog · ItemDefinition (C001 ADDED / C020 CHANGED)
//
// C020 — 이 파일이 **아이템 정의의 단일 출처**가 된다.
//
// C001 의 형태는 `MINING_CAPABLE = new Set(['pickaxe'])` 였다. 곡괭이의 채굴이
// 채굴 쪽 코드에 적혀 있었고, 종류 이름이 곧 규칙이었다. 그것이 정확히
// DC-ITEM-KIND-IS-DATA-NOT-BRANCH 가 금지하는 형태다 (IS §7 P1).
//
// 이제 규칙은 종류 이름을 묻지 않는다. 정의에게 묻고, 정의가 답한 것으로 판정한다.
// 그러므로 **새 아이템이 생기는 일은 이 표에 항목이 하나 늘어나는 일**이며,
// 그 아이템을 쓰는 규칙도 그것을 싣는 관찰도 그것을 검증하는 시험도 열리지 않는다.

import type { DamageType } from './combat';

export type ItemKind = 'stone' | 'pickaxe';

/** 분류 — 의미 코드다. 문구 변환도 화면에서의 묶음도 View 책임 */
export type ItemCategory = 'material' | 'tool' | 'consumable';

/**
 * 용도 — 이 물건이 지닌 몸에게 **무엇을 할 수 있게 하는가**.
 *
 * 성질(IP-*)이 아니라 종류의 선언이다. 채굴은 세계가 남긴 성질이 아니라 사람이
 * 붙인 쓸모이므로 성질 노드로 세우지 않는다 (DC-ITEM-CAPABILITY-COMES-FROM-GRANTS · IS §3.3).
 */
export type ItemUseTag = 'mine';

/** 선언된 행동 — begin-declared-act 갈래가 시작하는 것 */
export type DeclaredAct = 'mine';

/**
 * Force — 물건이 지닌 위력 (C020 ADDED).
 *
 * 스킬 정의가 지닌 세 값과 **같은 모양**이다. 그래서 피해 공식은 스킬에서 오든
 * 물건에서 오든 같은 것을 받는다 — 식이 갈리지 않는다 (DC-COMBAT-ONE-FORMULA).
 */
export interface Force {
  baseDamage: number;
  attackRatio: number;
  damageType: DamageType;
}

/**
 * 효과 갈래 — 쓰면 무슨 일이 일어나는가.
 *
 * **목록이지 분기가 아니다.** 갈래가 늘어도 쓰는 행동 · 대상 정책 · 소모 · 원자성 ·
 * 관찰은 열리지 않는다 (INTENT-ITEM-EFFECT-IS-DECLARED-001).
 */
export type ItemEffect =
  | { kind: 'deliver-force'; force: Force }
  | { kind: 'begin-declared-act'; act: DeclaredAct };

/** 대상 요구 — 정의가 밝힌다 (INTENT-USE-TARGET-POLICY-001) */
export interface ItemTargeting {
  requires: 'none' | 'selected';
  /** requires = selected 일 때만 의미를 가진다 */
  entityKind?: 'character' | 'deposit';
}

export interface ItemUse {
  effect: ItemEffect;
  targeting: ItemTargeting;
  /** 성공한 사용이 줄이는 수량. **0 이면 줄지 않는다** — 도구는 닳지 않는다 */
  consumes: number;
  /** 쓰는 데 드는 시간. begin-declared-act 갈래는 그 행동의 시간을 쓰므로 없다 */
  duration?: number;
  /**
   * 닿을 수 있는 거리 (C020 · Stage 8 반환으로 ADDED).
   *
   * **정의가 지닌다** — 물건마다 닿는 거리가 다르기 때문이다. 밝히지 않으면
   * 손이 닿는 거리(INTERACTION_RANGE)를 쓴다. 규칙은 이 값을 읽을 뿐 종류를 묻지 않는다.
   */
  range?: number;
}

export interface ItemDefinition {
  category: ItemCategory;
  /** 상위 정의 식별자 (`IT-*`) — 없을 수 있다 */
  origin?: string;
  stackable: boolean;
  /** 이 물건이 몸에 주는 용도들 — 빈 목록일 수 있다 */
  uses: readonly ItemUseTag[];
  /** 쓰면 무슨 일이 일어나는가 — **없으면 그 물건은 쓸 수 없다** */
  use?: ItemUse;
}

// 수치는 Cycle 소유다 (03-world-semantic.md BALANCE). 결정론에 영향을 주므로 상수로 고정한다.
export const ITEM_CATALOG: Readonly<Record<ItemKind, ItemDefinition>> = {
  // 평범한 돌 — 아무 특별한 성질도 지니지 않는다. 그것이 결손이 아니라 이 돌의 내용이다
  // (IT-COMMON-STONE world_shape: "어떤 특별한 일도 하지 않아야 한다").
  //
  // 던진 돌이 아픈 것은 성질이 아니라 질량과 단단함이다 — 기적이 아니다.
  // AttackRatio 가 0 인 것이 이 정의의 핵심이다: 전해지는 것은 **물건의 위력**이지
  // 던진 이의 힘이 아니다. 아이템이 능력치를 타지도 바꾸지도 않는다.
  // BaseDamage 4 는 기본 스킬(6)보다 작다 — 하나는 하찮고 **양이 곧 크기**다
  // ("기적은 없고 양이 있다").
  stone: {
    category: 'material',
    origin: 'IT-COMMON-STONE',
    stackable: true,
    uses: [],
    use: {
      effect: {
        kind: 'deliver-force',
        force: { baseDamage: 4, attackRatio: 0, damageType: 'physical' },
      },
      targeting: { requires: 'selected', entityKind: 'character' },
      consumes: 1,
      // 던지는 것은 휘두르는 것보다 빠르다 (기본 스킬 0.6). 대신 위력이 하찮다.
      duration: 0.5,
      // 던지는 거리 — 손이 닿는 거리(2.0)보다 멀다. **Stage 8 실측이 이 값을 세웠다.**
      //
      // 2.0 은 상대의 휘두름 **안쪽**이었다. 그 자리에서는 던질 때마다 맞아 끊기고
      // 3.22 까지 밀려나, 30초 900프레임 중 조건이 맞는 프레임이 4개뿐이었다
      // (필요한 것은 연속 15). 던질 수 있는 자리가 곧 맞는 자리였다는 뜻이다.
      //
      // 5.0 은 상대가 다가오는 동안 한 번 던질 수 있는 거리다. 멀리서 안전하게
      // 때리는 거리가 아니다 — 자율 존재의 인지 범위(12) 안쪽이므로 던지면 온다.
      // 값을 치르는 방식이 "맞으면서 던진다" 에서 "붙기 전에 한 발" 로 바뀐다.
      range: 5.0,
    },
  },
  // 곡괭이 — 상위 정의가 없다. 이 물건이 지닌 것은 세계가 남긴 성질이 아니라
  // 사람이 붙인 **용도**이고, 유래를 요구하는 것은 성질 쪽이기 때문이다.
  // 상위에 세울지는 위층(Master)의 판단이다 (01-cycle.md SCOPE NOTE ④).
  //
  // 쓰면 채집이 시작되고 **줄지 않는다.** 이 하나가 "소모 여부도 정의가 정한다" 를
  // 말이 아니라 관찰로 만든다 (INTENT-ITEM-CONSUME-001).
  pickaxe: {
    category: 'tool',
    stackable: true,
    uses: ['mine'],
    use: {
      effect: { kind: 'begin-declared-act', act: 'mine' },
      targeting: { requires: 'none' }, // 대상은 그 행동 자신이 읽는다
      consumes: 0,
    },
  },
};

/** 세계가 아는 종류의 순서 — 같은 세계 상태면 관찰의 순서도 같다 */
export const ITEM_KINDS: readonly ItemKind[] = Object.keys(ITEM_CATALOG) as ItemKind[];

export function isItemKind(value: string): value is ItemKind {
  return Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}

/** 정의를 찾는다. 세계가 모르는 종류면 undefined — 규칙은 그것을 사유로 답한다 */
export function itemDefinition(kind: string): ItemDefinition | undefined {
  return isItemKind(kind) ? ITEM_CATALOG[kind] : undefined;
}
