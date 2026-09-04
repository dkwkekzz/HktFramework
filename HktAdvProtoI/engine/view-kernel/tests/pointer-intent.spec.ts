// 집기와 뜻 — 기구가 게임의 뜻을 쥐고 있지 않은가를 검사한다.
//
// 브라우저 없이 돈다: 화면은 addEventListener 를 지닌 자리 하나로 대신하고, 집는 일은
// 미리 정해 둔 답으로 대신한다. 여기서 확인하는 것은 **기구 쪽 성질**뿐이다 —
// 무엇이 이동인지 채굴인지 지목인지 이 파일도 기구도 알지 못한다.

import { describe, expect, it } from 'vitest';
import { attachInput, pickAt } from '../input/input';
import type { PointerIntent, PointerPick } from '../input/pointer-intent';
import type { GameRenderer } from '../renderer/renderer';
import type { ActionRequest } from '../../protocol-core/actions';
import type { SceneState } from '../scene/scene-state';

/** 눌림을 대신 받아 주는 자리 — 진짜 캔버스가 하는 일 중 이 검사가 쓰는 것만 있다 */
function fakeCanvas(): { element: HTMLCanvasElement; click(ev: Partial<MouseEvent>): void } {
  let handler: ((ev: MouseEvent) => void) | null = null;
  const element = {
    addEventListener(type: string, fn: (ev: MouseEvent) => void) {
      if (type === 'click') handler = fn;
    },
  } as unknown as HTMLCanvasElement;
  return {
    element,
    click(ev) {
      handler?.({
        clientX: 0,
        clientY: 0,
        altKey: false,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        ...ev,
      } as MouseEvent);
    },
  };
}

function fakeRenderer(
  element: HTMLCanvasElement,
  picks: { entityId?: string | null; ground?: { x: number; z: number } | null },
): GameRenderer {
  return {
    domElement: element,
    pickEntity: () => picks.entityId ?? null,
    pickGround: () => picks.ground ?? null,
  } as unknown as GameRenderer;
}

const EMPTY_SCENE = {} as SceneState;

function attach(
  picks: { entityId?: string | null; ground?: { x: number; z: number } | null },
  intent: PointerIntent,
): { click(ev?: Partial<MouseEvent>): void; sent: ActionRequest[] } {
  const canvas = fakeCanvas();
  const sent: ActionRequest[] = [];
  attachInput(
    fakeRenderer(canvas.element, picks),
    (action) => sent.push(action),
    intent,
  );
  return { click: (ev = {}) => canvas.click(ev), sent };
}

describe('집기 — 기구는 무엇을 요청할지 스스로 정하지 않는다', () => {
  it('정책이 아무것도 주지 않으면 요청이 나가지 않는다', () => {
    const { click, sent } = attach({ entityId: 'ore-1', ground: { x: 3, z: 4 } }, () => null);
    click();
    expect(sent).toEqual([]);
  });

  it('정책이 준 요청만 그대로 나간다 — 기구가 고쳐 쓰지 않는다', () => {
    const action: ActionRequest = { interactionId: 'mine', targetEntityId: 'ore-1' };
    const { click, sent } = attach({ entityId: 'ore-1' }, () => action);
    click();
    expect(sent).toEqual([action]);
  });

  it('집힌 것을 전부 넘긴다 — 존재와 지면 중 하나를 기구가 고르지 않는다', () => {
    let seen: PointerPick | null = null;
    const { click } = attach({ entityId: 'ore-1', ground: { x: 3, z: 4 } }, (pick) => {
      seen = pick;
      return null;
    });
    click();
    const pick = seen as PointerPick | null;
    expect(pick?.entityId).toBe('ore-1');
    expect(pick?.ground).toEqual({ x: 3, z: 4 });
  });

  it('아무것도 집히지 않아도 정책에게 묻는다 — 빈 자리를 누른 것도 뜻일 수 있다', () => {
    let asked = 0;
    const { click, sent } = attach({}, () => {
      asked++;
      return null;
    });
    click();
    expect(asked).toBe(1);
    expect(sent).toEqual([]);
  });

  it('함께 눌린 보조키가 정책에 실려 간다 — 같은 누름을 가르는 수단이다', () => {
    let seen: PointerPick | null = null;
    const { click } = attach({ ground: { x: 0, z: 0 } }, (pick) => {
      seen = pick;
      return null;
    });
    click({ altKey: true, shiftKey: true });
    const pick = seen as PointerPick | null;
    expect(pick?.modifiers).toEqual({ alt: true, shift: true, ctrl: false, meta: false });
  });

  it('누를 때마다 다시 집는다 — 뜻이 바뀌면 다음 누름부터 그대로 따른다', () => {
    let turn = 0;
    const { click, sent } = attach({ ground: { x: 1, z: 1 } }, () =>
      turn++ === 0 ? null : { interactionId: 'move', position: { x: 1, z: 1 } },
    );
    click();
    click();
    expect(sent).toHaveLength(1);
  });
});

describe('pickAt — 집는 일 자체', () => {
  it('한 자리에서 존재와 지면을 함께 집는다', () => {
    const canvas = fakeCanvas();
    const pick = pickAt(fakeRenderer(canvas.element, { entityId: 'a', ground: { x: 2, z: 2 } }), 10, 20, {
      alt: false,
      shift: false,
      ctrl: false,
      meta: false,
    });
    expect(pick).toEqual({
      entityId: 'a',
      ground: { x: 2, z: 2 },
      modifiers: { alt: false, shift: false, ctrl: false, meta: false },
    });
  });
});
