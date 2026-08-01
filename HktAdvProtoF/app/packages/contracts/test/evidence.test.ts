// V4 완료 증거 단위 테스트 — status 는 산출물이 정한다.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildEvidence,
  buildRegistry,
  canPromote,
  evidenceHash,
  formatDashboard,
  isFresh,
  readContract,
  type Evidence,
  type EvidenceInput,
  type ModuleContract,
} from '../src/index.ts';
import { loadContractSources, loadEvidence } from '../src/load.ts';
import { parseYaml } from '../src/yaml.ts';

const contractsDir = new URL('../', import.meta.url);
const evidenceDir = new URL('../evidence/', import.meta.url);

function input(overrides: Partial<EvidenceInput> = {}): EvidenceInput {
  return {
    module: 'X-example',
    sourceHash: 'aaaaaaaaaaaaaaaa',
    unitTests: { result: 'passed', total: 5, passed: 5 },
    propertyTests: 'passed',
    labScenarios: 'manual',
    scenarios: {
      total: 3,
      passed: 3,
      failed: 0,
      coverageComplete: true,
      byId: { 'x-normal': 'passed', 'x-failure': 'passed', 'x-boundary': 'passed' },
    },
    replayHash: 'bbbbbbbbbbbbbbbb',
    ...overrides,
  };
}

const CONTRACT_TEXT = [
  'id: X',
  'name: example-module',
  'purpose: 완료를 주장하는 계약이다.',
  'inputs: [A]',
  'outputs: [B]',
  'depends: []',
  'scenarios: [x-normal, x-failure, x-boundary]',
  'status: VERIFIED',
  'evidence: evidence/X.json',
  '',
].join('\n');

function contract(text = CONTRACT_TEXT): ModuleContract {
  const { contract: parsed } = readContract(parseYaml(text), 'X.yaml');
  assert.ok(parsed !== null);
  return parsed;
}

describe('증거 생성', () => {
  test('전부 통과하면 VERIFIED', () => {
    const evidence = buildEvidence(input());
    assert.equal(evidence.status, 'VERIFIED');
    assert.deepEqual(evidence.blockers, []);
    assert.equal(evidence.integrationScenario, 'passed');
  });

  test('산출물이 하나라도 무너지면 VERIFIED 가 아니다', () => {
    const cases: readonly [string, EvidenceInput][] = [
      ['테스트 실패', input({ unitTests: { result: 'failed', total: 5, passed: 3 } })],
      ['테스트 0개', input({ unitTests: { result: 'passed', total: 0, passed: 0 } })],
      ['결정성 실패', input({ propertyTests: 'failed' })],
      ['Lab 실패', input({ labScenarios: 'failed' })],
      ['리플레이 해시 없음', input({ replayHash: '' })],
      [
        '시나리오 실패',
        input({
          scenarios: {
            total: 3,
            passed: 2,
            failed: 1,
            coverageComplete: false,
            byId: { 'x-normal': 'passed', 'x-failure': 'failed', 'x-boundary': 'passed' },
          },
        }),
      ],
      [
        '시나리오 0개',
        input({ scenarios: { total: 0, passed: 0, failed: 0, coverageComplete: false, byId: {} } }),
      ],
      [
        '커버리지 미충족',
        input({
          scenarios: { total: 1, passed: 1, failed: 0, coverageComplete: false, byId: { 'x-normal': 'passed' } },
        }),
      ],
    ];
    for (const [label, broken] of cases) {
      const evidence = buildEvidence(broken);
      assert.equal(evidence.status, 'IMPLEMENTED', label);
      assert.ok(evidence.blockers.length > 0, `${label}: 사유가 없다`);
    }
  });

  test('실패한 시나리오 이름이 사유에 남는다', () => {
    const evidence = buildEvidence(
      input({
        scenarios: {
          total: 2,
          passed: 1,
          failed: 1,
          coverageComplete: false,
          byId: { 'x-normal': 'passed', 'x-boundary': 'failed' },
        },
      }),
    );
    assert.ok(evidence.blockers.some((blocker) => blocker.includes('x-boundary')));
  });

  test('같은 산출물이면 같은 증거 해시', () => {
    assert.equal(evidenceHash(buildEvidence(input())), evidenceHash(buildEvidence(input())));
    assert.notEqual(
      evidenceHash(buildEvidence(input())),
      evidenceHash(buildEvidence(input({ replayHash: 'cccccccccccccccc' }))),
    );
  });

  test('증거는 그대로 JSON 이 된다', () => {
    const evidence = buildEvidence(input());
    assert.deepEqual(JSON.parse(JSON.stringify(evidence)) as Evidence, evidence);
  });
});

describe('완료 전이 게이트', () => {
  test('증거가 뒷받침하면 허용된다', () => {
    const check = canPromote(contract(), buildEvidence(input()), 'aaaaaaaaaaaaaaaa');
    assert.equal(check.allowed, true);
    assert.deepEqual(check.reasons, []);
  });

  test('증거가 없으면 거부된다', () => {
    const check = canPromote(contract(), null);
    assert.equal(check.allowed, false);
    assert.match(check.reasons[0] ?? '', /증거 파일이 없다/);
  });

  test('소스가 바뀌면 낡은 증거로 완료를 유지할 수 없다', () => {
    const evidence = buildEvidence(input());
    assert.equal(isFresh(evidence, 'aaaaaaaaaaaaaaaa'), true);
    assert.equal(isFresh(evidence, 'cccccccccccccccc'), false);

    const check = canPromote(contract(), evidence, 'cccccccccccccccc');
    assert.equal(check.allowed, false);
    assert.match(check.reasons.join(' '), /소스가 증거 이후로 바뀌었다/);
  });

  test('계약에 시나리오가 없으면 거부된다', () => {
    const check = canPromote(
      contract(CONTRACT_TEXT.replace(/^scenarios: .*$/m, 'scenarios: []')),
      buildEvidence(input()),
      'aaaaaaaaaaaaaaaa',
    );
    assert.equal(check.allowed, false);
    assert.match(check.reasons.join(' '), /시나리오가 없다/);
  });
});

describe('레지스트리 연동', () => {
  const source = { name: 'X.yaml', text: CONTRACT_TEXT };

  test('증거를 넘기지 않으면 계약의 주장을 그대로 믿는다', () => {
    assert.equal(buildRegistry([source]).modules[0]?.registered, true);
  });

  test('증거가 뒷받침하지 않으면 완료 주장이 기각된다', () => {
    const evidence = buildEvidence(input({ propertyTests: 'failed' }));
    const registry = buildRegistry([source], {
      evidence: new Map([['X', evidence]]),
      sourceHashes: new Map([['X', 'aaaaaaaaaaaaaaaa']]),
    });
    assert.equal(registry.modules[0]?.registered, false);
    assert.ok(
      registry.modules[0]?.violations.some((violation) => violation.rule === 'evidence-unsupported'),
    );
  });

  test('완료를 주장하지 않는 계약은 증거를 요구받지 않는다', () => {
    const planned = { name: 'X.yaml', text: CONTRACT_TEXT.replace('status: VERIFIED', 'status: PLANNED') };
    const registry = buildRegistry([planned], { evidence: new Map() });
    assert.equal(registry.modules[0]?.registered, true);
  });
});

// 주의: 이 묶음은 증거의 *구조*만 본다.
// "증거가 완료 주장을 뒷받침하는가" 는 여기서 검사하지 않는다 —
// 증거의 unitTests 항목이 바로 이 테스트의 결과라서, 자기 결과를 자기가 판정하는 순환이 된다.
// 그 대조는 verify/v4.ts (눈 검증) 와 증거 생성기가 수행한다.
describe('실제 증거 파일', () => {
  test('완료를 주장하는 계약마다 증거 파일이 있다', () => {
    const registry = buildRegistry(loadContractSources(contractsDir));
    const evidence = loadEvidence(evidenceDir);
    const missing = registry.modules
      .filter((entry) => entry.contract.status === 'VERIFIED' && !evidence.has(entry.contract.id))
      .map((entry) => entry.contract.id);
    assert.deepEqual(missing, []);
  });

  test('증거 파일은 Evidence 형태이고 소스 해시를 품는다', () => {
    for (const [id, item] of loadEvidence(evidenceDir)) {
      assert.ok(item.module.startsWith(id), `${id}: module 이름이 ID 로 시작하지 않는다`);
      assert.match(item.sourceHash, /^[0-9a-f]{16}$/, `${id}: 소스 해시가 없다`);
      assert.match(item.replayHash, /^[0-9a-f]{16}$/, `${id}: 리플레이 해시가 없다`);
      assert.ok(Array.isArray(item.blockers), `${id}: blockers 가 없다`);
      assert.equal(item.status === 'VERIFIED', item.blockers.length === 0, `${id}: status 와 blockers 가 어긋난다`);
    }
  });

  test('대시보드에 모든 모듈이 나온다', () => {
    const evidence = loadEvidence(evidenceDir);
    const text = formatDashboard(
      [...evidence.entries()].map(([id, item]) => ({ id, evidence: item, claimed: 'VERIFIED' as const })),
    );
    for (const id of evidence.keys()) assert.ok(text.includes(id));
  });
});
