// GameView Specification 경계 타입 — World → View 의 유일한 공개 계약.
//
// 구조는 어떤 Cycle 에도 매여 있지 않다. 고정 슬롯(player · deposit …)이 아니라 **목록**이다.
// View 는 이 목록을 명세대로 그리는 엔진이고, 새 Cycle 은 목록에 항목을 더할 뿐 View 를 고치지 않는다.
//
// 역할 분담
//   World(Projection)  무엇을 보여줄 것인가 — 존재·상태·표시 문구
//   View               어떻게 그리는가 — 스프라이트·배치·카메라·레이아웃

import type { ActionRequest } from './actions';

export interface GameViewPosition {
  x: number;
  z: number;
}

export interface GameViewEntity {
  /** 고유 식별자 — 상호작용 대상 지정과 View 내부 추적에 쓴다 */
  id: string;
  /** 의미 역할 — Asset Registry 키의 앞부분 (예: player-character) */
  role: string;
  /** 역할 안의 상태 — `role:state` 로 스프라이트를 고른다 (예: idle · available) */
  state?: string;
  position: GameViewPosition;
  /** 관찰자가 따라가는 대상인가 — 카메라와 자취가 이 존재를 따른다 */
  focus?: boolean;
  /** 머리 위에 띄울 문구 (예: "돌 4") */
  label?: string;
}

export interface GameViewInteraction {
  /** 상호작용 식별자 */
  id: string;
  /** 의미 역할 (예: move-to · mine-deposit) */
  role: string;
  available: boolean;
  /** 발동 시 보낼 Action Request — View 는 내용을 해석하지 않고 그대로 보낸다 */
  request: ActionRequest;
  /** 지면 지시형 상호작용 — request 의 이 필드에 View 가 지목한 지점을 채워 보낸다 */
  pointField?: string;
  /** 이 Entity 를 클릭하면 발동한다 */
  targetEntityId?: string;
  /** 키보드 트리거 (예: E) */
  key?: string;
  /** 가능할 때 띄울 문구 (예: 채굴) */
  prompt?: string;
  /** 불가 사유 코드 — View 는 해석하지 않는다 (디버깅·추적용) */
  unavailableReason?: string;
  /** 불가할 때 띄울 문구 — View 는 이 문구를 그대로 그린다 */
  unavailableText?: string;
}

export interface GameViewHudItem {
  id: string;
  /** 아이콘 문자 (예: ⛏) */
  icon?: string;
  /** 항목 이름 (예: Stone) */
  label: string;
  value: number | string;
  /** 값이 늘었을 때 띄울 알림 문구 틀 — {delta} · {label} 을 치환한다 */
  notifyOnIncrease?: string;
}

export interface GameViewHud {
  items: GameViewHudItem[];
  /** 조작 안내 줄 */
  keyHints?: string[];
}

export interface GameViewSnapshot {
  /** 이 Snapshot 을 산출한 계약 식별자 (예: VIEW-STONE-MINING-001) */
  id: string;
  /** 무대 식별자 — View 가 환경 표현을 고르는 데 쓴다 */
  scene: string;
  entities: GameViewEntity[];
  interactions: GameViewInteraction[];
  hud: GameViewHud;
}
