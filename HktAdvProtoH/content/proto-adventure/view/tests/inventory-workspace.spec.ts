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
  workspacePendingCount,
  workspaceSelection,
} from '../inventory-workspace';
import { resolvePresentation } from '../resolve';
import { closeSurface, surfaceIsOpen, toggleSurface } from '../surface-state';
import empty from './fixtures/inventory-empty.fixture.json';
import worn from './fixtures/equipment-worn.fixture.json';
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

describe('VUX-IE-FX-STALE — 세계가 답하기 전에는 아무것도 참이 아니다', () => {
  it('보낸 뒤 그 줄이 기다림으로 보인다', () => {
    moveSelection(snap(mining), 1);
    moveActionFocus(snap(mining), 1);
    commitFocused(mining, () => 7);
    const rows = section(mining, 'detail').rows ?? [];
    expect(rows.find((r) => r.id === 'discard-item')?.state).toBe('pending');
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

describe('04 unexecutable_actions — 보이되 이 자리에서는 실행하지 않는다', () => {
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
