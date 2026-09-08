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
//
// C018 CHANGED — **원인이 셋이 되었다** (C018 spec R4). 철 · 소란에 더해 **그 방을 지금
// 지나는 것**이 자기가 밝힌 덧씌움을 건다. 형은 여전히 C016 의 RegionPhase 그대로이고
// 겹침을 다루는 어법도 그대로다 — 깊이는 나중 것이 이기고 위험은 걸린 것이 전부 실린다.
// 그래서 자리를 묻는 두 함수가 **지나는 것이 건 덧씌움들을 함께 받는다**: 여기는 무엇이
// 지나는지도 그것이 어느 선을 타는지도 이름으로 알지 못하고, 받은 덧씌움을 철·깨어남의
// 것과 나란히 놓을 뿐이다 (C017 이 소란에 한 그대로 · 원인이 하나 는 것뿐이다).
//
// C019 CHANGED — **원인 없이 걸리는 자리가 하나 났다** (C019 spec R1). 방이 phases.standing 을
// 밝히면 그 덧씌움은 철도 소란도 지나가는 것도 아니면서 **늘** 걸린다 — 원인이 넷째로 는 것이
// 아니라 원인을 묻지 않는 자리다. 차례는 **맨 앞**이고(상시 → 철 → 깨어남 → 지나가는 것),
// 밝히지 않은 방의 답은 이 Cycle 전과 한 글자도 다르지 않다. 그리고 자락이 **관찰자에게 하는
// 일**을 밝힐 수 있게 되었다 (hazardEffectsAt) — 관찰 범위와 접촉 코드다. 여기는 여전히 그것이
// 눈보라인지 결정면인지 이름으로 알지 못하고, 자락이 밝힌 수와 글자를 옮길 뿐이다.
//
// C020 CHANGED — **위상을 거는 원인이 다섯째가 되었다** (C020 spec R4). 철 · 소란 ·
// 지나가는 것 · 늘 서 있는 것에 더해 **고갈**이 위상을 건다 — 깨진 마디가 그 자락에 위험의
// 코드와 접촉의 코드를 건다. 형은 여전히 C016 의 RegionPhase 그대로이고 거는 쪽이 하나
// 늘었을 뿐이다. 차례는 **맨 나중**이다 (상시 → 철 → 깨어남 → 지나는 것 → 깨진 마디):
// 겹치면 나중 것이 깊이의 열쇠를 이기고 위험은 걸린 것이 전부 실린다. 여기는 여전히 그것이
// 결정면인지도 무엇이 깨졌는지도 이름으로 알지 못하고, 받은 덧씌움을 나란히 놓을 뿐이다.
//
// C017 CHANGED — **방을 바꾸는 원인이 둘이 되었다** (spec R4). 철에 더해 그 방의 **소란**이
// 위상을 바꾸고, 깨어난 방은 자기가 밝힌 덧씌움(phases.awake)을 철의 것과 **함께** 건다.
// 형은 C016 의 RegionPhase 그대로다 — 원인이 둘이 되었을 뿐 달라지는 것은 여전히 넷 안이다 (T3).
// 그래서 자리를 묻는 두 함수가 **소란 State 를 함께 받는다**: 무엇이 방을 깨웠는지도, 어느 방이
// 무엇을 덧씌우는지도 여기는 여전히 이름으로 알지 못하고, 위상이라는 **값** 하나를 읽을 뿐이다.

import { areasOf } from '../../../engine/world-authoring/description';
import { areaCoversPoint } from '../../../engine/world-authoring/query';
import {
  DEPTH_LAYER,
  HAZARD_LAYER,
  regionSpec,
  type HazardOverlay,
  type RegionPhase,
  type SeasonId,
} from '../../regions';
import type { WorldClockView } from '../../protocol/gameview';
import { seasonAt } from './clock';
import type { WorldPosition } from './position';
import type { RegionDisturbanceState } from './region-state';

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
 * RULE-REGION-PHASE-001 (C017 CHANGED · C018 CHANGED · C017 spec R4 · C018 spec R4) —
 * **지금 이 방에 걸린 덧씌움들**.
 *
 * **늘 서 있는 것** · 철의 것 · 깨어남의 것 · **지나는 것의 것**을 함께 낸다. 어느 하나가
 * 다른 것을 지우지 않는다 (R4 경계 ① ②) — 겹침을 어떻게 다루는가는 부르는 쪽이 정한다
 * (깊이는 나중 것이 이기고 위험은 전부 실린다).
 *
 * 순서는 **상시 → 철 → 깨어남 → 지나는 것**이다: 나중일수록 깊이의 열쇠가 이긴다.
 * 상시가 맨 앞인 이유는 그것이 **원인 없이 늘 서 있는 바닥**이기 때문이다 — 철이 오고
 * 방이 깨어나고 무엇이 지나가는 것은 그 위에 얹히는 일이므로, 겹치면 나중에 온 것이 이긴다
 * (C019 spec R1).
 *
 * 위상을 밝히지 않은 방 · 소란이 없거나(되살린 옛 세계) 잠든 방은 그 자리가 비고,
 * 아무것도 지나지 않으면 마지막 자리가 빈다 — 그때의 답은 C018 · C017 · C016 과
 * 한 값도 다르지 않다.
 *
 * 규칙은 무엇이 방을 깨웠는지도 깨어난 방이 무엇을 덧씌우는지도 이름으로 알지 못한다
 * (spec SPEC-005 경계 ④) — 위상이라는 값 하나로 데이터를 한 번 더 짚을 뿐이다.
 */
function activePhasesAt(
  regionId: string,
  time: number,
  disturbance: RegionDisturbanceState | undefined,
  passing: readonly RegionPhase[],
  // C020 ADDED — 깨진 마디가 건 덧씌움들 (원인 다섯째). 밝히지 않으면 깨진 마디가 없다는
  // 뜻이고, 그때의 답은 C019 까지와 한 값도 다르지 않다.
  depleted: readonly RegionPhase[],
): RegionPhase[] {
  const phases = regionSpec(regionId)?.phases;
  const active: RegionPhase[] = [];
  if (phases) {
    // C019 CHANGED (spec R1) — 늘 걸리는 것이 맨 앞이다. 밝히지 않은 방에서는 이 줄이
    // 아무것도 담지 않으므로 아래 셋의 답이 이 Cycle 전과 한 글자도 다르지 않다.
    if (phases.standing) active.push(phases.standing);
    const season = phases.seasons?.[seasonAt(time)];
    if (season) active.push(season);
    const awake = disturbance?.phase === 'awake' ? phases.awake : undefined;
    if (awake) active.push(awake);
  }
  // C018 CHANGED (spec R4) — **지나는 것이 건 덧씌움**이 맨 나중이다. 방이 위상을 밝히지
  // 않았어도 지나는 것은 자기 덧씌움을 걸 수 있다 — 그것은 방의 성질이 아니라 지나가는
  // 것의 성질이기 때문이다 (그래서 위 phases 가 없어도 여기서 돌아서지 않는다).
  // 나중이므로 깊이가 겹치면 이쪽 열쇠가 이기고, 위험은 걸린 것이 전부 실린다.
  active.push(...passing);
  // C020 CHANGED (C020 spec R4) — **깨진 마디가 건 덧씌움**이 맨 나중이다. 방이 위상을
  // 밝히지 않았어도 · 아무것도 지나지 않아도 걸린다 — 그것은 방의 성질도 지나가는 것의
  // 성질도 아니라 **그 자리에 일어난 일**이기 때문이다. 나중이므로 깊이가 겹치면 이쪽
  // 열쇠가 이기고, 위험은 걸린 것이 전부 실린다 (지나는 것에 한 그대로).
  active.push(...depleted);
  return active;
}

/**
 * RULE-OBSERVE-PROJECTION (C016 CHANGED · C017 CHANGED · C018 CHANGED · spec R2 ·
 * C017 spec R4 · C018 spec R4) — **선 자리에 덧씌워진 깊이**. 철의 덧씌움 · **깨어남의
 * 덧씌움** · **지나는 것의 덧씌움**을 함께 본다 (원인 셋).
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
  disturbance: RegionDisturbanceState | undefined,
  // C018 ADDED — 지나는 것이 건 덧씌움들. 밝히지 않으면 지나는 것이 없다는 뜻이다
  // (빈 배열이 기본이므로 C017 까지의 부름은 한 글자도 달라지지 않는다).
  passing: readonly RegionPhase[] = [],
  // C020 ADDED — 깨진 마디가 건 덧씌움들 (passing 의 선례 그대로 · 빈 배열이 기본이므로
  // C019 까지의 부름은 한 글자도 달라지지 않는다).
  depleted: readonly RegionPhase[] = [],
): string | undefined {
  const overlay = activePhasesAt(regionId, time, disturbance, passing, depleted).flatMap(
    (phase) => phase.depthOverlay ?? [],
  );
  if (overlay.length === 0) return undefined;
  const spec = regionSpec(regionId);
  if (!spec) return undefined;

  // op id → 지금 이 area 가 읽히는 깊이. 밝히지 않은 area 는 이 표에 없다.
  // 같은 area 를 여럿이 함께 밝히면 **나중 것**이 표에 남는다 (철 → 깨어남 → 지나는 것) — 값 하나만
  // 실리는 자리이므로 둘을 다 낼 수 없고, 순서로 정하면 언제나 같은 답이다 (결정론).
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
 * RULE-STANDING-CONDITIONS-001 · RULE-DEPLETED-HAZARD-001
 * (C016 CHANGED · C017 CHANGED · C018 CHANGED · C020 CHANGED · spec R3 · C017 spec R4 ·
 * C018 spec R4 · C020 spec R4) — **선 자리에 덧씌워진 위험의 코드들**. 늘 서 있는 것 ·
 * 철 · 깨어남 · 지나는 것 · **깨진 마디**의 덧씌움을 함께 본다 (원인 다섯).
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
  disturbance: RegionDisturbanceState | undefined,
  // C018 ADDED — 지나는 것이 건 덧씌움들 (depthOverlayAt 의 선례 그대로).
  passing: readonly RegionPhase[] = [],
  // C020 ADDED — 깨진 마디가 건 덧씌움들 (depthOverlayAt 의 선례 그대로).
  depleted: readonly RegionPhase[] = [],
): string[] {
  const overlay = activePhasesAt(regionId, time, disturbance, passing, depleted).flatMap(
    (phase) => phase.hazardExtend ?? [],
  );
  if (overlay.length === 0) return [];
  const spec = regionSpec(regionId);
  if (!spec) return [];

  // 같은 area 를 여럿이 함께 밝히면 **전부** 실린다 (spec R4 경계 ②) — 위험은 값 하나가
  // 아니라 목록이므로 하나로 줄이지 않는다. 한 area 안의 순서는 철 → 깨어남 → 지나는 것이다.
  const byOp = new Map<string, string[]>();
  for (const entry of overlay) {
    const hazards = byOp.get(entry.areaId);
    if (hazards) hazards.push(entry.hazard);
    else byOp.set(entry.areaId, [entry.hazard]);
  }

  const tags: string[] = [];
  for (const area of areasOf(spec.space, HAZARD_LAYER)) {
    const hazards = byOp.get(area.id);
    if (hazards === undefined) continue;
    if (areaCoversPoint(area.shape, position.x, position.z)) tags.push(...hazards);
  }
  return tags;
}

/**
 * RULE-OBSERVE-RANGE-001 · RULE-STANDING-CONTACT-001 · RULE-DEPLETED-HAZARD-001
 * (C019 ADDED · C020 CHANGED · C019 spec R2 · R3 · C020 spec R4) —
 * **선 자리를 덮은 위험 자락들이 밝힌 것**.
 *
 * 자락은 지금까지 "여기는 무엇인가" 라는 코드 하나만 밝혔다. 이제 그 자락이 관찰자에게
 * **하는 일**도 밝힐 수 있다 — 관찰 범위를 좁히는 것(observeRange)과 닿아 있다는 말을
 * 얹는 것(contact)이다. 둘 다 밝히지 않은 자락은 지금까지와 한 값도 다르지 않다.
 *
 * **한 번 훑어 둘을 함께 낸다** — 같은 자락 목록을 두 번 훑으면 한 관찰 안에서 두 물음의
 * 답이 갈릴 수 있다 (투영이 passingOverlays 를 한 번만 얻는 그 어법 그대로).
 * 훑는 방식은 hazardOverlayTagsAt 과 **같다**: 컴파일 결과의 area 는 op id 를 잃으므로
 * 그 방 Description 의 HAZARD_LAYER area 를 op id 로 짚는다.
 *
 * 겹침을 다루는 규율이 둘로 갈린다.
 *   범위    **가장 좁은 것이 이긴다** (R2) — 값 하나만 실리는 자리이므로 전부 낼 수 없고,
 *           "덜 보이게 하는 쪽" 이 이겨야 자락을 겹쳐 놓는 것이 늘 더 좁아진다.
 *   접촉    **걸린 것이 전부 실린다** (R3) — 목록이므로 하나로 줄이지 않는다. 순서는
 *           Description 의 ops 차례다 (결정론 · 위험의 코드가 실리는 그 순서 그대로).
 *
 * 낮과 밤 중 어느 수를 읽을지는 **부르는 쪽이 준다** (night). 여기는 시계를 읽지 않는다 —
 * 때를 아는 자리는 clock.ts 하나이고, 이 함수는 자락이 밝힌 두 수 중 하나를 고를 뿐이다.
 * 그 값과 때가 주는 범위(밤 20 · C015) 중 어느 쪽이 이기는지는 투영이 정한다 (R2).
 *
 * 규칙은 그것이 눈보라인지 결정면인지 알지 못한다 — 자락이 밝힌 수와 글자를 옮길 뿐이다.
 */
export function hazardEffectsAt(
  regionId: string,
  position: WorldPosition,
  time: number,
  disturbance: RegionDisturbanceState | undefined,
  passing: readonly RegionPhase[],
  night: boolean,
  // C020 ADDED — 깨진 마디가 건 덧씌움들. 깨진 결정면의 **접촉 코드**가 여기로 실린다 —
  // 그 자락은 위험의 코드와 닿음의 코드를 함께 밝히므로 두 물음에 함께 답해야 한다.
  depleted: readonly RegionPhase[] = [],
): { observeRange?: number; contacts: string[] } {
  const overlay = activePhasesAt(regionId, time, disturbance, passing, depleted).flatMap(
    (phase) => phase.hazardExtend ?? [],
  );
  if (overlay.length === 0) return { contacts: [] };
  const spec = regionSpec(regionId);
  if (!spec) return { contacts: [] };

  // op id → 그 area 가 밝힌 것들. 같은 area 를 여럿이 함께 밝히면 **전부** 모인다
  // (위험의 코드가 그런 것과 같은 규율) — 줄이는 것은 아래에서 규율대로 한다.
  const byOp = new Map<string, HazardOverlay[]>();
  for (const entry of overlay) {
    const list = byOp.get(entry.areaId);
    if (list) list.push(entry);
    else byOp.set(entry.areaId, [entry]);
  }

  let observeRange: number | undefined;
  const contacts: string[] = [];
  for (const area of areasOf(spec.space, HAZARD_LAYER)) {
    const entries = byOp.get(area.id);
    if (entries === undefined) continue;
    if (!areaCoversPoint(area.shape, position.x, position.z)) continue;
    for (const entry of entries) {
      const range = entry.observeRange;
      if (range !== undefined) {
        const value = night ? range.night : range.day;
        // 가장 좁은 것이 이긴다 (R2) — 밝히지 않은 자락은 여기에 들어오지 않으므로
        // 아무것도 좁히지 않는다.
        if (observeRange === undefined || value < observeRange) observeRange = value;
      }
      // 걸린 것이 전부 실린다 (R3). 밝히지 않은 자락은 한 글자도 늘리지 않는다.
      if (entry.contact !== undefined) contacts.push(entry.contact);
    }
  }
  return observeRange === undefined ? { contacts } : { observeRange, contacts };
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
