// /lab/p4 — P4 목적 선택과 유지.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **요소 아홉은 어디서 오는가.** 여덟은 앞 계층에서 읽고 매몰비용 하나만 P4 자신이다.
//      출처표가 화면에 그대로 서므로, 목적 선택이 취향이 아니라는 것이 눈으로 확인된다.
//   ② **후보별 점수표와 선택 마크.** 후보마다 아홉이 밀고 당긴 몫이 펴지고, 뽑힌 것에 마크가
//      선다. 그리고 **압력 1위와 선택이 갈리는 자리**가 같은 표에서 보인다.
//   ③ **관성 여유선.** 2위를 좇던 자가 1위를 앞에 두고도 바뀌지 않는다 — 차이가 문턱보다 작다.
//      몫이 생겨 차이가 문턱을 넘으면 그때는 갈아탄다.

import {
  GOAL_CASES,
  SEEING_CASE,
  STOCKED_CASE,
  SWITCH_CASE,
  UNKNOWING_CASE,
  type GoalCase,
} from '@hkt/scenarios/suites/p4-veil-goals';
import { p4Scenarios } from '@hkt/scenarios/suites/p4';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { directionLabel } from '@hkt/core/p1';
import {
  CHANGE_LABELS,
  checkFactorSources,
  FACTOR_LABELS,
  FACTOR_SOURCES,
  INERTIA_MARGIN,
  payabilityOf,
  payabilityVerdict,
  PAYMENT_VERDICTS,
  selectionVerdict,
  VERDICT_LABELS,
  type GoalScore,
  type GoalSelection,
} from '@hkt/core/p4';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const sourceViolations = checkFactorSources();

/** ① 요소 아홉의 출처표 — 어디서 오는가, 얼마나 무거운가. */
function sourceTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['요소']),
        h('th', {}, ['출처']),
        h('th', {}, ['무엇을 읽는가']),
        h('th', {}, ['무게']),
      ]),
    ]),
    h(
      'tbody',
      {},
      FACTOR_SOURCES.map((source) =>
        h('tr', { class: source.layer === 'P4' ? '' : 'ok' }, [
          h('td', {}, [FACTOR_LABELS[source.id]]),
          h('td', {}, [source.layer]),
          h('td', {}, [source.reads]),
          h('td', {}, [source.weight.toFixed(1)]),
        ]),
      ),
    ),
  ]);
}

/** 점수를 0~1 로 옮긴다 — 게이지는 음수를 그리지 못한다. 가운데(0.5)가 점수 0 이다. */
const gaugeValue = (score: number): number => (score + 1) / 2;

/** 후보별 점수표 — 선택 마크와 함께. */
function scoreGauge(selection: GoalSelection): VElement {
  const chosen = selection.goal?.possibilityId ?? null;
  const pressing = selection.mostPressing?.possibilityId ?? null;
  return gaugeView(
    selection.scores.map((score) => ({
      label: `${score.ready ? '' : '○ '}${score.possibilityId === chosen ? '◆ ' : ''}${
        score.possibilityId === pressing ? '▲ ' : ''
      }${score.label} · ${directionLabel(score.direction)}`,
      value: gaugeValue(score.score),
      level: score.possibilityId === chosen ? 'met' : score.ready ? 'unstable' : 'critical',
      levelLabel: score.score.toFixed(3),
      hint: score.note,
      detail: score.viaAtom === null ? '낼 원자 없음' : atomLabel(score.viaAtom),
    })),
    { caption: '◆ 고른 것 · ▲ 압력 1위 · ○ 선행이 서지 않아 지금은 고를 수 없는 것 (가운데가 점수 0)' },
  );
}

/** 고른 후보의 요소 아홉이 밀고 당긴 몫. */
function factorTable(selection: GoalSelection): VElement {
  const goal = selection.goal;
  const standing =
    goal === null
      ? null
      : (selection.scores.find((score) => score.possibilityId === goal.possibilityId) ?? null);
  if (standing === null) return h('p', { class: 'empty' }, ['(고른 목적이 없다)']);
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['요소']),
        h('th', {}, ['출처']),
        h('th', {}, ['값']),
        h('th', {}, ['× 무게']),
        h('th', {}, ['왜 그 값인가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      standing.factors.map((factor) =>
        h('tr', { class: factor.contribution > 0 ? 'ok' : '' }, [
          h('td', {}, [FACTOR_LABELS[factor.id]]),
          h('td', {}, [factor.layer]),
          h('td', {}, [factor.value.toFixed(2)]),
          h('td', {}, [factor.contribution.toFixed(3)]),
          h('td', {}, [factor.note]),
        ]),
      ),
    ),
  ]);
}

/** 장면 하나 — 어떤 04 가 무엇을 고르는가. */
function caseCard(entry: GoalCase): VElement {
  return h('div', { class: 'case' }, [
    h('h3', {}, [entry.label]),
    h('p', { class: 'tells' }, [entry.tells]),
    h('p', {}, [selectionVerdict(entry.selection)]),
    // 후보가 0 인 것도 결과다 — 빈 게이지가 아니라 문장으로 세운다.
    entry.selection.scores.length === 0
      ? h('p', { class: 'tells' }, [
          '후보가 하나도 서지 않았다. P3 이 펴 놓은 것이 없으면 P4 가 고를 것도 없다 — 목적은 세계가 준 것에서만 선다.',
        ])
      : scoreGauge(entry.selection),
  ]);
}

/** 압력 1위와 선택이 어디서 갈리는가. */
function divergenceTable(): VElement {
  const rows = GOAL_CASES.filter((entry) => entry.selection.scores.length > 0);
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['장면']),
        h('th', {}, ['압력 1위']),
        h('th', {}, ['지금 낼 수 있는가']),
        h('th', {}, ['고른 것']),
        h('th', {}, ['갈리는가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map((entry) => {
        const pressing: GoalScore | null = entry.selection.mostPressing;
        const goal = entry.selection.goal;
        const diverged = pressing !== null && goal !== null && pressing.possibilityId !== goal.possibilityId;
        return h('tr', { class: diverged ? 'ok' : '' }, [
          h('td', {}, [entry.label]),
          h('td', {}, [
            pressing === null
              ? '(없음)'
              : `${pressing.label} · ${directionLabel(pressing.direction)} (${pressing.factors[0]?.value.toFixed(2) ?? ''})`,
          ]),
          h('td', {}, [pressing === null ? '—' : pressing.ready ? '낼 수 있다' : '선행이 서지 않았다']),
          h('td', {}, [
            goal === null ? '(고를 것이 없다)' : `${goal.label} · ${directionLabel(goal.direction)}`,
          ]),
          h('td', {}, [diverged ? '갈린다' : '같다']),
        ]);
      }),
    ),
  ]);
}

/** 관성 — 문턱을 넘었는가. */
function inertiaTable(): VElement {
  const rows = GOAL_CASES.filter((entry) => entry.spec.previousGoal != null);
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['장면']),
        h('th', {}, ['좇던 것']),
        h('th', {}, ['1위']),
        h('th', {}, ['차이']),
        h('th', {}, ['문턱']),
        h('th', {}, ['결과']),
      ]),
    ]),
    h(
      'tbody',
      {},
      rows.map((entry) => {
        const previous = entry.spec.previousGoal;
        const goal = entry.selection.goal;
        return h('tr', { class: goal?.changed === true ? '' : 'ok' }, [
          h('td', {}, [entry.label]),
          h('td', {}, [
            previous == null ? '—' : `${previous.label} · ${directionLabel(previous.direction)}`,
          ]),
          h('td', {}, [
            entry.selection.best === null
              ? '—'
              : `${entry.selection.best.label} · ${directionLabel(entry.selection.best.direction)}`,
          ]),
          h('td', {}, [entry.selection.margin.toFixed(3)]),
          h('td', {}, [INERTIA_MARGIN.toFixed(2)]),
          h('td', {}, [
            goal === null ? '(없음)' : `${CHANGE_LABELS[goal.change]} — ${goal.label} · ${directionLabel(goal.direction)}`,
          ]),
        ]);
      }),
    ),
  ]);
}

/** 치를 자리의 세 판정 — P3 이 넘긴 부채를 갚은 자리. */
function paymentTable(): VElement {
  const spec = { actorId: SEEING_CASE.spec.subject.id, world: SEEING_CASE.spec.world };
  const chosen = [
    ...new Set(
      STOCKED_CASE.selection.scores.flatMap((score) => (score.viaAtom === null ? [] : [score.viaAtom])),
    ),
  ];
  return keyValueView([
    ...PAYMENT_VERDICTS.map(
      (verdict): readonly [string, string] => [
        VERDICT_LABELS[verdict],
        verdict === 'payable'
          ? '치를 것이 있다'
          : verdict === 'blocked'
            ? '지금은 없고 그 자리를 세우는 원자가 있다 — 그것이 재료 선행이다'
            : '아무 행동도 그 자리를 세우지 못한다 — 막지 않고 위험으로 잰다',
      ],
    ),
    ...(['exchange', 'acquire', 'seize', 'ally'] as const).map(
      (atom): readonly [string, string] => [
        `빈손인 04 의 ${atomLabel(atom)}`,
        payabilityVerdict(payabilityOf(atom, spec)),
      ],
    ),
    ['몫이 있는 04 가 고르는 원자들', chosen.map((atom) => atomLabel(atom)).join(' · ')],
  ]);
}

export function p4Page(): VElement {
  const suite = runScenarios(p4Scenarios);
  const passed = suite.failed === 0 && sourceViolations.length === 0;

  const spec: PageSpec = {
    id: 'P4',
    title: '목적 선택과 유지',
    purpose:
      '펴 놓은 가능성 중 실제로 추구할 목적 하나를 고르고, 매 틱 흔들리지 않게 관성을 준다 — 가장 급한 것이 항상 뽑히지는 않는다.',
    verdict: {
      passed,
      label: passed
        ? `요소 ${String(FACTOR_SOURCES.length)} · 장면 ${String(GOAL_CASES.length)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'P3 까지 오면 주체 앞에는 지금 펼 수 있는 갈래들이 놓인다. 그런데 주체는 하나이고 몸도 하나다 — 전부를 동시에 좇을 수는 없다. P4 가 받는 것은 그 갈래와, 원문이 이름으로만 적은 평가 요소 아홉을 실어 나르는 앞 계층의 값들이다.',
        ]),
        keyValueView([
          ['후보 (P3 PossibilitySubgraph)', `지금 보는 04 의 활성 갈래 ${String(SEEING_CASE.selection.scores.length)}`],
          ['압력', 'D4 가 재고 P1 이 갈래에 붙인 값 — 두 곳에서 재지 않는다'],
          ['성공률·기억', 'P3 근거(봄·기억)와 선행, 그리고 P0 저항'],
          ['비용·위험', 'P0 걸림(치르는 자리·되돌림·동의)과 O2 잔량'],
          ['가치관', 'S0 ValueTarget.weight — "P4 목적 선택의 가중치" 라고 S0 가 적어 둔 자리'],
          ['관계·약속', '세계의 relational 자리 (신뢰·빚)'],
          ['매몰비용', '이전 틱의 ActiveGoal — 앞 계층 어디에도 없는, 고르는 자만 아는 값'],
        ]),
      ],

      process: [
        h('p', {}, [
          '요소를 P4 가 손으로 매기면 목적 선택은 취향이 되고, 왜 그것이 뽑혔는지 아무도 말하지 못한다. 그래서 요소마다 출처를 못박는다 — **여덟은 앞 계층에서 오고, P4 자신이 출처인 것은 매몰비용 하나뿐이다.**',
        ]),
        sourceTable(),
        h('p', {}, [
          '치를 것이 없을 때 그것이 막힌 것인지 브레이크가 없는 것인지도 P4 가 새로 정하지 않는다 — P3-a 가 자리마다 붙여 둔 "세우는 원자" 목록이 그대로 갈림이다.',
        ]),
        paymentTable(),
      ],

      candidates: [
        h('p', {}, [
          '같은 04 를 여섯으로 나눈다. 갈래는 P3 이 편 그대로이고, 갈리는 것은 세계와 이전 목적뿐이다.',
        ]),
        ...GOAL_CASES.map(caseCard),
      ],

      selection: [
        h('p', {}, [
          '**압력 1위와 선택이 어디서 갈리는가.** 압력은 아홉 중 가장 무거운 요소이지만 하나일 뿐이고, 선행이 서지 않은 것은 아무리 급해도 지금 고를 수 없다.',
        ]),
        divergenceTable(),
        h('p', {}, [
          '모르는 04 에게 겨울 식량은 위기(0.31)이고 마비독 감별은 불안정(0.10)일 뿐이다. 그런데 뽑히는 것은 찾기다 — 아홉 전부에 찾기가 선행으로 걸려 있기 때문이다. **고르는 일이 저절로 앞칸으로 옮겨 간다.**',
        ]),
        h('h3', {}, ['고른 목적을 당긴 아홉 — 몫이 있는 04']),
        factorTable(STOCKED_CASE.selection),
        h('p', {}, [
          '몫이 둘 생기자 주고받기가 선다. 그 원자만이 `relational.trust` 를 세우고(P3-a), 04 의 유지 자리가 바로 그 신뢰이며, 마을에 진 빚 40 이 갚을 자리를 가리킨다 — **압력이 가장 낮은 갈래가 뽑힌다.**',
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'P3 이 넘긴 것은 "펴 놓은 갈래" 였고 그중 무엇을 좇는지는 비어 있었다. P4 이후로는 찬다 — 그리고 다음 틱에 쉽게 놓지 않는다.',
        ]),
        keyValueView([
          ['전 — P3 이 남긴 것', '활성 부분 그래프. 무엇을 좇을지는 아무도 몰랐다'],
          ['후 — P4 가 더한 것', '후보별 점수 + 고른 목적 하나 + 관성 문턱'],
          ['빈손인 04', selectionVerdict(SEEING_CASE.selection)],
          ['모르는 04', selectionVerdict(UNKNOWING_CASE.selection)],
          ['몫이 있는 04', selectionVerdict(STOCKED_CASE.selection)],
          ['몫이 생긴 04', selectionVerdict(SWITCH_CASE.selection)],
          [
            '관성의 두 얼굴',
            `문턱 ${INERTIA_MARGIN.toFixed(2)} 은 자라지 않는다 — 자라는 몫은 매몰비용 요소가 맡는다`,
          ],
        ]),
        inertiaTable(),
        h('p', {}, [
          '2위를 좇던 04 는 1위를 앞에 두고도 바뀌지 않는다(차이가 문턱보다 작다). 몫이 생겨 차이가 문턱을 넘으면 그때는 갈아탄다 — **버리려던 것을 다시 붙든다.**',
        ]),
      ],

      failure: [
        h('p', {}, [
          '고르는 일은 값을 하나로 접는 일이라 근거를 잃기 쉽다. 그래서 관문은 대부분 유래를 지킨다.',
        ]),
        lines(
          'unsourced-factor — 앞 계층에서 오지 않은 힘이 목적을 민다 (지어낸 요소 · P4 참칭 · 아홉 중 누락)',
          'factor-out-of-range — 요소 값이 −1~1 밖이다',
          'phantom-candidate — P3 이 펴지 않은 것을 후보로 든다',
          'score-drift — 점수가 요소 아홉에서 다시 나오지 않는다',
          'unheld-goal — 후보에 없는 것을 좇는다',
          'premature-goal — 선행이 서지 않은 것을 골랐다',
          'inertia-without-history — 밀어낼 것이 없는데 문턱이 있다 · 아직 오지 않은 시각부터 좇는다',
          'absent-grounding — 세계 걸림이 없는 원자의 대가를 묻는다',
          'unslotted-payment — 치를 자리가 O2 스키마에 없다',
          'unsourced-payment — 세우는 원자도 없고 예외 선언도 없는 자리를 치른다',
        ),
        suiteView(suite),
      ],

      causality: [
        lines(
          'P3-a 재료 선행 요구 × O2 잔량 → 막힘인가 브레이크 없음인가 (P4-a) — P4 가 새로 정하지 않는다',
          '앞 계층 여덟 + 매몰비용 하나 → 평가 요소 아홉 (P4-b) — 출처표가 지어낸 힘을 막는다',
          '요소 아홉 → 점수 하나 → 지금 낼 수 있는 것 중 1위 (P4-c)',
          '선행이 서지 않은 것은 고를 수 없다 → 고르는 일이 앞칸으로 옮겨 간다 (급한 것보다 먼저 할 것이 있다)',
          '관성은 갈아타기 문턱이지 점수가 아니다 → 자라는 몫은 매몰비용 요소가 맡는다',
          '다음 → P5 가 고른 목적을 행동 원자 시퀀스로 분해한다',
          '남은 자리: 갈래를 낼 원자는 가장 나은 하나로 접는다 — 순서열은 P5 의 몫이다',
          '남은 자리: 사이는 상대를 지목하지 않고 적힌 상대들의 평균으로 읽는다 — D5·R 이 지목한다',
        ),
      ],
    },
  };

  return pageView(spec);
}
