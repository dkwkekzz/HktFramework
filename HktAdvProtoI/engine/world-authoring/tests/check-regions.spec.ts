// T1 — 검사 아홉이 기계가 읽는 보고를 낸다 (engine/world-authoring/check.ts).
//
// 이 파일은 **게임을 모른다** — layer 이름도 tag 도 여기서 지어 준다. 그것이 T1 이 아홉을 도구에서
// 기반으로 옮긴 이유다: 검사가 이 세계의 명사에 매여 있으면 다른 세계를 검사할 수 없다.
//
// 완료 조건의 절반이 여기 있다 — **실패 항목을 일부러 만들어 잡히는 것을 본다.**
// 걸릴 수 있는 검사마다 걸린 세계 하나와 걸리지 않은 세계 하나를 나란히 둔다.

import { describe, expect, it } from 'vitest';
import { checkRegions, type CheckContract, type CheckRegion, type CheckStatus } from '../check';
import type { RegionDescription } from '../description';
import type { Connector } from '../graph';

/** 이 시험이 쓰는 명사 — 기반은 이 이름들을 모른다. 계약으로 건넨다 */
const CONTRACT: CheckContract = {
  anchorLayer: 'door',
  resourceLayer: 'ore',
  hazardLayer: 'danger',
  phenomenonLayer: 'weather',
  settlementLayer: 'living',
  settlementTags: ['camp'],
  conditionPrefix: 'because:',
  startRegion: 'A',
};

/** Description 의 id 는 방의 id 다 — checkGraph 가 그것으로 방을 찾는다 */
function space(id: string, ops: RegionDescription['ops'] = []): RegionDescription {
  return { id, extent: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, seed: 1, ops };
}

function region(id: string, over: Partial<Omit<CheckRegion, 'id'>> = {}): CheckRegion {
  return { id, depth: 'near', space: space(id), coreRules: 0, ...over };
}

/** 그 방의 ops 에 더 놓는다 — id 를 잃지 않는다 */
function withOps(base: CheckRegion, ops: RegionDescription['ops']): CheckRegion {
  return { ...base, space: space(base.id, [...base.space.ops, ...ops]) };
}

/** 시험이 고쳐 쓸 수 있게 배열을 다 풀어 둔 그래프 */
interface World {
  regions: CheckRegion[];
  graph: {
    regions: string[];
    containment: { parent: string; child: string }[];
    connectors: Connector[];
    frontiers: string[];
  };
}

/** 두 방 A · B 가 문 하나로 이어진, 아무 데도 걸리지 않는 세계 */
function soundWorld(): World {
  const door = (tag: string) =>
    ({ id: tag, kind: 'point', layer: 'door', tag, position: { x: 0, z: 0 } }) as const;
  const link = (id: string, from: string, to: string): Connector => ({
    id,
    from: { region: from, anchor: `${from}_TO_${to}` },
    to: { region: to, anchor: `${to}_TO_${from}` },
    direction: 'bidirectional',
    transition: 'walk',
  });
  return {
    regions: [
      region('A', { space: space('A', [door('A_TO_B')]) }),
      region('B', { space: space('B', [door('B_TO_A')]) }),
    ],
    graph: {
      regions: ['A', 'B'],
      connectors: [link('AB', 'A', 'B'), link('BA', 'B', 'A')],
      containment: [],
      frontiers: [],
    },
  };
}

const run = (world: World) =>
  checkRegions({ regions: world.regions, graph: world.graph, contract: CONTRACT });

/** 그 검사 하나 */
const itemOf = (world: World, id: string) =>
  run(world).items.find((item) => item.id === id)!;

describe('checkRegions — 보고의 형', () => {
  it('아홉이 ①~⑨ 순서로 실리고, 번호 밖의 코드도 숨지 않는다', () => {
    const report = run(soundWorld());
    expect(report.items.map((item) => item.mark)).toEqual([
      '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '·', '⑨',
    ]);
    // 기계가 잡는 열쇠는 번호가 아니라 id 다 — 번호가 바뀌어도 이것은 그대로다
    expect(new Set(report.items.map((item) => item.id)).size).toBe(report.items.length);
  });

  it('두 번 돌리면 같다 — 세계를 바꾸지 않는 읽기 전용 관찰이다', () => {
    const world = soundWorld();
    expect(JSON.stringify(run(world))).toBe(JSON.stringify(run(world)));
  });

  it('counts 는 items 의 status 를 센 것이고 ok 는 fail 이 0 인가다', () => {
    const report = run(soundWorld());
    const counted: Record<CheckStatus, number> = { pass: 0, fail: 0, absent: 0, report: 0 };
    for (const item of report.items) counted[item.status]++;
    expect(report.counts).toEqual(counted);
    expect(report.ok).toBe(report.counts.fail === 0);
  });

  it('아무 데도 걸리지 않은 세계는 ok 이고, 놓인 것이 없는 검사는 pass 가 아니라 absent 다', () => {
    const report = run(soundWorld());
    expect({ ok: report.ok, fail: report.counts.fail }).toEqual({ ok: true, fail: 0 });
    // ①(ore·danger) · ③(camp) · ④(weather) 는 이 세계에 놓인 것이 없다 — 통과로 적으면 거짓말이다
    const absent = report.items.filter((item) => item.status === 'absent').map((item) => item.id);
    expect(absent).toEqual([
      'resource-hazard-origin',
      'settlement-condition',
      'region-phenomenon',
    ]);
  });
});

describe('checkRegions — 일부러 만든 실패가 잡힌다 (T1 완료 조건)', () => {
  it('② 깊이 없는 방이 잡히고 그 이름이 refs 에 선다', () => {
    const world = soundWorld();
    world.regions[1] = { ...world.regions[1]!, depth: '  ' };
    const item = itemOf(world, 'region-depth');
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.where)).toEqual(['B']);
    expect(run(world).ok).toBe(false);
  });

  it('③ 조건 없이 선 settlement 가 잡힌다 — 조건을 놓으면 통과로 돌아온다', () => {
    const camp = { id: 'c', kind: 'area', layer: 'living', tag: 'camp', shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 3 } } as const;
    const because = { id: 'w', kind: 'area', layer: 'living', tag: 'because:wall', shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 4 } } as const;

    const bare = soundWorld();
    bare.regions[0] = withOps(bare.regions[0]!, [camp]);
    const failed = itemOf(bare, 'settlement-condition');
    expect(failed.status).toBe('fail');
    expect(failed.refs.map((ref) => ref.where)).toEqual(['A']);

    const fixed = soundWorld();
    fixed.regions[0] = withOps(fixed.regions[0]!, [camp, because]);
    expect(itemOf(fixed, 'settlement-condition').status).toBe('pass');
  });

  it('④ phenomenon 이 하나가 아닌 방이 잡힌다 (W5 — Region 당 하나)', () => {
    const weather = (id: string) =>
      ({ id, kind: 'area', layer: 'weather', tag: id, shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 2 } }) as const;
    const world = soundWorld();
    // A 는 둘 · B 는 없음 — 둘 다 "하나" 가 아니다
    world.regions[0] = withOps(world.regions[0]!, [weather('w1'), weather('w2')]);
    const item = itemOf(world, 'region-phenomenon');
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.where)).toEqual(['A', 'B']);
  });

  it('⑤ 없는 anchor 를 가리키는 Connector 가 잡힌다', () => {
    const world = soundWorld();
    world.graph.connectors[0] = {
      ...world.graph.connectors[0]!,
      to: { region: 'B', anchor: 'NOWHERE' },
    };
    const item = itemOf(world, 'connector-anchor');
    expect(item.status).toBe('fail');
    expect(item.refs[0]!.where).toBe('B');
  });

  it('⑦ 나갈 곳 없는 방과 ⑧ 닿지 않는 방이 함께 잡힌다', () => {
    const world = soundWorld();
    world.regions.push(region('C'));
    world.graph.regions.push('C');
    expect(itemOf(world, 'region-exit')).toMatchObject({ status: 'fail', refs: [{ where: 'C' }] });
    expect(itemOf(world, 'region-reachable')).toMatchObject({ status: 'fail', refs: [{ where: 'C' }] });
  });

  it('⑥ 부모와 이어지지 않은 중첩이 잡힌다', () => {
    const world = soundWorld();
    world.regions.push(region('C'));
    world.graph.regions.push('C');
    world.graph.containment.push({ parent: 'A', child: 'C' });
    expect(itemOf(world, 'containment-linked')).toMatchObject({
      status: 'fail',
      refs: [{ where: 'C' }],
    });
  });

  it('⑨ 는 실패가 아니라 보고다 — 수를 적고 판정하지 않는다', () => {
    const world = soundWorld();
    world.regions[0] = { ...world.regions[0]!, coreRules: 3 };
    const item = itemOf(world, 'core-rule-count');
    expect(item.status).toBe('report');
    expect(item.refs).toEqual([{ where: 'A', detail: 'core rule 3' }]);
    expect(run(world).ok).toBe(true);
  });
});

describe('checkRegions — ① 은 한쪽만 놓였을 때 통과로 적지 않는다', () => {
  const ore = { id: 'o', kind: 'point', layer: 'ore', tag: 'ORE', position: { x: 0, z: 0 } } as const;

  it('자원만 놓이면 absent — 어느 쪽이 없어서 못 쟀는지를 적는다', () => {
    const world = soundWorld();
    world.regions[0] = withOps(world.regions[0]!, [ore]);
    const item = itemOf(world, 'resource-hazard-origin');
    expect(item.status).toBe('absent');
    expect(item.answer).toContain('danger');
  });

  it('둘 다 놓였는데 겹침을 재는 자가 없으면 report 다 — 지어내지 않는다', () => {
    const danger = { id: 'd', kind: 'area', layer: 'danger', tag: 'DEEP', shape: { kind: 'circle', center: { x: 9, z: 9 }, radius: 1 } } as const;
    const world = soundWorld();
    world.regions[0] = withOps(world.regions[0]!, [ore, danger]);
    expect(itemOf(world, 'resource-hazard-origin').status).toBe('report');
  });
});
