// Presentation 결정 Layer 단독 테스트 — World 미기동, Semantic Fixture 만으로
// "role/state/값 → 어떻게 그릴지" 결정을 검증한다.
// 핵심 명제 검증 포함: 같은 role 의 결정은 단일 항목이며, 미등록 항목도 기본 결정으로 소화한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../presentation/resolve';
import available from './fixtures/mining-available.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';

describe('resolvePresentation (Semantic → Render Plan)', () => {
  it('mining-available fixture → role 결정대로 sprite·크기·라벨·프롬프트 구성', () => {
    const plan = resolvePresentation(available as GameViewSnapshot);

    expect(plan.entities.map((e) => e.spriteId)).toEqual([
      'player-pickaxe:idle',
      'stone-deposit:available',
    ]);
    const deposit = plan.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.label).toBe('돌 5'); // labelValue 5 → labelFormat 결정
    expect(deposit?.size).toBe(3.4);
    const mine = plan.interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(true);
    expect(mine?.key).toBe('KeyE'); // mine-deposit role 의 입력 결정
    expect(mine?.prompt).toBe('채굴');
    const stone = plan.hud.find((h) => h.id === 'inventory.stone');
    expect(stone?.label).toBe('Stone');
    expect(stone?.icon).toBe('⛏');
  });

  it('out-of-range fixture → moving 스프라이트 + 사유 코드 → 문구 결정', () => {
    const plan = resolvePresentation(outOfRange as GameViewSnapshot);

    expect(plan.entities[0]?.spriteId).toBe('player-pickaxe:moving');
    const mine = plan.interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(false);
    expect(mine?.unavailableText).toContain('멀다');
  });

  it('deposit-depleted fixture → depleted 스프라이트 + 라벨·HUD 결정', () => {
    const plan = resolvePresentation(depleted as GameViewSnapshot);

    const deposit = plan.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.spriteId).toBe('stone-deposit:depleted');
    expect(deposit?.label).toBe('돌 0');
    expect(plan.hud.find((h) => h.id === 'inventory.stone')?.value).toBe(5);
    const mine = plan.interactions.find((i) => i.id === 'mine');
    expect(mine?.unavailableText).toContain('고갈');
  });
});

describe('결정 Layer 의 유연 대응 — 미등록 항목도 기본 결정으로 소화한다', () => {
  it('미래 Cycle 의 semantic(새 role·HUD id·사유 코드)도 기본 결정으로 해석된다', () => {
    const snapshot: GameViewSnapshot = {
      specId: 'VIEW-FUTURE-999',
      scene: 'cavern',
      entities: [
        { id: 'npc-1', role: 'wandering-merchant', state: 'idle', position: { x: 1, z: 1 } },
      ],
      interactions: [
        { id: 'trade', role: 'trade-with', targetEntityId: 'npc-1', available: false, reason: 'no-goods' },
      ],
      hud: [{ id: 'currency.gold', kind: 'counter', value: 3 }],
    };

    const plan = resolvePresentation(snapshot);
    const npc = plan.entities[0];
    expect(npc?.spriteId).toBe('wandering-merchant:idle'); // 기본 결정 — Asset placeholder 폴백
    expect(npc?.size).toBe(2.5); // 엔진 기본 크기
    expect(npc?.cameraFollow).toBe(false);
    expect(plan.hud[0]?.label).toBe('currency.gold'); // 미등록 HUD id → id 그대로
    expect(plan.interactions[0]?.unavailableText).toBe('no-goods'); // 미등록 사유 → 코드 그대로
  });

  it('C001 결정이 참조하는 sprite 들은 Asset Registry 에 등록되어 있다', async () => {
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
