// T3 완료 조건 — 손으로 쓴 brief 하나 → 방 하나가 검사 아홉(T1)을 통과하고,
// 관찰자가 걸어 흔적 → 원천에 닿는다. 그리고 그 방이 느는 데 규칙 코드는 한 줄도 늘지 않는다.
//
// **생성한 방을 이 세계에 넣지는 않는다.** 어느 방을 세계에 들이는가는 컨텐츠 층의 결정이고
// ENGINE 레인이 정할 일이 아니다 (Tool-Scale §4 "문법을 넓히지 않는다"). 그래서 이 시험은
// 지금 세계의 방들 **곁에** 생성한 방을 세워 재고, 저장소의 content/regions 는 건드리지 않는다.
// 실제로 그 방을 들이는 일은 그것을 원하는 컨텐츠 Cycle(또는 HundredRooms)의 것이다.
//
// 쓰는 brief 는 Tool-Scale §2 가 **등급 A 의 예로 든 바로 그 방**이다 (가스로 가득 찬 마을).
// 세계 사실을 새로 지어내지 않으려고 문서가 이미 든 예를 그대로 썼다.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { COMPILE_RULES, REGION_GRAPH, TRACE_LAYER, soilStainLevel } from '../../../content/regions';
import { WORLD_AUTHOR_TEMPLATES } from '../../../content/authoring/templates';
import { checkRegions, type CheckRegion } from '../../../engine/world-authoring/check';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { RegionOp, XZ } from '../../../engine/world-authoring/description';
import { isTraversableAt } from '../../../engine/world-authoring/query';
import { WORLD_CHECK_CONTRACT, WORLD_CHECK_REGIONS } from '../check';
import { authorRegion } from '../../../engine/world-authoring/author';
import { parseRegionBrief } from '../../../engine/world-authoring/brief';
import { authorFromFile, renderRegionModule, renderSeams } from '../author';

const BRIEF = fileURLToPath(new URL('../../../content/authoring/examples/GAS_VILLAGE.json', import.meta.url));
const authored = authorFromFile(BRIEF);

/** 생성한 방을 지금 세계 곁에 세운다 — 저장소는 그대로 두고 값만 잇는다 */
function worldWith(extraOps: readonly RegionOp[] = []): {
  regions: CheckRegion[];
  graph: typeof REGION_GRAPH;
} {
  const born: CheckRegion = {
    id: authored.spec.id,
    depth: authored.spec.depth,
    space: authored.spec.space,
    coreRules: 0,
  };
  // 이웃 쪽 anchor — 생성기는 이름만 댄다. 그 방의 땅을 아는 쪽이 자리를 정한다
  const regions = WORLD_CHECK_REGIONS.map((region) =>
    authored.neighbourAnchors.some((a) => a.region === region.id)
      ? { ...region, space: { ...region.space, ops: [...region.space.ops, ...extraOps] } }
      : region,
  );
  return {
    regions: [...regions, born],
    graph: {
      ...REGION_GRAPH,
      regions: [...REGION_GRAPH.regions, authored.spec.id],
      connectors: [...REGION_GRAPH.connectors, ...authored.connectors],
    },
  };
}

const check = (extraOps: readonly RegionOp[] = []) => {
  const world = worldWith(extraOps);
  return checkRegions({
    regions: world.regions,
    graph: world.graph,
    contract: WORLD_CHECK_CONTRACT,
    compile: (region) => compileRegion(region.space, COMPILE_RULES).world,
  });
};

/** 생성기가 이름만 댄 이웃 anchor 를 그 방에 실제로 놓는다 */
const neighbourAnchorOps: RegionOp[] = authored.neighbourAnchors.map((a) => ({
  id: `anchor-${a.anchor.toLowerCase().replace(/_/g, '-')}`,
  kind: 'point',
  layer: WORLD_CHECK_CONTRACT.anchorLayer,
  tag: a.anchor,
  position: { x: 0, z: 0 },
}));

describe('T3 — 생성한 방이 검사 아홉을 통과한다', () => {
  it('이웃 쪽 anchor 를 놓지 않으면 ⑤ 가 잡는다 — 생성기가 이름만 댄다는 것이 그래서 안전하다', () => {
    const item = check().items.find((i) => i.id === 'connector-anchor')!;
    expect(item.status).toBe('fail');
    expect(item.refs.map((r) => r.where)).toEqual(
      authored.neighbourAnchors.map((a) => a.region),
    );
  });

  it('놓으면 아홉이 다 통과한다 — 생성한 방 때문에 실패하는 검사가 하나도 없다', () => {
    const report = check(neighbourAnchorOps);
    expect(report.items.filter((i) => i.status === 'fail')).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it('⑦⑧ 이 이 방을 집지 않는다 — 나갈 곳이 있고 시작 방에서 닿는다', () => {
    const report = check(neighbourAnchorOps);
    for (const id of ['region-exit', 'region-reachable']) {
      const item = report.items.find((i) => i.id === id)!;
      expect({ id, refs: item.refs.map((r) => r.where) }).toEqual({ id, refs: [] });
    }
  });
});

describe('T3 — 관찰자가 걸어 흔적 → 원천에 닿는다', () => {
  const world = compileRegion(authored.spec.space, COMPILE_RULES).world;
  const opsOf = (kind: string, layer: string) =>
    authored.spec.space.ops.filter((op) => op.kind === kind && 'layer' in op && op.layer === layer);

  it('원천이 놓였고 그 자리를 걸어 지날 수 있다', () => {
    const sources = opsOf('point', WORLD_CHECK_CONTRACT.resourceLayer);
    expect(sources.length).toBeGreaterThan(0);
    for (const op of sources) {
      const at = (op as { position: XZ }).position;
      expect({ id: op.id, walkable: isTraversableAt(world, at.x, at.z) }).toEqual({
        id: op.id,
        walkable: true,
      });
    }
  });

  it('들어선 자리(anchor)에서 원천까지 걸음이 이어진다 — 4방 격자로 재 본다', () => {
    const anchors = opsOf('point', WORLD_CHECK_CONTRACT.anchorLayer);
    const sources = opsOf('point', WORLD_CHECK_CONTRACT.resourceLayer);
    expect(anchors.length).toBeGreaterThan(0);
    const start = (anchors[0] as { position: XZ }).position;
    // 격자 위 4방 번짐 — 생성기가 쓰는 것과 같은 잣대다
    const { cols, rows, resolution, extent, traversable } = world;
    const colOf = (x: number) => Math.round((x - extent.minX) / resolution);
    const rowOf = (z: number) => Math.round((z - extent.minZ) / resolution);
    const seen = new Set<number>([rowOf(start.z) * cols + colOf(start.x)]);
    const queue = [...seen];
    while (queue.length > 0) {
      const at = queue.pop()!;
      const col = at % cols;
      const row = (at - col) / cols;
      for (const [c, r] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
        if (c! < 0 || r! < 0 || c! >= cols || r! >= rows) continue;
        const next = r! * cols + c!;
        if (seen.has(next) || traversable[next] !== 1) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    for (const op of sources) {
      const at = (op as { position: XZ }).position;
      expect({ id: op.id, reached: seen.has(rowOf(at.z) * cols + colOf(at.x)) }).toEqual({
        id: op.id,
        reached: true,
      });
    }
  });

  it('흔적이 원천 쪽으로 **한 단계** 짙다 — 방향이 데이터에 있다', () => {
    const traces = opsOf('area', TRACE_LAYER).map((op) => op as { id: string; tag: string });
    expect(traces.length).toBe(2); // 바탕 한 겹 + 원천 둘레 한 겹
    const base = WORLD_AUTHOR_TEMPLATES.byDepth[authored.spec.depth]!.traceBase;
    expect(soilStainLevel(traces[0]!.tag)).toBe(base);
    expect(soilStainLevel(traces[1]!.tag)).toBe(base + 1);
    // 짙은 쪽이 곧 원천의 자리다 — 흔적을 따라가면 원천에 닿는다
    expect(traces[1]!.id).toBe(authored.spec.resourceEcology!.sources[0]!.traceOp);
  });
});

describe('T3 — 두 번 내면 같다 · 굳힌 것은 데이터다', () => {
  it('같은 brief 는 글자까지 같은 방을 낸다 (seed 는 brief 의 해시다)', () => {
    const again = authorFromFile(BRIEF);
    expect(JSON.stringify(again)).toBe(JSON.stringify(authored));
    expect(renderRegionModule(again)).toBe(renderRegionModule(authored));
    expect(renderSeams(again)).toBe(renderSeams(authored));
  });

  it('brief 를 한 글자 고치면 seed 가 달라진다 — 답이 자리를 정한다는 뜻이다', () => {
    const raw = JSON.parse(readFileSync(BRIEF, 'utf8')) as Record<string, unknown>;
    (raw.answers as Record<string, unknown>).discovery = '다른 것을 알게 된다';
    const parsed = parseRegionBrief(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const other = authorRegion({ brief: parsed.brief, templates: WORLD_AUTHOR_TEMPLATES });
    expect(other.spec.space.seed).not.toBe(authored.spec.space.seed);
    // 그래도 방의 뼈대는 같은 자리에 선다 — seed 가 흔드는 것은 원천의 후보 순서뿐이다
    expect(other.spec.space.extent).toEqual(authored.spec.space.extent);
  });

  it('굳힌 방은 데이터다 — 규칙도 함수도 import 도 늘지 않는다', () => {
    const module = renderRegionModule(authored);
    // 들이는 것은 형과 layer 상수뿐이다
    const imports = module.match(/^import .*$/gm) ?? [];
    expect(imports).toEqual([
      "import type { RegionSpec } from './spec';",
      "import { ANCHOR_LAYER } from './spec';",
      "import { RESOURCE_LAYER, TRACE_LAYER } from './resource-ecology';",
    ]);
    // 값 하나와 이름 하나뿐 — 함수도 클래스도 조건도 없다
    expect(module).not.toMatch(/\bfunction\b|\bclass\b|\bif\s*\(|=>/);
    expect(module.match(/^export /gm)?.length).toBe(2);
  });

  it('아직 답하지 못한 질문이 굳힌 파일에 적힌다 — 뼈대가 비어 있다는 것을 숨기지 않는다', () => {
    expect(authored.unanswered).toEqual(['birth']);
    expect(renderRegionModule(authored)).toContain('birth');
  });
});
