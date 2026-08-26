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

import type { SceneSurfaceCell, SceneSurfaceField } from '../../../engine/view-kernel/scene/scene-state';
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

// ── 이름으로 찾기 (문서 §6) ──────────────────────────────────────────
//
// **표시 이름만 본다.** 문서가 그렇게 정했다: "검색은 표시 이름과 계약이 제공하는
// 검색용 태그만 대상으로 한다." 계약에는 검색 태그가 없으므로 지금 볼 수 있는 것은
// 이름뿐이고, 설명 전문을 뒤지는 것은 문서 자신이 후속으로 미뤄 두었다.
//
// 찾는 말은 화면이 쥔다 — 세계는 누가 무엇을 찾는 중인지 알지 못한다.

/** 이 자리의 이름 — 조립이 쳐 넣은 글자를 돌려줄 때 이 id 로 온다 */
export const SEARCH_FIELD_ID = 'search';

let searchText = '';

/**
 * 캐럿을 그 자리로 청해 둔 상태 — **한 프레임만 산다.**
 *
 * 표면을 지을 때 실어 보내고 곧바로 내린다. 계속 참으로 두면 사람이 다른 곳을 눌러
 * 빠져나가도 다음 프레임이 도로 끌어온다 (기반이 그 사정을 형에 적어 두었다).
 */
let focusClaimed = false;

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

/** 지금 찾고 있는 말 — 쳐 넣은 그대로다 (다듬는 것은 견줄 때다) */
export function search(): string {
  return searchText;
}

export function setSearch(text: string): void {
  searchText = text;
}

/** 견줄 때의 꼴 — 앞뒤 공백을 떼고 대소문자를 지운다 */
function needle(): string {
  return searchText.trim().toLowerCase();
}

/** 이 이름이 찾는 말을 품는가. 찾는 말이 없으면 전부 참이다 */
function matches(kind: string): boolean {
  const want = needle();
  if (want.length === 0) return true;
  // 표시 이름으로 찾는다 — 코드로 찾으면 화면에 보이지 않는 글자로 걸러지게 된다
  return displayName(kind).toLowerCase().includes(want);
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
  searchText = '';
  focusClaimed = false;
}

/**
 * 지금 보이는 목록 — 거르고, 차례를 매긴다.
 *
 * **세계가 보낸 배열을 제자리에서 뒤집지 않는다** (`slice` 로 뜬다). 관찰은 읽는 것이고,
 * 읽는 쪽이 그것을 흔들면 같은 관찰을 읽는 다른 자리가 다른 것을 보게 된다.
 */
export function visibleItems(all: readonly InventoryItemView[]): InventoryItemView[] {
  const filter = activeFilter();
  const kept = all.filter((entry) => filter.admits(entry.category) && matches(entry.kind));
  const compare = activeOrder().compare;
  return compare === undefined ? kept : kept.slice().sort(compare);
}

// ── 도구 띠 (문서 §2.2 의 `[전체⌄] [정렬⌄]` 자리) ────────────────────

/**
 * 이름을 쳐 넣는 자리 — 기반이 그리고, 글자는 여기가 쥔다 (문구 반전 ⑤의 짝).
 *
 * 실려 보내는 것이 곧 화면에 뜨는 것이다. 그리는 쪽이 자기 안에 글자를 쥐면 화면에
 * 있는 글자와 거르는 데 쓰인 글자가 갈라진다.
 */
export function searchField(): SceneSurfaceField {
  const claim = focusClaimed;
  focusClaimed = false; // 실어 보냈으면 내린다 — 청함은 한 번이다
  return {
    id: SEARCH_FIELD_ID,
    text: searchText,
    placeholder: '이름으로 찾기',
    label: '이름으로 찾기',
    ...(claim ? { claimFocus: true } : {}),
  };
}

/** 그 자리로 가겠다 — 자판만 쓰는 사람이 글자 자리에 닿는 길 */
export function claimSearchFocus(): void {
  focusClaimed = true;
}

/** 검증용 — 지금 캐럿을 청해 두었는가 */
export function searchFocusClaimed(): boolean {
  return focusClaimed;
}

/** 지금 무엇으로 좁혔는가 — 제목이 그 사유를 말한다. 좁힌 것이 없으면 빈 배열이다 */
export function narrowedBy(): string[] {
  const parts: string[] = [];
  if (filterId !== INVENTORY_FILTERS[0]!.id) parts.push(activeFilter().label);
  const want = searchText.trim();
  if (want.length > 0) parts.push(`"${want}"`);
  return parts;
}

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
