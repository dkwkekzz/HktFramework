// GameView Snapshot — World → View 의 유일한 공개 계약 (범용 구조).
//
// 핵심 명제: 이 구조는 Cycle 이 늘어도 바뀌지 않는다.
// 새 Cycle 은 새 entity role · interaction · hud 항목(데이터)을 늘릴 뿐이며,
// View 는 이 배열들을 그대로 순회하며 그린다. 같은 role 을 그리는 View 코드는
// Cycle 간 수정되지 않는다 — View 확장은 Registry 항목 추가로만 이루어진다.
//
// 표현(문구·아이콘·스프라이트·키 바인딩)은 여기 싣지 않는다 — reason 은 코드,
// labelValue 는 값이며 형식화는 View 책임이다.

export interface GameViewPosition {
  x: number;
  z: number;
}

export interface EntityView {
  id: string;
  role: string; // Semantic Role — View Asset/Role Registry 의 키
  state: string; // role:state 조합으로 표현이 결정된다
  position: GameViewPosition;
  labelValue?: number | string; // 머리 위 라벨 값 (예: 광맥 잔량)
}

export interface InteractionView {
  id: string; // ActionRequest.interactionId 로 회신된다
  role: string; // 표현 규약 키 (예: move-to, mine-deposit)
  targetEntityId?: string;
  available: boolean;
  reason?: string; // 불가 사유 코드 — 문구 변환은 View 책임
}

export interface HudItemView {
  id: string; // Observable 경로 기반 식별자 (예: inventory.stone)
  kind: 'counter' | 'flag';
  value: number | boolean;
}

export interface GameViewSnapshot {
  specId: string; // 이 Snapshot 을 계약하는 GameView Specification ID
  scene: string;
  entities: EntityView[];
  interactions: InteractionView[];
  hud: HudItemView[];
}
