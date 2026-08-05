import test from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioRunner } from '../src/scenarioRunner.js';
import { organClaimScenario } from '../src/foundationDemo.js';

function newRunner() {
  const runner = new ScenarioRunner();
  runner.register(organClaimScenario);
  return runner;
}

test('같은 시드 두 실행은 동일한 해시 궤적을 낸다 (Foundation 완료 조건 4, SC-C01-V-01 원형)', () => {
  const a = newRunner().run('FD-ORGAN-CLAIM-01', { seed: 7 });
  const b = newRunner().run('FD-ORGAN-CLAIM-01', { seed: 7 });
  assert.ok(a.passed, JSON.stringify(a.checks, null, 2));
  const cmp = ScenarioRunner.compare(a, b);
  assert.ok(cmp.identical);
  assert.equal(a.stateHashAfter, b.stateHashAfter);
});

test('다른 시드는 최초 차이 지점이 보고된다 (SC-C01-V-02 원형)', () => {
  const a = newRunner().run('FD-ORGAN-CLAIM-01', { seed: 7 });
  const b = newRunner().run('FD-ORGAN-CLAIM-01', { seed: 8 });
  const cmp = ScenarioRunner.compare(a, b);
  assert.equal(cmp.identical, false);
  // 최초 차이는 첫 track 굴림 직후 (index 1) — 초기 상태(0)는 같아야 한다
  assert.equal(cmp.firstDivergenceIndex, 1);
  assert.notEqual(cmp.hashA, cmp.hashB);
});

test('검증 실패는 passed=false 로 보고된다 (실패 경로)', () => {
  const runner = new ScenarioRunner();
  runner.register({
    id: 'FD-FAIL-01',
    setup: () => ({ n: 0 }),
    inputs: [1],
    apply: (w) => { w.n += 1; return { events: [] }; },
    snapshot: (w) => w,
    expect: ({ world }) => [{ name: 'n 은 2 여야 함', passed: world.n === 2, detail: `n=${world.n}` }],
  });
  const r = runner.run('FD-FAIL-01');
  assert.equal(r.passed, false);
  assert.equal(r.checks[0].passed, false);
});

test('필드 누락 Scenario 는 등록 거부 (실패 경로)', () => {
  const runner = new ScenarioRunner();
  assert.throws(() => runner.register({ id: 'BAD' }), /필드 누락/);
});
