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
import type { EquipSlotId } from './equipment';

export type ItemKind = 'stone' | 'pickaxe' | 'buckler'; // C024 — buckler 가 는다

/** 분류 — 의미 코드다. 문구 변환도 화면에서의 묶음도 View 책임 */
// C024 CHANGED — `gear` 가 는다 (IS §180 "장비·소비재·재료").
// **표시용 분류이며 세계의 어떤 판정도 이 값을 묻지 않는다** — 지금도 묻는 곳이 0건이고
// 이 Cycle 도 만들지 않는다. 화면은 이 값을 표시 표에 쓰며 모르는 분류에는 표시가 없다.
export type ItemCategory = 'material' | 'tool' | 'consumable' | 'gear';

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

/**
 * 걸린 동안 몸의 값에 보태는 것 (C023 ADDED).
 *
 * 몸이 지닌 여덟 전투 능력치에만 붙는다 — 지금 그 밖의 값을 보태는 물건이 세계에
 * 없기 때문이다. 그런 물건이 생기면 이 목록에 이름이 하나 늘고, 유효 값을 세는
 * 자리(semantic/combat.ts effectiveStat)는 열리지 않는다.
 */
export type ContributableStat =
  | 'physicalAttack'
  | 'auraAttack'
  | 'armor'
  | 'resistance'
  | 'armorPenetration'
  | 'resistancePenetration'
  | 'criticalChance'
  | 'criticalDamage';

export type StatContributions = Partial<Record<ContributableStat, number>>;

/**
 * 적용 — **이 자리가 있으면 걸 수 있는 물건이다** (C023 ADDED).
 *
 * 없으면 걸 수 없다. 돌이 걸리지 않는 이유가 이것이며, **자리 탓이 아니다** —
 * 어느 자리에 물어도 같은 답이 나온다.
 */
export interface ItemEquip {
  /**
   * 전용 자리들 — **비어 있거나 없으면 제한이 없다** (어느 자리에나 걸린다).
   *
   * 제한은 물건이 스스로 선언할 때만 생기는 **예외**다 (IE §10 · §11).
   * 지금 이것을 선언하는 물건은 세계에 하나도 없다.
   */
  targets?: readonly EquipSlotId[];
  /** 걸린 동안 몸의 값에 보태는 것. 없을 수 있다 (용도만 주는 물건) */
  contributions?: StatContributions;
}

export interface ItemDefinition {
  category: ItemCategory;
  /** 상위 정의 식별자 (`IT-*`) — 없을 수 있다 */
  origin?: string;
  /**
   * 한 자리에 몇까지 겹치는가 (C022 ADDED — ≥ 1).
   *
   * **`stackable` 을 대체한다.** 겹치는가와 몇까지인가를 정의가 따로 답하면 두 곳에
   * 적힌 하나의 진실이 되고, 두 곳에 적히면 반드시 어긋난다. 1 이면 겹치지 않는다는
   * 뜻이며, 자리 계산은 그 둘을 가르지 않는다 — ⌈수량 / 한도⌉ 하나로 답한다
   * (RULE-INVENTORY-ROOM-001).
   */
  stackLimit: number;
  /** 이 물건이 몸에 주는 용도들 — 빈 목록일 수 있다 */
  uses: readonly ItemUseTag[];
  /** 쓰면 무슨 일이 일어나는가 — **없으면 그 물건은 쓸 수 없다** */
  use?: ItemUse;
  /**
   * 걸 수 있는가 — **없으면 걸 수 없다** (C023 ADDED).
   *
   * 겹칠 수 있는 물건은 이 자리를 지니지 않는다 — 자리 하나에 수량 여럿이라는
   * 상태를 만들지 않기 위해서다 (IE §13.1). 그 정합은 아래 ITEM_CATALOG 옆의
   * 불변 조건이 확인한다.
   */
  equip?: ItemEquip;
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
    // C022 — 한 자리에 셋까지. 값은 Cycle 소유다 (03-world-semantic.md BALANCE)
    stackLimit: 3,
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
    // C022 — **겹치지 않는다.** 도구 한 자루가 자리 하나를 온전히 쓴다.
    // 겹치는 종류와 겹치지 않는 종류가 둘 다 있어야 자리 계산이 분기 없는 한 식임이
    // 관찰된다 — 하나뿐이면 그 식이 자리인지 조건문인지 구분되지 않는다.
    stackLimit: 1,
    uses: ['mine'],
    use: {
      effect: { kind: 'begin-declared-act', act: 'mine' },
      targeting: { requires: 'none' }, // 대상은 그 행동 자신이 읽는다
      consumes: 0,
    },
    // C023 — **걸 수 있는 첫 물건이다.** 전용 자리를 선언하지 않으므로 여섯 어느
    // 자리에나 걸린다 (IE §10 — 제한은 예외이지 기본이 아니다).
    //
    // 물리 공격 +12 — IE §12 의 예시가 그대로 곡괭이 Attack +3 (기본 10 의 +30%) 이고,
    // 이 세계의 기본값 40 에 같은 비율을 적용한 값이다. 무기가 되는 것이 아니라
    // 기본 기술의 raw 가 26 → 32 로 오를 뿐이다 (03-world-semantic.md JUDGEMENT ③).
    //
    // 이 하나로 **용도와 값 둘 다** 관찰된다 — 걸어야 캐지고, 걸면 값이 달라진다.
    // 그래서 이 Cycle 은 새 장비 종류를 하나도 세우지 않는다.
    equip: { contributions: { physicalAttack: 12 } },
  },
  // 손방패 — 곡괭이와 같은 사정의 물건이다. 문명권에서 만든 평범한 것이고, 상위 정의가
  // 없다 (Q36 이 그 자리를 열어 두고 있다 · 03-world-semantic.md JUDGEMENT ③).
  //
  // C024 ADDED — **두 번째로 걸 수 있는 물건이다.** 이 하나가 없으면 교체의 관찰이
  // 성립하지 않는다: 같은 종류끼리의 교체는 아무것도 바꾸지 않으므로 "새것의 것만 있고
  // 헌것의 것은 없다" 를 확인할 방법이 없다.
  //
  // **용도를 주지 않는다** (uses 가 비었다). 그래서 곡괭이를 밀어내는 교체는 그 자리에서
  // 캘 수 없게 만들고, 그 잃음이 교체가 선택임을 만든다.
  //
  // **쓸 수 없다** (use 가 없다). 걸 수만 있는 물건이 세계에 처음 생긴다 — 곡괭이는
  // 쓸 수도 걸 수도 있었으므로 그 둘이 서로 다른 축임이 이 물건으로 관찰된다.
  //
  // armor +15 — rabbit-swordsman 의 기본 armor 50 의 30% 이며, 곡괭이가 물리 공격 40 에
  // 주는 비율과 같다. 두 물건의 무게를 같게 두어 "무엇을 걸까" 가 값의 크기 비교가 아니라
  // **무엇을 할 것인가**의 선택이 되게 한다 (03-world-semantic.md BALANCE).
  buckler: {
    category: 'gear',
    // 걸 수 있는 것은 겹치지 않는다 — 아래 불변 조건이 강제한다 (IE §13.1).
    // 이 1 이 교체의 순 증가 0 을 낳는다 (03-world-semantic.md RATIONALE 3).
    stackLimit: 1,
    uses: [],
    equip: { contributions: { armor: 15 } },
  },
};

/**
 * 불변 조건 — **걸 수 있는 물건은 겹치지 않는다** (C023 · IE §13.1).
 *
 * 자리 하나에 수량 여럿이라는 상태를 만들지 않기 위해서다. 정의가 이 둘을 함께
 * 어기면 자리 계산과 적용이 서로 다른 이야기를 하게 되므로, 카탈로그를 세우는
 * 자리에서 한 번 확인한다 — 종류가 늘어도 이 확인은 그대로다.
 */
for (const [kind, definition] of Object.entries(ITEM_CATALOG)) {
  if (definition.equip && definition.stackLimit !== 1) {
    throw new Error(`ITEM_CATALOG: ${kind} 는 걸 수 있는데 겹친다 (IE §13.1 위반)`);
  }
}

/** 세계가 아는 종류의 순서 — 같은 세계 상태면 관찰의 순서도 같다 */
export const ITEM_KINDS: readonly ItemKind[] = Object.keys(ITEM_CATALOG) as ItemKind[];

export function isItemKind(value: string): value is ItemKind {
  return Object.prototype.hasOwnProperty.call(ITEM_CATALOG, value);
}

/** 정의를 찾는다. 세계가 모르는 종류면 undefined — 규칙은 그것을 사유로 답한다 */
export function itemDefinition(kind: string): ItemDefinition | undefined {
  return isItemKind(kind) ? ITEM_CATALOG[kind] : undefined;
}

/**
 * 겹치는가 — **정의가 직접 답하지 않는다** (C022 CHANGED).
 *
 * 한도가 1 을 넘으면 겹치는 것이다. 관찰 계약(`InventoryItemView.stackable`)은
 * 그대로이며 값의 출처만 이 함수로 옮겨 왔다.
 */
export function isStackable(definition: ItemDefinition): boolean {
  return definition.stackLimit > 1;
}
