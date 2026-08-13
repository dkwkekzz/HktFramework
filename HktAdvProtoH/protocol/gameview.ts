// GameView Snapshot — World → View 의 Render 계약.
//
// 핵심 명제: View 엔진은 그리기 능력(capability)만 제공한다 — "sprite 를 그려라",
// "지형을 그려라", "라벨을 붙여라". 무엇을 어떻게 그릴지(어떤 sprite·크기·라벨·문구)는
// 각 Cycle 의 World(Observer Projection)가 결정해 이 Snapshot 으로 지시한다.
//
// 이후 Cycle 에서 표현이 고도화되면(예: sprite animation) representation 에 새 kind 를
// 추가하고 View 는 그 capability 구현만 더한다 — 기존 kind 로 그리던 것들의
// View 코드는 수정되지 않는다.

export interface GameViewPosition {
  x: number;
  z: number;
}

// ── Entity 표현 지시 ─────────────────────────────────────────────

export interface SpriteRepresentation {
  kind: 'sprite'; // View 의 sprite billboard capability 를 사용한다
  sprite: string; // View Asset Registry 의 sprite 키 (미등록이면 placeholder 로 그려진다)
  variant?: string; // 같은 sprite 의 상태 변형 (예: idle | moving | depleted)
  size?: number; // 표시 크기 (생략 시 엔진 기본값)
  label?: string; // 머리 위 라벨 텍스트 (형식화 완료 — 예: "돌 4")
  cameraFollow?: boolean; // 카메라가 이 entity 를 따라간다
  trail?: boolean; // 이동 자취를 남긴다
}

// 이후 Cycle 에서 kind 를 추가한다 (예: 'animated-sprite' | 'mesh' …)
export type EntityRepresentation = SpriteRepresentation;

export interface EntityView {
  id: string;
  position: GameViewPosition;
  representation: EntityRepresentation;
}

// ── Interaction 표시·입력 지시 ───────────────────────────────────

export interface InteractionView {
  id: string; // ActionRequest.interactionId 로 회신된다
  available: boolean;
  targetEntityId?: string; // entity 를 대상으로 한다 (클릭 대상)
  terrainTarget?: boolean; // 지형 지점을 대상으로 한다 (클릭·이동키 매핑)
  key?: string; // 권장 키 바인딩 (KeyboardEvent.code)
  keyLabel?: string; // 안내 표기 (예: "E")
  prompt?: string; // 가용 시 프롬프트 텍스트 (예: "채굴")
  unavailableText?: string; // 불가 시 표시 텍스트 (예: "광맥이 너무 멀다")
}

// ── HUD 위젯 지시 ────────────────────────────────────────────────

export interface HudItemView {
  id: string;
  widget: 'counter' | 'flag'; // View 의 HUD capability 선택
  label: string;
  icon?: string;
  value: number | boolean;
  celebrateGain?: boolean; // counter 증가 시 획득 토스트
}

// ── Snapshot ────────────────────────────────────────────────────

export interface GameViewSnapshot {
  specId: string; // 이 Snapshot 을 계약하는 GameView Specification ID
  scene: { terrain: string }; // 지형 capability 선택 (현재 제공: 'field')
  entities: EntityView[];
  interactions: InteractionView[];
  hud: HudItemView[];
}
