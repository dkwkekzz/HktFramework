// /lab/v4 — V4 완료 증거. 실제 증거 파일 스냅샷과, 산출물을 무너뜨렸을 때의 판정을 나란히 보인다.

import { buildEvidence, type Evidence, type EvidenceInput } from '@hkt/contracts';
import { runScenarios } from '@hkt/scenarios';
import { v4Scenarios } from '@hkt/scenarios/suites/v4';

import { EVIDENCE } from '../data.ts';
import { lines, pageView, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const HEALTHY: EvidenceInput = {
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

const DAMAGES: readonly { readonly label: string; readonly input: EvidenceInput }[] = [
  {
    label: '시나리오 하나가 실패한다',
    input: {
      ...HEALTHY,
      scenarios: {
        ...HEALTHY.scenarios,
        passed: 2,
        failed: 1,
        coverageComplete: false,
        byId: { ...HEALTHY.scenarios.byId, 'demo-failure': 'failed' },
      },
    },
  },
  { label: '단위 테스트가 실패한다', input: { ...HEALTHY, unitTests: { result: 'failed', total: 12, passed: 9 } } },
  { label: '단위 테스트가 없다', input: { ...HEALTHY, unitTests: { result: 'passed', total: 0, passed: 0 } } },
  { label: '반복 실행이 흔들린다', input: { ...HEALTHY, propertyTests: 'failed' } },
  { label: '리플레이 해시가 없다', input: { ...HEALTHY, replayHash: '' } },
];

/** 공용 렌더러 ③ 게이지의 최소판 — 검증 항목 4개를 표식으로. */
function checksView(evidence: Evidence): VElement {
  const mark = (result: string): string => (result === 'passed' ? '✔' : result === 'manual' ? '△' : '✘');
  return h('span', { class: 'checks' }, [
    h('span', { class: `check ${evidence.unitTests}` }, [`단위 ${mark(evidence.unitTests)}`]),
    h('span', { class: `check ${evidence.propertyTests}` }, [`속성 ${mark(evidence.propertyTests)}`]),
    h('span', { class: `check ${evidence.labScenarios}` }, [`Lab ${mark(evidence.labScenarios)}`]),
    h('span', { class: `check ${evidence.integrationScenario}` }, [`통합 ${mark(evidence.integrationScenario)}`]),
  ]);
}

export function v4Page(): VElement {
  const suite = runScenarios(v4Scenarios);
  const stored = Object.entries(EVIDENCE);
  const verifiedCount = stored.filter(([, evidence]) => evidence.status === 'VERIFIED').length;
  const detects = DAMAGES.every((damage) => buildEvidence(damage.input).status !== 'VERIFIED');

  const spec: PageSpec = {
    id: 'V4',
    title: '완료 증거 시스템',
    purpose: '검증 산출물에서만 완료 상태를 결정해, 완료를 임의로 선언하지 못하게 한다.',
    // 이 페이지의 판정은 "증거 시스템이 제대로 막는가" 다.
    // 저장된 증거가 지금 몇 개 VERIFIED 인지는 사실(대시보드)이지 이 페이지의 합격 조건이 아니다 —
    // 그렇게 두면 다른 모듈의 진행 상태가 이 페이지를 실패로 만들고, 그 실패가 다시 그 모듈의
    // 증거를 무너뜨리는 되먹임이 생긴다.
    verdict: {
      passed: detects && suite.failed === 0,
      label: `결함 검출 ${detects ? '통과' : '실패'} · 시나리오 ${String(suite.passed)}/${String(suite.total)} · 저장된 증거 ${String(verifiedCount)}/${String(stored.length)} VERIFIED`,
    },
    sections: {
      input: [
        h('p', {}, ['증거의 재료 — 단위 테스트·결정성·Lab 확인·시나리오 결과·리플레이 해시.']),
        keyValueView([
          ['단위 테스트', HEALTHY.unitTests],
          ['결정성', HEALTHY.propertyTests],
          ['Lab 확인', HEALTHY.labScenarios],
          ['시나리오', HEALTHY.scenarios],
          ['리플레이 해시', HEALTHY.replayHash],
        ]),
      ],
      process: [
        h('p', {}, ['저장된 실제 증거 — 대시보드.']),
        h('table', { class: 'dashboard-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['모듈']),
              h('th', {}, ['검증 항목']),
              h('th', {}, ['소스 해시']),
              h('th', {}, ['status']),
            ]),
          ]),
          h(
            'tbody',
            {},
            stored.map(([id, evidence]) =>
              h('tr', { class: evidence.status === 'VERIFIED' ? 'ok' : 'bad' }, [
                h('td', {}, [id]),
                h('td', {}, [checksView(evidence)]),
                h('td', {}, [h('code', {}, [evidence.sourceHash])]),
                h('td', {}, [evidence.status]),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, ['△ = 수동 확인. 이 Lab 이 서면 Lab 항목이 passed 로 바뀐다.']),
      ],
      candidates: [
        h('p', {}, ['status 후보는 둘뿐이다 — 막는 사유가 하나도 없으면 VERIFIED, 아니면 IMPLEMENTED.']),
        keyValueView([
          ['온전한 산출물', buildEvidence(HEALTHY).status],
          ['막는 사유', buildEvidence(HEALTHY).blockers],
        ]),
      ],
      selection: [
        h('p', {}, ['산출물을 하나씩 무너뜨리면 판정이 어떻게 뒤집히는가.']),
        h('table', { class: 'defect-table' }, [
          h('thead', {}, [h('tr', {}, [h('th', {}, ['무너뜨린 것']), h('th', {}, ['status']), h('th', {}, ['사유'])])]),
          h(
            'tbody',
            {},
            DAMAGES.map((damage) => {
              const broken = buildEvidence(damage.input);
              return h('tr', { class: broken.status === 'VERIFIED' ? 'bad' : 'ok' }, [
                h('td', {}, [damage.label]),
                h('td', {}, [broken.status]),
                h('td', {}, [h('ul', { class: 'lines' }, broken.blockers.map((blocker) => h('li', {}, [blocker])))]),
              ]);
            }),
          ),
        ]),
      ],
      beforeAfter: [
        h('h3', {}, ['소스를 고치면 증거가 낡는다']),
        keyValueView([
          ['증거의 소스 해시', HEALTHY.sourceHash],
          ['지금 소스 해시', 'cccccccccccccccc'],
          ['판정', '소스가 증거 이후로 바뀌었다 → 완료가 저절로 풀린다'],
        ]),
      ],
      failure: suiteView(suite),
      causality: lines(
        'status 는 사람이 적는 값이 아니라 산출물이 정하는 값이다 — buildEvidence 가 유일한 판정자',
        '증거는 소스 해시를 품는다 — 고쳐 놓고 예전 증거로 완료를 유지할 수 없다',
        '레지스트리는 계약의 완료 주장을 증거와 대조한다 — 어긋나면 evidence-unsupported',
      ),
    },
  };

  return pageView(spec);
}
