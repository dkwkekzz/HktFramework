// World Authoring — Graph 단독 테스트 (C001 ADDED).

import { describe, expect, it } from 'vitest';
import { exitsOf, findConnector, type RegionGraph } from '../graph';

const graph: RegionGraph = {
  regions: ['A', 'B', 'C'],
  containment: [],
  connectors: [
    { id: 'c1', from: { region: 'A', anchor: 'p' }, to: { region: 'B', anchor: 'q' }, direction: 'bidirectional', transition: 't' },
    { id: 'c2', from: { region: 'B', anchor: 'r' }, to: { region: 'C', anchor: 's' }, direction: 'one-way', transition: 't' },
    { id: 'c3', from: { region: 'A', anchor: 'u' }, to: { region: 'C', anchor: 'v' }, direction: 'one-way', transition: 't' },
  ],
};

describe('exitsOf — 나갈 수 있는 끝', () => {
  it('bidirectional 은 양쪽에서 나간다', () => {
    const fromA = exitsOf(graph, 'A');
    expect(fromA.map((e) => e.connector.id)).toEqual(['c1', 'c3']);
    expect(fromA[0]?.here).toEqual({ region: 'A', anchor: 'p' });
    expect(fromA[0]?.there).toEqual({ region: 'B', anchor: 'q' });

    const fromB = exitsOf(graph, 'B');
    expect(fromB.map((e) => e.connector.id)).toEqual(['c1', 'c2']);
    expect(fromB[0]?.here).toEqual({ region: 'B', anchor: 'q' });
    expect(fromB[0]?.there).toEqual({ region: 'A', anchor: 'p' });
  });

  it('one-way 는 from 에서만 나간다', () => {
    expect(exitsOf(graph, 'C')).toEqual([]);
    expect(exitsOf(graph, 'B').some((e) => e.connector.id === 'c2' && e.here.region === 'B')).toBe(true);
  });

  it('connectors 배열 순서를 지킨다', () => {
    const reordered: RegionGraph = { ...graph, connectors: [...graph.connectors].reverse() };
    expect(exitsOf(reordered, 'A').map((e) => e.connector.id)).toEqual(['c3', 'c1']);
  });

  it('모르는 Region 은 빈 배열', () => {
    expect(exitsOf(graph, 'Z')).toEqual([]);
  });
});

describe('findConnector', () => {
  it('id 로 찾는다', () => {
    expect(findConnector(graph, 'c2')?.from.region).toBe('B');
    expect(findConnector(graph, 'none')).toBeUndefined();
  });
});
