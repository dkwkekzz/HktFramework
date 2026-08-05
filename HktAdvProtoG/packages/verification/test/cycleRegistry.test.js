import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CycleRegistry, validateCycleSpec } from '../src/cycleRegistry.js';
import { ModuleContractRegistry } from '../src/contracts.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const cycleSpec = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/CYCLE.json`, 'utf8'));
const wiring = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/REGISTRY.json`, 'utf8'));

function registerC01() {
  const reg = new CycleRegistry();
  reg.registerCycle(cycleSpec);
  for (const sc of wiring.scenarios) reg.attachScenario('C01', sc);
  reg.attachSteps('C01', wiring.moduleSteps, {
    externalArtifacts: wiring.externalArtifacts,
    terminalArtifacts: wiring.terminalArtifacts,
  });
  return reg;
}

test('C01 계약이 스키마 검증을 통과하고 등록된다 (Foundation 완료 조건 1)', () => {
  assert.deepEqual(validateCycleSpec(cycleSpec), []);
  const reg = new CycleRegistry();
  assert.equal(reg.registerCycle(cycleSpec), 'C01');
});

test('Situation·Scenario 연결과 Step 의존성 검사 — cycle:lint 골격 통과 (조건 2·3)', () => {
  const reg = registerC01();
  const lint = reg.lint('C01');
  assert.deepEqual(lint.errors, [], `lint 오류: ${lint.errors.join(' | ')}`);
  assert.deepEqual(lint.warnings, [], `lint 경고: ${lint.warnings.join(' | ')}`);
  assert.equal(lint.modulesCovered.length, 14);
  assert.equal(lint.stepCount, 19);
  assert.ok(lint.scenarioCount >= 31);
});

test('필수 필드 없는 Cycle 은 등록 거부 (실패 경로)', () => {
  const reg = new CycleRegistry();
  assert.throws(() => reg.registerCycle({ id: 'BAD', title: 'x' }), /필수 필드/);
});

test('미지 Situation 참조 Scenario 는 거부 (실패 경로)', () => {
  const reg = new CycleRegistry();
  reg.registerCycle(cycleSpec);
  assert.throws(() => reg.attachScenario('C01', { id: 'SC-X', situationId: 'ST-NOPE' }), /미지 Situation/);
});

test('생산자 없는 소비는 의존성 오류다 (실패 경로)', () => {
  const mcr = new ModuleContractRegistry();
  mcr.registerStep({ id: 'S1', module: 'D', mode: 'CREATE', consumes: ['ghost-artifact'], produces: ['x'] });
  mcr.registerTerminalArtifacts(['x']);
  const { errors } = mcr.checkDependencies();
  assert.equal(errors.length, 1);
  assert.match(errors[0], /생산자 없는 소비/);
});

test('모듈 Step 누락은 lint 오류다 — SKIP 금지 (실패 경로)', () => {
  const reg = new CycleRegistry();
  reg.registerCycle(cycleSpec);
  reg.attachScenario('C01', wiring.scenarios[0]);
  reg.attachSteps('C01', [wiring.moduleSteps[0]], {
    externalArtifacts: wiring.externalArtifacts,
    terminalArtifacts: wiring.terminalArtifacts,
  });
  const lint = reg.lint('C01');
  assert.ok(lint.errors.some((e) => e.includes('모듈 Step 누락')));
});
