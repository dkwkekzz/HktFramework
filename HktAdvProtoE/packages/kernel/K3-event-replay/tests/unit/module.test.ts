import { describe, expect, it } from 'vitest';
import { createK3Module, executeK3, validateInput, validateOutput } from '../../src/module.js';
import { k3Scenarios } from '../../scenarios/index.js';
import { COMPONENT_DEFINITIONS, DRIVER_CANDIDATES, RULES, SHRINE_CANYON, TEMPLATES } from '../../scenarios/fixtures.js';
import eventSchema from '../../schemas/k3-world-event.schema.json';
import snapshotSchema from '../../schemas/k3-world-snapshot.schema.json';

const input = {
  world: { components: COMPONENT_DEFINITIONS, operations: SHRINE_CANYON },
  rules: RULES,
  worldSeed: '20260730',
  templates: TEMPLATES,
  driver: { candidates: DRIVER_CANDIDATES, ticks: 30 },
};

describe('executeK3', () => {
  it('굴리고 재생하고 감사한다', () => {
    const output = executeK3(input);
    expect(output.finalTick).toBe(30);
    expect(output.events.length).toBeGreaterThan(0);
    expect(output.replayedStoreHash).toBe(output.storeHash);
    expect(output.resimulatedLogHash).toBe(output.logHash);
    expect(output.snapshotHash).toBe(output.restoredSnapshotHash);
    expect(output.audit.violations).toEqual([]);
  });

  it('같은 입력이면 같은 digest 다', () => {
    expect(executeK3(input).digest).toBe(executeK3(input).digest);
  });

  it('세계 시드가 다르면 다른 세계가 나온다', () => {
    expect(executeK3({ ...input, worldSeed: '20260731' }).logHash).not.toBe(executeK3(input).logHash);
  });

  it('손으로 적은 의도도 받는다', () => {
    const output = executeK3({
      ...input,
      driver: undefined as never,
      intents: [{ tick: 1, intent: { id: 'i0', actor: 'hunter_a', verb: 'strike', targets: ['beast_ka'] } }],
    });
    expect(output.events).toHaveLength(1);
  });
});

describe('validateInput', () => {
  it('굴릴 것이 없으면 거부한다', () => {
    expect(() => validateInput({ world: { operations: [] }, rules: [], worldSeed: '1' })).toThrow(/intents/);
  });

  it('worldSeed 는 10진 정수 문자열이어야 한다', () => {
    expect(() => validateInput({ world: { operations: [] }, rules: [], worldSeed: 'x', driver: {} })).toThrow(
      /worldSeed/,
    );
  });

  it('driver 는 후보와 틱 수를 가져야 한다', () => {
    expect(() =>
      validateInput({ world: { operations: [] }, rules: [], worldSeed: '1', driver: { candidates: [], ticks: 1 } }),
    ).toThrow(/candidates/);
    expect(() =>
      validateInput({ world: { operations: [] }, rules: [], worldSeed: '1', driver: { candidates: [{}], ticks: 0 } }),
    ).toThrow(/ticks/);
  });
});

describe('validateOutput', () => {
  const output = executeK3(input);

  it('정상 출력에는 위반이 없다', () => {
    expect(validateOutput(output)).toEqual([]);
  });

  it('로그 재생이 어긋나면 잡는다 (GI-01)', () => {
    expect(
      validateOutput({ ...output, replayedStoreHash: 'sha256:x' }).map((issue) => issue.code),
    ).toContain('E_INVARIANT_every_state_change_must_have_a_causing_event');
  });

  it('재시뮬레이션이 어긋나면 잡는다 (GI-12)', () => {
    expect(validateOutput({ ...output, resimulatedLogHash: 'sha256:x' }).map((issue) => issue.code)).toContain(
      'E_INVARIANT_resimulation_must_reproduce_identical_events',
    );
  });

  it('스냅샷 왕복이 어긋나면 잡는다', () => {
    expect(validateOutput({ ...output, restoredSnapshotHash: 'sha256:x' }).map((issue) => issue.code)).toContain(
      'E_INVARIANT_snapshot_restore_must_equal_the_original',
    );
  });

  it('변화 없는 사건이 로그에 있으면 잡는다', () => {
    const first = output.events[0] as (typeof output.events)[number];
    expect(
      validateOutput({ ...output, events: [{ ...first, stateDelta: [] }] }).map((issue) => issue.code),
    ).toContain('E_INVARIANT_every_state_change_must_have_a_causing_event');
  });

  it('사건 id 가 겹치면 잡는다', () => {
    const first = output.events[0] as (typeof output.events)[number];
    expect(validateOutput({ ...output, events: [first, first] }).map((issue) => issue.code)).toContain(
      'E_INVARIANT_event_id_must_be_deterministic',
    );
  });
});

describe('모듈 정의', () => {
  const module = createK3Module(k3Scenarios);

  it('원문 「3.2」의 형태를 갖춘다', () => {
    expect(module.id).toBe('K3');
    expect(module.dependencies).toEqual(['V0', 'V2', 'K0', 'K1', 'K2']);
    expect(module.purpose.split(/[.。]\s+/).filter((part) => part.trim() !== '').length).toBe(1);
  });
});

describe('스키마 문서', () => {
  /**
   * V1 로 실제 컴파일하는 일은 저장소 규약 검사가 모든 모듈에 대해 한다. K3 은 V1 을 선행으로
   * 두지 않으므로(원문 「9」), 여기서는 스키마가 실제 산출물과 같은 모양을 말하는지만 본다.
   */
  it('사건 스키마의 필수 항목이 실제 사건과 같다', () => {
    const event = executeK3(input).events[0] as unknown as Record<string, unknown>;
    expect((eventSchema.required as string[]).slice().sort()).toEqual(Object.keys(event).sort());
  });

  it('스냅샷 스키마의 필수 항목이 실제 스냅샷과 같다', () => {
    expect(snapshotSchema.required).toEqual([
      'worldSeed',
      'tick',
      'store',
      'log',
      'pending',
      'journal',
      'ids',
      'clock',
      'hash',
    ]);
  });

  it('사건 id 형식을 스키마도 같이 말한다', () => {
    expect(eventSchema.properties.id.pattern).toBe('^event_[0-9a-f]{12}$');
  });
});
