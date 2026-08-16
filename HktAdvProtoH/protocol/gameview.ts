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

// 막는 자세 (C010) — 누구의 것이든 관찰된다.
// 자세는 행동(EntityView.state)과 별개다 — 걸으면서도 막을 수 있으므로 따로 실린다.
export interface StanceView {
  guarding: boolean; // Actor.Stance == guard
  broken: boolean; // 방어가 무너진 여파 안인가 (이 동안은 다시 막지 못한다)
  brokenUntil: number; // 그 여파가 가시는 세계 시각 — world.time 과 비교해 남은 시간을 읽는다
  // 어느 쪽을 막고 있는가. body.facing 과 같은 값이며,
  // 앞이 아닌 곳에서 들어온 타격이 왜 막히지 않았는지를 설명하는 것이 이 값이다.
  facing: GameViewPosition;
  // C011 — 마지막으로 자세를 세운 세계 시각. world.time 과의 차이가 "세운 지 얼마" 다.
  startedAt: number;
  // C011 — 지금 이 자세가 아직 완벽하게 막을 수 있는 창 안인가.
  // 창의 길이(상수)는 싣지 않는다 — 열려 있는가/아닌가만 준다.
  // 방금 세운 몸은 세워 두고 버티는 몸과 결과가 다르므로 구분되어야 한다.
  perfectWindow: boolean;
}

// 열림 (C011) — 완벽하게 막힌 자가 잠시 지불하는 상태. 누구의 것이든 관찰된다.
// 열려 있는 동안 이 몸에 닿는 모든 타격이 되받아침이 된다 — 그것을 못 보면
// 되받아칠 순간을 알 수 없고, 이 Cycle 의 플레이가 없다.
export interface ExposureView {
  exposed: boolean; // Actor.Exposed
  until: number; // 그 열림이 가시는 세계 시각 — world.time 과 비교해 남은 시간을 읽는다
}

// 그 밖의 모든 속성 (C007 R2) — 세계는 어떤 속성도 숨기지 않는다.
// 실린다고 해서 늘 화면에 띄우라는 뜻은 아니다. 표시 기본값은 View 가 정한다.
export interface AttributesView {
  energy: number;
  energyMaximum: number;
  moveMode: string; // walk | run
  control: string; // player | autonomous
  defense: number; // C010 — 맞은 피해를 줄이는 값. 막든 안 막든 언제나 작동한다
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
  stance?: StanceView; // C010 — character 에만 실린다
  exposure?: ExposureView; // C011 — character 에만 실린다
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
//
// C010 CHANGED — 값 하나가 아니라 그 값을 만든 내역이 함께 실린다.
// 보는 이는 최종 숫자가 아니라 그 숫자가 나온 경로를 읽는다:
//   base → (방어력) → mitigated → (막기) → amount(생명) + energyPaid(기력)
export interface StrikeBreakdownView {
  // 본래 피해. C011 — 되받아침이면 이 값이 이미 커져 있다.
  // 커지기 전 값은 base - timing.counterBonus 로 되짚는다.
  base: number;
  mitigated: number; // 방어력이 걷어낸 뒤 남은 피해 (base - mitigated = 방어력의 몫)
  guarded: boolean; // 막아 낸 타격인가
  energyPaid: number; // 막느라 치른 기력 (막지 않았으면 0)
  guardBroken: boolean; // 이 타격으로 방어가 무너졌는가
}

// C011 ADDED — 시점이 무엇을 했는가 (INTENT-TIMING-BREAKDOWN-001).
//
// elapsed 가 실리는 이유는 플레이어가 창의 크기를 스스로 알아내야 하기 때문이다.
// 세계는 상수를 말해 주지 않지만 "이번엔 0.12 라 완벽했고 저번엔 0.31 이라 아니었다" 를
// 비교할 수는 있게 한다 — 이것이 결과가 우연이 아니라는 증거다.
export interface StrikeTimingView {
  perfect: boolean; // 완벽하게 막아 낸 타격인가
  // 자세를 세운 뒤 이 타격이 닿기까지 걸린 시간.
  // 막히지 않은 타격에는 없다 — 잴 대상이 없기 때문이다.
  elapsed: number | null;
  counter: boolean; // 되받아친 타격인가 (맞은 자가 열려 있었는가)
  counterBonus: number; // 되받아침이 키운 몫 (아니면 0) — base - counterBonus 가 증폭 전 값
  energyGained: number; // 완벽하게 막아 얻은 기력 (아니면 0)
}

export interface StrikeEventView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack
  amount: number; // 실제로 생명에서 나간 몫
  at: GameViewPosition; // 맞은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
  breakdown: StrikeBreakdownView; // C010 ADDED
  timing: StrikeTimingView; // C011 ADDED
}

// 속성을 바꿔 볼 수 있는 세계인가 (C007 R2).
// C009 CHANGED — mutableAttributes 는 없어진 것이 아니라 자리를 옮겼다.
// 이제 commands[set-attribute] 의 attribute 자리가 받는 값의 Domain 이다.
export interface DebugAuthorityView {
  open: boolean;
}

// ── World.CommandCatalog (C009 ADDED) ────────────────────────────────
//
// 세계 밖에서 세계에 손댈 수 있는 것들의 목록. interactions 와 다른 것이다 —
// interactions 는 몸이 세계 안에서 하는 일이고, command 는 세계의 규칙 밖에서
// 세계에 손을 대는 일이다.
//
// View 는 이 목록을 스스로 만들지 않는다 (INTENT-COMMAND-CATALOG-001).
// 세계에 명령이 하나 생기면 여기에 항목이 하나 더 실릴 뿐이며 이 구조는 바뀌지 않는다.

export type CommandDomainKind =
  | 'entity' // 세계에 있는 존재를 Actor.Id 로 가리킨다
  | 'choice' // 정해진 몇 가지 이름 중 하나
  | 'number' // 수치 — 하한과 상한을 가진다
  | 'text'
  | 'from-previous-choice'; // 앞 자리의 선택이 이 자리의 Domain 을 정한다

export interface CommandDomainOptionView {
  name: string;
  /** 이 선택지를 고르면 뒤따르는 자리의 Domain 이 이것으로 정해진다 */
  thenDomain?: CommandDomainView;
}

export interface CommandDomainView {
  kind: CommandDomainKind;
  /** kind = entity — 무엇을 가리키는가 (의미 코드) */
  refers?: string;
  /** kind = choice */
  options?: CommandDomainOptionView[];
  /** kind = number */
  minimum?: number;
  maximum?: number;
}

export interface CommandParameterView {
  id: string;
  required: boolean;
  /** 없을 때 무엇으로 치는가 (의미 코드 — 문구 변환은 View 책임) */
  omittedMeaning?: string;
  domain: CommandDomainView;
}

export interface CommandView {
  id: string;
  /** 무엇을 하는가 (의미 코드 — 문구 변환은 View 책임) */
  effect: string;
  available: boolean;
  /** 걸 수 없다면 왜인가 — 사유 코드 */
  reason?: string;
  /** 받는 것들, 순서대로 */
  parameters: CommandParameterView[];
}

// ── Request.Outcome (C009 ADDED) ─────────────────────────────────────
//
// 하나의 요청에 대한 세계의 대답 (RULE-REQUEST-REPLY-001).
// 관찰 결과와 다른 것이다 — 세계가 어떻게 되었는지가 아니라
// "내가 건 그 요청이 어떻게 되었는가" 하나다. 요청한 이에게만 간다.
// 세계는 이것을 쌓아 두지 않는다 — Tick 의 산출물이지 World State 가 아니다.
export interface RequestOutcomeView {
  accepted: boolean;
  /** 어느 판정이 결정했는가 (Semantic Identifier) */
  rule: string;
  /** 거절이면 그 사유 코드 — 문구 변환은 View 책임 */
  reason?: string;
  /** 요청에 실려 온 Request.Mark 그대로. 어느 요청의 대답인지 짚는 수단 */
  mark?: number;
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
  // C009 ADDED — 세계가 밝히는 "걸 수 있는 명령". 관찰 결과에 늘 실린다.
  // 걸 수 있는 것은 언제나 먼저 밝혀져 있다 — 걸어 보아야 알게 되는 것이 없다.
  commands: CommandView[];
}
