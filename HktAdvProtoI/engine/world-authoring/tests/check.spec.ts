// World Authoring — Graph 검사 테스트 (C001 ADDED).

import { describe, expect, it } from 'vitest';
import { checkGraph } from '../check';
import type { RegionDescription } from '../description';
import type { RegionGraph } from '../graph';

const extent = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
const LAYER = 'anchor-layer';

function region(id: string, anchors: string[]): RegionDescription {
  return {
    id,
    extent,
    seed: 1,
    ops: anchors.map((tag, i) => ({ id: `${id}-${i}`, kind: 'point' as const, layer: LAYER, tag, position: { x: i, z: 0 } })),
  };
}

const goodGraph: RegionGraph = {
  regions: ['A', 'B'],
  containment: [],
  connectors: [
    { id: 'c1', from: { region: 'A', anchor: 'p' }, to: { region: 'B', anchor: 'p' }, direction: 'bidirectional', transition: 't' },
  ],
};

describe('checkGraph', () => {
  it('정상이면 issue 0', () => {
    expect(checkGraph([region('A', ['p']), region('B', ['p'])], goodGraph, LAYER)).toEqual([]);
  });

  it('unknown-region — Connector 가 가리키는 Region 에 Description 이 없다', () => {
    const issues = checkGraph([region('A', ['p'])], goodGraph, LAYER);
    expect(issues.map((i) => i.code)).toEqual(['unknown-region']);
    expect(issues[0]?.region).toBe('B');
  });

  it('missing-anchor — anchor point 가 그 layer 에 없다', () => {
    // B 에는 point 가 있으나 다른 layer 다 · A 에는 다른 tag 뿐이다
    const bWrongLayer: RegionDescription = {
      ...region('B', []),
      ops: [{ id: 'x', kind: 'point', layer: 'other', tag: 'p', position: { x: 0, z: 0 } }],
    };
    const issues = checkGraph([region('A', ['q']), bWrongLayer], goodGraph, LAYER);
    expect(issues.map((i) => [i.code, i.region])).toEqual([
      ['missing-anchor', 'A'],
      ['missing-anchor', 'B'],
    ]);
  });

  it('no-exit — one-way 의 도착 Region 은 나갈 곳이 없다', () => {
    const oneWay: RegionGraph = {
      ...goodGraph,
      connectors: [{ ...goodGraph.connectors[0]!, direction: 'one-way' }],
    };
    const issues = checkGraph([region('A', ['p']), region('B', ['p'])], oneWay, LAYER);
    expect(issues).toEqual([{ code: 'no-exit', region: 'B', detail: expect.any(String) }]);
  });

  it('no-exit — graph.regions 에만 있고 Connector 가 없는 Region', () => {
    const lonely: RegionGraph = { ...goodGraph, regions: ['A', 'B', 'C'] };
    const issues = checkGraph([region('A', ['p']), region('B', ['p']), region('C', [])], lonely, LAYER);
    expect(issues.map((i) => [i.code, i.region])).toEqual([['no-exit', 'C']]);
  });
});

// 아직 짓지 않은 곳(frontier)을 가리키는 Graph — A 만 지어져 있다
const frontierGraph: RegionGraph = {
  regions: ['A'],
  containment: [],
  frontiers: ['FRONTIER_X'],
  connectors: [
    { id: 'c1', from: { region: 'A', anchor: 'p' }, to: { region: 'FRONTIER_X', anchor: 'q' }, direction: 'bidirectional', transition: 't' },
  ],
};

describe('checkGraph — 경계(frontier)', () => {
  it('경계를 가리키는 끝은 unknown-region 도 missing-anchor 도 아니다', () => {
    expect(checkGraph([region('A', ['p'])], frontierGraph, LAYER)).toEqual([]);
  });

  it('경계로 밝히지 않은 이름을 가리키면 그대로 unknown-region', () => {
    const noFrontiers: RegionGraph = { ...frontierGraph, frontiers: [] };
    const issues = checkGraph([region('A', ['p'])], noFrontiers, LAYER);
    expect(issues.map((i) => [i.code, i.region])).toEqual([['unknown-region', 'FRONTIER_X']]);
  });

  it('frontier-built — 경계로 밝힌 이름에 Description 이 있다', () => {
    const issues = checkGraph([region('A', ['p']), region('FRONTIER_X', ['q'])], frontierGraph, LAYER);
    expect(issues.map((i) => [i.code, i.region])).toEqual([['frontier-built', 'FRONTIER_X']]);
  });

  it('unused-frontier — 아무 Connector 도 그 경계를 가리키지 않는다', () => {
    const unused: RegionGraph = { ...frontierGraph, frontiers: ['FRONTIER_X', 'FRONTIER_Y'] };
    const issues = checkGraph([region('A', ['p'])], unused, LAYER);
    expect(issues.map((i) => [i.code, i.region])).toEqual([['unused-frontier', 'FRONTIER_Y']]);
  });

  it('경계 검사는 frontiers 배열 순서를 지킨다 — 지어진 것 먼저, 그다음 쓰이지 않은 것', () => {
    const both: RegionGraph = { ...frontierGraph, frontiers: ['FRONTIER_Y', 'FRONTIER_X'] };
    const issues = checkGraph([region('A', ['p']), region('FRONTIER_X', ['q'])], both, LAYER);
    expect(issues.map((i) => [i.code, i.region])).toEqual([
      ['frontier-built', 'FRONTIER_X'],
      ['unused-frontier', 'FRONTIER_Y'],
    ]);
  });
});

describe('checkGraph — 닿음(unreachable)', () => {
  const wide: RegionGraph = {
    regions: ['A', 'B', 'C'],
    containment: [],
    connectors: [
      { id: 'c1', from: { region: 'A', anchor: 'p' }, to: { region: 'B', anchor: 'p' }, direction: 'bidirectional', transition: 't' },
      { id: 'c2', from: { region: 'C', anchor: 'p' }, to: { region: 'B', anchor: 'p' }, direction: 'one-way', transition: 't' },
    ],
  };
  const built = [region('A', ['p']), region('B', ['p']), region('C', ['p'])];

  it('startRegion 이 없으면 검사하지 않는다 — 기존 호출부는 그대로 통과한다', () => {
    expect(checkGraph(built, wide, LAYER)).toEqual([]);
  });

  it('unreachable — A 에서 C 로 가는 길이 없다 (graph.regions 순서)', () => {
    const issues = checkGraph(built, wide, LAYER, 'A');
    expect(issues.map((i) => [i.code, i.region])).toEqual([['unreachable', 'C']]);
  });

  it('닿는 곳뿐이면 issue 0', () => {
    expect(checkGraph(built, wide, LAYER, 'C')).toEqual([]);
  });

  it('경계는 닿음으로 세지 않는다 — 지어진 방들 사이에서만 센다', () => {
    expect(checkGraph([region('A', ['p'])], frontierGraph, LAYER, 'A')).toEqual([]);
  });

  it('새 검사는 기존 검사 뒤에 붙는다', () => {
    const messy: RegionGraph = {
      regions: ['A', 'B'],
      containment: [],
      frontiers: ['FRONTIER_Y'],
      connectors: [
        { id: 'c1', from: { region: 'A', anchor: 'p' }, to: { region: 'UNKNOWN_Z', anchor: 'q' }, direction: 'one-way', transition: 't' },
      ],
    };
    const issues = checkGraph([region('A', ['p']), region('B', ['p'])], messy, LAYER, 'A');
    expect(issues.map((i) => [i.code, i.region])).toEqual([
      ['unknown-region', 'UNKNOWN_Z'],
      ['no-exit', 'B'],
      ['unused-frontier', 'FRONTIER_Y'],
      ['unreachable', 'B'],
    ]);
  });
});

describe('checkGraph — 읽기 전용', () => {
  it('인자를 변형하지 않는다', () => {
    const descriptions = [region('A', ['p'])];
    const before = JSON.stringify({ descriptions, graph: frontierGraph });
    checkGraph(descriptions, frontierGraph, LAYER, 'A');
    expect(JSON.stringify({ descriptions, graph: frontierGraph })).toBe(before);
  });
});
