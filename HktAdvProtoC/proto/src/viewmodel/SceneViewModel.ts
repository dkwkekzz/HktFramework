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

export interface SceneViewModel {
  /** 현재 tick */
  time: number;
  day: number;
  minuteOfDay: number;
  /** 시간 배속 (§36.2) — Phase 0 은 표시만 */
  speed: number;
  initialized: boolean;
  /** 조작 중이면 **플레이어가 아는 개체만** 실린다 (§7.2) */
  entities: SceneEntity[];
  globalBadges: SceneBadge[];
  /** 조작 중일 때만 존재한다 (§31) */
  player?: ScenePlayerPanel;
}

export function createEmptyScene(): SceneViewModel {
  return {
    time: 0,
    day: 0,
    minuteOfDay: 0,
    speed: 1,
    initialized: false,
    entities: [],
    globalBadges: [],
  };
}
