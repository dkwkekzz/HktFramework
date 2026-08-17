// Render Plan (Scene State) — Presentation 결정 Layer 의 산출물이자
// Capability Layer(renderer/hud/input)의 유일한 입력.
// 여기에는 결정이 끝난 표현 지시만 있다 — capability 는 게임 의미를 모른다.

import type { MotionGeometry } from '../motion/motion-geometry';

// 모션 재생 지시 (C002) — 어떤 시트를 어떻게 재생할지는 결정 Layer 가 이미 정했다.
export interface SceneMotion {
  id: string; // 진단용 (예: rabbit-swordsman/idle)
  url: string; // 시트 이미지 주소
  cols: number;
  rows: number;
  frames: number;
  fps: number;
  /**
   * 어떻게 재생하는가.
   *   loop      fps 로 반복 — 대기·이동처럼 끝이 없는 행동
   *   progress  진행도 0→1 에 맞춰 1회 — 공격·채굴처럼 소요 시간이 있는 행동
   *   once      fps 로 1회, 마지막 프레임에서 멈춤 — 쓰러짐처럼 되돌아오지 않는 상태
   */
  mode: 'loop' | 'progress' | 'once';
  progress?: number; // mode = progress 일 때의 0..1
  /**
   * 시트 안에서 프레임이 실제로 놓인 자리 — 정적 분석(tools/motion-atlas)의 결과다.
   * 없으면 그리는 쪽이 이미지 크기로 균등 분할한다 (예전 동작).
   */
  geometry?: MotionGeometry;
}

// 몸 위에 붙는 관찰 (C007 entityHud) — 이름과 생명. 늘 보인다.
// 어디에 어떻게 붙여 그릴지는 capability 가 정한다. 여기 있는 것은 무엇을 보일지다.
export interface SceneNameplate {
  name: string;
  health: number;
  healthMaximum: number;
  healthRatio: number; // 0..1 — 막대 길이는 이미 결정 Layer 가 구했다
  downed: boolean; // 참이면 살아 있는 존재와 구분해 그린다
  /**
   * 지면에서 이 표지를 띄울 높이 — 그 몸의 캡슐 정수리 바로 위다 (C006 Body.Height 기준).
   * 몸마다 키가 다르면 표지도 그 키를 따른다.
   */
  anchorHeight: number;
}

export interface SceneEntity {
  id: string;
  spriteId: string; // Asset Registry 키 (예: player-pickaxe:idle) — 모션이 없을 때의 그림
  motion?: SceneMotion; // 있으면 이 모션을 재생한다 (C002)
  size: number;
  tint?: number; // 그림에 곱할 색 (C002) — 없으면 원본 그대로
  position: { x: number; z: number };
  label?: string; // 형식화 완료된 라벨 텍스트 (예: "돌 4")
  nameplate?: SceneNameplate; // C007 — character 에만 있다
  inspect?: string[]; // C007 R2 — 속성 관찰이 켜졌을 때의 표시 줄들
  /**
   * 이 몸이 지금 시점에서 향한 것으로 읽히는 쪽 (C008).
   * 다음 프레임의 모호 구간 판정 기준이 되므로 조립 루트가 기억한다.
   * 몸 방향이 없는 대상(광맥 등)에는 없다.
   */
  facingSide?: 'left' | 'right';
  /** 그림을 좌우로 뒤집어 그릴 것인가 (C008) — 읽힌 쪽이 그림 기준 방향과 다를 때 참 */
  flip?: boolean;
  cameraFollow: boolean;
  trail: boolean;
}

// 한 번의 타격 결과 (C007 strikeEvents) — 맞은 자리에 잠시 떠올랐다 사라진다.
export interface SceneStrike {
  id: string; // 같은 결과를 이어 그리기 위한 키
  position: { x: number; z: number };
  text: string; // 표시 문구 (형식화 완료)
  emphasis: boolean; // 고급 스킬의 결과인가 — 크게 그린다
  since: number; // 세계 시각 — 얼마나 지났는지는 capability 가 fade 로 쓴다
  /** 지면에서 이 숫자가 뜰 높이 — 맞은 몸의 가슴께다 */
  anchorHeight: number;
  /**
   * 그 숫자가 나온 경위 (C010) — 형식화 완료된 한 줄.
   * 속성 관찰이 켜졌을 때만 채워진다. 늘 띄우면 숫자를 읽을 수 없기 때문이며,
   * 감춘 것이 아니라 표시 선택이다 (nameplate / inspect 와 같은 규칙).
   */
  detail?: string;
}

// 자기 몸에 대한 상시 표시 (C007 hud.self) — 같은 값을 남에 대해서도 볼 수 있지만,
// 이것은 늘 눈앞에 있는 자리다.
export interface SceneSelf {
  health: number;
  healthMaximum: number;
  healthRatio: number;
  energy: number;
  energyMaximum: number;
  energyRatio: number;
  downed: boolean;
  moveMode: string; // walk | run (의미 코드 — 문구는 이미 결정됐다)
  moveModeCode: string; // 요청에 쓸 원래 코드
  lines: string[]; // 템포 능력치·배율 — 이미 형식화된 줄들
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

// 충돌체 디버그 지시 (C006 / R1) — 지면 위 캡슐·구체 부피와 화살표.
// 결정 Layer 가 켜졌을 때만 담는다. capability 는 이것이 몸인지 휘두름인지 모른다 —
// 캡슐과 구체와 화살표를 그릴 뿐이다.
export interface SceneDebugCapsule {
  id: string; // 진단용
  center: { x: number; z: number }; // 지면 위 발치 중심 — 캡슐은 지면에서 height 만큼 선다
  radius: number;
  height: number;
  color: number;
  opacity: number;
}

export interface SceneDebugSphere {
  id: string; // 진단용
  center: { x: number; z: number };
  radius: number;
  elevation: number; // 지면에서 구 중심까지의 높이
  color: number;
  opacity: number;
}

export interface SceneDebugVector {
  id: string; // 진단용
  from: { x: number; z: number };
  to: { x: number; z: number };
  color: number;
}

export interface SceneColliderDebug {
  capsules: SceneDebugCapsule[];
  spheres: SceneDebugSphere[];
  vectors: SceneDebugVector[];
}

// ── 명령 표면 (C009 — 04 commandSurface) ────────────────────────────
//
// 결정 Layer 가 세계의 목록(commandCatalog)과 관찰자 쪽 목록(observerCommands)을
// 한 벌의 표시 지시로 합쳐 둔 것. capability 는 이것이 무슨 명령인지 모른다 —
// 줄과 자리와 후보를 그릴 뿐이다.

/** 명령이 받는 자리 하나 — 무엇을 넣어야 하고 어디까지 되는지가 문구로 끝나 있다 */
export interface SceneCommandSlot {
  id: string; // 자리 이름 (문구)
  required: boolean;
  hint: string; // 이 자리가 받는 것 (예: "0 … 100", "walk | run", "존재")
  options?: string[]; // 고를 수 있는 이름들 (있을 때만)
  omittedMeaning?: string; // 비워 두면 무엇이 되는가 (문구)
}

export interface SceneCommandEntry {
  id: string;
  title: string; // 무엇을 하는가 (문구)
  /** 세계로 가는가, 관찰자 쪽에서 끝나는가 — 04 commandSurface.origin */
  origin: 'world' | 'observer';
  available: boolean;
  unavailableText?: string;
  usage: string; // 어떻게 쓰는가 한 줄 (예: "set-attribute [대상] <속성> <값>")
  slots: SceneCommandSlot[];
  /** 관찰자 쪽 명령의 지금 상태 (켜짐/꺼짐 등). 세계 명령에는 없다 */
  stateText?: string;
}

/** 지금 쓰고 있는 것에 대한 안내 — 04 commandSurface.guide */
export interface SceneCommandComposition {
  text: string;
  /** 지금까지 적은 것에 해당하는 명령 후보들 */
  candidates: SceneCommandEntry[];
  /** 무엇을 더 적어야 하는가 — 다 채웠으면 없다 */
  nextSlot?: SceneCommandSlot;
  /** 그 자리에 넣을 수 있는 것들 (적은 것으로 좁혀진 뒤) */
  suggestions: string[];
  /** 틀린 것이 있으면 무엇이 틀렸는지 — 걸기 전에 알려 준다 */
  problem?: string;
  submittable: boolean;
}

/** 주고받은 한 줄 — 04 commandSurface.history */
export interface SceneCommandHistoryLine {
  text: string; // 내가 건 것
  answer?: string; // 돌아온 대답 (문구). 아직 오지 않았으면 없다
  accepted?: boolean;
}

export interface SceneCommandSurface {
  open: boolean;
  entries: SceneCommandEntry[];
  composition: SceneCommandComposition;
  history: SceneCommandHistoryLine[];
}

export interface SceneState {
  specId: string;
  terrain: string;
  entities: SceneEntity[];
  interactions: SceneInteraction[];
  hud: SceneHudItem[];
  colliderDebug?: SceneColliderDebug; // C006 — 디버그 관찰이 켜졌을 때만 존재한다
  self?: SceneSelf; // C007 — 자기 자원·능력치·배율 (아직 관찰 결과가 없으면 없다)
  strikes: SceneStrike[]; // C007 — 지금 떠 있는 타격 결과들
  worldTime: number; // C007 — 타격 결과의 나이를 재는 기준 (세계 시각)
  commandSurface: SceneCommandSurface; // C009 — 명령 목록·안내·기록
}
