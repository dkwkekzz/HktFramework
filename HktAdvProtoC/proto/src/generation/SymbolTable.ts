// 참조 무결성 사전 (Phase-5 §5.2 "심볼 테이블")
//
// §34 "모든 규칙의 대상이 실제로 존재한다" 를 생성 시점에 선방어한다.
// 각 단계가 만든 id 를 누적하고, 다음 단계 호출에 "사용 가능한 id 목록"으로 실어 준다.
// 출력에 등장하는 id 는 전부 여기서 기계 검출한다 — 단계 순서상 뒤에 오는 참조(종족→목적)는
// 미해결로 쌓아 두었다가 파이프라인 끝에서 한 번에 판정한다.

export type SymbolKind =
  | "axiom"
  | "pressure"
  | "state"
  | "rule"
  | "region"
  | "location"
  | "resource"
  | "species"
  | "faction"
  | "ability"
  | "goal"
  | "goal_graph"
  | "action"
  | "event_pattern"
  | "template"
  | "entity";

/** id 접두사 → 종류. 출력 JSON 을 훑어 참조를 찾아낼 때 쓴다 */
const PREFIX_TO_KIND: Record<string, SymbolKind> = {
  axiom: "axiom",
  pressure: "pressure",
  rule: "rule",
  region: "region",
  location: "location",
  resource: "resource",
  species: "species",
  faction: "faction",
  ability: "ability",
  goal: "goal",
  goal_graph: "goal_graph",
  action: "action",
  pattern: "event_pattern",
  agent: "entity",
  creature: "entity",
  resource_node: "entity",
};

/** 참조로 세지 않는 접두사 — 신호 id 나 사건 인스턴스는 정의가 아니다 */
const IGNORED_PREFIXES = ["signal", "event", "theme", "world", "channel"];

export interface UnresolvedReference {
  id: string;
  kind: SymbolKind;
  where: string;
}

export class SymbolTable {
  private symbols = new Map<SymbolKind, Set<string>>();
  private pending: UnresolvedReference[] = [];

  declare(kind: SymbolKind, id: string): void {
    const set = this.symbols.get(kind) ?? new Set<string>();
    set.add(id);
    this.symbols.set(kind, set);
  }

  declareAll(kind: SymbolKind, ids: readonly string[]): void {
    for (const id of ids) this.declare(kind, id);
  }

  has(kind: SymbolKind, id: string): boolean {
    return this.symbols.get(kind)?.has(id) === true;
  }

  list(kind: SymbolKind): string[] {
    return [...(this.symbols.get(kind) ?? [])].sort();
  }

  get size(): number {
    let total = 0;
    for (const set of this.symbols.values()) total += set.size;
    return total;
  }

  /** 생성 호출에 실어 줄 "사용 가능한 id 목록" (§5.2) */
  availableIds(kinds: readonly SymbolKind[]): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const kind of kinds) result[kind] = this.list(kind);
    return result;
  }

  /** 단계 출력에 등장하는 모든 id 참조를 훑어 미해결 목록에 쌓는다 */
  collectReferences(value: unknown, where: string): void {
    const walk = (node: unknown, path: string, depth: number): void => {
      if (depth > 24) return;
      if (typeof node === "string") {
        const kind = kindOfId(node);
        if (kind !== undefined) this.pending.push({ id: node, kind, where: path });
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((item, i) => walk(item, `${path}[${i}]`, depth + 1));
        return;
      }
      if (node !== null && typeof node === "object") {
        for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
          walk(child, `${path}.${key}`, depth + 1);
        }
      }
    };
    walk(value, where, 0);
  }

  /** 아직 선언되지 않은 참조 (파이프라인 종료 시점에 남아 있으면 §34 오류) */
  unresolved(): UnresolvedReference[] {
    const seen = new Set<string>();
    const result: UnresolvedReference[] = [];
    for (const ref of this.pending) {
      if (this.has(ref.kind, ref.id)) continue;
      const key = `${ref.kind}:${ref.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(ref);
    }
    return result;
  }

  get referenceCount(): number {
    return this.pending.length;
  }
}

/** `rule.hunger_growth` → "rule". 접두사가 없거나 무시 목록이면 참조가 아니다 */
export function kindOfId(value: string): SymbolKind | undefined {
  const dot = value.indexOf(".");
  if (dot <= 0 || value.includes(" ")) return undefined;
  const prefix = value.slice(0, dot);
  if (IGNORED_PREFIXES.includes(prefix)) return undefined;
  return PREFIX_TO_KIND[prefix];
}
