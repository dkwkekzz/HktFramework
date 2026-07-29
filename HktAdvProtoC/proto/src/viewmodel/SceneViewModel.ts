// SceneViewModel — 렌더·UI 가 참조할 수 있는 유일한 데이터 (분해 원칙 5, Phase 0 §0.6)
// "표시 대상의 속성"만 담는다. 어떻게 그릴지는 렌더러, 시뮬레이션 의미 해석은 빌더의 몫.
// 이후 Phase 는 이 스키마에 필드를 추가할 뿐이다 (map/overlays=P8, panels=P7 …).

export interface SceneBadge {
  key: string;
  value: string;
}

export interface SceneEntity {
  id: string;
  /** EntityType 문자열 — 렌더러는 의미를 해석하지 않고 심볼 키로만 쓴다 */
  kind: string;
  /** 2D 톱다운 투영 좌표 — 3D→2D 투영은 빌더에서 끝난다 (공간 데이터는 3D, §13 개정) */
  position?: { regionId: string; x: number; y: number };
  /** 고도(z)의 표시 속성 — 2D 렌더러는 음영·라벨 등으로 표현할 수 있다 */
  elevation?: number;
  label: string;
  stateBadges: SceneBadge[];
  /** 개체 분류 태그 — 렌더러는 의미를 해석하지 않고 묶음 키로만 쓴다 */
  tags: string[];
  /** 가장 활성화된 목적 (§19) — 없으면 지금 좇는 목적이 없다 */
  topGoal?: { id: string; activation: number };
}

// --- 월드 지도 (§36.2 / Phase-8 §8.1) ------------------------------------------------
// 좌표는 전부 **정규화된 0~1 톱다운 값**이다. 3D→2D 투영·지역 배치·정규화는 빌더에서 끝났다(§13 개정).
// 색상 키·심볼 키도 빌더가 수치를 해석해 만든 것이다 — 렌더러에는 `if (danger > 50)` 이 한 줄도 없다.

export interface ScenePoint {
  x: number;
  y: number;
}

export interface SceneRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SceneMapRegion {
  id: string;
  label: string;
  /** 정규화 톱다운 사각형 */
  rect: SceneRect;
  /** 기후 색상 키 — 빌더가 지역 상태·태그에서 변환 (`climate-cold` 등) */
  climateKey: string;
  /** 위험도 색상 키 (`danger-low|mid|high|extreme`) */
  dangerKey: string;
  /** 고도 대표값과 음영 강도 0~1 — 2D 렌더러가 음영·라벨로 표현한다 */
  elevation: number;
  elevationShade: number;
  badges: SceneBadge[];
  tags: string[];
  /**
   * §13 지역 프로필 — "여기서 무엇이 나고, 어느 종이 살 만한가" (G-5).
   * 빌더가 정의의 resourceProfiles/speciesSuitability 를 표시용 문자열로 옮긴 것이다.
   */
  ecology: SceneRegionEcology;
}

/** 지도 위 지역 한 곳의 생태 요약 (§13) */
export interface SceneRegionEcology {
  /** `자원 이름 ×노드수` 형태 — 희귀도 순 */
  resources: { label: string; rarity: number; nodeCount: number }[];
  /** 종족 이름 → 적합도 0~100, 높은 순 */
  species: { label: string; suitability: number }[];
}

export interface SceneMapConnection {
  from: string;
  to: string;
  fromPoint: ScenePoint;
  toPoint: ScenePoint;
  dangerKey: string;
  /** 선 굵기 0~1 — capacity 를 빌더가 정규화한 것 */
  width: number;
  label: string;
  /** §13 requirements — 조건이 걸린 길인가 (G-5). 렌더러는 점선 등으로 구분한다 */
  gated: boolean;
  /** 지금 보고 있는 주체에게 이 길이 열려 있는가 (조건이 없으면 항상 true) */
  openToViewer: boolean;
}

/** 지도 위의 마커 하나 — 주체·자원·장소가 같은 속성 모양을 쓴다 (렌더러는 symbolKey 만 본다) */
export interface SceneMapMarker {
  id: string;
  label: string;
  /** 심볼 키 (§42-8 캐릭터 아이콘) — 종족·조직·유형 태그를 빌더가 변환한 것 */
  symbolKey: string;
  /**
   * 도형 키 (`shape-sphere|crystal|pyramid|cube|banner`) — 개체가 **무엇으로 보이는가**.
   * 의미(유형·태그)→도형의 번역은 빌더가 끝낸다. 렌더러는 표에서 찾아 그릴 뿐이다(§8.0).
   */
  shapeKey: string;
  /** 표시 크기 — 짧은 화면 변 대비 정규화 값(0~1). 픽셀 환산만 렌더러의 몫이다 */
  size: number;
  /** 상태 게이지(체력 등) — 수치 해석(현재/최대)은 빌더가 끝냈고 렌더러는 바로 그린다 */
  gauge?: { value: number; colorKey: string };
  /** 강조 대상(조작 중인 주체 등) — 렌더러가 링으로 표현한다 */
  emphasized?: boolean;
  colorKey: string;
  point: ScenePoint;
  regionId: string;
  elevation: number;
  elevationShade: number;
  /** 이동 중인가 (§36.2) — 이동 중이면 to 로 보간된 위치가 point 다 */
  moving: boolean;
  /** 이동 목적지 (있으면 렌더러가 궤적을 그릴 수 있다) */
  moveTo?: ScenePoint;
  badges: SceneBadge[];
  tags: string[];
}

/** 발생 중 사건의 오버레이 (§36.2 "현재 발생 중인 사건") */
export interface SceneOverlay {
  eventId: string;
  label: string;
  symbolKey: string;
  colorKey: string;
  point: ScenePoint;
  /** 정규화 반경 — 패턴의 locationRadius 를 빌더가 정규화 */
  radius: number;
  /** 중요도 강도 0~1 */
  intensity: number;
  /** 남은 시급도 0~1 (§30 timeSensitivity) */
  urgency: number;
  participantCount: number;
  ongoing: boolean;
}

/**
 * 관찰 신호·능력 효과 (§42-8 연출).
 * 별도 연출 스크립트는 없다 — 신호 속성에서만 파생된다(§8.3).
 */
export interface SceneSignal {
  id: string;
  /** 채널 키 — SignalRenderer 가 채널별 시각 언어(파문·잔광·아이콘)로 옮긴다 */
  channelKey: string;
  intensity: number;
  point: ScenePoint;
  regionId: string;
  /** 남은 표시 시간(tick) */
  ttl: number;
  label: string;
  tags: string[];
}

export interface SceneMap {
  regions: SceneMapRegion[];
  connections: SceneMapConnection[];
  /** 주체 마커 */
  markers: SceneMapMarker[];
  /** 자원 분포 (§36.2) */
  resources: SceneMapMarker[];
  /** 장소 (§13 location) */
  places: SceneMapMarker[];
  overlays: SceneOverlay[];
  signals: SceneSignal[];
  legend: SceneBadge[];
}

export function createEmptyMap(): SceneMap {
  return {
    regions: [],
    connections: [],
    markers: [],
    resources: [],
    places: [],
    overlays: [],
    signals: [],
    legend: [],
  };
}

// --- 주체 관찰 화면 (§36.3 / Phase-8 §8.1) --------------------------------------------
// 개발자 모드 = 실제+믿음 병렬, 플레이어 모드 = 관찰 가능한 현상만.
// **모드는 렌더러의 분기가 아니라 빌더의 입력이다** — 렌더러는 자기가 어느 모드인지 모른다.

export type SceneViewMode = "developer" | "player";

/** 상태 한 줄 — 개발자 모드에서는 actual 과 believed 가 나란히 실린다 */
export interface SceneStateRow {
  subjectId: string;
  key: string;
  /** 실제 상태 (§36.3 ①) — 플레이어 모드에서는 아예 실리지 않는다 */
  actual?: string;
  /** 주체가 믿고 있는 값 (§36.3 ②) */
  believed?: string;
  confidence?: string;
  /** 실제와 믿음이 갈라졌는가 — 판단은 빌더가 끝냈다 */
  divergent: boolean;
  observable: boolean;
  /** self=자기 감각, belief=믿음, sense=지금 보이는 것, actual=세계의 실제값 */
  sourceKey: string;
}

/** 목적 그래프 노드 (§36.3 ④ — 활성도 값 포함) */
export interface SceneGoalNode {
  id: string;
  description: string;
  activation: number;
  urgency: number;
  active: boolean;
  /** graph=자기 목적, delegated=조직 위임 (§17) */
  sourceKey: string;
  /** §20 활성도 11항 — "왜 이 목적을 골랐는가" */
  breakdown: SceneBadge[];
  edges: { to: string; relation: string; weight: number }[];
}

export interface SceneMemoryRow {
  at: string;
  type: string;
  summary: string;
  intensity: number;
  relevance: number;
  confidence: number;
  tags: string[];
  participants: string[];
}

export interface SceneRelationRow {
  toId: string;
  label: string;
  axes: SceneBadge[];
  secretCount: number;
  promises: { status: string; detail: string }[];
}

/** 능력과 제약 (§36.3 ⑧, §16) */
export interface SceneAbilityRow {
  id: string;
  purpose: string;
  operation: string;
  medium: string;
  mastery: number;
  outputRange: string;
  restrictions: { description: string; severity: number }[];
  costs: string[];
  weakness: string;
  /** §44-11 능력이 어느 욕망·경험·대가에서 파생됐는가 */
  derivedFrom: string;
  actionIds: string[];
  ruleIds: string[];
}

export interface SceneAgentPanel {
  agentId: string;
  label: string;
  modeKey: SceneViewMode;
  symbolKey: string;
  /** ① 실제 상태 / ② 믿음 상태 — 같은 표의 두 열 */
  states: SceneStateRow[];
  /** 이 주체가 **남에 대해** 믿고 있는 것 (§10) */
  beliefsAboutOthers: SceneStateRow[];
  /** ③ 현재 활성 목적 */
  activeGoal?: { id: string; description: string; activation: number };
  /** ④ 목적 그래프 */
  goalGraph: SceneGoalNode[];
  /** ⑤ 현재 행동 */
  currentAction?: {
    actionId: string;
    label: string;
    targets: string;
    startedAt: string;
    completesAt: string;
    /** 진행률 0~1 */
    progress: number;
  };
  /** ⑥ 기억 */
  memories: SceneMemoryRow[];
  /** ⑦ 관계 */
  relationships: SceneRelationRow[];
  /** ⑧ 능력과 제약 */
  abilities: SceneAbilityRow[];
  /** 관찰 묘사 (§33.3) — Interpreter 가 만든 문장 */
  narration: string[];
  /** 플레이어 모드에서 감춰진 상태 수 — "무엇을 못 보는지"까지는 알려준다(§30) */
  hiddenCount: number;
  badges: SceneBadge[];
}

// --- 사건 화면 (§36.4 / Phase-8 §8.1) ------------------------------------------------

export interface SceneEventListItem {
  eventId: string;
  type: string;
  /** Interpreter 가 만든 사건 제목 (§33.3) */
  title: string;
  status: string;
  startedAt: string;
  significance: number;
  participantCount: number;
  /** 관찰자가 이 사건의 존재를 아는가 */
  known: boolean;
  regionId?: string;
  urgency: number;
  colorKey: string;
}

export interface SceneTimelineRow {
  at: string;
  tick: number;
  label: string;
  tags: string[];
  states: string[];
  /** 이 변화가 플레이어의 행동에서 나왔는가 (§36.4 ⑥ 교차) */
  byPlayer: boolean;
}

export interface SceneEventDetail {
  eventId: string;
  type: string;
  title: string;
  /** ④ 실제 원인의 문장화 (§33.3 사건 요약) */
  summarySentence: string;
  modeKey: SceneViewMode;
  status: string;
  startedAt: string;
  concludedAt?: string;
  significance: number;
  significanceRows: SceneBadge[];
  /** ① 참여자 + ② 참여자별 목적 */
  participants: {
    id: string;
    label: string;
    symbolKey: string;
    known: boolean;
    goals: { id: string; activation: number }[];
  }[];
  /** ③ 알려진 정보 — 관찰자 시점 */
  knownFacts: string[];
  knownParticipantCount: number;
  unknownParticipantCount: number;
  /** ④ 실제 원인 — 원본 사건의 첫 변화들. 플레이어 모드에서는 비어 있다 */
  actualCauses: string[];
  causeVisible: boolean;
  /** ⑤ 시간순 상태 변화 */
  timeline: SceneTimelineRow[];
  /** ⑥ 플레이어 개입 기록 (journal 교차) */
  interventions: { at: string; kind: string; detail: string }[];
  /** ⑦ 발생한 결과 */
  results: { entityId: string; stateKey: string; before: string; after: string; delta: string }[];
  /** ⑧ 후속 사건 가능성 */
  followUps: { agentId: string; goalId: string; label: string }[];
  goalConflicts: string[];
  /** §33.3 표현 — 소문·문서·대화 */
  rumor: string;
  document: string;
  dialogue: { speakerId: string; label: string; line: string }[];
  /** 문장이 템플릿 폴백인지 생성인지 (§8.2 캐시·폴백) */
  narrationSourceKey: string;
}

// --- 플레이어 패널 (Phase-7 §7.3) ---------------------------------------------------
// UI 는 이 속성만 읽는다. "무엇을 숨길까"의 판단은 여기 오기 전에 이미 끝나 있다 —
// 코어의 지식 필터를 통과한 데이터만 빌더로 들어오기 때문이다(§36.3).

export interface SceneActionOption {
  actionId: string;
  name: string;
  /** 대상 표시 이름 (없으면 빈 문자열) */
  targets: string;
  targetIds: string[];
  goalId: string;
  /** 표시용으로 정리된 수치 */
  score: string;
  duration: string;
  risk: string;
  /** 이 후보가 "다가가기"라면 도착해서 하려던 행동 */
  approachFor?: string;
}

export interface SceneJournalEntry {
  at: string;
  kind: string;
  key: string;
  detail: string;
}

export interface SceneEventPanelItem {
  eventId: string;
  type: string;
  title: string;
  knownParticipants: string[];
  /** 아직 정체를 모르는 참여자 수 (§30 "아직 모르는 것") */
  unknownParticipantCount: number;
  knownFacts: string[];
  interactions: string[];
  urgency: string;
}

export interface SceneGrowthOffer {
  offerId: string;
  key: string;
  options: { id: string; restriction: string; severity: string; grants: string }[];
}

export interface ScenePlayerPanel {
  playerId: string;
  label: string;
  facts: SceneBadge[];
  goals: { id: string; activation: number }[];
  currentAction?: { actionId: string; targets: string; completesAt: number };
  actionPanel: SceneActionOption[];
  journal: SceneJournalEntry[];
  eventPanel: SceneEventPanelItem[];
  growthOffers: SceneGrowthOffer[];
  growthLog: string[];
  /** 아직 모르는 개체 수 — 정체는 알려주지 않는다 */
  undiscoveredCount: number;
}

/**
 * 빌더가 만든 표시 재료가 경계를 넘는 형태 (§38).
 * 시뮬레이션 쪽에서 의미 해석이 끝난 뒤의 속성만 실린다 — 그래서 메인 스레드에는 해석 코드가 없다.
 */
export interface SceneViewPayload {
  modeKey: SceneViewMode;
  /** §36.2 시간 배속 — 한 번의 진행이 무는 시간의 배수 */
  speed: number;
  map: SceneMap;
  events: SceneEventListItem[];
  /** §29 저중요도 필터 (G-9) — 플레이어 시점에서 접힌 사건 수 */
  suppressedEventCount: number;
  agentChoices: { id: string; label: string; symbolKey: string }[];
  agentPanel?: SceneAgentPanel;
  eventDetail?: SceneEventDetail;
}

export interface SceneViewModel {
  /** 현재 tick */
  time: number;
  day: number;
  minuteOfDay: number;
  /** 표시용 시각 문자열 — 자리수 맞춤도 "표시 대상 선별"이므로 빌더의 몫이다 */
  clock: string;
  /** 시간 배속 (§36.2) */
  speed: number;
  initialized: boolean;
  /** 이 장면이 어느 시점으로 만들어졌는가 (§36.3) — 렌더러는 읽지 않는다 */
  modeKey: SceneViewMode;
  /** 조작 중이면 **플레이어가 아는 개체만** 실린다 (§7.2) */
  entities: SceneEntity[];
  globalBadges: SceneBadge[];
  /** 월드 지도 화면의 표시 재료 (§36.2) */
  map: SceneMap;
  /** 사건 목록 (§36.4 진입점) */
  events: SceneEventListItem[];
  /** §29 — 중요도 미달로 접힌 사건 수 (플레이어 시점, G-9) */
  suppressedEventCount: number;
  /** 열어 본 사건의 상세 (§36.4) */
  eventDetail?: SceneEventDetail;
  /** 관찰 중인 주체 (§36.3) */
  agentPanel?: SceneAgentPanel;
  /** 관찰 대상으로 고를 수 있는 주체 목록 */
  agentChoices: { id: string; label: string; symbolKey: string }[];
  /** 조작 중일 때만 존재한다 (§31) */
  player?: ScenePlayerPanel;
}

export function createEmptyScene(): SceneViewModel {
  return {
    time: 0,
    day: 0,
    minuteOfDay: 0,
    clock: "0일차 00:00",
    speed: 1,
    initialized: false,
    modeKey: "developer",
    entities: [],
    globalBadges: [],
    map: createEmptyMap(),
    events: [],
    suppressedEventCount: 0,
    agentChoices: [],
  };
}
