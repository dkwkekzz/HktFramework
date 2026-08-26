// GameView 확장 — 땅(TERRAIN 트랙) 도메인분. 자리의 범위와 지금 걸린 법칙.
//
// 트랙이 자기 파일을 소유한다 (guides/works.md 병렬 규칙) — 봉투 재수출과 스냅샷
// 조립은 gameview.ts 가 맡는다. 소비처는 언제나 protocol/gameview 하나만 import 한다.
// 계약의 원본은 cycles/C-TERRAIN-001-the-ground-has-a-law/04-gameview.spec.yaml 이다.
//
// ── 이 계약이 이 세계에서 처음인 것 ──────────────────────────────────
//
// 지금까지 관찰에 실린 것은 전부 **몸**이었다 (존재 · 소지품 · 자리 · 타격 결과).
// ground.zones 는 몸이 아닌 것이 실리는 첫 항목이다 — 무대 자체다.
// 그래서 관찰자에 딸리지 않는다: 누가 보든 같은 자리가 거기 있다.

/** 자리 하나의 범위 — 원이다. 세계에 다른 모양이 없다 */
export interface GroundZoneView {
  /** 같은 자리를 프레임 사이에 이어 보기 위한 이름 */
  id: string;
  /**
   * 어느 법칙의 자리인가 — **의미 코드다.** 화면은 이 코드로 색과 문구를 고른다.
   * 코드가 하나 늘어도 이 계약은 열리지 않는다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH 와 같은 형태).
   */
  law: string;
  /** law = 그 법칙이 작용한다 · respite = 그 법칙이 멎는다 */
  role: string;
  center: { x: number; z: number };
  radius: number;
}

/**
 * 지금 이 몸에 무엇이 일어나는 중인가 — **세계가 판정한 결과다.**
 *
 * View 는 zones 와 내 위치로 이것을 다시 계산하지 않는다. 계산하는 순간 판정이
 * 세계와 화면 두 곳에 생기고 둘이 어긋나는 자리가 열린다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export interface GroundSelfView {
  /** 지금 걸린 법칙. 어느 자리에도 들지 않았으면 없음 */
  law?: string;
  /**
   * taking     지금 거두어 가는 중이다
   * sheltered  법칙의 자리 안이지만 멎어 있다
   * none       어떤 법칙도 걸려 있지 않다
   *
   * **`sheltered` 가 `none` 과 구분되는 것이 이 항목의 요점이다.** 아무 일도
   * 일어나지 않는 것과 법칙이 멎어서 아무 일도 일어나지 않는 것은 다르며,
   * 뒤엣것이 읽히지 않으면 예외 자리는 그냥 아무것도 없는 땅이 된다.
   */
  state: string;
  /** 그 법칙이 거두어 가는 것이 무엇인가 — 의미 코드. 없으면(state = none) 없음 */
  takes?: string;
}

/** 땅 관찰 전체 — 무대의 자리들과 지금 나에게 걸린 것 */
export interface GroundView {
  zones: GroundZoneView[];
  self: GroundSelfView;
}
