import { describe, expect, it } from 'vitest';
import { createV2Module, executeV2, validateInput, validateOutput } from '../../src/module.js';
import { v2Scenarios } from '../../scenarios/index.js';

const BASE = { worldSeed: '1', draws: 4, idKinds: ['event'], ticks: 2, forks: ['a'] };

describe('executeV2', () => {
  it('요청한 만큼 뽑는다', () => {
    const output = executeV2({ ...BASE, draws: 6 });
    expect(output.floats).toHaveLength(6);
    expect(output.ints).toHaveLength(6);
    expect(output.ids).toHaveLength(1);
    expect(output.timeline).toHaveLength(2);
    expect(output.forkSamples).toHaveLength(1);
  });

  it('아무것도 요청하지 않아도 시드는 나온다', () => {
    const output = executeV2({ worldSeed: '1', draws: 0 });
    expect(output.floats).toEqual([]);
    expect(output.ids).toEqual([]);
    expect(output.seed).toMatch(/^[0-9a-f]{1,16}$/);
    expect(validateOutput(output)).toEqual([]);
  });

  it('같은 입력이면 digest 가 같다', () => {
    expect(executeV2(BASE).digest).toBe(executeV2(BASE).digest);
  });

  it('입력 객체를 바꾸지 않는다', () => {
    const input = { ...BASE, idKinds: ['event', 'entity'] };
    const snapshot = JSON.stringify(input);
    executeV2(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('digest 는 내용이 바뀌면 달라진다', () => {
    expect(executeV2({ ...BASE, draws: 5 }).digest).not.toBe(executeV2(BASE).digest);
  });
});

describe('validateInput', () => {
  it('올바른 입력은 통과한다', () => {
    expect(validateInput(BASE)).toBe(BASE);
    expect(validateInput({ worldSeed: '-5', draws: 0 })).toBeTruthy();
  });

  const badInputs: [label: string, input: unknown][] = [
    ['객체가 아님', null],
    ['배열', []],
    ['worldSeed 없음', { draws: 1 }],
    ['worldSeed 가 숫자', { worldSeed: 1, draws: 1 }],
    ['worldSeed 가 10진수가 아님', { worldSeed: '0x10', draws: 1 }],
    ['draws 없음', { worldSeed: '1' }],
    ['draws 가 음수', { worldSeed: '1', draws: -1 }],
    ['draws 가 실수', { worldSeed: '1', draws: 1.5 }],
    ['draws 가 한도 초과', { worldSeed: '1', draws: 100001 }],
    ['components 가 배열', { worldSeed: '1', draws: 1, components: [] }],
    ['components 에 모르는 항목', { worldSeed: '1', draws: 1, components: { nope: 1 } }],
    ['tick 이 음수', { worldSeed: '1', draws: 1, components: { tick: -1 } }],
    ['subjectId 가 숫자', { worldSeed: '1', draws: 1, components: { subjectId: 3 } }],
    ['idKinds 가 문자열', { worldSeed: '1', draws: 1, idKinds: 'event' }],
    ['idKinds 에 빈 문자열', { worldSeed: '1', draws: 1, idKinds: [''] }],
    ['ticks 가 실수', { worldSeed: '1', draws: 1, ticks: 0.5 }],
    ['msPerTick 이 0', { worldSeed: '1', draws: 1, msPerTick: 0 }],
  ];

  it.each(badInputs)('잘못된 입력은 거부한다 (%s)', (_label, input) => {
    expect(() => validateInput(input)).toThrow(TypeError);
  });
});

describe('validateOutput', () => {
  it('정상 출력은 위반이 없다', () => {
    expect(validateOutput(executeV2(BASE))).toEqual([]);
  });

  it('조작된 digest 를 잡는다', () => {
    const output = { ...executeV2(BASE), digest: 'sha256:0'.padEnd(71, '0') };
    expect(validateOutput(output).map((issue) => issue.code)).toEqual([
      'E_INVARIANT_digest_must_match_body',
    ]);
  });

  it('범위를 벗어난 값을 잡는다', () => {
    const base = executeV2(BASE);
    expect(
      validateOutput({ ...base, floats: [1.5, ...base.floats] }).map((issue) => issue.code),
    ).toContain('E_INVARIANT_float_must_be_unit_interval');
    expect(
      validateOutput({ ...base, ints: [100, ...base.ints] }).map((issue) => issue.code),
    ).toContain('E_INVARIANT_int_must_be_in_range');
  });

  it('중복 id 를 잡는다', () => {
    const base = executeV2(BASE);
    const forged = { ...base, ids: ['event_aaaaaaaaaaaa', 'event_aaaaaaaaaaaa'] };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_id_must_be_unique_within_run',
    );
  });

  it('뒤로 가는 시계를 잡는다', () => {
    const base = executeV2({ ...BASE, ticks: 3 });
    const forged = {
      ...base,
      timeline: [
        { tick: 2, timeMs: 200 },
        { tick: 1, timeMs: 100 },
      ],
    };
    expect(validateOutput(forged).map((issue) => issue.code)).toContain(
      'E_INVARIANT_clock_must_advance_monotonically',
    );
  });
});

describe('ModuleDefinition', () => {
  const module = createV2Module(v2Scenarios);

  it('계약대로의 정체성을 갖는다', () => {
    expect(module.id).toBe('V2');
    expect(module.dependencies).toEqual(['V0']);
    expect(module.purpose).not.toBe('');
    expect(module.scenarios).toHaveLength(v2Scenarios.length);
  });

  it('execute 는 문맥의 시드를 쓰지 않는다 — 시드는 입력에서 나온다', () => {
    const first = module.execute(BASE, { moduleId: 'V2', seed: 1n, tick: 0 });
    const second = module.execute(BASE, { moduleId: 'V2', seed: 999n, tick: 50 });
    expect(second.digest).toBe(first.digest);
  });
});
