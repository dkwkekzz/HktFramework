// V-008 — 많은 것 중에서 찾는다 (UX 문서 §6 정렬·필터·검색).
//
// 이 파일이 지는 짐은 둘이다.
//
//   ① **거르기는 보는 목록만 줄인다** — 지닌 것도, 쓴 자리의 수도 건드리지 않는다
//   ② **모르는 분류가 사라지지 않는다** — 문서가 정한 다섯 밖의 값은 `기타` 로 선다.
//      사라지면 겪는 사람은 그 물건을 잃어버린 것으로 읽는다

import { beforeEach, describe, expect, it } from 'vitest';
import type { InventoryItemView } from '../../protocol/gameview';
import {
  INVENTORY_FILTERS,
  INVENTORY_ORDERS,
  activeFilter,
  activeOrder,
  applyViewCell,
  cycleFilter,
  cycleOrder,
  displayName,
  filterCells,
  orderCells,
  resetView,
  setFilter,
  setOrder,
  visibleItems,
} from '../inventory-view';

const item = (kind: string, category: string, count: number): InventoryItemView =>
  ({ kind, category, count, stackable: true, actions: [] }) as InventoryItemView;

// 이 세계가 실제로 보내는 분류들 + 문서의 다섯 밖에 있는 것 하나
const BAG = [
  item('stone', 'material', 9),
  item('pickaxe', 'tool', 1),
  item('buckler', 'gear', 1),
  item('moonshard', 'relic', 1),
];

beforeEach(() => resetView());

describe('분류 거르기 — 문서가 정한 다섯', () => {
  it('다섯이 언제나 서 있다 — 걸린 것이 없어도 되돌릴 자리가 화면에 남는다', () => {
    expect(INVENTORY_FILTERS.map((f) => f.label)).toEqual(['전체', '장비', '소비', '재료', '기타']);
    setFilter('gear');
    expect(filterCells()).toHaveLength(5);
  });

  it('기본은 전체다 — 열자마자 무엇이 감춰져 있으면 그것을 아는 길이 없다', () => {
    expect(activeFilter().id).toBe('all');
    expect(visibleItems(BAG)).toHaveLength(4);
  });

  it('건 분류만 남는다', () => {
    setFilter('material');
    expect(visibleItems(BAG).map((e) => e.kind)).toEqual(['stone']);
    setFilter('gear');
    expect(visibleItems(BAG).map((e) => e.kind)).toEqual(['buckler']);
  });

  it('문서의 셋 밖에 있는 분류는 기타로 선다 — 목록에서 사라지지 않는다', () => {
    // 이 세계의 `tool`(곡괭이)과 아무도 모르는 `relic` 이 같은 자리에 있다.
    // 새 분류가 생겨도 화면은 그것을 잃어버리지 않는다 (문서 §6)
    setFilter('other');
    expect(visibleItems(BAG).map((e) => e.kind)).toEqual(['pickaxe', 'moonshard']);
  });

  it('어느 분류를 걸어도 지닌 것 전부는 그대로다 — 거르기는 덜어내기가 아니다', () => {
    for (const filter of INVENTORY_FILTERS) {
      setFilter(filter.id);
      expect(BAG).toHaveLength(4);
    }
  });

  it('한 키가 다섯을 돈다 — 끝에서 처음으로 감긴다', () => {
    const seen = INVENTORY_FILTERS.map(() => {
      const at = activeFilter().id;
      cycleFilter();
      return at;
    });
    expect(seen).toEqual(['all', 'gear', 'consumable', 'material', 'other']);
    expect(activeFilter().id).toBe('all');
  });

  it('모르는 분류는 걸리지 않는다 — 화면에 없는 조건이 걸리면 목록이 영영 빈다', () => {
    expect(setFilter('nowhere')).toBe(false);
    expect(activeFilter().id).toBe('all');
  });
});

describe('보기 정렬 — 세계의 차례를 바꾸지 않는다', () => {
  it('기본은 세계가 보낸 차례다 — 화면이 처음부터 다른 차례로 보이면 그것을 볼 길이 없다', () => {
    expect(activeOrder().id).toBe('world');
    expect(visibleItems(BAG).map((e) => e.kind)).toEqual([
      'stone',
      'pickaxe',
      'buckler',
      'moonshard',
    ]);
  });

  it('이름 차례는 **사람이 읽는 이름**으로 매긴다 — 코드로 매기면 화면과 다른 차례가 된다', () => {
    expect(displayName('stone')).toBe('돌');
    expect(displayName('pickaxe')).toBe('곡괭이');
    setOrder('name');
    // 곡괭이 · 돌 · 손방패 — 코드였다면 buckler · moonshard · pickaxe · stone 이다
    expect(visibleItems(BAG).map((e) => displayName(e.kind))).toEqual([
      '곡괭이',
      '돌',
      '손방패',
      'moonshard', // 문구 표에 없는 것은 코드 그대로 서고, 그 코드로 견준다
    ]);
  });

  it('수량 차례는 많은 것부터다', () => {
    setOrder('count');
    expect(visibleItems(BAG).map((e) => e.count)).toEqual([9, 1, 1, 1]);
  });

  it('세계가 보낸 배열을 제자리에서 뒤집지 않는다 — 관찰은 읽는 것이다', () => {
    const before = BAG.map((e) => e.kind);
    setOrder('name');
    visibleItems(BAG);
    expect(BAG.map((e) => e.kind)).toEqual(before);
  });

  it('한 키가 셋을 돈다', () => {
    cycleOrder();
    expect(activeOrder().id).toBe('name');
    cycleOrder();
    expect(activeOrder().id).toBe('count');
    cycleOrder();
    expect(activeOrder().id).toBe('world');
  });

  it('세 칸이 서고 걸린 것 하나가 표시된다', () => {
    setOrder('count');
    const cells = orderCells();
    expect(cells.map((c) => c.text)).toEqual(INVENTORY_ORDERS.map((o) => o.label));
    expect(cells.filter((c) => c.selected).map((c) => c.id)).toEqual(['order.count']);
  });
});

describe('도구 띠의 칸 — 누르면 걸린다', () => {
  it('분류 칸과 차례 칸을 알아본다', () => {
    expect(applyViewCell('filter.gear')).toBe(true);
    expect(activeFilter().id).toBe('gear');
    expect(applyViewCell('order.name')).toBe(true);
    expect(activeOrder().id).toBe('name');
  });

  it('물건 칸은 이 띠의 것이 아니다 — 고르는 손짓이 여기서 가로채이지 않는다', () => {
    expect(applyViewCell('item.stone')).toBe(false);
    expect(applyViewCell('room.0')).toBe(false);
  });

  it('걸린 것을 전부 푼다 — 빈 목록의 안내가 가리키는 자리다', () => {
    setFilter('gear');
    setOrder('count');
    resetView();
    expect(activeFilter().id).toBe('all');
    expect(activeOrder().id).toBe('world');
  });
});
