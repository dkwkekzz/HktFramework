import { describe, expect, it } from 'vitest';
import { FixtureLoader } from '../../src/fixture.js';
import { ScenarioRunner } from '../../src/runner.js';
import type { JsonObject, ScenarioSpec } from '../../src/types.js';

const fixture = {
  id: 'scene',
  title: '에너지 10',
  state: { actor: { energy: 10 }, log: [] } as JsonObject,
};

function runner(): ScenarioRunner {
  return new ScenarioRunner({ fixtures: new FixtureLoader().add(fixture) });
}

const base: ScenarioSpec = {
  id: 'scene_run',
  title: '기본',
  given: { fixture: 'scene' },
  when: [{ step: 'consume', params: { path: '/actor/energy', amount: 3 } }],
  then: [{ id: 'energy', path: '/actor/energy', op: 'equals', value: 7 }],
};

describe('실행 전 거부', () => {
  it('모르는 픽스처를 지목한다', () => {
    const issues = runner().preflight({ ...base, given: { fixture: 'none' } });
    expect(issues[0]).toMatchObject({ code: 'E_UNKNOWN_FIXTURE', path: '/given/fixture' });
  });

  it('모르는 단계를 when 인덱스로 지목한다', () => {
    const issues = runner().preflight({ ...base, when: [{ step: 'teleport' }] });
    expect(issues[0]).toMatchObject({ code: 'E_UNKNOWN_STEP', path: '/when/0/step' });
  });

  it('잘못된 params 를 필드까지 지목한다 (V1 스키마)', () => {
    const issues = runner().preflight({
      ...base,
      when: [{ step: 'consume', params: { path: '/actor/energy', amount: -1 } }],
    });
    expect(issues[0]?.path).toBe('/when/0/params/amount');
  });

  it('없는 params 필드를 지목한다', () => {
    const issues = runner().preflight({ ...base, when: [{ step: 'consume', params: {} }] });
    expect(issues.map((issue) => issue.path).sort()).toEqual([
      '/when/0/params/amount',
      '/when/0/params/path',
    ]);
  });

  it('조건이 없는 시나리오를 거부한다', () => {
    expect(runner().preflight({ ...base, then: [] }).map((issue) => issue.code)).toContain('E_THEN_EMPTY');
  });

  it('중복 조건 id 를 거부한다', () => {
    const issues = runner().preflight({
      ...base,
      then: [
        { id: 'x', path: '/actor/energy', op: 'present' },
        { id: 'x', path: '/log', op: 'present' },
      ],
    });
    expect(issues.map((issue) => issue.code)).toContain('E_DUPLICATE_CONDITION_ID');
  });

  it('거부된 명세는 한 단계도 굴리지 않는다', () => {
    const report = runner().run({ ...base, when: [{ step: 'teleport' }] });
    expect(report.transitions).toEqual([]);
    expect(report.conditions).toEqual([]);
    expect(report.passed).toBe(false);
  });

  it('거부 목록은 경로 오름차순으로 고정된다', () => {
    const issues = runner().preflight({
      ...base,
      when: [{ step: 'teleport' }, { step: 'nowhere' }],
      then: [{ id: 'x', path: 'bad', op: 'present' }],
    });
    expect(issues.map((issue) => issue.path)).toEqual([...issues.map((issue) => issue.path)].sort());
  });
});

describe('실행', () => {
  it('단계마다 전후와 변경 경로를 남긴다', () => {
    const report = runner().run(base);
    expect(report.transitions).toHaveLength(1);
    expect(report.transitions[0]?.changes).toEqual([
      { path: '/actor/energy', kind: 'changed', before: 10, after: 7 },
    ]);
    expect(report.passed).toBe(true);
  });

  it('거부된 단계는 상태를 전혀 바꾸지 않는다', () => {
    const report = runner().run({
      ...base,
      when: [{ step: 'consume', params: { path: '/actor/energy', amount: 30 } }],
      then: [{ id: 'energy', path: '/actor/energy', op: 'equals', value: 10 }],
    });
    expect(report.transitions[0]?.rejection?.code).toBe('E_INSUFFICIENT');
    expect(report.transitions[0]?.changes).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('단계가 터지면 그 자리에서 멈춘다', () => {
    const report = runner().run({
      ...base,
      when: [{ step: 'fail', params: { message: '버그' } }, { step: 'consume', params: { path: '/actor/energy', amount: 3 } }],
      then: [{ id: 'energy', path: '/actor/energy', op: 'equals', value: 10 }],
    });
    expect(report.stoppedAt).toBe(0);
    expect(report.transitions).toHaveLength(1);
    expect(report.transitions[0]?.error?.code).toBe('E_STEP_FAILED');
    // 조건은 통과했지만 도중에 멈춘 보고를 통과로 보지 않는다
    expect(report.conditions[0]?.passed).toBe(true);
    expect(report.passed).toBe(false);
  });

  it('Given 상태는 실행 뒤에도 그대로다', () => {
    const report = runner().run(base);
    expect((report.given['actor'] as JsonObject)['energy']).toBe(10);
    expect((report.final['actor'] as JsonObject)['energy']).toBe(7);
  });

  it('같은 명세를 여러 번 굴려도 같은 보고가 나온다', () => {
    const first = runner().run(base);
    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect(runner().run(base).digest).toBe(first.digest);
    }
  });

  it('시드 구성요소가 하나만 달라도 시드가 갈라진다', () => {
    const a = runner().run({ ...base, seed: { worldSeed: '1', subjectId: 'a' } });
    const b = runner().run({ ...base, seed: { worldSeed: '1', subjectId: 'b' } });
    expect(a.seed).not.toBe(b.seed);
  });

  it('제목만 바뀐 명세는 같은 digest 를 낸다 — 리플레이는 일어난 일만 본다', () => {
    expect(runner().run({ ...base, title: '다른 제목' }).digest).toBe(runner().run(base).digest);
  });

  it('단계별 하위 난수 스트림은 뒤에 단계를 덧붙여도 밀리지 않는다', () => {
    const rollOnly: ScenarioSpec = {
      ...base,
      when: [{ step: 'roll', params: { path: '/actor/energy', min: 0, max: 1000 } }],
      then: [{ id: 'energy', path: '/actor/energy', op: 'present' }],
    };
    const first = runner().run(rollOnly);
    const extended = runner().run({
      ...rollOnly,
      when: [...rollOnly.when, { step: 'append', params: { path: '/log', value: 'x' } }],
    });
    expect((extended.transitions[0]?.after['actor'] as JsonObject)['energy']).toBe(
      (first.transitions[0]?.after['actor'] as JsonObject)['energy'],
    );
  });

  it('등록된 단계 목록을 오름차순으로 알려 준다', () => {
    expect(runner().stepIds()).toEqual([
      'add',
      'append',
      'consume',
      'fail',
      'record_event',
      'remove',
      'roll',
      'set',
    ]);
  });

  it('같은 id 의 다른 단계 구현은 등록을 거부한다', () => {
    expect(() =>
      runner().register({ id: 'consume', title: '가짜', apply: (state) => state }),
    ).toThrow(/이미 다른 구현/);
  });
});
