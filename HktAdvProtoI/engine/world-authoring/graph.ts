// World Authoring — Region Graph (C001 ADDED).
//
// Region 사이의 것 — Containment 와 Connector 목록. Connector 는 두 Region 의 anchor point 를
// 잇는 **전이**이지 경계 이음이 아니다 (design/Plan-World-Authoring-Engine.md §3.1 ·
// content/roadmap/L2-World-Tool.md §1). Description 은 자리(point)만 두고, 연결은 여기가 소유한다.
//
// transition 은 불투명 문자열이다 — 무엇이 길이고 무엇이 문인지 기반은 모른다.
// discovery · activation · persistence · fallback 은 세계 규칙의 것 — 여기 없다.

export interface ConnectorEnd {
  region: string;
  /** 그 Region 의 Description 에 point 로 있어야 하는 이름 — layer 는 사용처가 정한다 (check.ts) */
  anchor: string;
}

export interface Connector {
  id: string;
  from: ConnectorEnd;
  to: ConnectorEnd;
  direction: 'bidirectional' | 'one-way';
  transition: string;
}

export interface RegionGraph {
  regions: readonly string[];
  containment: readonly { parent: string; child: string }[];
  connectors: readonly Connector[];
}

/** 이 Region 에서 나갈 수 있는 끝 하나 — here 는 이쪽 끝, there 는 건너간 뒤의 끝 */
export interface ConnectorExit {
  connector: Connector;
  here: ConnectorEnd;
  there: ConnectorEnd;
}

/**
 * 이 Region 에서 나갈 수 있는 끝들 — from 은 언제나, to 는 bidirectional 일 때만.
 * connectors 배열 순서를 지킨다 (결정론). 같은 Region 안을 도는 Connector 는 양 끝이 다 실린다.
 */
export function exitsOf(graph: RegionGraph, regionId: string): ConnectorExit[] {
  const out: ConnectorExit[] = [];
  for (const connector of graph.connectors) {
    if (connector.from.region === regionId) {
      out.push({ connector, here: connector.from, there: connector.to });
    }
    if (connector.direction === 'bidirectional' && connector.to.region === regionId) {
      out.push({ connector, here: connector.to, there: connector.from });
    }
  }
  return out;
}

export function findConnector(graph: RegionGraph, id: string): Connector | undefined {
  for (const connector of graph.connectors) {
    if (connector.id === id) return connector;
  }
  return undefined;
}
