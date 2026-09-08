// World Semantic — Region (C001 ADDED)
//
// World.regions · World.graph 는 컨텐츠 데이터(content/regions)에서 온다 — WorldState 에 넣지 않고
// 저장하지도 않는다 (02-world R7 · character-catalog 와 같은 성격의 정적 사실).
// 이 파일은 그 데이터를 세계 규칙이 쓰는 형(extent · anchor 자리 · 출구 · hash)으로 읽는 얇은 층이다.
// 세계가 모르는 Region 은 데이터 오류다 — 조용히 넘기지 않고 throw 한다.

import {
  descriptionHash,
  findPoint,
  type Extent,
} from '../../../engine/world-authoring/description';
import { areaCoversPoint } from '../../../engine/world-authoring/query';
import { exitsOf, type ConnectorExit } from '../../../engine/world-authoring/graph';
import {
  ANCHOR_LAYER,
  CLOSED_CONNECTORS,
  REGION_GRAPH,
  START_REGION_ID,
  lockOfConnector,
  locksOfRegion,
  regionSpec,
  type RegionSpec,
} from '../../regions';
import { isSeasonListed } from './region-phase';
import type { WorldPosition } from './position';
import type { RegionState } from './region-state';

// 관찰자의 새 몸 · 기본 자율 존재 · 광맥이 놓이는 Region (02-world R3 · R4).
//
// C004 CHANGED — 어느 방인지는 이제 컨텐츠 데이터가 말한다 (content/regions 의 START_REGION_ID).
// 규칙은 시작 방이 있다는 것만 알고 그것이 백왕령인 줄은 모른다 — 이 파일이 방 이름을 적던
// 마지막 자리였다 (01-spec SPEC-003 · SPEC-004).
export const START_REGION: string = START_REGION_ID;

export function regionSpecOf(id: string): RegionSpec {
  const spec = regionSpec(id);
  if (!spec) throw new Error(`세계가 모르는 Region 이다 — ${id}`);
  return spec;
}

/**
 * 그 Region 이 지어져 있는가 — Description 이 있는가 (C002 ADDED · 02-world Connector.isBuilt).
 * 판정이지 사고가 아니다 — 경계(frontier)의 이름을 물어도 throw 하지 않고 거짓을 준다.
 * 건너기의 region-not-built 거절이 이것으로 판정한다 (01-spec SPEC-006).
 */
export function isRegionBuilt(id: string): boolean {
  return regionSpec(id) !== undefined;
}

/**
 * 그 Connector 가 **왜 닫혀 있는가** — 열려 있으면 null (C016 ADDED · spec R4 · R5).
 *
 * **판정은 여기 한 곳에서만 난다.** 열림/닫힘(isConnectorOpen)도 거절 사유(RULE-REGION-TRANSIT-001)도
 * 이 함수가 낸 하나의 답을 읽는다 — 두 벌로 만들면 문이 두 말을 한다 (spec R4 경계).
 * 표시와 원인이 같은 판정이라는 규율은 C013 의 sourceConditions 가 세운 그것과 같다.
 *
 * RULE-LOCK-ACTIVATION-001 (C029 CHANGED · C029 spec R1) — **읽는 자리가 표 둘에서 Lock 하나로
 * 바뀐다.** C009 · C016 이 graph.ts 의 활성 조건 표에서 읽던 것을 이제 그 문에 걸린 Lock 에서
 * 읽는다 (content/regions/access.ts · 그 방의 access.locks). **답은 한 값도 달라지지 않는다** —
 * 미로의 심장 문은 배열 P2 에서만, 걷는 숲과 빙결 심층의 문은 긴 밤에만 열린다.
 *
 * 셋을 차례로 본다. 어느 하나라도 걸리면 닫힌 문이다.
 *   ① 정적 사실 — id 가 CLOSED_CONNECTORS 에 있으면 언제나 닫혀 있다 (C002 그대로).
 *   ② 철 요구 — Lock 이 time 을 밝혔으면, 지금 철이 그 목록에 없을 때 닫힌다 (C016 ADDED).
 *      **이것만이 다른 사유다** — 잠긴 것이 아니라 지금이 그때가 아니다.
 *   ③ 배열 요구 — Lock 이 state 를 밝혔으면, 그 요구가 가리키는 방의 **지금 pattern** 이
 *      목록에 있을 때만 활성이다 (C009 그대로).
 * Lock 이 없는 문 · 요구를 하나도 밝히지 않은 Lock 은 언제나 활성이다 (지금까지의 세계 그대로).
 *
 * **property · knowledge 요구는 이 판정에 들어오지 않는다** (C029 spec R1 경계 ① · K12) —
 * 밝혔다고 잠기지 않고 채웠다고 열리지 않는다. 2층이 하는 것은 표시까지이고, 그것을 실제로
 * 판정하는 것은 몸과 소지와 아는 것이 서는 3층의 일이다. 그래서 성질을 밝힌 문도 밝히지
 * 않은 문과 **같은 답**을 낸다 — 이 파일은 어느 축도 어느 관계도 이름으로 알지 못한다.
 *
 * 철을 먼저 보고 배열을 나중에 보는 것은 C016 이 세운 그 차례 그대로다 — 지금 데이터에는
 * 둘을 함께 밝힌 Lock 이 없으므로 답이 갈리는 자리는 없고, 차례를 지키는 것은 하나를 밝힌
 * 문들의 사유가 그때와 같은 값이기 위해서다.
 *
 * C008 까지 문의 열림은 저장되지도 유도되지도 않는 정적 사실 하나였다. 이제 그것이
 * **세계 State 와 세계 시각에서 유도되는 사실**이 된다 — 그러나 저장되는 State 는 하나도
 * 늘지 않았다: 같은 pattern · 같은 시각이면 언제나 같은 답이므로 저장할 이유가 없다
 * (terrain 과 같은 성격 · C008 이 "저장/유도" 를 가른 그 규율 그대로). 그래서 되살린 세계에서도
 * 답이 같다.
 *
 * **규칙은 문 이름도 패턴 이름도 철 이름도 알지 못한다** — 여기가 아는 것은 "Lock 을 가진 문"
 * 뿐이고, 어느 문이 어느 방의 어느 패턴에서 · 어느 철에 열리는지는 데이터
 * (그 방의 RegionSpec.access)에만 있다 (C004 가 세운 규율 · C008 R1 · C016 T4 와 같은 규율).
 *
 * 배열 요구가 가리키는 방에 State 가 없으면 열지 않는다 — 읽을 pattern 이 없으므로 조건을
 * 만족했다고 말할 근거가 없다. 지어내지 않고 닫아 둔다.
 */
export type ConnectorClosedReason = 'season' | 'inactive';

export function connectorClosedReason(
  regionStates: Record<string, RegionState>,
  connectorId: string,
  time: number,
): ConnectorClosedReason | null {
  if (CLOSED_CONNECTORS.includes(connectorId)) return 'inactive';
  const lock = lockOfConnector(connectorId);
  if (!lock) return null;
  // ② 철 — 밝힌 문만 본다. 밝히지 않은 문은 철을 타지 않는다 (C009 의 세계 그대로).
  for (const requirement of lock.requires) {
    if (requirement.time && !isSeasonListed(requirement.time.seasons, time)) return 'season';
  }
  // ③ 배열 — C012 CHANGED 로 방의 State 가 규칙과 원천을 함께 들게 되었다. 여기가 읽는 것은 규칙뿐이다.
  for (const requirement of lock.requires) {
    const state = requirement.state;
    if (!state) continue;
    const rule = regionStates[state.region]?.rule;
    if (!rule) return 'inactive';
    if (!state.patterns.includes(rule.pattern)) return 'inactive';
  }
  return null;
}

/**
 * RULE-CONNECTOR-ACTIVATION-001 — 그 Connector 가 지금 열려 있는가
 * (C002 ADDED · 02-world Connector.isOpen · C009 CHANGED · C016 CHANGED · spec R4).
 *
 * 판정은 connectorClosedReason 하나가 낸다 — 이것은 그 답의 예/아니오 얼굴이다.
 * 관찰 결과의 출구 표식(open | locked)이 읽는 자리이고, **무엇이 그것을 열었는지는
 * 말하지 않는다** (spec SPEC-003 경계 ④).
 */
export function isConnectorOpen(
  regionStates: Record<string, RegionState>,
  connectorId: string,
  time: number,
): boolean {
  return connectorClosedReason(regionStates, connectorId, time) === null;
}

/**
 * RULE-LOCK-REASON-001 (C029 CHANGED — C020 의 RULE-EXIT-REQUIREMENT-001 이 서 있던 그 자리 ·
 * C029 spec R3) — 그 문에 걸린 Lock 이 밝힌 **현상**의 코드들. 밝히지 않았으면 빈 배열이다.
 *
 * **자리도 형도 그대로이고 바뀐 것은 그 코드가 무엇을 말하는가 하나다.** C020 은 요구의
 * 이름(`requires-stored-heat` — "저장된 열이 있어야 한다")을 실었고, 이제 그 자리에 현상의
 * 코드(`asks-warmth` — "체열이 감지된다")가 실린다. 세계는 답을 알려 주지 않는다 (K8).
 *
 * **활성을 판정하지 않는다** (spec R3 경계 ①). 열림/잠김은 여전히 connectorClosedReason
 * 하나가 내고, 이 값은 그 답을 한 값도 건드리지 않는다 — 밝혔다고 잠기지 않고 채워도 열리지
 * 않는다. 그래서 이 함수는 State 도 세계 시각도 묻지 않는다: 사유는 정적 사실이다.
 *
 * **요구의 이름도 · 무엇이 그것을 채우는지도 · 어디서 나는지도 내지 않는다** (경계 ②) —
 * 코드 하나뿐이고, 사람이 읽을 문구는 View 의 표가 옮긴다 (거절 사유 코드의 선례 그대로).
 *
 * 규칙은 어느 문이 무엇을 말하는지 이름으로 알지 못한다 — 아는 것은 "사유를 밝힌 Lock"
 * 뿐이고, 그 코드는 데이터(그 방의 access.locks)에만 있다 (C004 가 세운 규율).
 */
export function connectorReasonCodes(connectorId: string): readonly string[] {
  const reason = lockOfConnector(connectorId)?.reason;
  return reason === undefined ? [] : [reason];
}

/**
 * RULE-LOCK-TRACE-BODY-001 (C029 ADDED · spec R2 · SPEC-003) — **문 앞의 현상.**
 *
 * 그 방의 Lock 가운데 **몸에 보일 것을 밝힌 흔적**(showsOnBody)의 자락 안에 그 자리가 들면
 * 그 흔적이 밝힌 코드를 준다. 걸린 것이 없으면 빈 배열이다.
 *
 * **규칙은 김도 문도 알지 못한다** — Lock 이 가리킨 자락을 묻고 코드를 옮길 뿐이고, 그것이
 * 무엇을 뜻하는지도 왜 그렇게 보이는지도 여기에 없다 (C004 가 세운 규율).
 *
 * 지키는 것 넷.
 *   ① 저장되지 않는 **유도된 사실**이다 — 같은 자리 · 같은 데이터면 언제나 같은 답이고,
 *      자락 밖으로 나오면 그 자리에서 사라진다 (C016 의 위상 · C019 의 상시와 같은 갈래).
 *   ② 겹치면 걸린 것이 **전부** 실린다 (걸린 것의 어법 그대로 · C006 · C016 · C019).
 *   ③ **밝히지 않은 흔적은 아무것도 걸지 않는다** — 언 사체의 자리가 그렇고, 그것이 대조다.
 *   ④ 밝힌 op 이 그 방에 없거나 area 가 아니면 **조용히 아무 일도 하지 않는다** (끊긴 참조는
 *      조용하다 · C002 · C021 R1 이 세운 규율).
 *
 * layer 를 묻지 않는다 (spec 기본형 ⑤) — 흔적은 layer 하나에 갇히지 않는다. 그 방
 * Description 의 op 를 **id 로** 짚으므로 협곡의 trace layer 도 미로의 clue layer 도 같은 길로
 * 읽힌다. 컴파일 결과가 op id 를 잃는 것은 흔적의 세기를 읽는 자리와 같은 사정이다
 * (traceStrengthAt · isCollapsedAt 이 Description 을 직접 훑는 그 이유 그대로).
 *
 * **어디에 실리는가는 여기가 정하지 않는다** — 이 함수는 자리를 물으면 코드를 줄 뿐이고,
 * 그것을 몸에만 싣는 것은 투영의 몫이다 (spec R2 경계 ①).
 */
export function lockTraceCodesAt(regionId: string, position: WorldPosition): readonly string[] {
  const locks = locksOfRegion(regionId);
  if (locks.length === 0) return [];
  const spec = regionSpec(regionId);
  if (!spec) return [];

  // op id → 그 자락이 몸에 걸겠다고 밝힌 코드들. 한 op 를 여럿이 밝히면 **전부** 모인다
  // (위험의 코드가 그런 것과 같은 규율).
  const byOp = new Map<string, string[]>();
  for (const lock of locks) {
    for (const trace of lock.traces) {
      if (trace.showsOnBody === undefined) continue;
      const list = byOp.get(trace.op);
      if (list) list.push(trace.showsOnBody);
      else byOp.set(trace.op, [trace.showsOnBody]);
    }
  }
  if (byOp.size === 0) return [];

  // Description 의 op 차례 그대로 낸다 (결정론 — 두 번 물으면 같은 차례다)
  const codes: string[] = [];
  for (const op of spec.space.ops) {
    if (op.kind !== 'area') continue;
    const declared = byOp.get(op.id);
    if (declared === undefined) continue;
    if (!areaCoversPoint(op.shape, position.x, position.z)) continue;
    codes.push(...declared);
  }
  return codes;
}

/**
 * RULE-CONDITION-WEAKEN-001 (C021 ADDED · spec R1 · SPEC-002) —
 * **그 이음이 두 방을 잇는가.** 방향은 묻지 않는다.
 *
 * 방을 넘는 덧씌움(RegionPhase.outflow)이 자기가 타는 이음을 밝히고, 그것이 실제로 두 방을
 * 잇지 않으면 아무 일도 일어나지 않는다 — **이음을 통해서만 넘는다** 는 말의 판정이 여기다.
 * 세계가 모르는 이음을 가리킨 줄은 거짓이고, 그래서 조용히 아무 일을 하지 않는다
 * (경계 ① — 끊긴 참조를 오류로 세우지 않는 것은 경계의 이름을 정합 오류로 세우지 않는
 * C002 의 규율 그대로다).
 *
 * **방향을 묻지 않는 이유** — 넘는 것은 바람이지 몸이 아니다. 몸은 one-way 를 거슬러 갈 수
 * 없지만(RULE-REGION-TRANSIT-001) 추위는 길이 난 쪽으로 분다. 여기가 묻는 것은 "두 방이 이
 * 이음으로 이웃인가" 하나이고, 건널 수 있는가는 여전히 저쪽 판정의 몫이다 — 두 물음을 한
 * 함수로 합치지 않는다.
 *
 * 규칙은 어느 이음이 어느 방을 잇는지 이름으로 알지 못한다 — 데이터(REGION_GRAPH)를 짚을
 * 뿐이다 (C004 가 세운 규율).
 */
export function connectorLinks(connectorId: string, a: string, b: string): boolean {
  const connector = REGION_GRAPH.connectors.find((entry) => entry.id === connectorId);
  if (!connector) return false;
  const from = connector.from.region;
  const to = connector.to.region;
  return (from === a && to === b) || (from === b && to === a);
}

/** 그 Region 의 Local Space — RULE-MOVE-001 전제 1 · 관성 경계가 이것으로 판정한다 */
export function regionExtent(id: string): Extent {
  return regionSpecOf(id).space.extent;
}

/** Connector 가 가리키는 anchor 의 자리 — 없으면 데이터 오류 */
export function anchorPosition(regionId: string, anchorTag: string): WorldPosition {
  const point = findPoint(regionSpecOf(regionId).space, ANCHOR_LAYER, anchorTag);
  if (!point) throw new Error(`Region ${regionId} 에 anchor ${anchorTag} 가 없다`);
  return { x: point.position.x, z: point.position.z };
}

/** 이 Region 에서 나갈 수 있는 끝들 — exitsOf 위에 얇게 (connector 순서 보존) */
export function regionExitsOf(regionId: string): ConnectorExit[] {
  return exitsOf(REGION_GRAPH, regionId);
}

/** 같은 Description → 같은 값 — 관찰 결과의 region.hash */
export function regionHash(id: string): string {
  return descriptionHash(regionSpecOf(id).space);
}
