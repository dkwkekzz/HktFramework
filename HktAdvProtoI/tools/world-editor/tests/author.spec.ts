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
import {
  ASKS_WARMTH,
  ASPECT_HEAT,
  ASPECT_LIGHT,
  BIG_BIRD,
  BIO_ORE,
  COMPILE_RULES,
  FANTASY_MAZE,
  FOREST_CHAIN,
  FORM_ROOT_CLUTCH,
  FORM_ROOT_NODULE,
  LIFE_FORMATION_MODES,
  LIFE_ROLE_MOLT_SUPPLY,
  LOCK_AT_AREA,
  LOCK_AT_CONNECTOR,
  MAZE_PATTERN_P2,
  ORE_EATER,
  POPULATION_DECLINE_CONDITION_LOST,
  POPULATION_DECLINE_EATEN,
  PRESENCE_ORE_EATER_SWARM,
  RECOVERY_TREE_UPTAKE,
  RED_EYE_TREE,
  REGION_GRAPH,
  REGION_RULE_IDS,
  RELATION_EMITS,
  RELATION_HIDES,
  STATEMENT_KINDS,
  TRACE_LAYER,
  propertyTag,
  soilStainLevel,
} from '../../../content/regions';
import { WORLD_AUTHOR_TEMPLATES } from '../../../content/authoring/templates';
import { checkRegions, type CheckRegion } from '../../../engine/world-authoring/check';
import { compileRegion } from '../../../engine/world-authoring/compile';
import type { RegionOp, XZ } from '../../../engine/world-authoring/description';
import { isTraversableAt } from '../../../engine/world-authoring/query';
import { WORLD_CHECK_CONTRACT, WORLD_CHECK_REGIONS } from '../check';
import { authorRegion } from '../../../engine/world-authoring/author';
import { parseRegionBrief } from '../../../engine/world-authoring/brief';
import { authorBrief, authorFromFile, checkAuthored, renderRegionModule, renderSeams } from '../author';

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
    expect(traces[1]!.id).toBe(authored.spec.resourceEcology!.sources[0]!.traceOps[0]);
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

  it('굳힌 파일이 **컴파일된다** — 값이 맞아도 형이 다르면 그 방은 서지 못한다', () => {
    // fixtures/gas-village.generated.ts 는 이 글자를 굳혀 둔 것이고, tsc 가 그 리터럴을 잰다.
    // 여기서는 생성기가 여전히 같은 글자를 내는지만 본다 — 둘이 갈리면 굳힌 것이 낡은 것이다.
    const frozen = readFileSync(
      fileURLToPath(new URL('./fixtures/gas-village.generated.ts', import.meta.url)),
      'utf8',
    );
    const fresh = renderRegionModule(authored).replace(
      /from '\.\//g,
      "from '../../../../content/regions/",
    );
    expect(frozen.endsWith(fresh)).toBe(true);
    // 형이 요구하는 것을 다 낸다 — 하나라도 빠지면 굳힌 파일이 tsc 에서 멎는다
    const source = authored.spec.resourceEcology!.sources[0]!;
    expect(Object.keys(source)).toEqual([
      'id',
      'materialId',
      'worldCause',
      'form',
      'carrier',
      'opportunity',
      'supply',
      'recoveryCause',
      'harvests',
      'recoverySeconds',
      'traceOps',
    ]);
  });

  it('아직 답하지 못한 질문이 굳힌 파일에 적힌다 — 뼈대가 비어 있다는 것을 숨기지 않는다', () => {
    // 목록 **전체**를 단언하지 않는다 — 답이 몇인가는 형이 넓어질 때마다 달라지고
    // (여덟 → 아홉 → 열), 이 brief 파일은 다른 레인의 것이다. 재는 것은 "빈 것이 적힌다" 다
    expect(authored.unanswered).toEqual(expect.arrayContaining(['birth', 'offering']));
    expect(renderRegionModule(authored)).toContain('birth');
  });
});

// ── 생명과 철 (T3 CHANGED — 생성기가 ecology 와 phases 를 낸다) ──────────────
//
// 여기서부터 쓰는 brief 는 **시험 안에서 값으로 짓는다.** content/authoring 의 brief 파일에
// 기대지 않는다 — 그 파일들은 다른 레인의 것이고, 기대면 이 시험이 남의 손에 매인다.
//
// **어휘를 지어내지 않는다.** 탄생 방식 · 세계 상태 · 갈래는 이 세계의 표에서 골라 오고
// (WORLD_AUTHOR_TEMPLATES), 재료 · 규칙 · 형태 · 개체군은 지금 서 있는 방들이 쓰는 이름을
// 그대로 쓴다 (content/regions). 그래서 표가 바뀌면 이 시험이 따라간다 — 시험이 어휘를
// 쥐면 같은 목록이 두 자리에 있게 된다 (형이 어휘를 쥐지 않는 그 규율 그대로).

const T = WORLD_AUTHOR_TEMPLATES;

/** 표가 아는 탄생 방식 하나 — 어느 것인지는 표가 정한다 */
const KNOWN_MODE = Object.keys(T.birthByMode)[0]!;
/** 표가 **모르는** 방식 하나 — 세계의 어휘 넷 가운데 표에 없는 것 (지금은 분화다) */
const UNKNOWN_MODE = LIFE_FORMATION_MODES.find((mode) => !(mode in T.birthByMode)) ?? 'NO_SUCH_MODE';
/** 표가 요구로 옮길 줄 아는 세계 상태 하나 */
const KNOWN_STATE = Object.keys(T.stateRequirement)[0]!;
/**
 * 표에 **없는** 세계 상태 하나 — 지어낸 이름이 아니라 이 세계가 실제로 쓰는 것이다:
 * 뿌리의 알이 부모 개체군을 `source.states` 에 적되 요구는 방식이 건다 (표가 그렇게 적어 두었다).
 */
const UNKNOWN_STATE = ORE_EATER;
/** 철을 말하는 갈래 하나 */
const PHASE_KIND = Object.keys(T.phaseByKind)[0]!;

const SITE_ID = 'AUTHORED_CLUTCH';
const SOURCE_ID = 'AUTHORED_NODULE';
const ROOM_ID = 'AUTHORED_LIFE_ROOM';

// ── 물음이 쓰는 이 세계의 어휘 (T2 확장 ADDED) ────────────────────────────
//
// 여기서도 어휘를 지어내지 않는다 — 걸리는 자리의 갈래도 세기도 성질 태그도 철도 배열도
// 이 세계가 실제로 쓰는 것이다 (content/regions/access.ts · properties.ts · phases.ts).

/** 생성기가 이웃 하나에 내는 문의 이름 — 이름 규칙은 이미 T3 이 세웠다 (`<방>_<이웃>`) */
const DOOR = `${ROOM_ID}_${RED_EYE_TREE}`;
const DOOR_ANCHOR_OP = `anchor-${DOOR.toLowerCase().replace(/_/g, '-')}`;
const LOCK_DOOR = 'AUTHORED_DEPTH_DOOR';
/** 그 문이 묻는 성질 — 빙결 협곡의 문이 묻는 것과 같은 태그다 */
const ASKED_PROPERTY = propertyTag(ASPECT_HEAT, RELATION_HIDES);
/** 이 세계의 철 하나 (content/regions/phases.ts 의 SeasonId 넷 가운데 하나) */
const LONG_NIGHT = 'LONG_NIGHT';
/** 흔적의 이름 둘 — 자리는 생성기가 낸다 (brief 는 이름만 댄다) */
const CLUE_NAMES = ['갈라진 김', '언 자국'];

/** 그 방이 묻는 것 하나 — 값이다 (파일이 아니다) */
function doorLockValue(): Record<string, unknown> {
  return {
    id: LOCK_DOOR,
    at: { kind: LOCK_AT_CONNECTOR, ref: DOOR },
    strength: 'hard',
    important: true,
    requires: [
      { property: ASKED_PROPERTY },
      { seasons: [LONG_NIGHT] },
      { state: { region: FANTASY_MAZE, patterns: [MAZE_PATTERN_P2] } },
    ],
    traces: CLUE_NAMES,
    reason: ASKS_WARMTH,
  };
}

/** 탄생과 철을 밝힌 brief 하나 — 값이다 (파일이 아니다) */
function lifeBriefValue(): Record<string, unknown> {
  return {
    id: ROOM_ID,
    name: '시험이 지은 탄생의 방',
    depth: 'wild',
    kinds: [PHASE_KIND],
    answers: {
      distinction: '뿌리가 지나가는 자리에 무엇이 맺힌다.',
      cause: '숲의 사슬이 이 자리를 지나며 쌓인다.',
      dwelling: '쌓인 것을 먹는 것이 돌고, 그것을 부르는 것이 든다.',
      danger: '맺히는 동안 땅이 떨린다.',
      worth: {
        said: '뿌리에 쌓인 것이 귀하다.',
        sources: [
          {
            id: SOURCE_ID,
            material: BIO_ORE,
            heldBy: 'terrain',
            worldCause: FOREST_CHAIN,
            recoveryCause: RECOVERY_TREE_UPTAKE,
            form: FORM_ROOT_NODULE,
            role: 'conditional',
            // ⑩ 이 원천이 내는 것이 어떤 성질을 가지는가 — 요구에 답할 여지가 여기서 난다.
            // 태그만으로는 모자라 그 재료의 **어느 문장**이 그것을 말하는가까지 든다
            properties: [{ tag: propertyTag(ASPECT_LIGHT, RELATION_EMITS), from: STATEMENT_KINDS[0] }],
          },
        ],
      },
      discovery: '무엇이 여기서 태어나는가를 알게 된다.',
      opening: '태어나는 때를 알면 그 자리가 열린다.',
      birth: {
        said: '쌓인 것이 맺혀 태어난다.',
        born: [
          {
            id: SITE_ID,
            mode: KNOWN_MODE,
            worldCause: FOREST_CHAIN,
            form: FORM_ROOT_CLUTCH,
            regionRule: REGION_RULE_IDS[0],
            // 재료 하나와, 재료가 아닌 상태 둘 — 하나는 표가 알고 하나는 모른다
            from: { materials: [BIO_ORE], states: [KNOWN_STATE, UNKNOWN_STATE] },
            consumes: [SOURCE_ID],
            calls: [BIG_BIRD],
            population: ORE_EATER,
            ecologicalRole: LIFE_ROLE_MOLT_SUPPLY,
          },
        ],
        populations: [
          {
            id: ORE_EATER,
            scale: 2,
            declineCause: POPULATION_DECLINE_CONDITION_LOST,
            presence: PRESENCE_ORE_EATER_SWARM,
          },
          // 떼의 의미를 밝히지 않은 개체군 — 자락이 서지 않아야 한다
          { id: BIG_BIRD, scale: 1, declineCause: POPULATION_DECLINE_EATEN },
        ],
      },
      // ⑨~⑫ 이 방이 묻는 것 — 문 하나에 물음 하나 (access.ts 가 세운 어법)
      asking: {
        said: '깊은 자리로 드는 문이 몸에 남은 열을 묻는다.',
        locks: [doorLockValue()],
      },
      offering: '무엇이 태어났는지를 내밀고, 언제 태어났는지를 기억한다.',
    },
    neighbours: [{ region: RED_EYE_TREE, transition: 'road', direction: 'bidirectional' }],
  };
}

/** 그 brief 를 이 세계의 표와 컴파일 규칙으로 낸다 — 기존 하네스 그대로다 */
function authorLife(over: (b: Record<string, unknown>) => void = () => {}) {
  const value = lifeBriefValue();
  over(value);
  const parsed = parseRegionBrief(value);
  if (!parsed.ok) {
    throw new Error(parsed.problems.map((p) => `${p.path} ${p.message}`).join('\n'));
  }
  return authorBrief(parsed.brief);
}

const life = authorLife();
/** 그 방 Description 의 op 하나 — 자락이 실제로 그 방에 있는지 묻는 자리 */
const opById = (id: string): Record<string, unknown> | undefined =>
  life.spec.space.ops.find((op) => op.id === id) as unknown as Record<string, unknown> | undefined;

/** 컨텐츠의 탄생지 표가 적은 키 차례 — 굳힌 글자가 이 차례여야 그 방이 컴파일된다 */
const SITE_KEYS = [
  'id',
  'mode',
  'worldCause',
  'form',
  'source',
  'condition',
  'transition',
  'consumes',
  'leaves',
  'spentSeconds',
  'traces',
  'ecologicalRole',
  'population',
  'bindingSeconds',
];

describe('T3 — 탄생을 밝힌 brief 가 생명을 낸다', () => {
  const site = life.spec.ecology!.lifeFormation![0]!;

  it('탄생지가 선다 — 키와 차례가 컨텐츠의 탄생지 표와 같다 (값이 맞아도 형이 다르면 방이 서지 못한다)', () => {
    expect(life.spec.ecology!.lifeFormation!.map((one) => one.id)).toEqual([SITE_ID]);
    // 차례가 표 그대로다 — 밝히지 않은 자리(leaves · spentSeconds)만 빠질 수 있다
    expect(Object.keys(site)).toEqual(SITE_KEYS.filter((key) => key in site));
    expect(
      SITE_KEYS.filter((key) => key !== 'leaves' && key !== 'spentSeconds' && !(key in site)),
    ).toEqual([]);
    // 남기는 것을 밝히지 않았으므로 그 키가 없다 — 빈 목록을 굳히면 없음이 목록으로 읽힌다
    expect('leaves' in site).toBe(false);
    // 방이 밝힌 것은 brief 에서, 시간 규모와 다 찬 뒤의 자리는 방식별 기본형에서 온다
    const defaults = T.birthByMode[KNOWN_MODE]!;
    expect({
      mode: site.mode,
      worldCause: site.worldCause,
      form: site.form,
      source: site.source,
      consumes: site.consumes,
      ecologicalRole: site.ecologicalRole,
      population: site.population,
      transition: site.transition,
      bindingSeconds: site.bindingSeconds,
      spentSeconds: site.spentSeconds,
    }).toEqual({
      mode: KNOWN_MODE,
      worldCause: FOREST_CHAIN,
      form: FORM_ROOT_CLUTCH,
      source: { materials: [BIO_ORE], states: [KNOWN_STATE, UNKNOWN_STATE] },
      consumes: [SOURCE_ID],
      ecologicalRole: LIFE_ROLE_MOLT_SUPPLY,
      population: ORE_EATER,
      transition: defaults.transition,
      bindingSeconds: defaults.bindingSeconds,
      spentSeconds: defaults.spentSeconds,
    });
    // 방의 키 차례도 컨텐츠의 RegionSpec 그대로다 — 철이 생태 앞에 선다
    expect(Object.keys(life.spec)).toEqual(
      ['id', 'depth', 'space', 'resourceEcology', 'phases', 'access', 'ecology'].filter(
        (key) => key in life.spec,
      ),
    );
  });

  it('자리는 Description 이 소유한다 — 탄생지마다 point 가 서고 그 tag 가 탄생지의 id 다', () => {
    // 원천이 세운 규율 그대로다: 자리는 땅의 일이라 Description 이 쥐어야
    // 컴파일 · 관찰 · 검사가 다 같은 것을 본다
    const op = opById(`site-${SITE_ID.toLowerCase().replace(/_/g, '-')}`)!;
    expect({ kind: op.kind, layer: op.layer, tag: op.tag }).toEqual({
      kind: 'point',
      layer: T.resourceLayer,
      tag: SITE_ID,
    });
    expect(op.position).toBeDefined();
  });

  it('전조 자락이 그 방에 **실제로 있다** — 검사 ㉙ 이 묻는 것이 이것이다', () => {
    expect(site.traces.before.length).toBeGreaterThan(0);
    for (const trace of site.traces.before) {
      const op = opById(trace.op);
      expect({ op: trace.op, kind: op?.kind, layer: op?.layer }).toEqual({
        op: trace.op,
        kind: 'area',
        layer: T.traceLayer,
      });
    }
    // 뒤에 남는 것은 밝히지 않았다 — 자락이 무엇을 뜻하는지 잰 적이 없으므로 지어내지 않는다
    expect(site.traces.after).toEqual([]);
  });

  it('요구가 소비와 상태와 방식에서 난다 — **표에 없는 상태는 요구가 되지 않는다**', () => {
    const defaults = T.birthByMode[KNOWN_MODE]!;
    const state = T.stateRequirement[KNOWN_STATE]!;
    // 차례도 뜻이다: 무엇을 먹는가 → 무엇이 그때인가 → 누가 아직 없는가(또는 있는가)
    expect(site.condition.requires).toEqual([
      { kind: 'source-available', sourceId: SOURCE_ID, unmetCode: defaults.sourceUnmetCode },
      { kind: state.kind, unmetCode: state.unmetCode },
      ...(defaults.populationRequirement
        ? [
            {
              kind: defaults.populationRequirement.kind,
              populationId: ORE_EATER,
              value: defaults.populationRequirement.value,
              unmetCode: defaults.populationRequirement.unmetCode,
            },
          ]
        : []),
    ]);
    // 모르는 상태는 **걸러지고 지나간다** — 요구로 지어내면 세계가 묻지 않을 것을 묻게 된다.
    // (그 이름이 개체군 요구의 자리에 서는 것은 방식이 건 것이지 상태가 낳은 것이 아니다)
    expect(site.condition.requires.map((one) => one.kind)).not.toContain(UNKNOWN_STATE);
    expect(site.condition.requires.filter((one) => one.unmetCode === undefined)).toEqual([]);
    expect(site.condition.regionRule).toBe(REGION_RULE_IDS[0]);
  });

  it('기본형이 없는 방식은 서지 않는다 — 지어내는 대신 **왜 못 냈는지**가 남는다', () => {
    const orphan = authorLife((b) => {
      const answers = b.answers as Record<string, any>;
      answers.birth.born[0].mode = UNKNOWN_MODE;
    });
    expect(orphan.spec.ecology?.lifeFormation).toBeUndefined();
    // 못 낸 자리가 조용히 사라지지 않는다 — 무엇을 왜 못 냈는지가 값으로 남는다
    expect(orphan.unauthored.length).toBeGreaterThan(0);
    for (const one of orphan.unauthored) {
      expect({ what: one.what.length > 0, why: one.why.length > 0 }).toEqual({
        what: true,
        why: true,
      });
    }
    const said = JSON.stringify(orphan.unauthored);
    expect(said).toContain(SITE_ID);
    expect(said).toContain(UNKNOWN_MODE);
    // 아는 방식만 적은 방은 남길 것이 없다
    expect(life.unauthored).toEqual([]);
  });

  it('떼의 자락이 값만큼 선다 — 밝히지 않은 개체군은 자락이 없다 (실을 이름이 없다)', () => {
    const swarm = life.spec.ecology!.populations!.find((one) => one.id === ORE_EATER)!;
    const quiet = life.spec.ecology!.populations!.find((one) => one.id === BIG_BIRD)!;
    expect(swarm.presenceOps).toHaveLength(swarm.scale);
    expect({ presence: quiet.presence, ops: quiet.presenceOps }).toEqual({
      presence: undefined,
      ops: undefined,
    });
    // 자락도 그 방 Description 이 소유한다 — 개체군은 op id 만 든다
    const half = T.byDepth[life.spec.depth]!.half;
    const at = opById(`site-${SITE_ID.toLowerCase().replace(/_/g, '-')}`)!.position;
    swarm.presenceOps!.forEach((id, index) => {
      const op = opById(id)!;
      expect({ id, kind: op.kind, layer: op.layer, tag: op.tag, shape: op.shape }).toEqual({
        id,
        kind: 'area',
        layer: T.presenceLayer,
        tag: swarm.presence,
        shape: {
          kind: 'circle',
          center: at,
          radius: Math.round(half * T.population.radiusStep * (index + 1) * 100) / 100,
        },
      });
    });
  });

  it('관계는 **이음을 내지 않는다** — 두 끝이 어느 방에 사는지를 생성기는 모른다', () => {
    expect(life.spec.ecology!.links).toEqual([
      { from: ORE_EATER, to: BIG_BIRD, kind: 'CALLS' },
    ]);
    // 같은 방이면 밝힐 이음이 없고, 방을 넘으면 사람이 붙인다 (renderSeams 가 그 자리를 댄다)
    for (const link of life.spec.ecology!.links!) {
      expect('via' in link).toBe(false);
    }
  });

  it('없음이 답이 된다 — 밝힌 사유가 서고, 미답이면 생태 자체가 나오지 않는다', () => {
    const reason = '여기서 태어나는 것이 없다 — 맺힐 열이 남지 않기 때문이다';
    const barren = authorLife((b) => {
      const answers = b.answers as Record<string, unknown>;
      answers.birth = { said: reason, born: [], populations: [] };
    });
    expect(barren.spec.ecology).toEqual({ absenceReason: reason });
    // 미답은 사유가 아니다 — "아직 안 만들었다" 와 "원래 없다" 를 갈라 읽어야 한다
    const silent = authorLife((b) => {
      const answers = b.answers as Record<string, unknown>;
      answers.birth = {
        said: { unanswered: '무엇이 태어나는가를 아직 답하지 못했다' },
        born: [],
        populations: [],
      };
    });
    expect(silent.spec.ecology).toBeUndefined();
  });
});

describe('T3 — 갈래가 철을 고른다', () => {
  it('갈래가 철을 말하면 phases 가 서고, 덧씌움이 가리킨 area 가 그 방에 실제로 있다', () => {
    const phases = life.spec.phases!;
    expect(phases).toBeDefined();
    for (const recipe of T.phaseByKind[PHASE_KIND]!) {
      const season = phases.seasons[recipe.season]!;
      if (recipe.depth !== undefined) {
        const overlay = season.depthOverlay!.find((one) => one.depth === recipe.depth)!;
        const op = opById(overlay.areaId);
        expect({ season: recipe.season, depth: overlay?.depth, layer: op?.layer }).toEqual({
          season: recipe.season,
          depth: recipe.depth,
          layer: T.depthLayer,
        });
      }
      if (recipe.hazard !== undefined) {
        const overlay = season.hazardExtend!.find((one) => one.hazard === recipe.hazard)!;
        const op = opById(overlay.areaId);
        expect({ season: recipe.season, hazard: overlay?.hazard, layer: op?.layer }).toEqual({
          season: recipe.season,
          hazard: recipe.hazard,
          layer: T.hazardLayer,
        });
      }
    }
  });

  it('갈래가 철을 말하지 않으면 phases 가 없다 — 없는 철을 지어 걸지 않는다', () => {
    const flat = authorLife((b) => {
      b.kinds = [];
    });
    expect(flat.spec.phases).toBeUndefined();
  });

  it('원천이 없는 방은 철 덧씌움을 내지 않는다 — 걸 자락이 없다', () => {
    const bare = authorLife((b) => {
      const answers = b.answers as Record<string, any>;
      answers.worth.sources = [];
    });
    expect(bare.spec.phases).toBeUndefined();
  });
});

describe('T3 — 생성한 방이 생명 검사 ㉗~㉝ 을 지난다', () => {
  // 후보를 지금 세계 곁에 세워 재는 자리는 하나다 (checkAuthored) — 이웃 anchor 를 놓아 주고
  // 그 방이 새로 낳는 것을 실어 주는, 사람이 붙일 줄을 붙인 뒤의 세계다.
  const report = checkAuthored(life);
  const LIFE_IDS = [
    'life-formation-refs',
    'life-world-cause',
    'life-traces-consumes',
    'life-mode-spread',
    'life-recovery-owner',
    'life-link-refs',
    'life-link-spread',
  ];
  const itemOf = (id: string) => report.items.find((item) => item.id === id)!;

  it('일곱 중 하나도 무너지지 않는다 — 그래서 이 방을 세계에 **들일 수 있다**', () => {
    const fell = LIFE_IDS.map((id) => ({ id, status: itemOf(id).status })).filter(
      (one) => one.status === 'fail',
    );
    expect(fell).toEqual([]);
  });

  it('㉗ ㉘ ㉙ 이 통과한다 — 가리킨 것이 다 세계에 있고, 전조도 소비도 비지 않았다', () => {
    for (const id of ['life-formation-refs', 'life-world-cause', 'life-traces-consumes']) {
      const item = itemOf(id);
      expect({ id, status: item.status, refs: item.refs }).toEqual({
        id,
        status: 'pass',
        refs: [],
      });
    }
  });

  it('일곱이 이 방을 **실제로 재고 있다** — 계통을 주지 않아 조용히 지나간 것이 아니다', () => {
    // absent 는 통과가 아니다 (기반이 그렇게 적어 두었다). 그러니 이 방이 두 보고에 이름으로 서야
    // 위의 두 시험이 빈 것을 잰 것이 아님이 밝혀진다
    expect(itemOf('life-mode-spread').refs.map((ref) => ref.where)).toContain(life.spec.id);
    expect(itemOf('life-link-spread').refs.map((ref) => ref.where)).toContain(ORE_EATER);
  });
});

describe('T3 — 생명과 철이 붙어도 두 번 내면 같고, 굳힌 것은 여전히 데이터다', () => {
  it('같은 brief 를 두 번 넣으면 두 방이 **깊은 수준에서** 같다 — 시각도 난수도 쓰지 않는다', () => {
    const again = authorLife();
    expect(again).toEqual(life);
    // 키 차례까지 같아야 굳힌 글자가 같다 (toEqual 은 차례를 묻지 않는다)
    expect(JSON.stringify(again)).toBe(JSON.stringify(life));
    expect(renderRegionModule(again)).toBe(renderRegionModule(life));
  });

  it('굳힌 글자에 생명과 철이 **값으로** 실린다 — 규칙도 함수도 늘지 않는다', () => {
    const module = renderRegionModule(life);
    expect(module).not.toMatch(/\bfunction\b|\bclass\b|\bif\s*\(|=>/);
    expect(module.match(/^export /gm)?.length).toBe(2);
    // 방 하나가 느는 데 규칙 코드는 한 줄도 늘지 않는다 — 탄생지도 철도 그 방의 데이터다
    for (const said of [SITE_ID, ORE_EATER, LOCK_DOOR, 'lifeFormation', 'phases', 'access']) {
      expect({ said, in: module.includes(said) }).toEqual({ said, in: true });
    }
  });

  // GAP — 굳힌 파일을 **tsc 가 재는** 자리는 fixtures/ 의 굳힌 글자 하나다
  // (gas-village.generated.ts 가 그 일을 한다: 시험은 생성기가 같은 글자를 내는지만 보고,
  // 형이 맞는지는 저장소 컴파일이 잰다). 생명·철이 붙은 방으로 그 잣대를 세우려면 굳힌 파일
  // 하나와 그것을 낳는 brief 파일 하나가 저장소에 서야 하는데, 그 둘은 이 시험의 담당 밖이다
  // (fixtures 는 굳힌 생성물이고 brief 는 content/authoring 의 것이다).
  // 그동안 여기서 재는 것은 **키와 차례**다 — tsc 가 잡을 것을 값으로 잡는다 (위 첫 시험).
  it.todo(
    'GAP: 생명·철이 붙은 방의 굳힌 파일이 컴파일된다 — fixtures 의 굳힌 글자와 그것을 낳는 brief 파일이 필요하다',
  );
});

// ── 물음 (T2 확장 CHANGED — 생성기가 access 를 낸다) ──────────────────────
//
// 목적은 원문 §12 가 든 둘을 막는 것이다 — **열쇠 없는 문 백 개**와 **문마다 전용 열쇠 하나**.
// 그래서 여기서 재는 것도 그 둘이다: 물음마다 알아낼 흔적이 실제로 서는가(㊶) · 그 흔적이
// 물음이 걸린 자리 곁에 서는가. 답이 여럿인가는 이 방 하나로 알 수 없으므로 재지 않는다 (⑪).

/** 그 방 Description 의 op 하나 */
const opOf = (region: typeof life, id: string): Record<string, unknown> | undefined =>
  region.spec.space.ops.find((op) => op.id === id) as unknown as Record<string, unknown> | undefined;

/** 컨텐츠의 Lock 이 적은 키 차례 (content/regions/access.ts) — 굳힌 글자가 이 차례여야 방이 컴파일된다 */
const LOCK_KEYS = ['id', 'at', 'strength', 'requires', 'important', 'traces', 'reason'];

describe('T3 — 물음을 밝힌 brief 가 access 를 낸다', () => {
  const lock = life.spec.access!.locks![0]!;

  it('물음이 선다 — 키와 차례가 컨텐츠의 Lock 과 같다 (값이 맞아도 형이 다르면 그 방이 서지 못한다)', () => {
    expect(life.spec.access!.locks!.map((one) => one.id)).toEqual([LOCK_DOOR]);
    expect(Object.keys(lock)).toEqual(LOCK_KEYS.filter((key) => key in lock));
    // 밝힌 것은 brief 에서 그대로 온다 — 생성기가 어디에 걸리는지도 얼마나 센지도 정하지 않는다
    expect({
      at: lock.at,
      strength: lock.strength,
      important: lock.important,
      reason: lock.reason,
    }).toEqual({
      at: { kind: LOCK_AT_CONNECTOR, ref: DOOR },
      strength: 'hard',
      important: true,
      reason: ASKS_WARMTH,
    });
  });

  it('요구를 그대로 옮긴다 — 밝힌 갈래만 싣고, 철은 비지 않을 때만 든다', () => {
    expect(lock.requires).toEqual([
      { property: ASKED_PROPERTY },
      { time: { seasons: [LONG_NIGHT] } },
      { state: { region: FANTASY_MAZE, patterns: [MAZE_PATTERN_P2] } },
    ]);
  });

  it('**아무 갈래도 밝히지 않은 요구는 걸러진다** — 빈 요구를 굳혀 두면 요구가 없는 것을 요구로 읽는다', () => {
    const knowledge = '깊은 자리로 드는 길을 안다';
    const filtered = authorLife((b) => {
      const asking = (b.answers as Record<string, any>).asking;
      asking.locks = [{ ...doorLockValue(), requires: [{}, { knowledge }] }];
    });
    expect(filtered.spec.access!.locks![0]!.requires).toEqual([{ knowledge }]);
  });

  it('물음마다 흔적이 하나 이상이고 그 op 이 그 방에 **실제로 있다** — 검사 ㊶ 이 묻는 것이 이것이다', () => {
    // brief 가 이름을 대면 그 수만큼 선다 — 이름 하나에 자락 하나
    expect(lock.traces).toHaveLength(CLUE_NAMES.length);
    lock.traces.forEach((trace, index) => {
      const op = opOf(life, trace.op);
      expect({ op: trace.op, kind: op?.kind, layer: op?.layer, tag: op?.tag }).toEqual({
        op: trace.op,
        kind: 'area',
        layer: T.clueLayer,
        tag: CLUE_NAMES[index],
      });
    });
  });

  it('이름을 대지 않으면 흔적 하나가 선다 — **열쇠 없는 문**을 내지 않는다 (지어내는 것과 다르다)', () => {
    const unnamed = authorLife((b) => {
      const one = (b.answers as Record<string, any>).asking.locks[0];
      delete one.traces;
    });
    const traces = unnamed.spec.access!.locks![0]!.traces;
    expect(traces).toHaveLength(1);
    // 실을 이름이 없으므로 그 물음의 이름이 선다 — 자락은 서되 무엇을 뜻하는지는 지어내지 않는다
    expect(opOf(unnamed, traces[0]!.op)!.tag).toBe(LOCK_DOOR);
  });

  it('**문에 걸린 물음의 흔적은 그 문 곁에 선다** — 알아낼 자리가 물어보는 자리에서 멀면 알 수 없다', () => {
    const anchor = opOf(life, DOOR_ANCHOR_OP)!.position;
    expect(anchor).toBeDefined();
    const half = T.byDepth[life.spec.depth]!.half;
    for (const trace of lock.traces) {
      const op = opOf(life, trace.op)!;
      expect(op.shape).toEqual({
        kind: 'circle',
        center: anchor,
        // 탄생지 전조와 같은 반지름 — 자락의 크기는 물음마다 정하는 것이 아니다
        radius: Math.round(half * 0.25 * 100) / 100,
      });
    }
  });

  it('문에 걸리지 않은 물음의 흔적은 그 문에서 떨어져 선다 — 자리를 고르는 되풀이가 다르다', () => {
    // 자락에 걸리는 물음은 그 방에 **이미 선 자락**을 가리켜야 한다 (㉞ 이 실재를 묻는다) —
    // 그래서 위에서 이미 선 흔적 하나를 가리킨다
    const ref = lock.traces[0]!.op;
    const asked = authorLife((b) => {
      (b.answers as Record<string, any>).asking.locks.push({
        id: 'AUTHORED_FIELD_ASK',
        at: { kind: LOCK_AT_AREA, ref },
        strength: 'soft',
        requires: [{ property: ASKED_PROPERTY }],
      });
    });
    const field = asked.spec.access!.locks![1]!;
    expect(field.id).toBe('AUTHORED_FIELD_ASK');
    // 밝히지 않은 중요는 키를 두지 않는다 — 거짓을 굳혀 두면 "밝히지 않았다" 가 지워진다
    expect('important' in field).toBe(false);
    const clue = opOf(asked, field.traces[0]!.op)!;
    expect((clue.shape as Record<string, unknown>).center).not.toEqual(opOf(asked, DOOR_ANCHOR_OP)!.position);
  });

  it('**침묵이 답이 된다** — 묻지 않는 방은 사유가 서고, 미답이면 access 자체가 나오지 않는다', () => {
    const reason = '여기는 아무것도 묻지 않는다 — 걸릴 것이 남지 않았기 때문이다';
    const quiet = authorLife((b) => {
      (b.answers as Record<string, unknown>).asking = { said: reason, locks: [] };
    });
    expect(quiet.spec.access).toEqual({ silence: reason });
    // 미답은 사유가 아니다 — "아직 안 적었다" 와 "원래 묻지 않는다" 를 갈라 읽어야 한다
    // (탄생의 absenceReason 이 선 그 자리 그대로)
    const silent = authorLife((b) => {
      (b.answers as Record<string, unknown>).asking = {
        said: { unanswered: '이 방이 무엇을 묻는가를 아직 답하지 못했다' },
        locks: [],
      };
    });
    expect(silent.spec.access).toBeUndefined();
    // 침묵과 물음은 **함께 서지 않는다** — 묻는 방에 "왜 묻지 않는가" 가 실리면 둘 다 거짓이 된다
    expect('silence' in life.spec.access!).toBe(false);
  });

  it('물음이 붙어도 두 번 내면 **깊은 수준에서** 같다 — 시각도 난수도 쓰지 않는다', () => {
    const again = authorLife();
    expect(again.spec.access).toEqual(life.spec.access);
    // 키 차례까지 같아야 굳힌 글자가 같다 (toEqual 은 차례를 묻지 않는다)
    expect(JSON.stringify(again.spec.access)).toBe(JSON.stringify(life.spec.access));
  });
});

describe('T3 — 생성한 방이 접근 검사 ㉞~㊷ 을 지난다', () => {
  const report = checkAuthored(life);
  const ACCESS_IDS = [
    'access-refs',
    'access-answer',
    'access-property-spread',
    'access-answer-distance',
    'access-orphan-property',
    'access-answer-kinds',
    'access-answer-variety',
    'access-trace',
    'access-behind-lock',
  ];
  const itemOf = (id: string) => report.items.find((item) => item.id === id);

  it('아홉 중 하나도 무너지지 않는다 — 그래서 이 방을 세계에 **들일 수 있다**', () => {
    const fell = ACCESS_IDS.map((id) => ({ id, status: itemOf(id)?.status })).filter(
      (one) => one.status === 'fail',
    );
    expect(fell).toEqual([]);
  });

  it('㊶ 이 이 방의 물음을 **실제로 재고 있다** — 계통을 주지 않아 absent 로 지나간 것이 아니다', () => {
    // absent 는 통과가 아니다 (기반이 그렇게 적어 두었다). 그러니 흔적 검사가 pass 로 서야
    // 위 시험이 빈 것을 잰 것이 아님이 밝혀진다
    expect(itemOf('access-trace')?.status).toBe('pass');
  });

  it('보고에 이 방의 물음이 **이름으로 선다** — 세는 항목 둘이 그것을 읊는다', () => {
    // ㊲ 은 성질을 묻는 Lock 을, ㊴ 은 중요한 Lock 을 센다 — 이 방의 물음은 둘 다다
    expect(itemOf('access-answer-distance')?.refs.map((ref) => ref.where)).toContain(LOCK_DOOR);
    expect(itemOf('access-answer-kinds')?.refs.map((ref) => ref.where)).toContain(LOCK_DOOR);
  });
});
