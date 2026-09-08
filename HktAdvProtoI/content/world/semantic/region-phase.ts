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
// C021 CHANGED — **위상이 자기 방을 넘는 자리가 하나 났다** (C021 spec R2). 지금까지 덧씌움은
// 언제나 그 방 안의 자락을 가리켰다 — 깊이도 위험도 그 방의 일이었다. outflow 만이 **남의 방**의
// 조건 자락을 가리키고, 그래서 자리를 묻는 새 함수(standingConditionTagsAt)가 자기 방의 위상이
// 아니라 **자기를 가리킨 다른 방의 위상**을 훑는다. 넘어가는 것은 조건의 약화 하나이고,
// 깊이와 위험의 덧씌움은 한 줄도 바뀌지 않는다 (C021 spec R2 경계). 여기는 여전히 어느 방이
// 어느 방에 무엇을 보내는지 이름으로 알지 못한다 — 데이터가 가리킨 것을 그래프에서 확인하고
// 자리를 물을 뿐이다.
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
  REGION_SPECS,
  SETTLEMENT_LAYER,
  regionSpec,
  weakenedConditionTag,
  type ConditionOutflow,
  type HazardOverlay,
  type RegionPhase,
  type SeasonId,
} from '../../regions';
import type { WorldClockView } from '../../protocol/gameview';
import { seasonAt } from './clock';
import type { WorldPosition } from './position';
import { connectorLinks } from './region';
import type { RegionDisturbanceState } from './region-state';
import { conditionTagsAt } from './terrain';

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
 * RULE-CONDITION-WEAKEN-001 (C021 ADDED · spec R1 · R2 · SPEC-001 ~ SPEC-003) —
 * **선 자리의 안전 코드들**, 이음을 넘어 온 것이 있으면 옅어진 채로.
 *
 * 넘어 온 것이 없으면 `conditionTagsAt`(C006)과 **한 값도 다르지 않다** — 순서도 개수도
 * 글자도 그대로다. 그래서 이 함수를 부르지 않던 자리를 이것으로 바꿔도 지금까지의 세계는
 * 한 값도 달라지지 않는다 (spec SPEC-001 경계 ① ②).
 *
 * **conditionTagsAt 을 한 줄도 고치지 않고 그 위에 세운다** — 안전의 코드는 여전히 **땅의
 * 것**이고(C006 RULE-SAFEBY-001), 이 함수가 하는 일은 그중 덮인 것의 이름을 옅은 짝으로
 * 바꾸는 것 하나다. 코드가 사라지지도 위험이 되지도 않는다 (spec R1 경계 ①).
 *
 * **위상이 자기 방을 넘는 자리다** (spec R2 CHANGED). 지금까지 자리를 묻는 쪽은 자기 방의
 * 위상만 보았다 — 여기서 처음으로 **자기를 가리킨 다른 방의 위상**을 함께 본다. 넷을
 * 차례로 확인하고 하나라도 어긋나면 아무 일도 하지 않는다 (spec R1 · SPEC-002 경계 ①).
 *   ① 어느 방의 지금 위상이 이 방을 가리킨 outflow 를 밝혔는가
 *   ② 그 이음이 **이 방을 실제로 잇는가** (connectorLinks · 방향은 묻지 않는다 · 아래 비고)
 *   ③ 가리킨 area op 가 이 방 Description 의 settlement layer 에 있는가
 *   ④ 그 area 가 선 자리를 덮는가 (걸린 것은 서야 참이다)
 *
 * ② 의 비고 — **밝히는 이음이 하나다** (spec 기본형 ③). 추위는 이음을 잇달아 넘어 오는데
 * 데이터가 밝히는 것은 **받는 방에 닿는 마지막 이음** 하나이고, 이음을 잇는 길 전체를 세우는
 * 것은 이 Cycle 의 일이 아니다 (그 길찾기는 세계에 없다). 그래서 확인하는 것은 "그 이음이
 * 실제로 두 방을 잇는가 · 그 두 방 중 하나가 이 방인가" 이다 — 밝힌 방과 받는 방을 곧장
 * 잇는 이음이면 그것도 이 확인을 지나므로(밝힌 방도 세계가 아는 방이다), 이음이 하나로 닿는
 * 훗날의 덧씌움도 같은 규칙으로 걸린다.
 *
 * **읽는 위상은 상시(standing)와 지금 철(seasons)의 것뿐이다.** 깨어남 · 지나는 것 · 깨진
 * 마디의 덧씌움을 보지 않는 이유는 둘이다 — ① 그것들은 State 이고 이 함수는 자리와 시각만
 * 받는다, ② 그래서 답이 **저장되는 것에 한 톨도 매이지 않는다**: 되살린 세계도 같은 시각에
 * 같은 답을 낸다 (spec SPEC-001 경계 ③). 남의 방의 State 를 읽기 시작하면 그 방을 아직 한
 * 번도 서 보지 않은 관찰자의 발밑이 남의 방 사정으로 달라진다.
 *
 * 훑는 방식은 `hazardOverlayTagsAt` 과 **같다** — 컴파일 결과의 area 는 op id 를 잃으므로
 * 이 방 Description 의 SETTLEMENT_LAYER area 를 op id 로 짚고, 차례는 ops 차례다 (결정론).
 * 겹쳐 온 것이 여럿이어도 답은 하나다: 옅어진 것은 옅어진 것이고 두 번 옅어지지 않는다.
 *
 * 규칙은 어느 방이 어느 방에 무엇을 보내는지 이름으로 알지 못한다 — 데이터가 가리킨 것을
 * 그래프에서 확인하고 자리를 물을 뿐이다 (spec R1 비고 · C004 가 세운 규율).
 */
export function standingConditionTagsAt(
  regionId: string,
  position: WorldPosition,
  time: number,
): string[] {
  const tags = conditionTagsAt(regionId, position);
  if (tags.length === 0) return tags;

  // ① ② 이 방을 가리켰고 이음이 실제로 이 방을 잇는 것들만 모은다. 세계가 모르는 방이
  // 가리킬 수는 없으므로(REGION_SPECS 를 훑는다) 없는 방이 건 줄은 여기 들어오지 못한다.
  const arrived: ConditionOutflow[] = [];
  for (const spec of REGION_SPECS) {
    for (const phase of outflowPhasesOf(spec.id, time)) {
      for (const entry of phase.outflow ?? []) {
        if (entry.region !== regionId) continue;
        if (!connectorReaches(entry.throughConnector, regionId)) continue;
        arrived.push(entry);
      }
    }
  }
  if (arrived.length === 0) return tags;

  // ③ ④ 가리킨 자락이 이 방에 있고 선 자리를 덮는가 — 그 자락의 태그가 옅어질 것이다.
  // 없는 area 를 가리킨 줄은 이 훑기에서 한 번도 맞지 않으므로 조용히 빠진다.
  const spec = regionSpec(regionId);
  if (!spec) return tags;
  const weakened = new Set<string>();
  for (const area of areasOf(spec.space, SETTLEMENT_LAYER)) {
    if (!arrived.some((entry) => entry.areaId === area.id)) continue;
    if (!areaCoversPoint(area.shape, position.x, position.z)) continue;
    weakened.add(area.tag);
  }
  if (weakened.size === 0) return tags;

  // 옅어진 것이 안전의 코드를 **대신한다** (spec 기본형 ①) — 곁에 함께 서지 않는다.
  // 유효한 것이 하나여야 "약해졌다" 가 한눈에 읽히고, 판이 같은 것에 두 번 답하지 않는다.
  // 자리와 차례는 그대로다: 덮이지 않은 조건은 글자 하나 달라지지 않는다 (경계 ②).
  return tags.map((tag) => (weakened.has(tag) ? weakenedConditionTag(tag) : tag));
}

/**
 * RULE-CONDITION-WEAKEN-001 (C021 ADDED · spec SPEC-002 · 기본형 ③) —
 * **그 이음이 이 방을 잇는가.**
 *
 * 판정은 `connectorLinks` 하나가 낸다 — 여기가 하는 일은 그 물음을 세계가 아는 방들에 대해
 * 한 번씩 묻는 것뿐이다. 참이려면 그 이음이 **실제로 두 방을 잇고** 그 두 방 중 하나가 이
 * 방이어야 한다: 없는 이음도(connectorLinks 가 거짓) 아직 짓지 않은 곳으로만 난 이음도
 * (저쪽이 REGION_SPECS 에 없다) 아무것도 걸지 못한다.
 *
 * 밝힌 방과 받는 방을 곧장 잇는 이음이면 이 물음도 참이다 — 밝힌 방 역시 세계가 아는 방이기
 * 때문이다. 그래서 이 판정은 지금의 데이터(잇달아 넘는 길의 마지막 이음 하나)와 훗날의
 * 데이터(한 이음으로 닿는 덧씌움) 둘 다를 같은 한 줄로 받는다.
 */
function connectorReaches(connectorId: string, regionId: string): boolean {
  return REGION_SPECS.some((spec) => connectorLinks(connectorId, regionId, spec.id));
}

/**
 * RULE-CONDITION-WEAKEN-001 (C021 ADDED) — 그 방이 **지금 남에게 걸고 있는** 위상들.
 *
 * 상시의 것과 지금 철의 것 둘뿐이다 (위 standingConditionTagsAt 의 주석이 그 까닭을 진다).
 * 위상을 밝히지 않은 방 · 그 철의 열쇠가 없는 방은 빈 목록이고, 그것이 곧 "밝히지 않은 방은
 * 어느 철에도 다른 방에 아무것도 걸지 않는다" 이다 (spec SPEC-002 경계 ②).
 */
function outflowPhasesOf(regionId: string, time: number): RegionPhase[] {
  const phases = regionSpec(regionId)?.phases;
  if (!phases) return [];
  const active: RegionPhase[] = [];
  if (phases.standing) active.push(phases.standing);
  const season = phases.seasons?.[seasonAt(time)];
  if (season) active.push(season);
  return active;
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
