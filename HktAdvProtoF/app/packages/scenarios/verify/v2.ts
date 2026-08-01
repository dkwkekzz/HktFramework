// V2 눈 검증 — V3 Lab 이전 단계의 터미널 출력 (화면 7요소).
// 실행기가 "통과는 조용히, 실패는 고칠 수 있게" 보고하는지를 눈으로 확인한다.
//
//   실행: node packages/scenarios/verify/v2.ts

import { defineScenario, expectState, formatResult, formatSuite, runScenario, runScenarios } from '../src/index.ts';
import { v2Scenarios } from '../suites/v2.ts';

const line = (): void => console.log('─'.repeat(78));
const heading = (text: string): void => {
  line();
  console.log(text);
  line();
};

// ①②③④ 입력 · 처리 · 후보 · 선택 ─────────────────────────────────────────────
heading('① 입력 — 실행기에 넣은 장면 3종');
for (const scenario of v2Scenarios) {
  console.log(`  [${scenario.kind.padEnd(8)}] ${scenario.id} — ${scenario.purpose}`);
}

const suite = runScenarios(v2Scenarios);

heading('②③④ 처리 · 후보 · 선택 — 각 장면의 단언 목록과 판정');
console.log(formatSuite(suite));

// ⑤⑥ 상태 전후 · 실패 이유 ───────────────────────────────────────────────────
// 실패 보고가 실제로 어떻게 보이는지 확인하려면 실패하는 장면이 있어야 한다.
interface Stock {
  readonly tick: number;
  readonly stock: { readonly a: number; readonly b: number };
}

const buggy = defineScenario<Stock, Stock>({
  id: 'demo-consume-bug',
  module: 'DEMO',
  kind: 'normal',
  purpose: 'b 재고를 두 배로 깎는 결함 — 실패 보고 견본.',
  arrange: () => ({ tick: 0, stock: { a: 3, b: 5 } }),
  input: (state) => ({ action: 'consume', from: state.stock }),
  act: (state) => ({ tick: state.tick + 1, stock: { a: state.stock.a - 1, b: state.stock.b - 2 } }),
  assert: (result) => [
    expectState('소비 후 상태가 기대와 같다', { tick: 1, stock: { a: 2, b: 4 } }, result),
  ],
});

heading('⑤⑥ 상태 전후 · 실패 이유 — 일부러 틀린 장면의 보고 견본');
console.log(formatResult(runScenario(buggy)));

// ⑦ 인과 ─────────────────────────────────────────────────────────────────────
heading('⑦ 인과 — 이 보고가 무엇을 보장하는가');
console.log('  arrange → act → assert 세 조각만으로 장면이 정의되고, 실행기가 순서를 고정한다');
console.log('  실패하면 초기 상태·입력·기대·실제·최초 분기 경로 다섯이 항상 함께 나온다');
console.log('  단언 0개는 통과가 아니다 — 검증 없는 완료 선언을 실행기 단계에서 막는다');
console.log('  모듈 완료의 필요조건은 정상·실패·경계 3종 전부 통과 (커버리지 표)');

const selfPassed = suite.failed === 0;
const reportsFailure = runScenario(buggy).failure?.firstDivergentPath === '$.stock.b';
line();
console.log(
  `판정: 자체 시나리오 ${selfPassed ? '통과 ✔' : '실패 ✘'} · 실패 보고 정확도 ${reportsFailure ? '통과 ✔' : '실패 ✘'}`,
);
line();

if (!selfPassed || !reportsFailure) process.exitCode = 1;
