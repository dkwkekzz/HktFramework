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
  // 전투 능력치 (C010 ADDED / C012 CHANGED) — 한 방의 크기를 정하는 **네** 값.
  // 어느 둘을 읽을지는 그 타격의 방식이 정한다. 네 값 모두 실린다 —
  // 고르지 않은 쪽도 보여야 "저쪽으로 쳤다면 어땠을까" 를 견줄 수 있다.
  // 두 Multiplier 는 파생값이다. 방어가 체감식이라 수치만 보고는 효과를 알 수 없어
  // "그래서 몇 할로 받는가" 를 함께 싣는다 (0 초과 1 이하 — 0 이 되지 않는다).
  // C013 CHANGED — 관통 둘이 더해져 여섯 값이다. 관통은 공격 쪽 능력이지만
  // **피해를 키우는 값이 아니다** — 하는 일은 상대 방어의 값어치를 떨어뜨리는 것뿐이다.
  combatStats: {
    physicalAttack: number;
    auraAttack: number;
    armor: number;
    resistance: number;
    armorPenetration: number;
    resistancePenetration: number;
    armorMultiplier: number;
    resistanceMultiplier: number;
  };
  // 이 존재의 두 방어가 **보는 이의 관통에게** 얼마로 읽히는가 (C013 ADDED).
  // armor 50 인 상대가 나에게는 31.25 로 읽힌다 — 그 31.25 가 여기 실린다.
  // **세계가 계산한 값이다.** View 가 combatStats.armor 와 자기 관통을 곱해
  // 만들어내서는 안 된다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  // 보는 이의 관통이 0 이면 combatStats 의 값과 같다 — 같다는 것 자체가 관찰이다.
  // 모든 존재에 실린다. 자기 몸에 실린 값은 쓸 데가 없지만 그래도 싣는다 —
  // "지금은 볼 대상이 아니다" 와 "세계가 안 알려준다" 는 다른 일이다.
  versusObserver: {
    armor: number;
    resistance: number;
    armorMultiplier: number;
    resistanceMultiplier: number;
  };
  // 두 방어 중 어느 쪽이 더 단단한가 (C012 ADDED) — physical-tougher | aura-tougher | even.
  // **세계가 계산한 판정이다.** View 가 armor 와 resistance 를 비교해 만들어내거나
  // 존재의 이름·색·생김새로 짐작해서는 안 된다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
  // even 은 "정보 없음" 이 아니라 "정말로 같다" 는 뜻이다.
  defenseShape: string;
  // 막기 (C011 ADDED) — 모든 존재에 실린다.
  // guarding 은 state(현재 행동)와 별개다. 막으며 걷는 존재는 state 가 move 이면서
  // guarding 이 참이므로, View 는 이것을 행동 표시로 대신할 수 없다.
  // broken 은 방어가 무너져 아직 다시 들지 못하는 동안 참이다 —
  // 놓은 것과 무너진 것은 다른 사실이다.
  guard: {
    guarding: boolean;
    broken: boolean;
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
  // C010 CHANGED — damage 하나가 셋으로 나뉜다. 스킬의 강함과 내 공격 능력이
  // 각각 얼마를 대는지 알아야 "왜 이만큼인가" 를 판단할 수 있기 때문이다.
  //   rawDamage 는 지금 내 공격 능력으로 이 스킬을 쓰면 나오는 공격 피해다.
  //   최종 피해는 실리지 않는다 — 대상이 정해지기 전에는 세계도 모르는 값이다.
  // C012 CHANGED — damageType 이 더해진다. 그 스킬이 어떤 방식인지를 세계가 밝히므로
  // View 가 이름이나 색으로 짐작하지 않는다. rawDamage 는 이제 그 방식에 대응하는
  // 내 공격 능력으로 계산된 값이다.
  profile?: {
    baseDamage: number;
    attackRatio: number;
    rawDamage: number;
    charge: number;
    cost: number;
    damageType: string; // physical | aura
  };
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

// 한 방의 크기가 어떻게 나왔는가 (C010 ADDED).
// 숫자 하나만으로는 "능력치가 결과를 정한다" 를 믿을 수 없다 —
// 그래서 세계는 결과와 함께 그 경위를 낸다.
export interface DamageBreakdownView {
  // C012 ADDED — 이 타격의 방식 (physical | aura).
  // 같은 자리에 뜬 두 숫자가 왜 다른지는 방식이 달라서다.
  damageType: string;
  // C012 ADDED — 방식이 고른 공격 능력. 이름이 없으면 왜 이 값인지 알 수 없다.
  offenseStat: TypedStatView;
  baseDamage: number; // 스킬 자체의 강함
  attackContribution: number; // 고른 공격 능력이 더한 몫 = OffenseStat × AttackRatio
  rawDamage: number; // baseDamage + attackContribution
  // C012 CHANGED — C010 의 targetDefense 를 대신한다. 방어가 둘이 되면서 값만으로는
  // 무엇을 읽었는지 알 수 없다 — 30 이 물리 방어인지 오라 방어인지가 결과를 가른다.
  // 옛 이름은 별칭으로도 남기지 않는다 (설계 §9).
  // C013 — 이 값의 의미를 **걷히기 전** 으로 고정한다 (상대가 지닌 방어와 같은 수).
  // 감쇄식에 실제로 들어간 값은 effectiveDefense 가 가진다.
  defenseStat: TypedStatView;
  // C013 ADDED — 이 타격에서 작용한 관통. 값이 0 이어도 실린다.
  // 이름이 없으면 "왜 안 걷혔는가" 를 알 수 없다.
  penetrationStat: TypedStatView;
  // C013 ADDED — 걷힌 뒤의 방어. defenseMultiplier 가 실제로 읽은 값이다.
  // defenseStat.value 와 같다는 것이 "이 상대에게는 통하지 않았다" 의 관찰이며,
  // View 가 defenseMultiplier 를 검산한다면 defenseStat 이 아니라 이 값으로 해야 한다.
  effectiveDefense: number;
  defenseMultiplier: number; // 걷힌 방어가 남긴 비율 (0 초과 1 이하)
  // C011 CHANGED — 의미는 그대로다(공식이 내놓은 값). 다만 그것은 이제
  // "막지 않았다면 들어왔을 값" 이기도 하다. 실제로 빠진 값은 appliedDamage 다.
  finalDamage: number;
  appliedDamage: number; // C011 ADDED — 실제로 생명에서 빠진 값. amount 와 언제나 같다
  guard?: GuardOutcomeView; // C011 ADDED — 막지 않은 타격에는 실리지 않는다
}

// 방식이 고른 능력 하나 (C012 ADDED) — 무엇을 얼마로 읽었는가.
export interface TypedStatView {
  // physicalAttack | auraAttack | armor | resistance |
  // armorPenetration | resistancePenetration (C013)
  name: string;
  value: number;
}

// 막기가 이 한 방에 한 일 (C011 ADDED).
// C012 — 막기는 방식을 읽지 않는다. 오라 타격을 막은 결과는 물리 타격을 막은 것과 같다.
// blocked 와 broken 은 동시에 참이 되지 않는다 — 막았거나 무너졌거나 둘 중 하나다.
export interface GuardOutcomeView {
  blocked: boolean;
  broken: boolean; // 이 타격에 방어가 무너졌다 — 피해는 줄지 않았고 방어는 사라졌다
  cpPaid: number; // 생명 대신 치른 기력 (무너졌으면 0)
  prevented: number; // 막아서 덜 들어간 값 = finalDamage - appliedDamage
}

// 한 번의 타격이 낳은 결과 (C007) — 맞은 자리에서 잠시 드러났다가 사라진다.
// C010 CHANGED — amount 는 그대로 남고 그 옆에 경위가 붙는다.
// C011 CHANGED — amount 의 의미("실제로 덜어낸 생명")는 그대로지만, 그것과 같은 값을
// 가리키는 경위 항목이 finalDamage 에서 appliedDamage 로 옮겨 갔다.
//   amount === breakdown.appliedDamage    항상 참
//   amount === breakdown.finalDamage      막지 않은 타격에서만 참
// 이 구분을 틀리면 "막았는데 왜 그대로 아프지" 로 보인다.
export interface StrikeEventView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack | aura-strike
  amount: number;
  at: GameViewPosition; // 맞은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
  breakdown: DamageBreakdownView; // C010 ADDED
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
