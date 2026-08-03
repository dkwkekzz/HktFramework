// /lab/p5 — P5 전략과 행동 계획.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **같은 목적, 다른 길이.** 같은 04 인데 손에 쥔 것과 본 것에 따라 사슬이 한 걸음에서
//      세 걸음까지 펴진다. 타임라인이 나란히 서므로 길이의 차이가 그림으로 보인다.
//   ② **순서는 P5 가 정하지 않았다.** 걸음마다 "무엇을 위해 · 어느 자리를 채우려고" 가 붙고,
//      그 자리는 P3-a 선행표와 P4-a 판정에서 그대로 온 것이다.
//   ③ **원문 일곱이 세 걸음으로 접힌다.** 이동·획득·운반이 획득 한 칸에 서고,
//      접근 권한 확보 하나만 유예로 남는다 — 권한을 세우는 원자가 열여섯에 없기 때문이다.

import {
  CHAIN_REPORT,
  PLAN_CASES,
  SEIZE_PLAN,
  type PlanCase,
} from '@hkt/scenarios/suites/p5-veil-plans';
import { p5Scenarios } from '@hkt/scenarios/suites/p5';
import { runScenarios } from '@hkt/scenarios';
import { atomLabel } from '@hkt/core/p0';
import { directionLabel } from '@hkt/core/p1';
import { VERDICT_LABELS } from '@hkt/core/p4';
import {
  chainVerdict,
  DEFERRED_STEPS,
  MAX_PLAN_DEPTH,
  P5_CHAIN,
  planVerdict,
  reconcileChain,
  REASON_LABELS,
  type ActionPlan,
} from '@hkt/core/p5';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { stepLegend, timelineView } from '../renderers/timeline.ts';
import { h, type VElement } from '../vnode.ts';

const reconciled = reconcileChain();

/** 계획 하나를 타임라인으로. */
function planView(plan: ActionPlan | null, emptyText: string): VElement {
  return timelineView(
    (plan?.steps ?? []).map((step) => ({
      order: step.order,
      label: step.label,
      kind: step.reason,
      badge:
        step.reason === 'goal'
          ? `${REASON_LABELS[step.reason]} · ${VERDICT_LABELS[step.verdict]}`
          : REASON_LABELS[step.reason],
      note: step.note,
      hint: `${step.label} — ${VERDICT_LABELS[step.verdict]}${
        step.unbrakedSlots.length === 0 ? '' : ` (${step.unbrakedSlots.join('·')})`
      }`,
      ...(step.reason === 'goal' ? { emphasis: true } : {}),
    })),
    { emptyText },
  );
}

/** 장면 하나 — 어떤 04 가 몇 걸음을 밟는가. */
function caseCard(entry: PlanCase): VElement {
  return h('div', { class: 'case' }, [
    h('h3', {}, [entry.label]),
    h('p', { class: 'tells' }, [entry.tells]),
    h('p', {}, [entry.plan === null ? '고른 목적이 없어 계획도 없다' : planVerdict(entry.plan)]),
    planView(entry.plan, '고른 목적이 없다 — 계획은 목적에서만 자란다'),
  ]);
}

/** 걸음마다 그 자리를 누가 정했는가. */
function provenanceTable(plan: ActionPlan): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['#']),
        h('th', {}, ['걸음']),
        h('th', {}, ['왜 그 자리인가']),
        h('th', {}, ['무엇을 위해']),
        h('th', {}, ['어느 자리']),
        h('th', {}, ['지금 낼 수 있는가']),
      ]),
    ]),
    h(
      'tbody',
      {},
      plan.steps.map((step) =>
        h('tr', { class: step.reason === 'goal' ? 'ok' : '' }, [
          h('td', {}, [String(step.order)]),
          h('td', {}, [step.label]),
          h('td', {}, [REASON_LABELS[step.reason]]),
          h('td', {}, [step.forAtom === null ? '(목적)' : atomLabel(step.forAtom)]),
          h('td', {}, [step.forSlot ?? '—']),
          h('td', {}, [
            `${VERDICT_LABELS[step.verdict]}${
              step.unbrakedSlots.length === 0 ? '' : ` — ${step.unbrakedSlots.join('·')}`
            }`,
          ]),
        ]),
      ),
    ),
  ]);
}

/** 원문 일곱 줄 대조표. */
function chainTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['원문 단계']),
        h('th', {}, ['원자']),
        h('th', {}, ['갈래']),
        h('th', {}, ['계획에 섰는가']),
        h('th', {}, ['왜']),
      ]),
    ]),
    h(
      'tbody',
      {},
      CHAIN_REPORT.resolutions.map((entry) =>
        h('tr', { class: entry.reached ? 'ok' : '' }, [
          h('td', {}, [entry.original]),
          h('td', {}, [entry.atoms.length === 0 ? '(유예)' : entry.atoms.map(atomLabel).join(' · ')]),
          h('td', {}, [entry.kind]),
          h('td', {}, [entry.reached ? '섰다' : '서지 않는다']),
          h('td', {}, [entry.note]),
        ]),
      ),
    ),
  ]);
}

/** 사슬의 길이를 한눈에. */
function lengthTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['장면']),
        h('th', {}, ['목적']),
        h('th', {}, ['걸음']),
        h('th', {}, ['사슬']),
      ]),
    ]),
    h(
      'tbody',
      {},
      PLAN_CASES.map((entry) =>
        h('tr', { class: (entry.plan?.steps.length ?? 0) > 1 ? 'ok' : '' }, [
          h('td', {}, [entry.label]),
          h('td', {}, [
            entry.target === null
              ? '(없다)'
              : `${entry.target.label} · ${directionLabel(entry.target.direction)}`,
          ]),
          h('td', {}, [String(entry.plan?.steps.length ?? 0)]),
          h('td', {}, [
            entry.plan === null ? '—' : entry.plan.steps.map((step) => step.label).join(' → '),
          ]),
        ]),
      ),
    ),
  ]);
}

export function p5Page(): VElement {
  const suite = runScenarios(p5Scenarios);
  const passed = suite.failed === 0 && CHAIN_REPORT.complete && reconciled.complete;
  const unseen = PLAN_CASES[2]?.plan ?? SEIZE_PLAN;

  const spec: PageSpec = {
    id: 'P5',
    title: '전략과 행동 계획',
    purpose:
      '고른 목적을 실제 행동 단위까지 분해한다 — 계획은 새로 만드는 것이 아니라 이미 걸린 "먼저" 를 잇는 것이다.',
    verdict: {
      passed,
      label: passed
        ? `장면 ${String(PLAN_CASES.length)} · 원문 ${String(P5_CHAIN.length)} 단계 → ${String(CHAIN_REPORT.foldedTo)} 걸음 · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'P4 가 낸 목적은 아직 한 걸음이다: "마을과 주고받는다". 실제로는 그전에 가져올 것이 있고, 그전에 볼 것이 있다. P5 가 받는 것은 그 목적과, **이미 먼저를 지고 있는 앞 계층의 값들**이다.',
        ]),
        keyValueView([
          ['좇는 것 (P4 ActiveGoal · GoalScore)', 'P4 가 고른 것도, 미뤄 둔 후보도 편다'],
          ['원자 사이의 먼저 (P3-a)', '관측 선행 · 재료 선행 — 세계를 보지 않고도 서는 표다'],
          ['세계와 맞댄 먼저 (P4-a)', '`PayabilityReport.blockedBy` — 지금 빈 자리를 세우는 원자'],
          ['지금 무엇이 보이는가 (P3-b)', '`ExpansionContext.seen` — 보고 있으면 관측 선행이 걸리지 않는다'],
          ['사슬 상한', `${String(MAX_PLAN_DEPTH)} 칸 — 걸림이 잘못 적힌 날 계획이 영영 돌지 않게`],
        ]),
      ],

      process: [
        h('p', {}, [
          '뒤에서 앞으로 거슬러 올라간다. 그 원자가 지금 못 내는 이유를 묻고, 그 이유를 없애는 원자를 앞에 세우고, 다시 묻는다 — 더 물을 것이 없을 때까지. **P5 가 새로 정하는 것은 없다.**',
        ]),
        stepLegend([
          { kind: 'goal', label: '목적 — 사슬의 끝' },
          { kind: 'cost', label: '치러야 한다 — 재료 선행 (P4-a)' },
          { kind: 'observation', label: '봐야 한다 — 관측 선행 (P3-a)' },
        ]),
        h('p', {}, [
          '두 자리를 못박았다. **브레이크 없는 자리는 사슬을 늘리지 않는다** — 몸·의념·빚·정당성은 세우는 원자가 없으므로 "먼저 할 일" 자체가 생기지 않고 걸음에 위험 표시로만 남는다. 그리고 **한 원자는 사슬에 한 번만 선다** — 앎은 한 번 세우면 남기 때문이고, 그래서 사슬은 나무가 아니라 순서열로 접힌다.',
        ]),
        provenanceTable(unseen),
      ],

      candidates: [
        h('p', {}, [
          '같은 04 를 여섯으로 나눈다. 목적은 P4 가 낸 것이고, 갈리는 것은 손에 쥔 것과 본 것뿐이다.',
        ]),
        ...PLAN_CASES.map(caseCard),
      ],

      selection: [
        h('p', {}, [
          '**사슬의 길이가 세계를 말한다.** P4 가 고른 목적은 정의상 지금 낼 수 있는 것이라 한 걸음이고, 계획이 길어지는 자리는 P4 가 "지금은 못 고른다" 고 미뤄 둔 후보 쪽이다.',
        ]),
        lengthTable(),
        h('h3', {}, ['빚진 04 가 빼앗으려면']),
        h('p', {}, [
          '04 의 신뢰는 0 이고 창고도 비었다(빚 40 이 마을의 신뢰를 다 갉아먹었다). 빼앗기는 신뢰를 치르는데 그 자리를 세우는 것은 주고받기 하나이고, 주고받기는 재고를 치른다 — **등지는 일조차 세 걸음이다.** P3-a 의 마지막 물결이 계획으로 펴진 것이다.',
        ]),
        planView(SEIZE_PLAN, ''),
      ],

      beforeAfter: [
        h('p', {}, [
          'P4 가 넘긴 것은 "무엇을 좇는가" 하나였고 그것을 어떻게 낼지는 비어 있었다. P5 이후로는 순서열이 선다.',
        ]),
        keyValueView([
          ['전 — P4 가 남긴 것', '목적 하나 + 미뤄 둔 후보들. 어떤 순서로 낼지는 아무도 몰랐다'],
          ['후 — P5 가 더한 것', '걸음의 순서열 + 걸음마다의 유래(무엇을 위해·어느 자리)'],
          ['원문 대조', chainVerdict(CHAIN_REPORT)],
          ['환원 검사 (P0 장치를 그대로 쓴다)', reconciled.complete ? '원문 일곱이 16원자 안에서 성립한다' : '성립하지 않는다'],
          [
            '유예',
            DEFERRED_STEPS.map((entry) => `${entry.original} → ${entry.owedTo}`).join(' · '),
          ],
        ]),
        chainTable(),
        h('p', {}, [
          '**원문이 일곱 줄로 적은 사슬이 실제로는 세 걸음이다.** 이동·획득·운반 셋이 획득 한 칸에 서기 때문이고, 그 접힘은 P0 환원표가 이미 정한 것이라 여기서 다시 정하지 않는다. 남는 하나(접근 권한 확보)는 통행권·자격을 세우는 원자가 열여섯에 없어서인데, 여기서 원자를 하나 더 만들면 P0 최소 집합을 깨는 일이므로 **W2 제도 계층으로 유예를 선언**했다.',
        ]),
      ],

      failure: [
        h('p', {}, [
          '계획은 순서가 전부이므로 관문도 순서를 지킨다 — 받치는 것은 반드시 먼저 서야 한다.',
        ]),
        lines(
          'goalless-plan — 낼 원자가 없는데 계획을 세운다',
          'self-standing-step — 걸음이 자기 자신을 딛는다',
          'orphan-step — 목적이 아닌데 무엇을 받치는지 말하지 못한다',
          'unordered-step — 받치는 것이 받쳐지는 것보다 늦게 선다 · 적힌 번호와 선 자리가 다르다',
          'dangling-need — 닿지 못한 자리를 남긴 채 온전하다고 한다',
          'unresolved-step — 원문 단계가 16원자로 환원되지 않고 유예 선언도 없다 · P0 과 갈린다',
          'unreached-step — 환원은 됐는데 계획 어디에도 서지 못한다',
          'stale-deferral — 갚을 곳으로 미뤄 놓았는데 실제로는 환원된다',
        ),
        suiteView(suite),
      ],

      causality: [
        lines(
          'P0 걸림 → P3-a 원자 선행(관측·재료) — 세계를 보지 않고도 서는 표',
          'P3-a 재료 선행 × O2 잔량 → P4-a 한 칸짜리 먼저 (blockedBy)',
          'P4-a 한 칸 → P5-a 사슬 — 더 물을 것이 없을 때까지 되풀이한다',
          '브레이크 없는 자리는 사슬을 늘리지 않는다 → 위험으로만 남는다',
          '뿌리가 찾다 하나뿐이다 → 아무것도 쥐지 않은 세계에서도 열여섯이 전부 닿는다',
          '다음 → 단계 3(R·E 계층): 계획이 세계에 요청으로 나가고, 규칙 엔진이 그것을 받는다',
          '남은 자리: 걸음마다 다른 대상을 보는지는 묻지 않는다 — 관측은 아직 문법 층이고 R3 이 갚는다',
          '남은 자리: 접근 권한 확보는 W2 가 갚는다 — 권한을 세우는 원자가 열여섯에 없다',
        ),
      ],
    },
  };

  return pageView(spec);
}
