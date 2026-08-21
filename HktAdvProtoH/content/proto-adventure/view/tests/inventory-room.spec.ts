// C022 View 단독 테스트 — World 미기동, Fixture 만으로.
// 04-gameview.spec.yaml 의 VIEW CLOSURE 열 항목을 화면 쪽에서 재현한다.
//
// 이 파일이 지는 특별한 짐 하나 — **View 가 자리를 한 번도 세지 않는다**를 보인다.
// 항목의 수량과 겹침 한도로 자리를 유도하면 세계와 화면에 계산이 둘 생긴다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { inventorySlots } from '../inventory-presentation';
import { resolvePresentation } from '../resolve';
import mining from './fixtures/mining-available.fixture.json';
import full from './fixtures/inventory-full.fixture.json';

const plan = (fixture: unknown) => resolvePresentation(fixture as GameViewSnapshot);
const line = (fixture: unknown, id: string) => plan(fixture).hud.find((h) => h.id === id);
const mine = (fixture: unknown) => plan(fixture).interactions.find((i) => i.id === 'mine');

describe('VIEW CLOSURE 1 — 자리가 얼마나 찼는지 안다', () => {
  it('쓴 자리와 전체가 한 줄로 뜬다', () => {
    expect(line(mining, 'inventory.room')?.label).toBe('자리');
    expect(line(mining, 'inventory.room')?.value).toBe('2 / 4');
  });

  it('가득 차면 그렇다고 보인다 — 화면이 세어 알아낸 것이 아니다', () => {
    expect(line(full, 'inventory.room')?.value).toBe('4 / 4 (가득)');
  });

  it('자리 줄은 소지품 항목보다 **먼저** 온다 — 비었을 때도 보여야 한다', () => {
    const hud = plan(mining).hud;
    const roomAt = hud.findIndex((h) => h.id === 'inventory.room');
    const firstItem = hud.findIndex((h) => h.id === 'inventory.stone');
    expect(roomAt).toBeGreaterThanOrEqual(0);
    expect(roomAt).toBeLessThan(firstItem);
  });

  it('지닌 것이 없어도 자리가 뜬다', () => {
    const empty = { ...(mining as object), inventory: [] };
    expect(line(empty, 'inventory.room')?.value).toBe('2 / 4');
    expect(line(empty, 'inventory.none')?.value).toBe('없음');
  });

  it('자리 줄은 소지품 칸이 아니다 — 숫자 키가 그것을 가리키지 않는다', () => {
    expect(inventorySlots(plan(mining))).toEqual(['stone', 'pickaxe']);
  });
});

describe('VIEW CLOSURE 3·4 — 자리가 차면 캘 수 없고 그 사유가 보인다', () => {
  it('가방이 차면 채집이 불가로 뜬다', () => {
    expect(mine(mining)?.available).toBe(true);
    expect(mine(full)?.available).toBe(false);
  });

  it('사유는 세계가 준 코드를 문구로 옮긴 것이다', () => {
    expect(mine(full)?.unavailableText).toBe('자리가 없다 — 무엇을 덜어내야 한다');
  });
});

describe('VIEW CLOSURE 5·6·7 — 무엇을 덜어낼 수 있는지 안다', () => {
  it('덜어낼 수 있는 항목은 손가락 자리와 함께 뜬다', () => {
    expect(line(full, 'inventory.stone.discard')?.label).toBe('덜어내기');
    expect(line(full, 'inventory.stone.discard')?.value).toBe('가능 (B → 1)');
  });

  it('되돌릴 수 없는 것은 사유가 뜬다 — 화면이 그 종류를 알아본 것이 아니다', () => {
    expect(line(full, 'inventory.pickaxe.discard')?.value).toBe('이걸 놓으면 되돌릴 수 없다');
  });

  it('덜어내기 줄은 **지닌 모든 항목**에 붙는다 (쓸 수 있는 것만이 아니다)', () => {
    const hud = plan(full).hud;
    const discards = hud.filter((h) => h.id.endsWith('.discard'));
    expect(discards.map((h) => h.id)).toEqual([
      'inventory.stone.discard',
      'inventory.pickaxe.discard',
    ]);
  });
});

describe('DC-WORLD-OWNS-THE-SURFACE-LIST — 화면이 판정하지 않는다', () => {
  it('세계가 available 을 뒤집으면 화면도 그대로 뒤집힌다 — 이유를 묻지 않는다', () => {
    // 곡괭이의 덜어내기를 세계가 허락한 세계 (곡괭이를 내는 광맥이 생긴 날)
    const withSource = JSON.parse(JSON.stringify(full)) as GameViewSnapshot;
    const pickaxe = withSource.inventory.find((i) => i.kind === 'pickaxe')!;
    const discard = pickaxe.actions.find((a) => a.role === 'discard-item')!;
    discard.available = true;
    delete discard.unavailableReason;

    // **View 코드는 한 줄도 열리지 않았는데** 덜어낼 수 있게 되었다
    expect(line(withSource, 'inventory.pickaxe.discard')?.value).toBe('가능 (B → 2)');
  });

  it('모르는 사유 코드도 화면을 멈추지 않는다', () => {
    const odd = JSON.parse(JSON.stringify(full)) as GameViewSnapshot;
    const stone = odd.inventory.find((i) => i.kind === 'stone')!;
    const discard = stone.actions.find((a) => a.role === 'discard-item')!;
    discard.available = false;
    discard.unavailableReason = 'bound-by-oath'; // 아직 세계에 없는 사유

    expect(line(odd, 'inventory.stone.discard')?.value).toBeTruthy();
  });

  it('한 자리에 몇까지 겹치는지는 계약에 없다 — 화면이 자리를 셀 수 없다', () => {
    const item = (full as unknown as GameViewSnapshot).inventory[0]!;
    expect('stackLimit' in item).toBe(false);
    // 화면이 아는 것은 겹치는가 하나뿐이고, 그것으로는 자리를 셀 수 없다
    expect(item.stackable).toBe(true);
    expect(item.count).toBe(9);
    expect((full as unknown as GameViewSnapshot).inventoryRoom.used).toBe(4);
  });
});
