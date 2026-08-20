// C016 Insight World 단독 테스트
// RULE-INSIGHT-REVEAL-001 (ADDED) · RULE-OBSERVE-BEGIN-001 (CHANGED) ·
// RULE-ATTRIBUTE-SET-001 (CHANGED) · 투영 관문 (CHANGED — 자리마다 따로)
//
// Implements INTENT-INSIGHT-001 · INTENT-INSIGHT-OPENS-001 ·
//            INTENT-INSIGHT-NOT-A-GATE-001 · INTENT-INSIGHT-OBSERVE-001 ·
//            INTENT-OBSERVE-KNOWLEDGE-001(CHANGED) · INTENT-UNSEEN-CAPABILITY-001(CHANGED) ·
//            INTENT-OBSERVE-001(CHANGED) · INTENT-OBSERVE-FORGET-001(CHANGED)
//
// 기준 배치 (C013·C015 그대로 — 이 Cycle 은 겨루는 값을 한 톨도 바꾸지 않는다)
//   관찰자 rabbit-swordsman  PhysAtk 40 · Armor 50 · 관통 0 / 60 · 통찰 0
//   자율 존재 wanderer       Armor 30 · Resist 90 · 관통 0 / 0 · 통찰 0
//
// 문턱은 30 · 60 · 90 이다. 기대값은 숫자로 박는다 — 구현을 구현으로 검사하지 않는다.

import { describe, expect, it } from 'vitest';
import type { GameViewSnapshot } from '../../protocol/gameview';
import {
  CONCEALABLE_ATTRIBUTE_KEYS,
  INSIGHT_REVEAL_THRESHOLDS,
} from '../semantic/acquaintance';
import { MUTABLE_ATTRIBUTES } from '../semantic/combat';
import { TICK_INTERVAL } from '../semantic/world-state';
import { driveWorld, observeFully, OBSERVER, OBSERVER_2, PLAYER, type WorldDriver, selectTarget } from './drive';

// 다가오지 않는 자율 존재 — 통찰만 재는 테스트에서는 인지 거리를 0 으로 둔다
const dummyAt = (x: number, z: number, id = 'npc-1') => ({
  id,
  position: { x, z },
  wanderPath: [],
  perceptionRange: 0,
});

const actor = (v: GameViewSnapshot, id: string) => v.entities.find((e) => e.id === id);
const hud = (v: GameViewSnapshot, id: string) => v.hud.find((h) => h.id === id)?.value;
// C017 CHANGED — 살펴봄은 고른 것에 대해 하나만 실린다. 그래서 이 헬퍼는 먼저 고르고
// 그 다음 관찰에서 그 하나를 읽는다 (INTENT-TARGET-DIRECTS-THE-ACT-001).
const observeAfterSelecting = (world: WorldDriver, id: string) => {
  selectTarget(world, id);
  return world.observe().interactions.find((i) => i.id === 'observe');
};

// 값을 바꾸고 세계가 다음 관찰 결과를 내보내게 한다 — 투영은 Tick 마다 만들어진다
const setAttribute = (world: WorldDriver, id: string, value: number, targetEntityId?: string) => {
  const result = world.dispatch({
    interactionId: 'set-attribute',
    ...(targetEntityId ? { targetEntityId } : {}),
    attribute: { id, value },
  });
  world.tick(TICK_INTERVAL);
  return result;
};

/** 내 몸의 통찰을 그 값으로 둔 세계 */
const withInsight = (value: number) => {
  const world = driveWorld({ npcs: [dummyAt(3, 0)] });
  if (value !== 0) setAttribute(world, 'insight', value, PLAYER);
  return world;
};

const concealedOf = (world: WorldDriver, id = 'npc-1', observerId = OBSERVER) =>
  actor(world.observe(observerId), id)?.attributes?.concealed;

describe('INTENT-INSIGHT-001 — 통찰은 몸이 지니는 성질이다', () => {
  it('모든 존재가 통찰을 지니고, 아무도 기르지 않았으므로 0 이다', () => {
    const view = driveWorld({ npcs: [dummyAt(3, 0)] }).observe();

    expect(actor(view, PLAYER)?.attributes?.insight).toBe(0);
    expect(actor(view, 'npc-1')?.attributes?.insight).toBe(0);
  });

  it('내 통찰이 내 자리에도 실린다 — 값을 바꾸면 그 자리에서 바로 읽힌다', () => {
    const world = withInsight(0);
    expect(hud(world.observe(), 'self.insight')).toBe(0);

    setAttribute(world, 'insight', 60, PLAYER);
    expect(hud(world.observe(), 'self.insight')).toBe(60);
  });

  it('통찰은 가려지지 않는다 — 남의 통찰도 이름처럼 그대로 보인다', () => {
    const world = withInsight(0);
    setAttribute(world, 'insight', 45, 'npc-1');

    const npc = actor(world.observe(), 'npc-1');
    // 살펴본 적이 없어 겨루는 힘은 셋 다 가려져 있는데도 통찰은 실린다
    expect(npc?.attributes?.concealed).toEqual(['combatStats', 'versusObserver', 'defenseShape']);
    expect(npc?.attributes?.insight).toBe(45);
    expect(CONCEALABLE_ATTRIBUTE_KEYS).not.toContain('insight');
  });

  it('통찰은 겨루는 일에 닿지 않는다 — 통찰 100 으로 친 한 방이 통찰 0 과 같다', () => {
    // 같은 배치에서 한 번씩 친다. 통찰만 다르고 나머지는 전부 같다
    const strike = (insight: number) => {
      const world = driveWorld({ npcs: [dummyAt(1.5, 0)] });
      world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
      world.tick(TICK_INTERVAL);
      if (insight !== 0) {
        setAttribute(world, 'insight', insight, PLAYER);
        setAttribute(world, 'insight', insight, 'npc-1');
      }
      world.dispatch({ interactionId: 'attack' });
      for (let i = 0; i < 20; i++) world.tick(TICK_INTERVAL);
      return world.observe().strikes.at(-1);
    };

    const blind = strike(0);
    const seeing = strike(100);

    expect(blind?.amount).toBeGreaterThan(0);
    expect(seeing?.amount).toBe(blind?.amount);
    // 경위의 어느 항목에도 통찰이 없다 — 계산은 이 값을 모른다
    expect(seeing?.breakdown).toEqual(blind?.breakdown);
    expect(JSON.stringify(seeing?.breakdown)).not.toContain('insight');
  });
});

describe('INTENT-INSIGHT-OPENS-001 — 통찰이 자리를 연다', () => {
  it('통찰 0 이면 세 자리가 모두 가려진다 — C014 와 한 톨도 다르지 않다', () => {
    const npc = actor(withInsight(0).observe(), 'npc-1');

    expect(npc?.attributes?.acquainted).toBe(false);
    expect(npc?.attributes?.concealed).toEqual(['combatStats', 'versusObserver', 'defenseShape']);
    expect(npc?.attributes?.defenseShape).toBeUndefined();
    expect(npc?.attributes?.versusObserver).toBeUndefined();
    expect(npc?.attributes?.combatStats).toBeUndefined();
  });

  it('통찰 30 이면 형태만 열린다 — 값과 관계는 여전히 가려져 있다', () => {
    const npc = actor(withInsight(30).observe(), 'npc-1');

    expect(npc?.attributes?.concealed).toEqual(['combatStats', 'versusObserver']);
    // C012 의 판정이 그대로 나온다 — 값을 새로 만들지 않는다
    expect(npc?.attributes?.defenseShape).toBe('aura-tougher');
    expect(npc?.attributes?.versusObserver).toBeUndefined();
    expect(npc?.attributes?.combatStats).toBeUndefined();
    // 아직 열 자리가 남았으므로 전부 아는 것은 아니다
    expect(npc?.attributes?.acquainted).toBe(false);
  });

  it('통찰 60 이면 관계까지 열린다 — 수치만 남는다', () => {
    const npc = actor(withInsight(60).observe(), 'npc-1');

    expect(npc?.attributes?.concealed).toEqual(['combatStats']);
    expect(npc?.attributes?.defenseShape).toBe('aura-tougher');
    // C013 의 값이 그대로 나온다 — 관찰자의 오라 관통 60 이 오라 방어 90 을 56.25 로 읽는다
    expect(npc?.attributes?.versusObserver?.armor).toBe(30);
    expect(npc?.attributes?.versusObserver?.resistance).toBeCloseTo(56.25, 10);
    expect(npc?.attributes?.combatStats).toBeUndefined();
  });

  it('통찰 90 이면 살펴보지 않고도 전부 열린다', () => {
    const npc = actor(withInsight(90).observe(), 'npc-1');

    expect(npc?.attributes?.concealed).toEqual([]);
    expect(npc?.attributes?.acquainted).toBe(true);
    // C010·C012·C013·C015 의 값이 그대로다
    expect(npc?.attributes?.combatStats?.armor).toBe(30);
    expect(npc?.attributes?.combatStats?.resistance).toBe(90);
    expect(npc?.attributes?.combatStats?.criticalChance).toBe(0);
  });

  it('문턱 바로 아래에서는 열리지 않는다 — 경계가 값으로 정해져 있다', () => {
    expect(concealedOf(withInsight(29))).toEqual([
      'combatStats',
      'versusObserver',
      'defenseShape',
    ]);
    expect(concealedOf(withInsight(59))).toEqual(['combatStats', 'versusObserver']);
    expect(concealedOf(withInsight(89))).toEqual(['combatStats']);
    expect(concealedOf(withInsight(100))).toEqual([]);
  });

  it('통찰을 내리면 열려 있던 자리가 다시 가려진다 — 지나간 기록이 아니다', () => {
    const world = withInsight(90);
    expect(concealedOf(world)).toEqual([]);

    setAttribute(world, 'insight', 30, PLAYER);
    expect(concealedOf(world)).toEqual(['combatStats', 'versusObserver']);
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats).toBeUndefined();

    setAttribute(world, 'insight', 0, PLAYER);
    expect(concealedOf(world)).toEqual(['combatStats', 'versusObserver', 'defenseShape']);
  });

  it('문턱은 대상을 읽지 않는다 — 두 존재가 같은 통찰에서 똑같이 열린다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0), dummyAt(-3, 0, 'npc-2')] });
    setAttribute(world, 'insight', 60, PLAYER);
    // 한쪽의 방어를 크게 바꿔도 열리는 자리는 같다
    setAttribute(world, 'armor', 100000, 'npc-2');

    expect(concealedOf(world, 'npc-1')).toEqual(['combatStats']);
    expect(concealedOf(world, 'npc-2')).toEqual(['combatStats']);
  });

  it('자기 몸은 통찰과 무관하게 언제나 전부 열려 있다', () => {
    const me = actor(withInsight(0).observe(), PLAYER);

    expect(me?.attributes?.acquainted).toBe(true);
    expect(me?.attributes?.concealed).toEqual([]);
    expect(me?.attributes?.combatStats?.physicalAttack).toBe(40);
  });

  it('열린 값은 베껴 둔 것이 아니다 — 뒤에 상대가 달라지면 달라진 값이 보인다', () => {
    const world = withInsight(90);
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.armor).toBe(30);

    setAttribute(world, 'armor', 10, 'npc-1');
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.armor).toBe(10);
  });

  it('통찰은 보는 이마다 다르다 — 같은 상대 앞에서 서로 다른 만큼 안다', () => {
    const world = driveWorld({ npcs: [dummyAt(3, 0)] });
    world.join(OBSERVER_2);
    world.tick(0.05);
    setAttribute(world, 'insight', 60, PLAYER);

    // 내 몸의 통찰만 올렸다 — 둘째 관찰자의 몸은 그대로 0 이다
    expect(concealedOf(world, 'npc-1', OBSERVER)).toEqual(['combatStats']);
    expect(concealedOf(world, 'npc-1', OBSERVER_2)).toEqual([
      'combatStats',
      'versusObserver',
      'defenseShape',
    ]);
  });
});

describe('INTENT-INSIGHT-NOT-A-GATE-001 — 통찰은 관문이 아니다', () => {
  it('통찰 0 이어도 살펴보면 전부 안다 — 통찰 90 인 몸과 같은 것을 본다', () => {
    const looked = driveWorld({ npcs: [dummyAt(3, 0)] });
    observeFully(looked, 'npc-1');
    const insightful = withInsight(90);

    const a = actor(looked.observe(), 'npc-1')?.attributes;
    const b = actor(insightful.observe(), 'npc-1')?.attributes;

    expect(a?.concealed).toEqual([]);
    expect(a?.combatStats).toEqual(b?.combatStats);
    expect(a?.versusObserver).toEqual(b?.versusObserver);
    expect(a?.defenseShape).toEqual(b?.defenseShape);
  });

  it('통찰 0 으로도 세 스킬과 막기가 그대로 가용하다', () => {
    const world = withInsight(0);
    world.dispatch({ interactionId: 'move', position: { x: 2, z: 0 } });
    world.tick(0.5);
    const view = world.observe();

    for (const id of ['attack', 'skill-heavy', 'guard-begin']) {
      expect(view.interactions.find((i) => i.id === id)?.available).toBe(true);
    }
  });
});

describe('RULE-OBSERVE-BEGIN-001 (CHANGED) — 더 열 자리가 없을 때만 거절된다', () => {
  it('통찰로 일부만 열린 상대는 여전히 살펴볼 수 있다', () => {
    const world = withInsight(60);
    expect(observeAfterSelecting(world, 'npc-1')?.available).toBe(true);
  });

  it('통찰이 세 문턱을 모두 넘으면 처음부터 거절된다 — 사유는 already-known 그대로다', () => {
    const world = withInsight(90);
    const observe = observeAfterSelecting(world, 'npc-1');

    expect(observe?.available).toBe(false);
    expect(observe?.reason).toBe('already-known');
    expect(world.dispatch({ interactionId: 'observe' }).status).toBe('failure');
  });

  it('일부만 열린 상대를 살펴보면 남은 자리가 열린다', () => {
    const world = withInsight(60);
    expect(concealedOf(world)).toEqual(['combatStats']);

    observeFully(world, 'npc-1');

    expect(concealedOf(world)).toEqual([]);
    expect(actor(world.observe(), 'npc-1')?.attributes?.combatStats?.armor).toBe(30);
  });

  it('거리 관문은 그대로다 — 통찰이 높아도 멀면 out-of-range 다', () => {
    const world = driveWorld({ npcs: [dummyAt(40, 0)] });
    setAttribute(world, 'insight', 60, PLAYER);

    expect(observeAfterSelecting(world, 'npc-1')?.reason).toBe('out-of-range');
  });
});

describe('INTENT-OBSERVE-FORGET-001 (CHANGED) — 되돌림은 살펴봄의 결과만 되돌린다', () => {
  it('되돌린 뒤에 남아 있는 자리가 통찰의 몫이다', () => {
    const world = withInsight(60);
    observeFully(world, 'npc-1');
    expect(concealedOf(world)).toEqual([]);

    world.dispatch({ interactionId: 'forget-acquaintance', targetEntityId: 'npc-1' });

    // 셋이 아니다 — 통찰이 연 둘은 그대로 열려 있다
    expect(concealedOf(world)).toEqual(['combatStats']);
    expect(actor(world.observe(), 'npc-1')?.attributes?.defenseShape).toBe('aura-tougher');
  });

  it('통찰이 0 이면 되돌림이 C014 와 똑같이 셋을 다시 가린다', () => {
    const world = withInsight(0);
    observeFully(world, 'npc-1');
    world.dispatch({ interactionId: 'forget-acquaintance', targetEntityId: 'npc-1' });

    expect(concealedOf(world)).toEqual(['combatStats', 'versusObserver', 'defenseShape']);
  });
});

describe('RULE-ATTRIBUTE-SET-001 (CHANGED) — 통찰이 바꿀 수 있는 성질에 들어간다', () => {
  it('세계가 통찰의 범위를 밝힌다', () => {
    const attribute = MUTABLE_ATTRIBUTES.find((a) => a.id === 'insight');

    expect(attribute).toEqual({ id: 'insight', min: 0, max: 100 });
  });

  it('범위 밖의 값은 거절된다 — 세계가 자기 범위를 지킨다', () => {
    const world = withInsight(0);

    expect(setAttribute(world, 'insight', 101, PLAYER).status).toBe('failure');
    expect(setAttribute(world, 'insight', -1, PLAYER).status).toBe('failure');
    expect(concealedOf(world)).toEqual(['combatStats', 'versusObserver', 'defenseShape']);
  });
});

describe('03 BALANCE — 문턱은 하나의 출처에서 온다', () => {
  it('가려질 수 있는 자리마다 문턱이 정확히 하나씩 있다', () => {
    expect(Object.keys(INSIGHT_REVEAL_THRESHOLDS).sort()).toEqual(
      [...CONCEALABLE_ATTRIBUTE_KEYS].sort(),
    );
  });

  it('차례는 형태 → 관계 → 값이다', () => {
    expect(INSIGHT_REVEAL_THRESHOLDS.defenseShape).toBeLessThan(
      INSIGHT_REVEAL_THRESHOLDS.versusObserver,
    );
    expect(INSIGHT_REVEAL_THRESHOLDS.versusObserver).toBeLessThan(
      INSIGHT_REVEAL_THRESHOLDS.combatStats,
    );
  });

  it('세 문턱이 모두 바꿀 수 있는 범위 안에 있다 — 통찰만으로 전부 아는 몸을 만들 수 있다', () => {
    const attribute = MUTABLE_ATTRIBUTES.find((a) => a.id === 'insight')!;

    for (const key of CONCEALABLE_ATTRIBUTE_KEYS) {
      expect(INSIGHT_REVEAL_THRESHOLDS[key]).toBeGreaterThanOrEqual(attribute.min!);
      expect(INSIGHT_REVEAL_THRESHOLDS[key]).toBeLessThanOrEqual(attribute.max!);
    }
  });
});
