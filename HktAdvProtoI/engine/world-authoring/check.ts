// World Authoring — Graph 검사 (C001 ADDED).
//
// Description 들과 Graph 가 서로 맞물리는지 본다. 세계를 바꾸지 않는 읽기 전용 관찰이다.
// anchorLayer 는 인자다 — 어느 layer 가 "드나드는 곳" 인지 기반은 모른다.
//
//   unknown-region   Connector 가 가리키는 region 이 descriptions 에 없다
//   missing-anchor   Connector 의 from/to anchor 가 그 Region 의 Description 에
//                    (layer = anchorLayer, tag = anchor) point 로 없다             (검사 ⑤)
//   no-exit          graph.regions 의 어느 Region 에 exitsOf 가 하나도 없다          (검사 ⑦)
//   frontier-built   graph.frontiers 로 밝힌 이름에 Description 이 있다 —
//                    지어진 곳은 경계 목록에서 빠져야 한다
//   unused-frontier  graph.frontiers 의 이름을 아무 Connector 도 가리키지 않는다
//   unreachable      startRegion 을 주었을 때, 거기서 Connector 를 따라 닿지 않는
//                    graph.regions 의 Region 이 있다                                (검사 ⑧)
//   containment-unlinked
//                    graph.containment 의 child 와 그 parent 를 잇는 Connector 가
//                    하나도 없다 — 방향은 묻지 않는다                                (검사 ⑥)
//
// 경계(frontier)로 밝힌 이름은 Description 이 없어도 정상이다 — 그 끝의 anchor 도 보지 않는다.

import { findPoint, type RegionDescription } from './description';
import { exitsOf, isFrontier, reachableRegions, type ConnectorEnd, type RegionGraph } from './graph';

export type GraphIssueCode =
  | 'unknown-region'
  | 'missing-anchor'
  | 'no-exit'
  | 'frontier-built'
  | 'unused-frontier'
  | 'unreachable'
  | 'containment-unlinked';

export interface GraphIssue {
  code: GraphIssueCode;
  region: string;
  detail: string;
}

export function checkGraph(
  descriptions: readonly RegionDescription[],
  graph: RegionGraph,
  anchorLayer: string,
  /** 주면 검사 ⑧(unreachable)까지 본다 — 없으면 그 검사를 건너뛴다 */
  startRegion?: string,
): GraphIssue[] {
  const issues: GraphIssue[] = [];
  const byId = new Map<string, RegionDescription>();
  for (const d of descriptions) byId.set(d.id, d);

  // Connector 의 양 끝 — from · to 순서, connectors 배열 순서 (결정론)
  const checkEnd = (connectorId: string, side: 'from' | 'to', end: ConnectorEnd): void => {
    const description = byId.get(end.region);
    if (!description) {
      // 아직 짓지 않은 곳을 가리키는 것은 정합 오류가 아니다 — anchor 도 보지 않는다
      if (isFrontier(graph, end.region)) return;
      issues.push({
        code: 'unknown-region',
        region: end.region,
        detail: `connector ${connectorId} ${side} refers to region ${end.region} which has no description`,
      });
      return;
    }
    if (!findPoint(description, anchorLayer, end.anchor)) {
      issues.push({
        code: 'missing-anchor',
        region: end.region,
        detail: `connector ${connectorId} ${side} anchor ${end.anchor} is not a point(layer=${anchorLayer}) in region ${end.region}`,
      });
    }
  };
  for (const connector of graph.connectors) {
    checkEnd(connector.id, 'from', connector.from);
    checkEnd(connector.id, 'to', connector.to);
  }

  // 나갈 곳 없는 Region — graph.regions 순서
  for (const regionId of graph.regions) {
    if (exitsOf(graph, regionId).length === 0) {
      issues.push({ code: 'no-exit', region: regionId, detail: `region ${regionId} has no exit` });
    }
  }

  // 경계 목록 — frontiers 배열 순서, 한 이름당 검사마다 한 번
  const frontiers = graph.frontiers ?? [];
  for (const name of frontiers) {
    if (byId.has(name)) {
      issues.push({
        code: 'frontier-built',
        region: name,
        detail: `frontier ${name} has a description — a built region must leave the frontier list`,
      });
    }
  }
  for (const name of frontiers) {
    let pointed = false;
    for (const connector of graph.connectors) {
      if (connector.from.region === name || connector.to.region === name) {
        pointed = true;
        break;
      }
    }
    if (!pointed) {
      issues.push({
        code: 'unused-frontier',
        region: name,
        detail: `frontier ${name} is pointed at by no connector`,
      });
    }
  }

  // 닿지 않는 Region — startRegion 을 준 때만, graph.regions 순서
  if (startRegion !== undefined) {
    const reached = new Set(reachableRegions(graph, startRegion));
    for (const regionId of graph.regions) {
      if (!reached.has(regionId)) {
        issues.push({
          code: 'unreachable',
          region: regionId,
          detail: `region ${regionId} is not reachable from ${startRegion}`,
        });
      }
    }
  }

  // 중첩 — containment 배열 순서. parent 와 child 를 잇는 Connector 가 하나라도 있어야 한다.
  // 방향은 묻지 않는다 — 한쪽으로만 가는 이음도 이음이다.
  for (const { parent, child } of graph.containment) {
    let linked = false;
    for (const connector of graph.connectors) {
      const a = connector.from.region;
      const b = connector.to.region;
      if ((a === parent && b === child) || (a === child && b === parent)) {
        linked = true;
        break;
      }
    }
    if (!linked) {
      issues.push({
        code: 'containment-unlinked',
        region: child,
        detail: `containment child ${child} is linked to its parent ${parent} by no connector`,
      });
    }
  }

  return issues;
}
