// C023 View 단독 테스트 — World 미기동, Fixture 만으로.
// 04-gameview.spec.yaml 의 계약을 화면 쪽에서 재현한다.
//
// 이 파일이 지는 특별한 짐 하나 — **View 가 자리 이름도 종류 이름도 모른 채 그린다**를
// 보인다. 자리가 여섯이든 셋이든, 걸리는 물건이 무엇이든 화면 코드는 열리지 않는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { equipmentSlotIds } from '../equipment-presentation';
import { resolvePresentation } from '../resolve';
import empty from './fixtures/equipment-empty.fixture.json';
import worn from './fixtures/equipment-worn.fixture.json';
import fullBag from './fixtures/equipment-full-bag.fixture.json';

const plan = (fixture: unknown) => resolvePresentation(fixture as GameViewSnapshot);
const line = (fixture: unknown, id: string) => plan(fixture).hud.find((h) => h.id === id);
const lines = (fixture: unknown) => plan(fixture).self?.lines ?? [];
const detail = (fixture: unknown, startsWith: string) =>
  lines(fixture).find((l) => l.startsWith(startsWith));

describe('VIEW CLOSURE 1 — 걸린 것과 지닌 것이 구분되어 보인다', () => {
  it('아무것도 걸지 않았으면 그렇다고 뜬다 — 자리를 안 그리는 것과 다르다', () => {
    expect(line(empty, 'equipment.none')?.value).toBe('없음');
    // 그리고 곡괭이는 여전히 소지품에 있다 — 지님과 적용이 갈린 것이 이 Cycle 이다
    expect(line(empty, 'inventory.pickaxe')?.value).toBe(1);
  });

  it('걸면 띠에 이름과 보태는 값이 함께 뜨고, 소지품에서는 사라진다', () => {
    expect(line(worn, 'equipment.E1')?.value).toBe('곡괭이 · 물리 공격 +12');
    expect(line(worn, 'inventory.pickaxe')).toBeUndefined();
  });

  it('걸린 것은 가방의 자리를 쓰지 않는다 — 세계가 보낸 값을 옮길 뿐이다', () => {
    expect(line(empty, 'inventory.room')?.value).toBe('2 / 4');
    expect(line(worn, 'inventory.room')?.value).toBe('1 / 4');
  });
});

describe('VIEW CLOSURE 2 — 자리 여섯이 전부 보이고 빈 자리도 보인다', () => {
  it('패널에 자리가 전부 선다 — 비었다는 것도 관찰의 내용이다', () => {
    const panel = lines(empty);
    expect(panel.some((l) => l.startsWith('걸어 둔 것'))).toBe(true);
    expect(panel.filter((l) => l.includes('빈 자리'))).toHaveLength(6);
  });

  it('번호는 걸린 자리에만 붙고, 띠에 선 순서와 같다', () => {
    expect(detail(worn, '1.')).toContain('곡괭이');
    expect(lines(worn).filter((l) => l.includes('빈 자리'))).toHaveLength(5);
    // 조립 루트가 "1 번이 어느 자리인가" 를 되읽는 경로 — 화면이 순서를 만들지 않는다
    expect(equipmentSlotIds(plan(worn))).toEqual(['E1']);
    expect(equipmentSlotIds(plan(empty))).toEqual([]);
  });

  it('걸어서 생긴 용도가 보인다 — 왜 캘 수 있게 되었는가를 읽는 자리다', () => {
    expect(detail(worn, '1.')).toContain('채집');
  });
});

describe('VIEW CLOSURE 3 — 안 되는 것은 왜 안 되는지가 온다', () => {
  it('걸 수 없는 물건은 사유와 함께 뜬다 — 자리 탓으로 읽히지 않는다', () => {
    const stone = detail(empty, '1. 돌') ?? detail(empty, '2. 돌');
    expect(stone).toContain('걸기 ✗ 걸 수 없음');
  });

  it('걸 수 있는 물건에는 손가락 자리가 붙는다', () => {
    const pickaxe = lines(empty).find((l) => l.includes('곡괭이'));
    expect(pickaxe).toContain('걸기 ✓ V →');
  });

  it('가방이 가득 차면 풀기가 불가로 보이고 사유가 함께 온다 (IE §15)', () => {
    expect(detail(fullBag, '1.')).toContain('풀기 ✗ 자리 없음');
    expect(detail(worn, '1.')).toContain('풀기 ✓ U → 1');
  });

  it('걸지 않으면 채집이 그 사유로 막힌 것이 보인다 — 코드는 그대로, 문구가 옮겨갔다', () => {
    const mine = plan(empty).interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(false);
    expect(mine?.unavailableText).toBe('채집 도구를 걸지 않았다');
  });
});

describe('VIEW CLOSURE 4 — 화면은 아무것도 판정하지 않는다', () => {
  it('걸린 것도 쓸 수 있다 — C020 이 세운 입구가 자리에서 이어진다', () => {
    expect(detail(worn, '1.')).toContain('쓰기 ✓');
    expect(detail(fullBag, '1.')).toContain('쓰기 ✗');
  });

  it('보태는 값을 몸의 값에 더하지 않는다 — 경위로만 보인다', () => {
    // 화면은 세계가 보낸 몸의 값을 그대로 그린다. contributions 는 "왜 그 값인가" 일 뿐이다.
    const sent = (worn as unknown as GameViewSnapshot).hud.find(
      (h) => h.id === 'self.combat.physicalAttack',
    )?.value;
    expect(line(worn, 'equipment.E1')?.value).toContain('+12');

    // self 패널에 그 수가 그대로 있다 — 12 를 더한 흔적이 없다
    expect(lines(worn).some((l) => l.includes(`물리 공격 ${sent}`))).toBe(true);
    expect(lines(worn).some((l) => l.includes(`물리 공격 ${Number(sent) + 12}`))).toBe(false);
  });

  it('자리 이름을 화면의 조건으로 쓰지 않는다 — 모르는 자리도 그대로 그린다', () => {
    const odd = JSON.parse(JSON.stringify(worn)) as GameViewSnapshot;
    odd.equipment = [
      {
        slotId: 'MAIN-HAND',
        item: { kind: 'unknown-thing', category: 'oddity' },
        grants: ['fly'],
        contributions: [{ name: 'wingspan', value: 3 }],
        actions: [{ id: 'unequip-item', role: 'unequip-item', available: true }],
      },
    ];
    // 표에 없는 자리·종류·용도·능력·분류가 전부 코드 그대로 보이고, 화면은 멈추지 않는다
    expect(line(odd, 'equipment.MAIN-HAND')?.value).toBe('unknown-thing · wingspan +3');
    expect(equipmentSlotIds(plan(odd))).toEqual(['MAIN-HAND']);
    expect(lines(odd).find((l) => l.startsWith('1.'))).toContain('fly');
  });
});
