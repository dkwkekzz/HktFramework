// /lab/o0 — O0 세계관 공리.
// 코드를 읽지 않아도 네 가지를 눈으로 셀 수 있어야 한다:
//   ① 원문이 세 곳에 나눠 적은 최상위 제약이 어떻게 공리 8개로 좁혀졌는가
//   ② 각 공리를 지금 누가 막고 있는가 (그리고 그 관문이 정말 막는가 — 실행 결과가 함께 나온다)
//   ③ 그 공리 위에 어떤 능력과 종이 섰고, 같은 공리에서 서로 다른 것이 여럿 나오는가
//   ④ 공리를 어긴 정의는 어디서 왜 걸리는가

import {
  AXIOM_SET,
  axiomOf,
  axiomSetReport,
  axiomSetVerdict,
  DEFINITION_LABELS,
  definitionVerdict,
  derivationReport,
  derivationVerdict,
  enforcementReport,
  enforcementVerdict,
  implementedClauses,
  ORIGINAL_AXIOMS,
  resolutionOf,
  slotLabel,
  STRONG_EFFECT_THRESHOLD,
  validateDefinition,
  validateDefinitions,
  type Definition,
} from '@hkt/core';
import { runScenarios } from '@hkt/scenarios';
import { o0Scenarios } from '@hkt/scenarios/suites/o0';
import {
  BROKEN_DEFINITIONS,
  VEIL_DEFINITIONS,
} from '@hkt/scenarios/suites/o0-veil-definitions';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 해소 방식을 한글 한 마디로. */
const RESOLUTION_LABEL: Readonly<Record<string, string>> = {
  same: '같음',
  merged: '합침',
  restated: '재서술',
};

/** 긴 ID 를 화면에서 읽을 수 있게 줄인다 (접두사는 남긴다 — 종류가 보여야 한다). */
function shortId(id: string): string {
  const cut = id.indexOf(':');
  return cut < 0 ? id : `${id.slice(0, cut)}:${id.slice(cut + 1, cut + 5)}…`;
}

/** 경로 안의 매개 ID 도 줄인다. */
function shortPath(path: string): string {
  return path
    .split('.')
    .map((segment) => (segment.includes(':') ? shortId(segment) : segment))
    .join('.');
}

/** 정의 하나가 무엇을 치르고 무엇을 남기는가 — 한 줄로. */
function definitionDetail(definition: Definition): string {
  if (definition.definitionKind === 'ability') {
    const costs =
      definition.costs.length === 0
        ? '대가 없음(약한 효과)'
        : definition.costs
            .map((cost) => `${shortPath(slotLabel(cost))} −${String(cost.amount)}`)
            .join(' · ');
    const traces = definition.traces
      .map((trace) => `${trace.channel}→${shortPath(slotLabel(trace))}`)
      .join(' · ');
    return `강도 ${String(definition.strength)} | ${costs} | 흔적 ${traces}`;
  }
  const slots = definition.slots.map((slot) => shortPath(slotLabel(slot))).join(' · ');
  return `${definition.subjectKind}${definition.alive ? ' · 생명' : ''}${
    definition.originId === null ? '' : ` · 유래 ${shortId(definition.originId)}`
  } | 자리 ${slots}`;
}

export function o0Page(): VElement {
  const set = axiomSetReport();
  const enforcement = enforcementReport();
  const gate = validateDefinitions(VEIL_DEFINITIONS);
  const derivation = derivationReport(VEIL_DEFINITIONS);
  const suite = runScenarios(o0Scenarios);

  const brokenRows = BROKEN_DEFINITIONS.map((entry) => {
    const violation = validateDefinition(entry.value)[0];
    return {
      broke: entry.broke,
      name: entry.value.name,
      expected: entry.expected,
      actual: violation?.rule ?? '(통과해 버렸다)',
      clause: violation?.clause ?? '(공리 이전)',
      path: violation?.path ?? '',
      message: violation?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);
  const passed =
    set.complete &&
    enforcement.complete &&
    gate.complete &&
    derivation.complete &&
    allRejected &&
    suite.failed === 0;

  const spec: PageSpec = {
    id: 'O0',
    title: '세계관 공리',
    purpose:
      '세계에 어떤 존재와 현상이 허용되는지 공리로 정의하고, 그 공리를 어기는 능력·종 정의를 거부한다.',
    verdict: {
      passed,
      label: passed
        ? `${axiomSetVerdict(set)} · 정의 ${String(gate.accepted.length)}개 · 관문 ${String(enforcement.results.length)}곳 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : [axiomSetVerdict(set), enforcementVerdict(enforcement), definitionVerdict(gate)].join(' · '),
    },
    sections: {
      input: keyValueView([
        ['원문 목록 ①', `ModulePlan O0 — 공리 예시 ${String(ORIGINAL_AXIOMS.filter((o) => o.source.startsWith('ModulePlan')).length)}문장`],
        [
          '원문 목록 ②',
          `MasterPlan §3.1 — 존재 전제·의지장·universalInvariants ${String(ORIGINAL_AXIOMS.filter((o) => o.source.startsWith('MasterPlan §3.1')).length)}문장`,
        ],
        [
          '원문 목록 ③',
          `MasterPlan §3.2 — 1계층 절대 불변 규칙·6계층 ${String(ORIGINAL_AXIOMS.filter((o) => o.source.startsWith('MasterPlan §3.2')).length)}문장`,
        ],
        ['검증 장면', `붉은 장막 세계에 들이려는 정의 ${String(VEIL_DEFINITIONS.length)}개 (능력 3 · 종 4)`],
        ['결함 정의', `${String(BROKEN_DEFINITIONS.length)}종 (각자 다른 조항을 어긴다)`],
        ['강한 효과의 임계', `강도 ${String(STRONG_EFFECT_THRESHOLD)} 초과부터 대가를 요구한다`],
      ]),

      process: [
        h('p', {}, [
          '원문은 최상위 제약을 세 곳에 나눠 적었고 목록이 서로 다르다. 어느 한쪽만 고르면 "원문에 있는데 공리에 없다" 가 반복되므로, ' +
            '문장 하나하나가 어느 공리로 갔는지를 적는다. 해소되지 않은 문장이 남거나 원문 근거 없는 공리가 생기면 판정이 무너진다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원문 문장']),
              h('th', {}, ['출처']),
              h('th', {}, ['해소']),
              h('th', {}, ['확정 공리']),
              h('th', {}, ['근거']),
            ]),
          ]),
          h(
            'tbody',
            {},
            ORIGINAL_AXIOMS.map((original) => {
              const resolution = resolutionOf(original.id);
              return h('tr', { class: resolution === null ? 'bad' : 'ok' }, [
                h('td', {}, [original.text]),
                h('td', { class: 'id' }, [original.source]),
                h('td', {}, [
                  resolution === null
                    ? h('span', { class: 'none' }, ['(해소 없음)'])
                    : (RESOLUTION_LABEL[resolution.resolution] ?? resolution.resolution),
                ]),
                h('td', {}, [
                  resolution === null
                    ? h('span', { class: 'none' }, ['—'])
                    : h('code', {}, [resolution.clause]),
                ]),
                h('td', {}, [resolution?.reason ?? '']),
              ]);
            }),
          ),
        ]),
        h('p', { class: 'diff-note' }, [axiomSetVerdict(set)]),
      ],

      candidates: [
        h('p', {}, [
          '확정 공리 8개. 공리는 새 타입이 아니라 ',
          h('strong', {}, ['근거가 자기 자신인 규칙']),
          ' 이다 — 조건(when)이 성립하면 효과(then)가 따르고, 세계의 다른 모든 규칙은 이 여덟 중 하나로 거슬러 올라간다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['조항']),
              h('th', {}, ['공리']),
              h('th', {}, ['언제']),
              h('th', {}, ['그러면']),
              h('th', {}, ['정의 검사']),
            ]),
          ]),
          h(
            'tbody',
            {},
            AXIOM_SET.map((axiom) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [h('code', {}, [axiom.clause])]),
                h('td', {}, [axiom.name]),
                h('td', {}, [axiom.when.join(' / ')]),
                h('td', {}, [axiom.then.join(' · ')]),
                h('td', {}, [
                  axiom.appliesTo.length === 0
                    ? h('span', { class: 'none' }, ['(정의 층위 아님)'])
                    : axiom.appliesTo.map((kind) => DEFINITION_LABELS[kind]).join(' · '),
                ]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['공리를 지금 누가 막는가']),
        h('p', {}, [
          '공리를 값으로 적어 두는 것만으로는 아무 일도 일어나지 않는다. 선언된 관문마다 프로브를 붙여 ' +
            '공리를 어기는 값을 실제로 넣어 보고, 거부가 나오는지 확인한다. ',
          h('strong', {}, ['O1·O2 는 공리가 값으로 서기 전부터 그것을 강제하고 있었다']),
          ' — 그 사실이 여기서 표로 선다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['조항']),
              h('th', {}, ['관문']),
              h('th', {}, ['넣은 것']),
              h('th', {}, ['막아야 할 것']),
              h('th', {}, ['실제']),
            ]),
          ]),
          h(
            'tbody',
            {},
            enforcement.results.map((result) =>
              h('tr', { class: result.held ? 'ok' : 'bad' }, [
                h('td', {}, [h('code', {}, [result.clause])]),
                h('td', { class: 'id' }, [result.gate]),
                h('td', {}, [result.given]),
                h('td', {}, [result.expects]),
                h('td', {}, [h('code', { class: 'path' }, [result.observed])]),
              ]),
            ),
          ),
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['아직 못 막는 공리']), h('th', {}, ['갚을 모듈'])]),
          ]),
          h(
            'tbody',
            {},
            enforcement.deferred.map((clause) =>
              h('tr', { class: 'warn' }, [
                h('td', {}, [h('code', {}, [clause])]),
                h('td', {}, [axiomOf(clause)?.deferredTo ?? '']),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, [enforcementVerdict(enforcement)]),
      ],

      selection: [
        h('p', {}, [
          '그 공리 위에 붉은 장막 세계의 정의들이 선다. 능력은 무엇을 치르고 무엇을 남기는지, ' +
            '종은 어느 자리를 갖는지를 함께 적는다 — 대가와 흔적은 말이 아니라 ',
          h('strong', {}, ['O2 의 실재하는 자리']),
          ' 를 가리켜야 한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['종류']),
              h('th', {}, ['정의']),
              h('th', {}, ['근거 공리']),
              h('th', {}, ['내용']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_DEFINITIONS.map((definition) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [DEFINITION_LABELS[definition.definitionKind]]),
                h('td', {}, [definition.name]),
                h('td', {}, [
                  [
                    definition.axiomId === null
                      ? '(없음)'
                      : (AXIOM_SET.find((axiom) => axiom.id === definition.axiomId)?.clause ?? '?'),
                    ...definition.supportIds.map(
                      (id) => `+${AXIOM_SET.find((axiom) => axiom.id === id)?.clause ?? '?'}`,
                    ),
                  ].join(' '),
                ]),
                h('td', {}, [definitionDetail(definition)]),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, [definitionVerdict(gate)]),
      ],

      beforeAfter: [
        h('h3', {}, ['공리 → 정의 도출']),
        h('p', {}, [
          '원문 O0 의 검증 조항 ②: 같은 공리로부터 여러 종류의 능력과 종이 도출되는가. ' +
            '공리 하나가 정의 하나만 낳는다면 그것은 공리가 아니라 그 정의를 다른 말로 적은 것이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['공리']),
              h('th', {}, ['도출']),
              h('th', {}, ['능력']),
              h('th', {}, ['종']),
              h('th', {}, ['나온 정의']),
            ]),
          ]),
          h(
            'tbody',
            {},
            derivation.byClause.map((entry) =>
              h('tr', { class: entry.required ? (entry.diverse ? 'ok' : 'bad') : 'warn' }, [
                h('td', {}, [h('code', {}, [entry.clause])]),
                h('td', { class: 'num' }, [
                  entry.required ? String(entry.derived.length) : '(요구 안 함)',
                ]),
                h('td', { class: 'num' }, [String(entry.abilities)]),
                h('td', { class: 'num' }, [String(entry.species)]),
                h('td', {}, [
                  entry.derived.length === 0
                    ? h('span', { class: 'none' }, ['—'])
                    : entry.derived
                        .map(
                          (item) =>
                            `${item.definitionName}${item.role === 'support' ? '(지원)' : ''}`,
                        )
                        .join(' · '),
                ]),
              ]),
            ),
          ),
        ]),
        h('p', { class: 'diff-note' }, [derivationVerdict(derivation)]),
      ],

      failure: [
        h('p', {}, [
          '결함 정의는 무엇을 어겼고 어느 공리에 걸리는가. 열넷 중 열셋은 ',
          h('strong', {}, ['O1 로서는 온전한 Rule']),
          ' 이다 — O0 가 없으면 그대로 세계에 들어갔을 정의들이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', { class: 'nowrap' }, ['걸려야 할 사유']),
              h('th', { class: 'nowrap' }, ['실제']),
              h('th', {}, ['공리']),
              h('th', {}, ['자리']),
              h('th', {}, ['메시지']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', { class: 'nowrap' }, [h('code', {}, [row.expected])]),
                h('td', { class: 'nowrap' }, [h('code', { class: 'path' }, [row.actual])]),
                h('td', {}, [h('code', {}, [row.clause])]),
                h('td', { class: 'id' }, [row.path]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '원문 세 목록 → 문장별 해소(같음·합침·재서술) → 확정 공리 8개 → 공리별 강제 지점',
        '공리는 새 타입이 아니다 — 근거가 자기 자신인 규칙이다. O1 Rule 의 axiomId=null 자리가 곧 공리의 자리다',
        `정의도 새 타입이 아니다 — 능력도 종도 규칙이고, 어느 공리에서 나왔는지는 Rule.axiomId 에 적힌다 (정의 층위 검사기 ${String(implementedClauses().length)}종)`,
        'O1 은 근거 없는 규칙을 허용하지만 O0 는 거부한다 — 세계에 설 수 있는 것은 공리에서 나온 것뿐이다',
        '"검증 가능한 비용" 과 "관찰 가능한 흔적" 은 말이 아니라 O2 의 자리로 판정된다 — 없는 자리를 가리키면 대가도 흔적도 성립하지 않는다',
        '공리를 빼면 그 관문도 사라진다 — 막는 것은 코드가 아니라 공리 자신이다 (실패 시나리오가 이것을 실행해서 보인다)',
        '아직 못 막는 공리는 사라지지 않고 갚을 모듈과 함께 남는다 — R3·W2 가 설 때 프로브가 붙을 자리를 가리킨다',
      ),
    },
  };

  return pageView(spec);
}
