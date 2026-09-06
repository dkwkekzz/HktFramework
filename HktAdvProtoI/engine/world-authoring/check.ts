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

import type { CompiledWorldTerrain } from './compiled';
import { areasOf, findPoint, pointsOf, type RegionDescription } from './description';
import { exitsOf, isFrontier, reachableRegions, type ConnectorEnd, type RegionGraph } from './graph';
import { rasterSemantic } from './observe';
import { tagsAt } from './query';

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

// ── 검사 아홉 — 기계가 읽는 보고 (T1 ADDED) ──────────────────────────
//
// Concept §3.6 의 ①~④ 와 Region §3.2 의 ⑤~⑨ 를 한 자리에 모은다. 여기까지 오기 전에는
// 이 아홉이 `tools/world-editor/observe.ts` 안에서 사람이 읽을 줄로만 났다 — 그래서 다른
// 도구가 되읽을 수 없었고, `npm test` 도 걸 자리가 없었다.
//
// **게임 명사가 없다.** 어느 layer 가 자원이고 어느 tag 가 사람 사는 자리인지는 이 기반이
// 알지 못한다 — 컨텐츠가 `CheckContract` 로 준다. 그래서 이 파일은 layer 이름 하나도 글자로
// 들고 있지 않다 (C011 이 `resource` 를 놓기 전까지 도구가 그 세 이름을 들고 있던 자리다).
//
// 판정은 넷이다. `absent` 가 따로 있는 이유는 하나 — **놓인 것이 없는 검사를 통과로 적으면
// 검사가 거짓말을 한다.** 없는 것은 없다고 적고, 그것은 실패도 통과도 아니다.
//
//   pass    재 보았고 걸린 것이 없다
//   fail    걸린 것이 있다 — refs 가 그 자리를 가리킨다
//   absent  잴 것이 놓여 있지 않다 (통과가 아니다)
//   report  판정하지 않는 항목 — 수만 적고 많고 적음은 사람이 본다 (⑨ · 번호 밖의 코드)

export type CheckStatus = 'pass' | 'fail' | 'absent' | 'report';

/** 걸린 자리 하나 — 어디가 걸렸고(where) 무엇이 걸렸는가(detail) */
export interface CheckRef {
  where: string;
  detail: string;
}

export interface CheckItem {
  /** 번호 — '①'…'⑨'. 번호 밖의 것은 '·' */
  mark: string;
  /** 기계가 잡는 이름 — JSON 의 열쇠이므로 번호가 바뀌어도 이것은 그대로다 */
  id: string;
  /** 사람이 읽는 이름 */
  name: string;
  status: CheckStatus;
  /** 한 줄 답 — 수를 적는다 */
  answer: string;
  refs: CheckRef[];
}

export interface CheckReport {
  /** status 가 fail 인 항목이 하나도 없으면 true */
  ok: boolean;
  counts: Record<CheckStatus, number>;
  items: CheckItem[];
}

/** 검사가 볼 방 하나 — 컨텐츠의 RegionSpec 에서 기반이 아는 만큼만 옮겨 온 것 */
export interface CheckRegion {
  id: string;
  /** 그 방의 깊이 태그 (②). 빈 글자면 깊이가 없는 것이다 */
  depth: string;
  space: RegionDescription;
  /** 그 방이 품은 규칙의 수 (⑨). 세는 방법은 컨텐츠가 안다 */
  coreRules: number;
}

/** 게임 명사를 기반에 건네는 자리 — 이 계약이 없으면 아홉 중 넷은 무엇을 찾을지 모른다 */
export interface CheckContract {
  /** Connector 의 anchor 가 사는 layer (⑤) */
  anchorLayer: string;
  /** ① 자원 · 위험 */
  resourceLayer: string;
  hazardLayer: string;
  /** ④ 그 지역을 하나로 만드는 특징 */
  phenomenonLayer: string;
  /** ③ 사람이 사는 자리와 그것을 세우는 조건 */
  settlementLayer: string;
  settlementTags: readonly string[];
  conditionPrefix: string;
  /** ⑧ 여기서부터 닿아야 한다 — 주지 않으면 ⑧ 을 건너뛴다 */
  startRegion?: string;
}

/**
 * ① 이 겹침·닿음을 재는 자 — 그 방을 **어떻게 컴파일하는지**는 기반이 정하지 않는다.
 * 주지 않으면 ① 은 놓인 수만 세고 겹침은 재지 않는다 (그때도 통과로 적지 않는다).
 */
export type RegionCompiler = (region: CheckRegion) => CompiledWorldTerrain;

export interface CheckRegionsInput {
  regions: readonly CheckRegion[];
  graph: RegionGraph;
  contract: CheckContract;
  compile?: RegionCompiler;
}

/** checkGraph 의 코드 → ⑤⑥⑦⑧. 순서가 곧 번호다 */
const GRAPH_CHECKS: readonly { mark: string; id: string; code: GraphIssueCode; name: string }[] = [
  { mark: '⑤', id: 'connector-anchor', code: 'missing-anchor', name: 'Connector anchor 가 없는 방' },
  { mark: '⑥', id: 'containment-linked', code: 'containment-unlinked', name: '이어지지 않은 중첩' },
  { mark: '⑦', id: 'region-exit', code: 'no-exit', name: '나갈 곳 없는 방' },
  { mark: '⑧', id: 'region-reachable', code: 'unreachable', name: '시작 방에서 닿지 않는 방' },
];
/** 번호가 붙지 않은 나머지 코드 — 숨기지 않고 한 항목으로 함께 낸다 */
const OTHER_GRAPH_CODES: readonly GraphIssueCode[] = [
  'unknown-region',
  'frontier-built',
  'unused-frontier',
];

/** 그 layer 에 놓인 것의 수 — area 와 point 를 함께 센다 (자리를 어느 쪽으로 적을지는 컨텐츠가 고른다) */
function placedCount(space: RegionDescription, layer: string): number {
  return areasOf(space, layer).length + pointsOf(space, layer).length;
}

/**
 * ① 두 layer 가 겹치거나 닿는 칸의 수. area 는 격자로, point 는 그 자리로 잰다 —
 * C011 의 원천이 point 로 놓였기 때문에 area 만 보면 놓인 것을 못 본다.
 */
function measureAdjacency(
  world: CompiledWorldTerrain,
  layer: string,
  against: string,
): { overlap: number; touch: number } {
  const mine = rasterSemantic(world, layer);
  const theirs = rasterSemantic(world, against);
  let overlap = 0;
  let touch = 0;
  const { width, height } = mine;
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = row * width + col;
      if ((mine.values[i] ?? 0) === 0) continue;
      if ((theirs.values[i] ?? 0) !== 0) {
        overlap++;
        continue;
      }
      const near =
        (col > 0 && (theirs.values[i - 1] ?? 0) !== 0) ||
        (col + 1 < width && (theirs.values[i + 1] ?? 0) !== 0) ||
        (row > 0 && (theirs.values[i - width] ?? 0) !== 0) ||
        (row + 1 < height && (theirs.values[i + width] ?? 0) !== 0);
      if (near) touch++;
    }
  }
  // point 로 놓인 것 — 그 자리가 상대 area 안이면 겹침, 한 칸 안이면 닿음
  const step = world.resolution;
  for (const point of world.points) {
    if (point.layer !== layer) continue;
    const { x, z } = point.position;
    if (tagsAt(world, x, z, against).length > 0) {
      overlap++;
      continue;
    }
    const near =
      tagsAt(world, x - step, z, against).length > 0 ||
      tagsAt(world, x + step, z, against).length > 0 ||
      tagsAt(world, x, z - step, against).length > 0 ||
      tagsAt(world, x, z + step, against).length > 0;
    if (near) touch++;
  }
  return { overlap, touch };
}

/** ① 자원과 위험이 같은 근원인가 (W4) — 자원이 위험에 겹치거나 닿는가 */
function checkResourceHazard(input: CheckRegionsInput): CheckItem {
  const { regions, contract, compile } = input;
  const item = { mark: '①', id: 'resource-hazard-origin', name: '자원과 위험이 같은 근원인가' };
  let resources = 0;
  let hazards = 0;
  for (const region of regions) {
    resources += placedCount(region.space, contract.resourceLayer);
    hazards += placedCount(region.space, contract.hazardLayer);
  }
  if (resources === 0 && hazards === 0) {
    return {
      ...item,
      status: 'absent',
      answer: `놓인 것이 없다 — ${contract.resourceLayer} 0 · ${contract.hazardLayer} 0`,
      refs: [],
    };
  }
  // 한쪽만 놓였으면 "같은 근원인가" 를 잴 수가 없다. 통과로도 실패로도 적지 않는다 —
  // 없는 쪽을 놓는 것은 컨텐츠 층의 일이고, 도구는 그 자리가 비었다는 사실만 적는다
  if (resources === 0 || hazards === 0) {
    const missing = resources === 0 ? contract.resourceLayer : contract.hazardLayer;
    return {
      ...item,
      status: 'absent',
      answer: `짝이 없다 — ${contract.resourceLayer} ${resources} · ${contract.hazardLayer} ${hazards} (${missing} 이 놓이지 않아 잴 수 없다)`,
      refs: [],
    };
  }
  if (!compile) {
    return {
      ...item,
      status: 'report',
      answer: `${contract.resourceLayer} ${resources} · ${contract.hazardLayer} ${hazards} — 겹침을 재는 자가 없다`,
      refs: [],
    };
  }
  const refs: CheckRef[] = [];
  for (const region of regions) {
    const mine = placedCount(region.space, contract.resourceLayer);
    if (mine === 0) continue;
    const { overlap, touch } = measureAdjacency(
      compile(region),
      contract.resourceLayer,
      contract.hazardLayer,
    );
    if (overlap === 0 && touch === 0) {
      refs.push({
        where: region.id,
        detail: `${contract.resourceLayer} ${mine} 이 ${contract.hazardLayer} 에 겹치지도 닿지도 않는다`,
      });
    }
  }
  return {
    ...item,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `근원이 끊긴 방 ${refs.length} (${contract.resourceLayer} ${resources} · ${contract.hazardLayer} ${hazards})`,
    refs,
  };
}

/** ② 깊이 없는 자리 — 모든 자리는 깊이를 가진다 (W1) */
function checkDepth(input: CheckRegionsInput): CheckItem {
  const refs: CheckRef[] = [];
  for (const region of input.regions) {
    if (region.depth.trim() === '') refs.push({ where: region.id, detail: 'depth 가 비어 있다' });
  }
  return {
    mark: '②',
    id: 'region-depth',
    name: '깊이 없는 자리',
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `depth 없는 Region ${refs.length} / ${input.regions.length}`,
    refs,
  };
}

/** ③ 조건 없이 선 settlement — 안전 조건 없는 문명 (W2) */
function checkSettlementCondition(input: CheckRegionsInput): CheckItem {
  const { regions, contract } = input;
  const item = { mark: '③', id: 'settlement-condition', name: '조건 없이 선 settlement' };
  const refs: CheckRef[] = [];
  let withSettlement = 0;
  let conditionTotal = 0;
  for (const region of regions) {
    const areas = areasOf(region.space, contract.settlementLayer);
    const settlements = areas.filter((area) => contract.settlementTags.includes(area.tag));
    if (settlements.length === 0) continue;
    withSettlement++;
    const conditions = areas.filter((area) => area.tag.startsWith(contract.conditionPrefix));
    conditionTotal += conditions.length;
    if (conditions.length === 0) {
      refs.push({
        where: region.id,
        detail: `settlement ${settlements.map((a) => a.tag).join(' · ')} 이 ${contract.conditionPrefix}* 조건 없이 섰다`,
      });
    }
  }
  if (withSettlement === 0) {
    return {
      ...item,
      status: 'absent',
      answer: `놓인 것이 없다 — ${contract.settlementLayer} 의 ${contract.settlementTags.join(' · ')} area 0`,
      refs: [],
    };
  }
  return {
    ...item,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `settlement 를 가진 Region ${withSettlement} · condition 합 ${conditionTotal} · 조건 0 인 곳 ${refs.length}`,
    refs,
  };
}

/** ④ Region 에 phenomenon 이 정확히 하나인가 (W5 — Region 당 하나) */
function checkPhenomenon(input: CheckRegionsInput): CheckItem {
  const { regions, contract } = input;
  const item = { mark: '④', id: 'region-phenomenon', name: 'Region 의 phenomenon 수' };
  const counts = regions.map((region) => placedCount(region.space, contract.phenomenonLayer));
  const total = counts.reduce((sum, n) => sum + n, 0);
  if (total === 0) {
    return {
      ...item,
      status: 'absent',
      answer: `놓인 것이 없다 — ${contract.phenomenonLayer} 0`,
      refs: [],
    };
  }
  const refs: CheckRef[] = [];
  regions.forEach((region, i) => {
    const count = counts[i] ?? 0;
    if (count !== 1) {
      refs.push({ where: region.id, detail: `${contract.phenomenonLayer} ${count} — 하나가 아니다` });
    }
  });
  return {
    ...item,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `합 ${total} · 하나가 아닌 Region ${refs.length} / ${regions.length}`,
    refs,
  };
}

/** ⑤⑥⑦⑧ 과 번호 밖의 코드 — checkGraph 의 결과를 옮긴다 */
function graphItems(issues: readonly GraphIssue[]): CheckItem[] {
  const items: CheckItem[] = [];
  for (const check of GRAPH_CHECKS) {
    const hit = issues.filter((issue) => issue.code === check.code);
    items.push({
      mark: check.mark,
      id: check.id,
      name: check.name,
      status: hit.length === 0 ? 'pass' : 'fail',
      answer: `${check.code} ${hit.length}`,
      refs: hit.map((issue) => ({ where: issue.region, detail: issue.detail })),
    });
  }
  const others = issues.filter((issue) =>
    OTHER_GRAPH_CODES.includes(issue.code as GraphIssueCode),
  );
  items.push({
    mark: '·',
    id: 'graph-other',
    name: '번호 밖의 checkGraph 코드',
    status: 'report',
    answer: OTHER_GRAPH_CODES.map(
      (code) => `${code} ${issues.filter((issue) => issue.code === code).length}`,
    ).join(' · '),
    refs: others.map((issue) => ({ where: issue.region, detail: `${issue.code}  ${issue.detail}` })),
  });
  return items;
}

/** ⑨ core rule 수 — 보고만 한다. 몇 개가 많은지는 사람이 판단한다 (Region §3.2) */
function checkCoreRules(input: CheckRegionsInput): CheckItem {
  const refs: CheckRef[] = [];
  let total = 0;
  for (const region of input.regions) {
    total += region.coreRules;
    if (region.coreRules > 0) {
      refs.push({ where: region.id, detail: `core rule ${region.coreRules}` });
    }
  }
  return {
    mark: '⑨',
    id: 'core-rule-count',
    name: 'core rule 수',
    status: 'report',
    answer: `합 ${total} · 규칙을 품은 Region ${refs.length} / ${input.regions.length}`,
    refs,
  };
}

/**
 * 검사 아홉을 한 번에 돌린다 — 결과는 기계가 읽는다 (T1).
 *
 * 순서는 언제나 ①~⑨ 이고, 각 항목의 refs 는 준 `regions` 배열 순서다 — 두 번 돌리면 같다.
 * 세계를 바꾸지 않는 읽기 전용 관찰이다.
 */
export function checkRegions(input: CheckRegionsInput): CheckReport {
  const { regions, graph, contract } = input;
  const issues = checkGraph(
    regions.map((region) => region.space),
    graph,
    contract.anchorLayer,
    contract.startRegion,
  );
  const items: CheckItem[] = [
    checkResourceHazard(input),
    checkDepth(input),
    checkSettlementCondition(input),
    checkPhenomenon(input),
    ...graphItems(issues),
    checkCoreRules(input),
  ];
  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, absent: 0, report: 0 };
  for (const item of items) counts[item.status]++;
  return { ok: counts.fail === 0, counts, items };
}
