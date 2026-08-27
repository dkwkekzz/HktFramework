// Terrain Presentation — 땅의 관찰값을 어떻게 보일지 결정한다 (결정 Layer 데이터).
//
// World 는 **의미 코드와 비율만** 보낸다 (`ground.zones[].law` · `phase` · `fill` ·
// `ground.self.state`). 넘침 지점도 뿜는 속도도 오지 않으므로 화면은 "몇 초 뒤에
// 넘친다" 를 계산할 수 없다 — 그것은 예고이고 다음 후보의 몫이다.
// 색도 문구도 여기서 정한다 — 미등록 코드도 기본 결정으로 그려진다.
//
// ── 이 파일이 판정하지 않는 것 ────────────────────────────────────────
//
// **안인지 밖인지도, 지금 걸려 있는지도 여기서 계산하지 않는다.** 세계가
// `ground.self.state` 로 이미 답했고, `zones` 의 범위는 **그리기 위한 것**이지
// 판정하기 위한 것이 아니다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
// 거리를 재는 코드가 이 파일에 생기면 그 순간 판정이 두 곳에 산다.

import type { GameViewSnapshot, GroundZoneView } from '../protocol/gameview';

// ── 법칙별 표현 ────────────────────────────────────────────────────────
//
// 법칙이 하나 늘어나는 일은 이 표에 줄이 하나 느는 일이다 — 세계에 법칙이 늘어도
// 이 파일의 코드는 열리지 않는다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH 와 같은 형태).

export interface GroundLawPresentation {
  /** 이 법칙의 자리를 부르는 말 */
  name: string;
  /** 거두는 중인 맥의 색 */
  lawColor: number;
  /** 뿜는 중인 맥의 색 — 같은 법칙의 것이므로 같은 계열에서 고른다 */
  respiteColor: number;
  /** 뿜는 중인 자리를 부르는 말 (C-TERRAIN-002) — 놓인 성질이 아니라 지금 하는 일이다 */
  ventingName: string;
}

const GROUND_LAWS: Record<string, GroundLawPresentation> = {
  // 해를 삼킨 빙원 — 대지가 열을 거두어 간다 (BT §5.1).
  // 푸른 쪽이 거두는 자리, 따뜻한 쪽이 멎는 자리다. **같은 계열이 아니라 반대 계열**을
  // 고른 이유는 그 둘이 한눈에 갈려야 하기 때문이다 — 예외 자리를 못 찾으면
  // 이 Cycle 의 플레이가 성립하지 않는다.
  'heat-binding': {
    name: '빙원',
    lawColor: 0x4a7fb5,
    respiteColor: 0xd98b45,
    ventingName: '해숨구멍',
  },
};

const DEFAULT_LAW: GroundLawPresentation = {
  name: '이름 없는 자리',
  lawColor: 0x8a8a8a,
  respiteColor: 0xc8c8c8,
  ventingName: '멎는 자리',
};

export function groundLawPresentation(law: string): GroundLawPresentation {
  return GROUND_LAWS[law] ?? DEFAULT_LAW;
}

// ── 자리 하나를 그리는 지시 ────────────────────────────────────────────
//
// 엔진의 지면 구역 장치(`SceneGroundZone`)가 소비할 형태다
// (design/Design-Terrain-Visualization.md · 04 의 engine_contract).
//
// **그 장치는 아직 서지 않았다.** ENGINE 레인의 산출이며, 없는 동안 이 함수의 결과는
// 화면에 오르지 않는다 — 그것이 그 문서가 정한 fallback 이다(zones 가 없거나 비면
// 아무것도 그리지 않고 게임은 돈다). 결정은 여기 이미 서 있으므로, 장치가 서면
// resolve 가 이 결과를 실어 보내는 한 줄만 는다.

export interface GroundZonePlan {
  id: string;
  shape: { kind: 'circle'; center: { x: number; z: number }; radius: number };
  fill: { color: number; opacity: number };
  edge: { color: number; opacity: number; width: number };
  /** 0..1 — 맥동·강조. 이 Cycle 은 쓰지 않는다 (맥동할 이유가 아직 없다) */
  intensity?: number;
  label: string;
}

export function groundZonePlan(zone: GroundZoneView): GroundZonePlan {
  const law = groundLawPresentation(zone.law);
  const venting = zone.phase === 'venting';
  const color = venting ? law.respiteColor : law.lawColor;
  const fill = clamp01(zone.fill);
  const percent = Math.round(fill * 100);

  return {
    id: zone.id,
    shape: { kind: 'circle', center: { x: zone.center.x, z: zone.center.z }, radius: zone.radius },
    // 멎는 자리를 더 진하게 둔다 — 찾아야 하는 것이기 때문이다.
    //
    // 법칙의 자리도 **눈으로 경계를 찾을 수 있을 만큼**은 진해야 한다. 0.18 로는
    // 지형 초록과 스무 단계밖에 벌어지지 않아 실제 화면에서 범위가 읽히지 않았다
    // (C-TERRAIN-001 Stage 8 눈검증 1차). 범위가 읽히지 않으면 "어디에 서 있는가" 를
    // 고를 수 없고 그것이 그 Cycle 의 Goal 이었다.
    //
    // C-TERRAIN-002 — **찬 만큼 진해진다.** 차오르는 것이 보이지 않으면 넘침은
    // 원인 없는 사건으로 보이고, 그러면 이 Cycle 은 세계에 시간을 준 것이 아니라
    // 우연을 하나 더한 것이 된다 (INTENT-WHAT-A-PLACE-HOLDS-IS-OBSERVED-001).
    // 뿜는 자리는 반대로 **비워질수록 옅어진다** — 닫혀 가는 것이 그대로 보인다.
    fill: { color, opacity: venting ? 0.22 + 0.24 * fill : 0.2 + 0.22 * fill },
    edge: { color, opacity: venting ? 0.9 : 0.75, width: venting ? 3 : 1.5 },
    // 뿜는 동안만 맥동한다 — 남은 것이 많을수록 세게. 엔진이 이미 지닌 자리이며
    // (SceneGroundZone.intensity) 이 Cycle 이 처음 쓴다. 거두는 자리는 맥동하지 않는다:
    // 맥동할 이유는 "지금 무언가 일어나는 중" 이고, 거둠은 늘 일어나는 일이다.
    ...(venting ? { intensity: fill } : {}),
    // 퍼센트를 라벨에 실어 **차오름이 눈으로 세어진다.** 세계는 비율만 보내고
    // (fill 0..1) 그것을 몇 퍼센트로 부를지는 화면의 결정이다.
    label: venting ? `${law.ventingName} · 남은 ${percent}%` : `${law.name} · 찬 ${percent}%`,
  };
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

export function groundZonePlans(snapshot: GameViewSnapshot): GroundZonePlan[] {
  return snapshot.ground.zones.map(groundZonePlan);
}

// ── 지금 나에게 무엇이 일어나는가 ──────────────────────────────────────
//
// self 패널의 줄로 낸다. 값이 줄어드는 것만 보이면 그것은 버그와 구분되지 않는다 —
// 어느 법칙이 지금 걸려 있는가가 **함께** 온다 (INTENT-GROUND-LAW-IS-OBSERVED-001).
//
// `sheltered` 를 `none` 과 구분해 **한 줄로 낸다.** 아무 일도 일어나지 않는 것과
// 법칙이 멎어서 아무 일도 일어나지 않는 것은 다르며, 뒤엣것이 읽히지 않으면
// 예외 자리는 그냥 아무것도 없는 땅이 된다.

export function groundDetailLines(snapshot: GameViewSnapshot): string[] {
  return [...groundHeldLines(snapshot), ...groundLawLines(snapshot)];
}

/**
 * 지닌 열 — **자리 밖에서도 늘 보인다.**
 *
 * 생명·기력과 같은 몸의 값이므로 늘 눈앞에 있어야 하고, 특히 이 값은 **되채워지지
 * 않는다** (05-review.md 승인 ②). 빙원에서 40 만 남기고 나온 사람이 자리 밖에서
 * 그것을 볼 수 없다면, 다시 들어갈지를 고를 재료가 없다 — 이 Cycle 이 묻는 판단이
 * 바로 그것이다.
 *
 * self 패널의 줄로 낸다. `self.*` 는 가로 띠로 가지 않는다 — 자기 자원은 self 패널이
 * 가져간다는 것이 이 화면의 규율이다 (C007 · combat-presentation.ts#isSelfHudId).
 */
export function groundHeldLines(snapshot: GameViewSnapshot): string[] {
  const warmth = hudNumber(snapshot, 'self.warmth');
  const warmthMax = hudNumber(snapshot, 'self.warmthMax');
  if (warmth === undefined || warmthMax === undefined) return [];
  return [`온기 ${warmth}/${warmthMax}`];
}

/** 지금 걸린 법칙 — 자리 안일 때만 실린다 */
export function groundLawLines(snapshot: GameViewSnapshot): string[] {
  const self = snapshot.ground.self;

  // 어떤 법칙도 걸려 있지 않다 — 낼 줄이 없다. 자리 밖은 이 Cycle 이전의 세계 그대로다.
  if (self.state === 'none') return [];

  const law = groundLawPresentation(self.law ?? '');

  // C-TERRAIN-002 — 돌려받는 중과 멎기만 하는 것을 가른다. 한 줄로 묶으면 플레이어는
  // 자기 열이 왜 늘었는지 알 수 없고, `sheltered` 로 바뀌는 순간(몸이 가득 찼다)이
  // 곧 "이제 이 분출구를 더 소모하지 않는다" 가 읽히는 자리다.
  if (self.state === 'warming') {
    const takes = self.takes === undefined ? '무언가' : groundTakesText(self.takes);
    return [`${law.ventingName} — ${withObjectParticle(takes)} 돌려받는 중`];
  }

  if (self.state === 'sheltered') return [`${law.ventingName} — 여기서는 멎는다`];

  if (self.state === 'taking') {
    const takes = self.takes === undefined ? '무언가' : groundTakesText(self.takes);
    return [`${law.name} — ${withObjectParticle(takes)} 거두어 가는 중`];
  }

  // 미등록 상태 코드도 그려진다 — 표현 누락이 게임을 멈추지 않는다.
  return [`${law.name} — ${self.state}`];
}

/** 무엇을 거두어 가는가 — 의미 코드의 문구 */
export function groundTakesText(takes: string): string {
  return TAKES_TEXT[takes] ?? takes;
}

const TAKES_TEXT: Record<string, string> = {
  warmth: '열',
};

/**
 * 목적격 조사를 붙인다 — 받침이 있으면 `을`, 없으면 `를`.
 * 거두어 가는 것의 이름은 표에서 오므로 조사를 문장에 박아 둘 수 없다.
 * 한글이 아닌 이름(미등록 코드가 그대로 나오는 경우)에는 `를` 을 쓴다.
 */
function withObjectParticle(word: string): string {
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  if (!isHangul) return `${word}를`;
  return `${word}${(last - 0xac00) % 28 === 0 ? '를' : '을'}`;
}

function hudNumber(snapshot: GameViewSnapshot, id: string): number | undefined {
  const item = snapshot.hud.find((h) => h.id === id);
  return typeof item?.value === 'number' ? Math.round(item.value) : undefined;
}
