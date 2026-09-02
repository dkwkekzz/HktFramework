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
