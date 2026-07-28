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

export interface SceneViewModel {
  /** 현재 tick */
  time: number;
  day: number;
  minuteOfDay: number;
  /** 시간 배속 (§36.2) — Phase 0 은 표시만 */
  speed: number;
  initialized: boolean;
  entities: SceneEntity[];
  globalBadges: SceneBadge[];
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
