// World Semantic — Item.Kind · Tool.Capability (C001 ADDED)

export type ItemKind = 'stone' | 'pickaxe';

// Tool.Capability — pickaxe 는 Mining Capability 를 가진다 (Item.Kind 파생 의미)
const MINING_CAPABLE: ReadonlySet<ItemKind> = new Set<ItemKind>(['pickaxe']);

export function hasMiningCapability(kind: ItemKind): boolean {
  return MINING_CAPABLE.has(kind);
}
