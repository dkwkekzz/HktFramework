// View 단독 Fixture 테스트 — World 미기동 상태에서 Spec 해석만으로 검증한다.
// 핵심 명제 검증 포함: 미등록 role/사유/HUD id 도 엔진이 기본 형식으로 소화한다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { hudTraits } from '../engine/hud-registry';
import { interactionTraits } from '../engine/interaction-registry';
import { roleTraits } from '../engine/role-registry';
import { interpretGameView } from '../gameview/interpret';
import { reasonText } from '../hud/reason-text';
import available from './fixtures/mining-available.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';

describe('interpretGameView (범용 해석)', () => {
  it('mining-available fixture → 채굴 가능 상태 표현', () => {
    const scene = interpretGameView(available as GameViewSnapshot);

    expect(scene.entities.map((e) => e.spriteId)).toEqual([
      'player-character:idle',
      'resource-deposit:available',
    ]);
    const mine = scene.interactions.find((i) => i.role === 'mine-deposit');
    expect(mine?.available).toBe(true);
    expect(mine?.targetEntityId).toBe('deposit-1');
  });

  it('out-of-range fixture → moving 스프라이트 + 사유 코드 → 문구', () => {
    const scene = interpretGameView(outOfRange as GameViewSnapshot);

    expect(scene.entities[0]?.spriteId).toBe('player-character:moving');
    const mine = scene.interactions.find((i) => i.role === 'mine-deposit');
    expect(mine?.available).toBe(false);
    expect(mine?.reason).toBe('out-of-range');
    expect(reasonText('out-of-range')).toContain('멀다');
  });

  it('deposit-depleted fixture → depleted 스프라이트 + 라벨 값 + 획득 불가 사유', () => {
    const scene = interpretGameView(depleted as GameViewSnapshot);

    const deposit = scene.entities.find((e) => e.id === 'deposit-1');
    expect(deposit?.spriteId).toBe('resource-deposit:depleted');
    expect(deposit?.labelValue).toBe(0);
    const stone = scene.hud.find((h) => h.id === 'inventory.stone');
    expect(stone?.value).toBe(5);
    expect(reasonText('deposit-depleted')).toContain('고갈');
  });
});

describe('엔진의 "그대로 그린다" 성질 — 미등록 항목도 소화한다', () => {
  it('미등록 role 의 entity 도 spriteId 가 만들어지고 기본 특성으로 그려진다', () => {
    const snapshot: GameViewSnapshot = {
      specId: 'VIEW-FUTURE-999',
      scene: 'mining-field',
      entities: [
        { id: 'npc-1', role: 'wandering-merchant', state: 'idle', position: { x: 1, z: 1 } },
      ],
      interactions: [],
      hud: [{ id: 'currency.gold', kind: 'counter', value: 3 }],
    };

    const scene = interpretGameView(snapshot);
    expect(scene.entities[0]?.spriteId).toBe('wandering-merchant:idle');
    expect(roleTraits('wandering-merchant').scale).toBeGreaterThan(0); // 기본 특성
    expect(hudTraits('currency.gold').label).toBe('currency.gold'); // 기본 라벨
    expect(interactionTraits('unknown-role')).toEqual({}); // 바인딩 없음 — 에러 없음
    expect(reasonText('unknown-reason')).toBe('unknown-reason'); // 코드 그대로
  });

  it('C001 fixture 의 role 들은 Registry 에 등록되어 있다', () => {
    expect(roleTraits('player-character').cameraFollow).toBe(true);
    expect(roleTraits('resource-deposit').labelFormat?.(4)).toBe('돌 4');
    expect(interactionTraits('mine-deposit').key).toBe('KeyE');
    expect(interactionTraits('move-to').terrainTarget).toBe(true);
    expect(hudTraits('inventory.stone').label).toBe('Stone');
  });
});
