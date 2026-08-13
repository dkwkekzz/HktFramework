// View 단독 Fixture 테스트 — World 미기동 상태에서 Spec 해석만으로 검증한다.
//
// 마지막 묶음이 이 엔진의 목표다: C001 과 아무 상관 없는 world 를 줘도 명세대로 그린다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { PLACEHOLDER_SPRITE } from '../assets/registry';
import { interpretGameView } from '../gameview/interpret';
import {
  entityInteraction,
  groundInteraction,
  keyInteraction,
  requestWithPoint,
} from '../input/input';
import available from './fixtures/mining-available.fixture.json';
import depleted from './fixtures/deposit-depleted.fixture.json';
import outOfRange from './fixtures/out-of-range.fixture.json';
import unknownWorld from './fixtures/unknown-world.fixture.json';

const snapshot = (fixture: unknown) => fixture as GameViewSnapshot;

describe('interpretGameView — C001 Fixture', () => {
  it('mining-available fixture → 채굴 가능 상태 표현', () => {
    const scene = interpretGameView(snapshot(available));

    expect(scene.entities.map((e) => e.spriteId)).toEqual([
      'player-character:idle',
      'resource-deposit:available',
    ]);
    expect(scene.entities.some((e) => e.placeholder)).toBe(false);
    expect(scene.prompts).toEqual([{ text: '[E] 채굴', available: true }]);
    expect(entityInteraction(scene.interactions, 'deposit-1')?.id).toBe('mine');
  });

  it('out-of-range fixture → moving 스프라이트 + 명세가 준 사유 문구', () => {
    const scene = interpretGameView(snapshot(outOfRange));

    expect(scene.entities[0]?.spriteId).toBe('player-character:moving');
    expect(scene.prompts).toEqual([
      { text: '광맥이 너무 멀다 — 가까이 이동하자', available: false },
    ]);
  });

  it('deposit-depleted fixture → depleted 스프라이트 + 잔량 라벨 + 고갈 문구', () => {
    const scene = interpretGameView(snapshot(depleted));

    expect(scene.entities[1]?.spriteId).toBe('resource-deposit:depleted');
    expect(scene.entities[1]?.label).toBe('돌 0');
    expect(scene.hud.items[0]?.value).toBe(5);
    expect(scene.prompts[0]?.text).toBe('광맥이 고갈되었다');
  });
});

describe('interpretGameView — 처음 보는 world', () => {
  const scene = interpretGameView(snapshot(unknownWorld));

  it('모르는 역할도 멈추지 않고 대체 표현으로 그린다', () => {
    expect(scene.entities).toHaveLength(3);
    expect(scene.entities.map((e) => e.id)).toEqual(['trader', 'airship-7', 'crate']);
    expect(scene.entities.every((e) => e.spriteId === PLACEHOLDER_SPRITE)).toBe(true);
    expect(scene.entities.every((e) => e.placeholder)).toBe(true);
  });

  it('무대·라벨·초점을 명세 그대로 따른다', () => {
    expect(scene.scene).toBe('sky-market');
    expect(scene.entities.find((e) => e.focus)?.id).toBe('trader');
    expect(scene.entities.find((e) => e.id === 'airship-7')?.label).toBe('정박 중');
  });

  it('처음 보는 HUD 항목과 안내 문구를 그대로 표현한다', () => {
    expect(scene.hud.items.map((i) => `${i.label}: ${i.value}`)).toEqual([
      'Coin: 12',
      '평판: 신뢰 없음',
    ]);
    expect(scene.prompts).toEqual([
      { text: '[F] 흥정', available: true },
      { text: '길드 봉인이 걸려 있다', available: false },
    ]);
  });

  it('처음 보는 상호작용도 명세가 준 Request 를 그대로 보낸다', () => {
    expect(keyInteraction(scene.interactions, 'f')?.id).toBe('haggle');
    expect(entityInteraction(scene.interactions, 'crate')?.id).toBe('open');

    const ground = groundInteraction(scene.interactions);
    expect(ground?.id).toBe('walk');
    expect(requestWithPoint(ground!, { x: 3, z: -2 })).toEqual({
      type: 'move',
      target: { x: 3, z: -2 },
    });
  });
});
