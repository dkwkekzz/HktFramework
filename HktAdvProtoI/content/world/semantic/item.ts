// World Semantic — Item.Kind · Tool.Capability
//
// C011 CHANGED — 'stone' 이 사라지고 재료 코드 둘이 들어온다. 이 세계의 소지품 품목은
// 이제 **Material Seed 의 코드**다 (spec World Change 6).
//
// 문자열의 원본은 content/regions 의 BIO_ORE · ORE_EATER_MOLT 상수다 — 재료가 무엇이고
// 어디서 나는지는 그 데이터가 소유하고, 여기 있는 것은 "소지품에 담길 수 있는 것" 의 형뿐이다.
// **규칙 코드는 재료를 이름으로 알지 못한다** (L2-World-Region R13): 채취는 원천이 밝힌
// materialId 를 그대로 품목으로 쓰고, 어느 재료인지 묻지 않는다.

export type ItemKind = 'pickaxe' | 'BIO_ORE' | 'ORE_EATER_MOLT';

// Tool.Capability — pickaxe 는 Mining Capability 를 가진다 (Item.Kind 파생 의미)
const MINING_CAPABLE: ReadonlySet<ItemKind> = new Set<ItemKind>(['pickaxe']);

export function hasMiningCapability(kind: ItemKind): boolean {
  return MINING_CAPABLE.has(kind);
}
