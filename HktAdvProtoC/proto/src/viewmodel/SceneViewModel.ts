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
  position?: { regionId: string; x: number; y: number };
  label: string;
  stateBadges: SceneBadge[];
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
