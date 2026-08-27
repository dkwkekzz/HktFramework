// GameView 확장 — 성장(GROWTH 트랙) 도메인분. 자란 것과 방금 쌓인 일들.
//
// 트랙이 자기 파일을 소유한다 (guides/works.md 병렬 규칙) — 봉투 재수출과 스냅샷
// 조립은 gameview.ts 가 맡는다. 소비처는 언제나 protocol/gameview 하나만 import 한다.
// 계약의 원본은 cycles/C-GROWTH-001-what-you-did-makes-you/04-gameview.spec.yaml 이다.
//
// ── 이 계약을 받은 View 가 하지 않는 일 ──────────────────────────────
//
// 화면은 **단계를 한 번도 계산하지 않는다.** 쌓인 값을 문턱으로 나누지 않고, 다음
// 문턱까지 얼마인지 빼지 않으며, 어느 단계가 어느 값을 얼마나 올리는지 묻지 않는다 —
// 받은 값을 옮긴다 (DC-WORLD-OWNS-THE-SURFACE-LIST).

/** 단계가 지금 어느 값에 얼마를 보태고 있는가 — 한 줄 */
export interface GrowthContributionView {
  /**
   * 능력의 이름 — **의미 코드다.** 표시 이름은 View 책임이며 화면이 이 코드로
   * 분기하지 않는다.
   */
  stat: string;
  /**
   * 지금 단계가 그 값에 보태는 몫.
   * **단계 0 에서는 넷이 전부 0 이고, 그래도 실린다** — 0 이 실려야
   * "아직 아무것도 보태고 있지 않다" 가 관찰이 된다.
   */
  amount: number;
}

/**
 * 자란 것 — **내 몸의 것만 실린다** (INTENT-PER-OBSERVER-PROJECTION-001).
 *
 * 남이 얼마나 자랐는지는 오지 않는다. 남이 자란 **결과**는 이미 attributes.combatStats
 * 가 싣고 있고, 그것이 어디까지 보이는가는 C016 의 가려짐 관문이 정한다 —
 * 이 계약이 그 관문을 넓히지 않는다.
 *
 * **아직 아무것도 쌓지 않았어도 온다.** 0 이라는 사실과 자리가 없다는 사실은 다르며,
 * 그 구분이 없으면 "무엇을 하면 는다" 를 사람이 알 수 없다 (C023 이 빈 적용 자리를
 * 싣는 것과 같은 판단).
 */
export interface GrowthView {
  /** 지금까지 쌓인 양 */
  deeds: number;
  /** 지금 몇 단계인가 — **세계가 세어서 싣는다** */
  level: number;
  /** 표가 몇 칸인가. 화면이 상수를 지니지 않으므로 문턱을 늘려도 화면이 열리지 않는다 */
  maxLevel: number;
  /** 아직 넘지 않은 첫 문턱 — **최대 단계면 없다** (없음이 곧 "더 오를 곳이 없다") */
  nextThreshold?: number;
  /** 다음 문턱까지 남은 양 — **세계가 빼서 싣는다.** 최대 단계면 없다 */
  deedsToNext?: number;
  /**
   * 단계가 지금 어느 값에 얼마를 보태고 있는가.
   * **여기 없는 값은 자라지 않는다** — 관통 둘 · 치명 둘 · 통찰 · 생명력 · 기력 ·
   * 이동은 오지 않으며, 그것이 결손이 아니라 그 값들의 성질이다.
   */
  contributions: GrowthContributionView[];
}

/**
 * 방금 무엇을 해서 얼마가 쌓였는가 — **내 것만 실린다.**
 *
 * strikes · contacts · cancels 와 **나란한 네 번째 목록**이며 같은 수명을 가진다.
 * 넷이 답하는 질문이 다르다 — 닿아서 해가 성립했다 / 닿았으나 막혔다 /
 * 하려던 것이 사라졌다 / 한 일이 몸에 남았다.
 */
export interface GrowthEventView {
  /**
   * 무엇을 해서 — **의미 코드다** (strike · down · mine · observe).
   * 문구 변환은 View 책임이며 **모르는 코드를 만나도 화면이 성립해야 한다** —
   * 받은 코드를 그대로 보여도 된다 (C020 이 세운 규칙 그대로).
   * 원천이 늘어도 이 계약의 형태는 바뀌지 않는다.
   */
  source: string;
  /** 이번에 쌓인 양. 같은 원천은 언제나 같은 양이다 */
  amount: number;
  /** 쌓은 뒤의 총량 */
  deedsAfter: number;
  levelBefore: number;
  /**
   * **levelBefore 와 다르면 그것이 "올랐다" 는 사실이다.** 화면이 이전 값을 기억해
   * 두었다가 견주지 않는다 — 세계가 둘을 함께 싣는다. 문턱 둘을 한 번에 넘으면
   * 둘 차이가 난다.
   *
   * **오르지 않은 쌓임도 실린다** (levelBefore === levelAfter). 터지지 않은 치명이
   * 실리는 이유와 같다 (C015).
   */
  levelAfter: number;
  /** 언제 일어났는가 (세계 시각) */
  since: number;
}
