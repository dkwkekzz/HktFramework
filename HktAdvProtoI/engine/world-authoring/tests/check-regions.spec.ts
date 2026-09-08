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
  type CheckLife,
  type CheckTime,
  type CheckRegion,
  type CheckStatus,
} from '../check';
import type { CurveOp, RegionDescription } from '../description';
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
  /** 주지 않으면 ㉓~㉖ 은 잴 것이 없다 (C018) */
  time?: CheckTime;
  /** 주지 않으면 ㉗~㉝ 은 잴 것이 없다 (C022) */
  life?: CheckLife;
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
    time: world.time,
    life: world.life,
  });

/** 그 검사 하나 */
const itemOf = (world: World, id: string) =>
  run(world).items.find((item) => item.id === id)!;

describe('checkRegions — 보고의 형', () => {
  it('①~⑨ 다음에 ⑩~㉒ · ㉓~㉖ · ㉗~㉝ · ㉞~㊷ 이 번호 순으로 실리고, 번호 밖의 코드도 숨지 않는다', () => {
    const report = run(soundWorld());
    expect(report.items.map((item) => item.mark)).toEqual([
      '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '·', '⑨',
      '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳', '㉑', '㉒',
      '㉓', '㉔', '㉕', '㉖',
      '㉗', '㉘', '㉙', '㉚', '㉛', '㉜', '㉝',
      '㉞', '㉟', '㊱', '㊲', '㊳', '㊴', '㊵', '㊶', '㊷',
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
      // ㉓~㉖ — 시간 쪽 계약을 주지 않았으므로 넷 전부 (C018)
      'time-phase-refs',
      'time-route-refs',
      'time-season-summary',
      'time-reachable',
      // ㉗~㉝ — 생명 계통을 주지 않았으므로 일곱 전부 (C022)
      'life-formation-refs',
      'life-world-cause',
      'life-traces-consumes',
      'life-mode-spread',
      'life-recovery-owner',
      'life-link-refs',
      'life-link-spread',
      // ㉞~㊷ — 접근 쪽 계약을 주지 않았으므로 아홉 전부 (C029)
      'access-refs',
      'access-answer',
      'access-property-spread',
      'access-answer-distance',
      'access-orphan-property',
      'access-answer-kinds',
      'access-answer-variety',
      'access-trace',
      'access-behind-lock',
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
    // 뒤에 붙은 넷(㉓~㉖)은 이 시험의 것이 아니다 — 열셋의 차례만 본다
    const ids = run(ecologyWorld()).items.slice(10, 23).map((item) => item.id);
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
    const thirteen = bare.items.slice(10, 23);
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
    // C022 CHANGED — 그 layer 에 서는 것이 둘이 되어(원천 · 탄생지) 말이 한 갈래 늘었다.
    // 묻는 것은 그대로다 — 자리를 얻은 이름을 세계가 아는가.
    expect(item.refs).toEqual([{ where: 'A', detail: 'ore S9 은 아는 원천도 탄생지도 아니다' }]);
  });

  it('⑩ ㉑ 계약이 밝힌 탄생지의 자리는 모르는 이름이 아니다 (C022)', () => {
    const world = ecologyWorld();
    world.regions[0] = withOps(world.regions[0]!, [seat('S9')]);
    // 그 이름을 계약이 탄생지로 밝히면 둘 다 걸리지 않는다 — 자원 layer 에 서는 것이 둘이다
    const report = checkRegions({
      regions: world.regions,
      graph: world.graph,
      contract: { ...CONTRACT, lifeSiteTags: ['S9'] },
      ecology: world.ecology,
      time: world.time,
      life: world.life,
    });
    expect(report.items.filter((i) => i.status === 'fail').map((i) => i.id)).toEqual([]);
    const item = report.items.find((i) => i.id === 'ecology-placement-source')!;
    expect(item.answer).toContain('탄생지 1');
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

// ── 검사 넷 — 시간이 세계에 거는 것 (C018 ADDED) ─────────────────────
//
// 여기서도 기반은 **게임을 모른다** — 철의 이름도 낮밤의 이름도 경로 선의 layer 도 이 시험이
// 지어 준다. 철이 'wet' · 'dry' 인 세계로 재는 이유가 그것이다: 이름이 매여 있으면 다른 세계를
// 검사할 수 없다.

/** 경로 선 하나 — 그 방의 presence layer 곡선 (points 가 배열이라 as const 를 쓰지 않는다) */
const trail = (id: string, tag: string): CurveOp => ({
  id,
  kind: 'curve',
  layer: 'trail',
  tag,
  points: [
    { x: -5, z: 0 },
    { x: 5, z: 0 },
  ],
  width: 2,
});

/** 덧씌움이 가리킬 area 하나 */
const patch = (id: string, layer: string) =>
  ({
    id,
    kind: 'area',
    layer,
    tag: id,
    shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 3 },
  }) as const;

/** 철 둘 · 낮밤 둘 · 방 둘 — 넷이 다 잴 것을 가진 세계 */
function timeWorld(): World {
  const world = soundWorld();
  world.regions[0] = withOps(world.regions[0]!, [
    patch('deep-A', 'depth'),
    patch('danger-A', 'danger'),
    trail('trail-A', 'wanderer'),
  ]);
  world.regions[1] = withOps(world.regions[1]!, [trail('trail-B', 'wanderer')]);
  world.time = {
    seasons: ['wet', 'dry'],
    dayPhases: ['sun', 'moon'],
    presenceLayer: 'trail',
    phases: [{ region: 'A', season: 'wet', depthAreaIds: ['deep-A'], hazardAreaIds: ['danger-A'] }],
    routes: [
      {
        id: 'R1',
        presence: 'wanderer',
        nodes: [[{ region: 'A', curve: 'wanderer' }], [{ region: 'B', curve: 'wanderer' }]],
        seasons: ['dry'],
        dayPhase: 'moon',
        everyNCycles: 2,
        effectAreas: [{ region: 'A', areaId: 'danger-A' }],
        leaves: ['S1'],
      },
    ],
    seasonalConnectors: [{ id: 'AB', from: 'A', to: 'B', seasons: ['wet'] }],
    seasonalSources: [{ id: 'S1', region: 'B', seasons: ['wet'] }],
    sourceIds: ['S1'],
  };
  return world;
}

/** 시간 쪽 계약만 고쳐 쓴다 — 방과 그래프는 그대로 (tear 의 어법) */
function bend(edit: (time: CheckTime) => CheckTime): World {
  const world = timeWorld();
  world.time = edit(world.time!);
  return world;
}

describe('checkRegions — ㉓~㉖ 은 계약으로 받는다 (C018)', () => {
  it('계약을 주지 않으면 넷 다 absent 다 — 통과가 아니다', () => {
    const bare = run(soundWorld());
    // 뒤에 일곱(㉗~㉝)과 아홉(㉞~㊷)이 더 붙었다 — 이 시험이 재는 것은 "맨 뒤" 가 아니라
    // **이 넷이 이 차례로 붙어 있는가** 이므로 자리를 번호가 아니라 id 로 찾는다
    const from = bare.items.findIndex((item) => item.id === 'time-phase-refs');
    expect(from).toBeGreaterThanOrEqual(0);
    const four = bare.items.slice(from, from + 4);
    expect(four.map((item) => item.id)).toEqual([
      'time-phase-refs',
      'time-route-refs',
      'time-season-summary',
      'time-reachable',
    ]);
    expect(four.map((item) => item.status)).toEqual(['absent', 'absent', 'absent', 'absent']);
    // 잴 것이 없다고 세계가 실패하지는 않는다
    expect(bare.ok).toBe(true);
  });

  it('밝힌 것이 다 있으면 ㉓ ㉔ ㉖ 은 pass · ㉕ 은 report 다', () => {
    const report = run(timeWorld());
    const status = (id: string) => report.items.find((item) => item.id === id)!.status;
    expect({
      phase: status('time-phase-refs'),
      route: status('time-route-refs'),
      summary: status('time-season-summary'),
      reachable: status('time-reachable'),
      ok: report.ok,
    }).toEqual({ phase: 'pass', route: 'pass', summary: 'report', reachable: 'pass', ok: true });
  });

  it('㉓ 없는 area 를 가리킨 덧씌움과 모르는 철이 잡힌다', () => {
    const item = itemOf(
      bend((time) => ({
        ...time,
        phases: [
          { region: 'A', season: 'fog', depthAreaIds: ['no-such'], hazardAreaIds: [] },
          { region: 'Z', season: 'wet', depthAreaIds: [], hazardAreaIds: [] },
        ],
      })),
      'time-phase-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.where)).toEqual(['A/fog', 'A/fog', 'Z/wet']);
  });

  it('㉓ 철 조건 원천의 방과 철도 본다', () => {
    const item = itemOf(
      bend((time) => ({ ...time, seasonalSources: [{ id: 'S1', region: 'Z', seasons: ['fog'] }] })),
      'time-phase-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.detail)).toEqual([
      'Z 은 아는 방이 아니다',
      'fog 은 철 어휘에 없다',
    ]);
  });

  it('㉔ 없는 방 · 없는 선 · 없는 철 · 없는 낮밤 · 0 바퀴 · 없는 원천이 다 잡힌다', () => {
    const item = itemOf(
      bend((time) => ({
        ...time,
        routes: [
          {
            ...time.routes[0]!,
            nodes: [[{ region: 'Z', curve: 'wanderer' }], [{ region: 'B', curve: 'no-such' }]],
            seasons: ['fog'],
            dayPhase: 'dusk',
            everyNCycles: 0,
            effectAreas: [{ region: 'B', areaId: 'danger-A' }],
            leaves: ['S9'],
          },
        ],
      })),
      'time-route-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.detail)).toEqual([
      'Z 은 아는 방이 아니다',
      'no-such 이 B 의 trail 곡선으로 없다',
      'fog 은 철 어휘에 없다',
      'dusk 은 낮밤 어휘에 없다',
      '바퀴 조건 0 은 1 이상의 정수가 아니다',
      '덧씌움의 danger-A 이 B 의 op 로 없다',
      '남기는 S9 은 아는 원천이 아니다',
    ]);
  });

  it('㉔ 경로가 없으면 absent 다 — 통과로 적지 않는다', () => {
    expect(itemOf(bend((time) => ({ ...time, routes: [] })), 'time-route-refs').status).toBe(
      'absent',
    );
  });

  it('㉕ 는 판정하지 않는다 — 철마다 한 줄씩 적고 ok 를 거짓으로 만들지 않는다', () => {
    const world = timeWorld();
    const item = itemOf(world, 'time-season-summary');
    expect(item.status).toBe('report');
    expect(item.answer).toBe('철 2 · 철을 타는 방 1 · 철 조건 문 1 · 철 조건 원천 1 · 경로 1');
    expect(item.refs).toEqual([
      { where: 'wet', detail: '방 1 (A) · 문 1 (AB A→B) · 원천 1 (S1@B) · 경로 0' },
      { where: 'dry', detail: '방 0 · 문 0 · 원천 0 · 경로 1 (R1)' },
    ]);
    expect(run(world).ok).toBe(true);
  });

  it('㉖ 그 철에 닫히는 문 때문에 갈 곳이 없어지면 잡힌다', () => {
    // 두 문 다 마른 철에만 열린다 — 젖은 철에는 시작 방에 갇힌다
    const item = itemOf(
      bend((time) => ({
        ...time,
        seasonalConnectors: [
          { id: 'AB', from: 'A', to: 'B', seasons: ['dry'] },
          { id: 'BA', from: 'B', to: 'A', seasons: ['dry'] },
        ],
      })),
      'time-reachable',
    );
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.where)).toEqual(['wet']);
    expect(item.refs[0]!.detail).toContain('닿는 방이 1 뿐이다');
  });

  it('㉖ 철에 닫히는 문이 하나도 없으면 absent 가 아니라 pass 다', () => {
    const item = itemOf(bend((time) => ({ ...time, seasonalConnectors: [] })), 'time-reachable');
    expect(item.status).toBe('pass');
    expect(item.answer).toContain('철 조건 문 0');
  });

  it('넷도 두 번 돌리면 같다 — 읽기 전용 관찰이다', () => {
    const world = timeWorld();
    expect(JSON.stringify(run(world))).toBe(JSON.stringify(run(world)));
  });
});

// ── 검사 일곱 — 생명이 세계에 매달리는 자리 (C022 ADDED) ──────────────
//
// 여기서도 기반은 **게임을 모른다** — 탄생 방식의 어휘도 개체군의 이름도 Region Rule 의 id 도
// 이 시험이 지어 준다. 탄생 방식이 'binding' · 'inherited' 인 세계로 재는 이유가 그것이다.
//
// 완료 조건의 절반이 여기 있다 — **일곱이 잘못된 데이터를 실제로 집어내는가**를 본다:
// 끊긴 참조 · 원인 없는 탄생 · 전조/소비 없는 탄생 · 주인 없는 회복 원인 · 관계의 끊긴 끝.

/** 전조 흔적 하나 — 탄생지가 traceOpIds 로 가리키는 op */
const omen = (id: string) =>
  ({
    id,
    kind: 'point',
    layer: 'hint',
    tag: 'omen',
    position: { x: 3, z: 3 },
  }) as const;

/**
 * 재료 계통(ecologyWorld) 위에 탄생지 하나와 개체군 하나가 선 세계.
 * 관계는 하나도 없다 — 그래서 ㉜ 는 absent 다 (C022 의 세계와 같은 모양).
 */
function lifeWorld(): World {
  const world = ecologyWorld();
  world.regions[0] = withOps(world.regions[0]!, [omen('omen-1'), omen('omen-2')]);
  world.life = {
    formations: [
      {
        id: 'L1',
        region: 'A',
        mode: 'binding',
        worldCause: 'CAUSE',
        regionRule: 'RULE_ONE',
        sourceMaterialIds: ['M1'],
        sourceStateCodes: ['wet'],
        requiredSourceIds: ['S1', 'S2'],
        requiredPopulationIds: ['P1'],
        consumesSourceIds: ['S1'],
        traceOpIds: ['omen-1', 'omen-2'],
        population: 'P1',
      },
    ],
    populations: [{ id: 'P1', region: 'A' }],
    links: [],
    lifeRecoveries: [{ sourceId: 'S2', recoveryCause: 'shed', population: 'P1' }],
    regionRules: ['RULE_ONE'],
    residueSourceIds: ['S2'],
  };
  return world;
}

/** 생명 계통만 고쳐 쓴다 — 방과 그래프와 재료 계통은 그대로 (tear · bend 의 어법) */
function graft(edit: (life: CheckLife) => CheckLife): World {
  const world = lifeWorld();
  world.life = edit(world.life!);
  return world;
}

/** 탄생지 하나만 고쳐 쓴다 */
const formationOf = (over: Partial<CheckLife['formations'][number]>) =>
  graft((life) => ({ ...life, formations: [{ ...life.formations[0]!, ...over }] }));

describe('checkRegions — ㉗~㉝ 은 계약으로 받는다 (C022)', () => {
  it('계통을 주지 않으면 일곱이 전부 absent 다 — 통과가 아니다', () => {
    const bare = run(soundWorld());
    // 뒤에 아홉(㉞~㊷)이 더 붙었다 — "맨 뒤" 가 아니라 **이 일곱이 이 차례로 붙어 있는가** 를
    // 재는 것이므로 자리를 번호가 아니라 id 로 찾는다 (검사가 늘 때마다 낡지 않게 하는 자리)
    const from = bare.items.findIndex((item) => item.id === 'life-formation-refs');
    expect(from).toBeGreaterThanOrEqual(0);
    const seven = bare.items.slice(from, from + 7);
    expect(seven.map((item) => item.id)).toEqual([
      'life-formation-refs',
      'life-world-cause',
      'life-traces-consumes',
      'life-mode-spread',
      'life-recovery-owner',
      'life-link-refs',
      'life-link-spread',
    ]);
    expect(seven.map((item) => item.status)).toEqual(
      ['absent', 'absent', 'absent', 'absent', 'absent', 'absent', 'absent'],
    );
    // 잴 것이 없다고 세계가 실패하지는 않는다
    expect(bare.ok).toBe(true);
  });

  it('밝힌 것이 다 있으면 ㉗ ㉘ ㉙ ㉛ 은 pass · ㉚ ㉝ 은 report · ㉜ 는 absent 다', () => {
    const report = run(lifeWorld());
    const status = (id: string) => report.items.find((item) => item.id === id)!.status;
    expect({
      formation: status('life-formation-refs'),
      cause: status('life-world-cause'),
      traces: status('life-traces-consumes'),
      mode: status('life-mode-spread'),
      recovery: status('life-recovery-owner'),
      link: status('life-link-refs'),
      spread: status('life-link-spread'),
      ok: report.ok,
    }).toEqual({
      formation: 'pass',
      cause: 'pass',
      traces: 'pass',
      // 관계가 하나도 없다 — 통과로 적으면 검사가 거짓말을 한다
      link: 'absent',
      mode: 'report',
      recovery: 'pass',
      spread: 'report',
      ok: true,
    });
  });

  it('일곱도 두 번 돌리면 글자까지 같다 — 읽기 전용 관찰이다', () => {
    const world = lifeWorld();
    expect(JSON.stringify(run(world))).toBe(JSON.stringify(run(world)));
  });
});

describe('checkRegions — ㉗~㉝ 이 잘못된 데이터를 집어낸다 (SPEC-008 경계 ②)', () => {
  it('㉗ 없는 방 · 없는 규칙 · 없는 재료 · 없는 원천 · 없는 개체군 · 없는 전조가 다 잡힌다', () => {
    const item = itemOf(
      formationOf({
        region: 'Z',
        regionRule: 'RULE_NONE',
        sourceMaterialIds: ['M9'],
        requiredSourceIds: ['S9'],
        requiredPopulationIds: ['P9'],
        consumesSourceIds: ['S8'],
        traceOpIds: ['no-such'],
        population: 'P8',
      }),
      'life-formation-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.detail)).toEqual([
      'Z 은 아는 방이 아니다',
      'RULE_NONE 은 아는 Region Rule 이 아니다',
      'M9 은 아는 재료가 아니다',
      '요구가 가리킨 S9 은 아는 원천이 아니다',
      '소비가 가리킨 S8 은 아는 원천이 아니다',
      '요구가 가리킨 P9 은 아는 개체군이 아니다',
      'P8 은 아는 개체군이 아니다',
    ]);
    // 방을 모르면 그 방의 op 는 볼 수 없다 — 없는 전조를 두 번 세지 않는다
    expect(item.refs.every((ref) => ref.where === 'L1')).toBe(true);
  });

  it('㉗ 그 방에 없는 전조 op 를 가리키면 잡힌다', () => {
    const item = itemOf(formationOf({ traceOpIds: ['omen-1', 'no-such'] }), 'life-formation-refs');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([{ where: 'L1', detail: '전조 no-such 이 A 의 op 로 없다' }]);
  });

  it('㉗ Region Rule 과 개체군을 아예 가리키지 않아도 잡힌다', () => {
    const item = itemOf(formationOf({ regionRule: ' ', population: '' }), 'life-formation-refs');
    expect(item.status).toBe('fail');
    expect(item.refs.map((ref) => ref.detail)).toEqual([
      'Region Rule 을 가리키지 않는다',
      '올릴 개체군을 가리키지 않는다',
    ]);
  });

  it('㉗ 재료 계통을 주지 않으면 그 갈래는 재지 않고 answer 에 적는다', () => {
    const world = lifeWorld();
    world.ecology = undefined;
    const item = itemOf(world, 'life-formation-refs');
    // 없는 재료 M1 · 원천 S1 을 가리키고 있지만 잴 계통이 없다 — 없는 것을 결손으로 세지 않는다
    expect(item.status).toBe('pass');
    expect(item.answer).toContain('재료 계통이 없어 재료·원천 갈래는 재지 않았다');
  });

  it('㉘ 원인 없는 탄생 — 세계 원인을 가리키지 않으면 잡힌다', () => {
    const item = itemOf(formationOf({ worldCause: ' ' }), 'life-world-cause');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([{ where: 'L1', detail: '세계 원인을 가리키지 않는다' }]);
  });

  it('㉘ 그 방의 원천들이 밝힌 원인 어휘에 없는 원인도 잡힌다', () => {
    const item = itemOf(formationOf({ worldCause: 'OTHER' }), 'life-world-cause');
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'L1', detail: 'OTHER 은 A 의 원천들이 밝힌 세계 원인이 아니다' },
    ]);
  });

  it('㉘ 원천이 하나도 없는 방이면 비지 않은 것으로 족하다', () => {
    // C 는 계통 밖의 방이다 — 잴 어휘가 없는데 실패로 적으면 거짓말이다
    const world = graft((life) => ({
      ...life,
      formations: [{ ...life.formations[0]!, region: 'A', worldCause: 'OTHER' }],
    }));
    world.ecology = { ...world.ecology!, sources: [] };
    expect(itemOf(world, 'life-world-cause').status).toBe('pass');
  });

  it('㉙ 전조 없는 탄생과 소비 없는 탄생이 함께 잡힌다', () => {
    const item = itemOf(
      formationOf({ traceOpIds: [], consumesSourceIds: [] }),
      'life-traces-consumes',
    );
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'L1', detail: '전조 흔적을 하나도 가지지 않는다' },
      { where: 'L1', detail: '소비하는 원천이 하나도 없다' },
    ]);
    expect(item.answer).toBe('탄생지 1 · 전조 합 0 · 소비 합 0 · 걸린 것 2');
  });

  it('㉛ 주인 없는 회복 원인 — population 이 빈 줄이 fail 로 잡힌다', () => {
    const item = itemOf(
      graft((life) => ({
        ...life,
        lifeRecoveries: [{ sourceId: 'S2', recoveryCause: 'shed', population: '' }],
      })),
      'life-recovery-owner',
    );
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'S2', detail: 'shed 이 무엇을 전제하는지 밝히지 않았다' },
    ]);
    expect(item.answer).toBe('회복 원인 1 · 주인 없는 것 1');
  });

  it('㉛ 아는 개체군이 아니거나 그 개체군을 세우는 탄생지가 없으면 잡힌다', () => {
    const unknown = itemOf(
      graft((life) => ({
        ...life,
        lifeRecoveries: [{ sourceId: 'S2', recoveryCause: 'shed', population: 'P9' }],
      })),
      'life-recovery-owner',
    );
    expect(unknown.refs).toEqual([{ where: 'S2', detail: 'P9 은 아는 개체군이 아니다' }]);
    // 개체군은 있는데 그것을 세우는 탄생이 세계에 없다 — 무엇이 벗는지가 서지 않은 것이다
    const unborn = itemOf(
      graft((life) => ({
        ...life,
        populations: [...life.populations, { id: 'P2', region: 'A' }],
        lifeRecoveries: [{ sourceId: 'S2', recoveryCause: 'shed', population: 'P2' }],
      })),
      'life-recovery-owner',
    );
    expect(unborn.status).toBe('fail');
    expect(unborn.refs).toEqual([{ where: 'S2', detail: 'P2 을 세우는 탄생지가 없다' }]);
  });

  it('㉛ 생명을 전제하는 회복 원인이 하나도 없으면 absent 다', () => {
    expect(itemOf(graft((life) => ({ ...life, lifeRecoveries: [] })), 'life-recovery-owner').status)
      .toBe('absent');
  });

  it('㉜ 관계의 끊긴 끝과 없는 이음이 잡힌다', () => {
    const item = itemOf(
      graft((life) => ({
        ...life,
        links: [
          { from: 'P9', to: 'P1', kind: 'eats' },
          { from: 'P1', to: 'S1', kind: 'leaves' },
          { from: 'P1', to: 'X9', kind: 'calls', via: 'NO_DOOR' },
        ],
      })),
      'life-link-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'P9→P1', detail: 'P9 은 아는 개체군이 아니다' },
      // S1 은 아는 원천이지만 잔류 원천이 아니다 — 개체군이 아닌 끝은 잔류 원천이어야 한다
      { where: 'P1→S1', detail: 'S1 은 잔류 원천이 아니다' },
      { where: 'P1→X9', detail: 'X9 은 아는 개체군도 잔류 원천도 아니다' },
      { where: 'P1→X9', detail: '이음 NO_DOOR 은 아는 Connector 가 아니다' },
    ]);
    expect(item.answer).toBe('관계 3 · 끊긴 끝 4');
  });

  it('㉜ 개체군끼리 · 잔류 원천으로 · 실재하는 이음이면 pass 다', () => {
    const item = itemOf(
      graft((life) => ({
        ...life,
        populations: [...life.populations, { id: 'P2', region: 'B' }],
        links: [
          { from: 'P1', to: 'P2', kind: 'eats' },
          { from: 'P1', to: 'S2', kind: 'leaves' },
          { from: 'P2', to: 'P1', kind: 'calls', via: 'AB' },
        ],
      })),
      'life-link-refs',
    );
    expect(item.status).toBe('pass');
    expect(item.answer).toBe('관계 3 · 끊긴 끝 0');
  });
});

describe('checkRegions — ㉚ ㉝ 은 판정하지 않는다 (SPEC-008)', () => {
  it('㉚ 방마다 탄생 방식을 세고 ok 를 거짓으로 만들지 않는다', () => {
    const world = graft((life) => ({
      ...life,
      formations: [
        life.formations[0]!,
        { ...life.formations[0]!, id: 'L2', mode: 'inherited' },
        { ...life.formations[0]!, id: 'L3', region: 'B', mode: 'binding', traceOpIds: [] },
      ],
    }));
    const item = itemOf(world, 'life-mode-spread');
    expect(item.status).toBe('report');
    expect(item.answer).toBe('방 2 · 탄생지 합 3 · 방식 2 — binding 2 · inherited 1');
    expect(item.refs).toEqual([
      { where: 'A', detail: '탄생지 2 · binding 1 · inherited 1' },
      { where: 'B', detail: '탄생지 1 · binding 1' },
    ]);
    // 전조 없는 L3 을 판정하는 것은 ㉙ 이다 — ㉚ 은 수만 적는다
    expect(run(world).items.filter((i) => i.status === 'fail').map((i) => i.id)).toEqual([
      'life-traces-consumes',
    ]);
  });

  it('㉝ 관계 없는 개체군과 받기만 하는 개체군을 세고 판정하지 않는다', () => {
    const one = itemOf(lifeWorld(), 'life-link-spread');
    expect(one.status).toBe('report');
    expect(one.answer).toBe('개체군 1 · 관계 0 · 관계 없는 개체군 1 · 받기만 하는 개체군 0');
    expect(one.refs).toEqual([{ where: 'P1', detail: 'A · 관계 0' }]);
    expect(run(lifeWorld()).ok).toBe(true);

    const three = itemOf(
      graft((life) => ({
        ...life,
        populations: [
          ...life.populations,
          { id: 'P2', region: 'B' },
          { id: 'P3', region: 'B' },
        ],
        links: [{ from: 'P1', to: 'P2', kind: 'eats' }],
      })),
      'life-link-spread',
    );
    expect(three.answer).toBe('개체군 3 · 관계 1 · 관계 없는 개체군 1 · 받기만 하는 개체군 1');
    expect(three.refs).toEqual([
      { where: 'P1', detail: 'A · 나가는 관계 1 · 들어오는 관계 0' },
      { where: 'P2', detail: 'B · 나가는 관계 0 · 들어오는 관계 1' },
      { where: 'P3', detail: 'B · 관계 0' },
    ]);
  });

  it('㉚ ㉝ 도 잴 것이 없으면 absent 다 — 통과로도 report 로도 적지 않는다', () => {
    const empty = graft((life) => ({ ...life, formations: [], populations: [] }));
    const status = (id: string) => itemOf(empty, id).status;
    expect(status('life-mode-spread')).toBe('absent');
    expect(status('life-link-spread')).toBe('absent');
    expect(status('life-formation-refs')).toBe('absent');
  });
});
