// World Semantic — ItemCatalog · ItemDefinition · ItemUse (C020 CHANGED)
//
// C001 은 아이템을 두 개짜리 문자열 합집합(`'stone' | 'pickaxe'`)과 하드코딩된 집합
// (`MINING_CAPABLE`)으로 두었다. 그 형태에서는 물건이 하나 늘 때마다 형과 규칙이 함께
// 늘어난다.
//
// C020 — 종류 이름은 **정의를 찾는 열쇠**가 되고, 그 정의가 무엇에 쓰는 물건인지를
// 스스로 밝힌다 (INTENT-ITEM-CATALOG-001 · DC-ITEM-KIND-IS-DATA-NOT-BRANCH).
// 규칙은 종류 이름을 묻지 않는다 — 카탈로그에 묻는다.

/** 카탈로그를 여는 열쇠. 합집합이 아니다 — 새 종류가 형을 넓히지 않는다. */
export type ItemKind = string;

/**
 * 물건이 선언할 수 있는 용도.
 *
 * 이것이 열거인 이유는 지금 하나뿐이어서가 아니다 — 채굴 규칙이 "든 것이 곡괭이인가"
 * 대신 "이 몸에 캐는 용도가 지금 있는가" 를 물을 수 있게 하는 자리다
 * (INTENT-USE-COMES-FROM-DECLARATION-001 · DC-ITEM-CAPABILITY-COMES-FROM-GRANTS).
 */
export type ItemUse = 'mining';

/** 물건의 갈래. 표시와 정렬을 위한 의미 코드이며 **규칙이 이 값으로 갈리지 않는다.** */
export type ItemCategory = 'tool' | 'material';

export interface ItemDefinition {
  readonly id: ItemKind;
  readonly category: ItemCategory;
  /** 같은 종류끼리 한 자리에 쌓을 수 있는가 */
  readonly stackable: boolean;
  /** 한 자리에 얼마까지 담기는가. stackable 이 거짓이면 1 이다 */
  readonly stackLimit: number;
  /** 이 종류가 여는 용도들. 비어 있을 수 있다 — 재료가 그렇다 */
  readonly uses: readonly ItemUse[];
  /**
   * 이 물건이 Master 의 어느 종류에서 왔는가 (`IT-*`).
   *
   * 장식이 아니다 — 물건은 세계가 낳은 것이지 편의로 만들어 낸 것이 아니라는 요구를
   * 세계 쪽에서도 유지하는 자리다 (IS §5.1 · DC-WORLD-RESOURCE-ADAPTATION-TRACE).
   */
  readonly itemType: string;
}

/**
 * 세계에 있을 수 있는 물건 종류의 단일 정의소.
 *
 * 곡괭이가 `IT-COMMON-STONE` 을 가리키는 것은 임시가 아니다 — 지금 이 세계의 곡괭이는
 * 평범한 돌로 만든 도구이고, 세계 압력이 남긴 성질(`IP-*`)을 지닌 물건은 아직 세계에
 * 없다. 경계결정 · 불연정 계통이 서면 그때 그 정의들이 자기 `IT-*` 를 가리킨다.
 */
const DEFINITIONS: readonly ItemDefinition[] = [
  {
    id: 'stone',
    category: 'material',
    stackable: true,
    // C020 BALANCE ② — 이 값은 균형이 아니라 **관찰 가능성**을 위한 것이다.
    // 지금 세계에는 광맥이 하나이고 자원이 다섯이라(world/index.ts), 겹침이 넉넉하면
    // "자리가 없어 못 받는다" 가 플레이에서 한 번도 일어나지 않는다 (03 BALANCE).
    stackLimit: 2,
    uses: [],
    itemType: 'IT-COMMON-STONE',
  },
  {
    id: 'pickaxe',
    category: 'tool',
    stackable: false,
    stackLimit: 1,
    uses: ['mining'],
    itemType: 'IT-COMMON-STONE',
  },
];

export const ITEM_CATALOG: ReadonlyMap<ItemKind, ItemDefinition> = new Map(
  DEFINITIONS.map((d) => [d.id, d]),
);

export function itemDefinition(kind: ItemKind): ItemDefinition | undefined {
  return ITEM_CATALOG.get(kind);
}

/** 카탈로그에 없는 종류는 겹치지 않는 것으로 친다 — 없는 정의를 지어내지 않는다. */
export function stackLimitOf(kind: ItemKind): number {
  return itemDefinition(kind)?.stackLimit ?? 1;
}

export function usesOf(kind: ItemKind): readonly ItemUse[] {
  return itemDefinition(kind)?.uses ?? [];
}
