// C034 — 검사 둘(㊸ ㊼)이 방이 세는 것과 남는 것을 잰다 (engine/world-authoring/check.ts).
//
// 이 파일은 **게임을 모른다** — 방도 원천도 경로도 지우는 손도 여기서 지어 준다
// (`A` · `S1` · `R1` · `time` · `season`). 기억이 무엇을 세는지 기반이 알지 못한다는 것이
// 이 둘의 규율이고, 그것을 재는 자리가 여기다.
//
// ㊸ 는 **양쪽으로** 재므로 걸린 세계도 둘이다 — 없는 것을 가리키는 키(유령)와
// 있는데 셀 자리가 없는 것. ㊼ 은 판정하지 않는다는 것 자체를 잰다 (ok 를 떨어뜨리지 않는다).

import { describe, expect, it } from 'vitest';
import {
  checkRegions,
  type CheckContract,
  type CheckEcology,
  type CheckEcologySource,
  type CheckMemory,
  type CheckRegion,
  type CheckTime,
} from '../check';
import type { RegionDescription } from '../description';
import type { Connector, RegionGraph } from '../graph';

/** 이 시험이 쓰는 명사 — 기반은 이 이름들을 모른다. 계약으로 건넨다 */
const CONTRACT: CheckContract = {
  anchorLayer: 'door',
  resourceLayer: 'ore',
  hazardLayer: 'danger',
  phenomenonLayer: 'weather',
  settlementLayer: 'living',
  settlementTags: ['camp'],
  conditionPrefix: 'because:',
  traceLayer: 'hint',
  startRegion: 'A',
};

function space(id: string, ops: RegionDescription['ops'] = []): RegionDescription {
  return { id, extent: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, seed: 1, ops };
}

const door = (tag: string) =>
  ({ id: tag, kind: 'point', layer: 'door', tag, position: { x: 0, z: 0 } }) as const;

const link: Connector = {
  id: 'AB',
  from: { region: 'A', anchor: 'A_TO_B' },
  to: { region: 'B', anchor: 'B_TO_A' },
  direction: 'bidirectional',
  transition: 'walk',
};

const GRAPH: RegionGraph = {
  regions: ['A', 'B'],
  containment: [],
  connectors: [link],
  frontiers: [],
};

const REGIONS: CheckRegion[] = [
  { id: 'A', depth: 'near', coreRules: 0, space: space('A', [door('A_TO_B')]) },
  { id: 'B', depth: 'far', coreRules: 0, space: space('B', [door('B_TO_A')]) },
];

/** 원천 하나 — ㊸ 이 보는 것은 id 와 region 뿐이므로 나머지는 채우기만 한다 */
function source(id: string, region: string): CheckEcologySource {
  return {
    id,
    region,
    materialId: 'm1',
    worldCause: 'c1',
    supply: 'steady',
    renewable: false,
    recoveryCause: '',
    finite: false,
    depletionConsequence: '',
    traces: [],
    opportunity: 'o',
    carrier: 'k',
  };
}

/** S1 은 A 에, S2 는 B 에 선다 */
function ecology(): CheckEcology {
  return {
    materials: [{ id: 'm1', worldCause: 'c1' }],
    sources: [source('S1', 'A'), source('S2', 'B')],
    flows: [],
    regions: [
      { id: 'A', isolationReason: '' },
      { id: 'B', isolationReason: '' },
    ],
  };
}

const node = (region: string) => [{ region, curve: 'line' }] as const;

/** R1 은 A 와 B 를 지나고 R2 는 B 만 지난다 */
function time(): CheckTime {
  const route = (id: string, regions: readonly string[]) => ({
    id,
    presence: 'thing',
    nodes: regions.map((region) => node(region)),
    seasons: [],
    everyNCycles: 1,
    effectAreas: [],
    leaves: [],
  });
  return {
    seasons: ['s1'],
    dayPhases: ['d1'],
    presenceLayer: 'line',
    phases: [],
    routes: [route('R1', ['A', 'B']), route('R2', ['B'])],
    seasonalConnectors: [],
    seasonalSources: [],
    sourceIds: ['S1', 'S2'],
  };
}

/** 아무 데도 걸리지 않는 기억 — 방마다 그 방의 원천과 그 방을 지나는 경로가 다 있다 */
function memory(): CheckMemory {
  return {
    regions: [
      { id: 'A', sources: ['S1'], routes: ['R1'] },
      { id: 'B', sources: ['S2'], routes: ['R1', 'R2'] },
    ],
    persistence: [
      { path: 'region.tracks', eraser: 'time' },
      { path: 'region.sources.taken', eraser: 'turn' },
      { path: 'region.history', eraser: 'none' },
    ],
    erasers: ['time', 'turn', 'none'],
  };
}

interface World {
  ecology?: CheckEcology;
  time?: CheckTime;
  memory?: CheckMemory;
}

const run = (world: World) =>
  checkRegions({
    regions: REGIONS,
    graph: GRAPH,
    contract: CONTRACT,
    ecology: world.ecology,
    time: world.time,
    memory: world.memory,
  });

const sound = (): World => ({ ecology: ecology(), time: time(), memory: memory() });

/** 그 검사 하나 */
const itemOf = (world: World, id: string) => run(world).items.find((item) => item.id === id)!;

describe('checkRegions — 기억 쪽 둘의 형', () => {
  it('㊸ ㊼ 이 ㊷ 다음에 번호 순으로 붙는다', () => {
    const items = run(sound()).items.slice(-2);
    expect(items.map((item) => item.mark)).toEqual(['㊸', '㊼']);
    expect(items.map((item) => item.id)).toEqual(['memory-refs', 'persistence-summary']);
  });

  it('기억 쪽 계약을 주지 않으면 둘이 전부 absent 다 — 통과로 적지 않는다', () => {
    const two = run({ ecology: ecology(), time: time() }).items.slice(-2);
    expect(two.map((item) => item.status)).toEqual(['absent', 'absent']);
    expect(two.map((item) => item.answer)).toEqual(
      Array(2).fill('기억 쪽 계약이 주어지지 않았다'),
    );
  });

  it('두 번 돌리면 글자까지 같다 — 세계를 바꾸지 않는 읽기 전용 관찰이다', () => {
    expect(JSON.stringify(run(sound()))).toBe(JSON.stringify(run(sound())));
  });
});

describe('㊸ 기억이 가리키는 원천과 경로', () => {
  it('방마다 셀 것이 다 있고 유령이 없으면 통과이고 수가 적힌다', () => {
    const item = itemOf(sound(), 'memory-refs');
    expect(item.status).toBe('pass');
    expect(item.answer).toBe('방 2 · 원천 키 2 · 경로 키 3 · 걸린 것 0');
    expect(item.refs).toEqual([]);
  });

  it('모르는 방의 기억이 잡히고 그 방의 키는 견주지 않는다', () => {
    const world = sound();
    world.memory!.regions = [...world.memory!.regions, { id: 'Z', sources: ['S1'], routes: [] }];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([{ where: 'Z', detail: 'Z 은 아는 방이 아니다' }]);
  });

  it('유령을 가리키는 원천 키가 잡힌다 — 없는 것과 남의 방 것을 갈라 적는다', () => {
    const world = sound();
    world.memory!.regions = [
      { id: 'A', sources: ['S1', 'S2', 'S9'], routes: ['R1'] },
      { id: 'B', sources: ['S2'], routes: ['R1', 'R2'] },
    ];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'A', detail: '원천 S2 은 이 방의 것이 아니다' },
      { where: 'A', detail: '원천 S9 은 아는 원천이 아니다' },
    ]);
  });

  it('유령을 가리키는 경로 키가 잡힌다 — 지나지 않는 경로와 없는 경로를 갈라 적는다', () => {
    const world = sound();
    world.memory!.regions = [
      { id: 'A', sources: ['S1'], routes: ['R1', 'R2', 'R9'] },
      { id: 'B', sources: ['S2'], routes: ['R1', 'R2'] },
    ];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'A', detail: '경로 R2 은 이 방을 지나지 않는다' },
      { where: 'A', detail: '경로 R9 은 아는 경로가 아니다' },
    ]);
  });

  it('그 방에 있는데 셀 자리가 없는 원천과 경로가 잡힌다 (역방향)', () => {
    const world = sound();
    world.memory!.regions = [
      { id: 'A', sources: [], routes: [] },
      { id: 'B', sources: ['S2'], routes: ['R1', 'R2'] },
    ];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'A', detail: '원천 S1 을 셀 자리가 없다' },
      { where: 'A', detail: '이 방을 지나는 경로 R1 을 셀 자리가 없다' },
    ]);
  });

  it('기억 자리를 아예 밝히지 않은 방도 그만큼 걸린다 — 기억은 모든 방에 서는 것이다', () => {
    const world = sound();
    world.memory!.regions = [{ id: 'A', sources: ['S1'], routes: ['R1'] }];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'B', detail: '원천 S2 을 셀 자리가 없다' },
      { where: 'B', detail: '이 방을 지나는 경로 R1 을 셀 자리가 없다' },
      { where: 'B', detail: '이 방을 지나는 경로 R2 을 셀 자리가 없다' },
    ]);
  });

  it('계통을 주지 않으면 원천 쪽 잣대를 재지 않는다 — 경로 쪽은 그대로 잰다', () => {
    const world = sound();
    world.ecology = undefined;
    world.memory!.regions = [
      { id: 'A', sources: ['S9'], routes: ['R1', 'R2'] },
      { id: 'B', sources: [], routes: ['R1', 'R2'] },
    ];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    // S9 도 A 의 빈 원천 자리도 적히지 않는다 — 원천의 진리를 주지 않았기 때문이다
    expect(item.refs).toEqual([{ where: 'A', detail: '경로 R2 은 이 방을 지나지 않는다' }]);
  });

  it('시간 쪽 계약을 주지 않으면 경로 쪽 잣대를 재지 않는다 — 원천 쪽은 그대로 잰다', () => {
    const world = sound();
    world.time = undefined;
    world.memory!.regions = [
      { id: 'A', sources: [], routes: ['R9'] },
      { id: 'B', sources: ['S2'], routes: [] },
    ];
    const item = itemOf(world, 'memory-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([{ where: 'A', detail: '원천 S1 을 셀 자리가 없다' }]);
  });
});

describe('㊼ 남는 것의 종류와 기억의 크기', () => {
  it('지우는 손마다의 State 경로와 방마다의 기억 크기를 적는다 — 판정하지 않는다', () => {
    const item = itemOf(sound(), 'persistence-summary');
    expect(item.status).toBe('report');
    expect(item.answer).toBe(
      'State 경로 3 · 지우는 손 3 · 모르는 손 0 · 방 2 · 기억 크기 합 5 · 가장 큰 방 B 3',
    );
    expect(item.refs).toEqual([
      { where: 'time', detail: 'State 경로 1 (region.tracks)' },
      { where: 'turn', detail: 'State 경로 1 (region.sources.taken)' },
      { where: 'none', detail: 'State 경로 1 (region.history)' },
      { where: 'A', detail: '기억 크기 2 (원천 1 · 경로 1)' },
      { where: 'B', detail: '기억 크기 3 (원천 1 · 경로 2)' },
    ]);
  });

  it('어휘 밖의 손을 적은 줄이 "모르는 손" 으로 선다 — 그래도 ok 는 떨어지지 않는다', () => {
    const world = sound();
    world.memory!.persistence = [
      ...world.memory!.persistence,
      { path: 'region.rule.pattern', eraser: 'nobody' },
    ];
    const item = itemOf(world, 'persistence-summary');
    expect(item.status).toBe('report');
    expect(item.answer.startsWith('State 경로 4 · 지우는 손 3 · 모르는 손 1')).toBe(true);
    expect(item.refs).toContainEqual({
      where: 'region.rule.pattern',
      detail: '모르는 손 nobody — 지우는 손 어휘에 없다',
    });
    // 요약은 판정하지 않는다 — 걸린 검사의 수가 성한 세계와 같다
    expect(run(world).counts.fail).toBe(run(sound()).counts.fail);
  });

  it('지우는 손에 아무 State 경로도 없으면 수만 적는다', () => {
    const world = sound();
    world.memory!.erasers = ['time', 'turn', 'none', 'watcher'];
    const item = itemOf(world, 'persistence-summary');
    expect(item.refs[3]).toEqual({ where: 'watcher', detail: 'State 경로 0' });
  });

  it('기억을 밝힌 방이 없으면 가장 큰 방도 없다', () => {
    const world = sound();
    world.memory!.regions = [];
    const item = itemOf(world, 'persistence-summary');
    expect(item.status).toBe('report');
    expect(item.answer.endsWith('방 0 · 기억 크기 합 0 · 가장 큰 방 없음')).toBe(true);
  });
});
