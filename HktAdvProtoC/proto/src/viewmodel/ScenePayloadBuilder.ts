// 화면별 빌더의 진입점 (Phase-8 §8.0·§8.1)
//
// §36.2 지도 · §36.3 주체 관찰 · §36.4 사건 — 세 화면의 표시 재료를 한 번에 만들어 경계 밖으로 보낸다.
// **여기까지가 "시뮬레이션 의미 해석"의 끝이다.** 메인 스레드에는 이 속성을 그리는 코드만 남는다.
import type { WorldRuntime } from "../core/world/WorldRuntime";
import { EventInterpreter } from "../presentation/EventInterpreter";
import { agentChoices, buildAgentPanel } from "./AgentViewBuilder";
import { buildEventDetail, buildEventList } from "./EventViewBuilder";
import { buildMapView, type SceneViewContext } from "./MapViewBuilder";
import type { SceneViewPayload } from "./SceneViewModel";

/** 화면이 지금 무엇을 보고 있는가 — 모드·관찰 대상·열어 본 사건 */
export interface SceneFocus extends SceneViewContext {
  agentId?: string;
  eventId?: string;
  /** §36.2 시간 배속 — 세계의 흐름이 아니라 화면이 한 번에 무는 시간이다 */
  speed?: number;
}

export function buildScenePayload(
  runtime: WorldRuntime,
  focus: SceneFocus,
  interpreter: EventInterpreter = new EventInterpreter(),
): SceneViewPayload {
  const context: SceneViewContext = {
    mode: focus.mode,
    ...(focus.observerId === undefined ? {} : { observerId: focus.observerId }),
  };
  const eventList = buildEventList(runtime, context, interpreter);
  const payload: SceneViewPayload = {
    modeKey: focus.mode,
    speed: focus.speed ?? 1,
    map: buildMapView(runtime, context),
    events: eventList.items,
    suppressedEventCount: eventList.suppressed,
    agentChoices: agentChoices(runtime, context),
  };
  if (focus.agentId !== undefined) {
    const panel = buildAgentPanel(runtime, focus.agentId, context, interpreter);
    if (panel !== undefined) payload.agentPanel = panel;
  }
  if (focus.eventId !== undefined) {
    const detail = buildEventDetail(runtime, focus.eventId, context, interpreter);
    if (detail !== undefined) payload.eventDetail = detail;
  }
  return payload;
}
