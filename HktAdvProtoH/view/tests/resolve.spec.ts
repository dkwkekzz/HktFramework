// Presentation 결정 Layer 단독 테스트 — World 미기동, Semantic Fixture 만으로
// "role/state/값 → 어떻게 그릴지" 결정을 검증한다.
// 핵심 명제 검증 포함: 같은 role 의 결정은 단일 항목이며, 미등록 항목도 기본 결정으로 소화한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../presentation/resolve';
import { createMotionLibrary } from '../motion/motion-library';
import available from './fixtures/mining-available.fixture.json';
import characterAction from './fixtures/character-action.fixture.json';
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

  it('C002 character-action fixture → 종류·행동으로 모션을 고르고, 진행 행동은 1회 재생한다', () => {
    // 주입된 데이터를 흉내낸 Motion Library — 실제 폴더와 무관하게 결정만 검증한다
    const motions = createMotionLibrary({
      '/motions/rabbit-swordsman/idle.3x3.9f.png': '/rabbit-idle.png',
      '/motions/wanderer/move.2x1.png': '/wanderer-move.png',
    });

    const plan = resolvePresentation(characterAction as GameViewSnapshot, motions);

    // 채굴 모션은 없다 → 같은 종류의 idle 로 대체되고, 진행도에 맞춰 1회 재생한다
    const player = plan.entities.find((e) => e.id === 'player');
    expect(player?.motion).toMatchObject({
      url: '/rabbit-idle.png',
      cols: 3,
      frames: 9,
      mode: 'progress',
      progress: 0.5,
    });
    expect(player?.cameraFollow).toBe(true);

    // 소요 시간이 없는 행동은 반복 재생
    const npc1 = plan.entities.find((e) => e.id === 'npc-1');
    expect(npc1?.motion).toMatchObject({ url: '/wanderer-move.png', mode: 'loop' });

    // 데이터가 전혀 없는 (kind, action) → 절차 생성 그림으로 그린다
    const deposit = plan.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.motion).toBeUndefined();
    expect(deposit?.spriteId).toBe('stone-deposit:available');

    // 행동 상태 HUD — 코드가 문구로, 진행도가 함께 전달된다
    const action = plan.hud.find((h) => h.id === 'player.action');
    expect(action).toMatchObject({ widget: 'label', label: '행동', value: '채굴', progress: 0.5 });

    // 공격 interaction 은 대상별로 키·프롬프트·사유가 결정된다
    const attacks = plan.interactions.filter((i) => i.id === 'attack');
    expect(attacks).toHaveLength(2);
    expect(attacks[0]?.key).toBe('KeyF');
    expect(attacks[0]?.prompt).toBe('공격');
    expect(attacks[0]?.unavailableText).toContain('멀다');
    expect(attacks[1]?.unavailableText).toContain('행동이 끝나야');
  });

  it('모션 데이터가 하나도 없어도 모든 entity 가 그려진다 (placeholder 폴백)', () => {
    const plan = resolvePresentation(characterAction as GameViewSnapshot, createMotionLibrary({}));

    expect(plan.entities.every((e) => e.motion === undefined)).toBe(true);
    expect(plan.entities.map((e) => e.spriteId)).toEqual([
      'player-pickaxe:mine',
      'wanderer:move',
      'wanderer:attack',
      'stone-deposit:available',
    ]);
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

  it('결정이 참조하는 sprite 들은 Asset Registry 에 등록되어 있다', async () => {
    const { REGISTERED_SPRITE_IDS } = await import('../assets/registry');
    for (const id of [
      'player-pickaxe:idle',
      'player-pickaxe:moving',
      'player-pickaxe:move',
      'player-pickaxe:attack',
      'player-pickaxe:mine',
      'wanderer:idle',
      'wanderer:move',
      'wanderer:attack',
      'stone-deposit:available',
      'stone-deposit:depleted',
    ]) {
      expect(REGISTERED_SPRITE_IDS).toContain(id);
    }
  });
});
