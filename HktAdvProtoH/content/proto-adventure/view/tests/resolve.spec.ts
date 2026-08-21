// Presentation 결정 Layer 단독 테스트 — World 미기동, Semantic Fixture 만으로
// "role/state/값 → 어떻게 그릴지" 결정을 검증한다.
// 핵심 명제 검증 포함: 같은 role 의 결정은 단일 항목이며, 미등록 항목도 기본 결정으로 소화한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { createMotionLibrary } from '../../../../engine/view-kernel/motion/motion-library';
import available from './fixtures/mining-available.fixture.json';
import characterAction from './fixtures/character-action.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';
import twoObservers from './fixtures/two-observers.fixture.json';

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
    // C020 CHANGED — 돌 전용 칸이 사라지고 소지품 목록이 그 자리를 대신한다.
    // 라벨의 칸 번호는 화면의 결정이고, 종류 이름은 문구 표에서 온다.
    const stone = plan.hud.find((h) => h.id === 'inventory.stone');
    expect(stone?.label).toBe('1. 돌');
    expect(stone?.icon).toBe('🪨');
    expect(stone?.value).toBe(2);
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

    // 되돌아오지 않는 상태 — 시트가 once 를 선언했으면 반복하지 않는다.
    // 세계는 아무것도 다르게 보내지 않는다 (쓰러짐도 소요 시간이 없는 상태다).
    const downedMotions = createMotionLibrary({
      '/motions/wanderer/downed.3x3.9f.once.png': '/wanderer-downed.png',
    });
    const downedSnapshot = structuredClone(characterAction) as GameViewSnapshot;
    const fallen = downedSnapshot.entities.find((e) => e.id === 'npc-1')!;
    fallen.state = 'downed';
    const fallenPlan = resolvePresentation(downedSnapshot, downedMotions);
    expect(fallenPlan.entities.find((e) => e.id === 'npc-1')?.motion).toMatchObject({
      url: '/wanderer-downed.png',
      mode: 'once',
    });

    // 데이터가 전혀 없는 (kind, action) → 절차 생성 그림으로 그린다
    const deposit = plan.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.motion).toBeUndefined();
    expect(deposit?.spriteId).toBe('stone-deposit:available');

    // 행동 상태 HUD — 코드가 문구로, 진행도가 함께 전달된다
    const action = plan.hud.find((h) => h.id === 'player.action');
    expect(action).toMatchObject({ widget: 'label', label: '행동', value: '채굴', progress: 0.5 });

    // 공격은 대상이 없는 하나다 — 키·프롬프트·사유만 결정된다
    const attacks = plan.interactions.filter((i) => i.id === 'attack');
    expect(attacks).toHaveLength(1);
    expect(attacks[0]?.targetEntityId).toBeUndefined();
    expect(attacks[0]?.key).toBe('KeyF');
    expect(attacks[0]?.prompt).toBe('공격');
    expect(attacks[0]?.unavailableText).toContain('행동이 끝나야');

    // 맞은 캐릭터도 같은 계약으로 그려진다
    const struck = plan.entities.find((e) => e.id === 'npc-3');
    expect(struck?.motion).toBeUndefined(); // wanderer/hit 시트는 없다
    expect(struck?.spriteId).toBe('wanderer:hit');
  });

  it('모션 데이터가 하나도 없어도 모든 entity 가 그려진다 (placeholder 폴백)', () => {
    const plan = resolvePresentation(characterAction as GameViewSnapshot, createMotionLibrary({}));

    expect(plan.entities.every((e) => e.motion === undefined)).toBe(true);
    expect(plan.entities.map((e) => e.spriteId)).toEqual([
      'player-pickaxe:mine',
      'wanderer:move',
      'wanderer:attack',
      'wanderer:hit',
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
    // C020 — 다 캐고 난 소지품은 목록에서 읽는다. 값은 그대로 5 다.
    expect(plan.hud.find((h) => h.id === 'inventory.stone')?.value).toBe(5);
    // 안 되는 이유가 소지품 자리에도 그대로 뜬다 — 세계가 준 사유를 옮길 뿐이다
    expect(plan.hud.find((h) => h.id === 'inventory.pickaxe.use')?.value).toBe('광맥이 고갈되었다');
    const mine = plan.interactions.find((i) => i.id === 'mine');
    expect(mine?.unavailableText).toContain('고갈');
  });
});

describe('C004 다중 관찰자 — 내 몸과 남의 몸을 화면에서 가른다', () => {
  it('two-observers fixture → 내 몸만 카메라가 따라가고 남의 몸은 색으로 구분된다', () => {
    const plan = resolvePresentation(twoObservers as GameViewSnapshot);

    const mine = plan.entities.find((e) => e.id === 'player-1');
    const other = plan.entities.find((e) => e.id === 'player-2');

    expect(mine?.cameraFollow).toBe(true);
    expect(mine?.tint).toBeUndefined(); // 내 몸은 원래 색
    expect(other?.cameraFollow).toBe(false); // 카메라가 따라가는 것은 내 몸 하나뿐이다
    expect(other?.tint).toBe(0xffd9a0);
    expect(other?.spriteId).toBe('player-pickaxe:move'); // 같은 시트를 쓴다
  });

  it('조종하는 이가 없는 몸은 탈색되고 자리 비움이 표시된다', () => {
    const plan = resolvePresentation(twoObservers as GameViewSnapshot);

    const unattended = plan.entities.find((e) => e.id === 'player-3');
    expect(unattended?.tint).toBe(0x6b6b6b);
    expect(unattended?.label).toBe('자리 비움');

    // 조종되는 중인 몸에는 그 표시가 없다
    expect(plan.entities.find((e) => e.id === 'player-2')?.label).toBeUndefined();
  });

  it('함께 보고 있는 사람의 수가 HUD 로 표시된다', () => {
    const plan = resolvePresentation(twoObservers as GameViewSnapshot);

    const observers = plan.hud.find((h) => h.id === 'observers.present');
    expect(observers?.label).toBe('함께');
    expect(observers?.value).toBe('2명');
  });

  it('나만의 것은 내 몸의 것으로 표시된다 — 남의 소지품은 애초에 오지 않는다', () => {
    const plan = resolvePresentation(twoObservers as GameViewSnapshot);

    // C020 CHANGED — 남의 소지품이 오지 않는다는 의미는 그대로다. 읽는 자리만 바뀌었다:
    // 지니지 않은 종류는 **항목 자체가 없다** (0 이라는 줄도 없다).
    expect(plan.hud.filter((h) => h.id === 'inventory.stone')).toHaveLength(0);
    expect(plan.hud.find((h) => h.id === 'inventory.none')?.value).toBe('없음');
  });
});

describe('결정 Layer 의 유연 대응 — 미등록 항목도 기본 결정으로 소화한다', () => {
  it('미래 Cycle 의 semantic(새 role·HUD id·사유 코드)도 기본 결정으로 해석된다', () => {
    const snapshot: GameViewSnapshot = {
      specId: 'VIEW-FUTURE-999',
      scene: 'cavern',
      inventory: [],
      inventoryRoom: { used: 0, capacity: 4 },
      entities: [
        { id: 'npc-1', role: 'wandering-merchant', state: 'idle', position: { x: 1, z: 1 } },
      ],
      interactions: [
        { id: 'trade', role: 'trade-with', targetEntityId: 'npc-1', available: false, reason: 'no-goods' },
      ],
      observer: { id: 'observer-a', characterId: 'npc-1', acknowledgedMark: 0 },
      hud: [{ id: 'currency.gold', kind: 'counter', value: 3 }],
      strikes: [],
      contacts: [],
      cancels: [],
      debug: { open: false }, commands: [],
      currentTarget: {},
    };

    const plan = resolvePresentation(snapshot);
    const npc = plan.entities[0];
    expect(npc?.spriteId).toBe('wandering-merchant:idle'); // 기본 결정 — Asset placeholder 폴백
    expect(npc?.size).toBe(2.5); // 엔진 기본 크기
    expect(npc?.cameraFollow).toBe(false);
    // C017 — hud 앞에 고른 대상 자리가 온다 (여기서는 "없음")
    expect(plan.hud[0]?.id).toBe('target.none');
    // C020 — 그 뒤에 소지품 자리가 온다 (이 화면은 아무것도 지니지 않았다)
    // C022 — 자리 줄이 그 앞에 하나 붙는다
    expect(plan.hud[1]?.id).toBe('inventory.room');
    expect(plan.hud[2]?.id).toBe('inventory.none');
    expect(plan.hud[3]?.label).toBe('currency.gold'); // 미등록 HUD id → id 그대로
    expect(plan.interactions[0]?.unavailableText).toBe('no-goods'); // 미등록 사유 → 코드 그대로
  });

  it('결정이 참조하는 sprite 들은 Asset Registry 에 등록되어 있다', async () => {
    const { REGISTERED_SPRITE_IDS } = await import('../sprites');
    for (const id of [
      'player-pickaxe:idle',
      'player-pickaxe:moving',
      'player-pickaxe:move',
      'player-pickaxe:attack',
      'player-pickaxe:mine',
      'wanderer:idle',
      'wanderer:move',
      'wanderer:attack',
      'wanderer:hit',
      'player-pickaxe:hit',
      'stone-deposit:available',
      'stone-deposit:depleted',
    ]) {
      expect(REGISTERED_SPRITE_IDS).toContain(id);
    }
  });
});
