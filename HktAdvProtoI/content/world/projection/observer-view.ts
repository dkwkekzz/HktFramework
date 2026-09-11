// Observer Projection — WorldState 를 관찰자 한 사람의 Semantic Snapshot 으로 투영한다.
// VIEW-MULTI-OBSERVER-001 (GameView Specification) 이 계약이다.
//
// 관찰 결과는 관찰자마다 만들어진다 (INTENT-PER-OBSERVER-PROJECTION-001).
//   세계의 사실(누가 어디 있고 무엇을 하는가)은 모든 관찰자에게 같고,
//   "어느 것이 내 몸인가"와 "나만의 것"(가용성 · 소지품)은 관찰자마다 다르다.
//
// 의미만 투영한다 — role/state/값/사유 코드. 표현(sprite·모션 파일·크기·라벨 형식·문구)은
// View 의 Presentation 결정 Layer 책임이며 여기 싣지 않는다.
//
// C001 CHANGED (02-world R6) — 관찰은 방으로 잘린다. scene = 관찰자의 몸이 선 Region 의 id 이고,
// 존재는 같은 Region 의 몸·원천(C011) + 그 Region 의 anchor 마다 region-exit 하나다. 목적지 Region 의 이름 ·
// Connector 의 방향 · 다른 방의 존재 · Graph 전체는 싣지 않는다 — "목적지는 건너야 안다".
//
// C016 CHANGED (RULE-OBSERVE-PROJECTION · spec R2 · R3 · R6) — **때가 방을 바꾼다.** 봉투에
// 새 자리는 하나도 나지 않고 이미 있는 자리의 **값**이 달라진다: 깊이가 방의 것이 아니라
// **선 자리**의 것이 되고, 안전의 코드 곁에 **위험의 코드**가 함께 실리며, 철 조건을 밝힌
// 원천은 그 철에만 실린다. **어느 철에 무엇이 달라지는지는 싣지 않는다** — 관찰자는 같은 방에
// 여러 철에 와 보고 그것을 배운다 (spec Observable · T8).
//
// C017 CHANGED (RULE-OBSERVE-PROJECTION · spec R8) — **여럿이 있었다는 것이 실린다.** 그 방의
// 소란(값 · 임계 · 위상)이 **늘** 실리고(규칙 있는 방에만 실리는 region.state 와 갈린다), 그 방에
// 남은 자국이 목록으로 실린다. 무엇이 소란을 올렸는지 · 무엇이 방을 깨웠는지 · 누가 자국을
// 남겼는지는 어디에도 없다 (spec R8 경계 ②) — 관찰자는 값과 자국을 보고 그것을 읽는다.
// 자국은 **밤에도 잘리지 않는다** (기본형 ⑥) — 밤이 자르는 것은 몸과 원천이고, 자국은 땅에
// 난 것이라 흙의 흔적과 같은 갈래다.
//
// C018 CHANGED (RULE-OBSERVE-PROJECTION · spec R9) — **그 방을 지금 지나는 것**이 실린다.
// 봉투에 자리가 하나 난다 (presences[] — 무엇이 · 어느 선으로). 관찰은 방으로 잘리므로 다른
// 방을 지나는 것은 실리지 않고, 지나가기 전과 지나간 뒤에는 빈 배열이다. **시간표도 남은
// 시간도 다음 방도 몇 번째 지나감인지도 싣지 않는다** — 세계는 "지금 여기를 무엇이 지난다"
// 까지만 말하고, 언제 다시 오는지도 어디로 갈지도 말하지 않는다 (T8 · spec Observable).
// 그리고 지나는 것이 건 위험 코드가 철·깨어남의 것과 **함께** standingConditions 에 실리고,
// 그것이 올린 소란은 C017 이 세운 그 자리(region.disturbance)에 그대로 실린다 — 새 자리는
// presences[] 하나뿐이다. 자국과 마찬가지로 **밤에 잘리지 않는다**: 하늘을 덮고 지나는
// 것은 몸도 원천도 아니라 방 전체의 사실이다.
//
// C015 CHANGED (RULE-OBSERVE-PROJECTION · spec R2) — 때가 밤이면 그 방 안을 한 번 더 자른다.
// 관찰자의 몸에서 OBSERVE_RANGE_NIGHT 보다 먼 **몸과 원천**은 실리지 않고 그것에 걸린
// 상호작용도 함께 빠진다. 낮에는 C014 까지와 한 줄도 다르지 않고, 밤에도 출구 · 방의 사실 ·
// standingConditions · HUD 는 자르지 않는다 — 관찰 결과의 **형**은 낮과 밤이 같다.
//
// C019 CHANGED (RULE-OBSERVE-RANGE-001 · RULE-STANDING-CONTACT-001 · C019 spec R2 · R3) —
// **선 자리의 자락도 방 안을 자른다.** 관찰 범위를 밝힌 위험 자락에 서면 그 거리 너머의 몸과
// 원천이 실리지 않는다 — 낮에도 그렇다. 자르는 자리는 C015 가 자르던 **그 자리 하나 그대로**이고
// (몸 · 원천 + 거기 걸린 상호작용) 봉투에 새 자리는 나지 않는다. 때가 주는 범위와 자락이 주는
// 범위 중 **좁은 쪽**이 이기고, 자락 여럿이 겹치면 그중 가장 좁은 것이 이긴다.
// 그리고 접촉 코드를 밝힌 자락에 선 동안 그 코드가 안전 · 위험의 코드 **뒤에 이어 붙는다** —
// 여기도 새 자리를 내지 않았다 (C016 이 위험의 코드를 안전의 코드 곁에 둔 그 판단의 연장).
// **왜 좁아졌는지도 지금 범위가 얼마인지도 어느 자락이 그것을 걸었는지도 싣지 않는다** —
// 관찰자는 앞이 안 보인다는 것과 발밑이 무엇인가만 알고, 그것을 잇는 것이 플레이다.
//
// C020 CHANGED (RULE-DEPLETED-HAZARD-001 · RULE-EXIT-REQUIREMENT-001 · C020 spec R4 · R5 · R6) —
// **봉투에 새 자리가 하나도 나지 않는다.** 이미 있는 자리의 값이 달라지고 목록이 늘 뿐이다:
// **깨진 마디**가 건 위험의 코드와 닿음의 코드가 철 · 소란 · 지나가는 것 · 늘 서 있는 것의
// 것과 **함께** standingConditions 에 실리고(위상을 거는 원인이 다섯째다), 요구를 밝힌 문의
// 출구 존재에 그 **요구의 코드**가 원천의 조건 코드가 실리는 그 자리로 실린다.
// **무엇이 그 요구를 채우는지도 · 어디서 나는지도 · 마디가 몇인지도 · 되돌아옴이 왜
// 빨라졌는지도 싣지 않는다** — 관찰자는 같은 자리에 여러 철에 와 보고 그것을 배운다.
//
// C034 CHANGED (RULE-OBSERVE-MEMORY-001 · RULE-OBSERVE-PROJECTION · C034 spec R6 · R7) —
// **방과 원천이 자기에게 일어난 일을 말한다.** 실리는 자리 둘이 난다: 캔 적 있는 원천의
// 셈(entities[].memory — 없으면 자리째 없다)과 그 방의 셈(region.memory — 소란처럼 늘 실린다).
// **무엇을 실을지 고르는 규칙은 한 줄도 바뀌지 않는다** (spec R7) — 밤의 범위도 자락의 범위도
// 그대로이고, 실리지 않는 방·원천의 기억은 따라서 실리지 않는다. **나이는 싣지 않는다**:
// 세계는 시각만 말하고 "N초 전" 은 관찰자가 짓는다 (자국의 since · rearrangedAt 의 선례).
// **누가 했는가는 실을 것이 없다** — 세계가 그것을 세지 않기 때문이다 (spec R6 경계 ③).
//
// C029 CHANGED (RULE-LOCK-TRACE-BODY-001 · RULE-LOCK-REASON-001 · C029 spec R2 · R3) —
// **여기서도 봉투에 새 자리가 나지 않는다.** 조건 코드가 실리던 그 자리(conditions)를 지는
// 존재가 셋이 된다: 원천(C012) · 출구 표식(C020) · 그리고 **몸**. 문 앞의 자락에 든 몸에
// 그 흔적이 밝힌 코드가 실리고, 자락 밖으로 나오면 다음 관찰에서 사라진다 — 저장되는 State 는
// 하나도 늘지 않는다. 그리고 출구 표식이 지던 코드가 **요구의 이름에서 현상으로** 바뀐다.
// **어느 것도 요구의 이름도 · 무엇이 그것을 채우는지도 · 답이 어디 있는지도 싣지 않는다** —
// 세계는 답을 알려 주지 않고, 알려 주는 것은 현상뿐이다.

import type {
  BirthMemoryView,
  EntityView,
  GameViewSnapshot,
  InteractionView,
  OpportunityView,
  PassageMemoryView,
  PresenceView,
  RegionDisturbanceView,
  RegionMemoryView,
  RegionStateView,
  SourceMemoryView,
  TrackView,
} from '../../protocol/gameview';
import { actionProgress, actionTargetId } from '../semantic/action';
import { HIDDEN_DISCOVERY } from '../../../engine/world-authoring/opportunity';
import { opportunityStanding } from '../semantic/opportunity-open';
import { worldClockAt } from '../semantic/clock';
import { actionCollider } from '../semantic/collision';
import { evaluateAttributeSetAvailability } from '../rules/attribute-set';
import { evaluateEmergencyReturnAvailability } from '../rules/emergency-return';
import { evaluateMinePreconditions } from '../rules/mine';
import { evaluateMoveAvailability } from '../rules/move';
import { evaluateMoveModeRun } from '../rules/move-mode';
import { evaluateSkillPreconditions } from '../rules/skill';
import { evaluateSummonPresenceAvailability } from '../rules/summon-presence';
import { evaluateTransitPreconditions } from '../rules/transit';
import { actorModifiers, isDowned, skillDefinition } from '../semantic/combat';
import { projectCommandCatalog } from '../semantic/command-catalog';
import { hasMiningTool, itemCount } from '../semantic/inventory';
import type { ItemKind } from '../semantic/item';
import {
  depletedOverlaysIn,
  isSourcePresentAt,
  sourceConditions,
  sourcePositionOf,
  sourceStateOf,
  sourcesInRegion,
} from '../semantic/resource';
import {
  NOT_A_SOURCE,
  lifeSiteStateOf,
  lifeSitesInRegion,
  lifeStandingCodesAt,
  lifeUnmetCodes,
  swarmAreasIn,
} from '../semantic/life';
import { passingIn, passingOverlaysIn } from '../semantic/presence';
import {
  bodyHazardEffects,
  bodyMaxCp,
  bodyMaxHp,
  standingBody,
} from '../semantic/body-property';
import { sourceMemoryConditionCodes } from '../semantic/condition';
import {
  depthOverlayAt,
  hazardOverlayTagsAt,
  standingConditionTagsAt,
} from '../semantic/region-phase';
import {
  anchorPosition,
  connectorReasonCodes,
  isConnectorOpen,
  lockTraceCodesAt,
  regionExitsOf,
  regionHash,
  regionSpecOf,
} from '../semantic/region';
import {
  initialMemory,
  regionRuleOf,
  type RegionMemory,
  type SourceMemory,
} from '../semantic/region-state';
// 재료 표는 content/regions 의 것이다 — HUD 의 자리 순서를 그 표가 정한다 (C011).
// 경로 표도 그 폴더의 것이다 — 방의 기억이 펴지는 차례를 그 표가 정한다 (C034).
// 기회의 표도 그 폴더의 것이다 — 어느 행동이 어느 기회에 속하는지를 그 표가 안다 (C036).
import { MATERIAL_SEEDS, PRESENCE_ROUTES, opportunityForAction } from '../../regions';
// C021 CHANGED — 안전의 코드는 이제 standingConditionTagsAt 이 낸다 (그 안에서
// conditionTagsAt 을 그대로 부른다 — 땅의 것은 여전히 땅의 것이다).
import { distance } from '../semantic/position';
import {
  actorOfObserver,
  DISTURBANCE_THRESHOLD,
  findObserver,
  isAttended,
  OBSERVE_RANGE_NIGHT,
  presentObserverCount,
  type WorldState,
} from '../semantic/world-state';

export const SPEC_ID = 'VIEW-BASIC-COMBAT-POLICY-001';

/**
 * RULE-OBSERVE-RANGE-001 (C019 ADDED · C019 spec R2) — 둘 중 **좁은 쪽**. 없는 것은 무제한이다.
 *
 * 때가 주는 범위와 자락이 주는 범위를 견주는 자리이고, 둘 다 없으면 방 전체다 (낮의 C015).
 * 한 자리에만 두는 이유는 하나다 — "좁은 쪽이 이긴다" 가 두 벌이 되면 낮과 밤이 다른 답을 낸다.
 */
function narrower(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

/**
 * RULE-OBSERVE-MEMORY-001 (C034 ADDED · spec R6) — 그 **원천**의 셈.
 *
 * 한 번도 캔 적 없는 원천에는 자리 자체가 없다 — 그 방의 기억에 그 열쇠가 없다는 것이
 * 그 사실이고, 여기서 0 으로 지어내면 "아무 일도 없었다" 와 "0 번 일어났다" 가 갈리지 않는다
 * (conditions? · collapsedSites? 가 그런 그대로).
 *
 * **나이를 싣지 않는다** (경계 ①) — 시각만 싣고 "N초 전" 은 관찰자가 잰다 (C028 의 어법).
 * **누가 캤는가는 실을 것이 없다** (경계 ③) — 세계가 세지 않기 때문이다.
 */
function sourceMemoryView(memory: SourceMemory | undefined): SourceMemoryView | undefined {
  if (!memory) return undefined;
  return {
    takenTotal: memory.takenTotal,
    depletedTimes: memory.depletedTimes,
    ...(memory.lastDepletedAt === undefined ? {} : { lastDepletedAt: memory.lastDepletedAt }),
  };
}

/**
 * RULE-OBSERVE-MEMORY-001 (C034 ADDED · spec R6) — 그 **방**의 셈.
 *
 * 원천의 것과 갈린다: 이것은 **늘 실린다** (disturbance 의 어법 그대로 — 어느 방에나 있는
 * 값이다). 아무 일도 없던 방은 셈이 0 이고 시각도 목록도 없다.
 *
 * 지나감은 **데이터 차례**(PRESENCE_ROUTES)로 편다 — State 의 열쇠 순회에 기대지 않는다
 * (결정론). 지난 적 있는 것만 서고, 실리는 것은 경로의 id 가 아니라 **지나는 것의 코드**다:
 * 관찰자가 알아야 하는 것은 "무엇이 몇 번 지났는가" 이고, 그 코드를 말로 옮기는 것은
 * View 의 표다 (원칙 2 · presences[] 가 싣는 그 코드와 같은 것).
 */
function regionMemoryView(regionId: string, memory: RegionMemory): RegionMemoryView {
  const passages: PassageMemoryView[] = [];
  for (const route of PRESENCE_ROUTES) {
    const passage = memory.passages[route.id];
    if (!passage) continue;
    passages.push({
      presence: route.presence,
      times: passage.times,
      ...(passage.lastAt === undefined ? {} : { lastAt: passage.lastAt }),
    });
  }
  // C037 ADDED (spec SPEC-007) — 태어남도 **데이터 차례**(그 방의 탄생지 차례)로 편다.
  // **태어난 적 있는 것만** 서고, 실리는 것은 탄생지의 id 가 아니라 **그 자리의 의미 코드**
  // (form)다 — 지나감이 경로의 id 대신 지나는 것의 코드를 싣는 그 어법 그대로이고, 문구로
  // 옮기는 것은 View 의 표다 (원칙 2 · 관찰 계약이 `formation` 을 의미 코드로 못 박았다).
  //
  // 되살린 옛 세계에는 이 자리 자체가 없을 수 있다 (STATE_VERSION 을 올리지 않았다 ·
  // spec 기본형 ④) — 그때는 아무것도 태어난 적이 없는 것과 같은 답이다 (셈이 0 · 목록이 비어 있다).
  const births: BirthMemoryView[] = [];
  for (const site of lifeSitesInRegion(regionId)) {
    const birth = memory.births?.[site.id];
    if (!birth) continue;
    births.push({
      formation: site.form,
      times: birth.times,
      ...(birth.lastAt === undefined ? {} : { lastAt: birth.lastAt }),
    });
  }
  return {
    turns: memory.turns,
    awakenings: {
      times: memory.awakenings.times,
      ...(memory.awakenings.lastAt === undefined ? {} : { lastAt: memory.awakenings.lastAt }),
    },
    passages,
    births,
  };
}

/**
 * RULE-OPPORTUNITY-NAME-001 (C036 ADDED · spec R1 · SPEC-004) — **이미 판정된 행동에 기회의
 * 이름을 붙인다.**
 *
 * IF 관찰이 어떤 Interaction 을 싣는다 AND 그 행동(동사)이 어느 기회의 possibleActions 에
 * 속하고 그 기회의 target 이 그 대상이다 THEN 그 Interaction 에 기회의 id 와 discovery 가
 * 실린다.
 *
 * **판정은 이 함수가 만지지 않는다** (경계) — available 도 reason 도 role 도 targetEntityId 도
 * 차례도 한 값 달라지지 않는다. 기회는 판정하지 않고 이름만 붙기 때문이다 (§4.5).
 * 그 대상에 기회가 없으면 **자리 자체가 없다** — 빈 값으로 지어내지 않는다 (조건 코드가
 * 그런 그대로). 탄생지의 채집은 원천이 아니므로 여기서 언제나 빈 자리다.
 *
 * availability 도 outcomes 도 progress 도 target 도 possibleActions 도 싣지 않는다 — 판은
 * 지목한 대상의 **이름과 발견**까지만 말한다 (spec Observable).
 *
 * C038 CHANGED (spec SPEC-001) — **아직 드러나지 않은 기회는 이름도 실리지 않는다.**
 * `HIDDEN` 은 "어떻게 알게 되는가" 의 넷째 값이고 그 뜻은 **아직 알 수 없다** 인데, 그것을
 * 실어 보내면 세계가 숨긴 것을 스스로 흘리게 된다. 거르는 자리를 판이 아니라 **여기**에 두는
 * 까닭은 원칙 1 · 3 이다 — View 는 독립 Client 이므로, 판이 그리지 않기로 하는 것으로는
 * 다른 Client 가 그것을 보는 것을 막지 못한다.
 *
 * **숨는 것은 기회의 이름이지 행동이 아니다** (SPEC-001 경계 ①) — 그 Interaction 은 지금처럼
 * 서고 available 도 reason 도 한 값 달라지지 않는다. 무엇이 그것을 드러내는가는 3층의 일이다.
 */
function opportunityNameOf(
  state: WorldState,
  regionId: string,
  action: string,
  targetRef: string,
): { opportunity: OpportunityView } | Record<string, never> {
  const opportunity = opportunityForAction(regionId, action, targetRef);
  if (opportunity === undefined) return {};
  if (opportunity.discovery === HIDDEN_DISCOVERY) return {};
  return {
    opportunity: {
      id: opportunity.id,
      discovery: opportunity.discovery,
      // C037 ADDED — 때가 있는가와 지금 열려 있는가 (RULE-OPPORTUNITY-OPEN-001 · 유도).
      // **판정(available · reason)은 이 둘을 한 값도 읽지 않는다** — 위 판정은 이미 났고
      // 여기는 그 곁에 세계의 사실 둘을 놓을 뿐이다 (C036 이 이름을 놓은 그 자리).
      ...opportunityStanding(state, opportunity),
    },
  };
}

// 관찰자가 세계에 없으면 관찰 결과도 없다 — 세계는 모르는 이에게 자신을 보여주지 않는다.
export function projectObserverView(
  state: WorldState,
  observerId: string,
): GameViewSnapshot | null {
  const observer = findObserver(state, observerId);
  const self = actorOfObserver(state, observerId);
  if (!observer || !self) return null;

  const entities: EntityView[] = [];
  const interactions: InteractionView[] = [];

  const region = regionSpecOf(self.regionId);

  // RULE-WORLD-CLOCK-001 (C015 ADDED) — 세계의 때. 세계 시각에서 유도되므로 관찰마다 다시 얻는다.
  const clock = worldClockAt(state.time);

  // RULE-REGION-PHASE-001 (C018 ADDED · spec R4) — 그 방을 지금 지나는 것이 건 덧씌움들.
  // 위상을 거는 원인이 셋째가 되었다 (철 · 소란 · 지나가는 것). 한 번 얻어 깊이와 위험
  // 두 물음에 같은 것을 넘긴다 — 두 번 물으면 한 관찰 안에서 답이 갈릴 수 있다.
  const passingOverlays = passingOverlaysIn(state.presences, self.regionId, state.time);

  // C017 ADDED — 그 방의 소란. **모든 방에 있다** (spec 기본형 ⑩) — 되살린 옛 세계에만 없을 수
  // 있으므로 물음표로 읽고, 없으면 아무 일도 겪지 않은 것과 같이 낸다 (없는 값을 지어내는 것이
  // 아니라 State 가 없다는 것이 곧 값 0 · 잠듦이다).
  // C019 CHANGED — 자리를 위로 옮겼다. 아래 자락의 물음이 이 값을 함께 보기 때문이다 —
  // 실리는 자리(region.disturbance)도 읽는 값도 한 톨도 달라지지 않는다.
  const disturbance = state.regionStates[self.regionId]?.disturbance;

  // C034 ADDED — 그 방의 **기억** (RULE-OBSERVE-MEMORY-001 · spec R6). 소란과 같은 어법으로
  // 모든 방에 있으므로 같은 자리에서 같이 읽는다 — 되살린 옛 세계에만 없을 수 있어 물음표로
  // 읽고, 없으면 아무 일도 겪지 않은 것과 같이 낸다 (State 가 없다는 것이 곧 빈 기억이다).
  // 아래에서 원천의 셈도 이것에서 꺼낸다 — 한 관찰 안에서 두 번 읽지 않는다.
  const history = state.regionStates[self.regionId]?.history ?? initialMemory();

  // RULE-DEPLETED-HAZARD-001 (C020 ADDED · C020 spec R4) — 그 방에서 **깨진 마디**들이 건
  // 덧씌움들. 위상을 거는 원인이 다섯째가 되었다 (철 · 소란 · 지나가는 것 · 늘 서 있는 것 ·
  // 고갈). passingOverlays 와 **같은 어법**으로 한 번만 얻어 아래 물음들에 같은 것을
  // 넘긴다 — 두 번 물으면 한 관찰 안에서 답이 갈릴 수 있다.
  const depletedOverlays = depletedOverlaysIn(state, self.regionId);

  // RULE-OBSERVE-RANGE-001 · RULE-STANDING-CONTACT-001 (C019 ADDED · C019 spec R2 · R3) —
  // 관찰자가 **선 자리**를 덮은 위험 자락들이 밝힌 것. 한 번만 물어 두 물음(무엇이 실리는가 ·
  // 걸린 것이 무엇인가)에 같은 것을 넘긴다 — 두 번 물으면 한 관찰 안에서 답이 갈릴 수 있다
  // (passingOverlays 를 한 번만 얻는 그 어법 그대로).
  // 낮과 밤 중 어느 수를 읽을지는 여기서 준다 — 때를 아는 자리는 시계 하나다.
  // C039 CHANGED — 인자를 조립하는 자리가 **한 함수**로 갔다 (semantic/body-property.ts 의
  // bodyHazardEffects). 몸의 인지 범위를 묻는 자리(자락이 거는 상한)가 같은 답을 보아야 하고,
  // 두 벌로 적으면 어느 날 갈린다. 이미 한 번 얻어 둔 덧씌움 둘은 그대로 넘긴다 — 답도
  // 인자도 한 값 다르지 않다 (낮밤은 저쪽이 같은 시계에서 읽는다).
  const hazardEffects = bodyHazardEffects(state, self, {
    passing: passingOverlays,
    // C020 ADDED — 깨진 결정면이 건 **접촉의 코드**가 여기로 실린다 (C020 spec R4).
    depleted: depletedOverlays,
  });

  /**
   * RULE-OBSERVE-PROJECTION (C015 CHANGED · spec R2) · RULE-OBSERVE-RANGE-001
   * (C019 CHANGED · C019 spec R2) — 방 안을 한 번 더 자른다.
   *
   * 자르는 범위는 둘 중 **좁은 쪽**이다.
   *   때가 주는 것    낮이면 무제한(방 전체) · 밤이면 OBSERVE_RANGE_NIGHT (C015 그대로)
   *   자락이 주는 것  선 자리를 덮은 자락들이 밝힌 값 중 가장 좁은 것. 밝힌 자락이 없으면 없다
   * 그래서 자락 밖은 C015 와 한 값도 다르지 않고(경계 ①), 자락 안에서는 **낮에도** 잘린다.
   * 거리는 같은 방 안의 (x, z) 평면 거리다 (RULE-MINE-001 이 재는 그 거리).
   *
   * 이름은 C015 가 지은 그대로 둔다 — 자르는 **자리**가 그때와 같은 하나이기 때문이다
   * (몸 · 원천 + 거기 걸린 상호작용). 이름을 바꾸면 자르는 자리가 늘어난 것처럼 읽힌다.
   */
  const observeRange = narrower(
    clock.dayPhase === 'DAY' ? undefined : OBSERVE_RANGE_NIGHT,
    hazardEffects.observeRange,
  );
  const withinNightRange = (position: { x: number; z: number }): boolean =>
    observeRange === undefined || distance(self.position, position) <= observeRange;

  // entities.character — 같은 Region 의 모든 Actor 를 같은 계약으로 투영한다 (cardinality: many).
  // role 만 보는 이에 따라 달라진다. 다른 방의 몸은 실리지 않는다 (C001 R6).
  for (const actor of state.actors) {
    if (actor.regionId !== self.regionId) continue;
    const isSelfBody = actor.id === self.id;
    // 밤이면 먼 몸은 실리지 않는다 (C015 CHANGED · spec R2).
    // **관찰자 자신의 몸은 밤에도 언제나 실린다** (spec R2 경계 ①) — 내 몸이 사라지면 볼 자리가 없다.
    if (!isSelfBody && !withinNightRange(actor.position)) continue;
    const progress = actionProgress(actor.currentAction);
    const target = actionTargetId(actor.currentAction);
    const isSelf = isSelfBody;
    const isOtherPlayer = !isSelf && actor.control === 'player';
    // Collision.ActionColliders — attack 진행 중에만 존재하는 파생 상태
    const swing = actionCollider(actor);
    // 모든 Actor 의 모든 속성을 싣는다. 가리는 경계를 두지 않는다
    // (INTENT-ATTRIBUTE-OBSERVE-001). 늘 화면에 띄울지는 View 의 선택이다.
    const modifiers = actorModifiers(actor);
    // RULE-LOCK-TRACE-BODY-001 (C029 ADDED · C029 spec R2 · SPEC-003) — **문 앞의 현상.**
    //
    // 그 방의 Lock 이 **몸에 보일 것을 밝힌** 흔적의 자락 안에 이 몸이 서 있으면 그 코드가
    // 실린다. 원천의 조건 코드가 실리는 그 자리를 그대로 쓴다 — 봉투에 새 자리를 내지
    // 않았다 (C020 이 출구 표식에 한 그대로). 걸린 것이 없으면 **자리 자체가 없다**
    // (빈 배열로 지어내지 않는다).
    //
    // **몸에만 싣는다** (경계 ①) — 차가운 것(원천 · 출구 표식)에는 어느 자리에서도 실리지
    // 않는다. 그것이 이 Cycle 의 대조다: 문 앞의 언 사체 곁 결정에는 김이 없다.
    // **관찰자 자신의 몸만이 아니다** (경계 ③) — 그 자락에 든 모든 몸에 실리므로, 남이 문
    // 앞에 선 것을 보고도 같은 것을 읽는다.
    //
    // 저장되지 않는 유도된 사실이다 — 자락 밖으로 걸어 나오면 다음 관찰에서 사라진다.
    // **무엇이 그것을 걸었는지도 · 그 문이 무엇을 묻는지도 · 김이 무엇을 뜻하는지도 싣지
    // 않는다** (spec Observable) — 관찰자는 자락을 들고 나며 그것을 읽는다.
    const bodyConditions = lockTraceCodesAt(actor.regionId, actor.position);

    entities.push({
      id: actor.id,
      role: isSelf
        ? 'player-character'
        : actor.control === 'player'
          ? 'other-player-character'
          : 'npc-character',
      state: actor.currentAction.kind, // idle | move | attack | heavy-attack | mine | hit | downed
      name: actor.name, // 불러 줄 이름
      kind: actor.characterKind,
      position: { x: actor.position.x, z: actor.position.z },
      vitality: {
        health: actor.hp,
        // C039 CHANGED — 최대는 저장된 필드가 아니라 **묻는 것**이다 (RULE-BODY-PROPERTY-001).
        // 실리는 자리도 값도 그대로다 — 봉투는 한 자리도 바뀌지 않았다.
        healthMaximum: bodyMaxHp(state, actor),
        downed: isDowned(actor),
      },
      attributes: {
        energy: actor.cp,
        energyMaximum: bodyMaxCp(state, actor), // C039 CHANGED — 위와 같은 까닭
        moveMode: actor.moveMode,
        control: actor.control,
        tempoStats: {
          moveSpeed: actor.moveSpeed,
          runSpeedMultiplier: actor.runSpeedMultiplier,
          actionSpeed: actor.actionSpeed,
        },
        modifiers: {
          energyCharge: modifiers.cpCharge,
          energyConsume: modifiers.cpConsume,
          moveSpeed: modifiers.moveSpeed,
          actionSpeed: modifiers.actionSpeed,
        },
      },
      ...(progress !== null ? { progress } : {}),
      ...(target ? { targetEntityId: target } : {}),
      // C029 ADDED — 문 앞의 자락에 든 몸에만 선다 (위 RULE-LOCK-TRACE-BODY-001)
      ...(bodyConditions.length > 0 ? { conditions: [...bodyConditions] } : {}),
      // Character.Attended — 다른 관찰자의 몸에만 의미가 있다.
      // 거짓이면 그 사람은 떠났고 몸만 세계에 남은 것이다 (INTENT-OBSERVER-LEAVE-001).
      ...(isOtherPlayer ? { attended: isAttended(state, actor.id) } : {}),
      // Collision.Bodies — 충돌체 관찰은 언제나 제공된다 (INTENT-COLLISION-OBSERVE-001).
      // 보일지 말지는 관찰자(View)의 선택이다.
      body: {
        radius: actor.bodyRadius,
        height: actor.bodyHeight,
        mass: actor.bodyMass,
        facing: { x: actor.facing.x, z: actor.facing.z },
        velocity: { x: actor.velocity.x, z: actor.velocity.z },
      },
      ...(swing
        ? {
            swing: {
              center: { x: swing.center.x, z: swing.center.z },
              radius: swing.radius,
              active: swing.active,
              struck: [...(actor.currentAction.struckActorIds ?? [])],
            },
          }
        : {}),
    });
  }

  // interactions — 모두 관찰자 자신의 몸을 주체로 판정된다 (interactions.subject: observer-character)
  const moveFailure = evaluateMoveAvailability(self);
  interactions.push({
    id: 'move',
    role: 'move-to',
    available: moveFailure === null,
    ...(moveFailure ? { reason: moveFailure } : {}),
  });

  // interactions.attack / skill-heavy — 대상이 없다. 무엇이 맞을지는
  // 요청할 때가 아니라 휘두름 구간의 접촉이 정한다.
  // profile(damage/charge/cost)이 함께 나간다 — 쓰기 전에 무엇이 오갈지 알아야
  // "지금 고급 스킬을 쓸 것인가" 를 판단할 수 있다 (INTENT-SELF-OBSERVE-001).
  const basicFailure = evaluateSkillPreconditions(self, 'attack');
  const basic = skillDefinition('attack');
  interactions.push({
    id: 'attack',
    role: 'skill-basic',
    available: basicFailure === null,
    ...(basicFailure ? { reason: basicFailure } : {}),
    profile: { damage: basic.damage, charge: basic.cpCharge, cost: basic.cpCost },
  });

  const heavyFailure = evaluateSkillPreconditions(self, 'heavy-attack');
  const heavy = skillDefinition('heavy-attack');
  interactions.push({
    id: 'skill-heavy',
    role: 'skill-heavy',
    available: heavyFailure === null,
    ...(heavyFailure ? { reason: heavyFailure } : {}),
    profile: { damage: heavy.damage, charge: heavy.cpCharge, cost: heavy.cpCost },
  });

  // interactions.moveMode — 지금 달릴 수 있는가. 걷기로 돌아오는 것은 언제나 된다.
  const runFailure = evaluateMoveModeRun(self);
  interactions.push({
    id: 'move-mode',
    role: 'set-move-mode',
    available: runFailure === null,
    ...(runFailure ? { reason: runFailure } : {}),
  });

  // interactions.setAttribute — 세계가 권한을 닫아 두면 가용하지 않다.
  const attributeFailure = evaluateAttributeSetAvailability(state);
  interactions.push({
    id: 'set-attribute',
    role: 'debug-set-attribute',
    available: attributeFailure === null,
    ...(attributeFailure ? { reason: attributeFailure } : {}),
  });

  // interactions.emergencyReturn — 그 방이 비상 자리를 밝혀 두었는가 (C009 ADDED · 01-spec R3).
  // 같은 판정이 commands 자리에도 실린다 (아래 projectCommandCatalog) — set-attribute 의 선례 그대로.
  // 어느 자리로 가는지는 싣지 않는다: 세계는 "걸 수 있는가" 만 말한다.
  const emergencyFailure = evaluateEmergencyReturnAvailability(self);
  interactions.push({
    id: 'emergency-return',
    role: 'emergency-return',
    available: emergencyFailure === null,
    ...(emergencyFailure ? { reason: emergencyFailure } : {}),
  });

  // entities.resource-source + interactions.mine — 그 방이 낳는 원천만 (C011 CHANGED · R5).
  //
  // RULE-OBSERVE-PROJECTION (C013 AFFECTED · spec R8) — state 가 셋이 되고(available ·
  // depleted · recovering), 자리는 **지금 마디**이며, 마디를 여럿 가진 원천에는 siteIndex 가,
  // 무너진 것이 있는 원천에는 collapsedSites 가 함께 실린다. 관찰은 여전히 방으로 잘린다.
  //
  // 광맥이 있던 자리에 원천이 온다. 다른 방의 원천은 실리지 않는다 — 목록 자체가 방으로
  // 잘려 나온다 (sourcesInRegion). 원천은 State 가 아니라 데이터에서 유도된 사실이므로
  // 매 관찰마다 같은 목록이 같은 순서로 나온다 (결정론).
  for (const source of sourcesInRegion(self.regionId)) {
    // RULE-RESOURCE-PLACEMENT-001 (C016 CHANGED · spec R6) — 철 조건을 밝힌 원천은 **그 철에만**
    // 선다. 다른 철에는 그 자리에 아무것도 없다 — entities 에도 mine 에도 실리지 않는다.
    // 밝히지 않은 원천 일곱은 어느 철에도 지금 그대로다 (spec SPEC-004 경계 ②).
    // 그 자리의 흔적(흙)은 여기서 달라지지 않는다 — 원천이 없다고 땅이 달라지지 않는다.
    if (!isSourcePresentAt(source, state.time)) continue;
    // 그 원천에 지금 걸린 조건들 (C012 ADDED · RULE-SOURCE-CONDITION-001).
    // 걸린 것이 없으면 **자리 자체가 없다** — 빈 배열로 지어내지 않는다.
    //
    // C014 CHANGED — 코드가 둘 는다(flow-arrived · condition-unmet). 그래서 세계 시각을
    // 함께 묻는다: 흐름이 지금 실어 오는 중인지는 시각에서 유도되기 때문이다 (spec R1).
    // 실리는 것은 여전히 **코드뿐**이다 — 주기도, 다음 활성까지 남은 시간도, 그 흐름이
    // 어느 방의 무엇에서 오는지도 싣지 않는다 (spec Observable).
    // C018 CHANGED (spec R7) — 지나가야 서는 원천은 그것이 지나고 있지 않은 동안
    // '아직 그때가 아니다'(C014 의 그 코드)를 진다. 그래서 지나감들의 지금을 함께 묻는다.
    const conditions = sourceConditions(
      state.regionStates,
      source,
      state.time,
      state.presences,
    );
    // C035 ADDED · RULE-CONDITION-HISTORY-001 — 원천이 밝힌 **기억 조건**이 서지 않을 때의 코드 하나가
    // 곁에 실린다. 기억 조건은 읽히고 말해질 뿐 열고 닫지 않는다 (spec SPEC-006 경계 ①) —
    // phase · 되돌아옴 · mine 의 전제는 이 줄을 읽지 않는다. 맨 나중에 붙는다 (차례는 결정적이다).
    conditions.push(...sourceMemoryConditionCodes(state, source));
    const sourceState = sourceStateOf(state.regionStates, self.regionId, source.id);
    // C013 ADDED — 지금 선 자리. 원천이 마디를 옮겨 다니므로 데이터의 마디 0 이 아니다.
    const here = sourcePositionOf(state.regionStates, source);
    // 밤이면 먼 원천은 실리지 않는다 — 그것에 걸린 mine 도 아래에서 함께 빠진다
    // (C015 CHANGED · spec R2). 거리는 **지금 마디**로 잰다 (RULE-MINE-001 과 같은 자리).
    if (!withinNightRange(here)) continue;
    const collapsedSites = sourceState.collapsedSites;
    // C034 ADDED — 그 원천에 일어난 일의 셈. 한 번도 캔 적 없으면 undefined 다.
    const sourceMemory = sourceMemoryView(history.sources[source.id]);

    entities.push({
      id: source.id,
      role: 'resource-source',
      // C012 CHANGED · C013 CHANGED — 캐고 난 자국과 되돌아옴이 여기 실린다. 셋 중 하나다
      // (available · depleted · recovering). taken 도 harvests 도 progress 도
      // recoverySeconds 도 싣지 않는다: 세계는 "지금 캘 수 있는가" 만 말하고 몇 번 남았는지도
      // **언제 돌아오는지도** 말하지 않는다 (spec Observable — 예보는 흙과 그림이 말한다).
      state: sourceState.phase,
      // kind 는 자연 형태(무엇처럼 생겼는가), material 은 그것이 무엇인가다 (SPEC-002).
      kind: source.form,
      material: source.materialId,
      position: { x: here.x, z: here.z },
      ...(conditions.length > 0 ? { conditions } : {}),
      // C013 ADDED — 마디를 여럿 가진 원천에만 지금 마디 번호를, 무너진 것이 있는 원천에만
      // 무너진 마디들을 싣는다. 없으면 **자리 자체가 없다** (0 이나 빈 배열로 지어내지 않는다).
      // 마디 목록도 그 좌표도 싣지 않는다 — 관찰자가 자기 content/regions 의 뿌리 곡선에서
      // 번호로 얻는다 (땅 · 흔적 · 붕괴를 스스로 얻는 C005~C007 · C011 · C012 의 규율 그대로).
      ...(source.sites.length > 1 ? { siteIndex: sourceState.siteIndex } : {}),
      ...(collapsedSites && collapsedSites.length > 0
        ? { collapsedSites: [...collapsedSites] }
        : {}),
      // RULE-OBSERVE-MEMORY-001 (C034 ADDED · spec R6) — **캔 적 있는 원천에만** 그 셈이
      // 함께 실린다. 한 번도 캔 적 없으면 자리 자체가 없다 (위 sourceMemoryView).
      // 실리지 않는 원천(밤의 범위 · 눈보라)의 기억도 실리지 않는다 — 자르는 규칙은 위
      // withinNightRange 하나 그대로이고 여기서 한 줄도 바뀌지 않았다 (경계 ②).
      ...(sourceMemory ? { memory: sourceMemory } : {}),
      // labelValue 를 싣지 않는다 — 세계 위에 글자가 없다 (C026 R4 RULE-QUIET-GROUND-001).
      // 되돌아오는 중인 자리에도 글자는 없다 (C013 R9) — 예보는 흙과 그림이 말하고,
      // 이름과 사유는 물었을 때 판이 답한다.
      // 무엇이 무엇에 매달렸는지 · 붕괴 자리의 모양 · 흔적의 세기도 싣지 않는다: 관찰자가
      // 자기 content/regions 와 실려 온 phase 로 스스로 얻는다 (spec Observable).
    });

    const failure = evaluateMinePreconditions(state, self, source);
    interactions.push({
      id: 'mine',
      role: 'harvest-source',
      targetEntityId: source.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
      // RULE-OPPORTUNITY-NAME-001 — 그 원천의 채집 기회. 위 판정(failure)은 이 줄을 읽지 않는다.
      ...opportunityNameOf(state, self.regionId, 'gather', source.id),
    });
  }

  // entities.life-site + interactions.mine — 그 방이 품은 **탄생지**들 (C022 ADDED ·
  // RULE-OBSERVE-PROJECTION · spec R5 · SPEC-002).
  //
  // **봉투에 새 자리는 나지 않는다** — 원천이 쓰는 그 자리들(role · state · kind · position ·
  // conditions)을 role 하나 다르게 쓸 뿐이다. 관찰은 여전히 방으로 잘리고, 목록 자체가
  // 데이터에서 유도되므로 매 관찰마다 같은 순서로 나온다 (결정론).
  //
  // 싣지 않는 것 — 결속과 머묾의 진행 · 그 길이 · 지금 비가 오는가 · 개체군의 값과 상한 ·
  // 요구의 목록 · 무엇이 태어나려 하는가 · 언제 태어나는가 · 무엇을 먹었는가 · 그 뒤에
  // 무엇이 남는가 · 계승과 결속 중 어느 쪽인가. 관찰자는 그림과 자락과 조건 코드로만
  // 그것을 읽는다 (spec Observable · Material · Time 의 규율 그대로).
  for (const site of lifeSitesInRegion(self.regionId)) {
    // 밤이면 먼 탄생지는 실리지 않는다 — 원천과 같은 잣대다 (C015 spec R2).
    if (!withinNightRange(site.position)) continue;
    // 지금 **모자란** 것들의 코드 (RULE-LIFE-CONDITION-001). 차 있는 것은 실리지 않고,
    // 하나도 모자라지 않으면 **자리 자체가 없다** — 원천의 조건 코드가 그런 그대로다.
    // 비가 시각에서 유도되므로 세계 시각을 함께 묻는다.
    const unmet = lifeUnmetCodes(state.regionStates, site, state.time);
    entities.push({
      id: site.id,
      role: 'life-site',
      // 지금 phase — 원천의 phase 가 실리는 그 자리이고 어휘만 다르다.
      // C023 CHANGED — 넷을 다 쓴다 (dormant | binding | born | spent). 진행도 길이도 싣지
      // 않는다: 세계는 "맺히는 중인가 · 터졌는가" 까지만 말하고, 결속인지 계승인지도
      // 말하지 않는다 — 그것은 kind(자연 형태)와 조건 코드로만 갈린다 (spec Observable).
      state: lifeSiteStateOf(state.regionStates, self.regionId, site.id).phase.toLowerCase(),
      // kind 는 자연 형태(무엇처럼 생겼는가) — 그림표가 이것을 읽는다
      kind: site.form,
      position: { x: site.position.x, z: site.position.z },
      ...(unmet.length > 0 ? { conditions: unmet } : {}),
      // labelValue 를 싣지 않는다 — 세계 위에 글자가 없다 (C026 R4 RULE-QUIET-GROUND-001).
      // 알집을 가리키는 아이콘도 타이머도 좌표도 어디에도 없다 (spec SPEC-003 경계 ③).
    });

    // RULE-MINE-001 (C022 AFFECTED · spec R6) — **알집은 원천이 아니다.** 캐기는 걸리지
    // 않고, 지목했을 때 대상 프레임이 그 사유를 답할 수 있어야 한다 (SPEC-002 경계 ①).
    // 판정할 것이 없으므로 사유는 언제나 같다 — 몸의 사정도 방의 사정도 묻지 않는다.
    interactions.push({
      id: 'mine',
      role: 'harvest-source',
      targetEntityId: site.id,
      available: false,
      reason: NOT_A_SOURCE,
    });
  }

  // entities.region-exit + interactions.transit — 이 Region 의 anchor 마다 하나 (C001 R6).
  // id 는 Connector 의 id, kind 는 transition. 건너간 뒤의 Region 은 어디에도 실리지 않는다.
  // exitsOf 의 순서(connectors 배열 순서) 그대로 낸다 (결정론).
  //
  // C002 CHANGED (02-world R2) — state 가 열림과 닫힘으로 갈린다. 여기까지가 표식이다.
  //
  // C009 CHANGED — 그 표식이 이제 **그 방의 지금 패턴 따라 바뀐다** (01-spec R1 · Observable).
  // 몸이 아무것도 하지 않아도 바뀌는 값이다 — 활성은 몸이 아니라 방의 State 가 정한다.
  // 어느 패턴이 그 문을 여는가는 여전히 싣지 않는다: 세계는 "지금 열렸는가" 만 말하고
  // "무엇이 그것을 열었는가" 는 말하지 않는다 (01-spec Observable · Region §17).
  // 싣지 않는 것: 경계(frontier) 목록 · 닫힌 Connector 목록 · 건너간 뒤 Region 의 id/이름 ·
  // Connector 의 방향. "아직 없는 곳" 은 표식이 아니라 요청의 대답(reason)으로만 드러난다 —
  // 경계를 가리키는 출구도 state 는 open 이다 (01-spec SPEC-007 경계).
  for (const exit of regionExitsOf(self.regionId)) {
    const here = anchorPosition(exit.here.region, exit.here.anchor);
    // C031 CHANGED — **몸이 선 자리를 함께 넘긴다** (RULE-LOCK-RELAXED-001 · spec R2).
    // 그 문의 Lock 이 완화를 밝혔고 자락 안이면 완화된 사유가 **대신** 실린다. 봉투에 새 자리를
    // 내지 않았다 — 실리는 곳은 아래 conditions 하나 그대로이고, 갈리는 것은 그 코드 하나다.
    const reasons = connectorReasonCodes(exit.connector.id, {
      regionId: self.regionId,
      position: self.position,
    });
    entities.push({
      id: exit.connector.id,
      role: 'region-exit',
      // C016 CHANGED (spec R4) — 그 표식을 **철도 함께** 정한다. 여전히 열림/잠김 둘뿐이고
      // **무엇이 그것을 열었는지는 말하지 않는다** (spec SPEC-003 경계 ④) — 어느 철에
      // 열리는지도, 잠긴 것과 지금이 그때가 아닌 것의 차이도 표식에는 없다.
      // 그 갈림은 붙어서 물었을 때 요청의 대답(reason)으로만 드러난다.
      // C039 CHANGED — **관찰자의 몸을 함께 넘긴다** (RULE-LOCK-ACTIVATION-001 · C039 규칙 6).
      // 문이 성질을 묻는다면 그 물음은 이 판 앞에 선 몸에게 가고, 그래서 같은 문이 몸에 따라
      // 달리 읽힌다. 표식은 여전히 열림/잠김 둘뿐이고 **무엇을 물었는지는 말하지 않는다**.
      state: isConnectorOpen(
        state.regionStates,
        exit.connector.id,
        state.time,
        standingBody(state, self),
      )
        ? 'open'
        : 'locked',
      kind: exit.connector.transition,
      position: { x: here.x, z: here.z },
      // RULE-LOCK-REASON-001 (C029 CHANGED — C020 의 RULE-EXIT-REQUIREMENT-001 이 서 있던
      // 그 자리 · C029 spec R3) — 그 문에 걸린 Lock 이 밝힌 **현상**의 코드들. 원천의 조건
      // 코드가 실리는 그 자리를 그대로 쓴다 — 봉투에 새 자리를 내지 않았다 (C020 기본형 ⑥).
      // 밝히지 않은 문은 **자리 자체가 없다** (빈 배열로 지어내지 않는다 · 원천이 그런 그대로).
      //
      // C029 에서 **그 코드가 무엇을 말하는가**가 바뀌었다 — 요구의 이름("저장된 열이 있어야
      // 한다")에서 현상("체열이 감지된다")으로. 자리도 형도 그대로다: 세계는 무엇을 가져오라
      // 말하지 않고 그 자리에서 일어나는 일만 말한다 (K8).
      //
      // C031 CHANGED — 그 코드가 **몸이 선 자리에 따라 갈린다** (spec SPEC-002). 눈보라 자락
      // 밖에서 지목하면 「체열이 감지된다」이고 자락 안이면 「눈보라 속에서 약하다」가 **대신**
      // 실린다 (둘이 함께 서지 않는다). 세계의 값은 한 톨도 달라지지 않고 저장되지도 않는다 —
      // 걸어 나오면 처음 말로 돌아온다. **무엇이 그것을 무르게 했는지는 싣지 않는다**:
      // 자락의 이름도 정도도 수치도 없다 (Observable — 이것이 이 Play 의 미지감이다).
      // 완화를 밝히지 않은 문은 어느 자리에서도 한 글자도 달라지지 않는다.
      //
      // **표시일 뿐이다** (spec R3 경계 ①) — 위의 state(open | locked)는 이 값을 한 값도
      // 읽지 않는다. 요구를 채워 열리지도, 밝혔다고 잠기지도 않으며, 무르게 되어도 그렇다.
      // 요구의 이름(축:관계)도 · 무엇이 그것을 채우는지도 · 어디서 나는지도 싣지 않는다 (경계 ②).
      ...(reasons.length > 0 ? { conditions: [...reasons] } : {}),
    });

    const failure = evaluateTransitPreconditions(state, self, exit);
    interactions.push({
      id: 'transit',
      role: 'transit-connector',
      targetEntityId: exit.connector.id,
      available: failure === null,
      ...(failure ? { reason: failure } : {}),
      // RULE-OPPORTUNITY-NAME-001 — **묻는 문**에만 기회가 있다 (Lock 이 없는 문은 자리가 없다).
      // 위 판정(failure)도 표식(state)도 이 줄을 읽지 않는다.
      ...opportunityNameOf(state, self.regionId, 'cross', exit.connector.id),
    });
  }

  const selfProgress = actionProgress(self.currentAction);
  const selfModifiers = actorModifiers(self);

  // 그 방이 규칙을 품고 있으면 그 방의 State 를 싣는다 (C008 R1 Feedback · SPEC-007).
  // 규칙 없는 방에서는 자리 자체가 없다 — 0 으로 지어내지 않는다 (SPEC-007 경계).
  // 임계값(pressureLimit)을 함께 싣는 것은 "얼마나 찼는가" 를 View 가 재기 위해서다.
  // 패턴 표는 싣지 않는다 — 관찰자가 자기 content/regions 에서 읽는다.
  // 그 방의 소란은 위에서 한 번 읽었다 (C017 ADDED · spec 기본형 ⑩ · C019 에서 자리만 위로).
  const disturbanceView: RegionDisturbanceView = {
    value: disturbance?.value ?? 0,
    // 임계를 함께 싣는 것은 "얼마나 찼는가" 를 View 가 재기 위해서다 (pressureLimit 의 선례).
    threshold: DISTURBANCE_THRESHOLD,
    phase: disturbance?.phase ?? 'dormant',
  };

  // C017 ADDED — 그 방의 자국들 (RULE-TRACK-001 · spec R8). 관찰은 방으로 잘리므로 목록 자체가
  // 그 방의 것이고, 하나도 없으면 빈 배열이다. **밤에 잘리지 않는다** (기본형 ⑥) —
  // withinNightRange 를 여기서 묻지 않는 것이 그 말이다. 순서는 난 순서 그대로다 (결정론).
  // 누가 남겼는지도 나이도 싣지 않는다 — 난 시각만 싣고 "얼마나 됐는가" 는 관찰자가 잰다.
  const tracks: TrackView[] = (state.regionStates[self.regionId]?.tracks ?? []).map((track) => ({
    at: { x: track.position.x, z: track.position.z },
    heading: { x: track.heading.x, z: track.heading.z },
    since: track.at,
  }));

  // C018 ADDED — 그 방을 지금 지나는 것들 (spec R9). 관찰은 방으로 잘리므로 목록 자체가
  // 그 방의 것이고, 하나도 없으면 빈 배열이다. 순서는 데이터 순서 그대로다 (결정론).
  // **밤에 잘리지 않는다** — 자국과 같은 이유다: 잘리는 것은 몸과 원천이고, 방을 덮고
  // 지나가는 것은 방 전체의 사실이다.
  //
  // C023 CHANGED (spec R5 · R6 · SPEC-006) — **서 있는 떼가 같은 자리에 실린다.** 봉투에
  // 새 자리는 나지 않는다: 지나는 것은 선(curve)으로, 서 있는 떼는 자락(area)으로 실릴 뿐이다.
  // 지나는 것이 먼저이고 그 뒤가 떼다 — 둘 다 데이터 순서 그대로이므로 매 관찰마다 같은
  // 목록이 같은 순서로 나온다 (결정론). **개체군의 값도 상한도 실리지 않는다** — 값이
  // 오를수록 뒤의 자락이 더 실릴 뿐이고, 그것을 읽는 것은 관찰자의 몫이다 (spec Observable).
  const presences: PresenceView[] = [
    ...passingIn(state.presences, self.regionId, state.time).map((here) => ({
      presence: here.presence,
      curve: here.curve,
    })),
    ...swarmAreasIn(state.regionStates, self.regionId).map((swarm) => ({
      presence: swarm.presence,
      area: swarm.area,
    })),
  ];

  const regionRule = regionRuleOf(self.regionId);
  // C012 CHANGED — 방의 State 가 규칙과 원천을 함께 든다. 여기가 싣는 것은 규칙 쪽뿐이다.
  const regionRuleState = state.regionStates[self.regionId]?.rule;
  const regionStateView: RegionStateView | undefined =
    regionRule && regionRuleState
      ? {
          pattern: regionRuleState.pattern,
          pressure: regionRuleState.pressure,
          pressureLimit: regionRule.pressureLimit,
          ...(regionRuleState.rearrangedAt === undefined
            ? {}
            : { rearrangedAt: regionRuleState.rearrangedAt }),
        }
      : undefined;

  return {
    specId: SPEC_ID,
    scene: self.regionId, // C001 — 관찰자의 몸이 선 Region
    // observer.self — 화면 속 여러 몸 중 어느 것이 내 것인지 알려면 이것이 필요하다.
    // acknowledgedMark — 세계가 나에게서 어디까지 받았는가.
    // 이것만이 세계가 이어짐에 대해 알려주는 값이다. 나머지 수치는 관찰자가 잰다.
    observer: {
      id: observerId,
      characterId: self.id,
      acknowledgedMark: observer.acknowledgedMark,
    },
    entities,
    interactions,
    hud: [
      // 내 몸의 것만 실린다. 다른 관찰자의 소지품과 가용성은 실리지 않는다
      // (INTENT-PER-OBSERVER-PROJECTION-001).
      // 지닌 재료마다 자리 하나 (C011 CHANGED · SPEC-010). **0 인 재료의 자리는 없다** —
      // 0 으로 지어내면 "세지 않은 것" 과 "없는 것" 을 화면이 가르지 못한다.
      // 순서는 MATERIAL_SEEDS 의 순서 그대로다 (결정론).
      ...MATERIAL_SEEDS.flatMap((seed) => {
        const count = itemCount(self.inventory, seed.id as ItemKind);
        return count > 0
          ? [{ id: `inventory.${seed.id}`, kind: 'counter' as const, value: count }]
          : [];
      }),
      { id: 'tool.hasMiningTool', kind: 'flag', value: hasMiningTool(self.inventory) },
      {
        id: 'player.action',
        kind: 'label',
        value: self.currentAction.kind,
        ...(selfProgress !== null ? { progress: selfProgress } : {}),
      },
      // World.Time — 세계가 자기 시계로 어디까지 왔는가.
      { id: 'world.time', kind: 'counter', value: state.time },
      // Observers.PresentCount — 지금 이 세계를 함께 보고 있는 사람의 수 (나 포함).
      // 누가 있는지(이름)는 실리지 않는다 — 이번 Cycle 의 의미가 아니다.
      { id: 'observers.present', kind: 'counter', value: presentObserverCount(state) },
      // hud.self — 같은 값을 남에 대해서도 볼 수 있다 (entities[].attributes).
      // 여기가 특별한 것은 "늘 눈앞에 있다" 는 점뿐이다.
      { id: 'self.hp', kind: 'counter', value: self.hp },
      // C039 CHANGED — 묻는 값이 실린다 (자리도 값도 그대로 · RULE-BODY-PROPERTY-001)
      { id: 'self.hpMax', kind: 'counter', value: bodyMaxHp(state, self) },
      { id: 'self.cp', kind: 'counter', value: self.cp },
      { id: 'self.cpMax', kind: 'counter', value: bodyMaxCp(state, self) },
      { id: 'self.downed', kind: 'flag', value: isDowned(self) },
      { id: 'self.moveMode', kind: 'label', value: self.moveMode },
      { id: 'self.tempo.moveSpeed', kind: 'counter', value: self.moveSpeed },
      { id: 'self.tempo.runSpeedMultiplier', kind: 'counter', value: self.runSpeedMultiplier },
      { id: 'self.tempo.actionSpeed', kind: 'counter', value: self.actionSpeed },
      { id: 'self.modifier.cpCharge', kind: 'counter', value: selfModifiers.cpCharge },
      { id: 'self.modifier.cpConsume', kind: 'counter', value: selfModifiers.cpConsume },
      { id: 'self.modifier.moveSpeed', kind: 'counter', value: selfModifiers.moveSpeed },
      { id: 'self.modifier.actionSpeed', kind: 'counter', value: selfModifiers.actionSpeed },
      // Region.depth — 깊이 태그만 준다. 문구(방 이름 · "문명의 경계를 넘었다")는 View 의 표가 정한다 (C001 R6).
      //
      // RULE-OBSERVE-PROJECTION (C016 CHANGED · spec R2) — 이 값이 방의 깊이가 아니라
      // **내가 선 자리**의 깊이가 된다. 지금 철의 덧씌움이 그 자리를 덮으면 그 값이고,
      // 덮지 않으면 방의 깊이 그대로다 (C001 부터 그대로 · 덧씌움을 밝히지 않은 방은
      // 어느 철에도 지금과 한 값도 다르지 않다). **실리는 자리는 그대로다** — 새 자리가
      // 나지 않고, 그것이 덧씌워진 것인지 방의 것인지도 싣지 않는다 (spec Observable).
      {
        id: 'region.depth',
        kind: 'label',
        // C017 CHANGED — 철의 덧씌움과 **깨어남의 덧씌움**을 함께 본다 (spec R4).
        // C018 CHANGED — 지나는 것의 덧씌움까지 함께 본다 (원인 셋 · spec R4).
        value:
          depthOverlayAt(
            self.regionId,
            self.position,
            state.time,
            disturbance,
            passingOverlays,
            // C020 CHANGED — 깨진 마디의 덧씌움까지 함께 본다 (원인 다섯 · C020 spec R4).
            // 지금 그것을 밝힌 자락은 깊이를 걸지 않으므로 이 값은 한 톨도 달라지지 않는다.
            depletedOverlays,
          ) ?? region.depth,
      },
    ],
    // 관찰자의 몸이 선 Region — hash 는 Description 에서 결정적으로 나온다 (C001 R6).
    region: {
      id: self.regionId,
      hash: regionHash(self.regionId),
      ...(regionStateView ? { state: regionStateView } : {}),
      // 그 방의 소란 — **늘 실린다** (C017 ADDED · spec 기본형 ⑩). state? 와 갈리는 유일한
      // 자리이고, 갈리는 이유는 하나다: 소란은 그 방이 무엇을 품었는지와 무관하게 어느 방에나
      // 있는 값이다. 무엇이 그것을 올렸는지도 무엇이 방을 깨웠는지도 싣지 않는다.
      disturbance: disturbanceView,
      // 그 방의 **기억** — 소란과 같이 **늘 실린다** (C034 ADDED · spec R6). 어느 방에나
      // 있는 값이기 때문이다. **누가 했는가는 실을 것이 없고**(세계가 세지 않는다) 나이도
      // 싣지 않는다 — 시각만 싣고 "N초 전" 은 관찰자가 잰다 (자국의 since 가 그런 그대로).
      memory: regionMemoryView(self.regionId, history),
    },
    // RULE-SAFEBY-001 (C006 R4) — 몸이 선 자리에 걸린 안전의 조건들.
    // 매 관찰마다 그 방의 땅에서 유도된다 — 세계 State 에는 없다. 아무 area 에도 들지 않았으면
    // 빈 배열이고, 겹쳐 있으면 걸린 것이 전부 실린다. 이것은 hud 가 아니라 봉투의 새 자리다.
    //
    // RULE-STANDING-CONDITIONS-001 (C016 CHANGED · spec R3) — 지금 철의 위험 덧씌움이 그 자리를
    // 덮으면 그 **위험의 코드**가 안전의 코드와 **함께** 실린다. "왜 여기가 안전한가" 와
    // "왜 여기가 위험한가" 는 "여기는 무엇인가" 라는 한 물음의 두 얼굴이므로 자리를 나누지
    // 않는다 — 나누면 판이 두 번 말한다. 안전의 코드는 한 값도 바뀌지 않고(spec R3 경계 ①),
    // 겹치면 걸린 것이 전부 실린다 (C006 의 경계 그대로).
    standingConditions: [
      // RULE-CONDITION-WEAKEN-001 (C021 CHANGED · C021 spec R1 · R5 · SPEC-001) — 안전의 코드
      // 가운데 **이음을 넘어 온 것**에 덮인 자락의 것이 옅어진 채로 실린다. 봉투에 새 자리를
      // 내지 않았다: 옅어진 것이 안전의 코드를 **대신** 서므로 실리는 개수도 차례도 그대로다
      // (기본형 ①). 넘어 온 것이 없으면 C006 의 답과 한 값도 다르지 않다.
      // **무엇이 그것을 약하게 했는지 · 어디서 왔는지 · 무엇이 실어 왔는지는 싣지 않는다**
      // (기본형 ② · spec Observable) — 그것을 잇는 것이 관찰자의 일이다.
      ...standingConditionTagsAt(self.regionId, self.position, state.time),
      // C017 CHANGED — 깨어남의 위험 코드가 철의 것과 **함께** 실린다 (spec R4 경계 ②).
      // C018 CHANGED — 거기에 **지나는 것이 건 위험 코드**가 더해진다. 걸린 것이 전부
      // 실린다는 어법은 그대로이고, 원인이 셋이 된 것뿐이다.
      // C020 CHANGED — 거기에 **깨진 마디가 건 위험 코드**가 더해진다. 걸린 것이 전부
      // 실린다는 어법은 그대로이고, 원인이 다섯이 된 것뿐이다 (C020 spec R4 경계 ②).
      ...hazardOverlayTagsAt(
        self.regionId,
        self.position,
        state.time,
        disturbance,
        passingOverlays,
        depletedOverlays,
      ),
      // RULE-STANDING-CONTACT-001 (C019 ADDED · C019 spec R3) — 접촉 코드가 **안전의 코드 ·
      // 위험의 코드 뒤**에 이어 붙는다. 봉투에 새 자리를 내지 않았다: 위험의 코드가 "이 자리가
      // 무엇인가" 라면 이것은 "지금 내가 그것에 닿아 있다" 이고, 둘은 여전히 "여기는 무엇인가"
      // 라는 한 물음의 얼굴이라 판이 두 번 말하지 않는다. 밝힌 자락이 없으면 한 글자도 늘지
      // 않고, **몸의 값은 한 톨도 달라지지 않는다** — 2층이 하는 것은 말하는 것까지다.
      ...hazardEffects.contacts,
      // RULE-LIFE-SITE-PHASE-001 (C022 ADDED · spec R4 · SPEC-003 ④) — **결속하는 탄생지의
      // 자락 위에 선 동안** 그 자락이 밝힌 코드가 접촉의 코드 **뒤**에 이어 붙는다.
      // 봉투에 새 자리를 내지 않았다: C019 의 접촉 코드와 같은 자리이고 같은 말이다
      // ("지금 내가 그것에 닿아 있다"). 위험 태그를 만들지 않으므로 **몸의 값은 한 톨도
      // 달라지지 않는다** — 2층이 하는 것은 말하는 것까지다 (spec 기본형 ⑧).
      ...lifeStandingCodesAt(state.regionStates, self.regionId, self.position),
    ],
    // 그 방에 남은 자국들 (C017 ADDED · RULE-TRACK-001 · spec R8).
    tracks,
    // 그 방을 **지금 지나는 것들** (C018 ADDED · RULE-OBSERVE-PROJECTION · spec R9).
    presences,
    // World.Clock — 세계의 때 (C015 ADDED · RULE-WORLD-CLOCK-001 · spec Observable).
    // 세계에 하나이고 관찰자마다 같다. 세계 시각 자체도, 철이 언제 시작하고 끝나는지도,
    // 남은 시간도 다음 철도 여기 없다 — 「때」와 「철」 두 줄의 **문구**를 만드는 것도
    // 세계가 아니라 View 다 (원칙 2). HUD 는 한 줄도 늘지 않는다.
    clock,
    // World.StrikeEvents — 남의 타격 결과도 보인다. 세계가 판정을 마친 값이다.
    strikes: state.strikeEvents.map((event) => ({
      attackerId: event.attackerId,
      targetId: event.targetId,
      skill: event.skill,
      amount: event.amount,
      at: { x: event.position.x, z: event.position.z },
      since: event.time,
    })),
    // World.DebugAuthority — 이 세계가 조작을 허용하는가.
    debug: {
      open: state.debugAuthority.open,
    },
    // World.CommandCatalog — 세계 밖에서 무엇을 걸 수 있는지 세계가 밝힌다.
    // 늘 실린다: 걸 수 있는 것은 언제나 먼저 밝혀져 있어야 하고 (INTENT-COMMAND-CATALOG-001),
    // available 이 거짓이어도 무엇을 할 수 있는 세계인지는 알 수 있어야 한다.
    // 무엇을 어디까지 바꿀 수 있는지(구 mutableAttributes)는 set-attribute 가 받는
    // 값의 Domain 으로 이 안에 들어 있다 — View 가 목록을 만들지 않는다는 규율은 그대로다.
    // C009 CHANGED — 명령이 둘이 되었고 가용성 판정도 둘이다. 판정 자체는 각 Rule 이 소유하고
    // (evaluateAttributeSetAvailability · evaluateEmergencyReturnAvailability) 여기는 잇기만 한다 —
    // 그래서 "가용하다고 밝혀 놓고 걸면 거절하는" 일이 생기지 않는다.
    // 목록은 둘 다 늘 실린다: available 이 거짓이어도 무엇을 걸 수 있는 세계인지는 밝혀져 있다.
    commands: projectCommandCatalog((commandId) => {
      if (commandId === 'set-attribute') return evaluateAttributeSetAvailability(state);
      if (commandId === 'emergency-return') return evaluateEmergencyReturnAvailability(self);
      // C018 ADDED — 부르기. 판정은 Rule 이 소유하고 여기는 잇기만 한다 (C009 의 선례).
      if (commandId === 'summon-presence') return evaluateSummonPresenceAvailability(state);
      return null;
    }),
  };
}
