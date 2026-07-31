import { describe, expect, it } from 'vitest';
import { VS0_MODULES, runVS0 } from './vs0.js';

/**
 * VS0 — 결정적 세계 변화 (원문 「20」).
 *
 * 완료 조건 네 줄을 그대로 옮겨 확인한다. 이 슬라이스가 통과해야 G6 통합 게이트가 열리고,
 * V0~V4 와 K0~K3 이 `LAB_PASS` 를 넘어설 수 있다 (원문 「5」·「23」).
 */

const report = runVS0();

describe('VS0 결정적 세계 변화', () => {
  it('아홉 모듈을 모두 지난다', () => {
    expect([...new Set(report.checks.map((check) => check.module))].sort()).toEqual([...VS0_MODULES].sort());
  });

  it('Given-When-Then 장면이 통과한다 (V3)', () => {
    const failed = report.scenario.conditions.filter((condition) => !condition.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(report.scenario.passed).toBe(true);
  });

  it.each(report.checks.map((check) => [`${check.module}/${check.id}`, check] as const))(
    '%s',
    (_id, check) => {
      expect(check.passed, check.detail).toBe(true);
    },
  );

  it('완료 조건 ① 에너지 결과가 1이다', () => {
    const energy = report.scenario.final['energy'];
    expect(energy).toBe(1);
  });

  it('완료 조건 ② 네 번째 행동은 상태를 전혀 변경하지 않는다', () => {
    const fourth = report.scenario.transitions[3];
    expect(fourth?.after['storeHash']).toBe(fourth?.before['storeHash']);
    expect(fourth?.after['changedByLastStep']).toBe(false);
  });

  it('완료 조건 ③ 모든 변화가 사건 로그에 남는다', () => {
    expect(report.scenario.final['eventCount']).toBe(3);
    expect(report.checks.find((check) => check.id === 'every_change_has_an_event')?.passed).toBe(true);
  });

  it('완료 조건 ④ 재생 결과가 동일하다', () => {
    expect(report.checks.find((check) => check.id === 'replay_is_identical')?.passed).toBe(true);
  });

  it('슬라이스 전체가 통과한다', () => {
    const failed = report.checks.filter((check) => !check.passed);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
    expect(report.passed).toBe(true);
  });

  it('다시 실행해도 같은 결과다 (GI-12)', () => {
    expect(runVS0().digest).toBe(report.digest);
  });
});
