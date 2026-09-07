// T1 — 검사 아홉이 기계가 읽는 보고를 낸다 (engine/world-authoring/check.ts).
//
// 이 파일은 **게임을 모른다** — layer 이름도 tag 도 여기서 지어 준다. 그것이 T1 이 아홉을 도구에서
// 기반으로 옮긴 이유다: 검사가 이 세계의 명사에 매여 있으면 다른 세계를 검사할 수 없다.
//
// 완료 조건의 절반이 여기 있다 — **실패 항목을 일부러 만들어 잡히는 것을 본다.**
// 걸릴 수 있는 검사마다 걸린 세계 하나와 걸리지 않은 세계 하나를 나란히 둔다.

import { describe, expect, it } from 'vitest';
import {
  checkRegions,
  type CheckContract,
  type CheckEcology,
  type CheckRegion,
  type CheckStatus,
} from '../check';
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
  traceLayer: 'hint',
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
  /** 주지 않으면 ⑩~㉒ 는 잴 것이 없다 */
  ecology?: CheckEcology;
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
  checkRegions({
    regions: world.regions,
    graph: world.graph,
    contract: CONTRACT,
    ecology: world.ecology,
  });

/** 그 검사 하나 */
const itemOf = (world: World, id: string) =>
  run(world).items.find((item) => item.id === id)!;

describe('checkRegions — 보고의 형', () => {
  it('①~⑨ 다음에 ⑩~㉒ 가 번호 순으로 실리고, 번호 밖의 코드도 숨지 않는다', () => {
    const report = run(soundWorld());
    expect(report.items.map((item) => item.mark)).toEqual([
      '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '·', '⑨',
      '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳', '㉑', '㉒',
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
      // ⑩~㉒ — 계통을 주지 않았으므로 열셋 전부 (C014)
      'ecology-placement-source',
      'ecology-source-refs',
      'ecology-material-source',
      'ecology-supply-mode',
      'ecology-recovery-cause',
      'ecology-depletion',
      'ecology-trace-ref',
      'ecology-trace-valid',
      'ecology-flow-valid',
      'ecology-opportunity',
      'ecology-carrier',
      'ecology-orphan',
      'ecology-isolation',
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

// ── C014 — 검사 열셋(⑩~㉒)이 계통의 끊긴 참조를 잡는다 ────────────────
//
// 여기도 게임을 모른다 — 재료도 원천도 흐름도 이 시험이 지어 준 이름뿐이다.
// 참조를 하나씩 끊고, **그 검사만** 돌아서는지를 따로따로 잰다.

/** 원천 하나 — 시험이 고칠 것만 인자로 받는다 */
function source(
  id: string,
  region: string,
  materialId: string,
  over: Partial<CheckEcology['sources'][number]> = {},
): CheckEcology['sources'][number] {
  return {
    id,
    region,
    materialId,
    worldCause: 'CAUSE',
    supply: 'steady',
    renewable: true,
    recoveryCause: 'grows-back',
    finite: false,
    depletionConsequence: '',
    traces: [`hint-${id}`],
    opportunity: 'baseline',
    carrier: 'soil',
    ...over,
  };
}

/** 자리 하나 — 그 방의 resourceLayer 에 원천 id 를 적는다 */
const seat = (sourceId: string) =>
  ({
    id: `seat-${sourceId}`,
    kind: 'point',
    layer: 'ore',
    tag: sourceId,
    position: { x: 1, z: 1 },
  }) as const;

/** 흔적 하나 — 원천이 traces 로 가리키는 op */
const hint = (sourceId: string) =>
  ({
    id: `hint-${sourceId}`,
    kind: 'point',
    layer: 'hint',
    tag: 'mark',
    position: { x: 2, z: 2 },
  }) as const;

/**
 * 두 방에 원천이 하나씩 서고 흐름 하나가 그 사이를 잇는, 아무 참조도 끊기지 않은 계통.
 * 세 번째 방 C 는 이 계통 밖이고 **왜 밖인지를 스스로 적었다** (㉒).
 */
function ecologyWorld(): World {
  const world = soundWorld();
  world.regions[0] = withOps(world.regions[0]!, [seat('S1'), hint('S1')]);
  world.regions[1] = withOps(world.regions[1]!, [seat('S2'), hint('S2')]);
  world.ecology = {
    materials: [
      { id: 'M1', worldCause: 'CAUSE' },
      { id: 'M2', worldCause: 'CAUSE' },
    ],
    sources: [
      source('S1', 'A', 'M1'),
      source('S2', 'B', 'M2', { opportunity: 'conditional', carrier: 'water' }),
    ],
    flows: [
      {
        id: 'F1',
        materialId: 'M2',
        from: { region: 'A', source: 'S1' },
        to: { region: 'B', source: 'S2' },
        connector: 'AB',
      },
    ],
    regions: [
      { id: 'A', isolationReason: '' },
      { id: 'B', isolationReason: '' },
      { id: 'C', isolationReason: 'walled-off' },
    ],
  };
  return world;
}

/** 그 세계에서 fail 로 돌아선 검사들 — 무엇이 함께 도는지까지 본다 */
const failedIds = (world: World) =>
  run(world).items.filter((item) => item.status === 'fail').map((item) => item.id);

/** 계통을 고쳐 쓴다 — ecologyWorld() 의 것을 얕게 바꾼다 */
function tear(edit: (world: World, ecology: CheckEcology) => CheckEcology | void): World {
  const world = ecologyWorld();
  const next = edit(world, world.ecology!);
  if (next) world.ecology = next;
  return world;
}

describe('checkRegions — ⑩~㉒ 온전한 계통', () => {
  it('열셋이 ①~⑨ 뒤에 번호 순으로 붙고 id 가 표 그대로다', () => {
    const ids = run(ecologyWorld()).items.slice(10).map((item) => item.id);
    expect(ids).toEqual([
      'ecology-placement-source',
      'ecology-source-refs',
      'ecology-material-source',
      'ecology-supply-mode',
      'ecology-recovery-cause',
      'ecology-depletion',
      'ecology-trace-ref',
      'ecology-trace-valid',
      'ecology-flow-valid',
      'ecology-opportunity',
      'ecology-carrier',
      'ecology-orphan',
      'ecology-isolation',
    ]);
  });

  it('참조 무결성 열하나가 pass 이고, 잴 것 없는 ⑮ 만 absent 다', () => {
    const report = run(ecologyWorld());
    const status = (id: string) => report.items.find((item) => item.id === id)!.status;
    expect(status('ecology-placement-source')).toBe('pass');
    expect(status('ecology-source-refs')).toBe('pass');
    expect(status('ecology-material-source')).toBe('pass');
    expect(status('ecology-supply-mode')).toBe('pass');
    expect(status('ecology-recovery-cause')).toBe('pass');
    // 다 쓰면 끝나는 원천이 하나도 없다 — 통과로 적으면 검사가 거짓말을 한다
    expect(status('ecology-depletion')).toBe('absent');
    expect(status('ecology-trace-ref')).toBe('pass');
    expect(status('ecology-trace-valid')).toBe('pass');
    expect(status('ecology-flow-valid')).toBe('pass');
    expect(status('ecology-orphan')).toBe('pass');
    expect(status('ecology-isolation')).toBe('pass');
    expect(report.ok).toBe(true);
  });

  it('계통을 주지 않으면 열셋이 전부 absent 이고 ok 는 그대로다', () => {
    const bare = run(soundWorld());
    const thirteen = bare.items.slice(10);
    expect(thirteen).toHaveLength(13);
    expect(thirteen.every((item) => item.status === 'absent')).toBe(true);
    expect(bare.ok).toBe(true);
  });

  it('두 번 돌리면 글자까지 같다 — 읽기 전용 관찰이다', () => {
    const world = ecologyWorld();
    expect(JSON.stringify(run(world))).toBe(JSON.stringify(run(world)));
  });
});

describe('checkRegions — ⑩~㉒ 참조를 하나씩 끊는다', () => {
  it('⑩ ㉑ 모르는 이름의 배치 — 그 자리에 원천이 없다', () => {
    const world = ecologyWorld();
    world.regions[0] = withOps(world.regions[0]!, [seat('S9')]);
    expect(failedIds(world)).toEqual(['ecology-placement-source', 'ecology-orphan']);
    const item = run(world).items.find((i) => i.id === 'ecology-placement-source')!;
    expect(item.refs).toEqual([{ where: 'A', detail: 'ore S9 은 아는 원천이 아니다' }]);
  });

  it('⑪ 세계 원인을 가리키지 않는 원천', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, worldCause: ' ' }, ecology.sources[1]!],
    }));
    expect(failedIds(world)).toEqual(['ecology-source-refs']);
  });

  it('⑪ ⑫ ㉑ 재료 없는 원천 — 그 재료를 내는 원천도 사라진다', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      sources: [ecology.sources[0]!, { ...ecology.sources[1]!, materialId: 'M9' }],
    }));
    expect(failedIds(world)).toEqual([
      'ecology-source-refs',
      'ecology-material-source',
      'ecology-orphan',
    ]);
  });

  it('⑫ 원천은 있으나 자리를 얻지 못한 재료', () => {
    const world = ecologyWorld();
    // B 의 자리를 걷어 낸다 — 원천은 그대로 있고 놓인 자리만 없다
    world.regions[1] = { ...world.regions[1]!, space: space('B', [
      ...world.regions[1]!.space.ops.filter((op) => op.id !== 'seat-S2'),
    ]) };
    const item = run(world).items.find((i) => i.id === 'ecology-material-source')!;
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.where)).toEqual(['M2']);
  });

  it('⑬ 공급 유형 없는 원천', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, supply: '' }, ecology.sources[1]!],
    }));
    expect(failedIds(world)).toEqual(['ecology-supply-mode']);
  });

  it('⑭ 되돌아오는데 그 원인이 없는 원천 — 되돌아오지 않는 원천에는 묻지 않는다', () => {
    const failing = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, recoveryCause: '' }, ecology.sources[1]!],
    }));
    expect(failedIds(failing)).toEqual(['ecology-recovery-cause']);

    const notRenewable = tear((_, ecology) => ({
      ...ecology,
      sources: ecology.sources.map((s) => ({ ...s, renewable: false, recoveryCause: '' })),
    }));
    expect(failedIds(notRenewable)).toEqual([]);
    const item = run(notRenewable).items.find((i) => i.id === 'ecology-recovery-cause')!;
    expect(item.status).toBe('absent');
  });

  it('⑮ 다 쓰면 끝나는데 그 결과가 없는 원천', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, finite: true }, ecology.sources[1]!],
    }));
    expect(failedIds(world)).toEqual(['ecology-depletion']);

    const written = tear((_, ecology) => ({
      ...ecology,
      sources: [
        { ...ecology.sources[0]!, finite: true, depletionConsequence: 'ground-sinks' },
        ecology.sources[1]!,
      ],
    }));
    expect(failedIds(written)).toEqual([]);
  });

  it('⑯ 흔적을 하나도 가리키지 않는 원천 — ⑰ 은 그대로 통과다', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, traces: [] }, ecology.sources[1]!],
    }));
    expect(failedIds(world)).toEqual(['ecology-trace-ref']);
  });

  it('⑰ 없는 흔적 op 와 없는 방', () => {
    const missingOp = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, traces: ['hint-NOWHERE'] }, ecology.sources[1]!],
    }));
    expect(failedIds(missingOp)).toEqual(['ecology-trace-valid']);
    const item = run(missingOp).items.find((i) => i.id === 'ecology-trace-valid')!;
    expect(item.refs).toEqual([
      { where: 'S1', detail: 'hint-NOWHERE 이 A 의 hint op 로 없다' },
    ]);

    // 아는 방이 아닌 곳에 선 원천 — 흔적을 볼 자리가 없다
    const unknownRegion = tear((_, ecology) => ({
      ...ecology,
      sources: [{ ...ecology.sources[0]!, region: 'Z' }, ecology.sources[1]!],
    }));
    const ids = failedIds(unknownRegion);
    expect(ids).toContain('ecology-trace-valid');
  });

  it('⑱ 없는 방을 가리키는 흐름', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      flows: [{ ...ecology.flows[0]!, to: { region: 'NOWHERE', source: 'S2' } }],
    }));
    expect(failedIds(world)).toEqual(['ecology-flow-valid']);
    const item = run(world).items.find((i) => i.id === 'ecology-flow-valid')!;
    expect(item.refs).toEqual([
      { where: 'F1', detail: 'to 의 NOWHERE 은 아는 방이 아니다' },
    ]);
  });

  it('⑱ 없는 Connector 를 타는 흐름', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      flows: [{ ...ecology.flows[0]!, connector: 'NO_SUCH' }],
    }));
    expect(failedIds(world)).toEqual(['ecology-flow-valid']);
  });

  it('㉒ 유입도 원천도 이유도 없는 방 — 이유를 적으면 돌아온다', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      regions: [
        ecology.regions[0]!,
        ecology.regions[1]!,
        { id: 'C', isolationReason: '  ' },
      ],
    }));
    expect(failedIds(world)).toEqual(['ecology-isolation']);
    const item = run(world).items.find((i) => i.id === 'ecology-isolation')!;
    expect(item.refs.map((ref) => ref.where)).toEqual(['C']);

    // 유입 흐름이 있으면 이유가 없어도 고립이 아니다
    const flowed = tear((_, ecology) => ({
      ...ecology,
      flows: [
        ...ecology.flows,
        {
          id: 'F2',
          materialId: 'M2',
          from: { region: 'A', source: 'S1' },
          to: { region: 'C', source: 'S2' },
          connector: 'AB',
        },
      ],
      regions: [ecology.regions[0]!, ecology.regions[1]!, { id: 'C', isolationReason: '' }],
    }));
    const isolation = run(flowed).items.find((i) => i.id === 'ecology-isolation')!;
    expect(isolation.status).toBe('pass');
  });
});

describe('checkRegions — ⑲ ⑳ 은 판정하지 않는다 (SPEC-008)', () => {
  it('분포를 적되 status 가 report 이고 ok 를 거짓으로 만들지 않는다', () => {
    const report = run(ecologyWorld());
    const opportunity = report.items.find((i) => i.id === 'ecology-opportunity')!;
    const carrier = report.items.find((i) => i.id === 'ecology-carrier')!;
    expect(opportunity.status).toBe('report');
    expect(carrier.status).toBe('report');
    expect(opportunity.refs).toEqual([
      { where: 'A', detail: 'S1 baseline' },
      { where: 'B', detail: 'S2 conditional' },
    ]);
    expect(carrier.refs).toEqual([
      { where: 'A', detail: '원천 1 · soil 1' },
      { where: 'B', detail: '원천 1 · water 1' },
      { where: 'C', detail: '원천 0' },
    ]);
    expect(report.ok).toBe(true);
  });

  it('한쪽으로 완전히 쏠려도 ok 는 그대로다 — 적정량은 사람이 본다', () => {
    const world = tear((_, ecology) => ({
      ...ecology,
      sources: ecology.sources.map((s) => ({ ...s, opportunity: 'baseline', carrier: 'soil' })),
    }));
    const report = run(world);
    const opportunity = report.items.find((i) => i.id === 'ecology-opportunity')!;
    expect(opportunity.answer).toContain('baseline 2');
    expect(report.ok).toBe(true);
    expect(report.counts.fail).toBe(0);
  });
});
