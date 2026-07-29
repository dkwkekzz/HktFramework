// §18 초기 기억·소지품의 실측 (G-7)
//
// "필드가 생겼다"가 아니라 ① 기억이 초기 믿음을 지지하고 ② §24 기계(소환)가 그 위에서 돌고
// ③ 소지품 선언이 거래 규칙이 읽는 상태로 실제 변환됐는가를 잰다.
// verify.ts 와 테스트가 같은 함수를 쓴다 (phase3Checks 와 같은 규약).
import { buildManualWorld } from "../../content/manual-world";
import { bootstrapWorld } from "../world/WorldBootstrap";
import { WorldRuntime } from "../world/WorldRuntime";
import { recallByTags } from "./MemorySystem";

export interface InitialMemoryRow {
  agentId: string;
  memoryCount: number;
  /** 초기 믿음 수 / 지지 기억(interpretation 일치)을 가진 믿음 수 */
  beliefs: number;
  backedBeliefs: number;
  /** §24 recallByTags 로 실제 소환되는가 */
  recalled: boolean;
  ok: boolean;
  evidence: string;
}

export function measureInitialMemories(seed = 42): InitialMemoryRow[] {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  const rows: InitialMemoryRow[] = [];
  for (const spec of runtime.definition.bootstrap.entities) {
    const agent = runtime.state.agentRuntimes[spec.id];
    if (agent === undefined || agent.kind === "faction") continue;
    const beliefs = spec.beliefs ?? [];
    const backed = beliefs.filter((belief) =>
      agent.memories.some(
        (memory) =>
          memory.interpretation !== undefined &&
          memory.interpretation.subjectId === belief.subjectId &&
          memory.interpretation.stateKey === belief.stateKey,
      ),
    );
    const firstTag = agent.memories[0]?.tags[0];
    const recalled = firstTag !== undefined && recallByTags(agent, [firstTag]).some((m) => m.createdAt === 0);
    rows.push({
      agentId: spec.id,
      memoryCount: agent.memories.length,
      beliefs: beliefs.length,
      backedBeliefs: backed.length,
      recalled,
      ok: agent.memories.length > 0 && backed.length === beliefs.length && recalled,
      evidence:
        `기억 ${agent.memories.length}건 · 초기 믿음 ${beliefs.length}건 중 지지 기억 보유 ${backed.length} · ` +
        `태그 소환 ${recalled ? "성공" : "실패"}(${firstTag ?? "-"})`,
    });
  }
  return rows;
}

export interface InventoryRow {
  agentId: string;
  resourceId: string;
  stateKey: string;
  declared: number;
  stored: number;
  ok: boolean;
}

/** 소지품 선언 → carryStateKey 상태 변환의 실측 — 거래·소비 규칙이 읽는 그 키에 그 값이 있다 */
export function measureInventory(seed = 42): InventoryRow[] {
  const runtime = new WorldRuntime(buildManualWorld(seed));
  bootstrapWorld(runtime);
  const resourceOf = new Map(runtime.definition.resources.map((resource) => [resource.id, resource]));
  const rows: InventoryRow[] = [];
  for (const spec of runtime.definition.bootstrap.entities) {
    for (const item of spec.inventory ?? []) {
      const stateKey = resourceOf.get(item.resourceId)?.carryStateKey ?? "?";
      const stored = runtime.store.readNumber(spec.id, stateKey);
      rows.push({
        agentId: spec.id,
        resourceId: item.resourceId,
        stateKey,
        declared: item.quantity,
        stored,
        ok: stored === item.quantity,
      });
    }
  }
  return rows;
}
