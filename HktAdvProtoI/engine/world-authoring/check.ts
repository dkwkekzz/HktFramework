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
import { areasOf, curvesOf, findPoint, pointsOf, type RegionDescription } from './description';
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
  /** 번호 — '①'…'㉝'. 번호 밖의 것은 '·' */
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
  /** ⑰ 원천이 가리키는 흔적 op 가 사는 layer */
  traceLayer: string;
  /**
   * ⑩ ㉑ 자원 layer 에 서지만 **원천이 아닌** 것들의 이름 (C022 ADDED).
   *
   * 그 layer 에 서는 것이 둘이 되었다 — 원천과 **탄생지**다 (L2-World-Life §3.1: 탄생지는
   * 재료를 소비하고 잔여물을 낳으므로 원천과 같은 자리에 산다). 두 검사가 묻는 것은 한 줄도
   * 바뀌지 않았다 — **자리를 얻은 이름을 세계가 아는가**이고, 세계가 아는 이름의 갈래가
   * 하나 는 것뿐이다. 주지 않으면 이 자리가 비고, 그때의 답은 C021 까지와 한 값도 다르지 않다.
   *
   * 계통(`life`)이 아니라 계약이 이것을 주는 까닭 — 계통을 주지 않고 ⑩ ㉑ 만 재는 자리
   * (후보 방을 나란히 놓고 견주는 T6 의 바탕)에서도 같은 잣대여야 하기 때문이다.
   */
  lifeSiteTags?: readonly string[];
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
  /** ⑩~㉒ 가 볼 재료 계통 — 주지 않으면 그 열셋이 전부 absent 다 */
  ecology?: CheckEcology;
  /** ㉓~㉖ 이 볼 시간 쪽 계약 — 주지 않으면 그 넷이 전부 absent 다 (ecology 의 선례 그대로) */
  time?: CheckTime;
  /** ㉗~㉝ 이 볼 생명 계통 — 주지 않으면 그 일곱이 전부 absent 다 (ecology 의 선례 그대로) */
  life?: CheckLife;
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
  // **판정은 방 단위다.** 위쪽의 "한쪽만 놓였으면 잴 수 없다" 를 세계가 아니라 방마다 읽는다 —
  // 원천은 있는데 위험이 아직 놓이지 않은 방은 **끊긴 것이 아니라 아직 안 놓인 것**이고,
  // 없는 쪽을 놓는 것은 여전히 컨텐츠 층의 일이다. 도구는 그 자리가 비었다는 사실만 적는다.
  // (세계 전체로 읽으면 한 방에 위험을 놓는 순간 나머지 방이 전부 실패로 돌아선다 — 위험을
  //  한 번에 다 놓지 않는 한 이 검사를 켤 수가 없다.)
  const refs: CheckRef[] = [];
  let judged = 0;
  let unplaced = 0;
  for (const region of regions) {
    const mine = placedCount(region.space, contract.resourceLayer);
    if (mine === 0) continue;
    if (placedCount(region.space, contract.hazardLayer) === 0) {
      unplaced++;
      continue;
    }
    judged++;
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
  // 잰 방이 하나도 없으면 여전히 잴 수 없다 — 위쪽의 absent 와 같은 뜻이다
  if (judged === 0) {
    return {
      ...item,
      status: 'absent',
      answer: `짝이 놓인 방이 없다 — 원천을 가진 방 ${unplaced} 에 ${contract.hazardLayer} 이 놓이지 않았다`,
      refs: [],
    };
  }
  return {
    ...item,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer:
      `근원이 끊긴 방 ${refs.length} · 잰 방 ${judged}` +
      (unplaced > 0 ? ` · ${contract.hazardLayer} 이 아직 놓이지 않은 방 ${unplaced}` : '') +
      ` (${contract.resourceLayer} ${resources} · ${contract.hazardLayer} ${hazards})`,
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
 * 검사 서른셋을 한 번에 돌린다 — 결과는 기계가 읽는다
 * (T1 의 아홉 + C014 의 열셋 + C018 의 넷 + C022 의 일곱).
 *
 * 순서는 언제나 ①~⑨ · ⑩~㉒ · ㉓~㉖ · ㉗~㉝ 이고, 각 항목의 refs 는 준 배열 순서다 —
 * 두 번 돌리면 같다.
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
    ...ecologyItems(input),
    ...timeItems(input),
    ...lifeItems(input),
  ];
  const counts: Record<CheckStatus, number> = { pass: 0, fail: 0, absent: 0, report: 0 };
  for (const item of items) counts[item.status]++;
  return { ok: counts.fail === 0, counts, items };
}

// ── 검사 열셋 — 재료 계통의 참조 무결성과 두 요약 (C014 ADDED) ───────
//
// 검사 아홉(T1)이 방과 그래프를 재었다면, 이 열셋은 **그 방들 위에 얹힌 계통**을 잰다 —
// 무엇이 무엇을 낳고, 어디에 서고, 어느 길로 실려 오는가. 재는 것은 오직 참조의 성립 여부다.
// 많고 적음(⑲ ⑳)은 판정하지 않고 수만 적는다 — 적정량은 사람이 본다.
//
// 여기에도 **게임 명사가 없다.** 이 계통이 무엇으로 이루어졌는지는 `CheckEcology` 가 구조로만
// 말하고, 어느 layer 에 자리가 놓이고 어느 layer 에 흔적이 서는지는 `CheckContract` 가 준다.
// 계통을 주지 않으면 열셋은 전부 `absent` 다 — 잴 것이 없으면 통과로 적지 않는다 (T1 의 규율).

/** 재료 하나 — 검사 ⑪ ⑫ 가 본다 (C014 ADDED) */
export interface CheckEcologyMaterial {
  id: string;
  /** 이것을 낳는 세계 원인의 id — 비면 ⑪ 이 걸린다 */
  worldCause: string;
}

/** 원천 하나 — 게임 명사 없이 구조만 */
export interface CheckEcologySource {
  id: string;
  region: string;
  /** 이 원천이 내는 재료의 id — 비면 ⑪ · ㉑ */
  materialId: string;
  /** 이 원천이 매달린 세계 원인의 id — 비면 ⑪ */
  worldCause: string;
  /** 공급 유형 — 비면 ⑬ */
  supply: string;
  /** 되돌아오는 원천인가 (⑭ 는 참인 것에만 묻는다) */
  renewable: boolean;
  /** 되돌아옴의 원인 — renewable 인데 비면 ⑭ */
  recoveryCause: string;
  /** 다 쓰면 끝나는 원천인가 (⑮ 는 참인 것에만 묻는다) */
  finite: boolean;
  /** 고갈이 세계에 남기는 것 — finite 인데 비면 ⑮ */
  depletionConsequence: string;
  /** 이 원천을 암시하는 흔적 op id 들 — 비면 ⑯ */
  traces: readonly string[];
  /** 기회의 자리 (⑲ 가 센다) */
  opportunity: string;
  /** 무엇이 지고 있는가 (⑳ 이 센다) */
  carrier: string;
}

/** 흐름 하나 — 검사 ⑱ 이 본다 */
export interface CheckEcologyFlow {
  id: string;
  materialId: string;
  from: { region: string; source: string };
  to: { region: string; source: string };
  /** 어느 Connector 를 타는가 — graph.connectors 에 있어야 한다 */
  connector: string;
}

/** 이 세계의 재료 계통 — 검사 ⑩~㉒ 가 보는 전부 */
export interface CheckEcology {
  materials: readonly CheckEcologyMaterial[];
  sources: readonly CheckEcologySource[];
  flows: readonly CheckEcologyFlow[];
  /** 이 계통이 다룬다고 밝힌 방 — id 와 그 방이 스스로 낸 격리 이유(없으면 빈 글자) */
  regions: readonly { id: string; isolationReason: string }[];
}

/** 열셋의 번호·이름 — 이 차례가 곧 보고에 실리는 차례다 (계통이 없을 때의 absent 도 이것을 쓴다) */
const ECOLOGY_ITEMS = {
  placementSource: { mark: '⑩', id: 'ecology-placement-source', name: '모르는 원천을 가리키는 배치' },
  sourceRefs: { mark: '⑪', id: 'ecology-source-refs', name: '원천이 가리키는 원인과 재료' },
  materialSource: { mark: '⑫', id: 'ecology-material-source', name: '자리를 얻은 원천이 없는 재료' },
  supplyMode: { mark: '⑬', id: 'ecology-supply-mode', name: '공급 유형 없는 원천' },
  recoveryCause: { mark: '⑭', id: 'ecology-recovery-cause', name: '되돌아옴의 원인 없는 원천' },
  depletion: { mark: '⑮', id: 'ecology-depletion', name: '고갈 결과 없는 원천' },
  traceRef: { mark: '⑯', id: 'ecology-trace-ref', name: '흔적 참조 없는 원천' },
  traceValid: { mark: '⑰', id: 'ecology-trace-valid', name: '가리킨 흔적과 방이 있는가' },
  flowValid: { mark: '⑱', id: 'ecology-flow-valid', name: '흐름의 양 끝과 Connector' },
  opportunity: { mark: '⑲', id: 'ecology-opportunity', name: '기회 자리의 분포' },
  carrier: { mark: '⑳', id: 'ecology-carrier', name: '방마다의 Carrier 분포와 원천 수' },
  orphan: { mark: '㉑', id: 'ecology-orphan', name: '원천 없는 배치와 재료 없는 원천' },
  isolation: { mark: '㉒', id: 'ecology-isolation', name: '유입도 원천도 이유도 없는 방' },
} as const;

/** 잴 것이 놓이지 않았다 — 통과가 아니다 */
function absentItem(head: { mark: string; id: string; name: string }, answer: string): CheckItem {
  return { ...head, status: 'absent', answer, refs: [] };
}

/** 계통이 밝힌 자리 하나 — 그 방의 resourceLayer 에 놓인 area·point */
interface EcologyPlacement {
  region: string;
  tag: string;
}

/** 놓인 자리들 — 방 순서, 방 안에서는 area 다음 point (①이 세는 차례와 같다) */
function resourcePlacements(input: CheckRegionsInput): EcologyPlacement[] {
  const out: EcologyPlacement[] = [];
  for (const region of input.regions) {
    for (const area of areasOf(region.space, input.contract.resourceLayer)) {
      out.push({ region: region.id, tag: area.tag });
    }
    for (const point of pointsOf(region.space, input.contract.resourceLayer)) {
      out.push({ region: region.id, tag: point.tag });
    }
  }
  return out;
}

/** 그 방의 Description 에 이 id 의 op 가 그 layer 로 있는가 (⑰). 높이 편집에는 layer 가 없다 */
function hasLayeredOp(space: RegionDescription, layer: string, opId: string): boolean {
  for (const op of space.ops) {
    if (op.id !== opId) continue;
    if ('layer' in op && op.layer === layer) return true;
  }
  return false;
}

/** 값마다의 수 — 처음 나온 차례를 지킨다 (⑲ ⑳ 의 요약이 두 번 돌려도 같도록) */
function tally(values: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value.trim() === '' ? '(없음)' : value;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function renderTally(counts: ReadonlyMap<string, number>): string {
  const parts: string[] = [];
  for (const [key, count] of counts) parts.push(`${key} ${count}`);
  return parts.join(' · ');
}

/** 열셋이 함께 보는 것 — 한 번만 세어 나눠 쓴다 */
interface EcologyContext {
  input: CheckRegionsInput;
  ecology: CheckEcology;
  placements: readonly EcologyPlacement[];
  /** 아는 원천의 id */
  sourceIds: ReadonlySet<string>;
  /**
   * 아는 **탄생지**의 id (C022 ADDED).
   *
   * 자원 layer 에 서는 것이 둘이 되었다 — 원천과 탄생지다 (L2-World-Life §3.1: 탄생지는 재료를
   * 소비하고 잔여물을 낳으므로 원천과 같은 자리에 산다). ⑩ 과 ㉑ 이 묻는 것은 한 줄도 바뀌지
   * 않았다 — **자리를 얻은 이름을 세계가 아는가**이고, 세계가 아는 이름이 한 갈래 는 것뿐이다.
   * 생명 계통을 주지 않으면 이 집합이 비고, 그때의 답은 C021 까지와 한 값도 다르지 않다.
   */
  lifeSiteIds: ReadonlySet<string>;
  /** 아는 재료의 id */
  materialIds: ReadonlySet<string>;
  /** 검사가 아는 방의 id (input.regions) */
  regionIds: ReadonlySet<string>;
  connectorIds: ReadonlySet<string>;
}

/** ⑩ 배치의 이름이 아는 원천인가 */
function checkPlacementSource(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.placementSource;
  const layer = cx.input.contract.resourceLayer;
  if (cx.placements.length === 0) {
    return absentItem(head, `놓인 것이 없다 — ${layer} 0`);
  }
  const refs: CheckRef[] = [];
  let lifeSites = 0;
  for (const placement of cx.placements) {
    // C022 CHANGED — 이 layer 에 서는 것이 둘이 되었다. 탄생지의 이름도 세계가 아는 이름이므로
    // 모르는 이름으로 세지 않는다 (묻는 것은 그대로다 — 자리를 얻은 이름을 세계가 아는가).
    if (cx.lifeSiteIds.has(placement.tag)) {
      lifeSites++;
      continue;
    }
    if (!cx.sourceIds.has(placement.tag)) {
      refs.push({
        where: placement.region,
        detail: `${layer} ${placement.tag} 은 아는 원천도 탄생지도 아니다`,
      });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `배치 ${cx.placements.length} · 탄생지 ${lifeSites} · 모르는 이름 ${refs.length}`,
    refs,
  };
}

/** ⑪ 원천이 세계 원인과 재료를 가리키는가 — 재료의 원인도 함께 본다 */
function checkSourceRefs(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.sourceRefs;
  const { sources, materials } = cx.ecology;
  if (sources.length === 0 && materials.length === 0) {
    return absentItem(head, '원천도 재료도 없다');
  }
  const refs: CheckRef[] = [];
  for (const source of sources) {
    if (source.worldCause.trim() === '') {
      refs.push({ where: source.id, detail: '세계 원인을 가리키지 않는다' });
    }
    if (source.materialId.trim() === '') {
      refs.push({ where: source.id, detail: '재료를 가리키지 않는다' });
    } else if (!cx.materialIds.has(source.materialId)) {
      refs.push({ where: source.id, detail: `${source.materialId} 은 아는 재료가 아니다` });
    }
  }
  for (const material of materials) {
    if (material.worldCause.trim() === '') {
      refs.push({ where: material.id, detail: '세계 원인을 가리키지 않는다' });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `원천 ${sources.length} · 재료 ${materials.length} · 끊긴 참조 ${refs.length}`,
    refs,
  };
}

/** ⑫ 재료마다 자리를 얻은 원천이 하나 이상 있는가 */
function checkMaterialSource(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.materialSource;
  const { materials, sources } = cx.ecology;
  if (materials.length === 0) {
    return absentItem(head, '재료가 없다');
  }
  const placed = (source: CheckEcologySource): boolean => {
    if (!cx.regionIds.has(source.region)) return false;
    for (const placement of cx.placements) {
      if (placement.region === source.region && placement.tag === source.id) return true;
    }
    return false;
  };
  const refs: CheckRef[] = [];
  let seated = 0;
  for (const material of materials) {
    const mine = sources.filter((source) => source.materialId === material.id);
    const withSeat = mine.filter(placed);
    seated += withSeat.length;
    if (withSeat.length === 0) {
      refs.push({
        where: material.id,
        detail: `이 재료를 내는 원천 ${mine.length} 가운데 자리를 얻은 것이 없다`,
      });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `재료 ${materials.length} · 자리를 얻은 원천 ${seated} · 자리 없는 재료 ${refs.length}`,
    refs,
  };
}

/** ⑬ 원천에 공급 유형이 있는가 */
function checkSupplyMode(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.supplyMode;
  const { sources } = cx.ecology;
  if (sources.length === 0) return absentItem(head, '원천이 없다');
  const refs: CheckRef[] = [];
  for (const source of sources) {
    if (source.supply.trim() === '') {
      refs.push({ where: source.id, detail: '공급 유형이 비어 있다' });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `원천 ${sources.length} · 공급 유형 없는 원천 ${refs.length}`,
    refs,
  };
}

/** ⑭ 되돌아오는 원천에 되돌아옴의 원인이 있는가 */
function checkRecoveryCause(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.recoveryCause;
  const renewable = cx.ecology.sources.filter((source) => source.renewable);
  if (renewable.length === 0) return absentItem(head, '되돌아오는 원천이 없다');
  const refs: CheckRef[] = [];
  for (const source of renewable) {
    if (source.recoveryCause.trim() === '') {
      refs.push({ where: source.id, detail: '되돌아옴의 원인이 비어 있다' });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `되돌아오는 원천 ${renewable.length} · 원인 없는 원천 ${refs.length}`,
    refs,
  };
}

/** ⑮ 다 쓰면 끝나는 원천에 고갈의 결과가 있는가 */
function checkDepletion(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.depletion;
  const finite = cx.ecology.sources.filter((source) => source.finite);
  if (finite.length === 0) return absentItem(head, '다 쓰면 끝나는 원천이 없다');
  const refs: CheckRef[] = [];
  for (const source of finite) {
    if (source.depletionConsequence.trim() === '') {
      refs.push({ where: source.id, detail: '고갈의 결과가 비어 있다' });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `다 쓰면 끝나는 원천 ${finite.length} · 결과 없는 원천 ${refs.length}`,
    refs,
  };
}

/** ⑯ 원천에 흔적 참조가 있는가 */
function checkTraceRef(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.traceRef;
  const { sources } = cx.ecology;
  if (sources.length === 0) return absentItem(head, '원천이 없다');
  const refs: CheckRef[] = [];
  let total = 0;
  for (const source of sources) {
    total += source.traces.length;
    if (source.traces.length === 0) {
      refs.push({ where: source.id, detail: '흔적을 하나도 가리키지 않는다' });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `원천 ${sources.length} · 흔적 참조 합 ${total} · 참조 없는 원천 ${refs.length}`,
    refs,
  };
}

/** ⑰ 가리킨 흔적과 방이 실제로 있는가 */
function checkTraceValid(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.traceValid;
  const { sources } = cx.ecology;
  if (sources.length === 0) return absentItem(head, '원천이 없다');
  const layer = cx.input.contract.traceLayer;
  const byId = new Map<string, CheckRegion>();
  for (const region of cx.input.regions) byId.set(region.id, region);
  const refs: CheckRef[] = [];
  let total = 0;
  for (const source of sources) {
    total += source.traces.length;
    const region = byId.get(source.region);
    if (!region) {
      refs.push({ where: source.id, detail: `${source.region} 은 아는 방이 아니다` });
      continue;
    }
    for (const trace of source.traces) {
      if (!hasLayeredOp(region.space, layer, trace)) {
        refs.push({
          where: source.id,
          detail: `${trace} 이 ${source.region} 의 ${layer} op 로 없다`,
        });
      }
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `원천 ${sources.length} · 흔적 ${total} · 끊긴 참조 ${refs.length}`,
    refs,
  };
}

/** ⑱ 흐름의 양 끝 방·원천과 Connector 가 유효한가 */
function checkFlowValid(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.flowValid;
  const { flows } = cx.ecology;
  if (flows.length === 0) return absentItem(head, '흐름이 없다');
  const refs: CheckRef[] = [];
  for (const flow of flows) {
    const end = (side: 'from' | 'to'): void => {
      const { region, source } = flow[side];
      if (!cx.regionIds.has(region)) {
        refs.push({ where: flow.id, detail: `${side} 의 ${region} 은 아는 방이 아니다` });
      }
      if (!cx.sourceIds.has(source)) {
        refs.push({ where: flow.id, detail: `${side} 의 ${source} 은 아는 원천이 아니다` });
      }
    };
    end('from');
    end('to');
    if (!cx.connectorIds.has(flow.connector)) {
      refs.push({ where: flow.id, detail: `${flow.connector} 은 아는 Connector 가 아니다` });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `흐름 ${flows.length} · 끊긴 참조 ${refs.length}`,
    refs,
  };
}

/** ⑲ 기회 자리의 분포 — 판정하지 않는다 (편중은 사람이 본다) */
function checkOpportunity(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.opportunity;
  const { sources } = cx.ecology;
  if (sources.length === 0) return absentItem(head, '원천이 없다');
  const counts = tally(sources.map((source) => source.opportunity));
  return {
    ...head,
    status: 'report',
    answer: `원천 ${sources.length} · 자리 유형 ${counts.size} — ${renderTally(counts)}`,
    refs: sources.map((source) => ({
      where: source.region,
      detail: `${source.id} ${source.opportunity.trim() === '' ? '(없음)' : source.opportunity}`,
    })),
  };
}

/** ⑳ 방마다의 Carrier 유형 분포와 원천 수 — 판정하지 않는다 */
function checkCarrier(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.carrier;
  const { sources } = cx.ecology;
  // 계통이 밝힌 방을 먼저, 거기 없는데 원천이 선 방을 원천 차례로 뒤에 (결정론)
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const region of cx.ecology.regions) {
    if (seen.has(region.id)) continue;
    seen.add(region.id);
    rows.push(region.id);
  }
  for (const source of sources) {
    if (seen.has(source.region)) continue;
    seen.add(source.region);
    rows.push(source.region);
  }
  if (rows.length === 0) return absentItem(head, '밝힌 방도 원천도 없다');
  const kinds = new Set<string>();
  const refs: CheckRef[] = [];
  for (const row of rows) {
    const mine = sources.filter((source) => source.region === row);
    for (const source of mine) kinds.add(source.carrier.trim() === '' ? '(없음)' : source.carrier);
    const counts = tally(mine.map((source) => source.carrier));
    refs.push({
      where: row,
      detail: mine.length === 0 ? '원천 0' : `원천 ${mine.length} · ${renderTally(counts)}`,
    });
  }
  return {
    ...head,
    status: 'report',
    answer: `방 ${rows.length} · 원천 합 ${sources.length} · Carrier 유형 ${kinds.size}`,
    refs,
  };
}

/** ㉑ 원천 없는 배치와 재료 없는 원천 */
function checkOrphan(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.orphan;
  const { sources } = cx.ecology;
  if (cx.placements.length === 0 && sources.length === 0) {
    return absentItem(head, '배치도 원천도 없다');
  }
  const refs: CheckRef[] = [];
  let strayPlacements = 0;
  for (const placement of cx.placements) {
    if (cx.sourceIds.has(placement.tag)) continue;
    // C022 CHANGED — 탄생지의 자리는 원천이 없어도 외톨이가 아니다 (⑩ 과 같은 까닭).
    if (cx.lifeSiteIds.has(placement.tag)) continue;
    strayPlacements++;
    refs.push({ where: placement.region, detail: `배치 ${placement.tag} 에 원천도 탄생지도 없다` });
  }
  let strandedSources = 0;
  for (const source of sources) {
    if (source.materialId.trim() !== '' && cx.materialIds.has(source.materialId)) continue;
    strandedSources++;
    refs.push({ where: source.id, detail: '이 원천이 내는 재료가 없다' });
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `원천 없는 배치 ${strayPlacements} · 재료 없는 원천 ${strandedSources}`,
    refs,
  };
}

/** ㉒ 유입도 원천도 이유도 없는 방 */
function checkIsolation(cx: EcologyContext): CheckItem {
  const head = ECOLOGY_ITEMS.isolation;
  const declared = cx.ecology.regions;
  if (declared.length === 0) return absentItem(head, '계통이 밝힌 방이 없다');
  const refs: CheckRef[] = [];
  for (const region of declared) {
    const hasSource = cx.ecology.sources.some((source) => source.region === region.id);
    if (hasSource) continue;
    const hasInflow = cx.ecology.flows.some((flow) => flow.to.region === region.id);
    if (hasInflow) continue;
    if (region.isolationReason.trim() !== '') continue;
    refs.push({ where: region.id, detail: '원천도 유입 흐름도 없는데 그 이유가 적히지 않았다' });
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `밝힌 방 ${declared.length} · 이유 없는 고립 ${refs.length}`,
    refs,
  };
}

/** ⑩~㉒ — 계통을 주지 않으면 열셋이 전부 absent 다 (통과가 아니다) */
function ecologyItems(input: CheckRegionsInput): CheckItem[] {
  const ecology = input.ecology;
  if (!ecology) {
    return Object.values(ECOLOGY_ITEMS).map((head) =>
      absentItem(head, '재료 계통이 주어지지 않았다'),
    );
  }
  const cx: EcologyContext = {
    input,
    ecology,
    placements: resourcePlacements(input),
    sourceIds: new Set(ecology.sources.map((source) => source.id)),
    lifeSiteIds: new Set(input.contract.lifeSiteTags ?? []),
    materialIds: new Set(ecology.materials.map((material) => material.id)),
    regionIds: new Set(input.regions.map((region) => region.id)),
    connectorIds: new Set(input.graph.connectors.map((connector) => connector.id)),
  };
  return [
    checkPlacementSource(cx),
    checkSourceRefs(cx),
    checkMaterialSource(cx),
    checkSupplyMode(cx),
    checkRecoveryCause(cx),
    checkDepletion(cx),
    checkTraceRef(cx),
    checkTraceValid(cx),
    checkFlowValid(cx),
    checkOpportunity(cx),
    checkCarrier(cx),
    checkOrphan(cx),
    checkIsolation(cx),
  ];
}

// ── 검사 넷 — 시간이 세계에 거는 것 (C018 ADDED) ─────────────────────
//
// 검사 아홉(T1)이 방과 그래프를, 열셋(C014)이 그 위에 얹힌 재료 계통을 재었다면, 이 넷은
// **시각이 그 둘에 거는 것**을 잰다 — 철마다 방이 무엇으로 읽히고 · 무엇이 열리고 · 무엇이
// 서는가, 그리고 지나가는 것이 어느 방의 어느 선을 밟는가.
//
// 여기에도 **게임 명사가 없다.** 철의 이름도 낮밤의 이름도 경로 선이 사는 layer 도 기반은
// 알지 못한다 — `CheckTime` 이 어휘째로 준다 (L2-World-Time 원칙 T1 · T4 가 세운 규율).
// 그래서 이 넷은 철이 넷인 세계에도 열둘인 세계에도 그대로 선다.
//
// 시간 쪽 계약을 주지 않으면 넷이 전부 `absent` 다 — 잴 것이 없으면 통과로 적지 않는다.

/** 그 철에 이 방이 밝힌 덧씌움이 가리키는 op id 들 (㉓) */
export interface CheckTimePhase {
  region: string;
  season: string;
  depthAreaIds: readonly string[];
  hazardAreaIds: readonly string[];
}

/** 경로 하나 (㉔) — 마디마다 후보가 여럿일 수 있다 */
export interface CheckTimeRoute {
  id: string;
  presence: string;
  /** 마디 차례. 마디 하나는 후보 { 방 · 그 방에서 지나는 선의 tag } 들 */
  nodes: readonly (readonly { region: string; curve: string }[])[];
  /** 시간표의 철 목록. 빈 배열이면 철을 가리지 않는다 */
  seasons: readonly string[];
  /** 낮밤. 없으면 가리지 않는다 */
  dayPhase?: string;
  /** 몇 바퀴에 한 번인가 (1 이상) */
  everyNCycles: number;
  /** 지나는 동안 거는 덧씌움이 가리키는 area op id 들 — { 방 · op id } */
  effectAreas: readonly { region: string; areaId: string }[];
  /** 지나간 뒤 남기는 원천 id 들 */
  leaves: readonly string[];
}

/** 철 조건을 밝힌 문 (㉖) */
export interface CheckTimeConnector {
  id: string;
  from: string;
  to: string;
  seasons: readonly string[];
}

/** 철 조건을 밝힌 원천 (㉓ · ㉕) */
export interface CheckTimeSource {
  id: string;
  region: string;
  seasons: readonly string[];
}

/** ㉓~㉖ 이 볼 시간 쪽 계약 — 주지 않으면 넷 다 absent 다 */
export interface CheckTime {
  /** 이 세계의 철 어휘 (순서 그대로) */
  seasons: readonly string[];
  /** 이 세계의 낮밤 어휘 */
  dayPhases: readonly string[];
  /** 경로 선이 사는 layer 이름 */
  presenceLayer: string;
  phases: readonly CheckTimePhase[];
  routes: readonly CheckTimeRoute[];
  seasonalConnectors: readonly CheckTimeConnector[];
  seasonalSources: readonly CheckTimeSource[];
  /** 세계에 있는 원천 id 전부 (㉔ 의 leaves 참조 확인용) */
  sourceIds: readonly string[];
}

/** 넷의 번호·이름 — 이 차례가 곧 보고에 실리는 차례다 (계약이 없을 때의 absent 도 이것을 쓴다) */
const TIME_ITEMS = {
  phaseRefs: { mark: '㉓', id: 'time-phase-refs', name: '위상이 가리키는 area 와 원천' },
  routeRefs: { mark: '㉔', id: 'time-route-refs', name: '경로가 가리키는 방과 선' },
  seasonSummary: { mark: '㉕', id: 'time-season-summary', name: '철별 요약' },
  reachable: { mark: '㉖', id: 'time-reachable', name: '어느 철에도 갈 곳이 있는가' },
} as const;

/**
 * 그 방의 Description 에 이 id 의 op 가 있는가 (㉓ ㉔).
 *
 * ⑰ 의 `hasLayeredOp` 와 달리 layer 를 묻지 않는다 — 덧씌움이 가리키는 것은 깊이 area 와
 * 위험 area 둘인데 기반이 계약으로 받은 layer 이름은 위험 쪽 하나뿐이다. 한쪽만 layer 까지
 * 재면 같은 검사가 두 잣대를 쓰게 되므로, 여기서는 **가리킨 것이 그 방에 있는가**만 묻는다.
 */
function hasOp(space: RegionDescription, opId: string): boolean {
  for (const op of space.ops) {
    if (op.id === opId) return true;
  }
  return false;
}

/** 넷이 함께 보는 것 — 한 번만 세어 나눠 쓴다 */
interface TimeContext {
  input: CheckRegionsInput;
  time: CheckTime;
  /** 검사가 아는 방 — Description 을 함께 들고 있어야 op 와 곡선을 볼 수 있다 */
  regionById: ReadonlyMap<string, CheckRegion>;
  seasonIds: ReadonlySet<string>;
  dayPhaseIds: ReadonlySet<string>;
  sourceIds: ReadonlySet<string>;
}

/** ㉓ 위상이 가리키는 area 와 원천이 실제로 있는가 */
function checkTimePhaseRefs(cx: TimeContext): CheckItem {
  const head = TIME_ITEMS.phaseRefs;
  const { phases, seasonalSources } = cx.time;
  if (phases.length === 0 && seasonalSources.length === 0) {
    return absentItem(head, '철을 타는 방도 철 조건 원천도 없다');
  }
  const refs: CheckRef[] = [];
  let overlays = 0;
  for (const phase of phases) {
    const where = `${phase.region}/${phase.season}`;
    if (!cx.seasonIds.has(phase.season)) {
      refs.push({ where, detail: `${phase.season} 은 철 어휘에 없다` });
    }
    const region = cx.regionById.get(phase.region);
    if (!region) {
      refs.push({ where, detail: `${phase.region} 은 아는 방이 아니다` });
      continue;
    }
    for (const areaId of [...phase.depthAreaIds, ...phase.hazardAreaIds]) {
      overlays++;
      if (!hasOp(region.space, areaId)) {
        refs.push({ where, detail: `${areaId} 이 ${phase.region} 의 op 로 없다` });
      }
    }
  }
  for (const source of seasonalSources) {
    if (!cx.regionById.has(source.region)) {
      refs.push({ where: source.id, detail: `${source.region} 은 아는 방이 아니다` });
    }
    for (const season of source.seasons) {
      if (!cx.seasonIds.has(season)) {
        refs.push({ where: source.id, detail: `${season} 은 철 어휘에 없다` });
      }
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `위상 ${phases.length} · 덧씌움 ${overlays} · 철 조건 원천 ${seasonalSources.length} · 끊긴 참조 ${refs.length}`,
    refs,
  };
}

/** ㉔ 경로의 마디가 실제 방과 그 방의 경로 선을 지나며 시간표가 유효한가 */
function checkTimeRouteRefs(cx: TimeContext): CheckItem {
  const head = TIME_ITEMS.routeRefs;
  const { routes, presenceLayer } = cx.time;
  if (routes.length === 0) return absentItem(head, '경로가 없다');
  const refs: CheckRef[] = [];
  let nodes = 0;
  let candidates = 0;
  for (const route of routes) {
    // 마디 차례 — 마디 번호를 detail 에 적는다. 후보가 여럿이면 어느 후보인지도 함께
    for (let index = 0; index < route.nodes.length; index++) {
      nodes++;
      for (const candidate of route.nodes[index]!) {
        candidates++;
        const where = `${route.id}[${index}]`;
        const region = cx.regionById.get(candidate.region);
        if (!region) {
          refs.push({ where, detail: `${candidate.region} 은 아는 방이 아니다` });
          continue;
        }
        if (curvesOf(region.space, presenceLayer, candidate.curve).length === 0) {
          refs.push({
            where,
            detail: `${candidate.curve} 이 ${candidate.region} 의 ${presenceLayer} 곡선으로 없다`,
          });
        }
      }
    }
    for (const season of route.seasons) {
      if (!cx.seasonIds.has(season)) {
        refs.push({ where: route.id, detail: `${season} 은 철 어휘에 없다` });
      }
    }
    if (route.dayPhase !== undefined && !cx.dayPhaseIds.has(route.dayPhase)) {
      refs.push({ where: route.id, detail: `${route.dayPhase} 은 낮밤 어휘에 없다` });
    }
    // 바퀴 조건은 "몇 바퀴에 한 번" 이므로 1 이상의 정수다 — 0 이면 아무 바퀴에도 맞지 않고,
    // 소수면 바퀴를 셀 수가 없다
    if (!Number.isInteger(route.everyNCycles) || route.everyNCycles < 1) {
      refs.push({ where: route.id, detail: `바퀴 조건 ${route.everyNCycles} 은 1 이상의 정수가 아니다` });
    }
    for (const effect of route.effectAreas) {
      const region = cx.regionById.get(effect.region);
      if (!region) {
        refs.push({ where: route.id, detail: `덧씌움의 ${effect.region} 은 아는 방이 아니다` });
        continue;
      }
      if (!hasOp(region.space, effect.areaId)) {
        refs.push({
          where: route.id,
          detail: `덧씌움의 ${effect.areaId} 이 ${effect.region} 의 op 로 없다`,
        });
      }
    }
    for (const leaf of route.leaves) {
      if (!cx.sourceIds.has(leaf)) {
        refs.push({ where: route.id, detail: `남기는 ${leaf} 은 아는 원천이 아니다` });
      }
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `경로 ${routes.length} · 마디 ${nodes} · 후보 ${candidates} · 끊긴 참조 ${refs.length}`,
    refs,
  };
}

/** 이름 목록 한 토막 — 없으면 수만 적는다 (㉕ 의 한 줄이 길어지지 않도록) */
function namedGroup(label: string, names: readonly string[]): string {
  return names.length === 0 ? `${label} 0` : `${label} ${names.length} (${names.join(' · ')})`;
}

/** ㉕ 철별 요약 — 판정하지 않는다 (무엇이 열리고 서는지는 사람이 본다) */
function checkTimeSeasonSummary(cx: TimeContext): CheckItem {
  const head = TIME_ITEMS.seasonSummary;
  const { seasons, phases, seasonalConnectors, seasonalSources, routes } = cx.time;
  const phaseRegions = new Set(phases.map((phase) => phase.region));
  // 철 어휘 순서 그대로 한 줄씩 — 두 번 돌리면 같다
  const refs: CheckRef[] = seasons.map((season) => {
    const rooms = phases.filter((phase) => phase.season === season).map((phase) => phase.region);
    const doors = seasonalConnectors
      .filter((connector) => connector.seasons.includes(season))
      .map((connector) => `${connector.id} ${connector.from}→${connector.to}`);
    const springs = seasonalSources
      .filter((source) => source.seasons.includes(season))
      .map((source) => `${source.id}@${source.region}`);
    // 철을 가리지 않는 경로(seasons 가 빈 것)는 어느 철에도 돈다
    const passing = routes
      .filter((route) => route.seasons.length === 0 || route.seasons.includes(season))
      .map((route) => route.id);
    return {
      where: season,
      detail: [
        namedGroup('방', rooms),
        namedGroup('문', doors),
        namedGroup('원천', springs),
        namedGroup('경로', passing),
      ].join(' · '),
    };
  });
  return {
    ...head,
    status: 'report',
    answer:
      `철 ${seasons.length} · 철을 타는 방 ${phaseRegions.size} · 철 조건 문 ${seasonalConnectors.length}` +
      ` · 철 조건 원천 ${seasonalSources.length} · 경로 ${routes.length}`,
    refs,
  };
}

/** ㉖ 철마다 시작 방에서 닿는 방이 하나보다 많은가 */
function checkTimeReachable(cx: TimeContext): CheckItem {
  const head = TIME_ITEMS.reachable;
  const start = cx.input.contract.startRegion;
  if (start === undefined) return absentItem(head, '시작 방이 주어지지 않았다');
  const { seasons, seasonalConnectors } = cx.time;
  if (seasons.length === 0) return absentItem(head, '철 어휘가 없다');
  const graph = cx.input.graph;
  // 철에 닫히는 문이 하나도 없으면 어느 철에도 지금 세계와 같다 — 잴 것이 없는 것이 아니라
  // **어느 철에도 같다는 것이 답**이므로 absent 가 아니라 pass 다
  if (seasonalConnectors.length === 0) {
    return {
      ...head,
      status: 'pass',
      answer: `철 ${seasons.length} · 철 조건 문 0 — 어느 철에도 ${start} 에서 닿는 방 ${reachableRegions(graph, start).length}`,
      refs: [],
    };
  }
  const refs: CheckRef[] = [];
  let fewest = Number.POSITIVE_INFINITY;
  let fewestSeason = '';
  for (const season of seasons) {
    // 그 철에 닫히는 문을 뺀 그래프 — 조건을 밝히지 않은 문은 어느 철에도 열려 있다
    const shut = seasonalConnectors
      .filter((connector) => !connector.seasons.includes(season))
      .map((connector) => connector.id);
    const open = { ...graph, connectors: graph.connectors.filter((c) => !shut.includes(c.id)) };
    const reached = reachableRegions(open, start).length;
    if (reached < fewest) {
      fewest = reached;
      fewestSeason = season;
    }
    if (reached <= 1) {
      refs.push({
        where: season,
        detail: `${start} 에서 닿는 방이 ${reached} 뿐이다 (닫힌 문 ${shut.length}${shut.length > 0 ? ` — ${shut.join(' · ')}` : ''})`,
      });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `철 ${seasons.length} · 철 조건 문 ${seasonalConnectors.length} · 가장 적게 닿는 철 ${fewestSeason} ${fewest} · 갈 곳 없는 철 ${refs.length}`,
    refs,
  };
}

/** ㉓~㉖ — 시간 쪽 계약을 주지 않으면 넷이 전부 absent 다 (통과가 아니다) */
function timeItems(input: CheckRegionsInput): CheckItem[] {
  const time = input.time;
  if (!time) {
    return Object.values(TIME_ITEMS).map((head) => absentItem(head, '시간 쪽 계약이 주어지지 않았다'));
  }
  const regionById = new Map<string, CheckRegion>();
  for (const region of input.regions) regionById.set(region.id, region);
  const cx: TimeContext = {
    input,
    time,
    regionById,
    seasonIds: new Set(time.seasons),
    dayPhaseIds: new Set(time.dayPhases),
    sourceIds: new Set(time.sourceIds),
  };
  return [
    checkTimePhaseRefs(cx),
    checkTimeRouteRefs(cx),
    checkTimeSeasonSummary(cx),
    checkTimeReachable(cx),
  ];
}

// ── 검사 일곱 — 생명이 세계에 매달리는 자리 (C022 ADDED) ──────────────
//
// 아홉(T1)이 방과 그래프를, 열셋(C014)이 그 위의 재료 계통을, 넷(C018)이 시각이 거는 것을
// 재었다면, 이 일곱은 **무엇이 어디서 어떤 원인으로 태어나는가**를 잰다 — 탄생지가 가리키는
// 것들이 실제로 있는가 · 그 탄생이 세계 원인에 닿는가 · 전조와 소비를 가졌는가 ·
// 살아 있는 것을 전제한 회복 원인에 주인이 있는가 · 관계의 양 끝이 실재하는가.
// 분포 둘(㉚ ㉝)은 판정하지 않고 수만 적는다 — 많고 적음은 사람이 본다.
//
// 여기에도 **게임 명사가 없다.** 탄생 방식의 어휘도 개체군의 이름도 관계의 갈래도 기반은
// 알지 못한다 — `CheckLife` 가 구조로만 준다. 그래서 이 일곱은 탄생 방식이 넷인 세계에도
// 열둘인 세계에도 그대로 선다.
//
// 생명 계통을 주지 않으면 일곱이 전부 `absent` 다 — 잴 것이 없으면 통과로 적지 않는다.

/** 탄생지 하나 — 게임 명사 없이 구조만 (㉗ ㉘ ㉙ ㉚) */
export interface CheckLifeFormation {
  id: string;
  region: string;
  /** 탄생 방식 코드 — 기반은 어휘를 모른다 (㉚ 이 세기만 한다) */
  mode: string;
  /** 이 탄생이 매달린 세계 원인 — 비면 ㉘ */
  worldCause: string;
  /** 이 탄생을 일으키는 Region Rule id — 비거나 regionRules 에 없으면 ㉗ */
  regionRule: string;
  /** 재료로 가리킨 것들 — ecology.materials 에 없으면 ㉗ */
  sourceMaterialIds: readonly string[];
  /** 재료가 아닌 세계 상태로 가리킨 것들 — 판정하지 않는다 (수만 answer 에 적는다) */
  sourceStateCodes: readonly string[];
  /** 요구가 가리킨 원천 id 들 — ecology.sources 에 없으면 ㉗ */
  requiredSourceIds: readonly string[];
  /** 요구가 가리킨 개체군 id 들 — populations 에 없으면 ㉗ */
  requiredPopulationIds: readonly string[];
  /** 소비가 가리킨 원천 id 들 — 비면 ㉙ · 세계에 없으면 ㉗ */
  consumesSourceIds: readonly string[];
  /** 전조 흔적 op id 들 — 비면 ㉙ · 그 방 Description 에 없으면 ㉗ */
  traceOpIds: readonly string[];
  /** 이 탄생이 올리는 개체군 id — 비거나 populations 에 없으면 ㉗ */
  population: string;
}

/** 개체군 하나 — ㉛ ㉜ ㉝ 가 본다 */
export interface CheckLifePopulation {
  id: string;
  region: string;
}

/** 개체군 사이의 관계 하나 — ㉜ ㉝ 가 본다 */
export interface CheckLifeLink {
  from: string;
  to: string;
  kind: string;
  via?: string;
}

/** 회복 원인이 살아 있는 것을 전제하는 원천 하나 — ㉛ 이 본다. 어느 코드가 그런지는 계약이 고른다 */
export interface CheckLifeRecovery {
  sourceId: string;
  recoveryCause: string;
  /** 그 원천이 밝힌 개체군 id — 비었으면 무엇이 그것을 잇는지 세계가 말하지 않은 것이다 */
  population: string;
}

/** 탄생지가 하나도 없는 방과 그 사유 — ㉚ 이 함께 싣는다 (C024 ADDED) */
export interface CheckLifeAbsence {
  /** 그 방 */
  region: string;
  /** 왜 없는가 — 기반은 이 글자를 읽지 않고 그대로 옮긴다 */
  reason: string;
}

/** 이 세계의 생명 계통 — 검사 ㉗~㉝ 가 보는 전부 */
export interface CheckLife {
  formations: readonly CheckLifeFormation[];
  populations: readonly CheckLifePopulation[];
  links: readonly CheckLifeLink[];
  lifeRecoveries: readonly CheckLifeRecovery[];
  /** 세계가 아는 Region Rule id 들 (㉗) */
  regionRules: readonly string[];
  /** 개체군이 아닌 관계의 끝은 이것이어야 한다 — 잔류 원천 id 들 (㉜) */
  residueSourceIds: readonly string[];
  /** 탄생지가 없는 방이 밝힌 사유들 — 밝히지 않으면 ㉚ 은 지금 그대로다 (C024 ADDED) */
  absences?: readonly CheckLifeAbsence[];
}

/** 일곱의 번호·이름 — 이 차례가 곧 보고에 실리는 차례다 (계통이 없을 때의 absent 도 이것을 쓴다) */
const LIFE_ITEMS = {
  formationRefs: { mark: '㉗', id: 'life-formation-refs', name: '탄생지가 가리키는 것들' },
  worldCause: { mark: '㉘', id: 'life-world-cause', name: '원인 없는 탄생' },
  tracesConsumes: { mark: '㉙', id: 'life-traces-consumes', name: '전조와 소비 없는 탄생' },
  modeSpread: { mark: '㉚', id: 'life-mode-spread', name: '방마다의 탄생 방식 분포' },
  recoveryOwner: { mark: '㉛', id: 'life-recovery-owner', name: '주인 없는 회복 원인' },
  linkRefs: { mark: '㉜', id: 'life-link-refs', name: '관계의 양 끝과 이음' },
  linkSpread: { mark: '㉝', id: 'life-link-spread', name: '관계 없는 개체군' },
} as const;

/** 일곱이 함께 보는 것 — 한 번만 세어 나눠 쓴다 */
interface LifeContext {
  input: CheckRegionsInput;
  life: CheckLife;
  /** 검사가 아는 방 — Description 을 함께 들고 있어야 전조 op 를 볼 수 있다 */
  regionById: ReadonlyMap<string, CheckRegion>;
  populationIds: ReadonlySet<string>;
  regionRuleIds: ReadonlySet<string>;
  /** 재료 계통이 아는 원천·재료 — 계통을 주지 않으면 undefined 이고 그 갈래는 재지 않는다 */
  sourceIds?: ReadonlySet<string>;
  materialIds?: ReadonlySet<string>;
  residueSourceIds: ReadonlySet<string>;
  connectorIds: ReadonlySet<string>;
}

/** ㉗ 탄생지가 가리키는 것들이 다 세계에 있는가 — 방 · 규칙 · 재료 · 원천 · 개체군 · 전조 op */
function checkLifeFormationRefs(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.formationRefs;
  const { formations } = cx.life;
  if (formations.length === 0) return absentItem(head, '탄생지가 없다');
  const refs: CheckRef[] = [];
  let stateCodes = 0;
  for (const formation of formations) {
    const where = formation.id;
    const region = cx.regionById.get(formation.region);
    if (!region) {
      refs.push({ where, detail: `${formation.region} 은 아는 방이 아니다` });
    }
    if (formation.regionRule.trim() === '') {
      refs.push({ where, detail: 'Region Rule 을 가리키지 않는다' });
    } else if (!cx.regionRuleIds.has(formation.regionRule)) {
      refs.push({ where, detail: `${formation.regionRule} 은 아는 Region Rule 이 아니다` });
    }
    // 재료·원천 갈래는 재료 계통을 준 때만 잰다 (주지 않았으면 answer 가 그 자리를 적는다)
    if (cx.materialIds) {
      for (const materialId of formation.sourceMaterialIds) {
        if (!cx.materialIds.has(materialId)) {
          refs.push({ where, detail: `${materialId} 은 아는 재료가 아니다` });
        }
      }
    }
    if (cx.sourceIds) {
      for (const sourceId of formation.requiredSourceIds) {
        if (!cx.sourceIds.has(sourceId)) {
          refs.push({ where, detail: `요구가 가리킨 ${sourceId} 은 아는 원천이 아니다` });
        }
      }
      for (const sourceId of formation.consumesSourceIds) {
        if (!cx.sourceIds.has(sourceId)) {
          refs.push({ where, detail: `소비가 가리킨 ${sourceId} 은 아는 원천이 아니다` });
        }
      }
    }
    for (const populationId of formation.requiredPopulationIds) {
      if (!cx.populationIds.has(populationId)) {
        refs.push({ where, detail: `요구가 가리킨 ${populationId} 은 아는 개체군이 아니다` });
      }
    }
    // 전조 op 는 ㉓ 과 같은 잣대로 본다 — 그 방에 그 id 의 op 가 있는가 (layer 는 묻지 않는다)
    for (const opId of formation.traceOpIds) {
      if (!region) continue;
      if (!hasOp(region.space, opId)) {
        refs.push({ where, detail: `전조 ${opId} 이 ${formation.region} 의 op 로 없다` });
      }
    }
    if (formation.population.trim() === '') {
      refs.push({ where, detail: '올릴 개체군을 가리키지 않는다' });
    } else if (!cx.populationIds.has(formation.population)) {
      refs.push({ where, detail: `${formation.population} 은 아는 개체군이 아니다` });
    }
    stateCodes += formation.sourceStateCodes.length;
  }
  const unmeasured = cx.sourceIds ? '' : ' · 재료 계통이 없어 재료·원천 갈래는 재지 않았다';
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer:
      `탄생지 ${formations.length} · 개체군 ${cx.life.populations.length}` +
      ` · 세계 상태 요구 ${stateCodes} · 끊긴 참조 ${refs.length}${unmeasured}`,
    refs,
  };
}

/** ㉘ 모든 탄생이 그 방의 세계 원인에 닿는가 */
function checkLifeWorldCause(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.worldCause;
  const { formations } = cx.life;
  if (formations.length === 0) return absentItem(head, '탄생지가 없다');
  const refs: CheckRef[] = [];
  for (const formation of formations) {
    const where = formation.id;
    if (formation.worldCause.trim() === '') {
      refs.push({ where, detail: '세계 원인을 가리키지 않는다' });
      continue;
    }
    // 그 방의 원천들이 밝힌 원인 어휘 — 하나도 없는 방이면 비지 않은 것으로 족하다
    const causes = (cx.input.ecology?.sources ?? [])
      .filter((source) => source.region === formation.region)
      .map((source) => source.worldCause)
      .filter((cause) => cause.trim() !== '');
    if (causes.length === 0) continue;
    if (!causes.includes(formation.worldCause)) {
      refs.push({
        where,
        detail: `${formation.worldCause} 은 ${formation.region} 의 원천들이 밝힌 세계 원인이 아니다`,
      });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `탄생지 ${formations.length} · 원인이 닿지 않는 탄생 ${refs.length}`,
    refs,
  };
}

/** ㉙ 모든 탄생지가 전조와 소비를 하나 이상 가지는가 */
function checkLifeTracesConsumes(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.tracesConsumes;
  const { formations } = cx.life;
  if (formations.length === 0) return absentItem(head, '탄생지가 없다');
  const refs: CheckRef[] = [];
  let traces = 0;
  let consumes = 0;
  for (const formation of formations) {
    traces += formation.traceOpIds.length;
    consumes += formation.consumesSourceIds.length;
    if (formation.traceOpIds.length === 0) {
      refs.push({ where: formation.id, detail: '전조 흔적을 하나도 가지지 않는다' });
    }
    if (formation.consumesSourceIds.length === 0) {
      refs.push({ where: formation.id, detail: '소비하는 원천이 하나도 없다' });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `탄생지 ${formations.length} · 전조 합 ${traces} · 소비 합 ${consumes} · 걸린 것 ${refs.length}`,
    refs,
  };
}

/** ㉚ 방마다의 탄생 방식 분포 — 판정하지 않는다 (편중은 사람이 본다) */
function checkLifeModeSpread(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.modeSpread;
  const { formations } = cx.life;
  // 탄생지가 선 방을 처음 나온 차례로 (결정론 — ⑳ 의 어법)
  const rows: string[] = [];
  const seen = new Set<string>();
  for (const formation of formations) {
    if (seen.has(formation.region)) continue;
    seen.add(formation.region);
    rows.push(formation.region);
  }
  // 탄생지가 실제로 선 방의 사유는 싣지 않는다 — 모순된 글자를 옮기지 않되 그것으로 판정하지도 않는다
  const absences = (cx.life.absences ?? []).filter((absence) => !seen.has(absence.region));
  if (formations.length === 0 && absences.length === 0) return absentItem(head, '탄생지가 없다');
  const kinds = tally(formations.map((formation) => formation.mode));
  const refs: CheckRef[] = rows.map((row) => {
    const mine = formations.filter((formation) => formation.region === row);
    return {
      where: row,
      detail: `탄생지 ${mine.length} · ${renderTally(tally(mine.map((formation) => formation.mode)))}`,
    };
  });
  // 사유는 방들 뒤에 잇는다 — 준 차례 그대로 (결정론)
  for (const absence of absences) {
    refs.push({ where: absence.region, detail: `탄생지 0 — ${absence.reason}` });
  }
  const said = absences.length === 0 ? '' : ` · 사유를 밝힌 방 ${absences.length}`;
  const spread =
    formations.length === 0
      ? '방 0 · 탄생지 합 0'
      : `방 ${rows.length} · 탄생지 합 ${formations.length} · 방식 ${kinds.size} — ${renderTally(kinds)}`;
  return {
    ...head,
    status: 'report',
    answer: `${spread}${said}`,
    refs,
  };
}

/** ㉛ 살아 있는 것을 전제한 회복 원인에 주인이 있는가 */
function checkLifeRecoveryOwner(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.recoveryOwner;
  const rows = cx.life.lifeRecoveries;
  if (rows.length === 0) return absentItem(head, '생명을 전제하는 회복 원인이 없다');
  const refs: CheckRef[] = [];
  for (const row of rows) {
    const where = row.sourceId;
    if (row.population.trim() === '') {
      refs.push({ where, detail: `${row.recoveryCause} 이 무엇을 전제하는지 밝히지 않았다` });
      continue;
    }
    if (!cx.populationIds.has(row.population)) {
      refs.push({ where, detail: `${row.population} 은 아는 개체군이 아니다` });
      continue;
    }
    const born = cx.life.formations.some((formation) => formation.population === row.population);
    if (!born) {
      refs.push({ where, detail: `${row.population} 을 세우는 탄생지가 없다` });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `회복 원인 ${rows.length} · 주인 없는 것 ${refs.length}`,
    refs,
  };
}

/** ㉜ 관계의 양 끝과 이음이 실재하는가 */
function checkLifeLinkRefs(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.linkRefs;
  const { links } = cx.life;
  if (links.length === 0) return absentItem(head, '관계가 없다');
  const refs: CheckRef[] = [];
  for (const link of links) {
    const where = `${link.from}→${link.to}`;
    if (!cx.populationIds.has(link.from)) {
      refs.push({ where, detail: `${link.from} 은 아는 개체군이 아니다` });
    }
    if (!cx.populationIds.has(link.to)) {
      // 개체군이 아닌 끝은 잔류 원천이어야 한다 — 관계의 갈래 이름은 기반이 알지 못한다
      if (cx.sourceIds?.has(link.to) || cx.residueSourceIds.has(link.to)) {
        if (!cx.residueSourceIds.has(link.to)) {
          refs.push({ where, detail: `${link.to} 은 잔류 원천이 아니다` });
        }
      } else {
        refs.push({ where, detail: `${link.to} 은 아는 개체군도 잔류 원천도 아니다` });
      }
    }
    if (link.via !== undefined && !cx.connectorIds.has(link.via)) {
      refs.push({ where, detail: `이음 ${link.via} 은 아는 Connector 가 아니다` });
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `관계 ${links.length} · 끊긴 끝 ${refs.length}`,
    refs,
  };
}

/** ㉝ 관계 없는 개체군 · 받기만 하는 개체군 — 판정하지 않는다 */
function checkLifeLinkSpread(cx: LifeContext): CheckItem {
  const head = LIFE_ITEMS.linkSpread;
  const { populations, links } = cx.life;
  if (populations.length === 0) return absentItem(head, '개체군이 없다');
  let isolated = 0;
  let sinkOnly = 0;
  // 개체군 차례 그대로 한 줄씩 (결정론)
  const refs: CheckRef[] = populations.map((population) => {
    const out = links.filter((link) => link.from === population.id).length;
    const into = links.filter((link) => link.to === population.id).length;
    if (out === 0 && into === 0) isolated++;
    else if (out === 0) sinkOnly++;
    return {
      where: population.id,
      detail:
        out === 0 && into === 0
          ? `${population.region} · 관계 0`
          : `${population.region} · 나가는 관계 ${out} · 들어오는 관계 ${into}`,
    };
  });
  return {
    ...head,
    status: 'report',
    answer: `개체군 ${populations.length} · 관계 ${links.length} · 관계 없는 개체군 ${isolated} · 받기만 하는 개체군 ${sinkOnly}`,
    refs,
  };
}

/** ㉗~㉝ — 생명 계통을 주지 않으면 일곱이 전부 absent 다 (통과가 아니다) */
function lifeItems(input: CheckRegionsInput): CheckItem[] {
  const life = input.life;
  if (!life) {
    return Object.values(LIFE_ITEMS).map((head) => absentItem(head, '생명 계통이 주어지지 않았다'));
  }
  const regionById = new Map<string, CheckRegion>();
  for (const region of input.regions) regionById.set(region.id, region);
  const ecology = input.ecology;
  const cx: LifeContext = {
    input,
    life,
    regionById,
    populationIds: new Set(life.populations.map((population) => population.id)),
    regionRuleIds: new Set(life.regionRules),
    sourceIds: ecology ? new Set(ecology.sources.map((source) => source.id)) : undefined,
    materialIds: ecology ? new Set(ecology.materials.map((material) => material.id)) : undefined,
    residueSourceIds: new Set(life.residueSourceIds),
    connectorIds: new Set(input.graph.connectors.map((connector) => connector.id)),
  };
  return [
    checkLifeFormationRefs(cx),
    checkLifeWorldCause(cx),
    checkLifeTracesConsumes(cx),
    checkLifeModeSpread(cx),
    checkLifeRecoveryOwner(cx),
    checkLifeLinkRefs(cx),
    checkLifeLinkSpread(cx),
  ];
}
