// V0 눈 검증 — V3 Lab 이전 단계의 터미널 출력 (화면 7요소).
// 실제 계약 디렉터리를 등록해 보고, 결함 계약을 넣으면 어떤 사유로 거부되는지 눈으로 확인한다.
//
//   실행: node packages/scenarios/verify/v0.ts

import { buildRegistry, formatRegistry, type ContractSource } from '@hkt/contracts';
import { loadContractSources } from '@hkt/contracts/load';

import { formatSuite, runScenarios } from '../src/index.ts';
import { v0Scenarios } from '../suites/v0.ts';

const contractsDir = new URL('../../contracts/', import.meta.url);

const line = (): void => console.log('─'.repeat(78));
const heading = (text: string): void => {
  line();
  console.log(text);
  line();
};

// ① 입력 ─────────────────────────────────────────────────────────────────────
const sources = loadContractSources(contractsDir);
heading('① 입력 — 등록할 계약 파일');
for (const source of sources) {
  console.log(`  ${source.name.padEnd(12)} ${String(source.text.split('\n').length).padStart(3)}행`);
}

// ②③④ 처리 · 후보 · 선택 ────────────────────────────────────────────────────
const registry = buildRegistry(sources);
heading('②③④ 처리 · 후보 · 선택 — 등록 판정과 의존 DAG');
console.log(formatRegistry(registry));
console.log('');
console.log('  의존 간선 (from → to)');
for (const edge of registry.edges) console.log(`    ${edge.from} → ${edge.to}`);
if (registry.edges.length === 0) console.log('    (없음)');

// ⑤ 상태 전후 ────────────────────────────────────────────────────────────────
heading('⑤ 상태 전후 — 온전한 계약에 결함을 심으면 판정이 뒤집힌다');
const healthy: ContractSource = {
  name: 'DEMO.yaml',
  text: [
    'id: DEMO',
    'name: demo-module',
    'purpose: 결함을 심기 전의 온전한 계약이다.',
    'inputs: [A]',
    'outputs: [B]',
    'depends: []',
    'scenarios: [demo-normal, demo-failure, demo-boundary]',
    'status: VERIFIED',
    'evidence: evidence/DEMO.json',
    '',
  ].join('\n'),
};
const before = buildRegistry([healthy]);
console.log(`  전: ${before.modules[0]?.registered === true ? '등록 ✔' : '거부 ✘'}`);

const defects: readonly { readonly label: string; readonly text: string }[] = [
  { label: '목적을 지운다', text: healthy.text.replace(/^purpose: .*\n/m, '') },
  { label: '입출력을 비운다', text: healthy.text.replace('inputs: [A]', 'inputs: []').replace('outputs: [B]', 'outputs: []') },
  { label: '시나리오를 비운다', text: healthy.text.replace(/^scenarios: .*$/m, 'scenarios: []') },
  { label: '증거를 지운다', text: healthy.text.replace(/^evidence: .*\n/m, '') },
  { label: '없는 렌더러를 쓴다', text: `${healthy.text}elements:\n  - name: X\n    ontology: State\n    renderer: hologram\n` },
  { label: '자기 자신에 의존한다', text: healthy.text.replace('depends: []', 'depends: [DEMO]') },
];

// ⑥ 실패 이유 ────────────────────────────────────────────────────────────────
heading('⑥ 실패 이유 — 결함마다 어떤 사유로 거부되는가');
for (const defect of defects) {
  const broken = buildRegistry([{ name: 'DEMO.yaml', text: defect.text }]);
  const entry = broken.modules[0];
  const reasons =
    entry === undefined
      ? broken.rejected.map((violation) => violation.rule)
      : entry.violations.map((violation) => violation.rule);
  console.log(
    `  ${defect.label.padEnd(18)} → ${entry?.registered === true ? '등록 ✔ (검출 실패)' : `거부 ✘ [${reasons.join(', ')}]`}`,
  );
}

// 시나리오 3종 ───────────────────────────────────────────────────────────────
const suite = runScenarios(v0Scenarios);
heading('시나리오 3종 (V2 실행기) — 정상 · 실패 · 경계');
console.log(formatSuite(suite));

// ⑦ 인과 ─────────────────────────────────────────────────────────────────────
heading('⑦ 인과 — 레지스트리가 무엇을 막는가');
console.log('  목적 없는 모듈 · 입출력 없는 처리 모듈 · 순환 의존은 애초에 등록되지 않는다');
console.log('  시나리오 없는 모듈, 증거 없는 모듈은 VERIFIED 를 주장할 수 없다');
console.log('  미검증 모듈에 의존한 채 완료를 주장해도 거부된다 — 단계 게이트가 계약으로 강제된다');
console.log('  착수 가능 목록은 "의존이 전부 VERIFIED 인 미완료 모듈" 이다 — 다음에 할 일이 계산된다');

const realOk = registry.modules.every((entry) => entry.registered) && registry.rejected.length === 0;
const detectsDefects = defects.every((defect) => {
  const broken = buildRegistry([{ name: 'DEMO.yaml', text: defect.text }]);
  return broken.modules[0]?.registered !== true || broken.rejected.length > 0;
});
line();
console.log(
  `판정: 실제 계약 등록 ${realOk ? '통과 ✔' : '실패 ✘'} · 결함 검출력 ${detectsDefects ? '통과 ✔' : '실패 ✘'} · 시나리오 ${suite.failed === 0 ? '통과 ✔' : '실패 ✘'}`,
);
line();

if (!realOk || !detectsDefects || suite.failed > 0) process.exitCode = 1;
