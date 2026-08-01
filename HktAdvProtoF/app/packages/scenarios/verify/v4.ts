// V4 눈 검증 — V3 Lab 이전 단계의 터미널 출력 (화면 7요소).
// "완료 선언은 증거로만" 이 실제로 강제되는지 — 실제 증거 파일과 계약을 대조해 보인다.
//
//   실행: node packages/scenarios/verify/v4.ts

import {
  buildEvidence,
  buildRegistry,
  canPromote,
  formatDashboard,
  formatRegistry,
  parseYaml,
  readContract,
  type Evidence,
  type EvidenceInput,
} from '@hkt/contracts';
import { loadContractSources, loadEvidence } from '@hkt/contracts/load';

import { formatSuite, runScenarios } from '../src/index.ts';
import { v4Scenarios } from '../suites/v4.ts';

const contractsDir = new URL('../../contracts/', import.meta.url);
const evidenceDir = new URL('../../contracts/evidence/', import.meta.url);

const line = (): void => console.log('─'.repeat(78));
const heading = (text: string): void => {
  line();
  console.log(text);
  line();
};

// ① 입력 ─────────────────────────────────────────────────────────────────────
const sources = loadContractSources(contractsDir);
const evidence = loadEvidence(evidenceDir);
heading('① 입력 — 계약이 주장하는 status 와 실제 증거 파일');
for (const source of sources) {
  const id = source.name.replace(/\.yaml$/, '');
  const claimed = /^status:\s*(\S+)/m.exec(source.text)?.[1] ?? '?';
  const found = evidence.get(id);
  console.log(
    `  ${id.padEnd(5)} 주장 ${claimed.padEnd(12)} 증거 ${found === undefined ? '없음' : `${found.status} (source ${found.sourceHash.slice(0, 12)})`}`,
  );
}

// ②③④ 처리 · 후보 · 선택 ────────────────────────────────────────────────────
heading('②③④ 처리 · 후보 · 선택 — 증거 대시보드');
console.log(
  formatDashboard(
    sources.map((source) => {
      const id = source.name.replace(/\.yaml$/, '');
      return { id, evidence: evidence.get(id) ?? null, claimed: 'VERIFIED' as const };
    }),
  ),
);

// ⑤ 상태 전후 ────────────────────────────────────────────────────────────────
heading('⑤ 상태 전후 — 산출물 하나가 무너지면 증거가 뒤집힌다');
const healthy: EvidenceInput = {
  module: 'DEMO-example',
  sourceHash: 'aaaaaaaaaaaaaaaa',
  unitTests: { result: 'passed', total: 12, passed: 12 },
  propertyTests: 'passed',
  labScenarios: 'manual',
  scenarios: {
    total: 3,
    passed: 3,
    failed: 0,
    coverageComplete: true,
    byId: { 'demo-normal': 'passed', 'demo-failure': 'passed', 'demo-boundary': 'passed' },
  },
  replayHash: 'bbbbbbbbbbbbbbbb',
};
console.log(`  전: ${buildEvidence(healthy).status}`);

const damages: readonly { readonly label: string; readonly input: EvidenceInput }[] = [
  {
    label: '시나리오 하나가 실패한다',
    input: {
      ...healthy,
      scenarios: {
        ...healthy.scenarios,
        passed: 2,
        failed: 1,
        coverageComplete: false,
        byId: { ...healthy.scenarios.byId, 'demo-failure': 'failed' },
      },
    },
  },
  { label: '단위 테스트가 실패한다', input: { ...healthy, unitTests: { result: 'failed', total: 12, passed: 9 } } },
  { label: '단위 테스트가 없다', input: { ...healthy, unitTests: { result: 'passed', total: 0, passed: 0 } } },
  { label: '반복 실행이 흔들린다', input: { ...healthy, propertyTests: 'failed' } },
  {
    label: '경계 시나리오가 없다',
    input: {
      ...healthy,
      scenarios: { total: 2, passed: 2, failed: 0, coverageComplete: false, byId: { 'demo-normal': 'passed', 'demo-failure': 'passed' } },
    },
  },
  { label: '리플레이 해시가 없다', input: { ...healthy, replayHash: '' } },
];

// ⑥ 실패 이유 ────────────────────────────────────────────────────────────────
heading('⑥ 실패 이유 — 무너진 산출물마다 어떤 사유로 완료가 막히는가');
for (const damage of damages) {
  const broken = buildEvidence(damage.input);
  console.log(`  ${damage.label.padEnd(22)} → ${broken.status}`);
  for (const blocker of broken.blockers) console.log(`      └ ${blocker}`);
}

// 소스가 바뀌면 기존 증거가 낡는다 ────────────────────────────────────────────
const demoContract = {
  name: 'DEMO.yaml',
  text: [
    'id: DEMO',
    'name: demo-module',
    'purpose: 증거 대조 시연용 계약이다.',
    'inputs: [A]',
    'outputs: [B]',
    'depends: []',
    'scenarios: [demo-normal, demo-failure, demo-boundary]',
    'status: VERIFIED',
    'evidence: evidence/DEMO.json',
    '',
  ].join('\n'),
};
const demoEvidence = buildEvidence(healthy);
const { contract: demoParsed } = readContract(parseYaml(demoContract.text), demoContract.name);
const staleRegistry = buildRegistry([demoContract], {
  evidence: new Map<string, Evidence>([['DEMO', demoEvidence]]),
  sourceHashes: new Map([['DEMO', 'cccccccccccccccc']]), // 소스를 고친 뒤
});
console.log('');
console.log('  소스를 고친 뒤 예전 증거로 완료를 유지하려 하면:');
const stale = demoParsed === null ? null : canPromote(demoParsed, demoEvidence, 'cccccccccccccccc');
console.log(`    ${(stale?.reasons ?? ['(계약을 읽지 못했다)']).join('\n    ')}`);
console.log('');
console.log(formatRegistry(staleRegistry));

// 시나리오 3종 ───────────────────────────────────────────────────────────────
const suite = runScenarios(v4Scenarios);
heading('시나리오 3종 (V2 실행기) — 정상 · 실패 · 경계');
console.log(formatSuite(suite));

// ⑦ 인과 ─────────────────────────────────────────────────────────────────────
heading('⑦ 인과 — 증거가 무엇을 막는가');
console.log('  status 는 사람이 적는 값이 아니라 산출물이 정하는 값이다 — buildEvidence 가 유일한 판정자');
console.log('  증거는 소스 해시를 품는다 — 소스를 고치면 예전 증거는 낡아서 완료가 저절로 풀린다');
console.log('  레지스트리는 계약의 완료 주장을 증거와 대조한다 — 어긋나면 evidence-unsupported');
console.log('  Lab 확인은 아직 수동(△) 이다 — V3 가 서면 passed 로 바뀐다');

const realOk = [...evidence.values()].every((item) => item.status === 'VERIFIED');
const detects = damages.every((damage) => buildEvidence(damage.input).status !== 'VERIFIED');
const staleBlocked = staleRegistry.modules[0]?.registered !== true;
line();
console.log(
  `판정: 실제 증거 ${realOk ? '통과 ✔' : '실패 ✘'} · 결함 검출력 ${detects ? '통과 ✔' : '실패 ✘'} · 낡은 증거 차단 ${staleBlocked ? '통과 ✔' : '실패 ✘'} · 시나리오 ${suite.failed === 0 ? '통과 ✔' : '실패 ✘'}`,
);
line();

if (!realOk || !detects || !staleBlocked || suite.failed > 0) process.exitCode = 1;
