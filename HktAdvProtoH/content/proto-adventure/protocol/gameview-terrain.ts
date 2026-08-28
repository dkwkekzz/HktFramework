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

/** 자리 하나의 범위와 지금 — 원이다. 세계에 다른 모양이 없다 */
export interface GroundZoneView {
  /**
   * 같은 자리를 프레임 사이에 이어 보기 위한 이름.
   *
   * C-TERRAIN-002 부터 이 항목이 값어치를 지닌다 — **같은 자리를 다른 시각에 보면
   * 다르기** 때문이다. 이어 보지 않으면 차오르는 것과 열리는 것이 하나의 자리에
   * 일어나는 일로 읽히지 않는다.
   */
  id: string;
  /**
   * 어느 법칙의 맥인가 — **의미 코드다.** 화면은 이 코드로 색과 문구를 고른다.
   * 코드가 하나 늘어도 이 계약은 열리지 않는다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH 와 같은 형태).
   */
  law: string;
  /**
   * 지금 어느 단계인가 (C-TERRAIN-002 CHANGED — `role` 을 대신한다).
   *
   * **놓인 성질이 아니라 지금의 상태다.** 같은 자리가 한 판 안에서 둘 사이를 오간다.
   * 지난 계약에서 `role = respite` 가 고르던 그 색을 이제 `phase = venting` 이
   * 고른다 — 화면의 결정은 그대로 서 있고 그것을 고르는 근거만 바뀐다.
   *
   *   binding  거두는 중이다 — 그 안의 몸에서 법칙이 거두어 간다
   *   venting  뿜는 중이다 — 그 자리에서 법칙이 멎고, 지닌 것을 내보낸다
   */
  phase: string;
  /**
   * 지금 얼마나 찼는가 — **0 에서 1 사이의 비율이다** (C-TERRAIN-002 ADDED).
   *
   * 날값(kept)과 넘침 지점(saturation)을 따로 싣지 않는다. 따로 실으면 화면이 둘을
   * 견주어 "곧 넘친다" 를 스스로 판정할 수 있게 되고, 그 순간 판정이 세계와 화면
   * 두 곳에 산다 (DC-WORLD-OWNS-THE-SURFACE-LIST). 세계가 이미 나눈 값을 준다.
   *
   * `phase = venting` 인 동안에도 실린다 — 뿜는 자리가 얼마나 남았는지가 그 자리가
   * 언제 닫히는지이기 때문이다. 이것은 예고가 아니다: 지금 지닌 것이지 앞으로 일어날
   * 일이 아니다.
   */
  fill: number;
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
   * warming    뿜는 자리 안이고 **받는 중**이다 — 지닌 열이 늘고 있다  (C-TERRAIN-002 ADDED)
   * sheltered  뿜는 자리 안이지만 받지 않는다 — 몸이 이미 가득하다     (C-TERRAIN-002 CHANGED)
   * none       어떤 법칙도 걸려 있지 않다
   *
   * **`sheltered` 가 `none` 과 구분되는 것이 이 항목의 첫 요점이었다.** 아무 일도
   * 일어나지 않는 것과 법칙이 멎어서 아무 일도 일어나지 않는 것은 다르며,
   * 뒤엣것이 읽히지 않으면 예외 자리는 그냥 아무것도 없는 땅이 된다.
   *
   * **`warming` 이 `sheltered` 와 갈라지는 것이 둘째 요점이다.** 멎기만 하는 자리와
   * 되돌려주는 자리가 한 코드로 묶이면 플레이어는 자기 열이 왜 늘었는지 알 수 없다.
   * 그리고 `sheltered` 로 바뀌는 순간이 곧 "가득한 몸은 분출구를 소모하지 않는다" 가
   * 읽히는 자리다.
   */
  state: string;
  /**
   * 그 법칙이 거두어 가는 것이 무엇인가 — 의미 코드.
   * **돌려받는 것도 같은 값이다** (거두어 간 것이 돌아오는 것이므로).
   * 없으면(state = none) 없음
   */
  takes?: string;
}

/** 땅 관찰 전체 — 무대의 자리들과 지금 나에게 걸린 것 */
export interface GroundView {
  zones: GroundZoneView[];
  self: GroundSelfView;
  /**
   * 이 세계가 어느 씨앗에서 태어났는가 (C-TERRAIN-003 ADDED).
   *
   * **designer/디버그 관찰이다** — 플레이어에게 씨앗은 세계 밖의 사실이고, 플레이어
   * 표면은 이 값을 그리지 않는다 (04-gameview.spec.yaml — 표시하는 화면은 디버그
   * 패널뿐이다). "같은 씨앗 → 같은 세계" 를 플레이로 검증하는 유일한 표면이다.
   * 04 는 이 값의 자리를 debug 로 적었으나 debug 봉투는 engine 소유(편집 금지)라
   * 땅 도메인이 싣는다 — 뜻은 같다 (06-world-implementation.md NOTES).
   */
  genesisSeed: number;
}
