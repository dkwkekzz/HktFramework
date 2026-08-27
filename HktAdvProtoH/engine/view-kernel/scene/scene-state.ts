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
   *
   * C011 — 막힌·무너진 타격에서는 관찰이 꺼져 있어도 채워진다.
   * "막아서 이만큼 덜 아팠고 기력을 이만큼 냈다" 를 그 자리에서 읽지 못하면
   * 맞바꿨다는 사실 자체가 플레이어에게 일어나지 않는다 (04 strikeEvents.meaning).
   */
  detail?: string;
  /**
   * 막기가 이 한 방에 한 일 (C011) — 막지도 무너지지도 않았으면 없다.
   * 무너짐은 막힘과 눈에 띄게 달라야 하므로 capability 가 다르게 그린다.
   */
  guard?: 'blocked' | 'broken';
}

// 한 번 켜지는 이펙트 (F1) — 세계의 *사건*을 그림이 아니라 게놈으로 드러낸다.
//
// 여기 있는 것은 "무엇을 · 어디서 · 얼마나 세게" 뿐이다. 그 이펙트가 어떻게 생겼는지는
// 게놈이 정하고(engine/view-kernel/fx/splat/fx.js), 어떤 사건이 어떤 게놈을 켜는지는
// 컨텐츠 팩이 정한다(content/<pack>/view/effect-presentation.ts).
// capability 는 이것이 타격인지 채굴인지 모른다 — 슬롯 하나를 켤 뿐이다.
export interface SceneEffect {
  /**
   * 같은 사건을 두 번 켜지 않기 위한 키.
   * 이펙트는 상태가 아니라 *사건*이다 — 관찰 결과는 같은 타격을 여러 프레임 동안
   * 실어 보내지만(TTL), 켜지는 것은 처음 본 그 한 번뿐이다.
   */
  id: string;
  /** 이펙트 게놈 이름 (FX_PRESETS) */
  effect: string;
  /** 발생 자리 — 지면 좌표 */
  position: { x: number; z: number };
  /** 지면에서 띄울 높이 (맞은 자리는 가슴께, 캐낸 자리는 광맥 허리께) */
  elevation: number;
  /** 축 — 타격이면 맞은 쪽 법선. 없으면 위 */
  direction?: { x: number; y: number; z: number };
  /**
   * 사건의 세기 (게놈이 아니다 — 04 F6). 같은 이펙트의 스침과 정통을 가른다.
   * 게놈은 이 세기에 대한 *감도*만 가진다.
   */
  strength: number;
  /** 축 둘레 회전(rad) — 부채꼴 이펙트(검격)의 칼날 각도 */
  roll?: number;
  /**
   * 태어나는 껍질의 초기 반경 (게임 세계 단위). 없으면 게놈 기본값.
   * *전체 크기*가 아니라 스플랫이 처음 놓이는 자리다 — 큰 몸을 후려친 한 방은
   * 점에서 터지지 않고 이만큼 벌어진 데서 시작한다.
   */
  radius?: number;
  /** 초기 반경에 곱하는 배율 — radius 와 곱해진다 (셰이더에서 r0 = radius × scale) */
  scale?: number;
}

// 자기 몸에 대한 상시 표시 (C007 hud.self) — 같은 값을 남에 대해서도 볼 수 있지만,
// 이것은 늘 눈앞에 있는 자리다.
export interface SceneSelf {
  health: number;
  healthMaximum: number;
  healthRatio: number;
  /** 생명 막대를 부르는 말 (형식화 완료 — 예: `HP`). **기반은 이 이름을 짓지 않는다** */
  healthLabel: string;
  energy: number;
  energyMaximum: number;
  energyRatio: number;
  /** 기력 막대를 부르는 말 (형식화 완료 — 예: `CP`) */
  energyLabel: string;
  downed: boolean;
  moveMode: string; // walk | run (의미 코드 — 문구는 이미 결정됐다)
  moveModeCode: string; // 요청에 쓸 원래 코드
  /**
   * 막기 상태 (C011). 막기는 스스로 끝나지 않으므로 들고 있다는 것을 잊으면
   * 스킬이 왜 안 나가는지 알 수 없게 된다 — 늘 눈앞에 둔다.
   * text 는 형식화 완료된 문구이며, 아무것도 아닐 때는 없다.
   */
  guard: { guarding: boolean; broken: boolean; text?: string };
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
  /**
   * counter 가 늘었을 때 잠시 떠오르는 말 — **문장째** 결정 Layer 가 짓는다.
   * `{}` 자리에 늘어난 만큼이 들어간다 (예: `+{} 돌 획득!`).
   * 없으면 늘어도 아무것도 뜨지 않는다 — 무엇이 축하할 일인지는 팩이 정한다.
   */
  celebrateText?: string;
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
  /**
   * 비워 두면 어떻게 되는가 — **문장째다** (예: `비우면 내 몸`).
   * 비울 수 없는 자리에는 없다. 그리는 쪽은 "비우면" 이라는 말을 알지 못한다.
   */
  omittedText?: string;
}

export interface SceneCommandEntry {
  id: string;
  title: string; // 무엇을 하는가 (문구)
  /** 세계로 가는가, 관찰자 쪽에서 끝나는가 — 04 commandSurface.origin */
  origin: 'world' | 'observer';
  /** 그 경계를 부르는 말 (형식화 완료 — 예: `세계` · `내 화면`) */
  originText: string;
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
  /** 그 자리를 가리키는 말 (형식화 완료 — 예: `다음: 속성`). nextSlot 과 함께 온다 */
  nextText?: string;
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
  /** 닫는 자리를 부르는 말 (형식화 완료) — 손가락·읽어 주는 장치가 이것으로 닿는다 */
  closeText: string;
  entries: SceneCommandEntry[];
  composition: SceneCommandComposition;
  history: SceneCommandHistoryLine[];
}

// ── 겹쳐 뜨는 표면 (범용 capability) ─────────────────────────────────
//
// 화면 위에 열렸다 닫히는 자리 하나. 열려 있는 동안 자판을 잡고, Escape 로 닫히며,
// 손가락뿐인 기기를 위해 닫는 자리를 가진다.
//
// **여기에 게임의 명사가 하나도 없다.** 무엇의 목록인지, 칸이 무엇을 담는지,
// 줄이 무슨 행동인지 이 형도 이것을 그리는 쪽도 알지 못한다 — 결정 Layer 가 이미
// 정해 둔 글자와 상태를 옮길 뿐이다 (설계 반전 ⑤: capability 는 엔진, 결정은 팩).
//
// SceneCommandSurface 와 **합치지 않는다.** 명령 표면은 타이핑과 후보 좁힘이라는
// 자기 기계장치를 가지며, 그것을 이 범용 형에 밀어 넣으면 형이 명령의 모양을 닮는다.
// 하나로 합칠지는 두 번째 팩이 실제로 다른 패널을 요구할 때 정한다
// (design/Design-System-Content-Separation.md — 승격 규칙 1 · 남은 부채).

/**
 * 줄 하나의 상태 — **요청의 어휘이지 게임의 어휘가 아니다.**
 *
 *   available  지금 되는 것
 *   blocked    안 되는 것 — 사라지지 않고 사유와 함께 남는다
 *   pending    보냈고 대답을 기다리는 중 — 아직 아무것도 참이 아니다
 */
export type SceneSurfaceRowState = 'available' | 'blocked' | 'pending';

/** 나란히 놓이는 칸 하나 — 자리의 유한함이 자리로 읽히게 하는 원소 */
export interface SceneSurfaceCell {
  id: string;
  /** 이 칸의 글자 (형식화 완료). 빈 자리면 빈 문자열이다 */
  text: string;
  /** 칸에 곁들이는 작은 글자 (수량 등, 형식화 완료) */
  detail?: string;
  /**
   * 이 칸이 **얼마나 찼는가** — 0..1. 그리는 쪽은 이것을 배경의 명암으로 옮긴다.
   *
   * 무엇의 양인지 알지 못한다 (수량일 수도, 남은 쓰임일 수도 있다). 견주는 기준을
   * 정하는 것도 결정 Layer 다 — 이 능력은 받은 비율을 그릴 뿐이다.
   *
   * **곁들이는 표시다.** 같은 값이 언제나 글자로도 서 있어야 한다 (`detail`) —
   * 명암만으로 세는 것은 눈이 밝은 사람에게만 참인 화면이 된다.
   */
  level?: number;
  /**
   * 칸 귀퉁이에 붙는 **짧은 표식** (형식화 완료 — 예: `NEW`).
   *
   * 무슨 뜻인지 알지 못한다. 읽어 주는 장치에도 이 글자가 그대로 실린다 —
   * 표식이 색이나 점이면 보이지 않는 사람에게는 없는 것과 같다.
   */
  badge?: string;
  /**
   * 고르기 전에 읽는 **곁말** — 손을 얹거나 초점이 닿으면 열리고 Escape 로 닫힌다.
   *
   * 줄 단위로 온다. **전부 형식화 완료**이며 그리는 쪽은 무엇의 줄인지 알지 못한다.
   * 없으면 이 칸에는 곁말 자체가 없다 (빈 배열도 없는 것과 같다).
   *
   * 읽어 주는 장치에도 그대로 실린다 — 곁말이 손에만 열리면, 그 정보는 눈과 손이
   * 있는 사람에게만 있는 것이 된다.
   */
  tip?: readonly string[];
  /** 아무것도 없는 자리인가 — 그리는 쪽이 다르게 그린다. **빈 칸도 그려진다** */
  empty: boolean;
  /** 겪는 사람이 골라 둔 칸인가. 초점과 다른 것이다 (surface.focusId) */
  selected: boolean;
}

/** 읽어야 아는 것 한 줄 — 되는 것과 안 되는 사유가 여기 선다 */
export interface SceneSurfaceRow {
  id: string;
  text: string;
  /** 손가락 자리 안내 등 곁들이는 글자 (형식화 완료) */
  hint?: string;
  state?: SceneSurfaceRowState;
}

/**
 * 글자를 받는 자리 하나 — **표면 안에서 사람이 쳐 넣는 것**.
 *
 * 여기 있는 것은 지금 들어 있는 글자와 빈 자리의 안내뿐이다. 그 글자가 무엇을 하는지
 * (거르는 말인지, 이름인지, 찾는 말인지) 이 형도 그리는 쪽도 알지 못한다 —
 * 쳐 넣은 것을 결정 Layer 에게 돌려줄 뿐이고, 무엇이 될지는 그쪽이 정한다.
 *
 * **글자는 결정 Layer 가 쥔다.** 표면은 그것을 비출 뿐이다. 그리는 쪽이 자기 안에
 * 글자를 쥐면 같은 표면을 두 번 그릴 때 둘이 어긋나고, 그때 화면에 있는 글자와
 * 판단에 쓰인 글자가 달라진다.
 */
export interface SceneSurfaceField {
  id: string;
  /** 지금 들어 있는 글자 */
  text: string;
  /** 비어 있을 때 그 자리에 남는 안내 (형식화 완료) */
  placeholder?: string;
  /** 읽어 주는 장치를 위한 이름 — 글자가 없는 자리이므로 이것이 그 이름이다 */
  label: string;
  /**
   * **지금 이 자리로 캐럿을 옮겨 달라** — 결정 Layer 의 청함이다.
   *
   * 표면이 열리자마자 캐럿이 여기 앉으면 방향키도 다른 키도 전부 글자가 되어,
   * 자판으로 표면을 몰 수 없게 된다. 그래서 이 자리는 **청할 때만** 캐럿을 받는다.
   *
   * 참인 프레임에 한 번 옮긴다. 결정 Layer 는 이것을 **한 프레임만** 참으로 둔다 —
   * 계속 참으로 두면 사람이 다른 곳을 눌러 빠져나가도 다음 프레임이 도로 끌어온다.
   */
  claimFocus?: boolean;
}

/**
 * 칸을 어떤 꼴로 그릴 것인가 — **그리는 쪽의 결정**이며 계약에서 오지 않는다.
 *
 *     slot   자리 하나 (기본) — 격자에 나란히 서고 빈 자리도 자리로 읽힌다
 *     chip   고르는 단추 — 글자만큼만 차지하고 한 줄로 흐른다.
 *            도구 띠처럼 "무엇을 볼지" 를 고르는 자리가 물건 칸만 한 자리를 쓰면
 *            띠가 아니라 또 하나의 격자가 된다
 */
export type SceneSurfaceShape = 'slot' | 'chip';

/** 표면 안의 한 구획 — 칸들이거나 줄들이다 */
export interface SceneSurfaceSection {
  id: string;
  title?: string;
  /** 몇 칸씩 놓을 것인가 — 그리는 쪽의 결정이며 계약에서 오지 않는다 (chip 은 쓰지 않는다) */
  columns?: number;
  /** 칸의 꼴 — 없으면 `slot` 이다 */
  shape?: SceneSurfaceShape;
  /** 글자를 받는 자리 — 제목 아래, 칸·줄 위에 선다 */
  field?: SceneSurfaceField;
  cells?: SceneSurfaceCell[];
  rows?: SceneSurfaceRow[];
  /** 담을 것이 없을 때 그 자리에 남길 글자 — 비어 있음과 안 그림은 다르다 */
  emptyText?: string;
}

export interface SceneSurface {
  id: string;
  open: boolean;
  title: string;
  /** 지금 자판이 가리키는 칸/줄의 id. **고르기가 아니다** (cell.selected 와 다른 것) */
  focusId?: string;
  sections: SceneSurfaceSection[];
  /** 맨 아래 안내 줄들 (형식화 완료) */
  footer: string[];
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
  /** 이번에 켜야 할 이펙트들 — 이미 켠 사건은 다시 실리지 않는다 (F1) */
  effects: SceneEffect[];
  worldTime: number; // C007 — 타격 결과의 나이를 재는 기준 (세계 시각)
  commandSurface: SceneCommandSurface; // C009 — 명령 목록·안내·기록
  /**
   * 지금 떠 있는 겹침 표면들 — 열리지 않은 것도 실릴 수 있다 (open 이 가른다).
   * 여러 개가 열려 있으면 **뒤의 것이 위**다 — Escape 는 위의 것부터 닫는다.
   */
  surfaces: SceneSurface[];
  /** 늘 떠 있는 칸 띠들 — 자판을 잡지 않는다. 없으면 빈 배열이다 */
  slotBars: SceneSlotBar[];
  /**
   * 지면 위에 그릴 구역들 — 비면 아무것도 그리지 않는다.
   *
   * **이 층은 그것이 무엇의 구역인지 모른다** (설계 반전 ⑤ — capability 는 엔진,
   * 결정은 팩). 법칙도 예외도 안전지대도 알지 못하고, 범위와 색과 이름을 그릴 뿐이다.
   */
  zones: SceneGroundZone[];
  /**
   * 조작 안내 패널에 **팩이 보태는 줄들** (형식화 완료 — 예: `가진 것: I`).
   *
   * 그 패널은 지금까지 엔진 기본 넷과 `interactions` 중 키를 지닌 것만 세웠다.
   * 그래서 팩이 자기 규칙으로 듣는 키(여닫는 키·두 걸음 여는 키)는 **한 번도 뜬 적이
   * 없었다** — 세계의 interaction 이 아니기 때문이다. 이 자리가 그 구멍이다.
   *
   * 엔진은 줄을 **그대로 세운다.** 무슨 키인지도, 왜 그 순서인지도 묻지 않는다.
   */
  keyHints?: readonly string[];
}

// ── 지면 구역 (범용 capability) ───────────────────────────────────────
//
// 지면 위에 범위 하나를 그린다. **의미가 없다** — 무엇의 구역인지 이 형도, 그리는 쪽도
// 모른다. 팩이 색·이름·강조를 정해 넘기고 엔진은 지형을 따라가는 반투명 면으로 그린다.
//
// 모양은 원 하나다. 사각형도 폴리곤도 두지 않는다 — 요구가 실제로 생길 때 더한다.

export interface SceneGroundZone {
  /** 같은 구역을 프레임 사이에 이어 보기 위한 이름 */
  id: string;
  shape: { kind: 'circle'; center: { x: number; z: number }; radius: number };
  /** 채움. 없으면 테두리만 그린다 */
  fill?: { color: number; opacity: number };
  /** 테두리. 없으면 채움만 그린다 */
  edge?: { color: number; opacity: number; width: number };
  /**
   * 0..1 — 강조. 이 값이 있으면 구역이 세계 시각에 맞추어 맥동한다.
   * 팩이 "지금 작용 중" 같은 것을 이 값으로 표현한다. 없으면 맥동하지 않는다.
   */
  intensity?: number;
  /** 형식화 완료된 구역 이름 — 없으면 안 그린다. 엔진은 이 글자의 뜻을 모른다 */
  label?: string;
}

// ── 슬롯 띠 (범용 capability) ─────────────────────────────────────────
//
// **늘 떠 있고 자판을 잡지 않는다.** 겹쳐 뜨는 표면(SceneSurface)과 다른 원소다 —
// 그쪽은 열고 닫으며 자판을 붙잡고, 이쪽은 화면 아래에 계속 서 있다.
// 둘을 한 형에 밀어 넣지 않는 이유가 그것이다: 늘 열려 있는 표면은 자판을 영영
// 붙잡게 되고, 그러면 몸이 움직이지 않는다.
//
// 이 원소가 소유하는 것은 **칸을 나란히 그리는 일**뿐이다. 칸이 무엇을 담는지,
// 왜 안 되는지, 무엇이 급한지 알지 못한다 — 결정 Layer 가 만든 지시를 그릴 뿐이다
// (설계 반전 ⑤).

export type SceneSlotState = 'available' | 'blocked' | 'pending';

/** 띠의 칸 하나 — 부르는 자리 · 이름 · 값 · 지금 어떤가 */
export interface SceneSlotCell {
  id: string;
  /** 이 칸을 부르는 손가락 자리 표기 (형식화 완료). 부를 수 없으면 없다 */
  key?: string;
  /** 칸의 이름 (형식화 완료) */
  title: string;
  /** 이름 아래 한 줄 — 고르기 전에 아는 값 (형식화 완료). 없을 수 있다 */
  detail?: string;
  /** 지금 어떤가 — **짧은 표기**다. 긴 문장은 이 자리에 오지 않는다 */
  status?: string;
  state: SceneSlotState;
}

export interface SceneSlotBar {
  id: string;
  cells: SceneSlotCell[];
}
