// C020 View 단독 테스트 — World 미기동, Fixture 만으로.
//
// 04-gameview.spec.yaml 의 세 중심을 검증한다.
//   ① 소지품은 목록이다 — 종류마다 칸을 만들지 않는다
//   ② 각 항목에 지금 무엇이 되고 왜 안 되는지가 함께 온다 (판정은 세계가 한다)
//   ③ 얼마나 찼는지를 세계가 답한다

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { letGoTargetSlot, LET_GO_HUD_PREFIX } from '../carried-presentation';
import { KEY_BINDINGS } from '../bindings';
import type { ActionRequest } from '../../protocol/actions';
import available from './fixtures/mining-available.fixture.json';
import full from './fixtures/carry-full.fixture.json';

const plan = (f: unknown) => resolvePresentation(f as GameViewSnapshot);
const hud = (f: unknown, id: string) => plan(f).hud.find((h) => h.id === id);
const hudIds = (f: unknown) => plan(f).hud.map((h) => h.id);

describe('① 소지품은 목록이다 — 종류마다 칸을 만들지 않는다', () => {
  it('돌 전용 칸과 도구 유무 깃발이 화면에서 사라졌다', () => {
    expect(hud(available, 'inventory.stone')).toBeUndefined();
    expect(hud(available, 'tool.hasMiningTool')).toBeUndefined();
  });

  it('지닌 자리마다 한 줄이 선다 — 빈 자리는 그리지 않는다', () => {
    const ids = hudIds(available).filter((id) => /^carried\.\d+$/.test(id));
    expect(ids).toEqual(['carried.0', 'carried.1']); // 2/3 — 세 번째 자리는 비었다
  });

  it('겹치는 것은 수량과 여유를, 겹치지 않는 것은 이름만 보인다', () => {
    expect(hud(available, 'carried.1')?.value).toBe('돌 ×2 (2/2)');
    expect(hud(available, 'carried.0')?.value).toContain('곡괭이');
    expect(hud(available, 'carried.0')?.value).not.toContain('×'); // 언제나 하나다
  });

  it('갈래가 라벨 자리에 온다 — 도구와 재료가 섞여 보이지 않는다', () => {
    expect(hud(available, 'carried.0')?.label).toBe('도구');
    expect(hud(available, 'carried.1')?.label).toBe('재료');
  });
});

describe('② 가능/사유가 함께 온다 — 판정은 세계가 한다', () => {
  it('세계가 막아 둔 자리는 사유가 문구로 붙는다 — 회색으로 감추지 않는다', () => {
    expect(hud(available, 'carried.0')?.value).toContain('다시 캘 수 없다');
  });

  it('세계가 허락한 자리에는 사유가 붙지 않는다', () => {
    expect(hud(available, 'carried.1')?.value).toBe('돌 ×2 (2/2)');
  });

  it('덜어내기는 세계가 된다고 말한 첫 자리를 겨눈다', () => {
    expect(letGoTargetSlot(available as GameViewSnapshot)).toBe(1); // 0 은 잠겨 있다
    expect(hud(available, `${LET_GO_HUD_PREFIX}1`)?.value).toContain('[X]');
  });

  it('전부 잠긴 몸에서는 겨눌 자리가 없다 — 그 사실이 문구로 온다', () => {
    const locked = {
      ...(available as GameViewSnapshot),
      carried: [
        {
          slot: 0,
          kind: 'pickaxe',
          category: 'tool',
          quantity: 1,
          stackLimit: 1,
          uses: ['mining'],
          actions: [
            {
              interactionId: 'let-go',
              slot: 0,
              effect: 'let-go',
              available: false,
              reason: 'last-way-locked',
            },
          ],
        },
      ],
      carriedRoom: { used: 1, total: 3 },
    } as GameViewSnapshot;

    expect(letGoTargetSlot(locked)).toBeNull();
    expect(hud(locked, `${LET_GO_HUD_PREFIX}none`)?.value).toBe('덜어낼 수 있는 것이 없다');
  });

  it('캘 수 없는 사유도 문구로 온다 — 새 사유가 계약을 늘리지 않는다', () => {
    const mine = plan(full).interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(false);
    expect(mine?.unavailableText).toContain('자리가 없다');
  });
});

describe('③ 얼마나 찼는가는 세계가 답한다', () => {
  it('쓴 자리와 전체 자리가 한 줄로 온다', () => {
    expect(hud(available, 'carried.room')?.value).toBe('2/3');
  });

  it('가득 찬 것은 눈에 걸리게 둔다 — 판단이 필요한 순간이다', () => {
    expect(hud(full, 'carried.room')?.value).toBe('3/3 — 가득 찼다');
  });

  it('보는 쪽이 항목을 세어 알아내지 않는다 — 빈 자리는 오지 않기 때문이다', () => {
    // 자리 둘이 실렸는데 전체는 셋이다. 목록만으로는 알 수 없는 값이다
    expect(plan(available).hud.filter((h) => /^carried\.\d+$/.test(h.id))).toHaveLength(2);
    expect(hud(available, 'carried.room')?.value).toContain('/3');
  });
});

describe('입력 → Action Request', () => {
  const letGoBinding = KEY_BINDINGS.find((b) => b.code === 'KeyX')!;

  function press(fixture: unknown): ActionRequest | null {
    let sent: ActionRequest | null = null;
    letGoBinding.invoke({ hud: plan(fixture).hud } as never, (action) => {
      sent = action as ActionRequest;
      return true;
    });
    return sent;
  }

  it('X 를 누르면 세계가 허락한 자리를 덜어내는 요청이 나간다', () => {
    expect(press(available)).toEqual({ interactionId: 'let-go', carriedSlot: 1 });
  });

  it('겨눌 자리가 없으면 아무것도 보내지 않는다 — View 가 판정하지 않는다', () => {
    const locked = {
      ...(available as GameViewSnapshot),
      carried: [],
      carriedRoom: { used: 0, total: 3 },
    } as GameViewSnapshot;
    expect(press(locked)).toBeNull();
  });

  it('Client 는 상태를 바꾸지 않는다 — 보내는 것은 요청뿐이다', () => {
    const request = press(full);
    expect(request).toEqual({ interactionId: 'let-go', carriedSlot: 1 });
    // Fixture 는 그대로다 — 화면이 세계를 앞질러 바꾸지 않는다
    expect((full as GameViewSnapshot).carriedRoom).toEqual({ used: 3, total: 3 });
  });
});
