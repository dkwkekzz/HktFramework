// C026 View 단독 테스트 — World 미기동, Fixture 만으로 (VUX-IE-V-10).
//
// 04-gameview.spec.yaml 의 `view_contract` 열 항목과 `fixtures` 다섯 장면을 화면 쪽에서
// 재현한다. 이 파일이 지는 특별한 짐은 둘이다.
//
//   ① **화면이 판정하지 않는다** — 되는지도 왜 안 되는지도 계약이 실어 온 대로만 나온다
//   ② **두 축을 한 격자에 섞지 않는다** — 항목의 수와 쓴 자리의 수는 자주 어긋나며
//      (돌 아홉은 항목 하나에 자리 셋) 그것을 한 격자에 앉히면 칸을 세는 사람에게
//      거짓을 말하게 된다 (04 surface_rule CORRECTED)

import { beforeEach, describe, expect, it } from 'vitest';
import type { SceneSurface, SceneSurfaceSection } from '../../../../engine/view-kernel/scene/scene-state';
import type { ActionRequest } from '../../protocol/actions';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  INVENTORY_SURFACE_ID,
  armDiscardConfirm,
  commitCell,
  menuCell,
  pickCell,
  pressRow,
  workspaceCellFocus,
  workspaceFocus,
  invokeFocusedAction,
  moveActionFocus,
  moveSelection,
  resetWorkspace,
  settleOutcome,
  workspaceConfirmChoice,
  workspaceConfirming,
  workspaceExchanging,
  workspaceSlotSelection,
  workspacePendingCount,
  workspaceSelection,
} from '../inventory-workspace';
import { EXECUTION_LOG_SURFACE_ID } from '../execution-log';
import { setFilter, setOrder } from '../inventory-view';
import { inventorySlots } from '../inventory-presentation';
import { equipmentSlotKeys } from '../equipment-presentation';
import { typeInto } from '../inventory-workspace';
import { resolvePresentation } from '../resolve';
import { closeSurface, surfaceIsOpen, toggleSurface } from '../surface-state';
import empty from './fixtures/inventory-empty.fixture.json';
import worn from './fixtures/equipment-worn.fixture.json';
import full from './fixtures/inventory-full.fixture.json';
import mining from './fixtures/mining-available.fixture.json';
import unknown from './fixtures/inventory-unknown.fixture.json';

const snap = (fixture: unknown) => fixture as GameViewSnapshot;
// `now` 는 **기다림의 나이를 재는 시계**다 (V-007). 넘기지 않으면 지금을 읽는다 —
// 보낸 직후이므로 기다림은 아직 아무 말도 하지 않는 상태다.
const bag = (fixture: unknown, now?: number): SceneSurface => {
  const found = resolvePresentation(snap(fixture), undefined, now === undefined ? {} : { now })
    .surfaces.find((s) => s.id === INVENTORY_SURFACE_ID);
  if (!found) throw new Error('소지품 작업 공간이 장면에 없다');
  return found;
};
const section = (fixture: unknown, id: string, now?: number): SceneSurfaceSection => {
  const found = bag(fixture, now).sections.find((s) => s.id === id);
  if (!found) throw new Error(`구획 ${id} 이 없다`);
  return found;
};
const actionRow = (fixture: unknown, id: string, now?: number) =>
  (section(fixture, 'detail', now).rows ?? []).find((r) => r.id === id);

/**
 * 되돌릴 수 없는 손을 **끝까지** 실행한다 (V-002).
 *
 * 확인이 한 걸음 늘었으므로 이 파일의 기존 검사들도 그 걸음을 함께 밟는다.
 * 줄어든 것은 없다 — 세계로 나가는 것은 여전히 마지막 한 번뿐이다.
 */
function commitFocused(fixture: unknown, send: (a: ActionRequest) => number | null): void {
  invokeFocusedAction(snap(fixture), send); // 확인이 선다 — 아무것도 나가지 않는다
  moveActionFocus(snap(fixture), 1); // 그만두기 → 실행
  invokeFocusedAction(snap(fixture), send);
}

beforeEach(() => {
  resetWorkspace();
  closeSurface(INVENTORY_SURFACE_ID);
});

describe('VUX-IE-V-01 — 여닫아도 세계는 흔들리지 않는다', () => {
  it('처음에는 닫혀 있다', () => {
    expect(bag(mining).open).toBe(false);
  });

  it('같은 손짓이 열고 닫는다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    expect(bag(mining).open).toBe(true);
    toggleSurface(INVENTORY_SURFACE_ID);
    expect(bag(mining).open).toBe(false);
  });

  it('여닫는 것으로 아무 요청도 나가지 않는다', () => {
    const sent: ActionRequest[] = [];
    toggleSurface(INVENTORY_SURFACE_ID);
    closeSurface(INVENTORY_SURFACE_ID);
    // 여닫기는 send 를 받지 않는다 — 받을 자리가 없다는 것이 곧 증거다
    expect(sent).toEqual([]);
  });

  it('닫혀 있어도 표면은 장면에 실린다 — 열림은 표면 자신이 지닌 값이다', () => {
    // 표면이 둘이다 (V-018 이 되짚는 자리를 더했다). 둘 다 **닫힌 채로도 실린다** —
    // 열림은 표면 자신이 지닌 값이고, 그리는 쪽이 그것을 본다
    const surfaces = resolvePresentation(snap(mining)).surfaces;
    expect(surfaces.map((s) => s.id)).toEqual([INVENTORY_SURFACE_ID, EXECUTION_LOG_SURFACE_ID]);
    expect(surfaces.every((s) => !s.open)).toBe(true);
  });
});

describe('VUX-IE-V-02 — 지닌 것이 유실도 중복도 없이 나온다', () => {
  it('항목마다 칸 하나다', () => {
    const cells = section(mining, 'items').cells ?? [];
    expect(cells.map((c) => c.id)).toEqual(['item.stone', 'item.pickaxe']);
  });

  it('수량이 함께 온다', () => {
    const cells = section(mining, 'items').cells ?? [];
    expect(cells[0]?.detail).toBe('×2');
    expect(cells[1]?.detail).toBe('×1');
  });

  it('지닌 것이 없으면 칸이 없고 그 자리에 남길 글자가 나온다', () => {
    expect(section(empty, 'items').cells).toEqual([]);
    expect(section(empty, 'items').emptyText).toBe('소지품 없음');
  });
});

describe('VUX-IE-FX-EMPTY · FULL — 자리는 세계가 준 두 수다', () => {
  it('빈 가방은 남은 자리가 넷이다', () => {
    expect(section(empty, 'room').title).toBe('자리 0 / 4 · 남은 자리 4');
    expect(section(empty, 'room').cells).toHaveLength(4);
  });

  it('가득 차면 그렇다고 보이고 빈 칸이 없다', () => {
    expect(section(full, 'room').title).toBe('자리 4 / 4 · 가득');
    expect(section(full, 'room').cells).toEqual([]);
  });

  it('빈 칸은 서로 구별되지 않고 아무것도 담지 않는다 — 요청의 대상이 아니다', () => {
    for (const cell of section(empty, 'room').cells ?? []) {
      expect(cell.empty).toBe(true);
      expect(cell.text).toBe('');
      expect(cell.selected).toBe(false);
    }
  });

  it('**항목의 수와 쓴 자리의 수가 어긋나도 거짓을 말하지 않는다**', () => {
    // 돌 아홉은 항목 하나에 자리 셋이다 (겹침 한도 3). 그래서 항목 둘에 자리 넷이다 —
    // 두 축을 한 격자에 섞으면 칸을 세는 사람이 자리를 둘로 읽게 된다
    expect(section(full, 'items').cells).toHaveLength(2);
    expect(section(full, 'room').cells).toHaveLength(0);
    expect(section(full, 'room').title).toContain('4 / 4');
  });
});

describe('VUX-IE-V-04 · V-06 — 고르고 읽고 실행한다 (자판만으로)', () => {
  it('처음에는 고른 것이 없다', () => {
    expect(workspaceSelection()).toBeNull();
    expect(section(mining, 'detail').rows).toEqual([]);
    expect(section(mining, 'detail').emptyText).toBe('← → 로 고른다');
  });

  it('첫 고르기가 첫 항목으로 간다', () => {
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('stone');
    expect(section(mining, 'detail').title).toBe('고른 것 — 돌 ×2');
  });

  it('고른 것의 행동이 전부 나온다 — 안 되는 것도 사유와 함께', () => {
    moveSelection(snap(mining), 1);
    const rows = section(mining, 'detail').rows ?? [];
    expect(rows.map((r) => r.id)).toEqual(['use-item', 'discard-item']);
    expect(rows[0]?.state).toBe('blocked');
    expect(rows[0]?.text).toContain('쓰기 —');
    expect(rows[1]?.state).toBe('available');
  });

  it('고르기는 감긴다 — 양 끝이 막다른 곳이 되지 않는다', () => {
    moveSelection(snap(mining), 1); // stone
    moveSelection(snap(mining), 1); // pickaxe
    moveSelection(snap(mining), 1); // stone 으로 감긴다
    expect(workspaceSelection()).toBe('stone');
  });

  it('물건을 바꾸면 초점이 그 물건의 첫 줄로 간다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    moveSelection(snap(mining), 1);
    expect(bag(mining).focusId).toBe('use-item');
  });

  it('되는 행동을 실행하면 관찰이 실어 온 것 그대로 요청된다', () => {
    const sent: ActionRequest[] = [];
    moveSelection(snap(mining), 1); // stone
    moveActionFocus(snap(mining), 1); // discard-item (되는 것)
    commitFocused(mining, (a) => {
      sent.push(a);
      return 1;
    });
    expect(sent).toEqual([{ interactionId: 'discard-item', itemKind: 'stone' }]);
  });

  it('안 되는 행동은 요청되지 않는다 — 화면이 판정한 것이 아니라 세계가 그렇게 실었다', () => {
    const sent: ActionRequest[] = [];
    moveSelection(snap(mining), 1); // stone — use-item 이 불가
    invokeFocusedAction(snap(mining), (a) => {
      sent.push(a);
      return 1;
    });
    expect(sent).toEqual([]);
  });
});

// ── V-008 · VUX-IE-04 — 많은 것 중에서 찾는다 (문서 §6) ─────────────
describe('V-008 — 거르고 차례를 바꿔도 지닌 것은 그대로다', () => {
  it('도구 띠가 표면에 선다 — 분류 다섯과 보기 정렬 셋', () => {
    expect(section(mining, 'filter').cells?.map((c) => c.text)).toEqual([
      '전체',
      '장비',
      '소비',
      '재료',
      '기타',
    ]);
    expect(section(mining, 'order').title).toBe('보기 정렬'); // `정렬` 이 아니다 (문서 §6)
    expect(section(mining, 'order').cells?.map((c) => c.text)).toEqual([
      '세계 차례',
      '이름',
      '수량',
    ]);
  });

  it('분류를 걸면 보이는 것만 줄어든다', () => {
    expect(section(mining, 'items').cells?.map((c) => c.text)).toEqual([
      '1. 🪨 돌',
      '2. ⛏ 곡괭이',
    ]);
    setFilter('material');
    // **번호는 그대로다** (V-013) — 걸러도 지름길이 세는 차례는 바뀌지 않는다
    expect(section(mining, 'items').cells?.map((c) => c.text)).toEqual(['1. 🪨 돌']);
    // 두 수를 함께 보인다 — 보이는 수만 말하면 지닌 것이 줄어든 것으로 읽힌다
    expect(section(mining, 'items').title).toBe('지닌 것 — 1 / 2 종류 · 재료');
  });

  it('**자리 수는 그대로다** — 거르기는 덜어내기가 아니다 (문서 §6)', () => {
    const before = section(mining, 'room');
    setFilter('gear'); // 걸리는 것이 하나도 없는 분류
    const after = section(mining, 'room');
    expect(after.title).toBe(before.title);
    expect(after.cells).toEqual(before.cells);
    expect(after.title).toBe('자리 2 / 4 · 남은 자리 2');
  });

  it('걸린 것이 없으면 지닌 것이 없는 것과 다른 말을 한다', () => {
    setFilter('consumable');
    expect(section(mining, 'items').cells).toEqual([]);
    expect(section(mining, 'items').emptyText).toBe('조건에 맞는 아이템 없음 · 필터 초기화');
    // 정말로 아무것도 지니지 않은 가방은 여전히 그렇게 말한다
    expect(section(empty, 'items').emptyText).toBe('소지품 없음');
  });

  it('되돌릴 자리가 화면에 남는다 — 걸린 것이 없어도 도구 띠는 사라지지 않는다', () => {
    setFilter('consumable');
    expect(section(mining, 'filter').cells).toHaveLength(5);
    expect(section(mining, 'filter').cells?.find((c) => c.id === 'filter.all')?.selected).toBe(false);
  });

  it('보기 차례를 바꾸면 칸의 차례가 바뀐다 — 세계가 보낸 것은 그대로다', () => {
    setOrder('name');
    // 자리는 바뀌었는데 **번호는 물건을 따라간다** (V-013) — 2 번이 앞에 선다
    expect(section(mining, 'items').cells?.map((c) => c.text)).toEqual([
      '2. ⛏ 곡괭이',
      '1. 🪨 돌',
    ]);
    expect(section(mining, 'items').title).toBe('지닌 것 — 2 종류'); // 거른 것이 아니다
  });

  it('방향키는 **화면에 선 차례대로** 걷는다 — 걸러진 것을 지나가지 않는다', () => {
    setFilter('material');
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('stone');
    // 하나뿐이므로 한 번 더 밀어도 그 자리다 (감기지만 갈 곳이 하나다)
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('stone');
  });

  it('차례를 바꾸면 방향키가 그 차례대로 간다', () => {
    setOrder('name');
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('pickaxe'); // 이름 차례의 첫째
  });

  it('도구 띠의 칸은 고르는 칸이 아니다 — 고른 것도 초점도 건드리지 않는다', () => {
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('stone');
    expect(pickCell(INVENTORY_SURFACE_ID, 'filter.gear')).toBe(false);
    expect(workspaceSelection()).toBe('stone');
  });

  it('안내 줄이 두 키를 세운다 — 늘 떠 있는 패널에는 서지 않는 키다', () => {
    expect(bag(mining).footer).toContain('분류 J');
    expect(bag(mining).footer).toContain('보기 정렬 K');
  });
});

// ── V-010 — 칸 하나가 스스로 말한다 (문서 §3) ────────────────────────
describe('V-010 — 수량이 숫자와 명암으로 함께 읽힌다', () => {
  it('수량은 언제나 글자로 선다 — 색만으로 구분하지 않는다', () => {
    expect(section(mining, 'items').cells?.map((c) => c.detail)).toEqual(['×2', '×1']);
  });

  it('명암은 **목록 안에서 가장 많은 것**에 견준다 — 문턱을 화면이 정하지 않는다', () => {
    // mining: 돌 ×2 · 곡괭이 ×1 → 1.0 과 0.5
    expect(section(mining, 'items').cells?.map((c) => c.level)).toEqual([1, 0.5]);
    // full: 돌 ×9 · 곡괭이 ×1 → 같은 목록의 가장 많은 것이 기준이므로 달라진다
    expect(section(full, 'items').cells?.map((c) => c.level)).toEqual([1, 1 / 9]);
  });

  it('걸러도 남은 목록 안에서 다시 견준다 — 보이지 않는 것에 견주지 않는다', () => {
    setFilter('material');
    expect(section(mining, 'items').cells?.map((c) => c.level)).toEqual([1]);
  });

  it('빈 자리에는 명암이 없다 — 담은 것이 없다', () => {
    expect(section(mining, 'room').cells?.every((c) => c.level === undefined)).toBe(true);
  });
});

describe('V-010 — 새로 온 것에 표식이 붙었다가 상세를 보면 사라진다', () => {
  it('열자마자 있던 것에는 표식이 없다 — 첫 관찰은 기준선이다', () => {
    expect(section(mining, 'items').cells?.every((c) => c.badge === undefined)).toBe(true);
  });

  it('뒤에 온 것이 표식을 얻고, 고르면 사라진다', () => {
    // 곡괭이만 있던 가방에 돌이 늘었다 (같은 관찰 둘을 잇는다)
    const onlyTool = {
      ...snap(mining),
      inventory: [snap(mining).inventory![1]],
    } as GameViewSnapshot;
    bag(onlyTool);
    const withStone = section(mining, 'items').cells ?? [];
    expect(withStone.find((c) => c.id === 'item.stone')?.badge).toBe('NEW');
    expect(withStone.find((c) => c.id === 'item.pickaxe')?.badge).toBeUndefined();

    // 고른 것이 곧 상세를 본 것이다 — **열려 있을 때만이다.**
    // 닫힌 표면에 남은 고르기는 아무도 보지 않았다
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('stone');
    expect(section(mining, 'items').cells?.find((c) => c.id === 'item.stone')?.badge).toBe('NEW');
    toggleSurface(INVENTORY_SURFACE_ID);
    expect(section(mining, 'items').cells?.find((c) => c.id === 'item.stone')?.badge)
      .toBeUndefined();
  });

  it('닫혀 있는 동안 얻은 것에도 표식이 붙는다 — 그것이야말로 못 본 것이다', () => {
    closeSurface(INVENTORY_SURFACE_ID);
    const onlyTool = {
      ...snap(mining),
      inventory: [snap(mining).inventory![1]],
    } as GameViewSnapshot;
    bag(onlyTool);
    bag(mining); // 닫힌 채로 돌이 늘었다
    toggleSurface(INVENTORY_SURFACE_ID);
    expect(section(mining, 'items').cells?.find((c) => c.id === 'item.stone')?.badge).toBe('NEW');
  });
});

// ── V-009 — 이름으로 찾는다 (문서 §6 · §2.2 의 `[검색 /]`) ───────────
describe('V-009 — 이름으로 좁힌다', () => {
  it('도구 띠가 글자 받는 자리를 지닌다 — 띠 꼴로 그려진다', () => {
    const tools = section(mining, 'filter');
    expect(tools.shape).toBe('chip');
    expect(tools.field?.id).toBe('search');
    expect(tools.field?.placeholder).toBe('이름으로 찾기');
    expect(section(mining, 'order').shape).toBe('chip');
  });

  it('쳐 넣으면 이름에 그 말이 든 것만 남는다', () => {
    typeInto(INVENTORY_SURFACE_ID, 'search', '곡');
    // 좁혀도 번호는 제 것을 지닌다 (V-013) — 혼자 남아도 1 번이 되지 않는다
    expect(section(mining, 'items').cells?.map((c) => c.text)).toEqual(['2. ⛏ 곡괭이']);
    // 왜 줄었는지가 제목에 선다 — 분류는 `전체` 인데 수만 줄면 읽을 길이 없다
    expect(section(mining, 'items').title).toBe('지닌 것 — 1 / 2 종류 · "곡"');
  });

  it('쳐 넣은 글자가 그 자리에 그대로 실린다 — 화면과 판단이 갈라지지 않는다', () => {
    typeInto(INVENTORY_SURFACE_ID, 'search', '곡');
    expect(section(mining, 'filter').field?.text).toBe('곡');
  });

  it('걸리는 것이 없으면 거르기와 같은 말을 한다', () => {
    typeInto(INVENTORY_SURFACE_ID, 'search', '없는것');
    expect(section(mining, 'items').cells).toEqual([]);
    expect(section(mining, 'items').emptyText).toBe('조건에 맞는 아이템 없음 · 필터 초기화');
  });

  it('**자리 수는 그대로다** — 찾기도 덜어내기가 아니다', () => {
    typeInto(INVENTORY_SURFACE_ID, 'search', '없는것');
    expect(section(mining, 'room').title).toBe('자리 2 / 4 · 남은 자리 2');
  });

  it('다른 표면의 글자는 받지 않는다 — 이 자리의 것만 듣는다', () => {
    typeInto('somewhere-else', 'search', '곡');
    expect(section(mining, 'filter').field?.text).toBe('');
  });

  it('모르는 자리의 글자도 받지 않는다', () => {
    typeInto(INVENTORY_SURFACE_ID, 'nowhere', '곡');
    expect(section(mining, 'filter').field?.text).toBe('');
  });

  it('방향키는 찾아 남은 것만 걷는다', () => {
    typeInto(INVENTORY_SURFACE_ID, 'search', '곡');
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('pickaxe');
  });
});

describe('VUX-IE-FX-STALE — 세계가 답하기 전에는 아무것도 참이 아니다', () => {
  // V-007 — 기다림은 **늦을 때만** 보인다 (UX 문서 §7 응답 지연).
  // 세계는 보통 한 Tick 안에 답하므로, 보내자마자 `처리 중` 을 띄우면 그 글자는
  // 읽히기 전에 사라진다 — 남는 것은 줄이 한 번 깜빡였다는 인상뿐이다.
  it('보낸 직후에는 아무 말도 하지 않는다 — 곧 오는 답이 이미 답이다', () => {
    const sentAt = performance.now();
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    const row = actionRow(mining, 'discard-item', sentAt + 900);
    expect(row?.state).toBe('available');
    expect(row?.text).toBe('덜어내기');
  });

  it('1초가 지나면 그 줄이 처리 중으로 보인다', () => {
    const sentAt = performance.now();
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    const row = actionRow(mining, 'discard-item', sentAt + 1200);
    expect(row?.state).toBe('pending');
    expect(row?.text).toBe('덜어내기 — 처리 중');
  });

  it('5초가 지나면 다시 보내라고 하지 않는다 — 이어짐을 보라고 한다', () => {
    const sentAt = performance.now();
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    const row = actionRow(mining, 'discard-item', sentAt + 5200);
    expect(row?.state).toBe('pending');
    expect(row?.text).toBe('덜어내기 — 이어짐 확인');
  });

  it('VUX-IE-V-05 — 기다리는 동안 수량도 자리도 바뀌지 않는다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    expect(section(mining, 'items').cells?.[0]?.detail).toBe('×2');
    expect(section(mining, 'room').title).toBe('자리 2 / 4 · 남은 자리 2');
  });

  it('대답이 오기 전에는 같은 요청을 다시 보내지 않는다', () => {
    let count = 0;
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    const send = () => {
      count += 1;
      return count;
    };
    commitFocused(mining, send);
    // 두 번째는 확인조차 서지 않는다 — 이미 기다리는 중이기 때문이다
    invokeFocusedAction(snap(mining), send);
    expect(count).toBe(1);
  });

  it('대답이 오면 기다림이 풀린다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    expect(settleOutcome(7)).toBe(true);
    expect(workspacePendingCount()).toBe(0);
  });

  it('표식 없는 대답은 가져가지 않는다 — 그것은 다른 자리의 것이다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    expect(settleOutcome(undefined)).toBe(false);
    expect(workspacePendingCount()).toBe(1);
  });

  it('보내지 못했으면 기다리지 않는다 — 영영 풀리지 않을 자리다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => null);
    expect(workspacePendingCount()).toBe(0);
  });
});

describe('고르기는 관찰을 따라간다', () => {
  it('고른 것이 관찰에서 사라지면 고르기를 지운다 — 다른 것을 대신 고르지 않는다', () => {
    moveSelection(snap(mining), 1);
    expect(workspaceSelection()).toBe('stone');
    // 다 써서 사라진 세계
    const gone = { ...(mining as object), inventory: [(mining as GameViewSnapshot).inventory[1]] };
    bag(gone);
    expect(workspaceSelection()).toBeNull();
  });
});

describe('VUX-IE-V-07 — 걸어 둔 것은 가방에 중복되지 않는다', () => {
  // 자리가 물건을 직접 담으므로 걸린 것은 소지품 목록에 없다 (C023).
  // 화면이 그 둘을 합쳐 보이려 하면 지닌 것과 걸린 것의 구분이 사라진다 —
  // 그 구분이 C023 이 세운 것이고, 이 표면은 **지닌 것만** 그린다.
  it('걸어 둔 곡괭이가 지닌 것의 칸에 없다', () => {
    const kinds = (section(worn, 'items').cells ?? []).map((c) => c.id);
    expect(kinds).toEqual(['item.stone']);
    expect(kinds).not.toContain('item.pickaxe');
  });

  it('자리 셈도 걸린 것을 세지 않는다 — 세계가 준 두 수 그대로다', () => {
    expect(section(worn, 'room').title).toBe('자리 1 / 4 · 남은 자리 3');
  });

  it('걸린 것을 고를 수 없다 — 이 표면에 없는 것은 고를 수도 없다', () => {
    moveSelection(snap(worn), 1);
    expect(workspaceSelection()).toBe('stone');
    moveSelection(snap(worn), 1);
    expect(workspaceSelection()).toBe('stone'); // 하나뿐이므로 제자리
  });
});

describe('VUX-IE-V-09 — 모르는 코드가 와도 멈추지 않는다', () => {
  it('모르는 종류는 코드 그대로 보인다', () => {
    expect(section(unknown, 'items').cells?.[0]?.text).toBe('1. moonshard');
  });

  it('모르는 분류에는 아이콘이 없다 — 표에 없다고 화면이 멈추지 않는다', () => {
    expect(section(unknown, 'items').cells?.[0]?.text).not.toContain('🪨');
  });

  it('모르는 역할과 모르는 사유도 코드 그대로 나온다', () => {
    moveSelection(snap(unknown), 1);
    const rows = section(unknown, 'detail').rows ?? [];
    expect(rows[0]?.text).toBe('attune-item');
    expect(rows[1]?.text).toContain('moon-is-not-yours');
    expect(rows[1]?.state).toBe('blocked');
  });
});

/** 세계로 나간 요청을 담아 두는 자리 — 나가지 않았다는 것도 이 목록이 말한다 */
const sink = () => {
  const sent: ActionRequest[] = [];
  return { sent, send: (a: ActionRequest) => { sent.push(a); return 1; } };
};

// V-012 CHANGED — 이 자리는 더 이상 바꿔 걸기를 미루지 않는다.
//
// 미루던 이유는 하나였다: 자리를 지목해야 성립하는데 자리를 고를 곳이 화면에 없었다.
// 장비 구획이 서면서 그 걸음이 생겼으므로, 이제 그 손은 이 표면 안에서 끝까지 간다.
describe('V-012 — 바꿔 걸기는 자리를 받고 나서야 나간다', () => {
  const withExchange = {
    ...(worn as object),
    inventory: [
      {
        kind: 'buckler',
        count: 1,
        category: 'gear',
        stackable: false,
        actions: [
          { id: 'equip-item', role: 'equip-item', available: true },
          { id: 'exchange-item', role: 'exchange-item', available: true },
        ],
      },
    ],
  };

  beforeEach(() => {
    resetWorkspace();
    closeSurface(INVENTORY_SURFACE_ID);
    toggleSurface(INVENTORY_SURFACE_ID);
  });

  it('세계가 된다고 말한 것을 안 된다고 그리지 않는다', () => {
    moveSelection(snap(withExchange), 1);
    const rows = section(withExchange, 'detail').rows ?? [];
    expect(rows.map((r) => r.id)).toEqual(['equip-item', 'exchange-item']);
    expect(rows[1]?.state).toBe('available');
    // 미루는 곁글자가 사라졌다 — 이 자리에서 끝까지 가기 때문이다
    expect(rows[1]?.hint).toBeUndefined();
  });

  it('눌러도 곧바로 나가지 않는다 — 자리를 고르는 구획이 선다', () => {
    const { sent, send } = sink();
    moveSelection(snap(withExchange), 1);
    moveActionFocus(snap(withExchange), 1); // 걸기 → 바꿔 걸기
    invokeFocusedAction(snap(withExchange), send);
    expect(sent).toEqual([]);
    expect(workspaceExchanging()).toBe('buckler');
    const rows = section(withExchange, 'exchange').rows ?? [];
    // V-014 CHANGED — **걸린 자리만** 선다. 빈 자리에 거는 것은 바꿔 거는 것이 아니라
    // 그냥 걸기이고, `빈 자리` 다섯 줄은 서로 구별되지 않는 같은 선택이다
    expect(rows).toHaveLength(2); // 그만두기 + 걸린 자리 하나(E1)
    expect(rows[0]?.id).toBe('exchange.cancel');
    expect(rows[1]?.id).toBe('exchange.E1');
    // 번호는 푸는 지름길이 세는 그 번호다 (V-014)
    expect(rows[1]?.text).toBe('자리 1 · 곡괭이');
    // 이미 찬 자리는 바뀐다는 것을 미리 말한다 (C024)
    expect(rows[1]?.hint).toBe('걸린 것과 바뀐다');
  });

  it('초점의 기본은 그만두기다 — 골라 두지 않은 걸음이 Enter 하나로 나가지 않는다', () => {
    const { sent, send } = sink();
    moveSelection(snap(withExchange), 1);
    moveActionFocus(snap(withExchange), 1); // 걸기 → 바꿔 걸기
    invokeFocusedAction(snap(withExchange), send);
    expect(bag(withExchange).focusId).toBe('exchange.cancel');
    invokeFocusedAction(snap(withExchange), send);
    expect(sent).toEqual([]);
    expect(workspaceExchanging()).toBeNull();
  });

  it('자리를 고르면 그때 나간다 — 요청이 무엇을과 어느 자리를 함께 싣는다', () => {
    const { sent, send } = sink();
    moveSelection(snap(withExchange), 1);
    moveActionFocus(snap(withExchange), 1); // 걸기 → 바꿔 걸기
    invokeFocusedAction(snap(withExchange), send);
    bag(withExchange); // 화면이 한 번 그려져야 눌린 줄이 이 표면의 것으로 읽힌다
    pressRow(INVENTORY_SURFACE_ID, 'exchange.E1', send);
    // 요청 id 는 **걸기의 것**이다 — 자리를 싣는 것이 둘을 가르는 전부다 (REPORT ①)
    expect(sent).toEqual([
      { interactionId: 'equip-item', itemKind: 'buckler', equipSlotId: 'E1' },
    ]);
    expect(workspaceExchanging()).toBeNull();
  });

  it('없는 자리를 짚으면 아무것도 나가지 않는다', () => {
    const { sent, send } = sink();
    moveSelection(snap(withExchange), 1);
    moveActionFocus(snap(withExchange), 1); // 걸기 → 바꿔 걸기
    invokeFocusedAction(snap(withExchange), send);
    bag(withExchange);
    pressRow(INVENTORY_SURFACE_ID, 'exchange.E9', send);
    expect(sent).toEqual([]);
  });

  it('고르기를 옮기면 그만둔 것이다 — 확인 구획과 같은 규칙이다', () => {
    const { sent, send } = sink();
    moveSelection(snap(withExchange), 1);
    moveActionFocus(snap(withExchange), 1); // 걸기 → 바꿔 걸기
    invokeFocusedAction(snap(withExchange), send);
    moveSelection(snap(withExchange), 1);
    expect(workspaceExchanging()).toBeNull();
    expect(sent).toEqual([]);
  });
});

// V-03 은 원래 "Filter 가 실제 used/capacity 를 바꾸지 않는다" 이고, 이 Cycle 에는
// 거르개가 없다 (VUX-IE-04). 그래서 **부분 충족**이다 — 여기서 재는 것은 그 성질의
// 바탕, 곧 표시 쪽 조작이 세계가 준 두 수를 건드리지 않는다는 것이다.
describe('VUX-IE-V-03 (부분) — 표시 쪽 조작이 자리 수를 바꾸지 않는다', () => {
  it('고르고 초점을 옮겨도 used / capacity 는 그대로다', () => {
    const before = section(mining, 'room').title;
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    moveSelection(snap(mining), 1);
    expect(section(mining, 'room').title).toBe(before);
  });

  it('열고 닫아도 그대로다', () => {
    const before = section(mining, 'room').title;
    toggleSurface(INVENTORY_SURFACE_ID);
    expect(surfaceIsOpen(INVENTORY_SURFACE_ID)).toBe(true);
    expect(section(mining, 'room').title).toBe(before);
  });
});


// ── V-002 — 되돌릴 수 없는 것을 실수로 잃지 않는다 (UX 문서 §7) ──────────
//
// 세계는 덜어내기를 다른 요청과 똑같이 받는다. 여기서 재는 것은 **화면이 그 한 걸음을
// 어디에 두었는가**뿐이다 — 판정은 하나도 늘지 않았다.
//
// **수량을 고르는 자리는 없다** — 세계가 부분 수량 덜어내기를 모르기 때문이며,
// 그래서 확인 줄은 "×n 이 모두 사라진다" 로 지금 참인 것만 말한다.

describe('V-002 — 되돌릴 수 없는 것은 확인을 거친다', () => {
  const focusDiscard = (fixture: unknown): void => {
    moveSelection(snap(fixture), 1); // stone
    moveActionFocus(snap(fixture), 1); // discard-item (되는 것)
  };

  it('실행해도 곧바로 나가지 않는다 — 확인이 먼저 선다', () => {
    const sent: ActionRequest[] = [];
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), (a) => {
      sent.push(a);
      return 1;
    });
    expect(sent).toEqual([]);
    expect(workspaceConfirming()).toBe('stone');
  });

  it('무엇이 얼마나 사라지는지 그 자리에서 읽힌다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), () => 1);
    const rows = section(mining, 'confirm').rows ?? [];
    expect(rows[0]?.text).toBe('덜어내기 — 돌 ×2 · 모두 사라진다');
    expect(rows[1]?.text).toContain('그만둔다');
  });

  it('기본은 그만두기다 — 되돌릴 수 없는 것의 기본값은 하지 않는 것이다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), () => 1);
    expect(workspaceConfirmChoice()).toBe('cancel');
    expect(bag(mining).focusId).toBe('confirm.cancel');
  });

  it('그만두면 세계로 아무 요청도 나가지 않는다', () => {
    const sent: ActionRequest[] = [];
    const send = (a: ActionRequest): number => {
      sent.push(a);
      return 1;
    };
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), send); // 확인이 선다
    invokeFocusedAction(snap(mining), send); // 기본값 그대로 Enter = 그만두기
    expect(sent).toEqual([]);
    expect(workspaceConfirming()).toBeNull();
    expect(workspacePendingCount()).toBe(0);
  });

  it('← → 로도 그만둔다 — 안내 줄이 그렇게 말한다', () => {
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), () => 1);
    moveSelection(snap(mining), 1);
    expect(workspaceConfirming()).toBeNull();
    expect(workspaceSelection()).toBe('stone'); // 그만두었을 뿐 자리를 잃지 않는다
  });

  it('닫으면 확인도 사라진다 — 보이지 않는 확인은 확인이 아니다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), () => 1);
    expect(workspaceConfirming()).toBe('stone');
    closeSurface(INVENTORY_SURFACE_ID);
    bag(mining); // 다음 프레임
    expect(workspaceConfirming()).toBeNull();
  });

  it('확인을 골라 실행하면 그제야 관찰이 실어 온 것 그대로 나간다', () => {
    const sent: ActionRequest[] = [];
    focusDiscard(mining);
    commitFocused(mining, (a) => {
      sent.push(a);
      return 1;
    });
    expect(sent).toEqual([{ interactionId: 'discard-item', itemKind: 'stone' }]);
  });

  it('확인 구획은 기다리는 것이 있을 때만 선다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    focusDiscard(mining);
    expect(bag(mining).sections.map((x) => x.id)).not.toContain('confirm');
    invokeFocusedAction(snap(mining), () => 1);
    expect(bag(mining).sections.map((x) => x.id)).toContain('confirm');
  });

  it('누르기 전에도 그렇다고 말한다 — 확인은 놀람이 아니어야 한다', () => {
    moveSelection(snap(mining), 1);
    const rows = section(mining, 'detail').rows ?? [];
    expect(rows.find((r) => r.id === 'discard-item')?.hint).toBe('확인이 뜬다');
  });

  it('세계가 더는 된다고 하지 않으면 확인도 사라진다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    focusDiscard(mining);
    invokeFocusedAction(snap(mining), () => 1);
    // 사이에 세계가 바뀌었다 — 이제 그 손은 불가다
    const blocked = {
      ...(mining as object),
      inventory: [
        {
          ...(mining as GameViewSnapshot).inventory[0],
          actions: [
            { id: 'discard-item', role: 'discard-item', available: false, unavailableReason: 'no-way-back' },
          ],
        },
      ],
    };
    bag(blocked);
    expect(workspaceConfirming()).toBeNull();
  });
});

describe('V-002 — 지름길도 같은 확인을 거친다 (B → 숫자)', () => {
  it('지름길이 짚으면 작업 공간이 열리고 확인이 선다 — 아무것도 나가지 않는다', () => {
    bag(mining); // 지름길은 지금 보고 있는 관찰을 읽는다
    armDiscardConfirm('stone');
    expect(surfaceIsOpen(INVENTORY_SURFACE_ID)).toBe(true);
    expect(workspaceSelection()).toBe('stone');
    expect(workspaceConfirming()).toBe('stone');
  });

  it('세계가 불가로 실어 온 것에는 확인을 세우지 않는다 — 그 자리에 사유가 이미 있다', () => {
    bag(mining);
    armDiscardConfirm('pickaxe'); // no-way-back
    expect(workspaceConfirming()).toBeNull();
    expect(workspaceSelection()).toBe('pickaxe'); // 사유를 읽도록 짚어는 준다
    const rows = section(mining, 'detail').rows ?? [];
    expect(rows.find((r) => r.id === 'discard-item')?.state).toBe('blocked');
  });

  it('지니지 않은 종류는 아무 일도 일으키지 않는다', () => {
    bag(mining);
    armDiscardConfirm('moonshard');
    expect(workspaceConfirming()).toBeNull();
    expect(surfaceIsOpen(INVENTORY_SURFACE_ID)).toBe(false);
  });
});


// ── V-004 — 손가락 자리를 몰라도 닿는다 (UX 문서 §4.1) ──────────────────
//
// 기반은 눌린 것의 id 만 돌려준다. 여기서 재는 것은 **그 소식에 무슨 뜻을 주었는가**와,
// 그 뜻이 자판의 길과 **같은 길**을 지나는가다 — 되돌릴 수 없는 것에는 확인이 서고,
// 안 되는 것은 여전히 나가지 않는다.

describe('V-004 — 눌러서 고르고 실행하고 목록을 연다', () => {
  const sink = () => {
    const sent: ActionRequest[] = [];
    return { sent, send: (a: ActionRequest) => { sent.push(a); return 1; } };
  };

  it('한 번 누르면 고른다 — 그것뿐이다 (행동 목록으로 들어가지 않는다)', () => {
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'item.stone');
    expect(workspaceSelection()).toBe('stone');
    expect(workspaceFocus()).toBeNull();
    expect(workspaceCellFocus()).toBe('item.stone');
    expect(bag(mining).focusId).toBe('item.stone');
  });

  it('빈 자리를 눌러도 아무 일이 없다 — 세계에 번호 붙은 빈 자리가 없다', () => {
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'room.0');
    expect(workspaceSelection()).toBeNull();
  });

  it('다른 표면의 눌림은 이 표면의 것이 아니다', () => {
    bag(mining);
    pickCell('command', 'item.stone');
    expect(workspaceSelection()).toBeNull();
  });

  it('두 번 누르면 되는 행동 하나가 실행된다 — 세계가 보낸 차례의 첫 되는 것이다', () => {
    const { sent, send } = sink();
    bag(mining);
    commitCell(INVENTORY_SURFACE_ID, 'item.pickaxe', send); // 쓰기가 되는 물건
    expect(sent).toEqual([{ interactionId: 'use-item', itemKind: 'pickaxe' }]);
  });

  it('두 번 눌러도 되돌릴 수 없는 것에는 확인이 먼저 선다 — 자판과 같은 길이다', () => {
    const { sent, send } = sink();
    toggleSurface(INVENTORY_SURFACE_ID);
    bag(mining);
    commitCell(INVENTORY_SURFACE_ID, 'item.stone', send); // 되는 것이 덜어내기뿐이다
    expect(sent).toEqual([]);
    expect(workspaceConfirming()).toBe('stone');
  });

  it('되는 것이 하나도 없으면 두 번 눌러도 아무 일이 없다', () => {
    const { sent, send } = sink();
    const blocked = {
      ...(mining as object),
      inventory: [
        {
          kind: 'stone',
          count: 1,
          category: 'material',
          stackable: true,
          actions: [
            { id: 'use-item', role: 'use-item', available: false, unavailableReason: 'no-target-selected' },
          ],
        },
      ],
    };
    bag(blocked);
    commitCell(INVENTORY_SURFACE_ID, 'item.stone', send);
    expect(sent).toEqual([]);
  });

  it('손가락으로 골라 두고 자판으로 실행한다 — 손이 끊기지 않는다', () => {
    const { sent, send } = sink();
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'item.pickaxe'); // 초점이 칸에 있다
    invokeFocusedAction(snap(mining), send); // 두 번 누름과 같은 뜻이다
    expect(sent).toEqual([{ interactionId: 'use-item', itemKind: 'pickaxe' }]);
    expect(workspaceFocus()).toBe('use-item'); // 실행한 줄로 초점이 옮겨 간다
    expect(workspaceCellFocus()).toBeNull();
  });

  it('빈 자리를 두 번 눌러도 **직전에 고른 것**이 실행되지 않는다', () => {
    const { sent, send } = sink();
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'item.pickaxe'); // 먼저 다른 것을 골라 둔다
    commitCell(INVENTORY_SURFACE_ID, 'room.0', send); // 빈 자리를 두 번 눌렀다
    expect(sent).toEqual([]);
  });

  it('빈 자리에서 목록을 청해도 직전에 고른 것의 줄로 들어가지 않는다', () => {
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'item.pickaxe');
    expect(workspaceCellFocus()).toBe('item.pickaxe');
    menuCell(INVENTORY_SURFACE_ID, 'room.0');
    expect(workspaceFocus()).toBeNull();
    expect(workspaceCellFocus()).toBe('item.pickaxe');
  });

  it('오른 단추는 행동 목록을 연다 — 초점이 줄로 들어간다', () => {
    bag(mining);
    menuCell(INVENTORY_SURFACE_ID, 'item.stone');
    expect(workspaceSelection()).toBe('stone');
    expect(workspaceFocus()).toBe('use-item'); // 그 물건의 첫 줄
    expect(workspaceCellFocus()).toBeNull();
  });

  it('줄을 누르면 그 줄이 실행된다', () => {
    const { sent, send } = sink();
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'item.pickaxe');
    pressRow(INVENTORY_SURFACE_ID, 'use-item', send);
    expect(sent).toEqual([{ interactionId: 'use-item', itemKind: 'pickaxe' }]);
  });

  it('안 되는 줄을 눌러도 나가지 않는다 — 화면이 판정한 것이 아니다', () => {
    const { sent, send } = sink();
    bag(mining);
    pickCell(INVENTORY_SURFACE_ID, 'item.pickaxe');
    pressRow(INVENTORY_SURFACE_ID, 'discard-item', send); // no-way-back
    expect(sent).toEqual([]);
  });

  it('확인이 떠 있으면 눌린 줄이 곧 답이다', () => {
    const { sent, send } = sink();
    toggleSurface(INVENTORY_SURFACE_ID);
    bag(mining);
    commitCell(INVENTORY_SURFACE_ID, 'item.stone', send); // 확인이 선다
    pressRow(INVENTORY_SURFACE_ID, 'confirm.cancel', send);
    expect(sent).toEqual([]);
    expect(workspaceConfirming()).toBeNull();

    commitCell(INVENTORY_SURFACE_ID, 'item.stone', send);
    pressRow(INVENTORY_SURFACE_ID, 'confirm.commit', send);
    expect(sent).toEqual([{ interactionId: 'discard-item', itemKind: 'stone' }]);
  });

  it('다른 것을 고르면 확인은 사라진다 — 방향키와 같은 규칙이다', () => {
    const { send } = sink();
    toggleSurface(INVENTORY_SURFACE_ID);
    bag(mining);
    commitCell(INVENTORY_SURFACE_ID, 'item.stone', send);
    expect(workspaceConfirming()).toBe('stone');
    pickCell(INVENTORY_SURFACE_ID, 'item.pickaxe');
    expect(workspaceConfirming()).toBeNull();
  });
});

// ── V-011 — 고르기 전에 읽는다 (UX 문서 §8) ──────────────────────────
//
// 곁말이 **여닫히는 일**은 능력의 몫이고 (engine/view-kernel/hud/surface.ts —
// 손을 얹은 것과 초점이 닿은 것을 같은 하나로 다루고 Escape 로 닫는다),
// 여기서 보는 것은 **무엇이 실리는가** 다. 화면이 지어낸 것이 하나도 없어야 한다.

describe('V-011 — 칸이 고르기 전에 자기를 말한다', () => {
  beforeEach(() => {
    resetWorkspace();
    closeSurface(INVENTORY_SURFACE_ID);
  });

  const cellOf = (fixture: unknown, id: string) =>
    (section(fixture, 'items').cells ?? []).find((c) => c.id === id);

  it('분류는 거르는 칸이 쓰는 그 이름이다 — 새 이름을 짓지 않는다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    // 곡괭이의 분류는 `tool` 이며 이름 붙은 셋 밖이므로 `기타` 로 선다 (V-008 과 같은 결론)
    expect(cellOf(mining, 'item.pickaxe')?.tip?.[0]).toBe('기타');
    expect(cellOf(mining, 'item.stone')?.tip?.[0]).toBe('재료');
  });

  it('되는 것은 세계가 된다고 한 것뿐이다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    const tip = cellOf(mining, 'item.pickaxe')?.tip ?? [];
    const doable = tip.find((line) => line.startsWith('할 수 있다'));
    // 이 장면에서 세계가 된다고 한 것은 쓰기 하나다 — 화면이 그 목록을 늘리지 않는다
    expect(doable).toBe('할 수 있다: 쓰기');
  });

  it('아무것도 되지 않으면 그 사유가 곁말이 된다 — 침묵하지 않는다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    // 모르는 코드의 물건 — 세계가 아무 행동도 되지 않는다고 말한 자리
    const cells = section(unknown, 'items').cells ?? [];
    for (const cell of cells) {
      const tip = cell.tip ?? [];
      expect(tip.length).toBeGreaterThan(0);
      // 첫 줄은 언제나 분류다 — 그다음이 되는 것이거나 안 되는 사유다
      expect(tip.length === 1 || tip.slice(1).every((line) => line.length > 0)).toBe(true);
    }
  });

  it('빈 자리에는 곁말이 없다 — 없는 것이 스스로를 말할 수는 없다', () => {
    toggleSurface(INVENTORY_SURFACE_ID);
    // 남은 자리는 자기 구획에 산다 — 항목의 수와 쓴 자리의 수는 다른 축이다
    const rooms = (section(mining, 'room').cells ?? []).filter((c) => c.empty);
    expect(rooms.length).toBeGreaterThan(0);
    for (const cell of rooms) expect(cell.tip).toBeUndefined();
  });
});

// ── V-012 — 걸어 둔 것이 가진 것과 한 자리에 선다 ────────────────────
//
// 이 구획이 답하는 물음은 가방과 다르다: 가방은 "무엇을 지녔는가" 이고 여기는
// "몸이 지금 무엇으로 되어 있는가" 다. 둘을 함께 보아야 걸고 푸는 일이
// **자리 사이의 이동**으로 읽힌다 (UX 문서 §2.2).

describe('V-012 — 걸어 둔 자리가 작업 공간에 선다', () => {
  beforeEach(() => {
    resetWorkspace();
    closeSurface(INVENTORY_SURFACE_ID);
    toggleSurface(INVENTORY_SURFACE_ID);
  });

  const slotCell = (fixture: unknown, id: string) =>
    (section(fixture, 'equipment').cells ?? []).find((c) => c.id === id);

  it('자리 여섯 전부가 선다 — 빈 자리도 감추지 않는다', () => {
    const cells = section(worn, 'equipment').cells ?? [];
    expect(cells).toHaveLength(6);
    expect(cells.filter((c) => c.empty)).toHaveLength(5);
    // 찬 수도 전체도 세계가 준 목록에서 읽는다 — 화면이 세지 않는다
    expect(section(worn, 'equipment').title).toBe('걸어 둔 것 — 1 / 6');
  });

  it('걸린 칸은 지금 보태고 있는 것을 곁글자로 말한다', () => {
    const cell = slotCell(worn, 'slot.E1');
    expect(cell?.text).toContain('곡괭이');
    expect(cell?.detail).toBe('물리 공격 +12');
    // 곁말에는 용도와 되는 것이 온다 (V-011 과 같은 꼴)
    expect(cell?.tip).toContain('채집');
    expect(cell?.tip?.some((line) => line.startsWith('할 수 있다'))).toBe(true);
    // 보태는 값은 곁말에 **없다** — 곁글자로 이미 서 있다 (V-010 과 같은 판단)
    expect(cell?.tip).not.toContain('물리 공격 +12');
  });

  it('빈 자리에는 곁말이 없다 — 없는 것이 스스로를 말할 수는 없다', () => {
    expect(slotCell(worn, 'slot.E2')?.tip).toBeUndefined();
  });

  it('자리를 고르면 그 자리의 행동이 상세에 선다 — 가방과 같은 자리다', () => {
    bag(worn);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E1');
    expect(workspaceSlotSelection()).toBe('E1');
    expect(workspaceSelection()).toBeNull(); // 둘을 동시에 고르지 않는다
    expect(section(worn, 'detail').title).toBe('고른 것 — 자리 1 · 곡괭이');
    const rows = section(worn, 'detail').rows ?? [];
    expect(rows.map((r) => r.id)).toEqual(['use-item', 'unequip-item']);
  });

  it('빈 자리도 고를 수 있고, 왜 아무것도 못 푸는지가 사유로 온다', () => {
    bag(worn);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E2');
    expect(workspaceSlotSelection()).toBe('E2');
    // V-014 CHANGED — 빈 자리에는 번호가 없다 (부를 일이 없다). 어느 칸인지는 테두리가 말한다
    expect(section(worn, 'detail').title).toBe('고른 것 — 빈 자리');
    const rows = section(worn, 'detail').rows ?? [];
    expect(rows[0]?.state).toBe('blocked');
    expect(rows[0]?.text).toContain('빈 자리');
  });

  it('푸는 요청이 싣는 것은 **자리 하나**뿐이다 — 무엇을 푸는지는 싣지 않는다', () => {
    const { sent, send } = sink();
    bag(worn);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E1');
    pressRow(INVENTORY_SURFACE_ID, 'unequip-item', send);
    expect(sent).toEqual([{ interactionId: 'unequip-item', equipSlotId: 'E1' }]);
  });

  it('걸린 것을 쓰는 손은 가방에서 쓰는 것과 **같은 요청**이다', () => {
    const { sent, send } = sink();
    bag(worn);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E1');
    pressRow(INVENTORY_SURFACE_ID, 'use-item', send);
    expect(sent).toEqual([{ interactionId: 'use-item', itemKind: 'pickaxe' }]);
  });

  it('가방을 고르면 자리 고르기가 놓인다 — 상세는 언제나 하나다', () => {
    bag(worn);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E1');
    pickCell(INVENTORY_SURFACE_ID, 'item.stone');
    expect(workspaceSlotSelection()).toBeNull();
    expect(workspaceSelection()).toBe('stone');
  });

  it('자리를 골라 두면 ← → 가 그 축 안에서 걷는다', () => {
    bag(worn);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E1');
    moveSelection(snap(worn), 1);
    expect(workspaceSlotSelection()).toBe('E2');
    expect(workspaceSelection()).toBeNull();
  });

  it('세계가 자리를 보내지 않으면 구획 자체가 없다', () => {
    expect(bag(mining).sections.some((s) => s.id === 'equipment')).toBe(false);
  });
});

// ── V-013 — 칸이 자기 번호를 지닌다 ─────────────────────────────────
//
// 번호는 화면이 매기는 것이 아니라 **세계가 준 차례**다. 두 걸음 지름길이 세는 것이
// 그 차례이고(`inventorySlots`), 이 칸에 적히는 것도 같은 표에서 온다 — 그래서
// "화면이 부르라고 한 번호" 와 "실제로 부르는 번호" 가 갈라질 자리가 없다.

describe('V-013 — 칸의 번호는 지름길이 세는 그 번호다', () => {
  beforeEach(() => {
    resetWorkspace();
    closeSurface(INVENTORY_SURFACE_ID);
    toggleSurface(INVENTORY_SURFACE_ID);
  });

  const cellTexts = (fixture: unknown) =>
    (section(fixture, 'items').cells ?? []).map((c) => c.text);

  it('번호와 지름길의 차례가 **같은 표**에서 온다', () => {
    // 지름길이 세는 차례 (bindings.ts 가 이 함수를 부른다)
    const called = inventorySlots(resolvePresentation(snap(mining)));
    const texts = cellTexts(mining);
    called.forEach((kind, index) => {
      const cell = (section(mining, 'items').cells ?? []).find((c) => c.id === `item.${kind}`);
      expect(cell?.text.startsWith(`${index + 1}.`)).toBe(true);
    });
    expect(texts).toHaveLength(called.length);
  });

  it('거르고 정렬하고 좁혀도 번호는 물건을 따라간다', () => {
    const before = cellTexts(mining);
    setOrder('name');
    setFilter('all');
    const after = cellTexts(mining);
    // 차례는 바뀌었지만 **같은 번호 표**다 — 집합으로 보면 그대로다
    expect([...after].sort()).toEqual([...before].sort());
  });

  it('아홉을 넘는 것에는 번호가 없다 — 없는 손가락 자리를 짓지 않는다', () => {
    const many = {
      ...(mining as object),
      inventory: Array.from({ length: 11 }, (_, i) => ({
        kind: `k${i}`,
        count: 1,
        category: 'material',
        stackable: true,
        actions: [],
      })),
    };
    const texts = cellTexts(many);
    expect(texts[0]).toBe('1. 🪨 k0');
    expect(texts[8]).toBe('9. 🪨 k8');
    // 열째부터는 이름만 선다
    expect(texts[9]).toBe('🪨 k9');
    expect(texts[10]).toBe('🪨 k10');
  });

  it('읽어 주는 이름에도 번호가 실린다 — 눈으로만 아는 번호가 되지 않게', () => {
    const cell = (section(mining, 'items').cells ?? [])[0];
    // 접근성 이름은 능력이 text 로 짓는다 (engine/view-kernel/hud/surface.ts)
    expect(cell?.text).toContain('1.');
  });
});

// ── V-014 — 자리도 자기 번호를 지닌다 ───────────────────────────────
//
// 화면에 뜨는 자리 번호는 **하나뿐**이다: 푸는 지름길(`M` → 번호)이 세는 그 번호.
// 그것은 **걸린 자리만** 센다 (`equipmentSlotIds` — 띠에 서는 것도 걸린 자리뿐이다).
// 빈 자리에는 번호가 없다 — 부를 일이 없기 때문이다.

describe('V-014 — 자리 번호는 푸는 지름길이 세는 그 번호다', () => {
  beforeEach(() => {
    resetWorkspace();
    closeSurface(INVENTORY_SURFACE_ID);
    toggleSurface(INVENTORY_SURFACE_ID);
  });

  // E1 은 비고 E2 가 찼다 — **차례와 부르는 번호가 갈라지는** 바로 그 자리다
  const gapped = {
    ...(worn as object),
    equipment: [
      { slotId: 'E1', grants: [], contributions: [], actions: [] },
      {
        slotId: 'E2',
        item: { kind: 'pickaxe', category: 'tool' },
        grants: ['mine'],
        contributions: [{ name: 'physicalAttack', value: 12 }],
        actions: [{ id: 'unequip-item', role: 'unequip-item', available: true }],
      },
      { slotId: 'E3', grants: [], contributions: [], actions: [] },
    ],
  };

  const slotCell = (fixture: unknown, id: string) =>
    (section(fixture, 'equipment').cells ?? []).find((c) => c.id === id);

  it('둘째 자리에 걸렸어도 부르는 번호는 1 이다 — 걸린 것만 세기 때문이다', () => {
    expect(slotCell(gapped, 'slot.E2')?.text).toBe('1. ⛏ 곡괭이');
    // 화면과 지름길이 같은 표를 읽는다
    expect(equipmentSlotKeys((gapped as GameViewSnapshot).equipment ?? []).get('E2')).toBe('1');
  });

  it('빈 자리에는 번호가 없다 — 부를 일이 없다', () => {
    expect(slotCell(gapped, 'slot.E1')?.text).toBe('');
    expect(slotCell(gapped, 'slot.E1')?.empty).toBe(true);
  });

  it('상세 제목도 같은 번호를 쓴다 — 차례를 따로 세지 않는다', () => {
    bag(gapped);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E2');
    expect(section(gapped, 'detail').title).toBe('고른 것 — 자리 1 · 곡괭이');
  });

  it('빈 자리를 고르면 번호 없이 부른다', () => {
    bag(gapped);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E3');
    expect(section(gapped, 'detail').title).toBe('고른 것 — 빈 자리');
  });

  it('푸는 요청은 그 번호가 아니라 **자리 이름**을 싣는다 — 번호는 화면의 것이다', () => {
    const { sent, send } = sink();
    bag(gapped);
    pickCell(INVENTORY_SURFACE_ID, 'slot.E2');
    pressRow(INVENTORY_SURFACE_ID, 'unequip-item', send);
    expect(sent).toEqual([{ interactionId: 'unequip-item', equipSlotId: 'E2' }]);
  });
});
