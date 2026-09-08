// C029 — 검사 아홉(㉞~㊷)이 방이 묻는 것과 세계가 가진 답을 잰다 (engine/world-authoring/check.ts).
//
// 이 파일은 **게임을 모른다** — 축도 관계도 답의 종류도 여기서 지어 준다 (`a:x` · `thing`).
// 기반이 heat 도 문도 재료도 알지 못한다는 것이 이 아홉의 규율이고, 그것을 재는 자리가 여기다.
//
// 걸릴 수 있는 검사(㉞ ㊶)마다 걸린 세계 하나와 걸리지 않은 세계 하나를 나란히 두고,
// ㉟ 은 **GAP 이 실패가 아니라 셋째 답**임을 잰다 — absent 이고 ok 를 거짓으로 만들지 않는다.

import { describe, expect, it } from 'vitest';
import {
  checkRegions,
  type CheckAccess,
  type CheckContract,
  type CheckRegion,
} from '../check';
import type { RegionDescription } from '../description';
import { reachableRegionsExcept, type Connector, type RegionGraph } from '../graph';

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

function space(id: string, ops: RegionDescription['ops']): RegionDescription {
  return { id, extent: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, seed: 1, ops };
}

const door = (tag: string) =>
  ({ id: tag, kind: 'point', layer: 'door', tag, position: { x: 0, z: 0 } }) as const;

const patch = (id: string, layer: string) =>
  ({
    id,
    kind: 'area',
    layer,
    tag: id,
    shape: { kind: 'circle', center: { x: 0, z: 0 }, radius: 3 },
  }) as const;

const link: Connector = {
  id: 'AB',
  from: { region: 'A', anchor: 'A_TO_B' },
  to: { region: 'B', anchor: 'B_TO_A' },
  direction: 'bidirectional',
  transition: 'walk',
};

/** 문 하나로 이어진 두 방 — A 가 시작 방이고 B 는 그 문 뒤에만 있다 */
const GRAPH: RegionGraph = {
  regions: ['A', 'B'],
  containment: [],
  connectors: [link],
  frontiers: [],
};

/** A 는 흔적 자락(trace-a)과 자락 Lock 이 걸릴 자락(zone-a)을 가진다 */
const REGIONS: CheckRegion[] = [
  {
    id: 'A',
    depth: 'near',
    coreRules: 0,
    space: space('A', [door('A_TO_B'), patch('trace-a', 'hint'), patch('zone-a', 'mark')]),
  },
  { id: 'B', depth: 'far', coreRules: 0, space: space('B', [door('B_TO_A')]) },
];

/**
 * 이 시험의 어휘와 요구 — 축 넷(a · b · c · d) · 관계 셋(x · y · z).
 *
 * L1  A 가 밝힌 문(AB) 의 Lock. 성질 `a:x` 를 묻고 흔적은 A 의 자락 하나. 중요하다
 * L2  A 가 밝힌 자락(zone-a) 의 Lock. 성질을 묻지 않는다 (㉟ ㊲ 가 보지 않는다)
 * S1  `a:y` 를 가진 Seed — answers 가 그것을 `a:x` 의 답으로 잇는다. 원천은 문 뒤(B)에 섰다
 * S2  `c:z` 를 가진 Seed — 아무 Lock 도 그것을 요구하지 않는다 (㊳ 의 고아)
 */
function access(): CheckAccess {
  return {
    aspects: ['a', 'b', 'c', 'd'],
    relations: ['x', 'y', 'z'],
    tagSeparator: ':',
    statementKinds: ['look', 'act'],
    answerKinds: ['thing', 'life'],
    supportKind: 'HELPS',
    connectorLockKind: 'gate',
    areaLockKind: 'zone',
    answers: [
      { requirement: 'a:x', property: 'a:y', kind: 'HELPS' },
      { requirement: 'a:x', property: 'b:y', kind: 'BLOCKS' },
    ],
    locks: [
      {
        id: 'L1',
        region: 'A',
        at: { kind: 'gate', ref: 'AB' },
        important: true,
        requires: [{ property: 'a:x', kind: 'property' }],
        traces: ['trace-a'],
      },
      {
        id: 'L2',
        region: 'A',
        at: { kind: 'zone', ref: 'zone-a' },
        important: false,
        requires: [{ kind: 'time' }],
        traces: ['zone-a'],
      },
    ],
    seeds: [
      { id: 'S1', answerKind: 'thing', properties: [{ tag: 'a:y', from: 'look' }] },
      { id: 'S2', answerKind: 'life', properties: [{ tag: 'c:z', from: 'act' }] },
    ],
    seedSources: [{ seed: 'S1', region: 'B', source: 'SRC1' }],
  };
}

const run = (over?: CheckAccess) =>
  checkRegions({ regions: REGIONS, graph: GRAPH, contract: CONTRACT, access: over });

const itemOf = (over: CheckAccess | undefined, id: string) =>
  run(over).items.find((item) => item.id === id)!;

/** 계약 하나를 고쳐 든 세계 */
const bend = (edit: (a: CheckAccess) => CheckAccess): CheckAccess => edit(access());

describe('reachableRegionsExcept — 어떤 이음을 벽으로 놓고 도는 것 (C029 ADDED)', () => {
  it('막을 이음이 없으면 그냥 닿는 방들이고, 문을 막으면 그 뒤가 떨어져 나간다', () => {
    expect(reachableRegionsExcept(GRAPH, 'A', [])).toEqual(['A', 'B']);
    expect(reachableRegionsExcept(GRAPH, 'A', ['AB'])).toEqual(['A']);
    // 없는 이음을 막아도 아무 일이 없다 — 무엇이 왜 막혔는지는 기반이 모른다
    expect(reachableRegionsExcept(GRAPH, 'A', ['NOPE'])).toEqual(['A', 'B']);
  });
});

describe('checkRegions — 접근 쪽 아홉의 형', () => {
  it('㉞~㊷ 이 보고의 끝에 번호 순으로 붙는다', () => {
    const marks = run(access()).items.map((item) => item.mark);
    expect(marks.slice(-9)).toEqual(['㉞', '㉟', '㊱', '㊲', '㊳', '㊴', '㊵', '㊶', '㊷']);
    const ids = run(access()).items.map((item) => item.id);
    expect(ids.slice(-9)).toEqual([
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
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('접근 쪽 계약을 주지 않으면 아홉이 전부 absent 다 — 통과로 적지 않는다', () => {
    const nine = run(undefined).items.slice(-9);
    expect(nine.map((item) => item.status)).toEqual(Array(9).fill('absent'));
    expect(nine.map((item) => item.answer)).toEqual(
      Array(9).fill('접근 쪽 계약이 주어지지 않았다'),
    );
  });

  it('두 번 돌리면 글자까지 같다 — 세계를 바꾸지 않는 읽기 전용 관찰이다', () => {
    expect(JSON.stringify(run(access()))).toBe(JSON.stringify(run(access())));
  });

  it('GAP 도 요약도 ok 를 거짓으로 만들지 않는다 — 종료 코드는 fail 하나가 정한다', () => {
    const report = run(access());
    expect(report.items.find((item) => item.id === 'access-answer')!.status).toBe('absent');
    expect(report.items.slice(-9).some((item) => item.status === 'fail')).toBe(false);
    expect(report.ok).toBe(true);
  });
});

describe('㉞ 참조 — 어휘 · 자리 · 문장', () => {
  it('어휘 안의 태그와 실제 자리를 가리키면 통과다', () => {
    const item = itemOf(access(), 'access-refs');
    expect(item.status).toBe('pass');
    expect(item.answer).toBe(
      'Lock 2 · 성질 요구 1 · Seed 2 · 성질 태그 2 · 끊긴 참조 0',
    );
  });

  it('어휘에 없는 축·관계 · 갈리지 않는 태그 · 없는 문장 갈래가 잡힌다', () => {
    const item = itemOf(
      bend((a) => ({
        ...a,
        locks: [
          { ...a.locks[0]!, requires: [{ property: 'q:x', kind: 'property' }] },
          { ...a.locks[1]!, requires: [{ property: 'a-y', kind: 'property' }] },
        ],
        seeds: [
          { ...a.seeds[0]!, properties: [{ tag: 'a:q', from: 'look' }] },
          { ...a.seeds[1]!, properties: [{ tag: 'c:z', from: 'nope' }] },
        ],
      })),
      'access-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'L1', detail: '요구 q:x 의 축 q 이 어휘에 없다' },
      { where: 'L2', detail: '요구 a-y 이 : 로 갈리지 않는다' },
      { where: 'S1', detail: '성질 a:q 의 관계 q 이 어휘에 없다' },
      { where: 'S2', detail: '성질 c:z 의 nope 은 문장의 갈래가 아니다' },
    ]);
  });

  it('없는 문과 없는 자락을 가리키면 잡힌다', () => {
    const item = itemOf(
      bend((a) => ({
        ...a,
        locks: [
          { ...a.locks[0]!, at: { kind: 'gate', ref: 'NOPE' } },
          { ...a.locks[1]!, at: { kind: 'zone', ref: 'no-such' } },
        ],
      })),
      'access-refs',
    );
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'L1', detail: 'NOPE 은 아는 Connector 가 아니다' },
      { where: 'L2', detail: 'no-such 이 A 의 area op 로 없다' },
    ]);
  });

  it('Lock 도 Seed 도 없으면 absent 다 — 잰 것이 없는데 통과로 적지 않는다', () => {
    expect(
      itemOf(bend((a) => ({ ...a, locks: [], seeds: [] })), 'access-refs').status,
    ).toBe('absent');
  });
});

describe('㉟ 답 — 없는 것은 실패가 아니라 GAP 이다', () => {
  it('답할 Seed 의 원천이 그 문 뒤에만 있으면 absent 이고 refs 가 그 자리를 적는다', () => {
    const item = itemOf(access(), 'access-answer');
    expect(item.status).toBe('absent');
    expect(item.refs).toEqual([
      {
        where: 'L1',
        detail: 'a:x 에 답할 Seed S1 의 원천이 A 에서 이 Lock 을 지나지 않고 닿는 방에 없다',
      },
    ]);
    expect(item.answer).toBe('성질 Lock 1 · 성질 요구 1 · 답이 선 요구 0 · GAP 1');
  });

  it('그 원천을 문 앞의 방으로 옮기면 통과로 돌아온다', () => {
    const item = itemOf(
      bend((a) => ({ ...a, seedSources: [{ seed: 'S1', region: 'A', source: 'SRC1' }] })),
      'access-answer',
    );
    expect(item.status).toBe('pass');
    expect(item.refs).toEqual([]);
  });

  it('답이 되는 성질을 가진 Seed 가 아예 없으면 그것을 적는다', () => {
    const item = itemOf(
      bend((a) => ({ ...a, seeds: [a.seeds[1]!], seedSources: [] })),
      'access-answer',
    );
    expect(item.status).toBe('absent');
    expect(item.refs).toEqual([
      { where: 'L1', detail: 'a:x 에 HELPS 인 성질을 가진 Seed 가 없다' },
    ]);
  });

  it('성질을 요구하는 Lock 이 하나도 없어도 absent 다', () => {
    expect(
      itemOf(bend((a) => ({ ...a, locks: [a.locks[1]!] })), 'access-answer').status,
    ).toBe('absent');
  });
});

describe('요약 여섯 — 판정하지 않고 수만 적는다', () => {
  it('㊱ 성질 하나가 답하는 Lock 의 수와 축별로 쓰인 태그', () => {
    const item = itemOf(access(), 'access-property-spread');
    expect(item.status).toBe('report');
    expect(item.answer).toBe(
      '답이 되는 성질 1 · 가장 많이 답하는 성질 a:y 1 · 쓰인 태그 4 / 축 4',
    );
    expect(item.refs).toEqual([
      { where: 'a:y', detail: '답하는 Lock 1' },
      { where: 'a', detail: '쓰인 태그 2 (a:x · a:y)' },
      { where: 'b', detail: '쓰인 태그 1 (b:y)' },
      { where: 'c', detail: '쓰인 태그 1 (c:z)' },
      { where: 'd', detail: '쓰인 태그 0' },
    ]);
  });

  it('㊲ Lock 의 방과 답 원천의 방이 같은가 다른가와 depth 짝', () => {
    const item = itemOf(access(), 'access-answer-distance');
    expect(item.status).toBe('report');
    expect(item.answer).toBe('성질 Lock 1 · 답 원천 1 · 같은 방 0 · 다른 방 1');
    expect(item.refs).toEqual([
      { where: 'L1', detail: '답 원천 1 · 같은 방 0 · 다른 방 1 · depth near→far 1' },
    ]);
  });

  it('㊳ 요구가 없는 성질 · 가진 Seed 가 없는 성질 · 안 쓰인 축', () => {
    const item = itemOf(access(), 'access-orphan-property');
    expect(item.status).toBe('report');
    expect(item.answer).toBe('요구 없는 성질 1 · Seed 없는 성질 1 · 안 쓰인 축 1 / 4');
    expect(item.refs).toEqual([
      { where: 'c:z', detail: 'Seed S2 는 가졌으나 이것을 요구하는 Lock 이 없다' },
      { where: 'a:x', detail: '요구는 있으나 이것을 가진 Seed 가 없다' },
      { where: 'd', detail: '이 축의 태그가 아무 데도 쓰이지 않았다' },
    ]);
  });

  it('㊴ 중요 Lock 마다 답의 종류별 수 — 열의 차례는 준 차례다', () => {
    const item = itemOf(access(), 'access-answer-kinds');
    expect(item.status).toBe('report');
    expect(item.answer).toBe('중요 Lock 1 / 2 · 답의 종류 2 · 답 합 1');
    expect(item.refs).toEqual([{ where: 'L1', detail: 'thing 1 · life 0' }]);
  });

  it('㊴ 원천이 서지 않은 Seed 는 답으로 세지 않는다 — 열이 0 인 채로 선다', () => {
    const item = itemOf(bend((a) => ({ ...a, seedSources: [] })), 'access-answer-kinds');
    expect(item.refs).toEqual([{ where: 'L1', detail: 'thing 0 · life 0' }]);
    expect(item.answer).toContain('답 합 0');
  });

  it('㊵ 중요 Lock 의 답이 한 종류뿐인 것이 보인다', () => {
    const one = itemOf(access(), 'access-answer-variety');
    expect(one.status).toBe('report');
    expect(one.answer).toBe('중요 Lock 1 · 답이 없는 Lock 0 · 한 종류뿐인 Lock 1');
    expect(one.refs).toEqual([{ where: 'L1', detail: '종류가 다른 답 1 / 2 (thing)' }]);

    // 다른 종류의 답 하나를 더 두면 다양해진다 — 같은 종류의 복제가 아니다
    const two = itemOf(
      bend((a) => ({
        ...a,
        seeds: [...a.seeds, { id: 'S3', answerKind: 'life', properties: [{ tag: 'a:y', from: 'act' }] }],
        seedSources: [...a.seedSources, { seed: 'S3', region: 'A', source: 'SRC3' }],
      })),
      'access-answer-variety',
    );
    expect(two.answer).toBe('중요 Lock 1 · 답이 없는 Lock 0 · 한 종류뿐인 Lock 0');
    expect(two.refs).toEqual([{ where: 'L1', detail: '종류가 다른 답 2 / 2 (thing · life)' }]);
  });

  it('㊷ 그 문 뒤에만 있는 방과 거기 선 원천 · 나가는 문', () => {
    const item = itemOf(access(), 'access-behind-lock');
    expect(item.status).toBe('report');
    expect(item.answer).toBe('Lock 이 걸린 문 1 · 뒤의 방 합 1 · 뒤가 비어 있는 문 0');
    expect(item.refs).toEqual([
      { where: 'AB', detail: 'Lock L1 · 뒤의 방 1 (B) · 원천 1 (SRC1) · 나가는 문 0' },
    ]);
  });

  it('㊷ 문에 걸린 Lock 이 하나도 없으면 absent 다', () => {
    expect(
      itemOf(bend((a) => ({ ...a, locks: [a.locks[1]!] })), 'access-behind-lock').status,
    ).toBe('absent');
  });
});

describe('㊶ 흔적 — 모든 Lock 이 알아낼 자리를 가졌는가', () => {
  it('그 방에 놓인 op 을 가리키면 통과다', () => {
    const item = itemOf(access(), 'access-trace');
    expect(item.status).toBe('pass');
    expect(item.answer).toBe('Lock 2 · 흔적 2 · 흔적 없는 Lock 0 · 끊긴 참조 0');
  });

  it('흔적이 없는 Lock 과 아무 데도 없는 op 이 잡힌다', () => {
    const item = itemOf(
      bend((a) => ({
        ...a,
        locks: [
          { ...a.locks[0]!, traces: [] },
          { ...a.locks[1]!, traces: ['no-such'] },
        ],
      })),
      'access-trace',
    );
    expect(item.status).toBe('fail');
    expect(item.refs).toEqual([
      { where: 'L1', detail: '이 요구를 알아낼 흔적을 하나도 가리키지 않는다' },
      { where: 'L2', detail: 'no-such 이 A 에도 그 이웃에도 op 로 없다' },
    ]);
    expect(item.answer).toBe('Lock 2 · 흔적 1 · 흔적 없는 Lock 1 · 끊긴 참조 1');
  });

  it('이웃한 방에 놓인 흔적도 흔적이고, layer 는 묻지 않는다', () => {
    // B 가 밝힌 Lock 이 이웃 방 A 의 자락(mark layer)을 가리킨다
    const item = itemOf(
      bend((a) => ({
        ...a,
        locks: [{ ...a.locks[0]!, region: 'B', traces: ['zone-a'] }, a.locks[1]!],
      })),
      'access-trace',
    );
    expect(item.status).toBe('pass');
  });
});
