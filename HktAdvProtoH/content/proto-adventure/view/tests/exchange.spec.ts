// C024 View 단독 테스트 — World 미기동, Fixture 만으로.
// 04-gameview.spec.yaml 의 계약을 화면 쪽에서 재현한다.
//
// 이 파일이 지는 특별한 짐 하나 — **화면이 가방의 형편에서 교체 가능 여부를 유추하지
// 않는다**를 보인다. 같은 fixture 에서 자리의 풀기는 불가인데 소지품의 바꿔 걸기는
// 가능이며, 화면은 그 둘을 각각 세계가 보낸 대로 그린다. 유추하는 순간 이 Cycle 이
// 세운 비대칭이 화면에서 사라진다.
//
// **fixture 는 실제 세계 프로세스가 낳은 관찰이다** — 손으로 지어내지 않았다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { armedAction, armedExchangeKind, KEY_BINDINGS } from '../bindings';
import { resolvePresentation } from '../resolve';
import nothingWorn from './fixtures/exchange-nothing-worn.fixture.json';
import fullBag from './fixtures/exchange-full-bag.fixture.json';
import done from './fixtures/exchange-done.fixture.json';

const plan = (fixture: unknown) => resolvePresentation(fixture as GameViewSnapshot);
const line = (fixture: unknown, id: string) => plan(fixture).hud.find((h) => h.id === id);
const lines = (fixture: unknown) => plan(fixture).self?.lines ?? [];
const withText = (fixture: unknown, needle: string) =>
  lines(fixture).find((l) => l.includes(needle));

// ─────────────────────────────────────────────────────────────────────
describe('VIEW CLOSURE 1 — 바꿔 걸기가 손 하나로 보인다', () => {
  it('걸린 것이 있으면 바꿔 걸기가 가능으로 뜨고 손가락 자리가 붙는다', () => {
    const buckler = withText(fullBag, '손방패');
    expect(buckler).toContain('바꿔 걸기 ✓ , →');
  });

  it('걸린 것이 없으면 사유가 함께 온다 — **가방 탓으로 읽히지 않는다**', () => {
    const buckler = withText(nothingWorn, '손방패');
    expect(buckler).toContain('바꿔 걸기 ✗ 걸린 것 없음');
    // 같은 줄에서 그냥 걸기는 가능이다 — 할 일은 덜어내기가 아니라 거는 것이다
    expect(buckler).toContain('걸기 ✓ N →');
  });

  it('걸 수 없는 물건에는 걸기와 같은 사유가 온다', () => {
    const stone = withText(fullBag, '돌');
    expect(stone).toContain('바꿔 걸기 ✗ 걸 수 없음');
    expect(stone).toContain('걸기 ✗ 걸 수 없음');
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('VIEW CLOSURE 2 — 비대칭이 한 화면에서 보인다 (IE §15 · §16.1)', () => {
  it('같은 fixture 에서 풀기는 불가인데 바꿔 걸기는 가능이다', () => {
    expect(line(fullBag, 'inventory.room')?.value).toBe('4 / 4 (가득)');
    // 자리 쪽 — 막혔다
    expect(withText(fullBag, '1. 곡괭이')).toContain('풀기 ✗ 자리 없음');
    // 소지품 쪽 — 된다
    expect(withText(fullBag, '손방패')).toContain('바꿔 걸기 ✓');
  });

  it('화면은 두 판정을 하나로 뭉치지 않는다 — 가득 참이 모든 것을 막지 않는다', () => {
    const panel = lines(fullBag);
    // "가득" 이 떠 있는 그 화면에 가능인 손이 살아 있다
    expect(panel.some((l) => l.includes('바꿔 걸기 ✗ 자리 없음'))).toBe(false);
    expect(panel.some((l) => l.includes('풀기 ✗ 자리 없음'))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('VIEW CLOSURE 3 — 바꿔 낀 결과가 그대로 보인다', () => {
  it('자리에 새것이 서고 그것이 보태는 값이 함께 뜬다', () => {
    expect(line(done, 'equipment.E1')?.value).toBe('손방패 · 물리 방어 +15');
  });

  it('헌것이 소지품으로 돌아온 것이 보인다', () => {
    expect(line(done, 'inventory.pickaxe')?.value).toBe(1);
    expect(line(done, 'inventory.buckler')).toBeUndefined();
  });

  it('밀려난 것이 주던 용도가 사라진 것이 보인다 — 채집이 그 사유로 막힌다', () => {
    const mine = plan(done).interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(false);
    expect(mine?.unavailableText).toBe('채집 도구를 걸지 않았다');
  });

  it('화면은 값을 계산하지 않는다 — 세계가 보낸 수를 그대로 그린다', () => {
    const sent = (done as unknown as GameViewSnapshot).hud.find(
      (h) => h.id === 'self.combat.armor',
    )?.value;
    expect(lines(done).some((l) => l.includes(`물리 방어 ${sent}`))).toBe(true);
    // 15 를 더한 흔적이 없다 — combatStats 가 이미 더해진 값이다
    expect(lines(done).some((l) => l.includes(`물리 방어 ${Number(sent) + 15}`))).toBe(false);
  });

  it('새 분류도 표에 있으면 아이콘이 붙고, 없어도 화면이 멈추지 않는다', () => {
    expect(line(nothingWorn, 'inventory.buckler')?.icon).toBe('🛡');

    const odd = JSON.parse(JSON.stringify(nothingWorn)) as GameViewSnapshot;
    odd.inventory = [
      { kind: 'relic', count: 1, category: 'reliquary', stackable: false, actions: [] },
    ];
    expect(line(odd, 'inventory.relic')?.icon).toBeUndefined();
    expect(line(odd, 'inventory.relic')?.value).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────
describe('VIEW CLOSURE 4 — 세 걸음 조작은 세계를 흔들지 않는다', () => {
  const press = (code: string, scene: ReturnType<typeof plan>, send: (a: unknown) => void) => {
    const binding = KEY_BINDINGS.find((b) => b.code === code);
    binding?.invoke(scene, send as never);
  };

  it('물건을 고르는 첫 걸음에서는 아무것도 나가지 않는다', () => {
    const scene = plan(fullBag);
    const sent: unknown[] = [];

    press('Comma', scene, (a) => sent.push(a));
    expect(armedAction()).toBe('exchange-item');

    press('Digit2', scene, (a) => sent.push(a)); // 소지품 2 번 = 손방패
    expect(sent).toEqual([]); // **세계로 나간 것이 없다**
    expect(armedExchangeKind()).toBe('buckler');

    press('Digit1', scene, (a) => sent.push(a)); // 걸린 자리 1 번 = E1
    expect(sent).toEqual([
      { interactionId: 'equip-item', itemKind: 'buckler', equipSlotId: 'E1' },
    ]);
    // 세 걸음이 끝나면 닫힌다 — 열린 채로 남지 않는다
    expect(armedAction()).toBeNull();
    expect(armedExchangeKind()).toBeNull();
  });

  it('도중에 다른 것을 열면 골라 둔 것이 버려진다', () => {
    const scene = plan(fullBag);
    const sent: unknown[] = [];

    press('Comma', scene, (a) => sent.push(a));
    press('Digit2', scene, (a) => sent.push(a));
    expect(armedExchangeKind()).toBe('buckler');

    press('KeyM', scene, (a) => sent.push(a)); // 풀기로 옮긴다
    expect(armedExchangeKind()).toBeNull();
    expect(armedAction()).toBe('unequip-item');

    press('KeyM', scene, (a) => sent.push(a)); // 닫는다
    expect(armedAction()).toBeNull();
    expect(sent).toEqual([]);
  });

  it('없는 칸을 짚으면 닫히고 아무것도 나가지 않는다', () => {
    const scene = plan(nothingWorn);
    const sent: unknown[] = [];

    press('Comma', scene, (a) => sent.push(a));
    press('Digit9', scene, (a) => sent.push(a)); // 9 번 칸은 없다
    expect(armedAction()).toBeNull();
    expect(armedExchangeKind()).toBeNull();
    expect(sent).toEqual([]);
  });

  it('걸린 자리가 없으면 두 번째 걸음이 아무것도 보내지 않는다', () => {
    const scene = plan(nothingWorn);
    const sent: unknown[] = [];

    press('Comma', scene, (a) => sent.push(a));
    press('Digit1', scene, (a) => sent.push(a)); // 곡괭이를 고른다
    expect(armedExchangeKind()).toBe('pickaxe');
    press('Digit1', scene, (a) => sent.push(a)); // 걸린 자리가 하나도 없다
    expect(sent).toEqual([]);
    expect(armedAction()).toBeNull();
  });
});
