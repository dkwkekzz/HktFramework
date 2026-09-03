// World Authoring — Graph 단독 테스트 (C001 ADDED).

import { describe, expect, it } from 'vitest';
import { exitsOf, findConnector, isFrontier, reachableRegions, type RegionGraph } from '../graph';

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

describe('isFrontier — 밝힌 경계인가', () => {
  it('frontiers 가 없으면 아무 이름도 경계가 아니다', () => {
    expect(isFrontier(graph, 'A')).toBe(false);
    expect(isFrontier(graph, 'FRONTIER_X')).toBe(false);
  });

  it('frontiers 에 있는 이름만 경계다', () => {
    const withFrontiers: RegionGraph = { ...graph, frontiers: ['FRONTIER_X', 'FRONTIER_Y'] };
    expect(isFrontier(withFrontiers, 'FRONTIER_X')).toBe(true);
    expect(isFrontier(withFrontiers, 'FRONTIER_Y')).toBe(true);
    expect(isFrontier(withFrontiers, 'A')).toBe(false);
    expect(isFrontier(withFrontiers, 'FRONTIER_Z')).toBe(false);
  });
});

describe('reachableRegions — Connector 를 따라 닿는 곳', () => {
  it('시작 Region 자신을 포함하고 방향을 지킨다', () => {
    // A --c1(양방향)-- B --c2(A→B 아님, B→C 단방향)--> C · A --c3--> C
    expect(reachableRegions(graph, 'A')).toEqual(['A', 'B', 'C']);
    expect(reachableRegions(graph, 'B')).toEqual(['B', 'A', 'C']);
    expect(reachableRegions(graph, 'C')).toEqual(['C']);
  });

  it('connectors 배열 순서를 지키는 너비 우선 — 결정론', () => {
    const reordered: RegionGraph = { ...graph, connectors: [...graph.connectors].reverse() };
    // c3(A→C) 가 먼저이므로 C 를 B 보다 먼저 센다
    expect(reachableRegions(reordered, 'A')).toEqual(['A', 'C', 'B']);
  });

  it('regions 에 없는 이름은 세지 않는다 — 경계도 세지 않는다', () => {
    const toFrontier: RegionGraph = {
      regions: ['A'],
      containment: [],
      frontiers: ['FRONTIER_X'],
      connectors: [
        { id: 'c1', from: { region: 'A', anchor: 'p' }, to: { region: 'FRONTIER_X', anchor: 'q' }, direction: 'bidirectional', transition: 't' },
      ],
    };
    expect(reachableRegions(toFrontier, 'A')).toEqual(['A']);
  });

  it('모르는 Region 에서 시작하면 빈 배열', () => {
    expect(reachableRegions(graph, 'Z')).toEqual([]);
  });

  it('닿지 않는 Region 은 빠진다', () => {
    const split: RegionGraph = { ...graph, regions: ['A', 'B', 'C', 'D'] };
    expect(reachableRegions(split, 'A')).toEqual(['A', 'B', 'C']);
  });
});
