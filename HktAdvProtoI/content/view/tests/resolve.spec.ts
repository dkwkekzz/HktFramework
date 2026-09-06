// Presentation 결정 Layer 단독 테스트 — World 미기동, Semantic Fixture 만으로
// "role/state/값 → 어떻게 그릴지" 결정을 검증한다.
// 핵심 명제 검증 포함: 같은 role 의 결정은 단일 항목이며, 미등록 항목도 기본 결정으로 소화한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../resolve';
import { createMotionLibrary } from '../../../engine/view-kernel/motion/motion-library';
import available from './fixtures/mining-available.fixture.json';
import characterAction from './fixtures/character-action.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';
import twoObservers from './fixtures/two-observers.fixture.json';

describe('resolvePresentation (Semantic → Render Plan)', () => {
  it('mining-available fixture → role 결정대로 sprite·크기·프롬프트 구성', () => {
    const plan = resolvePresentation(available as GameViewSnapshot);

    // C011 CHANGED — 자연 형태(kind)가 그림을 고른다 (spriteByKind)
    expect(plan.entities.map((e) => e.spriteId)).toEqual([
      'player-pickaxe:idle',
      'source:molt-litter:available',
    ]);
    const source = plan.entities.find((e) => e.id === 'MOLT_LITTER');
    // 라벨이 없다 — 세계 위에 글자가 없다 (C026 RULE-QUIET-GROUND-001)
    expect(source?.label).toBeUndefined();
    expect(source?.size).toBe(3.4);
    const mine = plan.interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(true);
    expect(mine?.key).toBe('KeyE'); // harvest-source role 의 입력 결정
    expect(mine?.prompt).toBe('채취');
    // HUD 는 재료의 **이름**을 말한다. 아이콘은 주지 않는다 —
    // 이 Play 는 재료 표식을 만들지 않는다 (Play 확정 8)
    const molt = plan.hud.find((h) => h.id === 'inventory.ORE_EATER_MOLT');
    expect(molt?.label).toBe('광식충 허물');
    expect(molt?.icon).toBeUndefined();
  });

  it('character-action fixture → 종류·행동으로 모션을 고르고, 진행 행동은 1회 재생한다', () => {
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
    const source = plan.entities.find((e) => e.id === 'MOLT_LITTER');
    expect(source?.motion).toBeUndefined();
    expect(source?.spriteId).toBe('source:molt-litter:available');

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

  it('되돌아오지 않는다고 선언한 시트는 1회 재생이다 — 쓰러진 몸이 다시 일어서지 않는다', () => {
    // 쓰러짐(downed)에는 소요 시간이 없다 (world/semantic/action.ts: duration null).
    // 그래서 진행도가 이끌지 못하고, 시트가 스스로 밝힌 once 만이 반복을 막는다.
    const motions = createMotionLibrary({
      '/motions/wanderer/idle.3x3.9f.png': '/wanderer-idle.png',
      '/motions/wanderer/downed.3x3.9f.8fps.once.png': '/wanderer-downed.png',
    });

    const snapshot: GameViewSnapshot = {
      specId: 'VIEW-WORLD-SERVER-001',
      scene: 'mining-field',
      region: { id: 'mining-field', hash: '00000000' },
      standingConditions: [], // C006 ADDED
      entities: [
        { id: 'npc-1', role: 'npc-character', state: 'downed', kind: 'wanderer', position: { x: 1, z: 1 } },
        { id: 'npc-2', role: 'npc-character', state: 'idle', kind: 'wanderer', position: { x: 2, z: 2 } },
      ],
      interactions: [],
      observer: { id: 'observer-a', characterId: 'npc-2', acknowledgedMark: 0 },
      hud: [],
      strikes: [],
      debug: { open: false },
      commands: [],
    };

    const plan = resolvePresentation(snapshot, motions);

    const downed = plan.entities.find((e) => e.id === 'npc-1');
    expect(downed?.motion).toMatchObject({ url: '/wanderer-downed.png', mode: 'once' });

    // 같은 시트 규약을 쓰는 다른 행동은 그대로 반복한다 — once 는 시트가 밝힌 것만이다.
    const alive = plan.entities.find((e) => e.id === 'npc-2');
    expect(alive?.motion).toMatchObject({ url: '/wanderer-idle.png', mode: 'loop' });
  });

  it('모션 데이터가 하나도 없어도 모든 entity 가 그려진다 (placeholder 폴백)', () => {
    const plan = resolvePresentation(characterAction as GameViewSnapshot, createMotionLibrary({}));

    expect(plan.entities.every((e) => e.motion === undefined)).toBe(true);
    expect(plan.entities.map((e) => e.spriteId)).toEqual([
      'player-pickaxe:mine',
      'wanderer:move',
      'wanderer:attack',
      'wanderer:hit',
      'source:molt-litter:available',
    ]);
  });

  it('out-of-range fixture → moving 스프라이트 + 사유 코드 → 문구 결정', () => {
    const plan = resolvePresentation(outOfRange as GameViewSnapshot);

    expect(plan.entities[0]?.spriteId).toBe('player-pickaxe:moving');
    const mine = plan.interactions.find((i) => i.id === 'mine');
    expect(mine?.available).toBe(false);
    expect(mine?.unavailableText).toContain('멀다');
  });

  // C011 — 고갈된 원천의 fixture 는 걷었다. 이 Cycle 의 원천은 캐도 줄지 않고 phase 가 없다
  // (spec Out of Scope). 고갈의 외형과 문구는 C012 가 phase 와 함께 세운다.
});

describe('다중 관찰자 — 내 몸과 남의 몸을 화면에서 가른다', () => {
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

    expect(plan.hud.find((h) => h.id === 'inventory.ORE_EATER_MOLT')?.value).toBe(2);
    expect(plan.hud.filter((h) => h.id === 'inventory.ORE_EATER_MOLT')).toHaveLength(1);
  });
});

describe('결정 Layer 의 유연 대응 — 미등록 항목도 기본 결정으로 소화한다', () => {
  it('미래 Cycle 의 semantic(새 role·HUD id·사유 코드)도 기본 결정으로 해석된다', () => {
    const snapshot: GameViewSnapshot = {
      specId: 'VIEW-FUTURE-999',
      scene: 'cavern',
      region: { id: 'cavern', hash: '00000000' },
      standingConditions: [], // C006 ADDED
      entities: [
        { id: 'npc-1', role: 'wandering-merchant', state: 'idle', position: { x: 1, z: 1 } },
      ],
      interactions: [
        { id: 'trade', role: 'trade-with', targetEntityId: 'npc-1', available: false, reason: 'no-goods' },
      ],
      observer: { id: 'observer-a', characterId: 'npc-1', acknowledgedMark: 0 },
      hud: [{ id: 'currency.gold', kind: 'counter', value: 3 }],
      strikes: [],
      debug: { open: false }, commands: [],
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
      'source:outcrop:available',
      'source:root-nodule:available',
      'source:molt-litter:available',
      'source:spoil-pile:available',
    ]) {
      expect(REGISTERED_SPRITE_IDS).toContain(id);
    }
  });
});
