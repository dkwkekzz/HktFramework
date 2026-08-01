// /lab/v0 — V0 모듈 계약 레지스트리.
// 계약 텍스트는 빌드 시점에 문자열로 들어온다 (브라우저는 파일 시스템에 닿지 않는다).

import { buildRegistry, type ContractSource } from '@hkt/contracts';
import { runScenarios } from '@hkt/scenarios';
import { v0Scenarios } from '@hkt/scenarios/suites/v0';

import { CONTRACT_SOURCES } from '../data.ts';
import { lines, pageView, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement, type VNode } from '../vnode.ts';

/** 의존 DAG — 공용 렌더러 ② 그래프 뷰의 최소판 (노드 = 모듈, 색 = status). */
function graphView(registry: ReturnType<typeof buildRegistry>): VElement {
  return h('div', { class: 'graph' }, [
    h(
      'div',
      { class: 'graph-nodes' },
      registry.modules.map((entry) =>
        h(
          'span',
          {
            class: `node status-${entry.contract.status.toLowerCase()} ${entry.registered ? 'registered' : 'rejected'}`,
            title: entry.contract.purpose,
          },
          [entry.contract.id],
        ),
      ),
    ),
    h(
      'ul',
      { class: 'graph-edges' },
      registry.edges.map((edge) => h('li', {}, [`${edge.from} → ${edge.to}`])),
    ),
    h('p', { class: 'graph-order' }, [
      `위상 순서: ${registry.topologicalOrder === null ? '없음 (순환 의존)' : registry.topologicalOrder.join(' → ')}`,
    ]),
  ]);
}

function contract(id: string, overrides: Partial<Record<string, string>> = {}): ContractSource {
  const {
    purpose = `${id} 의 목적을 한 문장으로 적는다.`,
    inputs = '[A]',
    outputs = '[B]',
    depends = '[]',
    scenarios = '[x-normal, x-failure, x-boundary]',
    status = 'VERIFIED',
    evidence = `evidence/${id}.json`,
  } = overrides;
  return {
    name: `${id}.yaml`,
    text: [
      `id: ${id}`,
      `name: ${id.toLowerCase()}-module`,
      ...(purpose === '' ? [] : [`purpose: ${purpose}`]),
      `inputs: ${inputs}`,
      `outputs: ${outputs}`,
      `depends: ${depends}`,
      `scenarios: ${scenarios}`,
      `status: ${status}`,
      ...(evidence === '' ? [] : [`evidence: ${evidence}`]),
      '',
    ].join('\n'),
  };
}

const DEFECTS: readonly { readonly label: string; readonly source: ContractSource }[] = [
  { label: '목적을 지운다', source: contract('NOPURPOSE', { purpose: '' }) },
  { label: '입출력을 비운다', source: contract('NOIO', { inputs: '[]', outputs: '[]' }) },
  { label: '시나리오를 비운다', source: contract('NOSCENARIO', { scenarios: '[]' }) },
  { label: '증거를 지운다', source: contract('NOEVIDENCE', { evidence: '' }) },
  { label: '자기 자신에 의존한다', source: contract('SELFDEP', { depends: '[SELFDEP]' }) },
];

export function v0Page(): VElement {
  const registry = buildRegistry(CONTRACT_SOURCES);
  const suite = runScenarios(v0Scenarios);
  const allRegistered = registry.modules.every((entry) => entry.registered) && registry.rejected.length === 0;

  const defectRows: VNode[] = DEFECTS.map((defect) => {
    const broken = buildRegistry([defect.source]);
    const entry = broken.modules[0];
    const rules =
      entry === undefined
        ? broken.rejected.map((violation) => violation.rule)
        : entry.violations.map((violation) => violation.rule);
    return h('tr', { class: entry?.registered === true ? 'bad' : 'ok' }, [
      h('td', {}, [defect.label]),
      h('td', {}, [entry?.registered === true ? '등록 ✘ (검출 실패)' : '거부 ✔']),
      h('td', {}, [h('code', {}, [rules.join(', ') || '(없음)'])]),
    ]);
  });

  const spec: PageSpec = {
    id: 'V0',
    title: '모듈 계약 레지스트리',
    purpose: '모든 모듈의 목적·입출력·의존·검증 상태를 등록하고 결함 계약을 거부한다.',
    verdict: {
      passed: allRegistered && suite.failed === 0,
      label: `실제 계약 ${String(registry.modules.length)}개 등록 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: keyValueView(CONTRACT_SOURCES.map((source) => [source.name, `${String(source.text.split('\n').length)}행`])),
      process: h('table', { class: 'registry-table' }, [
        h('thead', {}, [
          h('tr', {}, [
            h('th', {}, ['모듈']),
            h('th', {}, ['상태']),
            h('th', {}, ['의존']),
            h('th', {}, ['시나리오']),
            h('th', {}, ['증거']),
            h('th', {}, ['판정']),
          ]),
        ]),
        h(
          'tbody',
          {},
          registry.modules.map((entry) =>
            h('tr', { class: entry.registered ? 'ok' : 'bad' }, [
              h('td', {}, [entry.contract.id]),
              h('td', {}, [entry.contract.status]),
              h('td', {}, [entry.contract.depends.join(', ') || '—']),
              h('td', { class: 'num' }, [String(entry.contract.scenarios.length)]),
              h('td', {}, [entry.contract.evidence === null ? '없음' : '있음']),
              h('td', {}, [entry.registered ? '등록 ✔' : '거부 ✘']),
            ]),
          ),
        ),
      ]),
      candidates: [
        h('p', {}, ['등록 후보 = 계약 파일 전부. 아래 표의 사유에 걸리면 후보에서 탈락한다.']),
        h('table', { class: 'defect-table' }, [
          h('thead', {}, [h('tr', {}, [h('th', {}, ['심은 결함']), h('th', {}, ['판정']), h('th', {}, ['사유'])])]),
          h('tbody', {}, defectRows),
        ]),
      ],
      selection: [h('p', {}, ['등록된 모듈과 의존 DAG (노드 색 = status)']), graphView(registry)],
      beforeAfter: [
        h('p', {}, ['착수 가능 목록 = 의존이 전부 VERIFIED 인 미완료 모듈 — "다음에 할 일" 이 계산된다.']),
        keyValueView([
          ['등록', registry.modules.filter((entry) => entry.registered).map((entry) => entry.contract.id)],
          ['거부', registry.rejected.map((violation) => `${violation.module}:${violation.rule}`)],
          ['착수 가능', registry.ready],
        ]),
      ],
      failure: suiteView(suite),
      causality: lines(
        '목적 없는 모듈 · 입출력 없는 처리 모듈 · 순환 의존은 애초에 등록되지 않는다',
        '시나리오나 증거가 없으면 VERIFIED 를 주장할 수 없다',
        '미검증 모듈에 의존한 채 완료를 주장해도 거부된다 — 단계 게이트가 계약으로 강제된다',
        '레지스트리는 자기 계약(V0.yaml)도 같은 규칙으로 검사한다',
      ),
    },
  };

  return pageView(spec);
}
