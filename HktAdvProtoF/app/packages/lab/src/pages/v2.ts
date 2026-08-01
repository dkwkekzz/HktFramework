// /lab/v2 — V2 시나리오 실행기. 실행기가 실패를 어떻게 보고하는지가 이 페이지의 본론이다.

import {
  defineScenario,
  expectState,
  runScenario,
  runScenarios,
  digestResult,
} from '@hkt/scenarios';
import { v2Scenarios } from '@hkt/scenarios/suites/v2';

import { lines, pageView, type PageSpec } from '../page.ts';
import { diffView, keyValueView, valueView } from '../renderers/diff.ts';
import { scenarioView, suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

interface Stock {
  readonly tick: number;
  readonly stock: { readonly a: number; readonly b: number };
}

const EXPECTED: Stock = { tick: 1, stock: { a: 2, b: 4 } };

/** b 재고를 두 배로 깎는 고의 결함 — 실패 보고 견본. */
const buggy = defineScenario<Stock, Stock>({
  id: 'demo-consume-bug',
  module: 'DEMO',
  kind: 'normal',
  purpose: 'b 재고를 두 배로 깎는 결함 — 실패 보고 견본.',
  arrange: () => ({ tick: 0, stock: { a: 3, b: 5 } }),
  input: (state) => ({ action: 'consume', from: state.stock }),
  act: (state) => ({ tick: state.tick + 1, stock: { a: state.stock.a - 1, b: state.stock.b - 2 } }),
  assert: (result) => [expectState('소비 후 상태가 기대와 같다', EXPECTED, result)],
});

export function v2Page(): VElement {
  const suite = runScenarios(v2Scenarios);
  const demo = runScenario(buggy);
  const demoDigest = digestResult(demo);

  const spec: PageSpec = {
    id: 'V2',
    title: '시나리오 실행기',
    purpose: '모듈의 대표 장면을 arrange / act / assert 로 자동 실행하고, 실패를 고칠 수 있게 보고한다.',
    verdict: {
      passed: suite.failed === 0 && demo.failure?.firstDivergentPath === '$.stock.b',
      label: `자체 시나리오 ${String(suite.passed)}/${String(suite.total)} · 견본 결함이 $.stock.b 를 지목`,
    },
    sections: {
      input: [
        h('p', {}, ['실행기에 넣은 장면과, 고의 결함을 심은 견본 장면 하나.']),
        keyValueView([
          ...v2Scenarios.map((scenario) => [`${scenario.kind} · ${scenario.id}`, scenario.purpose] as const),
          ['견본 결함', buggy.purpose],
        ]),
        h('h3', {}, ['견본 장면의 초기 상태 / 실행된 입력']),
        keyValueView([
          ['초기 상태 (arrange)', demo.initialState],
          ['실행된 입력 (input)', demo.input],
        ]),
      ],
      process: [
        h('p', {}, ['arrange → act → assert 세 조각. 어디서 던져도 실행기는 죽지 않고 사유로 환원한다.']),
        valueView(['arrange(): 초기 상태', 'act(상태): 결과', 'assert(결과, 상태): 단언[]']),
      ],
      candidates: [
        h('p', {}, ['단언 후보 — 각 단언이 기대·실제·분기 경로를 스스로 남긴다.']),
        h(
          'ul',
          { class: 'lines' },
          demoDigest.assertions.map((assertion) =>
            h('li', {}, [`${assertion.passed ? '✔' : '✘'} ${assertion.label}`]),
          ),
        ),
      ],
      selection: [
        h('p', {}, ['판정 = 실패한 첫 단언. 단언이 0개면 통과가 아니다.']),
        keyValueView([
          ['판정', demo.passed ? '통과' : '실패'],
          ['사유', demo.failure?.reason ?? '(없음)'],
          ['상태 해시', demo.outputHash],
        ]),
      ],
      beforeAfter: [
        h('h3', {}, ['기대 vs 실제 — 최초 분기 경로 강조']),
        diffView(EXPECTED, demo.output, { leftLabel: '기대', rightLabel: '실제' }),
      ],
      failure: [
        h('h3', {}, ['견본 결함의 실패 보고 (원문 V2 요구 5요소)']),
        scenarioView(demoDigest),
        h('h3', {}, ['V2 자체 시나리오 3종']),
        suiteView(suite),
      ],
      causality: lines(
        '실패하면 초기 상태·실행된 입력·기대·실제·최초 분기 경로 다섯이 항상 함께 나온다',
        '단언 0개는 통과가 아니다 — 검증 없는 완료 선언을 실행기 단계에서 막는다',
        '실행 순서는 (모듈, 종류, ID) 안정 정렬로 고정 — 등록 순서가 결과를 바꾸지 않는다',
        '결과는 요약(digest)으로 접힌 뒤에만 증거·화면으로 넘어간다 — 요약은 항상 직렬화 가능하다',
      ),
    },
  };

  return pageView(spec);
}
