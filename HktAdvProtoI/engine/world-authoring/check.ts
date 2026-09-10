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
import {
  CHANGE_QUALIFIER_MODES,
  CONDITION_OPERATORS,
  conditionLeaves,
  formatConditionLeaf,
  DEFERRED_TARGET_KINDS,
  SINGLETON_TARGET_KINDS,
  TIME_QUALIFIER_MODES,
  VALUELESS_OPERATORS,
  type Condition,
  type ConditionLeaf,
  type ConditionQueryKind,
  type ConditionTargetKind,
} from './condition';
import { areasOf, curvesOf, findPoint, pointsOf, type RegionDescription } from './description';
import {
  exitsOf,
  isFrontier,
  reachableRegions,
  reachableRegionsExcept,
  type ConnectorEnd,
  type RegionGraph,
} from './graph';
import { rasterSemantic } from './observe';
import {
  DECIDABLE_DISCOVERY_KINDS,
  DEFERRED_DISCOVERY_KINDS,
  formatOpportunity,
  isEventOpportunity,
  MUTATION_OPS,
  OPPORTUNITY_PROGRESS_KINDS,
  OPPORTUNITY_YIELD_KINDS,
  type Opportunity,
  type OpportunityAction,
  type OpportunityTargetKind,
} from './opportunity';
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
  /** 번호 — '①'…'㊼'. 번호 밖의 것은 '·' */
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
  /** ㉞~㊷ 이 볼 접근 쪽 계약 — 주지 않으면 그 아홉이 전부 absent 다 (ecology · time 의 선례 그대로) */
  access?: CheckAccess;
  /** ㊸ ㊼ 가 볼 기억 쪽 계약 — 주지 않으면 그 둘이 전부 absent 다 (ecology · time 의 선례 그대로) */
  memory?: CheckMemory;
  /** ㊹ 가 볼 조건 쪽 계약 — 주지 않으면 absent 다 (memory 의 선례 그대로) */
  condition?: CheckCondition;
  /** ㊺ ㊻ 이 볼 기회 쪽 계약 — 주지 않으면 그 둘이 전부 absent 다 (memory · condition 의 선례 그대로) */
  opportunity?: CheckOpportunity;
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
 * 검사 마흔일곱을 한 번에 돌린다 — 결과는 기계가 읽는다
 * (T1 의 아홉 + C014 의 열셋 + C018 의 넷 + C022 의 일곱 + C029 의 아홉 + C034 의 둘 +
 * C035 의 하나 + C036 의 둘).
 *
 * 순서는 언제나 ①~⑨ · ⑩~㉒ · ㉓~㉖ · ㉗~㉝ · ㉞~㊷ · ㊸ ㊼ · ㊹ · ㊺ ㊻ 이고, 각 항목의 refs 는 준
 * 배열 순서다 — 두 번 돌리면 같다.
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
    ...accessItems(input),
    ...memoryItems(input),
    ...conditionItems(input),
    ...opportunityItems(input),
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
  /**
   * 값을 **올리는** 관계의 갈래들 (C025 ADDED · ㉛).
   *
   * 기반은 관계의 갈래 이름을 알지 못하므로(㉜ 이 같은 규율을 적어 두었다) 어느 갈래가
   * 개체군을 세우는 쪽인지는 계약이 고른다. 밝히지 않으면 ㉛ 은 지금까지처럼 **탄생지만**
   * 묻는다 — 밝히지 않은 계약의 답이 한 글자도 달라지지 않는다.
   */
  raisingLinkKinds?: readonly string[];
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
  // 값을 올리는 관계의 갈래 — 계약이 고른다. 밝히지 않으면 빈 목록이고 탄생지만 묻는다.
  const raising = new Set(cx.life.raisingLinkKinds ?? []);
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
    // 그 개체군이 **세계 안에서 서는 길**이 있는가 — 둘 중 하나면 된다.
    //
    //   ① 그것을 낳는 탄생지가 있다
    //   ② 그것을 **값이 오르는 쪽으로 삼는 관계**가 있다 (C025 CHANGED)
    //
    // 둘째가 늘어난 까닭은 하나다 — 값이 오르는 길이 탄생 하나가 아니기 때문이다: 어떤
    // 개체군은 태어나지 않고 이웃에서 불려 온다. 탄생지로만 물으면 그런 개체군을 전제한
    // 회복 원인이 영원히 "주인 없음" 으로 걸려, 이 검사가 막으려던 구멍(무엇이 그것을
    // 잇는지 세계가 말하지 않는 자리)이 아니라 **멀쩡한 세계**를 잡는다.
    //
    // **어느 갈래가 값을 올리는지는 계약이 고른다** (`raisingLinkKinds`) — 기반은 관계의
    // 갈래 이름을 알지 못한다 (아래 ㉜ 가 같은 자리에서 그렇게 적어 두었다). 밝히지 않은
    // 계약에서는 이 물음이 서지 않고 지금까지처럼 탄생지 하나만 묻는다.
    const born = cx.life.formations.some((formation) => formation.population === row.population);
    const raised = cx.life.links.some(
      (link) => raising.has(link.kind) && link.to === row.population,
    );
    if (!born && !raised) {
      refs.push({ where, detail: `${row.population} 을 세우는 탄생지도 올리는 관계도 없다` });
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

// ── 검사 아홉 — 방이 묻는 것과 세계가 가진 답 (C029 ADDED) ───────────
//
// 검사 아홉(T1)이 방과 그래프를, 열셋(C014)이 그 위에 얹힌 재료 계통을, 넷(C018)이 시각이
// 거는 것을 재었다면, 이 아홉은 **방이 무엇을 묻고 세계가 그것에 답할 것을 가졌는가**를 잰다 —
// 요구가 어휘 안에 있는가 · 그 요구에 답할 성질의 원천이 그 요구를 지나지 않고 닿는가 ·
// 요구를 알아낼 흔적이 놓였는가, 그리고 그 답들이 한 축·한 방·한 종류에 몰려 있지 않은가.
//
// 여기에도 **게임 명사가 없다.** 어느 축이 무엇이고 어느 글자가 "답이 된다" 를 뜻하는지
// 기반은 알지 못한다 — `CheckAccess` 가 어휘째로 준다. 그래서 이 아홉은 축이 다섯인 세계에도
// 스물인 세계에도 그대로 선다. 접근 쪽 계약을 주지 않으면 아홉이 전부 `absent` 다.
//
// **㉟ 의 부정은 실패가 아니라 GAP 이다** — 잴 것(답의 원천)이 아직 놓이지 않은 것이므로
// `absent` 로 적고 통과로도 적지 않는다 (⑮ 의 선례). 종료 코드는 fail 하나가 정한다.
//
// "답이 된다" 는 `supportKind` 하나로 읽는다 — ㉟ 도 ㊱ ㊲ ㊴ ㊵ 도 그 kind 의 줄만 답으로 센다.
// 다른 kind(맞선다 · 드러낸다)가 무엇을 뜻하는지는 이 층이 판정하지 않는다.

/** 요구에 대해 성질이 하는 일 — kind 의 글자(SUPPORTS 등)는 컨텐츠의 것이다 */
export interface CheckAccessAnswerRule {
  requirement: string;
  property: string;
  kind: string;
}

/** Lock 의 요구 하나. property 면 "축:관계" 가 들어오고, 아니면 kind 만 있다 */
export interface CheckAccessRequirement {
  property?: string;
  kind: string;
}

export interface CheckAccessLock {
  id: string;
  /** 이 Lock 을 밝힌 방 */
  region: string;
  at: { kind: string; ref: string };
  important: boolean;
  requires: readonly CheckAccessRequirement[];
  /** 이 요구를 알아낼 흔적의 op id 들 */
  traces: readonly string[];
  /**
   * 그 Lock 을 무르게 하는 것들 — kind 는 answerKinds 의 하나, ref 는 그것의 이름 (C031 ADDED).
   *
   * 답이 Seed 로만 오지 않는다 — 세계가 이미 가진 것도 그 Lock 의 답으로 세어진다. ㊴ ㊵ 와
   * 열쇠 × 자물쇠 표가 **Seed 를 세던 그 자리에서 같은 규칙으로** 함께 센다 (새 셈법이 없다).
   * 비어 있으면 이 자리의 답은 C030 까지와 한 값도 다르지 않다.
   * **무르게 하는 것이 무엇인지 · 무엇을 얼마나 무르게 하는지는 이 층이 알지 못한다** —
   * 종류의 이름도 그것의 이름도 계약과 컨텐츠가 준다.
   */
  relaxations: readonly { kind: string; ref: string }[];
}

export interface CheckAccessSeedProperty {
  tag: string;
  from: string;
}

export interface CheckAccessSeed {
  id: string;
  /** 이 Seed 가 답의 어느 종류로 세어지는가 (㊴ 의 열 이름 하나) */
  answerKind: string;
  properties: readonly CheckAccessSeedProperty[];
}

/** 그 Seed 를 내는 원천이 실제로 선 자리 */
export interface CheckAccessSeedSource {
  seed: string;
  region: string;
  source: string;
}

/** ㉞~㊷ 이 볼 접근 쪽 계약 — 주지 않으면 아홉이 다 absent 다 */
export interface CheckAccess {
  aspects: readonly string[];
  relations: readonly string[];
  /** 성질 태그 "축:관계" 를 가르는 글자 */
  tagSeparator: string;
  /** 성질이 나올 수 있는 문장의 갈래들 — from 이 이 중 하나여야 한다 */
  statementKinds: readonly string[];
  /** ㊴ 이 세는 답의 종류들 — 차례가 곧 표의 열 차례다 */
  answerKinds: readonly string[];
  /** answers 의 kind 가운데 "답이 된다" 를 뜻하는 것 (㉟ 이 그것만 본다) */
  supportKind: string;
  /** at.kind 가 문을 뜻하는 값 */
  connectorLockKind: string;
  /** at.kind 가 자락을 뜻하는 값 */
  areaLockKind: string;
  answers: readonly CheckAccessAnswerRule[];
  locks: readonly CheckAccessLock[];
  seeds: readonly CheckAccessSeed[];
  seedSources: readonly CheckAccessSeedSource[];
}

/** 아홉의 번호·이름 — 이 차례가 곧 보고에 실리는 차례다 (계약이 없을 때의 absent 도 이것을 쓴다) */
const ACCESS_ITEMS = {
  refs: { mark: '㉞', id: 'access-refs', name: '성질과 자리의 참조' },
  answer: { mark: '㉟', id: 'access-answer', name: '요구에 답할 성질의 원천' },
  spread: { mark: '㊱', id: 'access-property-spread', name: '성질의 편중' },
  distance: { mark: '㊲', id: 'access-answer-distance', name: 'Lock 과 답 원천의 거리' },
  orphan: { mark: '㊳', id: 'access-orphan-property', name: '고아 성질과 안 쓰인 축' },
  answerKinds: { mark: '㊴', id: 'access-answer-kinds', name: '중요 Lock 의 답 종류별 수' },
  variety: { mark: '㊵', id: 'access-answer-variety', name: '답의 다양함' },
  trace: { mark: '㊶', id: 'access-trace', name: 'Lock 마다의 흔적' },
  behind: { mark: '㊷', id: 'access-behind-lock', name: 'Lock 뒤에만 있는 것' },
} as const;

/** 그 방의 Description 에 이 id 의 area op 이 있는가 (㉞ 의 자락 참조). layer 는 묻지 않는다 */
function hasAreaOp(space: RegionDescription, opId: string): boolean {
  for (const op of space.ops) {
    if (op.id === opId && op.kind === 'area') return true;
  }
  return false;
}

/** 성질 태그 "축:관계" 를 가른 것 — 갈리지 않으면 undefined (㉞ 이 그것을 걸린 것으로 적는다) */
function splitPropertyTag(
  tag: string,
  separator: string,
): { aspect: string; relation: string } | undefined {
  if (separator === '') return undefined;
  const parts = tag.split(separator);
  if (parts.length !== 2) return undefined;
  const aspect = parts[0] ?? '';
  const relation = parts[1] ?? '';
  if (aspect.trim() === '' || relation.trim() === '') return undefined;
  return { aspect, relation };
}

/** 아홉이 함께 보는 것 — 한 번만 세어 나눠 쓴다 */
interface AccessContext {
  input: CheckRegionsInput;
  access: CheckAccess;
  regionById: ReadonlyMap<string, CheckRegion>;
  connectorIds: ReadonlySet<string>;
  aspectIds: ReadonlySet<string>;
  relationIds: ReadonlySet<string>;
  statementKindIds: ReadonlySet<string>;
  /** property 를 밝힌 요구를 가진 Lock 들 (㉟ ㊲ 가 이것만 본다) — locks 차례 그대로 */
  propertyLocks: readonly CheckAccessLock[];
}

/** 아홉과 표가 함께 짓는 자리 — 둘이 같은 것을 보게 하려고 한 곳에 둔다 */
function accessContextOf(input: CheckRegionsInput, access: CheckAccess): AccessContext {
  const regionById = new Map<string, CheckRegion>();
  for (const region of input.regions) regionById.set(region.id, region);
  return {
    input,
    access,
    regionById,
    connectorIds: new Set(input.graph.connectors.map((connector) => connector.id)),
    aspectIds: new Set(access.aspects),
    relationIds: new Set(access.relations),
    statementKindIds: new Set(access.statementKinds),
    propertyLocks: access.locks.filter((lock) => propertyRequirements(lock).length > 0),
  };
}

/** 그 Lock 이 밝힌 성질 요구의 태그들 — requires 차례 그대로 */
function propertyRequirements(lock: CheckAccessLock): string[] {
  const out: string[] = [];
  for (const requirement of lock.requires) {
    if (requirement.property !== undefined) out.push(requirement.property);
  }
  return out;
}

/**
 * 그 Seed 가 그 요구에 "답이 된다" 로 내미는 성질 — 없으면 undefined.
 * properties 차례로 처음 걸리는 것 하나다 (둘이 답해도 그 Seed 는 한 번 선다).
 */
function answeringProperty(
  cx: AccessContext,
  seed: CheckAccessSeed,
  requirement: string,
): string | undefined {
  const { answers, supportKind } = cx.access;
  for (const property of seed.properties) {
    const helps = answers.some(
      (rule) =>
        rule.kind === supportKind &&
        rule.requirement === requirement &&
        rule.property === property.tag,
    );
    if (helps) return property.tag;
  }
  return undefined;
}

/** 그 요구에 "답이 된다" 로 이어지는 성질을 가진 Seed 들 — seeds 차례 그대로 */
function answeringSeeds(cx: AccessContext, requirement: string): CheckAccessSeed[] {
  const out: CheckAccessSeed[] = [];
  for (const seed of cx.access.seeds) {
    if (answeringProperty(cx, seed, requirement) !== undefined) out.push(seed);
  }
  return out;
}

/** 그 Seed 를 내는 원천이 실제로 선 자리들 — seedSources 차례 그대로 */
function sourcesOfSeed(cx: AccessContext, seedId: string): CheckAccessSeedSource[] {
  return cx.access.seedSources.filter((source) => source.seed === seedId);
}

/** 그 Lock 이 벽으로 놓을 이음들 — 문에 걸린 Lock 이면 그 문 하나, 아니면 없다 (㉟ ㊷) */
function blockedBy(cx: AccessContext, lock: CheckAccessLock): string[] {
  return lock.at.kind === cx.access.connectorLockKind ? [lock.at.ref] : [];
}

/** 문 하나로 이어진 이웃 방들 — 방향을 묻지 않는다 (㊶ 의 "이웃"). connectors 차례를 지킨다 */
function neighborRegions(graph: RegionGraph, regionId: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const connector of graph.connectors) {
    const { from, to } = connector;
    const other =
      from.region === regionId ? to.region : to.region === regionId ? from.region : undefined;
    if (other === undefined || other === regionId || seen.has(other)) continue;
    seen.add(other);
    out.push(other);
  }
  return out;
}

/** ㉞ 요구와 성질의 태그가 어휘에 있는가 · at.ref 가 실제 자리인가 · 태그가 문장 하나를 가리키는가 */
function checkAccessRefs(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.refs;
  const { locks, seeds, tagSeparator, connectorLockKind, areaLockKind } = cx.access;
  if (locks.length === 0 && seeds.length === 0) {
    return absentItem(head, 'Lock 도 Seed 도 없다');
  }
  const refs: CheckRef[] = [];
  // 어휘에 있는 태그인가 — 갈리지 않는 태그도 걸린 것이다
  const checkTag = (where: string, what: string, tag: string): void => {
    const split = splitPropertyTag(tag, tagSeparator);
    if (!split) {
      refs.push({ where, detail: `${what} ${tag} 이 ${tagSeparator} 로 갈리지 않는다` });
      return;
    }
    if (!cx.aspectIds.has(split.aspect)) {
      refs.push({ where, detail: `${what} ${tag} 의 축 ${split.aspect} 이 어휘에 없다` });
    }
    if (!cx.relationIds.has(split.relation)) {
      refs.push({ where, detail: `${what} ${tag} 의 관계 ${split.relation} 이 어휘에 없다` });
    }
  };

  let requirementCount = 0;
  for (const lock of locks) {
    for (const tag of propertyRequirements(lock)) {
      requirementCount++;
      checkTag(lock.id, '요구', tag);
    }
    // 걸린 자리 — 문이면 그 Connector 가, 자락이면 그 방의 area op 이 실제로 있어야 한다.
    // 그 둘이 아닌 kind 는 무엇을 찾을지 기반이 모르므로 묻지 않는다 (컨텐츠가 갈래를 늘릴 자리다)
    if (lock.at.kind === connectorLockKind) {
      if (!cx.connectorIds.has(lock.at.ref)) {
        refs.push({ where: lock.id, detail: `${lock.at.ref} 은 아는 Connector 가 아니다` });
      }
    } else if (lock.at.kind === areaLockKind) {
      const region = cx.regionById.get(lock.region);
      if (!region) {
        refs.push({ where: lock.id, detail: `${lock.region} 은 아는 방이 아니다` });
      } else if (!hasAreaOp(region.space, lock.at.ref)) {
        refs.push({
          where: lock.id,
          detail: `${lock.at.ref} 이 ${lock.region} 의 area op 로 없다`,
        });
      }
    }
  }

  let tagCount = 0;
  for (const seed of seeds) {
    for (const property of seed.properties) {
      tagCount++;
      checkTag(seed.id, '성질', property.tag);
      // 태그는 그 재료의 문장 하나를 가리킨다 — 없는 갈래를 가리키면 문장이 없는 성질이다
      if (!cx.statementKindIds.has(property.from)) {
        refs.push({
          where: seed.id,
          detail: `성질 ${property.tag} 의 ${property.from} 은 문장의 갈래가 아니다`,
        });
      }
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `Lock ${locks.length} · 성질 요구 ${requirementCount} · Seed ${seeds.length} · 성질 태그 ${tagCount} · 끊긴 참조 ${refs.length}`,
    refs,
  };
}

/**
 * ㉟ 성질 요구마다 답할 Seed 가 있고 그 원천이 그 Lock 을 지나지 않고 닿는가.
 *
 * 걸린 것을 `fail` 로 적지 않는다 — 답이 될 것이 아직 놓이지 않은 것은 **결손(GAP)** 이지
 * 어긋남이 아니다. 그래서 `absent` 로 적고 refs 로 무엇이 없는지 가리킨다.
 */
function checkAccessAnswer(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.answer;
  const start = cx.input.contract.startRegion;
  if (start === undefined) return absentItem(head, '시작 방이 주어지지 않았다');
  const locks = cx.propertyLocks;
  if (locks.length === 0) return absentItem(head, '성질을 요구하는 Lock 이 없다');

  const refs: CheckRef[] = [];
  let answered = 0;
  for (const lock of locks) {
    // 그 Lock 을 지나지 않고 닿는 방들 — 문에 걸리지 않은 Lock 은 벽으로 놓을 이음이 없다
    const reached = new Set(reachableRegionsExcept(cx.input.graph, start, blockedBy(cx, lock)));
    for (const requirement of propertyRequirements(lock)) {
      const seeds = answeringSeeds(cx, requirement);
      if (seeds.length === 0) {
        refs.push({
          where: lock.id,
          detail: `${requirement} 에 ${cx.access.supportKind} 인 성질을 가진 Seed 가 없다`,
        });
        continue;
      }
      const seated = seeds.filter((seed) =>
        sourcesOfSeed(cx, seed.id).some((source) => reached.has(source.region)),
      );
      if (seated.length === 0) {
        refs.push({
          where: lock.id,
          detail: `${requirement} 에 답할 Seed ${seeds.map((seed) => seed.id).join(' · ')} 의 원천이 ${start} 에서 이 Lock 을 지나지 않고 닿는 방에 없다`,
        });
        continue;
      }
      answered++;
    }
  }
  const total = locks.reduce((sum, lock) => sum + propertyRequirements(lock).length, 0);
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'absent',
    answer: `성질 Lock ${locks.length} · 성질 요구 ${total} · 답이 선 요구 ${answered} · GAP ${refs.length}`,
    refs,
  };
}

/** ㊱ 성질 하나가 답하는 Lock 의 수와 축별로 쓰인 태그 — 판정하지 않는다 (편중은 사람이 본다) */
function checkAccessSpread(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.spread;
  const { answers, supportKind, aspects, tagSeparator } = cx.access;
  // 답이 되는 성질 — answers 차례로 처음 나온 것만 (두 번 돌려도 같도록)
  const answering: string[] = [];
  for (const rule of answers) {
    if (rule.kind !== supportKind) continue;
    if (!answering.includes(rule.property)) answering.push(rule.property);
  }
  const lockCountOf = (property: string): number =>
    cx.access.locks.filter((lock) =>
      propertyRequirements(lock).some((requirement) =>
        answers.some(
          (rule) =>
            rule.kind === supportKind &&
            rule.requirement === requirement &&
            rule.property === property,
        ),
      ),
    ).length;

  const refs: CheckRef[] = [];
  let most = 0;
  let mostProperty = '';
  for (const property of answering) {
    const count = lockCountOf(property);
    if (count > most) {
      most = count;
      mostProperty = property;
    }
    refs.push({ where: property, detail: `답하는 Lock ${count}` });
  }
  // 쓰인 태그 — 요구 · 성질 · answers 의 양쪽에 나온 것 전부, 처음 나온 차례로
  const used: string[] = [];
  const use = (tag: string): void => {
    if (!used.includes(tag)) used.push(tag);
  };
  for (const lock of cx.access.locks) for (const tag of propertyRequirements(lock)) use(tag);
  for (const seed of cx.access.seeds) for (const property of seed.properties) use(property.tag);
  for (const rule of answers) {
    use(rule.requirement);
    use(rule.property);
  }
  for (const aspect of aspects) {
    const mine = used.filter((tag) => splitPropertyTag(tag, tagSeparator)?.aspect === aspect);
    refs.push({
      where: aspect,
      detail: mine.length === 0 ? '쓰인 태그 0' : `쓰인 태그 ${mine.length} (${mine.join(' · ')})`,
    });
  }
  return {
    ...head,
    status: 'report',
    answer:
      `답이 되는 성질 ${answering.length} · 가장 많이 답하는 성질 ` +
      `${most === 0 ? '(없음)' : `${mostProperty} ${most}`} · 쓰인 태그 ${used.length} / 축 ${aspects.length}`,
    refs,
  };
}

/** ㊲ Lock 의 방과 답 원천의 방이 같은가 다른가, 그리고 두 방의 depth 짝 — 판정하지 않는다 */
function checkAccessDistance(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.distance;
  const locks = cx.propertyLocks;
  const depthOf = (regionId: string): string => {
    const region = cx.regionById.get(regionId);
    if (!region) return '(모르는 방)';
    return region.depth.trim() === '' ? '(없음)' : region.depth;
  };
  const refs: CheckRef[] = [];
  let same = 0;
  let apart = 0;
  for (const lock of locks) {
    let mineSame = 0;
    let mineApart = 0;
    const pairs: string[] = [];
    for (const requirement of propertyRequirements(lock)) {
      for (const seed of answeringSeeds(cx, requirement)) {
        for (const source of sourcesOfSeed(cx, seed.id)) {
          if (source.region === lock.region) mineSame++;
          else mineApart++;
          pairs.push(`${depthOf(lock.region)}→${depthOf(source.region)}`);
        }
      }
    }
    same += mineSame;
    apart += mineApart;
    const counts = tally(pairs);
    refs.push({
      where: lock.id,
      detail:
        pairs.length === 0
          ? `답 원천 0 — 잴 거리가 없다 (${lock.region} ${depthOf(lock.region)})`
          : `답 원천 ${pairs.length} · 같은 방 ${mineSame} · 다른 방 ${mineApart} · depth ${renderTally(counts)}`,
    });
  }
  return {
    ...head,
    status: 'report',
    answer: `성질 Lock ${locks.length} · 답 원천 ${same + apart} · 같은 방 ${same} · 다른 방 ${apart}`,
    refs,
  };
}

/** ㊳ 요구가 없는 성질 · 가진 Seed 가 없는 성질 · 아무 데도 안 쓰인 축 — 판정하지 않는다 */
function checkAccessOrphan(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.orphan;
  const { answers, supportKind, aspects, tagSeparator } = cx.access;
  // 요구되는 성질 — Lock 이 곧바로 부른 태그와, 그 요구에 답이 되는 태그 (요구의 차례를 먼저)
  const required: string[] = [];
  const require_ = (tag: string): void => {
    if (!required.includes(tag)) required.push(tag);
  };
  const asked: string[] = [];
  for (const lock of cx.access.locks) {
    for (const tag of propertyRequirements(lock)) {
      if (!asked.includes(tag)) asked.push(tag);
      require_(tag);
    }
  }
  for (const rule of answers) {
    if (rule.kind !== supportKind) continue;
    if (asked.includes(rule.requirement)) require_(rule.property);
  }
  // Seed 가 가진 성질 — seeds 차례로 처음 나온 것만
  const held: string[] = [];
  const holders = new Map<string, string[]>();
  for (const seed of cx.access.seeds) {
    for (const property of seed.properties) {
      if (!held.includes(property.tag)) held.push(property.tag);
      const mine = holders.get(property.tag) ?? [];
      mine.push(seed.id);
      holders.set(property.tag, mine);
    }
  }

  const refs: CheckRef[] = [];
  const unasked = held.filter((tag) => !required.includes(tag));
  for (const tag of unasked) {
    refs.push({
      where: tag,
      detail: `Seed ${(holders.get(tag) ?? []).join(' · ')} 는 가졌으나 이것을 요구하는 Lock 이 없다`,
    });
  }
  const unheld = required.filter((tag) => !held.includes(tag));
  for (const tag of unheld) {
    refs.push({ where: tag, detail: '요구는 있으나 이것을 가진 Seed 가 없다' });
  }
  // 아무 데도 안 쓰인 축 — 요구에도 성질에도 answers 에도 그 축의 태그가 없다
  const usedTags: string[] = [...required, ...held];
  for (const rule of answers) usedTags.push(rule.requirement, rule.property);
  const idleAspects = aspects.filter(
    (aspect) => !usedTags.some((tag) => splitPropertyTag(tag, tagSeparator)?.aspect === aspect),
  );
  for (const aspect of idleAspects) {
    refs.push({ where: aspect, detail: '이 축의 태그가 아무 데도 쓰이지 않았다' });
  }
  return {
    ...head,
    status: 'report',
    answer: `요구 없는 성질 ${unasked.length} · Seed 없는 성질 ${unheld.length} · 안 쓰인 축 ${idleAspects.length} / ${aspects.length}`,
    refs,
  };
}

/**
 * 그 Lock 의 답이 된 것 하나 — 어느 종류로 · 무엇이 · 어느 성질로 답했고 그것이 어디 섰는가.
 *
 * 답의 갈래가 둘이 되었어도(Seed · 완화) 이 형은 하나다 (C031 CHANGED) — 세는 자리가 하나여야
 * ㊴ 의 수와 표의 칸 수가 정의상 같다.
 */
interface LockAnswer {
  /** 답의 종류 — access.answerKinds 의 하나 */
  kind: string;
  /** 그 답의 이름 — Seed 면 그 id, 완화면 무르게 하는 것의 이름(ref) */
  id: string;
  /**
   * 그 답이 이 Lock 에 내민 성질 — Seed 는 처음 걸린 요구의 것이고, **완화는 빈 글자다**.
   * 완화는 성질로 답하는 것이 아니기 때문이다 — 요구를 채우는 것이 아니라 무르게 할 뿐이다.
   */
  property: string;
  /** 그 답이 선 방들 — Seed 면 그 원천이 선 방들, 완화면 그 Lock 을 밝힌 방 하나 */
  regions: readonly string[];
}

/**
 * 그 Lock 의 답이 된 것들 — 요구 차례 · seeds 차례이고 한 Seed 는 한 번만 선다.
 * 그 뒤에 **그 Lock 을 무르게 하는 것들**이 relaxations 차례로 선다 (C031 CHANGED).
 * 원천이 선 Seed 만 답이다 (씨만 있고 자리를 얻지 못한 것은 아직 답이 아니다).
 *
 * ㊴ ㊵ 와 열쇠 × 자물쇠 표(R4)가 **이 하나를 부른다** — 답을 고르는 자리가 둘이면
 * 같은 답을 둘로 세고 보고가 갈린다.
 */
function answersOfLock(cx: AccessContext, lock: CheckAccessLock): LockAnswer[] {
  const out: LockAnswer[] = [];
  const counted = new Set<string>();
  for (const requirement of propertyRequirements(lock)) {
    for (const seed of answeringSeeds(cx, requirement)) {
      if (counted.has(seed.id)) continue;
      const sources = sourcesOfSeed(cx, seed.id);
      if (sources.length === 0) continue;
      counted.add(seed.id);
      out.push({
        kind: seed.answerKind,
        id: seed.id,
        property: answeringProperty(cx, seed, requirement) ?? '',
        regions: sourceRegions(sources),
      });
    }
  }
  // 무르게 하는 것도 답이다 — 같은 것을 두 번 밝혀도 한 번만 선다 (Seed 의 규율 그대로).
  // 그 자리는 **그 Lock 을 밝힌 방**이다 — 무르게 하는 것은 그 방이 이미 가진 것이기 때문이다.
  const relaxed = new Set<string>();
  for (const relaxation of lock.relaxations) {
    const key = `${relaxation.kind}\u0000${relaxation.ref}`;
    if (relaxed.has(key)) continue;
    relaxed.add(key);
    out.push({ kind: relaxation.kind, id: relaxation.ref, property: '', regions: [lock.region] });
  }
  return out;
}

/** 중요 Lock 하나의 답을 종류별로 센 것 — answerKinds 차례가 곧 열의 차례다 (㊴ ㊵ 가 함께 쓴다) */
function answerKindCounts(cx: AccessContext, lock: CheckAccessLock): number[] {
  const counts = cx.access.answerKinds.map(() => 0);
  for (const answer of answersOfLock(cx, lock)) {
    const column = cx.access.answerKinds.indexOf(answer.kind);
    if (column >= 0) counts[column] = (counts[column] ?? 0) + 1;
  }
  return counts;
}

/** ㊴ 중요 Lock 마다 답의 종류별 수 — 판정하지 않는다 (한 종류뿐인 것은 사람이 본다) */
function checkAccessAnswerKinds(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.answerKinds;
  const important = cx.access.locks.filter((lock) => lock.important);
  const kinds = cx.access.answerKinds;
  const refs: CheckRef[] = [];
  let total = 0;
  for (const lock of important) {
    const counts = answerKindCounts(cx, lock);
    total += counts.reduce((sum, n) => sum + n, 0);
    refs.push({
      where: lock.id,
      detail: kinds.map((kind, index) => `${kind} ${counts[index] ?? 0}`).join(' · '),
    });
  }
  return {
    ...head,
    status: 'report',
    answer: `중요 Lock ${important.length} / ${cx.access.locks.length} · 답의 종류 ${kinds.length} · 답 합 ${total}`,
    refs,
  };
}

/** ㊵ 중요 Lock 마다 종류가 다른 답의 수 — 같은 종류의 복제는 하나로 읽힌다. 판정하지 않는다 */
function checkAccessVariety(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.variety;
  const important = cx.access.locks.filter((lock) => lock.important);
  const kinds = cx.access.answerKinds;
  const refs: CheckRef[] = [];
  let single = 0;
  let none = 0;
  for (const lock of important) {
    const counts = answerKindCounts(cx, lock);
    const filled = kinds.filter((_, index) => (counts[index] ?? 0) > 0);
    if (filled.length === 0) none++;
    else if (filled.length === 1) single++;
    refs.push({
      where: lock.id,
      detail:
        filled.length === 0
          ? `종류가 다른 답 0 / ${kinds.length}`
          : `종류가 다른 답 ${filled.length} / ${kinds.length} (${filled.join(' · ')})`,
    });
  }
  return {
    ...head,
    status: 'report',
    answer: `중요 Lock ${important.length} · 답이 없는 Lock ${none} · 한 종류뿐인 Lock ${single}`,
    refs,
  };
}

/**
 * ㊶ 모든 Lock 에 흔적이 하나 이상 있고, 그 op 이 그 방이나 이웃 방에 실제로 놓였는가.
 *
 * layer 는 묻지 않는다 — 흔적은 layer 하나에 갇히지 않는다 (문 앞의 자락과 식물이 다른 layer 에
 * 산다). ⑰ 이 layer 까지 묻는 것과 다른 이유가 이것이다.
 */
function checkAccessTrace(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.trace;
  const { locks } = cx.access;
  if (locks.length === 0) return absentItem(head, 'Lock 이 없다');
  const refs: CheckRef[] = [];
  let total = 0;
  let bare = 0;
  for (const lock of locks) {
    total += lock.traces.length;
    if (lock.traces.length === 0) {
      bare++;
      refs.push({ where: lock.id, detail: '이 요구를 알아낼 흔적을 하나도 가리키지 않는다' });
      continue;
    }
    const rooms = [lock.region, ...neighborRegions(cx.input.graph, lock.region)];
    for (const trace of lock.traces) {
      const found = rooms.some((room) => {
        const region = cx.regionById.get(room);
        return region ? hasOp(region.space, trace) : false;
      });
      if (!found) {
        refs.push({
          where: lock.id,
          detail: `${trace} 이 ${lock.region} 에도 그 이웃에도 op 로 없다`,
        });
      }
    }
  }
  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `Lock ${locks.length} · 흔적 ${total} · 흔적 없는 Lock ${bare} · 끊긴 참조 ${refs.length - bare}`,
    refs,
  };
}

/** ㊷ 그 문을 벽으로 놓으면 닿지 못하게 되는 방들과 거기 있는 것 — 판정하지 않는다 */
function checkAccessBehind(cx: AccessContext): CheckItem {
  const head = ACCESS_ITEMS.behind;
  const start = cx.input.contract.startRegion;
  if (start === undefined) return absentItem(head, '시작 방이 주어지지 않았다');
  const { locks, connectorLockKind } = cx.access;
  // 문에 걸린 Lock 의 문마다 한 줄 — 같은 문에 Lock 이 둘이면 한 줄에 함께 적는다 (locks 차례)
  const doors: string[] = [];
  const lockedBy = new Map<string, string[]>();
  for (const lock of locks) {
    if (lock.at.kind !== connectorLockKind) continue;
    if (!doors.includes(lock.at.ref)) doors.push(lock.at.ref);
    const mine = lockedBy.get(lock.at.ref) ?? [];
    mine.push(lock.id);
    lockedBy.set(lock.at.ref, mine);
  }
  if (doors.length === 0) return absentItem(head, '문에 걸린 Lock 이 없다');

  const open = new Set(reachableRegions(cx.input.graph, start));
  const refs: CheckRef[] = [];
  let lost = 0;
  let dead = 0;
  for (const door of doors) {
    const shut = new Set(reachableRegionsExcept(cx.input.graph, start, [door]));
    const behind = [...open].filter((region) => !shut.has(region));
    lost += behind.length;
    const springs = cx.access.seedSources.filter((source) => behind.includes(source.region));
    // 그 방들에서 나가는 문 — 벽으로 놓은 그 문은 빼고 센다
    const exits = new Set<string>();
    for (const region of behind) {
      for (const exit of exitsOf(cx.input.graph, region)) {
        if (exit.connector.id !== door) exits.add(exit.connector.id);
      }
    }
    if (behind.length === 0) dead++;
    refs.push({
      where: door,
      detail:
        `Lock ${(lockedBy.get(door) ?? []).join(' · ')} · ` +
        (behind.length === 0
          ? '뒤에만 있는 방이 없다 — 이 문을 막아도 닿는 곳이 그대로다'
          : `뒤의 방 ${behind.length} (${behind.join(' · ')}) · 원천 ${springs.length}${springs.length > 0 ? ` (${springs.map((s) => s.source).join(' · ')})` : ''} · 나가는 문 ${exits.size}`),
    });
  }
  return {
    ...head,
    status: 'report',
    answer: `Lock 이 걸린 문 ${doors.length} · 뒤의 방 합 ${lost} · 뒤가 비어 있는 문 ${dead}`,
    refs,
  };
}

/** ㉞~㊷ — 접근 쪽 계약을 주지 않으면 아홉이 전부 absent 다 (통과가 아니다) */
function accessItems(input: CheckRegionsInput): CheckItem[] {
  const access = input.access;
  if (!access) {
    return Object.values(ACCESS_ITEMS).map((head) =>
      absentItem(head, '접근 쪽 계약이 주어지지 않았다'),
    );
  }
  const cx = accessContextOf(input, access);
  return [
    checkAccessRefs(cx),
    checkAccessAnswer(cx),
    checkAccessSpread(cx),
    checkAccessDistance(cx),
    checkAccessOrphan(cx),
    checkAccessAnswerKinds(cx),
    checkAccessVariety(cx),
    checkAccessTrace(cx),
    checkAccessBehind(cx),
  ];
}

// ── 열쇠 × 자물쇠 — Lock 마다의 답과 그 원천이 선 방 (C030 ADDED · R4) ───────────
//
// 검사 ㉟ ㊴ 이 **이미 세는 것**을 행과 열로 낸다. 판정하지 않는다 — status 도 pass/fail 도
// 내지 않고 수와 이름을 적을 뿐이다 (요약 여섯의 어법 그대로).
//
// 여기에도 게임 명사가 없다 — 아홉이 받는 그 계약(`CheckAccess`)을 그대로 받는다.
// 답을 고르는 자리는 `answersOfLock` 하나이고 ㊴ ㊵ 도 그것을 부른다 — 같은 답을
// 도구가 둘로 세면 보고가 거짓말을 한다.

/** 열쇠 × 자물쇠 — Lock 하나가 한 행, 답의 종류가 열, 칸은 답이 된 것과 그 원천이 선 방들 */
export interface AccessAnswerCell {
  /** 답의 종류 (CheckAccess.answerKinds 의 하나) */
  kind: string;
  /**
   * 그 종류로 답이 된 것들 — Seed 이거나 그 Lock 을 무르게 하는 것이다 (C031 CHANGED).
   * 완화의 property 는 빈 글자다 — 성질로 답하는 것이 아니기 때문이다.
   */
  answers: readonly { id: string; property: string; regions: readonly string[] }[];
}

export interface AccessAnswerRow {
  lock: string;
  region: string;
  important: boolean;
  /** 그 Lock 이 묻는 성질들 — property 요구가 없으면 빈 목록이다 */
  requirements: readonly string[];
  /** answerKinds 차례 그대로 — 답이 없는 종류도 빈 칸으로 선다 (열이 있다는 것이 약속이다) */
  cells: readonly AccessAnswerCell[];
}

/** 그 원천들이 선 방들 — seedSources 차례 그대로이고 같은 방은 한 번만 선다 */
function sourceRegions(sources: readonly CheckAccessSeedSource[]): string[] {
  const out: string[] = [];
  for (const source of sources) {
    if (!out.includes(source.region)) out.push(source.region);
  }
  return out;
}

/**
 * 검사 ㉟ ㊴ 이 이미 세는 것을 **행과 열로** 낸다 — 판정하지 않는다.
 * 계약(access)이 없으면 빈 목록이다.
 *
 * 차례는 `access.locks` · `answerKinds` · 준 배열의 차례다 — 두 번 돌리면 글자까지 같다.
 */
export function accessAnswerMap(input: CheckRegionsInput): AccessAnswerRow[] {
  const access = input.access;
  if (!access) return [];
  const cx = accessContextOf(input, access);
  return access.locks.map((lock) => {
    const answers = answersOfLock(cx, lock);
    return {
      lock: lock.id,
      region: lock.region,
      important: lock.important,
      requirements: propertyRequirements(lock),
      // 답이 없는 종류도 빈 칸으로 선다 — 열이 있다는 것 자체가 표의 약속이다
      cells: access.answerKinds.map((kind) => ({
        kind,
        answers: answers
          .filter((answer) => answer.kind === kind)
          .map((answer) => ({
            id: answer.id,
            property: answer.property,
            regions: answer.regions,
          })),
      })),
    };
  });
}

// ── 검사 둘 — 방이 세는 것과 남는 것 (C034 ADDED) ─────────────────────
//
// 앞의 마흔둘이 방과 그래프 · 그 위의 재료 계통 · 시각이 거는 것 · 태어나는 자리 · 방이 묻는
// 것을 재었다면, 이 둘은 **방이 세는 것**을 잰다 — 세어질 수 있는 키(원천 · 경로 · 탄생지)가
// 실제 세계의 것인가(㊸), 그리고 State 마다 무엇이 그것을 지우는가(㊼).
//
// ㊸ 가 **양쪽으로** 재는 까닭 — 한쪽만 재면 둘 중 하나를 놓친다. 없는 것을 가리키는 키는
// 지워지지 않는 셈이 유령을 가리키게 두고(기억은 지워지지 않으므로 그 유령도 지워지지 않는다),
// 있는데 자리가 없는 것은 **셀 수 없는 일**을 세계에 남긴다. 둘 다 데이터의 결손이다.
//
// ㊼ 는 판정하지 않는다 — State 필드 전부가 표에 있는지는 밖에서 알 길이 없고(그것은 형이
// 붙든다), 지우는 손의 배분이 옳은지는 사람이 본다. 요약 여섯(⑲ ⑳ ㉕ ㉜ ㊵ ㊷)의 어법 그대로다.
//
// 여기에도 **게임 명사가 없다.** 어느 방이 무엇을 세는지도, 지우는 손이 몇이고 무엇인지도
// 기반은 알지 못한다 — `CheckMemory` 가 어휘째로 준다. 기억 쪽 계약을 주지 않으면 둘 다
// `absent` 다 (잴 것이 없으면 통과로 적지 않는다 — T1 의 규율).

/** 그 방의 기억이 가질 수 있는 키 — 컨텐츠가 건넨다 (㊸) */
export interface CheckMemoryRegion {
  id: string;
  /** 기억이 셀 원천 키들 */
  sources: readonly string[];
  /** 기억이 셀 경로 키들 */
  routes: readonly string[];
  /** 기억이 셀 탄생지 키들 — 밝히지 않으면 세는 자리가 없는 것이다 (빈 것으로 견준다) */
  formations?: readonly string[];
}

/** State 경로 하나와 그것을 지우는 손 (㊼) */
export interface CheckPersistenceRow {
  path: string;
  eraser: string;
}

/** ㊸ ㊼ 가 볼 기억 쪽 계약 — 주지 않으면 둘 다 absent 다 */
export interface CheckMemory {
  regions: readonly CheckMemoryRegion[];
  persistence: readonly CheckPersistenceRow[];
  /** 지우는 손의 어휘 (다섯) — 이 목록 밖의 것은 ㊼ 가 "모르는 손" 으로 적는다 */
  erasers: readonly string[];
  /**
   * 이 세계의 **탄생지** id 목록 — ㊸ 이 태어남의 키를 이것에 견준다.
   *
   * C038 CHANGED — 이것은 이제 **생명 계통이 없을 때의 잣대**다. 계통(`CheckRegionsInput.life`)을
   * 주면 ㊸ 은 그 계통이 말하는 방마다의 탄생지로 원천 · 경로와 **같은 잣대**를 양쪽으로 재고
   * (그때 이 목록은 읽지 않는다), 계통도 이 목록도 없으면 태어남 키는 재지 않는다 (수만 세고
   * 견주지 않는다) — 없는 계약을 거짓으로 읽지 않는 어법 그대로다.
   */
  formations?: readonly string[];
}

/** 둘의 번호·이름 — 이 차례가 곧 보고에 실리는 차례다 (계약이 없을 때의 absent 도 이것을 쓴다) */
const MEMORY_ITEMS = {
  refs: { mark: '㊸', id: 'memory-refs', name: '기억이 가리키는 원천과 경로와 탄생지' },
  persistence: { mark: '㊼', id: 'persistence-summary', name: '남는 것의 종류와 기억의 크기' },
} as const;

/** 둘이 함께 보는 것 — 한 번만 세어 나눠 쓴다 */
interface MemoryContext {
  input: CheckRegionsInput;
  memory: CheckMemory;
  /** 검사가 아는 방 */
  regionIds: ReadonlySet<string>;
  /** 그 방에 실제로 선 원천들 — ecology 를 주지 않으면 undefined 이고 그때 원천 쪽은 재지 않는다 */
  sourcesByRegion?: ReadonlyMap<string, readonly string[]>;
  /** 아는 원천 id 전부 — 유령이 "남의 방 것" 인지 "없는 것" 인지 가른다 */
  sourceIds?: ReadonlySet<string>;
  /** 그 방을 지나는 경로들 — time 을 주지 않으면 undefined 이고 그때 경로 쪽은 재지 않는다 */
  routesByRegion?: ReadonlyMap<string, readonly string[]>;
  /** 아는 경로 id 전부 */
  routeIds?: ReadonlySet<string>;
  /**
   * 그 방에 선 탄생지들 — 생명 계통을 주지 않으면 undefined 이고 그때 태어남의 뒷면도
   * 앞면의 방 대조도 재지 않는다 (원천 · 경로와 같은 규율 · C038 ADDED)
   */
  formationsByRegion?: ReadonlyMap<string, readonly string[]>;
  /** 아는 탄생지 id 전부 — 유령이 "남의 방 것" 인지 "없는 것" 인지 가른다 */
  formationIds?: ReadonlySet<string>;
}

/**
 * 방마다 그 방에 선 원천들 — ecology.sources 의 차례를 지킨다 (두 번 돌리면 같다).
 * 원천이 어느 방의 것인지는 계통이 이미 말한다(`CheckEcologySource.region`) — 여기서 다시 고르지 않는다.
 */
function memorySourcesByRegion(ecology: CheckEcology): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const source of ecology.sources) {
    const mine = out.get(source.region) ?? [];
    mine.push(source.id);
    out.set(source.region, mine);
  }
  return out;
}

/**
 * 방마다 그 방을 지나는 경로들 — time.routes 의 차례를 지킨다.
 *
 * "지난다" 는 마디의 **후보**로 그 방이 적혀 있는가다 (㉔ 이 읽는 그 nodes). 어느 후보가
 * 뽑히는지는 실주행이 정하므로, 기억이 셀 자리는 뽑힐 수 있는 방 전부에 있어야 한다.
 */
function memoryRoutesByRegion(time: CheckTime): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const route of time.routes) {
    const seen = new Set<string>();
    for (const node of route.nodes) {
      for (const candidate of node) {
        if (seen.has(candidate.region)) continue;
        seen.add(candidate.region);
        const mine = out.get(candidate.region) ?? [];
        mine.push(route.id);
        out.set(candidate.region, mine);
      }
    }
  }
  return out;
}

/**
 * 방마다 그 방에 선 탄생지들 — life.formations 의 차례를 지킨다 (두 번 돌리면 같다).
 * 탄생지가 어느 방의 것인지는 생명 계통이 이미 말한다(`CheckLifeFormation.region`) —
 * 여기서 다시 고르지 않는다 (원천의 `memorySourcesByRegion` 과 같은 어법 · C038 ADDED).
 */
function memoryFormationsByRegion(life: CheckLife): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const formation of life.formations) {
    const mine = out.get(formation.region) ?? [];
    mine.push(formation.id);
    out.set(formation.region, mine);
  }
  return out;
}

/**
 * ㊸ 기억이 가질 키가 실제 원천 · 경로 · 탄생지이고, 그 역도 참인가 — 양방향.
 *
 * 앞의 잣대(유령)는 `memory.regions` 차례로, 뒤의 잣대(셀 수 없는 것)는 `input.regions`
 * 차례로 잰다 — 뒤를 방마다 재는 까닭은 **기억 자리가 아예 없는 방**도 그 방의 원천을 셀 수
 * 없기 때문이다 (기억은 모든 방에 서는 것이므로 목록에서 빠진 방은 빠진 만큼 걸린다).
 *
 * C038 CHANGED — 태어남의 키도 **양쪽으로** 잰다. 앞선 주석은 "탄생지가 어느 방의 것인가를
 * 계약이 주지 않는다" 고 적었으나 그것은 사실이 아니었다: 생명 계통이 탄생지마다 `region` 을
 * 이미 든다(`CheckLifeFormation.region`). 그래서 계통을 주면 원천 · 경로와 **완전히 같은 어법**
 * 으로 잰다 — 그 방의 것이 아닌 키 · 아는 탄생지가 아닌 키 · 셀 자리가 없는 탄생지.
 * 계통을 주지 않으면 뒷면도 앞면의 방 대조도 재지 않고 계약이 준 전역 목록(`memory.formations`)
 * 으로 앞면만 잰다 — 주지 않은 진리로 재지 않는 규율은 그대로다.
 */
function checkMemoryRefs(cx: MemoryContext): CheckItem {
  const head = MEMORY_ITEMS.refs;
  const { regions } = cx.memory;
  const refs: CheckRef[] = [];
  const declared = new Map<string, CheckMemoryRegion>();
  /**
   * 계통이 없을 때의 태어남 잣대 — 계약이 준 전역 목록. 계통이 있으면 이것은 읽지 않는다
   * (그때는 `cx.formationIds` 가 방까지 갈라 본다). 둘 다 없으면 태어남 쪽은 재지 않는다
   */
  const declaredFormations = cx.memory.formations ? new Set(cx.memory.formations) : undefined;
  let sourceKeys = 0;
  let routeKeys = 0;
  let birthKeys = 0;

  for (const room of regions) {
    sourceKeys += room.sources.length;
    routeKeys += room.routes.length;
    birthKeys += room.formations?.length ?? 0;
    if (!cx.regionIds.has(room.id)) {
      // 모르는 방의 키는 무엇과 견줄 수가 없다 — 방 하나만 적고 그 키들은 재지 않는다
      refs.push({ where: room.id, detail: `${room.id} 은 아는 방이 아니다` });
      continue;
    }
    declared.set(room.id, room);
    if (cx.sourcesByRegion && cx.sourceIds) {
      const mine = cx.sourcesByRegion.get(room.id) ?? [];
      for (const key of room.sources) {
        if (mine.includes(key)) continue;
        refs.push({
          where: room.id,
          detail: cx.sourceIds.has(key)
            ? `원천 ${key} 은 이 방의 것이 아니다`
            : `원천 ${key} 은 아는 원천이 아니다`,
        });
      }
    }
    if (cx.routesByRegion && cx.routeIds) {
      const mine = cx.routesByRegion.get(room.id) ?? [];
      for (const key of room.routes) {
        if (mine.includes(key)) continue;
        refs.push({
          where: room.id,
          detail: cx.routeIds.has(key)
            ? `경로 ${key} 은 이 방을 지나지 않는다`
            : `경로 ${key} 은 아는 경로가 아니다`,
        });
      }
    }
    if (cx.formationsByRegion && cx.formationIds) {
      // 계통이 있다 — 원천 · 경로와 같은 어법으로 방까지 갈라 본다
      const mine = cx.formationsByRegion.get(room.id) ?? [];
      for (const key of room.formations ?? []) {
        if (mine.includes(key)) continue;
        refs.push({
          where: room.id,
          detail: cx.formationIds.has(key)
            ? `탄생지 ${key} 은 이 방의 것이 아니다`
            : `탄생지 ${key} 은 아는 탄생지가 아니다`,
        });
      }
    } else if (declaredFormations) {
      // 계통이 없다 — 키가 실재하는가만 잰다 (어느 방의 것인가는 알 길이 없다)
      for (const key of room.formations ?? []) {
        if (declaredFormations.has(key)) continue;
        refs.push({ where: room.id, detail: `탄생지 ${key} 은 아는 탄생지가 아니다` });
      }
    }
  }

  // 셀 수 없는 것 — 방 차례로. 기억 자리를 밝히지 않은 방은 빈 것으로 견준다
  for (const region of cx.input.regions) {
    const room = declared.get(region.id);
    if (cx.sourcesByRegion) {
      for (const id of cx.sourcesByRegion.get(region.id) ?? []) {
        if (room?.sources.includes(id)) continue;
        refs.push({ where: region.id, detail: `원천 ${id} 을 셀 자리가 없다` });
      }
    }
    if (cx.routesByRegion) {
      for (const id of cx.routesByRegion.get(region.id) ?? []) {
        if (room?.routes.includes(id)) continue;
        refs.push({ where: region.id, detail: `이 방을 지나는 경로 ${id} 을 셀 자리가 없다` });
      }
    }
    if (cx.formationsByRegion) {
      for (const id of cx.formationsByRegion.get(region.id) ?? []) {
        if (room?.formations?.includes(id)) continue;
        refs.push({ where: region.id, detail: `탄생지 ${id} 을 셀 자리가 없다` });
      }
    }
  }

  return {
    ...head,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer:
      `방 ${regions.length} · 원천 키 ${sourceKeys} · 경로 키 ${routeKeys}` +
      ` · 태어남 키 ${birthKeys} · 걸린 것 ${refs.length}`,
    refs,
  };
}

/**
 * ㊼ 지우는 손마다의 State 경로와 방마다의 기억 크기 — 판정하지 않는다.
 *
 * 줄의 차례는 지우는 손 어휘 → 모르는 손(표에 적힌 차례) → 방(기억 목록 차례)이다.
 * 어휘 밖의 손을 적은 줄은 걸린 것이 아니라 **적어 두는 것**이다 — 사람이 어휘를 늘릴지
 * 그 줄을 고칠지 고른다.
 */
function checkPersistenceSummary(cx: MemoryContext): CheckItem {
  const head = MEMORY_ITEMS.persistence;
  const { persistence, erasers, regions } = cx.memory;
  const known = new Set(erasers);
  const refs: CheckRef[] = erasers.map((eraser) => {
    const paths = persistence.filter((row) => row.eraser === eraser).map((row) => row.path);
    return { where: eraser, detail: namedGroup('State 경로', paths) };
  });
  let unknown = 0;
  for (const row of persistence) {
    if (known.has(row.eraser)) continue;
    unknown++;
    refs.push({ where: row.path, detail: `모르는 손 ${row.eraser} — 지우는 손 어휘에 없다` });
  }

  // 방마다의 기억 크기 — 원천 키 수 + 경로 키 수. 같은 크기가 둘이면 앞선 방이 가장 큰 방이다
  let total = 0;
  let biggest = '';
  let biggestSize = -1;
  for (const room of regions) {
    const size = room.sources.length + room.routes.length;
    total += size;
    if (size > biggestSize) {
      biggest = room.id;
      biggestSize = size;
    }
    refs.push({
      where: room.id,
      detail: `기억 크기 ${size} (원천 ${room.sources.length} · 경로 ${room.routes.length})`,
    });
  }

  return {
    ...head,
    status: 'report',
    answer:
      `State 경로 ${persistence.length} · 지우는 손 ${erasers.length} · 모르는 손 ${unknown}` +
      ` · 방 ${regions.length} · 기억 크기 합 ${total} · 가장 큰 방 ${regions.length === 0 ? '없음' : `${biggest} ${biggestSize}`}`,
    refs,
  };
}

/** ㊸ ㊼ — 기억 쪽 계약을 주지 않으면 둘이 전부 absent 다 (통과가 아니다) */
function memoryItems(input: CheckRegionsInput): CheckItem[] {
  const memory = input.memory;
  if (!memory) {
    return Object.values(MEMORY_ITEMS).map((head) =>
      absentItem(head, '기억 쪽 계약이 주어지지 않았다'),
    );
  }
  const { ecology, time, life } = input;
  const cx: MemoryContext = {
    input,
    memory,
    regionIds: new Set(input.regions.map((region) => region.id)),
    sourcesByRegion: ecology ? memorySourcesByRegion(ecology) : undefined,
    sourceIds: ecology ? new Set(ecology.sources.map((source) => source.id)) : undefined,
    routesByRegion: time ? memoryRoutesByRegion(time) : undefined,
    routeIds: time ? new Set(time.routes.map((route) => route.id)) : undefined,
    // 계통이 탄생지마다 방을 이미 든다 — ecology · time 과 같은 자리 · 같은 어법 (C038 ADDED)
    formationsByRegion: life ? memoryFormationsByRegion(life) : undefined,
    formationIds: life ? new Set(life.formations.map((formation) => formation.id)) : undefined,
  };
  return [checkMemoryRefs(cx), checkPersistenceSummary(cx)];
}

// ── 검사 ㊹ — 조건의 참조 무결 (C035 ADDED) ────────────────────────────
//
// 세계의 조건 자리 넷(문의 요구 · 원천의 때 · 방의 철 위상 · 결속의 요구)과 기억을 읽는 조건이
// **한 형**(condition.ts 의 Condition)으로 읽힌 뒤, 그 잎 하나하나가 실제로 있는 것을 가리키는가를
// 한 검사로 잰다 — ㉓ · ㉖ · ㉞ 이 각자 보던 것의 일반형이다 (겹쳐 보되 그 셋을 지우지 않는다).
//
// 기반은 어느 방 · 원천 · 경로가 있는지도, history 에 어떤 경로가 있는지도 모른다 — 컨텐츠가
// `CheckConditionVocabulary` 로 **어휘째** 준다. 조건 쪽 계약을 주지 않으면 absent 다.
//
// 잎 하나가 걸리는 것 (fail):
//   ① target.kind 가 어휘의 targets 에 없거나(자리만인 갈래 포함 — 어휘에 없으면 걸린다),
//      ref 가 필요한 갈래(SINGLETON 밖)인데 ref 가 없거나, ref 가 그 갈래의 id 목록에 없다
//   ② query.kind 가 그 Target 갈래에 허용된 query 목록에 없거나, 그 query 가 paths 를 밝혔는데
//      query.path 가 그 목록에 없다 (paths 를 밝히지 않은 query 는 path 를 재지 않는다)
//   ③ operator 가 아홉 밖이거나 · EXISTS/NOT_EXISTS 인데 value 가 있거나 · 나머지인데 value 가 없거나 ·
//      IN 인데 value 가 목록이 아니거나 · IN 밖인데 value 가 목록이다
//   ④ qualifier 가 형에 어긋난다 — time 의 mode 가 다섯 밖 · seconds 가 유한한 0 이상의 수가 아님 ·
//      change 의 mode 가 넷 밖
// answer 는 `자리 N · 잎 N · 걸린 것 N` 이고 refs 의 where 는 그 자리(site.where) · detail 은
// `formatConditionLeaf` + 걸린 까닭이다.

/** 조건이 서 있는 자리 하나 — where 는 컨텐츠가 짓는 자리 이름 (`lock:<id>` · `source:<id>` 식) */
export interface CheckConditionSite {
  where: string;
  condition: Condition;
}

/** Target 갈래 하나에 허용되는 Query 와 그 경로 목록 */
export interface CheckConditionQueryRule {
  target: ConditionTargetKind;
  query: ConditionQueryKind;
  /** 밝히면 query.path 가 이 안에 있어야 한다. 밝히지 않으면 path 를 재지 않는다 */
  paths?: readonly string[];
}

/** 조건의 어휘 — 컨텐츠가 건넨다 */
export interface CheckConditionVocabulary {
  /** Target 갈래 → 실제 id 목록. ref 없는 갈래(clock)는 빈 목록으로 둔다 — 갈래가 있다는 뜻이다 */
  targets: Readonly<Partial<Record<ConditionTargetKind, readonly string[]>>>;
  queries: readonly CheckConditionQueryRule[];
}

/** ㊹ 가 볼 조건 쪽 계약 — 주지 않으면 absent 다 */
export interface CheckCondition {
  sites: readonly CheckConditionSite[];
  vocabulary: CheckConditionVocabulary;
}

/** ㊹ 의 번호·이름 — 계약이 없을 때의 absent 도 이것을 쓴다 */
export const CONDITION_ITEM = { mark: '㊹', id: 'condition-refs', name: '조건이 가리키는 것' } as const;

/** 잎 하나가 걸린 까닭들 — ①~④ 의 차례로 (빈 배열이면 성하다) */
function conditionLeafFaults(leaf: ConditionLeaf, vocabulary: CheckConditionVocabulary): string[] {
  const faults: string[] = [];
  const { target, query, operator, value, qualifier } = leaf;

  // ① Target — 갈래가 어휘에 있는가 · ref 가 있어야 하는가 · ref 가 실제 id 인가
  const ids = vocabulary.targets[target.kind];
  const knownKind = ids !== undefined;
  if (!knownKind) {
    faults.push(`Target 갈래 ${target.kind} 은 어휘에 없다`);
  } else if (!SINGLETON_TARGET_KINDS.includes(target.kind)) {
    // 자리만인 갈래(actor · player · faction)는 아직 id 가 없다 — ref 를 요구하지 않는다.
    // 밝혔으면 어휘의 id 이어야 하는 것은 같다 (그 층이 오면 목록이 찬다)
    const deferred = DEFERRED_TARGET_KINDS.includes(target.kind);
    if (target.ref === undefined) {
      if (!deferred) faults.push(`Target ${target.kind} 에 ref 가 없다`);
    } else if (!ids.includes(target.ref)) {
      faults.push(`ref ${target.ref} 은 아는 ${target.kind} 이 아니다`);
    }
  }

  // ② Query — 그 갈래에 허용된 query 인가 · paths 를 밝혔으면 path 가 그 안에 있는가.
  // 모르는 갈래의 query 는 무엇과 견줄 수가 없다 — ① 만 적고 재지 않는다 (㊸ 의 어법)
  if (knownKind) {
    const rule = vocabulary.queries.find(
      (row) => row.target === target.kind && row.query === query.kind,
    );
    if (rule === undefined) {
      faults.push(`Query ${query.kind} 은 ${target.kind} 에 허용되지 않는다`);
    } else if (rule.paths !== undefined) {
      if (query.path === undefined) faults.push(`${target.kind}.${query.kind} 은 path 를 요구한다`);
      else if (!rule.paths.includes(query.path)) {
        faults.push(`path ${query.path} 은 ${target.kind}.${query.kind} 의 경로에 없다`);
      }
    }
  }

  // ③ Operator 와 Value 의 짝
  if (!CONDITION_OPERATORS.includes(operator)) {
    faults.push(`operator ${operator} 은 아홉 밖이다`);
  } else if (VALUELESS_OPERATORS.includes(operator)) {
    if (value !== undefined) faults.push(`${operator} 은 value 를 받지 않는다`);
  } else if (value === undefined) {
    faults.push(`${operator} 은 value 를 요구한다`);
  } else if (operator === 'IN') {
    if (!Array.isArray(value)) faults.push('IN 의 value 는 목록이어야 한다');
  } else if (Array.isArray(value)) {
    faults.push(`${operator} 의 value 는 목록일 수 없다`);
  }

  // ④ Qualifier 의 형
  if (qualifier !== undefined) {
    if (qualifier.kind === 'time') {
      if (!TIME_QUALIFIER_MODES.includes(qualifier.mode)) {
        faults.push(`time qualifier 의 mode ${qualifier.mode} 은 다섯 밖이다`);
      }
      const { seconds } = qualifier;
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
        faults.push(`time qualifier 의 seconds ${String(seconds)} 은 유한한 0 이상의 수가 아니다`);
      }
    } else if (qualifier.kind === 'change') {
      if (!CHANGE_QUALIFIER_MODES.includes(qualifier.mode)) {
        faults.push(`change qualifier 의 mode ${qualifier.mode} 은 넷 밖이다`);
      }
    } else {
      faults.push(`qualifier 의 kind ${String((qualifier as { kind: unknown }).kind)} 은 time · change 밖이다`);
    }
  }

  return faults;
}

/**
 * ㊹ 조건의 참조 무결 — 자리마다 그 조건의 잎 전부를 어휘에 견준다.
 *
 * refs 의 차례는 자리(sites) → 잎(적힌 차례) → 까닭(①~④) 이다 — 두 번 돌리면 같다.
 * 잎 하나에 까닭이 여럿이면 줄도 여럿이다 (무엇이 어긋났는지 다 적는다).
 */
function checkConditionRefs(condition: CheckCondition): CheckItem {
  const refs: CheckRef[] = [];
  let leafCount = 0;
  for (const site of condition.sites) {
    for (const leaf of conditionLeaves(site.condition)) {
      leafCount++;
      const line = formatConditionLeaf(leaf);
      for (const reason of conditionLeafFaults(leaf, condition.vocabulary)) {
        refs.push({ where: site.where, detail: `${line} — ${reason}` });
      }
    }
  }
  return {
    ...CONDITION_ITEM,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `자리 ${condition.sites.length} · 잎 ${leafCount} · 걸린 것 ${refs.length}`,
    refs,
  };
}

/**
 * ㊹ — 조건 쪽 계약을 주지 않으면 absent 다 (통과가 아니다). `checkRegions` 의 items 에
 * `...memoryItems(input)` 뒤에 선다 (기억 ㊸ 과 ㊼ 사이의 번호이지만 실리는 차례는 계약이 는
 * 차례다 — ㉓~㉖ 이 ⑩~㉒ 뒤에 선 그 어법).
 */
export function conditionItems(input: CheckRegionsInput): CheckItem[] {
  const condition = input.condition;
  if (!condition) return [absentItem(CONDITION_ITEM, '조건 쪽 계약이 주어지지 않았다')];
  return [checkConditionRefs(condition)];
}

// ── 검사 ㊺ ㊻ — 방이 내미는 것 (C036 ADDED) ──────────────────────────
//
// ㊹ 이 "언제 참인가" 를 한 형으로 재었다면, 이 둘은 **방이 무엇을 내미는가**(opportunity.ts 의
// Opportunity)를 잰다 — ㊺ 는 그 데이터가 유령을 가리키지 않는가(통과/실패)를, ㊻ 은 방마다
// 얼마나 내미는가와 방 사이 관계가 어떻게 뻗어 있는가(판정 없음)를 본다.
//
// 여기에도 게임 명사가 없다. 어느 원천 · 문 · 경로가 실재하는지, 어느 동사가 실제 Interaction
// role 인지, progress 로 읽을 수 있는 경로가 무엇인지 기반은 모른다 — 컨텐츠가
// `CheckOpportunityVocabulary` 로 **어휘째** 준다 (㊹ 의 어법 그대로). 기회 쪽 계약을 주지
// 않으면 둘 다 absent 다 — 잴 것이 없으면 통과로 적지 않는다.
//
// **기회는 판정하지 않는다** — availability 가 지금 참인가는 여기서 묻지 않는다. ㊺ 이 그것에
// 대해 묻는 것은 오직 "그 조건의 잎이 있는 것을 가리키는가" 이고, 그 잣대는 ㊹ 의
// `conditionLeafFaults` 를 **그대로** 쓴다 (같은 잣대를 두 벌로 적지 않는다).

/** 동사 하나와 그것이 되는 Interaction role — role 의 이름은 이 세계의 것이다 */
export interface CheckOpportunityActionRole {
  action: OpportunityAction;
  role: string;
}

/** 기회의 어휘 — 컨텐츠가 건넨다 (㊹ 의 `CheckConditionVocabulary` 와 같은 자리) */
export interface CheckOpportunityVocabulary {
  /** Target 갈래 → 실제 id 목록. 갈래를 적지 않으면 그 갈래를 향한 기회가 걸린다 */
  targets: Readonly<Partial<Record<OpportunityTargetKind, readonly string[]>>>;
  actions: readonly CheckOpportunityActionRole[];
  /** progress.ref 로 허용되는 경로 (counter · phase) — 밝히지 않으면 ref 를 재지 않는다 */
  progressPaths?: readonly string[];
  /** availability 를 ㊹ 과 같은 잣대로 재기 위한 조건 어휘 */
  condition: CheckConditionVocabulary;
}

/**
 * 방 사이 관계 한 갈래 (G9 의 다섯 — 공간 · 환경 · 생태 · 사건 · 사회)와 그 관계가 닿는 방들.
 *
 * 갈래의 이름도 컨텐츠의 것이다 — 기반은 다섯이라는 수도 이름도 모르고, 준 차례로 한 줄씩 낸다.
 */
export interface CheckOpportunityRelation {
  kind: string;
  regions: readonly string[];
}

/** ㊺ ㊻ 이 볼 기회 쪽 계약 — 주지 않으면 둘 다 absent 다 */
export interface CheckOpportunity {
  /** 방 차례 · 그 방이 내미는 차례 (refs 의 차례가 곧 이 차례다) */
  opportunities: readonly Opportunity[];
  vocabulary: CheckOpportunityVocabulary;
  relations: readonly CheckOpportunityRelation[];
}

/** ㊺ ㊻ 의 번호·이름 — 계약이 없을 때의 absent 도 이것을 쓴다 */
export const OPPORTUNITY_ITEM = {
  mark: '㊺',
  id: 'opportunity-refs',
  name: '기회가 가리키는 것',
} as const;
export const OPPORTUNITY_SUMMARY_ITEM = {
  mark: '㊻',
  id: 'opportunity-summary',
  name: '방마다 내미는 것과 관계',
} as const;

/**
 * 기회 하나가 걸린 까닭들 — ①~⑦ 의 차례로 (빈 배열이면 성하다).
 *
 *   ① target 의 갈래가 어휘에 없거나 ref 가 그 갈래의 id 가 아니다
 *   ② discovery 가 지금 서는 넷 밖이다 (자리만인 NPC · KNOWLEDGE 도 지금은 걸린다)
 *   ③ possibleActions 가 비었거나 이 세계의 Interaction role 이 아닌 동사가 있다
 *   ④ progress 의 kind 가 셋 밖 · 경로를 요구하는데 없음 · none 인데 있음 · 읽을 수 없는 경로
 *   ⑤ outcomes 의 (군, op) 짝이 §4.2 표 밖 · yield 가 넷 밖
 *   ⑥ availability 의 잎이 ㊹ 의 잣대에 걸린다
 *   ⑦ id 가 비었거나 겹치거나 · region 이 아는 방이 아니다
 *
 * ⑦ 이 뒤에 선 것은 게으름이 아니다 — 무엇이 걸렸는지를 **기회의 속부터** 적고 그 기회가 어디에
 * 어떤 이름으로 섰는가를 마지막에 적는 차례다 (한 줄로 읽으면 안에서 밖으로).
 */
function opportunityFaults(
  opportunity: Opportunity,
  vocabulary: CheckOpportunityVocabulary,
  regionIds: ReadonlySet<string>,
  idCounts: ReadonlyMap<string, number>,
): string[] {
  const faults: string[] = [];
  const { id, region, availability, discovery, target, possibleActions, progress, outcomes } =
    opportunity;

  // ① Target — 갈래가 어휘에 있는가 · ref 가 그 갈래의 실제 id 인가
  const ids = vocabulary.targets[target.kind];
  if (ids === undefined) {
    faults.push(`Target 갈래 ${target.kind} 은 어휘에 없다`);
  } else if (!ids.includes(target.ref)) {
    faults.push(`ref ${target.ref} 은 아는 ${target.kind} 이 아니다`);
  }

  // ② discovery — 자리만인 것(NPC · KNOWLEDGE)은 그 층이 와서 어휘가 열기 전까지 걸린다
  if (!DECIDABLE_DISCOVERY_KINDS.includes(discovery)) {
    const deferred = DEFERRED_DISCOVERY_KINDS.includes(discovery);
    faults.push(
      deferred
        ? `discovery ${discovery} 은 아직 자리만이다`
        : `discovery ${discovery} 은 아는 갈래가 아니다`,
    );
  }

  // ③ possibleActions — 하나도 없는 기회는 내미는 것이 없다 · 동사는 실제 Interaction role 이어야 한다
  if (possibleActions.length === 0) {
    faults.push('possibleActions 가 비었다');
  }
  for (const action of possibleActions) {
    if (!vocabulary.actions.some((row) => row.action === action)) {
      faults.push(`동사 ${action} 은 이 세계의 Interaction role 이 아니다`);
    }
  }

  // ④ progress — 값이 아니라 경로다 (opportunity.ts 지키는 것 ②)
  if (!OPPORTUNITY_PROGRESS_KINDS.includes(progress.kind)) {
    faults.push(`progress 의 kind ${progress.kind} 은 셋 밖이다`);
  } else if (progress.kind === 'none') {
    if (progress.ref !== undefined) faults.push('progress none 은 ref 를 받지 않는다');
  } else if (progress.ref === undefined) {
    faults.push(`progress ${progress.kind} 은 ref 를 요구한다`);
  } else if (vocabulary.progressPaths !== undefined && !vocabulary.progressPaths.includes(progress.ref)) {
    faults.push(`progress 의 ref ${progress.ref} 은 읽을 수 있는 경로에 없다`);
  }

  // ⑤ outcomes — 이름만 붙는 층이지만 그 이름은 §4.2 표 안이어야 한다
  for (const mutation of outcomes.world) {
    if (!MUTATION_OPS.some((row) => row.group === mutation.group && row.op === mutation.op)) {
      faults.push(`${mutation.group} ${mutation.op} 은 op 표에 없는 짝이다`);
    }
  }
  for (const kind of outcomes.yield) {
    if (!OPPORTUNITY_YIELD_KINDS.includes(kind)) faults.push(`yield ${kind} 은 넷 밖이다`);
  }

  // ⑥ availability — ㊹ 의 잣대 그대로. 밝히지 않은 기회는 늘 있는 것이라 잴 잎이 없다
  if (availability !== undefined) {
    for (const leaf of conditionLeaves(availability)) {
      const line = formatConditionLeaf(leaf);
      for (const reason of conditionLeafFaults(leaf, vocabulary.condition)) {
        faults.push(`availability ${line} — ${reason}`);
      }
    }
  }

  // ⑦ 이름과 자리 — 겹친 id 는 겹친 쪽 모두에 적는다 (어느 쪽을 고칠지는 사람이 본다)
  if (id.trim() === '') faults.push('id 가 비었다');
  else if ((idCounts.get(id) ?? 0) > 1) faults.push(`id ${id} 이 둘 이상이다`);
  if (!regionIds.has(region)) faults.push(`region ${region} 은 아는 방이 아니다`);

  return faults;
}

/**
 * ㊺ 기회의 참조 무결 — 기회마다 그 속을 어휘에 견준다.
 *
 * refs 의 차례는 기회(준 차례) → 까닭(①~⑦) 이다 — 두 번 돌리면 같다. 기회 하나에 까닭이
 * 여럿이면 줄도 여럿이다 (무엇이 어긋났는지 다 적는다 — ㊹ 의 어법).
 */
function checkOpportunityRefs(input: CheckRegionsInput, opportunity: CheckOpportunity): CheckItem {
  const { opportunities, vocabulary } = opportunity;
  const regionIds = new Set(input.regions.map((region) => region.id));
  const idCounts = new Map<string, number>();
  for (const row of opportunities) idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);

  const refs: CheckRef[] = [];
  for (const row of opportunities) {
    const line = formatOpportunity(row);
    for (const reason of opportunityFaults(row, vocabulary, regionIds, idCounts)) {
      refs.push({ where: `opportunity:${row.id}`, detail: `${line} — ${reason}` });
    }
  }
  return {
    ...OPPORTUNITY_ITEM,
    status: refs.length === 0 ? 'pass' : 'fail',
    answer: `기회 ${opportunities.length} · 걸린 것 ${refs.length}`,
    refs,
  };
}

/**
 * ㊻ 방마다 내미는 것과 방 사이 관계 — 판정하지 않는다 (많고 적음은 사람이 본다).
 *
 * 줄의 차례는 방(input.regions 차례) → 관계 갈래(준 차례)다. 방 줄은 기회가 0 이어도 선다 —
 * **내미는 것이 없는 방이 눈에 띄어야** 이 요약이 일을 한다 (관계도 같다: 어느 방에도 닿지 않는
 * 갈래와, 그 갈래가 닿지 않는 방이 그 줄에 드러난다).
 *
 * 아는 방 밖을 region 으로 적은 기회는 여기 어느 줄에도 서지 않는다 — 그것은 ㊺ 가 잡을 일이고,
 * 요약이 유령 방의 줄을 지어내면 표가 거짓말을 한다.
 */
function checkOpportunitySummary(input: CheckRegionsInput, opportunity: CheckOpportunity): CheckItem {
  const { opportunities, relations } = opportunity;
  const discoveryKinds = [...DECIDABLE_DISCOVERY_KINDS, ...DEFERRED_DISCOVERY_KINDS];

  let emptyRooms = 0;
  let events = 0;
  const refs: CheckRef[] = input.regions.map((region) => {
    const mine = opportunities.filter((row) => row.region === region.id);
    if (mine.length === 0) emptyRooms++;
    const eventCount = mine.filter(isEventOpportunity).length;
    events += eventCount;
    // discovery 별 수 — 갈래의 차례로, 하나도 없는 갈래는 적지 않는다 (줄이 길어지지 않도록)
    const spread = discoveryKinds
      .map((kind) => ({ kind, count: mine.filter((row) => row.discovery === kind).length }))
      .filter((row) => row.count > 0)
      .map((row) => `${row.kind} ${row.count}`);
    return {
      where: region.id,
      detail: `기회 ${mine.length} · Event ${eventCount} · ${spread.length === 0 ? '갈래 없음' : spread.join(' ')}`,
    };
  });

  for (const relation of relations) {
    const touched = new Set(relation.regions);
    const untouched = input.regions
      .map((region) => region.id)
      .filter((regionId) => !touched.has(regionId));
    refs.push({
      where: `relation:${relation.kind}`,
      detail: `닿는 방 ${touched.size} · ${namedGroup('닿지 않는 방', untouched)}`,
    });
  }

  return {
    ...OPPORTUNITY_SUMMARY_ITEM,
    status: 'report',
    answer:
      `기회 ${opportunities.length} · 기회 0 인 방 ${emptyRooms} · Event ${events}` +
      ` · 관계 갈래 ${relations.length}`,
    refs,
  };
}

/**
 * ㊺ ㊻ — 기회 쪽 계약을 주지 않으면 둘 다 absent 다 (통과가 아니다). `checkRegions` 의 items 에
 * `...conditionItems(input)` 뒤에 선다 (번호가 아니라 계약이 는 차례 — ㊹ 이 ㊼ 뒤에 선 그 어법).
 */
export function opportunityItems(input: CheckRegionsInput): CheckItem[] {
  const opportunity = input.opportunity;
  if (!opportunity) {
    return [
      absentItem(OPPORTUNITY_ITEM, '기회 쪽 계약이 주어지지 않았다'),
      absentItem(OPPORTUNITY_SUMMARY_ITEM, '기회 쪽 계약이 주어지지 않았다'),
    ];
  }
  return [checkOpportunityRefs(input, opportunity), checkOpportunitySummary(input, opportunity)];
}
