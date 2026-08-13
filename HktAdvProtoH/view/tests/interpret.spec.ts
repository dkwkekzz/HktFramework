// View 단독 Fixture 테스트 — World 미기동 상태에서 Render 지시 해석만으로 검증한다.
// 핵심 명제 검증 포함: View 는 지시를 그대로 그릴 뿐이며, 미등록 sprite ·
// 생략된 값도 엔진 기본으로 소화한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { interpretGameView } from '../gameview/interpret';
import available from './fixtures/mining-available.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';

describe('interpretGameView (Render 지시 해석)', () => {
  it('mining-available fixture → 지시대로 스프라이트·라벨·프롬프트 구성', () => {
    const scene = interpretGameView(available as GameViewSnapshot);

    expect(scene.entities.map((e) => e.spriteId)).toEqual([
      'player-pickaxe:idle',
      'stone-deposit:available',
    ]);
    const deposit = scene.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.label).toBe('돌 5');
    expect(deposit?.size).toBe(3.4);
    const mine = scene.interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(true);
    expect(mine?.key).toBe('KeyE');
    expect(mine?.prompt).toBe('채굴');
  });

  it('out-of-range fixture → moving variant + 불가 문구 그대로 표시', () => {
    const scene = interpretGameView(outOfRange as GameViewSnapshot);

    expect(scene.entities[0]?.spriteId).toBe('player-pickaxe:moving');
    const mine = scene.interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(false);
    expect(mine?.unavailableText).toContain('멀다');
  });

  it('deposit-depleted fixture → depleted variant + 라벨·HUD 지시 그대로', () => {
    const scene = interpretGameView(depleted as GameViewSnapshot);

    const deposit = scene.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.spriteId).toBe('stone-deposit:depleted');
    expect(deposit?.label).toBe('돌 0');
    const stone = scene.hud.find((h) => h.id === 'inventory.stone');
    expect(stone?.value).toBe(5);
    expect(stone?.label).toBe('Stone');
  });
});

describe('엔진의 유연 대응 — 지시에 없는 값·모르는 값도 소화한다', () => {
  it('미래 Cycle 의 지시(새 sprite 키·생략된 옵션)도 기본값으로 해석된다', () => {
    const snapshot: GameViewSnapshot = {
      specId: 'VIEW-FUTURE-999',
      scene: { terrain: 'cavern' }, // 미제공 지형 — 엔진이 기본 지형으로 대응
      entities: [
        {
          id: 'npc-1',
          position: { x: 1, z: 1 },
          representation: { kind: 'sprite', sprite: 'wandering-merchant' }, // 미등록 sprite
        },
      ],
      interactions: [],
      hud: [{ id: 'currency.gold', widget: 'counter', label: 'Gold', value: 3 }],
    };

    const scene = interpretGameView(snapshot);
    const npc = scene.entities[0];
    expect(npc?.spriteId).toBe('wandering-merchant:default'); // variant 생략 → default
    expect(npc?.size).toBe(2.5); // size 생략 → 엔진 기본값
    expect(npc?.cameraFollow).toBe(false);
    expect(scene.terrain).toBe('cavern'); // 해석은 지시 보존 — 대응은 렌더러 책임
  });

  it('C001 지시가 쓰는 sprite 들은 Asset Registry 에 등록되어 있다', async () => {
    const { REGISTERED_SPRITE_IDS } = await import('../assets/registry');
    for (const id of [
      'player-pickaxe:idle',
      'player-pickaxe:moving',
      'stone-deposit:available',
      'stone-deposit:depleted',
    ]) {
      expect(REGISTERED_SPRITE_IDS).toContain(id);
    }
  });
});
