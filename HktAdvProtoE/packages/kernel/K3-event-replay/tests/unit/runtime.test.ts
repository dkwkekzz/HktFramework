import { describe, expect, it } from 'vitest';
import { ComponentRegistry } from '@hkt/k0-entity-state';
import { RuleBook } from '@hkt/k2-rule-transaction';
import { DeltaError, WorldRuntime, affectedEntities, applyStateDelta, buildWorld, resimulate } from '../../src/index.js';
import { COMPONENT_DEFINITIONS, RULES, SHRINE_CANYON, TEMPLATES } from '../../scenarios/fixtures.js';

const registry = ComponentRegistry.of(COMPONENT_DEFINITIONS);
const world = { components: COMPONENT_DEFINITIONS, operations: SHRINE_CANYON };
const rules = RuleBook.of(RULES);

function runtime(): WorldRuntime {
  return new WorldRuntime({
    store: buildWorld(world),
    rules,
    worldSeed: '20260730',
    templates: TEMPLATES,
  });
}

const strike = (id: string) => ({ id, actor: 'hunter_a', verb: 'strike', targets: ['beast_ka'] });

describe('사건 로그', () => {
  it('성공한 의도는 사건을 남긴다', () => {
    const world0 = runtime();
    const result = world0.submit(strike('i0'));
    expect(result.accepted).toBe(true);
    expect(world0.log()).toHaveLength(1);
    expect(result.event?.appliedRuleIds).toEqual(['l1_strike']);
    expect(result.event?.affectedEntityIds).toEqual(['beast_ka', 'hunter_a']);
  });

  it('거부된 의도는 사건을 남기지 않는다', () => {
    const world0 = runtime();
    const result = world0.submit({ id: 'i0', actor: 'hunter_a', verb: 'sing' });
    expect(result.accepted).toBe(false);
    expect(result.event).toBeNull();
    expect(world0.log()).toEqual([]);
  });

  it('거부된 의도도 일지에는 남는다', () => {
    const world0 = runtime();
    world0.submit({ id: 'i0', actor: 'hunter_a', verb: 'sing' });
    expect(world0.journal()).toHaveLength(1);
  });

  it('사건 id 는 다시 굴려도 같다', () => {
    const first = runtime();
    const second = runtime();
    first.submit(strike('i0'));
    second.submit(strike('i0'));
    expect(first.log()[0]?.id).toBe(second.log()[0]?.id);
    expect(first.log()[0]?.id).toMatch(/^event_[0-9a-f]{12}$/);
  });

  it('사건 해시는 로그 전체를 담는다', () => {
    const world0 = runtime();
    const before = world0.logHash();
    world0.submit(strike('i0'));
    expect(world0.logHash()).not.toBe(before);
  });
});

describe('시간과 예약', () => {
  it('틱은 앞으로만 간다', () => {
    const world0 = runtime();
    expect(world0.tick).toBe(0);
    world0.advance();
    expect(world0.tick).toBe(1);
  });

  it('예약은 선언한 틱에 일어난다', () => {
    const world0 = runtime();
    world0.submit({ id: 'p0', actor: 'hunter_a', verb: 'pray', targets: ['border_shrine'] });
    expect(world0.pending()).toHaveLength(1);
    expect(world0.pending()[0]?.fireAtTick).toBe(3);

    world0.advance();
    world0.advance();
    expect(world0.log()).toHaveLength(1);
    world0.advance();
    expect(world0.log()).toHaveLength(2);
    expect(world0.log()[1]?.appliedRuleIds).toEqual(['l4_blessing']);
    expect(world0.pending()).toEqual([]);
  });

  it('예약 사건은 자기를 만든 사건을 원인으로 적는다', () => {
    const world0 = runtime();
    world0.submit({ id: 'p0', actor: 'hunter_a', verb: 'pray', targets: ['border_shrine'] });
    for (let step = 0; step < 3; step += 1) world0.advance();
    expect(world0.log()[1]?.causeEventIds).toEqual([world0.log()[0]?.id]);
  });

  it('모르는 예약 본체는 조용히 넘어가지 않는다', () => {
    const bare = new WorldRuntime({ store: buildWorld(world), rules, worldSeed: '1' });
    bare.submit({ id: 'p0', actor: 'hunter_a', verb: 'pray', targets: ['border_shrine'] });
    expect(() => {
      for (let step = 0; step < 3; step += 1) bare.advance();
    }).toThrow(/E_UNKNOWN_EVENT_TEMPLATE/);
  });
});

describe('스냅샷', () => {
  it('되살리면 해시가 같다', () => {
    const world0 = runtime();
    world0.submit(strike('i0'));
    world0.advance();
    const snapshot = world0.snapshot();
    expect(WorldRuntime.restore(snapshot, rules, registry, TEMPLATES).snapshot().hash).toBe(snapshot.hash);
  });

  it('ID 순번까지 되살아나 사건 id 가 겹치지 않는다', () => {
    const world0 = runtime();
    world0.submit(strike('i0'));
    const resumed = WorldRuntime.restore(world0.snapshot(), rules, registry, TEMPLATES);
    resumed.submit(strike('i1'));
    world0.submit(strike('i1'));
    expect(resumed.log()[1]?.id).toBe(world0.log()[1]?.id);
    expect(resumed.log()[1]?.id).not.toBe(resumed.log()[0]?.id);
  });

  it('예약 대기열도 함께 되살아난다', () => {
    const world0 = runtime();
    world0.submit({ id: 'p0', actor: 'hunter_a', verb: 'pray', targets: ['border_shrine'] });
    const resumed = WorldRuntime.restore(world0.snapshot(), rules, registry, TEMPLATES);
    expect(resumed.pending()).toEqual([...world0.pending()]);
  });
});

describe('재생', () => {
  it('로그만으로 최종 상태를 다시 만든다', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    world0.submit({ id: 'i1', actor: 'hunter_a', verb: 'rest' });
    expect(world0.replayFromLog(initial).hash()).toBe(world0.store.hash());
  });

  it('일지를 다시 굴리면 같은 사건이 나온다', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    world0.advance();
    world0.submit({ id: 'i1', actor: 'hunter_a', verb: 'pray', targets: ['border_shrine'] });
    for (let step = 0; step < 4; step += 1) world0.advance();

    const again = resimulate(initial, world0.journal(), {
      rules,
      worldSeed: '20260730',
      templates: TEMPLATES,
      untilTick: world0.tick,
    });
    expect(again.logHash()).toBe(world0.logHash());
    expect(again.store.hash()).toBe(world0.store.hash());
  });
});

describe('감사', () => {
  it('정상 세계는 통과한다', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    const report = world0.audit(initial);
    expect(report.violations).toEqual([]);
    expect(report.everyChangeHasAnEvent).toBe(true);
    expect(report.logIsAppendOnly).toBe(true);
  });

  it('사건 없이 상태를 고치면 잡는다 (GI-01)', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    const tampered = WorldRuntime.restore(
      { ...world0.snapshot(), store: world0.store.setComponent('hunter_a', 'energy', { current: 42 }).snapshot() },
      rules,
      registry,
      TEMPLATES,
    );
    expect(tampered.audit(initial).violations.map((violation) => violation.code)).toEqual([
      'E_UNEXPLAINED_STATE_CHANGE',
    ]);
  });

  it('사건 id 가 겹치면 잡는다', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    const event = world0.log()[0];
    const doubled = WorldRuntime.restore(
      { ...world0.snapshot(), log: [event as NonNullable<typeof event>, event as NonNullable<typeof event>] },
      rules,
      registry,
      TEMPLATES,
    );
    const codes = doubled.audit(initial).violations.map((violation) => violation.code);
    expect(codes).toContain('E_DUPLICATE_EVENT_ID');
  });

  it('틱이 뒤로 간 로그를 잡는다', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    world0.advance();
    world0.submit(strike('i1'));
    const reversed = WorldRuntime.restore(
      { ...world0.snapshot(), log: [...world0.log()].reverse() },
      rules,
      registry,
      TEMPLATES,
    );
    expect(reversed.audit(initial).violations.map((violation) => violation.code)).toContain(
      'E_LOG_NOT_APPEND_ONLY',
    );
  });

  it('재시뮬레이션이 갈라지면 잡는다', () => {
    const initial = buildWorld(world);
    const world0 = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    world0.submit(strike('i0'));
    const other = new WorldRuntime({ store: initial, rules, worldSeed: '20260730', templates: TEMPLATES });
    other.submit({ id: 'i0', actor: 'hunter_a', verb: 'rest' });
    expect(world0.audit(initial, other).violations.map((violation) => violation.code)).toContain(
      'E_REPLAY_MISMATCH',
    );
  });
});

describe('델타 되짚기', () => {
  it('컴포넌트 필드를 되짚는다', () => {
    const store = buildWorld(world);
    const next = applyStateDelta(store, {
      path: 'entity/hunter_a/components/energy/current',
      op: 'add',
      before: 10,
      after: 4,
    });
    expect(next.component('hunter_a', 'energy')).toEqual({ current: 4 });
  });

  it('태그를 되짚는다', () => {
    const store = buildWorld(world);
    const next = applyStateDelta(store, {
      path: 'entity/hunter_a/tags',
      op: 'attach_tag',
      before: ['human', 'hunter'],
      after: ['human', 'hunter', 'sworn'],
    });
    expect(next.get('hunter_a')?.tags).toEqual(['human', 'hunter', 'sworn']);
  });

  it('되짚을 수 없는 경로는 조용히 넘어가지 않는다', () => {
    expect(() => applyStateDelta(buildWorld(world), { path: 'nowhere', op: 'set', before: null, after: 1 })).toThrow(
      DeltaError,
    );
  });

  it('건드린 실체를 델타에서 뽑는다', () => {
    expect(
      affectedEntities([
        { path: 'entity/b/components/health/current', op: 'add', before: 1, after: 0 },
        { path: 'entity/a/tags', op: 'attach_tag', before: [], after: ['x'] },
        { path: 'entity/a/components/energy/current', op: 'add', before: 1, after: 0 },
      ]),
    ).toEqual(['a', 'b']);
  });
});
