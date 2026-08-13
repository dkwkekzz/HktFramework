// Render Plan (Scene State) — Presentation 결정 Layer 의 산출물이자
// Capability Layer(renderer/hud/input)의 유일한 입력.
// 여기에는 결정이 끝난 표현 지시만 있다 — capability 는 게임 의미를 모른다.

// 모션 재생 지시 (C002) — 어떤 시트를 어떻게 재생할지는 결정 Layer 가 이미 정했다.
export interface SceneMotion {
  id: string; // 진단용 (예: rabbit-swordsman/idle)
  url: string; // 시트 이미지 주소
  cols: number;
  rows: number;
  frames: number;
  fps: number;
  mode: 'loop' | 'progress';
  progress?: number; // mode = progress 일 때의 0..1
}

export interface SceneEntity {
  id: string;
  spriteId: string; // Asset Registry 키 (예: player-pickaxe:idle) — 모션이 없을 때의 그림
  motion?: SceneMotion; // 있으면 이 모션을 재생한다 (C002)
  size: number;
  position: { x: number; z: number };
  label?: string; // 형식화 완료된 라벨 텍스트 (예: "돌 4")
  cameraFollow: boolean;
  trail: boolean;
}

export interface SceneInteraction {
  id: string;
  available: boolean;
  targetEntityId?: string; // entity 클릭 대상
  terrainTarget?: boolean; // 지형 클릭·이동키 대상
  key?: string; // KeyboardEvent.code
  keyLabel?: string; // 안내 표기 (예: "E")
  prompt?: string; // 가용 시 프롬프트 텍스트
  unavailableText?: string; // 불가 시 표시 텍스트
}

export interface SceneHudItem {
  id: string;
  widget: 'counter' | 'flag' | 'label';
  label: string;
  icon?: string;
  value: number | boolean | string;
  progress?: number; // 0..1 — 값에 진행 막대가 동반되는 경우 (C002)
  celebrateGain?: boolean;
}

export interface SceneState {
  specId: string;
  terrain: string;
  entities: SceneEntity[];
  interactions: SceneInteraction[];
  hud: SceneHudItem[];
}
