// /lab/o1 — O1 공통 세계 존재론.
// 원문 개념이 12타입으로 다 덮이는가를 표 하나로 보인다. 코드를 읽지 않아도
// "무엇이 어느 타입으로 적히는가" 와 "무엇이 아직 안 적히는가" 를 눈으로 셀 수 있어야 한다.

import {
  classify,
  CONCEPT_CATALOG,
  countByKind,
  coverageReport,
  coverageVerdict,
  implementedKinds,
  ONTOLOGY_KINDS,
  provenanceGaps,
  type OntologyKind,
} from '@hkt/core/o1';
import { runScenarios } from '@hkt/scenarios';
import { o1Scenarios } from '@hkt/scenarios/suites/o1';
import {
  accessPath,
  BROKEN_NODES,
  foodNeed,
  forageWay,
  healingClaim,
  HUNTER_SCENE,
  toxin,
} from '@hkt/scenarios/suites/o1-hunter-scene';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 장면 원소를 사람이 읽는 한 줄로 — 타입마다 이름 자리가 다르다. */
function sceneLabel(node: (typeof HUNTER_SCENE)[number]): string {
  switch (node.kind) {
    case 'Subject':
    case 'Entity':
    case 'Rule':
    case 'Event':
      return node.name;
    case 'State':
      return `${node.domain}.${node.path} = ${String(node.value)}`;
    case 'Phenomenon':
      return `${node.channel} 현상 (세기 ${String(node.intensity)})`;
    case 'Claim':
      return node.assertion;
    case 'Commitment':
      return node.obligation;
    case 'Affordance':
      return `${node.action} — ${node.yields.join(', ')}`;
    case 'Dependency':
      return node.desiredCondition;
    case 'Possibility':
      return `${node.direction} — ${node.atoms.join(' → ')}`;
    case 'WorldRequirement':
      return node.description;
  }
}

/** 개수를 막대로 — 게이지 렌더러가 서기 전의 최소판. */
function bar(count: number): string {
  return count === 0 ? '·' : '█'.repeat(Math.min(count, 20));
}

export function o1Page(): VElement {
  const report = coverageReport();
  const implemented = implementedKinds();
  const counts = countByKind(HUNTER_SCENE);
  const suite = runScenarios(o1Scenarios);
  const gaps = provenanceGaps(accessPath, [forageWay], [foodNeed]);
  const brokenRows = BROKEN_NODES.map((node) => {
    const violations = classify(node.value).violations;
    const first = violations[0];
    return {
      broke: node.broke,
      expected: node.expected,
      actual: first === undefined ? '(통과해 버렸다)' : `${first.rule} ${first.path}`,
      message: first?.message ?? '',
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  const spec: PageSpec = {
    id: 'O1',
    title: '공통 세계 존재론',
    purpose: '원문 설계의 모든 개념을 공통 존재론 12타입 중 하나 이상으로 표현한다.',
    verdict: {
      passed: report.complete && suite.failed === 0 && allRejected,
      label: report.complete
        ? `${coverageVerdict(report)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : coverageVerdict(report),
    },
    sections: {
      input: keyValueView([
        ['원문 개념 카탈로그', `${String(CONCEPT_CATALOG.length)}종 (design/Design-MasterPlan.md §3~§20)`],
        ['존재론 이름표', ONTOLOGY_KINDS.join(' · ')],
        ['검증 장면', `붉은 장막 사냥꾼 — 원소 ${String(HUNTER_SCENE.length)}개`],
        ['결함 원소', `${String(BROKEN_NODES.length)}종 (각자 다른 조항을 어긴다)`],
      ]),

      process: [
        h('p', {}, [
          '개념 → 타입 대조표. 원문이 쓴 말 하나하나가 어느 타입으로 환원되는지, 어디서 나온 말인지 함께 적는다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원문 개념']),
              h('th', {}, ['원문 위치']),
              h('th', {}, ['존재론 타입']),
              h('th', {}, ['환원 방식']),
            ]),
          ]),
          h(
            'tbody',
            {},
            CONCEPT_CATALOG.map((entry) =>
              h('tr', { class: entry.kinds.length > 0 ? 'ok' : 'bad' }, [
                h('td', {}, [entry.concept]),
                h('td', { class: 'id' }, [entry.source]),
                h('td', {}, [
                  entry.kinds.length === 0
                    ? h('span', { class: 'empty' }, ['(미분류)'])
                    : h('code', {}, [entry.kinds.join(' + ')]),
                ]),
                h('td', {}, [entry.note]),
              ]),
            ),
          ),
        ]),
      ],

      candidates: [
        h('p', {}, [
          '타입별 커버 현황 — 아무 개념도 쓰지 않는 타입이 있으면 존재론이 과한 것이고, 필드가 없으면 아직 안 선 것이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['타입']),
              h('th', {}, ['덮는 개념 수']),
              h('th', {}, ['장면 등장']),
              h('th', {}, ['필드 정의']),
            ]),
          ]),
          h(
            'tbody',
            {},
            ONTOLOGY_KINDS.map((kind: OntologyKind) => {
              const covered = report.byKind[kind].length;
              const ok = covered > 0 && implemented.includes(kind);
              return h('tr', { class: ok ? 'ok' : 'bad' }, [
                h('td', {}, [h('code', {}, [kind])]),
                h('td', {}, [`${bar(covered)} ${String(covered)}`]),
                h('td', { class: 'num' }, [String(counts[kind])]),
                h('td', {}, [implemented.includes(kind) ? '✔' : '✘ 이름표만']),
              ]);
            }),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          '검증 장면의 원소들 — 스스로 밝힌 이름표(kind)와 검사기의 판정이 일치해야 통과다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원소']),
              h('th', {}, ['선언']),
              h('th', {}, ['판정']),
              h('th', {}, ['id']),
            ]),
          ]),
          h(
            'tbody',
            {},
            HUNTER_SCENE.map((node) => {
              const verdict = classify(node).kind;
              return h('tr', { class: verdict === node.kind ? 'ok' : 'bad' }, [
                h('td', {}, [sceneLabel(node)]),
                h('td', {}, [h('code', {}, [node.kind])]),
                h('td', {}, [verdict === null ? '거부' : verdict]),
                h('td', { class: 'id' }, [node.id]),
              ]);
            }),
          ),
        ]),
      ],

      beforeAfter: [
        h('h3', {}, ['실제 세계 vs 주체가 믿는 세계']),
        h('p', {}, [
          '같은 약초를 두고 State 는 마비독이라 적고 Claim 은 치유 효과라 적는다. 둘 다 온전한 원소다 — 틀린 믿음이 곧 콘텐츠다.',
        ]),
        diffView(
          { 대상: toxin.ofId, 값: toxin.value, 근거: '생태 규칙' },
          { 대상: healingClaim.aboutId, 값: healingClaim.assertion, 근거: `확신 ${String(healingClaim.confidence)}` },
          { leftLabel: '실제 (State)', rightLabel: '믿음 (Claim)' },
        ),
        h('h3', {}, ['요구의 근거 사슬']),
        diffView(
          { 요구: accessPath.description, 가능성: forageWay.direction, 의존: foodNeed.desiredCondition, 끊긴곳: [] },
          {
            요구: accessPath.description,
            가능성: forageWay.direction,
            의존: foodNeed.desiredCondition,
            끊긴곳: [...gaps],
          },
          { leftLabel: '기대 (이어짐)', rightLabel: '실제' },
        ),
      ],

      failure: [
        h('p', {}, ['결함 원소는 무엇을 어겼고 어디서 걸리는가 — 사유와 경로가 함께 나와야 고칠 수 있다.']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유·경로']),
              h('th', {}, ['실제']),
              h('th', {}, ['메시지']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', { class: 'path' }, [row.actual])]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '원문 개념 → 카탈로그 한 줄(개념·원문 위치·타입·환원 방식) → 커버리지 대조 → 판정',
        '덮이지 않은 개념이 남으면 존재론이 모자라고, 쓰이지 않는 타입이 남으면 존재론이 과하다 — 둘 다 미완결이다',
        '판별은 값을 읽어서만 한다 — 존재론 원소는 kind 로 자기를 밝히는 평범한 레코드다 (함수·클로저 금지)',
        '식별자는 V1 결정적 ID 만 받는다 — 유래 없는 이름은 리플레이가 성립하지 않는다',
        'S·D·P 계층은 이 타입들을 확장한다. 필드를 더하는 것은 허용, 빼는 것은 금지',
      ),
    },
  };

  return pageView(spec);
}
