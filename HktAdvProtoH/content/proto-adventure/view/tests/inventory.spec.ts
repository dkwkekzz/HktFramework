// C020 View 단독 테스트 — World 미기동, Fixture 만으로.
// 04-gameview.spec.yaml 의 VIEW CLOSURE 를 화면 쪽에서 재현한다.
//
// 이 파일이 지는 특별한 짐 하나 — **View 가 아이템 종류를 몰라도 그린다**를 보인다.
// 세계가 정의만 더한 아이템이 소지품에 나타나야 하고, 그때 View 코드는 열리지 않는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { inventorySlots } from '../inventory-presentation';
import { resolvePresentation } from '../resolve';
import mining from './fixtures/mining-available.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';

const plan = (fixture: unknown) => resolvePresentation(fixture as GameViewSnapshot);
const line = (fixture: unknown, id: string) => plan(fixture).hud.find((h) => h.id === id);

describe('VIEW CLOSURE 1 — 무엇을 얼마나 지녔는지 안다', () => {
  it('지닌 종류마다 한 줄이 뜨고 수량이 보인다', () => {
    expect(line(mining, 'inventory.stone')?.value).toBe(2);
    expect(line(mining, 'inventory.pickaxe')?.value).toBe(1);
  });

  it('칸 번호는 세계가 준 순서에 화면이 붙인다', () => {
    expect(line(mining, 'inventory.stone')?.label).toBe('1. 돌');
    expect(line(mining, 'inventory.pickaxe')?.label).toBe('2. 곡괭이');
  });

  it('아무것도 지니지 않아도 한 줄은 남는다 — 자리가 사라지지 않는다', () => {
    const empty = { ...(mining as object), inventory: [] };
    expect(line(empty, 'inventory.none')?.value).toBe('없음');
  });
});

describe('VIEW CLOSURE 2·3 — 지금 되는 것과 안 되는 사유가 함께 온다', () => {
  it('되는 것은 가능으로 뜬다', () => {
    expect(line(mining, 'inventory.pickaxe.use')?.value).toBe('가능');
  });

  it('안 되는 것은 세계가 준 사유가 문구로 뜬다', () => {
    expect(line(mining, 'inventory.stone.use')?.value).toBe('먼저 대상을 고르자');
    expect(line(depleted, 'inventory.pickaxe.use')?.value).toBe('광맥이 고갈되었다');
  });

  it('안 되는 항목도 자리에서 사라지지 않는다 — 이유를 읽는 것이 이 자리의 값어치다', () => {
    const ids = plan(mining).hud.map((h) => h.id);
    expect(ids).toContain('inventory.stone.use');
  });

  it('View 가 사유를 만들지 않는다 — 모르는 코드는 코드 그대로 나온다', () => {
    const unknown = {
      ...(mining as object),
      inventory: [
        {
          kind: 'stone',
          count: 1,
          category: 'material',
          stackable: true,
          actions: [
            { id: 'use-item', role: 'use-item', available: false, unavailableReason: 'ritual-forbidden' },
          ],
        },
      ],
    };
    expect(line(unknown, 'inventory.stone.use')?.value).toBe('ritual-forbidden');
  });
});

describe('DC-ITEM-KIND-IS-DATA-NOT-BRANCH — View 는 종류를 몰라도 그린다', () => {
  const unknownKind = {
    ...(mining as object),
    inventory: [
      {
        kind: 'boundary-crystal', // 세계가 정의만 더한 아이템 — View 는 이것을 모른다
        count: 3,
        category: 'material',
        origin: 'IT-BOUNDARY-BLADE',
        stackable: true,
        actions: [{ id: 'use-item', role: 'use-item', available: true }],
      },
    ],
  };

  it('문구 표에 없는 종류도 줄이 뜨고 수량이 보인다', () => {
    expect(line(unknownKind, 'inventory.boundary-crystal')?.value).toBe(3);
  });

  it('이름은 코드 그대로 보인다 — 화면이 멈추지 않는다', () => {
    expect(line(unknownKind, 'inventory.boundary-crystal')?.label).toBe('1. boundary-crystal');
  });

  it('쓰기 줄도 그대로 만들어진다', () => {
    expect(line(unknownKind, 'inventory.boundary-crystal.use')?.value).toBe('가능');
  });

  it('모르는 분류는 아이콘 없이 나온다', () => {
    const odd = {
      ...(mining as object),
      inventory: [
        { kind: 'relic', count: 1, category: 'reliquary', stackable: false, actions: [] },
      ],
    };
    expect(line(odd, 'inventory.relic')?.icon).toBeUndefined();
  });
});

describe('칸 번호 되읽기 — 숫자 키가 무엇을 부르는가', () => {
  it('장면에서 칸 순서를 되읽으면 세계가 준 순서 그대로다', () => {
    expect(inventorySlots(plan(mining))).toEqual(['stone', 'pickaxe']);
  });

  it('쓰기 줄은 칸으로 세지 않는다 — 한 물건이 두 칸을 차지하지 않는다', () => {
    expect(inventorySlots(plan(mining))).toHaveLength(2);
  });

  it('아무것도 없으면 칸도 없다', () => {
    const empty = { ...(mining as object), inventory: [] };
    expect(inventorySlots(plan(empty))).toEqual([]);
  });
});

describe('C001 REGRESSION — 사라진 두 칸이 남긴 자리', () => {
  it('돌 전용 칸과 도구 보유 칸이 화면에서 사라졌다', () => {
    const ids = plan(mining).hud.map((h) => h.id);
    expect(ids).not.toContain('tool.hasMiningTool');
  });

  it('캐서 늘어난 것이 반짝이던 성질은 소지품 줄이 이어받았다', () => {
    expect(line(mining, 'inventory.stone')?.celebrateGain).toBe(true);
  });

  it('채집이 되는지는 여전히 대상 자리와 interaction 이 답한다', () => {
    const p = plan(mining);
    expect(p.interactions.find((i) => i.id === 'mine')?.available).toBe(true);
    expect(p.hud.find((h) => h.id === 'target.mine')).toBeDefined();
  });
});
