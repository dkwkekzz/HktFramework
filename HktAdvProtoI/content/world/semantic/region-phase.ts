// World Semantic — Region Phase (C016 ADDED)
//
// **방이 시계를 읽는다.** 세계에 시계가 하나 있고(C015) 방은 그것을 읽어 자기 위상을 얻는다 —
// 지금 철에 이 방의 어느 자락이 어느 깊이로 읽히는지 · 어디가 위험으로 읽히는지가 그것이다.
//
// **세계 State 가 아니다.** 저장되지 않고 스냅샷에도 실리지 않는다 — 같은 시각이면 언제나 같은
// 위상이므로 저장할 이유가 없다 (semantic/clock.ts 의 때 · semantic/terrain.ts 의 컴파일과
// 같은 갈래의 유도된 사실 · spec R1 경계 ③). 그래서 되살린 세계도 같은 답을 낸다.
//
// **규칙은 철의 이름을 알지 못한다** (L2-World-Time 원칙 T4 · spec R1 경계 ①). 여기가 하는 일은
// 데이터의 열쇠와 **지금 철**을 맞춰 보는 것뿐이고, 어느 철에 무엇이 달라지는지는 전부
// content/regions 의 phases 데이터에만 있다 — 그 데이터를 지우면 그 방은 철을 타지 않는다.
// 이 파일에 적힌 철 이름은 하나도 없다: 이름을 아는 자리는 시계(clock.ts) 하나뿐이다.
//
// **덧씌움이지 재컴파일이 아니다** (spec R1 경계 ② · T4 · T6). 높이도 표면도 통행 격자도 hash 도
// 한 값 바뀌지 않는다 — 컴파일된 땅 위에 State 가 얹힐 뿐이다 (C008 의 닫힌 통로 · C012 의
// 무너진 자리가 세운 그 형 그대로).

import { areasOf } from '../../../engine/world-authoring/description';
import { areaCoversPoint } from '../../../engine/world-authoring/query';
import {
  DEPTH_LAYER,
  HAZARD_LAYER,
  regionSpec,
  type RegionPhase,
  type SeasonId,
} from '../../regions';
import type { WorldClockView } from '../../protocol/gameview';
import { seasonAt } from './clock';
import type { WorldPosition } from './position';

/**
 * 조건 · 거절 사유 코드 — **이 철이 아니다** (C016 ADDED).
 *
 * 잠긴 것(connector-inactive) · 바닥난 것(다 캤다) · 되돌아오는 중인 것과 **갈린다** —
 * 그것들은 "지금은 안 된다" 이고 이것은 "지금이 그때가 아니다" 다 (spec SPEC-003 경계 ① ·
 * SPEC-004 경계 ①). 문구는 View 의 표가 옮긴다.
 */
export const NOT_THIS_SEASON = 'not-this-season';

/**
 * **철의 어휘가 두 벌인 것을 컴파일 때 맞춰 본다** (C016 ADDED).
 *
 * 데이터 쪽의 `SeasonId`(content/regions/phases.ts)와 관찰 계약 쪽의
 * `WorldClockView['season']`(content/protocol/gameview.ts)이 그 두 벌이다. 두 벌인 이유는
 * 하나 — content/regions 는 데이터 폴더라 protocol 을 import 하지 않는다 (경계 규칙 4).
 *
 * 그래서 **둘이 같다는 것을 세계가 진다.** 어느 한쪽에 철이 늘거나 줄면 이 한 줄에서
 * 컴파일이 막힌다 (양쪽 모두를 본다 — 한쪽 방향만 보면 늘어난 쪽을 놓친다).
 */
type SameVocabulary<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const SEASON_VOCABULARY_MATCHES: SameVocabulary<SeasonId, WorldClockView['season']> = true;

/**
 * RULE-REGION-PHASE-001 (C016 ADDED · spec R1) — **지금 철에 이 방이 밝힌 덧씌움**.
 *
 * 밝히지 않은 방 · 그 철의 열쇠가 없는 방 · 세계가 모르는 방은 전부 undefined 다 —
 * 달라지는 것이 없다는 뜻이고, 없는 위상을 지어내지 않는다 (spec R1 ELSE).
 *
 * 규칙은 지금 철이 무엇인지 이름으로 알지 못한다: 시계가 낸 열쇠로 데이터를 한 번 짚을 뿐이다.
 */
export function regionPhaseAt(regionId: string, time: number): RegionPhase | undefined {
  return regionSpec(regionId)?.phases?.seasons?.[seasonAt(time)];
}

/**
 * RULE-OBSERVE-PROJECTION (C016 CHANGED · spec R2) — **선 자리에 덧씌워진 깊이**.
 *
 * 지금 철의 depthOverlay 가 그 자리를 덮으면 그 area 가 밝힌 깊이이고, 덮지 않으면
 * undefined — **방의 깊이를 그대로 쓰라는 뜻**이다 (C001 부터 그대로 · spec R2 ELSE).
 * 그래서 덧씌움을 밝히지 않은 방은 어느 철에도 지금과 한 값도 다르지 않다.
 *
 * 어느 area 가 어느 덧씌움인지는 **op id** 로만 알 수 있다. 컴파일 결과의 area 는 layer ·
 * tag · shape 만 들고 op id 를 잃으므로, 여기서는 그 방 Description 의 depth area 를 직접
 * 훑는다 — semantic/resource.ts 의 traceStrengthAt · isCollapsedAt 이 같은 이유로 그렇게 한다
 * (Description 의 area 와 컴파일 결과의 area 는 순서도 모양도 같다).
 *
 * 겹치면 **Description 의 나중 것이 이긴다** — 덧씌움은 위에 얹는 것이므로 나중에 얹은 것이
 * 위다. 값 하나만 실리는 자리이므로 전부 낼 수 없고, 순서로 정하면 언제나 같은 답이다 (결정론).
 */
export function depthOverlayAt(
  regionId: string,
  position: WorldPosition,
  time: number,
): string | undefined {
  const overlay = regionPhaseAt(regionId, time)?.depthOverlay;
  if (!overlay || overlay.length === 0) return undefined;
  const spec = regionSpec(regionId);
  if (!spec) return undefined;

  // op id → 그 철에 이 area 가 읽히는 깊이. 밝히지 않은 area 는 이 표에 없다.
  const byOp = new Map<string, string>();
  for (const entry of overlay) byOp.set(entry.areaId, entry.depth);

  let deepest: string | undefined;
  for (const area of areasOf(spec.space, DEPTH_LAYER)) {
    const depth = byOp.get(area.id);
    if (depth === undefined) continue;
    if (areaCoversPoint(area.shape, position.x, position.z)) deepest = depth;
  }
  return deepest;
}

/**
 * RULE-STANDING-CONDITIONS-001 (C016 CHANGED · spec R3) — **선 자리에 덧씌워진 위험의 코드들**.
 *
 * 지금 철의 hazardExtend 가 그 자리를 덮으면 그 area 가 밝힌 위험 태그다. 덮은 것이 없으면
 * 빈 배열이고, 겹치면 **걸린 것이 전부** 나온다 — "왜 여기가 안전한가"(C006 의 conditionTagsAt)가
 * 겹침을 다루는 그 어법 그대로다 (spec R3 경계 ②). 순서는 Description 의 ops 순서다 (결정론).
 *
 * 안전의 코드는 여기서 한 값도 건드리지 않는다 (spec R3 경계 ①) — 둘은 "여기는 무엇인가" 라는
 * 한 물음의 두 얼굴이라 **같은 자리에 함께** 실릴 뿐이고, 합치는 것은 투영의 일이다.
 *
 * op id 로 훑는 이유는 depthOverlayAt 과 같다.
 */
export function hazardOverlayTagsAt(
  regionId: string,
  position: WorldPosition,
  time: number,
): string[] {
  const overlay = regionPhaseAt(regionId, time)?.hazardExtend;
  if (!overlay || overlay.length === 0) return [];
  const spec = regionSpec(regionId);
  if (!spec) return [];

  const byOp = new Map<string, string>();
  for (const entry of overlay) byOp.set(entry.areaId, entry.hazard);

  const tags: string[] = [];
  for (const area of areasOf(spec.space, HAZARD_LAYER)) {
    const hazard = byOp.get(area.id);
    if (hazard === undefined) continue;
    if (areaCoversPoint(area.shape, position.x, position.z)) tags.push(hazard);
  }
  return tags;
}

/**
 * RULE-REGION-PHASE-001 (C016 ADDED · spec R1) — **지금 철이 그 목록에 드는가**.
 *
 * 철 조건을 밝힌 문(RULE-CONNECTOR-ACTIVATION-001)과 철 조건을 밝힌 원천
 * (RULE-RESOURCE-PLACEMENT-001)이 같은 물음을 묻는다 — 판정을 두 벌로 만들지 않는다.
 *
 * **밝히지 않은 것은 언제나 참이다** — 철을 타지 않는다는 뜻이고, 그것이 지금까지의 세계다
 * (spec R4 ELSE · R6 경계 ②).
 */
export function isSeasonListed(
  seasons: readonly SeasonId[] | undefined,
  time: number,
): boolean {
  return seasons === undefined || seasons.includes(seasonAt(time));
}
