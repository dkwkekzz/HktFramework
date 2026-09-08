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
   * 그 존재에 **지금 걸린 조건 코드들** (C012 ADDED · C020 CHANGED).
   *
   * 걸린 것이 하나도 없으면 **자리 자체가 없다** (빈 배열로 지어내지 않는다).
   * 무엇이 무엇에 매달렸는지는 실리지 않는다 — 세계는 "지금 멎었다" 만 말한다.
   *
   * C020 CHANGED — 실리는 존재가 둘이 되었다. 원천에 더해 **출구 표식**이 자기가 밝힌
   * **요구**를 여기 싣는다 (C020 spec R5). 형은 한 값도 바뀌지 않았고, 코드가 무엇을
   * 뜻하는지는 여전히 View 의 문구 표만 안다 — 무엇이 그 요구를 채우는지도, 어디서
   * 나는지도 싣지 않는다.
   *
   * C029 CHANGED — 실리는 존재가 셋이 되었다 (원천 · 출구 표식 · **몸**). 문 앞의 자락에
   * 든 몸에 그 흔적이 밝힌 코드가 실리고(C029 spec R2), 자락 밖으로 나오면 사라진다 —
   * 저장되지 않는 유도된 사실이다. 그리고 출구 표식이 지는 코드가 요구의 이름에서
   * **현상**으로 바뀐다 (spec R3). 형은 한 줄도 바뀌지 않았다: 늘어난 것은 이 자리를 지는
   * 존재 하나이고, 코드가 무엇을 말하는지는 여전히 View 의 문구 표만 안다.
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

/**
 * 그 방의 **소란** — C017 ADDED (Time §2.5 · spec Observable).
 *
 * **모든 방에 실린다.** `RegionView.state` 가 규칙을 품은 방에만 실리는 것과 갈리는데,
 * 이유는 하나다 — 소란은 그 방이 무엇을 품었는지와 무관하게 **어느 방에나 있는 값**이다
 * (spec 기본형 ⑩).
 *
 * 임계를 함께 싣는 것은 "얼마나 찼는가" 를 View 가 재기 위해서다 (pressureLimit 의 선례).
 * **무엇이 이 값을 올렸는지는 싣지 않는다** — 채취인지 타격인지 건너기인지, 누가 했는지,
 * 몇 사람이 있었는지 어느 것도 여기 없다. 여럿이 있었다는 것은 값으로 읽는 세계 사실이다.
 */
export interface RegionDisturbanceView {
  /** 그 방에 쌓인 소란 — 0 이상 threshold 이하 */
  value: number;
  /** 넘치는 값. 얼마나 찼는지는 View 가 이 둘로 잰다 */
  threshold: number;
  /** 그 방의 지금 위상. 문구는 View 의 표가 옮긴다 */
  phase: 'dormant' | 'awake';
}

/**
 * 땅에 남은 **자국** 하나 — C017 ADDED (Time §2.7 · spec Observable).
 *
 * **누가 남겼는지 실리지 않는다** (Play 확정 11) — 관찰자의 이름도, 몇 사람이 지나갔는지도
 * 여기 없다. 아는 것은 자리와 가던 방향과 **언제 났는가** 뿐이다.
 *
 * 나이를 싣지 않고 시각을 싣는 것은 StrikeEventView.since · RegionStateView.rearrangedAt 의
 * 선례 그대로다 — "얼마나 오래됐는가" 는 관찰자가 잰다.
 */
export interface TrackView {
  /** 자국이 난 자리 */
  at: GameViewPosition;
  /** 그 몸이 그 자리에서 가던 방향 (단위 벡터) */
  heading: GameViewPosition;
  /** 난 세계 시각 */
  since: number;
}

/**
 * 그 방을 **지금 지나고 있는 것** 하나 — C018 ADDED (Time §2.6 · spec Observable).
 *
 * 압도적인 존재는 2층에서 **현상**이다 (T7) — 몸도 생명도 아니고, 지나는 동안 그 방에
 * 무엇을 하고 지나간 뒤에 무엇을 남길 뿐이다.
 *
 * **시간표도 남은 시간도 다음 방도 실리지 않는다** — 언제 다시 오는지, 어디로 갈지는
 * 관찰자가 여러 번 보고 배우는 것이다 (T8). 그것이 무엇인지의 설명도 없다: 코드 하나뿐이고
 * 문구도 그림도 View 의 표가 정한다 (원칙 2).
 */
export interface PresenceView {
  /** 무엇이 지나는가 — 의미 코드 (문구는 View 의 표가 옮긴다) */
  presence: string;
  /** 그것이 이 방에서 지나는 **선**의 이름 — 관찰자가 자기 Description 에서 그 선을 얻는다 */
  curve: string;
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
  /**
   * 그 방의 소란 (C017 ADDED) — **늘 실린다.**
   *
   * `state?` 와 달리 물음표가 없다: 규칙 없는 방에도 원천 없는 방에도 소란은 있다
   * (spec 기본형 ⑩ · Time §2.5 "모든 Region 의 일반 State").
   */
  disturbance: RegionDisturbanceView;
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
  /**
   * 그 방에 남은 **자국들** (C017 ADDED · RULE-TRACK-001 · spec Observable).
   *
   * 관찰은 방으로 잘린다 — 다른 방의 자국은 실리지 않는다. 하나도 없으면 빈 배열이다.
   * **밤에도 잘리지 않는다** — 밤이 자르는 것은 몸과 원천이고(C015), 자국은 땅에 난 것이라
   * 흙의 흔적과 같은 갈래다 (spec 기본형 ⑥).
   *
   * 순서는 난 순서 그대로다 (결정론). 누가 남겼는지는 어디에도 없다.
   */
  tracks: TrackView[];
  /**
   * 그 방을 **지금 지나고 있는 것들** (C018 ADDED · RULE-OBSERVE-PROJECTION · spec R9).
   *
   * 관찰은 방으로 잘린다 — 다른 방을 지나는 것은 실리지 않고, 지나가기 전과 지나간 뒤에는
   * 빈 배열이다. 순서는 데이터 순서 그대로다 (결정론).
   */
  presences: PresenceView[];
  /**
   * 세계의 **때** (C015 ADDED) — 낮밤 · 철 · 며칠째 · 몇 바퀴째.
   *
   * 세계에 하나이고 관찰자마다 같다 (Time 원칙 T1). 세계 시각에서 유도되므로 저장되는 State 가
   * 아니고, 같은 시각은 언제나 같은 때다 — 되살린 세계도 마찬가지다.
   *
   * **언제 바뀌는지는 싣지 않는다** — 철의 시작·끝, 남은 시간, 다음 철, 하루와 철의 길이는
   * 어느 것도 여기 없다. "언제" 는 관찰자가 하늘과 흙과 이 값의 변화를 보고 배우는 것이다 (T8).
   * 문구도 색도 여기 없다 — 코드를 말로 옮기는 것은 View 의 표다 (원칙 2).
   */
  clock: WorldClockView;
}

/** 세계의 때 — C015 ADDED. 뒤척임(TURN)은 철과 철 사이의 60 초다 (Play 확정 1 · 3) */
export interface WorldClockView {
  dayPhase: 'DAY' | 'NIGHT';
  season: 'STILL' | 'SEEP' | 'LONG_NIGHT' | 'TURN';
  /** 세계가 선 뒤 시작된 하루의 수 (0 부터) */
  dayIndex: number;
  /** 몇 바퀴째인가 (0 부터) */
  seasonCycle: number;
}
