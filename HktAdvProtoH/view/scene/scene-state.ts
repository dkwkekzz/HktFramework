// Render Plan (Scene State) — Presentation 결정 Layer 의 산출물이자
// Capability Layer(renderer/hud/input)의 유일한 입력.
// 여기에는 결정이 끝난 표현 지시만 있다 — capability 는 게임 의미를 모른다.

export interface SceneEntity {
  id: string;
  spriteId: string; // Asset Registry 키 (예: player-pickaxe:idle)
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
  widget: 'counter' | 'flag';
  label: string;
  icon?: string;
  value: number | boolean;
  celebrateGain?: boolean;
}

export interface SceneState {
  specId: string;
  terrain: string;
  entities: SceneEntity[];
  interactions: SceneInteraction[];
  hud: SceneHudItem[];
}
