// blank 팩 스모크 검증 (P5) — 분리의 수용 기준.
//
// engine/ 무수정으로 두 번째 팩이 커널 위에서 뜨고 움직인다는 것을 상시 증명한다.
// proto-adventure 의 어떤 파일도 import 하지 않는다 (팩 간 격리 — boundary 규칙 2).

import { describe, expect, it } from 'vitest';
import { resolvePresentation } from '../../view/index';
import { createWorld, SPEC_ID } from '../index';

const A = 'blank-observer-a';
const B = 'blank-observer-b';

describe('P5 — engine 무수정으로 blank 팩이 뜬다', () => {
  it('관찰자가 들어오면 몸이 생기고 관찰 결과가 나온다', () => {
    const world = createWorld();
    world.join(A);
    world.tick(0);

    const snapshot = world.latestObservation(A);
    expect(snapshot?.specId).toBe(SPEC_ID);
    expect(snapshot?.observer.characterId).toBe('walker-1');
    expect(snapshot?.entities[0]?.role).toBe('player-character');
    expect(snapshot?.interactions[0]).toMatchObject({ id: 'move', available: true });
  });

  it('이동 요청이 받아들여지고 자리가 실제로 바뀐다', () => {
    const world = createWorld();
    world.join(A);
    world.tick(0);

    world.request(A, { interactionId: 'move', position: { x: 4, z: 0 } });
    const { results } = world.tick(0);
    expect(results[0]).toEqual({ status: 'success', rule: 'RULE-BLANK-WALK-001' });

    for (let i = 0; i < 60; i++) world.tick(1 / 30);
    const self = world.latestObservation(A)?.entities.find((e) => e.id === 'walker-1');
    expect(self?.position.x).toBeCloseTo(4);
    expect(self?.state).toBe('idle'); // 도착했다
  });

  it('엔진의 관찰자 인과가 그대로 작동한다 — 재참여·모르는 관찰자·다중 관찰', () => {
    const world = createWorld();
    world.join(A);
    world.join(B);
    world.tick(0);

    // 관찰자마다 자기 몸 — 투영도 관찰자마다 다르다
    expect(world.latestObservation(A)?.observer.characterId).toBe('walker-1');
    expect(world.latestObservation(B)?.observer.characterId).toBe('walker-2');

    // 모르는 관찰자의 요청은 아무것도 바꾸지 못한다 (엔진 불변식)
    world.request('낯선 사람', { interactionId: 'move', position: { x: 1, z: 1 } });
    const { results } = world.tick(0);
    expect(results[0]).toMatchObject({ status: 'failure', reason: 'unknown-observer' });

    // 재참여해도 몸이 늘지 않는다
    world.join(A);
    world.tick(0);
    expect(world.latestObservation(A)?.entities).toHaveLength(2);
  });

  it('빈 결정 Layer 로도 Render Plan 이 나온다 — placeholder 와 봉투가 받아 준다', () => {
    const world = createWorld();
    world.join(A);
    world.tick(0);

    const scene = resolvePresentation(world.latestObservation(A)!);
    expect(scene.terrain).toBe('blank-field');
    expect(scene.entities[0]?.cameraFollow).toBe(true);
    expect(scene.interactions.find((i) => i.id === 'move')?.terrainTarget).toBe(true);
    expect(scene.commandSurface.entries.map((e) => e.origin)).toContain('observer');
  });
});
