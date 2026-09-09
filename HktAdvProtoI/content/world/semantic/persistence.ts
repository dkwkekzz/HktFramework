// World Semantic — Persistence (C034 ADDED · spec State 의 수명 표 · Foundation §4.4 · G7)
//
// **State 경로마다 지우는 손 하나.** 이 세계가 무엇을 붙들고 무엇을 흘려보내는지가 여기
// 한 표에 선다 — 지금까지 그것은 규칙마다 흩어져 있어서, 새 State 를 더할 때 "이것은 무엇이
// 지우는가" 를 아무도 묻지 않아도 되었다.
//
// **형이 표를 붙든다** (spec 기본형 ⑤) — 표의 열쇠가 `keyof RegionState` 를 통째로 요구하므로
// State 에 필드를 더하고 여기 적지 않으면 **tsc 가 잡는다**. 검사 ㊼ 는 밖에서 State 의 필드
// 집합을 알 길이 없고(그것은 형이지 데이터가 아니다), Foundation §5.2 도 ㊼ 를 "판정 없는
// 요약" 으로 두었다 — 그래서 잡는 자리는 검사가 아니라 여기다.
//
// **글자는 코드다** (원칙 2) — 지우는 손 다섯의 이름은 의미 코드이고, 사람이 읽는 말
// (「스치는 것」 · 「뒤척임이 묻는 것」)을 짓는 것은 도구와 화면의 몫이다.
//
// 이 파일은 **아무것도 판정하지 않고 아무것도 바꾸지 않는다** — 계약 표 하나다.

import type { RegionState } from './region-state';

// ── 지우는 손 다섯 (Foundation §4.4) ──────────────────────────────────

/** 시간이 지운다 — 두면 사라지는 값 (자국 · 소란 · 되돌아옴의 진행) */
export const ERASER_TRANSIENT = 'transient';
/** 관찰자만 쥔다 — 세계 State 가 아니다 (판 · 기록 · 지목) */
export const ERASER_OBSERVER_HELD = 'observer-held';
/** 뒤척임이 묻는다 — 세계가 뒤척이면 처음으로 돌아간다 */
export const ERASER_BURIED_BY_TURN = 'buried-by-turn';
/** 세계에 남는다 — 시간도 뒤척임도 건드리지 않는다 */
export const ERASER_KEPT = 'kept';
/** 지워지지 않는다 — 그 Region 의 결정만이 그 값을 만든다 */
export const ERASER_INDELIBLE = 'indelible';

/** 지우는 손의 어휘 — 차례가 곧 "얼마나 오래 남는가" 다 */
export const ERASERS = [
  ERASER_TRANSIENT,
  ERASER_OBSERVER_HELD,
  ERASER_BURIED_BY_TURN,
  ERASER_KEPT,
  ERASER_INDELIBLE,
] as const;

export type Eraser = (typeof ERASERS)[number];

/** 표의 한 줄 — 그 State 경로를 무엇이 지우는가 */
export interface PersistenceRow {
  /** State 경로 — 사람이 코드에서 그 자리를 찾을 수 있는 글자 */
  path: string;
  eraser: Eraser;
}

/**
 * RegionState 밖의 자리들 — 방의 State 가 아니지만 수명을 물어야 하는 것들.
 *
 * 몸이 지는 값 하나 · 관찰자만 쥐는 것 · 그리고 **저장되지 않는 유도된 값**(위상 덧씌움)이다.
 * 유도된 것을 표에 적는 이유는 하나다: "무엇이 그것을 걷어 가는가" 를 묻는 사람에게
 * "저장되지 않아 물을 것이 없다" 가 아니라 **원인이 걷히면 걷힌다** 를 답해야 하기 때문이다.
 */
type OtherStatePath = 'actor.distanceSinceTrack' | 'observer.held' | 'region.phases';

/**
 * 수명 표 — **RegionState 의 필드 전부**와 그 밖의 경로들이 열쇠다.
 *
 * 필드 하나가 여러 줄을 가질 수 있다 (원천의 다섯 값은 지우는 손이 다 다르다). 차례는 이
 * 리터럴의 차례 그대로이고, 그래서 두 번 읽어도 같은 표가 나온다 (결정론).
 */
const PERSISTENCE: Record<keyof RegionState | OtherStatePath, readonly PersistenceRow[]> = {
  // 스치는 것 — 두면 사라진다
  tracks: [{ path: 'region.tracks[]', eraser: ERASER_TRANSIENT }],
  'actor.distanceSinceTrack': [
    { path: 'actor.distanceSinceTrack', eraser: ERASER_TRANSIENT },
  ],
  // 관찰자만 쥐는 것 — 세계 State 가 아니다
  'observer.held': [{ path: 'observer.panel|log|target', eraser: ERASER_OBSERVER_HELD }],
  // 소란은 값과 위상이 갈린다 — 값은 고요에 가라앉고 위상은 0 에 닿기 전까지 남는다
  disturbance: [
    { path: 'region.disturbance.value', eraser: ERASER_TRANSIENT },
    { path: 'region.disturbance.phase', eraser: ERASER_KEPT },
  ],
  // 원천의 다섯 값은 지우는 손이 저마다 다르다 — 한 필드가 한 줄이 아닌 이유다
  sources: [
    { path: 'region.sources[].phase', eraser: ERASER_KEPT },
    { path: 'region.sources[].taken', eraser: ERASER_BURIED_BY_TURN },
    { path: 'region.sources[].progress', eraser: ERASER_TRANSIENT },
    { path: 'region.sources[].siteIndex', eraser: ERASER_BURIED_BY_TURN },
    { path: 'region.sources[].collapsedSites', eraser: ERASER_INDELIBLE },
  ],
  // 원인(철 · 소란 · 지나가는 것 · 깨진 마디)이 걷히면 함께 걷힌다 — 저장되지 않는다
  'region.phases': [{ path: 'region.phases(overlay)', eraser: ERASER_BURIED_BY_TURN }],
  // 세계에 남는 것 — 아무것도 지우지 않는다
  rule: [
    { path: 'region.rule.pattern', eraser: ERASER_KEPT },
    { path: 'region.rule.pressure', eraser: ERASER_KEPT },
    { path: 'region.rule.rearrangedAt', eraser: ERASER_KEPT },
  ],
  lifeSites: [{ path: 'region.lifeSites[]', eraser: ERASER_KEPT }],
  populations: [{ path: 'region.populations[]', eraser: ERASER_KEPT }],
  // 지워지지 않는 것 — 그 Region 의 결정만이 이 값을 만든다 (G7 의 다섯째 칸)
  history: [{ path: 'region.history', eraser: ERASER_INDELIBLE }],
};

/**
 * 수명 표를 한 줄씩 편 것 — 검사 ㊼ 가 이것을 읽는다 (tools/world-editor/check.ts).
 *
 * 여기서 판정하는 것이 하나도 없다. 표를 읽는 쪽이 세고, 사람이 본다.
 */
export const PERSISTENCE_TABLE: readonly PersistenceRow[] = Object.values(PERSISTENCE).flat();
