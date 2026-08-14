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

// 몸 충돌체 (C006 / R1) — 모든 character 가 차지하는 캡슐 부피와 그 물리 상태.
// 서로 밀어내는 판정은 지면 투영 원이다. 밀리는 움직임 자체는 position 변화로 보인다.
export interface BodyView {
  radius: number;
  height: number; // R1 — 캡슐 부피 관찰용
  mass: number;
  facing: GameViewPosition; // R1 — 몸이 향한 방향 (휘두름이 나가는 쪽)
  velocity: GameViewPosition;
}

// 행동 충돌체 (C006 / R1) — attack 진행 중에만 존재한다.
// center 는 몸 중심이 아니라 칼끝 자리 — Facing 기준 호를 그리며 쓸고 지나간다.
export interface SwingView {
  center: GameViewPosition;
  radius: number; // 칼끝 충돌 구의 반경
  active: boolean; // 휘두름 구간 동안 참 — 이때 닿은 몸이 타격된다
  struck: string[]; // 이 휘두름이 이미 타격한 몸들 (같은 몸은 한 번만 맞는다)
}

// 생명 (C007) — 누구의 것이든 관찰된다. 몸 위 기본 표시가 이 값이다.
export interface VitalityView {
  health: number;
  healthMaximum: number;
  downed: boolean; // 참이면 더 이상 행동하지 않고 타격 대상도 되지 않는다
}

// 그 밖의 모든 속성 (C007 R2) — 세계는 어떤 속성도 숨기지 않는다.
// 실린다고 해서 늘 화면에 띄우라는 뜻은 아니다. 표시 기본값은 View 가 정한다.
export interface AttributesView {
  energy: number;
  energyMaximum: number;
  moveMode: string; // walk | run
  control: string; // player | autonomous
  tempoStats: {
    moveSpeed: number;
    runSpeedMultiplier: number;
    actionSpeed: number;
  };
  modifiers: {
    energyCharge: number;
    energyConsume: number;
    moveSpeed: number;
    actionSpeed: number;
  };
}

export interface EntityView {
  id: string;
  role: string; // Semantic Role (예: player-character, npc-character, resource-deposit)
  state: string; // 의미 상태 (예: idle | move | attack | heavy-attack | mine | hit | downed)
  name?: string; // Actor.Name (C007) — character 에만 실린다
  vitality?: VitalityView; // C007 — character 에만 실린다
  attributes?: AttributesView; // C007 R2 — character 에만 실린다
  position: GameViewPosition;
  labelValue?: number | string; // 관찰 값 (예: 광맥 잔량) — 표시 형식은 View 책임
  kind?: string; // CharacterKind 등 종류 식별자 (C002) — 어떤 모습으로 그릴지는 View 책임
  progress?: number; // 0..1 — 진행 중인 행동의 진행도 (C002). 없으면 진행 개념이 없는 상태
  targetEntityId?: string; // 현재 상태의 대상 (C002) — 없을 수 있음
  attended?: boolean; // 그 몸을 지금 조종하는 이가 있는가 (C004).
  // role = other-player-character 에만 실린다. 거짓이면 그 사람은 떠났고 몸만 남은 것이다.
  body?: BodyView; // 몸 충돌체 (C006) — character 에만 실린다
  swing?: SwingView; // 행동 충돌 반경 (C006) — attack 진행 중에만 실린다
}

export interface InteractionView {
  id: string; // ActionRequest.interactionId 로 회신된다
  role: string; // Semantic Role (예: move-to, mine-deposit)
  targetEntityId?: string;
  available: boolean;
  reason?: string; // 불가 사유 코드 — 문구 변환은 View 책임
  // 스킬 interaction (C007) — 쓰기 전에 알 수 있어야 하는 값.
  // 얼마나 깎고, 기력을 얼마나 채우고 쓰는가.
  profile?: { damage: number; charge: number; cost: number };
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

// 한 번의 타격이 낳은 결과 (C007) — 맞은 자리에서 잠시 드러났다가 사라진다.
// 피해는 스킬이 정한 고정값이므로 실리는 것은 값 하나뿐이다.
export interface StrikeEventView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack
  amount: number;
  at: GameViewPosition; // 맞은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
}

// 바꿀 수 있는 속성과 그 허용 범위 (C007 R2). View 가 목록을 스스로 만들지 않는다.
export interface MutableAttributeView {
  id: string;
  min?: number;
  max?: number;
  values?: string[];
}

// 속성을 바꿔 볼 수 있는 세계인가 (C007 R2).
export interface DebugAuthorityView {
  open: boolean;
  mutableAttributes: MutableAttributeView[];
}

export interface GameViewSnapshot {
  specId: string; // 이 Snapshot 을 계약하는 GameView Specification ID
  scene: string; // Scene 이름 (예: mining-field)
  observer: ObserverView; // C004 ADDED — 이 관찰 결과의 수신자
  entities: EntityView[];
  interactions: InteractionView[];
  hud: HudItemView[];
  strikes: StrikeEventView[]; // C007 ADDED
  debug: DebugAuthorityView; // C007 R2 ADDED
}
