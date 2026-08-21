// C019 통합 실측 — 진짜 World 를 굴린 관찰 결과를 진짜 View 결정 Layer 에 통과시킨다.
// Fixture 가 아니다: 세계 → 계약 → 화면 결정이 한 줄로 이어지는지 본다 (08 PLAYABLE 근거).

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import { resolvePresentation } from '../../view/resolve';
import { SKILL_DEFINITIONS } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, PLAYER, type WorldDriver } from './drive';

const HEAVY = SKILL_DEFINITIONS['heavy-attack'];
const WHOLE_STAGE = { center: { x: 0, z: 0 }, radius: 40 };

const facing = {
  actorPosition: { x: 0, z: 0 },
  npcs: [
    {
      id: 'npc-1',
      position: { x: 1.6, z: 0 },
      wanderPath: [],
      perceptionRange: 9,
      guardedGround: WHOLE_STAGE,
    },
  ],
};

const tickFor = (world: WorldDriver, seconds: number) => {
  const steps = Math.ceil(seconds / TICK_INTERVAL);
  for (let i = 0; i < steps; i++) world.tick(TICK_INTERVAL);
};

const plateOf = (view: GameViewSnapshot, id: string) =>
  resolvePresentation(view, undefined, {}).entities.find((e) => e.id === id)?.nameplate?.name;

describe('C019 통합 — 세계에서 나온 값이 화면 결정까지 이어진다', () => {
  it('자율 존재가 큰 기술의 선딜에 들면 그 몸 위에 표시가 뜬다', () => {
    const world = driveWorld(facing);
    const steps = Math.ceil(8 / TICK_INTERVAL);
    let seen = false;
    for (let i = 0; i < steps && !seen; i++) {
      world.tick(TICK_INTERVAL);
      const view = world.observe();
      const npc = view.entities.find((e) => e.id === 'npc-1');
      if (npc?.state === 'heavy-attack' && npc.actionPhase === 'startup') {
        expect(plateOf(view, 'npc-1')).toContain('준비!');
        seen = true;
      }
    }
    expect(seen).toBe(true);
  });

  it('그 존재가 판정 구간에 들어서면 표시가 사라진다 — 늦었다는 것이 화면에서 읽힌다', () => {
    const world = driveWorld(facing);
    const steps = Math.ceil(8 / TICK_INTERVAL);
    for (let i = 0; i < steps; i++) {
      world.tick(TICK_INTERVAL);
      const npc = world.observe().entities.find((e) => e.id === 'npc-1');
      if (npc?.state === 'heavy-attack' && npc.actionPhase === 'active') {
        expect(plateOf(world.observe(), 'npc-1')).not.toContain('준비!');
        return;
      }
    }
    throw new Error('큰 기술이 판정 구간에 이르지 못했다');
  });

  it('내 큰 기술이 선딜에서 끊기면 화면에 끊김이 뜬다', () => {
    const world = driveWorld(facing);
    world.dispatch({ interactionId: 'skill-heavy' });
    tickFor(world, HEAVY.baseDuration + 4 * TICK_INTERVAL);

    const view = world.observe();
    expect(view.cancels.length).toBeGreaterThan(0);
    const marks = resolvePresentation(view, undefined, {}).strikes;
    const cut = marks.find((m) => m.text.includes('끊김'));
    expect(cut?.text).toContain('강공격');
    expect(cut?.emphasis).toBe(true);
  });
});
