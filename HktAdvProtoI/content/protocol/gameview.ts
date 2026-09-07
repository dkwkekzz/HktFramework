// 이 세계의 GameView 확장 — World → View 계약에서 컨텐츠가 소유하는 몫.
//
// 봉투(entities/interactions/hud/commands/outcomes 구조)는 engine/protocol-core 가
// 소유하고, 이 세계의 의미(생명·속성·타격 경위·profile)는 여기가 소유한다.
// 팩의 world 가 채우고 팩의 view 가 읽으므로 타입 안전은 팩 안에서 완결된다.
// 소비처는 언제나 이 파일 하나만 import 한다.

import type {
  EntityView as CoreEntityView,
  GameViewPosition,
  GameViewSnapshot as CoreGameViewSnapshot,
  InteractionView as CoreInteractionView,
} from '../../engine/protocol-core/gameview';

// 봉투 타입은 그대로 다시 내보낸다 — 팩 코드는 자기 protocol 하나만 바라본다.
export type {
  BodyView,
  CommandDomainKind,
  CommandDomainOptionView,
  CommandDomainView,
  CommandParameterView,
  CommandView,
  DebugAuthorityView,
  GameViewPosition,
  HudItemView,
  ObserverView,
  RequestOutcomeView,
  SwingView,
} from '../../engine/protocol-core/gameview';

// 생명 — 누구의 것이든 관찰된다. 몸 위 기본 표시가 이 값이다.
export interface VitalityView {
  health: number;
  healthMaximum: number;
  downed: boolean; // 참이면 더 이상 행동하지 않고 타격 대상도 되지 않는다
}

// 그 밖의 모든 속성 — 세계는 어떤 속성도 숨기지 않는다.
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

// 한 번의 타격이 낳은 결과 — 맞은 자리에서 잠시 드러났다가 사라진다.
// 피해는 스킬이 정한 고정값이므로 실리는 것은 값 하나뿐이다.
export interface StrikeEventView {
  attackerId: string;
  targetId: string;
  skill: string; // attack | heavy-attack
  amount: number;
  at: GameViewPosition; // 맞은 몸의 중심
  since: number; // 일어난 세계 시각 — 얼마나 지났는지 판단용
}

// 그 기술이 무엇을 치르고 무엇을 내는가 — 걸기 전에 밝혀져 있다.
export interface SkillProfileView {
  damage: number;
  charge: number;
  cost: number;
}

// 이 팩의 존재 관찰 — 봉투의 EntityView 에 생명과 속성이 더해진다.
export interface EntityView extends CoreEntityView {
  vitality?: VitalityView; // character 에만 실린다
  attributes?: AttributesView; // character 에만 실린다
  /**
   * 그 원천이 내는 Material Seed 의 **코드** — resource-source 에만 실린다 (C011 ADDED).
   *
   * `kind` 가 자연 형태(무엇처럼 생겼는가)이고 이것이 무엇인가다. 같은 Seed 가 자리마다
   * 다른 형태로 나므로 둘이 따로 실린다 (Play A.1 "같은 것의 세 순도").
   *
   * **쓰임은 실리지 않는다** — 손에 든 것이 무엇에 쓰이는지 이 층은 말하지 않는다 (S10).
   */
  material?: string;
  /**
   * 그 원천에 **지금 걸린 조건 코드들** — resource-source 에만 실린다 (C012 ADDED).
   *
   * 걸린 것이 하나도 없으면 **자리 자체가 없다** (빈 배열로 지어내지 않는다).
   * 무엇이 무엇에 매달렸는지는 실리지 않는다 — 세계는 "지금 멎었다" 만 말한다.
   */
  conditions?: string[];
  /**
   * 그 원천이 **지금 선 마디**의 번호 — 마디를 여럿 가진 원천에만 실린다 (C013 ADDED).
   *
   * 마디의 좌표는 실리지 않는다. 관찰자가 자기 content/regions 의 presence 곡선에서
   * 이 번호로 자리를 얻는다 (땅 · 흔적 · 붕괴를 스스로 얻는 C005~C007 · C011 · C012 의
   * 규율 그대로). 지금 서 있는 자리 자체는 이미 `position` 이 말한다.
   */
  siteIndex?: number;
  /**
   * **무너진 채 남은 마디**들의 번호 — 무너진 것이 있는 원천에만 실린다 (C013 ADDED).
   *
   * 원천이 자리를 옮겨도 옛 자리는 무너진 채 남으므로(§5.6), 무너짐은 원천의 phase 가
   * 아니라 **자리**가 기억한다. 하나도 없으면 자리 자체가 없다 (빈 배열로 지어내지 않는다).
   */
  collapsedSites?: number[];
}

export interface InteractionView extends CoreInteractionView {
  profile?: SkillProfileView;
}

// 규칙을 품은 방이 기억하는 것 — C008 (spec Observable: region.state.*).
//
// 세계는 "지금 패턴이 무엇인가" 만 말한다. **패턴 표(어느 패턴에 어느 통로가 열리는가)는
// 싣지 않는다** — 관찰자가 자기 content/regions 의 같은 표를 읽어 열림/닫힘을 스스로 그린다
// (땅을 컴파일해 그리는 C005~C007 의 방식 그대로). 다음에 무엇이 오는지도 말하지 않는다.
export interface RegionStateView {
  /** 지금 열려 있는 통로 집합의 이름 */
  pattern: string;
  /** 그 방에 쌓인 압력 */
  pressure: number;
  /** 넘치는 값 — 얼마나 찼는지는 View 가 이 둘로 잰다 */
  pressureLimit: number;
  /** 마지막으로 패턴이 바뀐 세계 시각 (없으면 없다). "얼마 전인가" 는 View 가 잰다 (strikes.since 선례) */
  rearrangedAt?: number;
}

// 관찰자의 몸이 선 Region — C001 (02-world Observable: snapshot.region.id · snapshot.region.hash).
// scene 이 그 Region 의 id 이고, 이것은 같은 값에 hash 를 붙인 것이다.
// hash 는 그 Region 의 Description 에서 결정적으로 나온다 — 클라이언트가 자기 데이터와 대조한다.
// 목적지 Region · 다른 Region 의 존재 · Graph 전체는 싣지 않는다 — "목적지는 건너야 안다".
export interface RegionView {
  id: string;
  hash: string;
  /**
   * 그 방이 규칙을 품고 있으면 그 방의 State (C008 ADDED).
   *
   * **규칙 없는 방에는 이 자리가 없다** — 없는 것을 0 으로 지어내지 않는다 (SPEC-007 경계).
   */
  state?: RegionStateView;
}

// 이 팩의 관찰 결과 — 봉투에 타격 결과가 더해지고, 존재/interaction 이 팩 형으로 좁혀진다.
export interface GameViewSnapshot extends CoreGameViewSnapshot {
  entities: EntityView[];
  interactions: InteractionView[];
  strikes: StrikeEventView[];
  region: RegionView; // C001 — 봉투의 region? 을 이 팩은 필수로 좁힌다
  /**
   * 관찰자의 몸이 선 자리에 걸린 settlement/condition 태그들 (없으면 빈 배열) — C006 R4.
   *
   * "왜 여기가 안전한가" 의 **코드**다. 겹치면 걸린 것이 전부 실리고(하나로 줄이지 않는다),
   * 순서는 그 방 데이터의 area 순서 그대로다. 문구는 View 의 표가 옮긴다.
   * 땅 자체(height · surface · traversable · areas)는 실리지 않는다 — 관찰자가 자기
   * content/regions 를 같은 규칙으로 컴파일해 스스로 만든다.
   */
  standingConditions: string[];
}
