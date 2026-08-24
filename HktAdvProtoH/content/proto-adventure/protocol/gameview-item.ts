// GameView 확장 — 아이템(ITEM 트랙) 도메인분. 소지품·자리·적용.
//
// 트랙이 자기 파일을 소유한다 (guides/works.md 병렬 규칙) — 전투 도메인은
// gameview-combat.ts, 봉투 재수출과 스냅샷 조립은 gameview.ts 가 맡는다.
// 소비처는 언제나 protocol/gameview 하나만 import 한다.

// ── 소지품 (C020 ADDED) ──────────────────────────────────────────────
//
// **종류 전용 칸이 사라진 자리다.** 지금까지 소지품은 hud 에 `inventory.stone` 과
// `tool.hasMiningTool` 두 칸으로 실려 있었고, 둘 다 종류 이름이 계약에 박힌 자리였다 —
// 아이템이 하나 늘 때마다 이 계약도 함께 늘어야 하는 형태다.
//
// 이제 목록 하나다. 종류가 둘이든 열이든 형태가 같고, View 는 종류 이름을 하나도
// 알지 못한 채 소지품을 그릴 수 있다 (DC-ITEM-KIND-IS-DATA-NOT-BRANCH).
//
// 내 몸의 것만 실린다 (INTENT-PER-OBSERVER-PROJECTION-001).
// 지니지 않은 종류는 항목이 없다 — View 는 "있는 것만 그린다" 로 끝난다.

export interface ItemActionView {
  /** ActionRequest.interactionId 로 회신된다 */
  id: string;
  role: string; // 의미 역할 (use-item | discard-item | equip-item | unequip-item | exchange-item)
  available: boolean;
  /** 불가 사유 코드 — 문구 변환은 View 책임. 세계가 사유의 단일 출처다 */
  unavailableReason?: string;
}

export interface InventoryItemView {
  kind: string; // 종류 식별자 (의미 코드) — 표시 이름은 View 책임
  count: number; // 언제나 1 이상이다
  category: string; // material | tool | consumable (의미 코드)
  origin?: string; // 상위 정의 식별자 (IT-*) — 없을 수 있다
  /**
   * 겹치는가 (C022 CHANGED — 값의 출처가 ItemDefinition.StackLimit > 1 로 옮겼다).
   * 계약의 형태는 그대로다. 한 자리에 몇까지인지는 **싣지 않는다** — 그 수를 실으면
   * 화면이 자리를 셀 수 있게 되고, 그것이 이 계약이 막으려는 것이다.
   */
  stackable: boolean;
  /** 이 항목으로 지금 할 수 있는 것들. 아무것도 못 하는 물건은 빈 목록이다 */
  actions: ItemActionView[];
}

// ── 적용 자리 (C023 ADDED) ───────────────────────────────────────────
//
// **소지품 목록과 나란한 두 번째 목록이다.** 하나로 합치지 않는다 — 둘이 답하는 질문이
// 다르기 때문이다. 소지품은 "무엇을 지녔는가" 이고 적용 자리는 "몸이 지금 무엇으로
// 되어 있는가" 다. 합치면 지닌 것과 걸린 것의 구분이 사라지고, 그 구분이 정확히 이
// Cycle 이 세우는 것이다.
//
// **비어 있는 자리도 전부 실린다.** 비었다는 것이 관찰의 내용이며, 자리가 몇인지는
// 걸 수 있는 물건이 하나도 없을 때도 보여야 한다.
//
// **자리는 성격을 지니지 않는다.** 여섯이 서로 같으므로 이 계약에도 "이 자리는 무엇을
// 받는가" 라는 칸이 없다 — 세계에 그런 것이 없기 때문이다. 어떤 물건이 전용 자리를
// 요구하게 되는 날 그 제한은 **물건 쪽**에 실린다 (IE §10 · §11).
//
// 내 몸의 것만 실린다 (INTENT-PER-OBSERVER-PROJECTION-001). 남이 무엇을 걸었는지는
// 오지 않는다 — 세계에 그 관찰이 없고, 남의 걸린 것이 낳은 결과는 combatStats 에
// 이미 실려 있다.

/** 걸린 것이 지금 몸의 값에 보태고 있는 것 하나 (C023 ADDED) */
export interface EquipContributionView {
  name: string; // 능력 이름 (의미 코드) — physicalAttack 등
  value: number;
}

export interface EquipmentSlotView {
  slotId: string; // 자리의 의미 코드 — 표시 이름은 View 책임. 풀 때 그대로 되돌린다
  /** 담긴 것. **비었으면 없다** — 빈 값이 아니라 항목이 없다 */
  item?: { kind: string; category: string; origin?: string };
  /** 이 자리의 것이 지금 몸에 주고 있는 용도들. 비었거나 주는 것이 없으면 빈 목록 */
  grants: string[];
  /**
   * 이 자리의 것이 지금 몸의 값에 보태고 있는 것들.
   *
   * **걸린 것에만 실린다.** 가방의 물건이 무엇을 줄지 보여 주는 것은 미리보기이며
   * 이 Cycle 의 일이 아니다. 여기 실리는 것은 예측이 아니라 **지금 일어나 있는 일**이다.
   *
   * View 는 이 값을 combatStats 와 더하지 않는다 — combatStats 가 이미 더해진 값이다.
   * 이 목록은 "그 값이 왜 그 값인가" 의 경위다.
   */
  contributions: EquipContributionView[];
  /** 이 자리에 지금 할 수 있는 것들 — 비어 있어도 빈 목록이 아니라 판정과 사유가 온다 */
  actions: ItemActionView[];
}

/**
 * 자리 — 쓴 자리와 전체 (C022 ADDED).
 *
 * **소지품 목록 밖에 있다.** 자리는 물건의 성질이 아니라 몸의 형편이므로 항목에 붙일 수
 * 없다. 항목마다 실으면 같은 값이 항목 수만큼 반복되고, 지닌 것이 없을 때는 실릴 자리가
 * 사라진다 — 가방이 비었을 때야말로 자리를 보여야 하는 순간인데도.
 *
 * **View 는 이 둘을 계산하지 않는다.** used 를 항목에서 유도하려면 화면이 겹침 한도를
 * 알아야 하고, 그것을 아는 순간 세계와 화면에 자리 계산이 둘 생긴다
 * (DC-WORLD-OWNS-THE-SURFACE-LIST).
 */
export interface InventoryRoomView {
  used: number; // 지금 쓰고 있는 자리. 지닌 것이 없으면 0
  capacity: number; // 이 몸이 지닌 자리의 수
}
