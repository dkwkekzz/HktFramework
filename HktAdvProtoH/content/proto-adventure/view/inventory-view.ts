// 많은 것 중에서 찾는 자리 (V-008) — UX 문서 §6 정렬·필터·검색.
//
// **여기 있는 것은 전부 겪는 사람 쪽 상태다.** 무엇을 거르고 어떤 차례로 볼지는 세계로
// 나가지 않으며, 세계는 이런 것이 골라졌다는 사실조차 알지 못한다. 그래서 아무리
// 만져도 세계는 흔들리지 않는다 (`selectedKind` · `focusedActionId` 와 같은 자리다).
//
// ── 이름이 `보기 정렬` 인 이유 ───────────────────────────────────────
//
// 문서가 그 이름을 못 박았다 (§6): "`정렬` Action 이 World 상태를 바꾸는 기능이라면
// 반드시 요청을 보낸다. 단순 표시 정렬은 `보기 정렬` 로 이름을 달리하고 View 상태로
// 둔다." 세계에는 소지품의 차례를 바꾸는 개념이 없다 — 그러므로 여기 있는 것은
// **보는 차례**일 뿐이고, 이름이 그 사실을 말한다.
//
// ── 거르는 것과 자리의 수는 다른 축이다 ──────────────────────────────
//
// 거르기는 **보는 목록**을 줄일 뿐 지닌 것을 줄이지 않는다. 그래서 자리 구획
// (`used / capacity`)은 이 파일의 어떤 값에도 반응하지 않는다 — 문서 §6 의 마지막 줄이
// 그것을 못 박았고, 거르는 중에 자리 수가 함께 줄면 화면이 "덜어냈다" 고 거짓을 말한다.

import type { SceneSurfaceCell } from '../../../engine/view-kernel/scene/scene-state';
import type { InventoryItemView } from '../protocol/gameview';
import { codeText } from './code-text';

/** 종류 코드 → 표시 이름. **표에 없으면 코드 그대로** — 세계가 새 물건을 정의해도 멈추지 않는다 */
export function itemName(kind: string, text: (code: string) => string): string {
  const code = `item.${kind}`;
  const named = text(code);
  return named === code ? kind : named;
}

/**
 * 차례를 매길 때 쓰는 이름 — **문구 표에서 곧바로 읽는다.**
 *
 * 이름 차례는 사람이 읽는 이름으로 매겨야 하고, 그 이름의 단일 출처는 문구 표 하나다.
 * 여기서 주입을 받으면 같은 목록이 **부르는 쪽마다 다른 차례**로 설 수 있다 —
 * 칸을 그리는 자리와 방향키가 걷는 자리가 어긋나면 눈에 보이는 다음 칸과 실제로
 * 가는 칸이 달라진다.
 */
export function displayName(kind: string): string {
  return itemName(kind, codeText);
}

// ── 분류 거르기 (문서 §6) ────────────────────────────────────────────
//
// 다섯이다: 전체 · 장비 · 소비 · 재료 · 기타. **문서가 정한 다섯이며 늘리지 않는다.**
//
// 세계가 보내는 분류 값이 이 셋(gear · consumable · material) 밖이면 **기타**로 선다 —
// 문서가 그렇게 정했다: "카테고리 값이 추가되면 `기타` 로 안전하게 나타나며 목록에서
// 사라지지 않는다." 지금 이 세계의 `tool`(곡괭이)이 바로 그 자리에 있다. 도구 칸을
// 세우는 것은 문서를 고치는 일이므로 화면이 혼자 하지 않는다.

const NAMED_CATEGORIES = ['gear', 'consumable', 'material'] as const;

export interface InventoryFilter {
  id: string;
  label: string;
  /** 이 분류에 드는가 — 전체는 언제나 참이고, 기타는 이름 붙은 셋의 밖이다 */
  admits(category: string): boolean;
}

export const INVENTORY_FILTERS: readonly InventoryFilter[] = [
  { id: 'all', label: '전체', admits: () => true },
  { id: 'gear', label: '장비', admits: (c) => c === 'gear' },
  { id: 'consumable', label: '소비', admits: (c) => c === 'consumable' },
  { id: 'material', label: '재료', admits: (c) => c === 'material' },
  {
    id: 'other',
    label: '기타',
    admits: (c) => !(NAMED_CATEGORIES as readonly string[]).includes(c),
  },
];

// ── 보기 차례 (문서 §6) ──────────────────────────────────────────────
//
// 기본은 **세계가 보낸 차례**다. 화면이 처음부터 다른 차례로 보이면, 세계가 지닌 순서를
// 겪는 사람이 한 번도 보지 못한다.

export interface InventoryOrder {
  id: string;
  label: string;
  /** 견주는 법. 세계 차례는 견주지 않는다 (받은 그대로다) */
  compare?: (a: InventoryItemView, b: InventoryItemView) => number;
}

export const INVENTORY_ORDERS: readonly InventoryOrder[] = [
  { id: 'world', label: '세계 차례' },
  {
    id: 'name',
    label: '이름',
    compare: (a, b) => displayName(a.kind).localeCompare(displayName(b.kind), 'ko'),
  },
  // 많은 것부터 — 많이 지닌 것을 찾는 일이 적게 지닌 것을 찾는 일보다 잦다
  { id: 'count', label: '수량', compare: (a, b) => b.count - a.count },
];

// ── 지금 무엇이 걸려 있는가 ──────────────────────────────────────────

let filterId = INVENTORY_FILTERS[0]!.id;
let orderId = INVENTORY_ORDERS[0]!.id;

export function activeFilter(): InventoryFilter {
  return INVENTORY_FILTERS.find((f) => f.id === filterId) ?? INVENTORY_FILTERS[0]!;
}

export function activeOrder(): InventoryOrder {
  return INVENTORY_ORDERS.find((o) => o.id === orderId) ?? INVENTORY_ORDERS[0]!;
}

/** 모르는 id 는 받지 않는다 — 화면에 없는 분류가 걸리면 목록이 영영 빈다 */
export function setFilter(id: string): boolean {
  if (!INVENTORY_FILTERS.some((f) => f.id === id)) return false;
  filterId = id;
  return true;
}

export function setOrder(id: string): boolean {
  if (!INVENTORY_ORDERS.some((o) => o.id === id)) return false;
  orderId = id;
  return true;
}

/** 다음 분류로 — 자판 하나로 다섯을 돈다 */
export function cycleFilter(): void {
  const at = INVENTORY_FILTERS.findIndex((f) => f.id === filterId);
  filterId = INVENTORY_FILTERS[(at + 1) % INVENTORY_FILTERS.length]!.id;
}

export function cycleOrder(): void {
  const at = INVENTORY_ORDERS.findIndex((o) => o.id === orderId);
  orderId = INVENTORY_ORDERS[(at + 1) % INVENTORY_ORDERS.length]!.id;
}

/** 걸린 것을 전부 푼다 — 빈 목록의 안내가 가리키는 그 자리다 */
export function resetView(): void {
  filterId = INVENTORY_FILTERS[0]!.id;
  orderId = INVENTORY_ORDERS[0]!.id;
}

/**
 * 지금 보이는 목록 — 거르고, 차례를 매긴다.
 *
 * **세계가 보낸 배열을 제자리에서 뒤집지 않는다** (`slice` 로 뜬다). 관찰은 읽는 것이고,
 * 읽는 쪽이 그것을 흔들면 같은 관찰을 읽는 다른 자리가 다른 것을 보게 된다.
 */
export function visibleItems(all: readonly InventoryItemView[]): InventoryItemView[] {
  const filter = activeFilter();
  const kept = all.filter((entry) => filter.admits(entry.category));
  const compare = activeOrder().compare;
  return compare === undefined ? kept : kept.slice().sort(compare);
}

// ── 도구 띠 (문서 §2.2 의 `[전체⌄] [정렬⌄]` 자리) ────────────────────

/** 분류 칸들 — 걸린 것이 `selected` 로 선다. **빈 목록에서도 사라지지 않는다** */
export function filterCells(): SceneSurfaceCell[] {
  return INVENTORY_FILTERS.map((f) => ({
    id: `filter.${f.id}`,
    text: f.label,
    empty: false,
    selected: f.id === filterId,
  }));
}

/** 보기 차례 칸들 */
export function orderCells(): SceneSurfaceCell[] {
  return INVENTORY_ORDERS.map((o) => ({
    id: `order.${o.id}`,
    text: o.label,
    empty: false,
    selected: o.id === orderId,
  }));
}

/**
 * 눌린 칸이 도구 띠의 것이면 그대로 걸고 참을 낸다.
 *
 * **참을 내되 "고른 것" 은 바뀌지 않는다** — 부르는 쪽이 그 사실을 알아야 두 번 누름과
 * 목록 청함이 이 칸에서 아무 일도 하지 않는다.
 */
export function applyViewCell(cellId: string): boolean {
  if (cellId.startsWith('filter.')) return setFilter(cellId.slice('filter.'.length));
  if (cellId.startsWith('order.')) return setOrder(cellId.slice('order.'.length));
  return false;
}
