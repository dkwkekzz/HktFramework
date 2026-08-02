// /lab/s0 — S0 공통 주체 모델.
//
// 화면이 보여야 하는 것은 하나다: **다섯 종류의 주체가 서로 다른 방식으로 세계에 걸려 있는데도
// 같은 다섯 질문에 답한다.** 그래서 가운데에 주체 5종 × 질문 5개 격자를 놓고, 그 위아래로
// 각자가 어떻게 걸려 있는지(경계·감지)와 무엇이 그 답을 막는지(결함 주체 13종)를 편다.

import {
  answerFive,
  BOUNDARY_REQUIREMENTS,
  boundaryLabel,
  CHANNEL_SPECS,
  checkSubjectProfile,
  commonInterfaceReport,
  commonInterfaceVerdict,
  perceives,
  perceptionSummary,
  QUESTION_SPECS,
  SUBJECT_GRAPH_SPECS,
  subjectVerdict,
  checkSubjects,
  type SubjectProfile,
} from '@hkt/core/s0';
import { runScenarios } from '@hkt/scenarios';
import { s0Scenarios } from '@hkt/scenarios/suites/s0';
import {
  BROKEN_SUBJECTS,
  S0_DEFINITIONS,
  VEIL_SUBJECTS,
} from '@hkt/scenarios/suites/s0-veil-subjects';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 붉은 장막이 걷힐 때의 빛 — 같은 현상 하나를 다섯이 각자의 감각으로 맞는다. */
const VEIL_LIGHT = { channel: 'light', intensity: 0.6 } as const;
const VEIL_DISTANCE = 120;

export function s0Page(): VElement {
  const report = checkSubjects(VEIL_SUBJECTS, S0_DEFINITIONS);
  const grid = commonInterfaceReport(VEIL_SUBJECTS, S0_DEFINITIONS);
  const suite = runScenarios(s0Scenarios);

  const brokenRows = BROKEN_SUBJECTS.map((entry) => {
    const violations = checkSubjectProfile(entry.value, S0_DEFINITIONS);
    const first = violations[0];
    const mute = answerFive(entry.value, S0_DEFINITIONS)
      .answers.filter((answer) => !answer.answered)
      .map((answer) => answer.key);
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first === undefined ? '(통과해 버렸다)' : first.rule,
      path: first?.path ?? '',
      message: first?.message ?? '',
      mute: mute.join(' '),
    };
  });
  const allRejected = brokenRows.every((row) => row.expected === row.actual);

  const spec: PageSpec = {
    id: 'S0',
    title: '공통 주체 모델',
    purpose:
      '사람·생물·조직·국가·신이 하나의 공통 인터페이스로 서서 다섯 질문(감지·의존·능력·기억·유지)에 전부 답하게 한다.',
    verdict: {
      passed: grid.complete && report.complete && suite.failed === 0 && allRejected,
      label: grid.complete
        ? `${commonInterfaceVerdict(grid)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : commonInterfaceVerdict(grid),
    },
    sections: {
      input: keyValueView([
        ['주체 선언', `${String(VEIL_SUBJECTS.length)}명 — 사람·생물·조직·국가·신 하나씩 (붉은 장막 세계)`],
        ['정의 집합', `${String(S0_DEFINITIONS.length)}개 — O0 를 지난 능력 셋 + 종 여섯`],
        ['세계 자리', 'O2 상태 스키마 9영역 — 의존·유지가 가리키는 자리는 전부 여기에 있어야 한다'],
        ['결함 주체', `${String(BROKEN_SUBJECTS.length)}종 (전부 O1 로서는 온전한 Subject 다)`],
      ]),

      process: [
        h('p', {}, [
          '주체 종류마다 세계에 걸리는 방식이 다르다. 경계가 없으면 아무것도 잃지 않고, 잃을 것이 없으면 목적도 생기지 않는다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['주체 종류']),
              h('th', {}, ['반드시 있어야 할 경계']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            BOUNDARY_REQUIREMENTS.map((entry) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [h('code', {}, [entry.subjectKind])]),
                h('td', {}, [entry.required.join(' + ')]),
                h('td', {}, [entry.reason]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['감지 통로 6종 — 몸을 거치는가, 남을 거치는가']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['통로']), h('th', {}, ['경로']), h('th', {}, ['뜻'])]),
          ]),
          h(
            'tbody',
            {},
            CHANNEL_SPECS.map((entry) =>
              h('tr', { class: entry.route === 'body' ? 'ok' : '' }, [
                h('td', {}, [entry.label]),
                h('td', {}, [h('code', {}, [entry.route])]),
                h('td', {}, [entry.note]),
              ]),
            ),
          ),
        ]),
      ],

      candidates: [
        h('p', {}, [
          '붉은 장막에 선 다섯 — 각자 무엇으로 세계에 걸려 있고 무엇을 감지하는가. 걸리는 방식도 감각도 전부 다르다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['주체']),
              h('th', {}, ['종류']),
              h('th', {}, ['경계']),
              h('th', {}, ['감지']),
            ]),
          ]),
          h(
            'tbody',
            {},
            VEIL_SUBJECTS.map((subject: SubjectProfile) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [subject.name]),
                h('td', {}, [h('code', {}, [subject.subjectKind])]),
                h('td', {}, [subject.boundaries.map(boundaryLabel).join(' · ')]),
                h('td', {}, [perceptionSummary(subject.perception)]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['같은 현상, 다섯 개의 세계']),
        h('p', {}, [
          `둥지에서 붉은 장막이 걷힌다 (빛 · 세기 ${String(VEIL_LIGHT.intensity)} · ${String(VEIL_DISTANCE)}m 거리). 같은 사건이 누구에게는 일어나고 누구에게는 일어나지 않는다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [h('th', {}, ['주체']), h('th', {}, ['감지']), h('th', {}, ['이유'])]),
          ]),
          h(
            'tbody',
            {},
            VEIL_SUBJECTS.map((subject: SubjectProfile) => {
              const verdict = perceives(subject.perception, VEIL_LIGHT, VEIL_DISTANCE);
              return h('tr', { class: verdict.perceived ? 'ok' : 'bad' }, [
                h('td', {}, [subject.name]),
                h('td', {}, [verdict.perceived ? '본다' : '못 본다']),
                h('td', {}, [verdict.message]),
              ]);
            }),
          ),
        ]),
      ],

      selection: [
        h('p', {}, [
          '주체 5종 × 질문 5개 격자. 이 표가 다 차는 것이 S0 의 목적 그 자체다 — 답하는 방법은 전부 달라도 답이 있다는 것은 같다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['주체']),
              ...QUESTION_SPECS.map((question) => h('th', {}, [question.question])),
            ]),
          ]),
          h(
            'tbody',
            {},
            grid.reports.map((entry) =>
              h('tr', { class: entry.complete ? 'ok' : 'bad' }, [
                h('td', {}, [`${entry.subjectName} (${entry.subjectKind})`]),
                ...entry.answers.map((answer) =>
                  h('td', { class: answer.answered ? '' : 'bad' }, [
                    answer.answered ? answer.answer : `✘ ${answer.answer}`,
                  ]),
                ),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['아직 자리만 열린 것들']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['그래프']),
              h('th', {}, ['어느 질문을 여는가']),
              h('th', {}, ['채울 모듈']),
              h('th', {}, ['사냥꾼의 자리']),
            ]),
          ]),
          h(
            'tbody',
            {},
            SUBJECT_GRAPH_SPECS.map((graph) =>
              h('tr', {}, [
                h('td', {}, [graph.label]),
                h('td', {}, [graph.question]),
                h('td', {}, [h('code', {}, [graph.owner])]),
                h('td', { class: 'id' }, [(VEIL_SUBJECTS[0] as SubjectProfile)[graph.field]]),
              ]),
            ),
          ),
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          '주체가 세계에 들어가기 전과 후 — 어긴 주체는 들어가지 않고 사유로 남는다 (O2 조립·O0 정의와 같은 태도).',
        ]),
        keyValueView([
          ['들이려는 주체', `${String(VEIL_SUBJECTS.length)}명`],
          ['세계에 선 주체', `${String(report.accepted.length)}명 — ${subjectVerdict(report)}`],
          ['막힌 주체', `${String(report.rejected.length)}명`],
        ]),
      ],

      failure: [
        h('p', {}, [
          '결함 주체는 무엇을 어겼고 어느 질문이 막히는가. 전부 O1 로서는 온전한 Subject 다 — S0 이 없으면 그대로 세계에 들어갔을 주체들이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['막힌 질문']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.mute]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '경계가 있어야 잃을 것이 생기고, 잃을 것이 있어야 무너질 조건(의존)이 생긴다 — 그래서 경계가 무너지면 다섯 질문 전부가 막힌다',
        '몸(body) 경계가 없는 조직·국가·신은 몸의 감각을 갖지 못한다 — 보고와 의념 잔향으로만 안다. 그래서 국가는 늘 늦게 알고, 보고하는 자가 국가의 눈이 된다',
        '의존은 경계 안, 유지는 경계 밖도 가능하다 — 내 것이 아닌 것을 원하는 데서 P 계층의 목적이 자란다',
        '능력은 인용이다 — O0 공리를 어긴 능력은 아무에게도 붙지 않는다. 누구도 예외가 아니다',
        '개체는 종에서 태어나고 ID 도 거기서 나온다 — 종이 열지 않은 자리로 무너질 수는 없다 (S1·S3 이 이 자리를 이어받는다)',
        '다섯이 같은 다섯 질문에 답하므로, 뒤의 계층(D 의존 · P 가능성 · R 지각)은 주체의 종류를 묻지 않고 한 통로로 다룰 수 있다',
      ),
    },
  };

  return pageView(spec);
}
