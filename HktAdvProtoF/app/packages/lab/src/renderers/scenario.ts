// 시나리오 결과 렌더러 — V2 실행 결과를 화면 7요소 중 "처리 과정 / 실패 이유" 로 옮긴다.
// diff 뷰 위에 얹은 얇은 층이라 별도 렌더러 종류로 세지 않는다.

import type { ScenarioDigest, SuiteDigest, SuiteResult } from '@hkt/scenarios';
import { digestSuite } from '@hkt/scenarios';

import { h, type VElement } from '../vnode.ts';

function assertionRow(assertion: ScenarioDigest['assertions'][number]): VElement {
  return h('li', { class: assertion.passed ? 'assertion pass' : 'assertion fail' }, [
    h('span', { class: 'mark' }, [assertion.passed ? '✔' : '✘']),
    h('span', { class: 'label' }, [assertion.label]),
    ...(assertion.passed
      ? []
      : [
          h('div', { class: 'assertion-detail' }, [
            h('div', {}, [h('span', { class: 'k' }, ['기대 ']), h('code', {}, [assertion.expected])]),
            h('div', {}, [h('span', { class: 'k' }, ['실제 ']), h('code', {}, [assertion.actual])]),
            h('div', {}, [
              h('span', { class: 'k' }, ['분기 ']),
              h('code', { class: 'path' }, [assertion.firstDivergentPath ?? '(특정 불가)']),
            ]),
          ]),
        ]),
  ]);
}

/** 시나리오 한 건. */
export function scenarioView(result: ScenarioDigest): VElement {
  return h('article', { class: result.passed ? 'scenario pass' : 'scenario fail' }, [
    h('header', {}, [
      h('span', { class: 'mark' }, [result.passed ? '✔' : '✘']),
      h('span', { class: 'kind' }, [result.kind]),
      h('span', { class: 'id' }, [result.scenarioId]),
    ]),
    h('ul', { class: 'assertions' }, result.assertions.map((assertion) => assertionRow(assertion))),
    ...(result.failure === null
      ? []
      : [
          h('div', { class: 'failure' }, [
            h('h4', {}, ['실패 이유']),
            h('dl', {}, [
              h('dt', {}, ['사유']),
              h('dd', {}, [`${result.failure.reason} — ${result.failure.label}`]),
              h('dt', {}, ['기대']),
              h('dd', {}, [h('code', {}, [result.failure.expected])]),
              h('dt', {}, ['실제']),
              h('dd', {}, [h('code', {}, [result.failure.actual])]),
              h('dt', {}, ['최초 분기 경로']),
              h('dd', {}, [h('code', { class: 'path' }, [result.failure.firstDivergentPath ?? '(특정 불가)'])]),
            ]),
          ]),
        ]),
  ]);
}

/** 스위트 전체 — 커버리지 표 + 시나리오 목록. 원본이 아니라 요약을 그린다. */
export function suiteView(suite: SuiteResult): VElement {
  const digest: SuiteDigest = digestSuite(suite);
  return h('div', { class: 'suite' }, [
    h('table', { class: 'coverage-table' }, [
      h('thead', {}, [
        h('tr', {}, [
          h('th', {}, ['모듈']),
          h('th', {}, ['정상']),
          h('th', {}, ['실패']),
          h('th', {}, ['경계']),
          h('th', {}, ['판정']),
        ]),
      ]),
      h(
        'tbody',
        {},
        digest.coverage.map((coverage) =>
          h('tr', { class: coverage.complete ? 'complete' : 'incomplete' }, [
            h('td', {}, [coverage.module]),
            h('td', {}, [String(coverage.normal)]),
            h('td', {}, [String(coverage.failure)]),
            h('td', {}, [String(coverage.boundary)]),
            h('td', {}, [coverage.complete ? '✔ 3종 전부 통과' : '✘ 미충족']),
          ]),
        ),
      ),
    ]),
    h('p', { class: 'suite-total' }, [
      `합계 ${String(digest.passed)}/${String(digest.total)} 통과${digest.failed > 0 ? ` · ${String(digest.failed)} 실패` : ''}`,
    ]),
    ...digest.results.map((result) => scenarioView(result)),
  ]);
}
