// C025 View 단독 테스트 — World 미기동, Fixture 만으로 (VUX-IE-V-10).
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
  invokeFocusedAction,
  moveActionFocus,
  moveSelection,
  resetWorkspace,
  settleOutcome,
  workspacePendingCount,
  workspaceSelection,
} from '../inventory-workspace';
import { resolvePresentation } from '../resolve';
import { closeSurface, surfaceIsOpen, toggleSurface } from '../surface-state';
import empty from './fixtures/inventory-empty.fixture.json';
import full from './fixtures/inventory-full.fixture.json';
import mining from './fixtures/mining-available.fixture.json';
import unknown from './fixtures/inventory-unknown.fixture.json';

const snap = (fixture: unknown) => fixture as GameViewSnapshot;
const bag = (fixture: unknown): SceneSurface => {
  const found = resolvePresentation(snap(fixture)).surfaces.find(
    (s) => s.id === INVENTORY_SURFACE_ID,
  );
  if (!found) throw new Error('소지품 작업 공간이 장면에 없다');
  return found;
};
const section = (fixture: unknown, id: string): SceneSurfaceSection => {
  const found = bag(fixture).sections.find((s) => s.id === id);
  if (!found) throw new Error(`구획 ${id} 이 없다`);
  return found;
};

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
    expect(resolvePresentation(snap(mining)).surfaces).toHaveLength(1);
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
    invokeFocusedAction(snap(mining), (a) => {
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

describe('VUX-IE-FX-STALE — 세계가 답하기 전에는 아무것도 참이 아니다', () => {
  it('보낸 뒤 그 줄이 기다림으로 보인다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    invokeFocusedAction(snap(mining), () => 7);
    const rows = section(mining, 'detail').rows ?? [];
    expect(rows.find((r) => r.id === 'discard-item')?.state).toBe('pending');
  });

  it('VUX-IE-V-05 — 기다리는 동안 수량도 자리도 바뀌지 않는다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    invokeFocusedAction(snap(mining), () => 7);
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
    invokeFocusedAction(snap(mining), send);
    invokeFocusedAction(snap(mining), send);
    expect(count).toBe(1);
  });

  it('대답이 오면 기다림이 풀린다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    invokeFocusedAction(snap(mining), () => 7);
    expect(settleOutcome(7)).toBe(true);
    expect(workspacePendingCount()).toBe(0);
  });

  it('표식 없는 대답은 가져가지 않는다 — 그것은 다른 자리의 것이다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    invokeFocusedAction(snap(mining), () => 7);
    expect(settleOutcome(undefined)).toBe(false);
    expect(workspacePendingCount()).toBe(1);
  });

  it('보내지 못했으면 기다리지 않는다 — 영영 풀리지 않을 자리다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    invokeFocusedAction(snap(mining), () => null);
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

describe('VUX-IE-V-09 — 모르는 코드가 와도 멈추지 않는다', () => {
  it('모르는 종류는 코드 그대로 보인다', () => {
    expect(section(unknown, 'items').cells?.[0]?.text).toBe('moonshard');
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

describe('VUX-IE-V-07 · 04 unexecutable_actions — 보이되 이 자리에서는 실행하지 않는다', () => {
  const withExchange = {
    ...(mining as object),
    inventory: [
      {
        kind: 'buckler',
        count: 1,
        category: 'gear',
        stackable: false,
        actions: [{ id: 'exchange-item', role: 'exchange-item', available: true }],
      },
    ],
  };

  it('세계가 된다고 말한 것을 안 된다고 그리지 않는다', () => {
    moveSelection(snap(withExchange), 1);
    const rows = section(withExchange, 'detail').rows ?? [];
    expect(rows[0]?.state).toBe('available');
  });

  it('그러나 이 자리에서 보내지는 않는다 — 그 사정이 곁글자로 보인다', () => {
    const sent: ActionRequest[] = [];
    moveSelection(snap(withExchange), 1);
    const rows = section(withExchange, 'detail').rows ?? [];
    expect(rows[0]?.hint).toContain(',');
    invokeFocusedAction(snap(withExchange), (a) => {
      sent.push(a);
      return 1;
    });
    expect(sent).toEqual([]);
  });
});

describe('VUX-IE-V-03 — 표면이 자리 수를 바꾸지 않는다', () => {
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
