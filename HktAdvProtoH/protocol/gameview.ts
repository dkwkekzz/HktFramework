// GameView Snapshot — World → View 의 유일한 공개 계약 (Semantic).
//
// World 는 의미만 투영한다 — entity 의 role/state/값, interaction 의 가용성/사유 코드,
// HUD 의 값. "어떻게 그릴지"(sprite·크기·라벨 형식·문구·키)는 View 의
// Presentation 결정 Layer 가 정한다.
//
// 이 구조는 Cycle 이 늘어도 바뀌지 않는다 — 새 Cycle 은 새 role/interaction/hud
// 항목(데이터)을 늘릴 뿐이다.

export interface GameViewPosition {
  x: number;
  z: number;
}

export interface EntityView {
  id: string;
  role: string; // Semantic Role (예: player-character, npc-character, resource-deposit)
  state: string; // 의미 상태 (예: idle | move | attack | mine | available | depleted)
  position: GameViewPosition;
  labelValue?: number | string; // 관찰 값 (예: 광맥 잔량) — 표시 형식은 View 책임
  kind?: string; // CharacterKind 등 종류 식별자 (C002) — 어떤 모습으로 그릴지는 View 책임
  progress?: number; // 0..1 — 진행 중인 행동의 진행도 (C002). 없으면 진행 개념이 없는 상태
  targetEntityId?: string; // 현재 상태의 대상 (C002) — 없을 수 있음
  attended?: boolean; // 그 몸을 지금 조종하는 이가 있는가 (C004).
  // role = other-player-character 에만 실린다. 거짓이면 그 사람은 떠났고 몸만 남은 것이다.
}

export interface InteractionView {
  id: string; // ActionRequest.interactionId 로 회신된다
  role: string; // Semantic Role (예: move-to, mine-deposit)
  targetEntityId?: string;
  available: boolean;
  reason?: string; // 불가 사유 코드 — 문구 변환은 View 책임
}

export interface HudItemView {
  id: string; // Observable 경로 기반 식별자 (예: inventory.stone)
  kind: 'counter' | 'flag' | 'label'; // label — 의미 코드 (문구 변환은 View 책임)
  value: number | boolean | string;
  progress?: number; // 0..1 — 값에 진행도가 동반되는 경우 (C002)
}

// 이 관찰 결과를 받는 이가 누구인가 (C004 ADDED).
// 관찰 결과는 관찰자마다 따로 만들어진다 — 화면 속 어느 것이 내 몸인지 이것으로 안다.
export interface ObserverView {
  id: string; // Observer.Id — 관찰자가 밝힌 자기 식별
  characterId: string; // Observer.ActorId — 세계가 정해 준 내 몸
  // Observer.AcknowledgedMark (C005) — 세계가 나에게서 받아들인 마지막 표식.
  // 이 값이 실린 관찰 결과는 "그 표식까지 받아들이고 그 Tick 의 판정을 마쳤다"는 뜻이다.
  // 다른 관찰자의 표식은 오지 않는다.
  acknowledgedMark: number;
}

export interface GameViewSnapshot {
  specId: string; // 이 Snapshot 을 계약하는 GameView Specification ID
  scene: string; // Scene 이름 (예: mining-field)
  observer: ObserverView; // C004 ADDED — 이 관찰 결과의 수신자
  entities: EntityView[];
  interactions: InteractionView[];
  hud: HudItemView[];
}
