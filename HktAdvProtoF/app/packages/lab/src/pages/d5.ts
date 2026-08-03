// /lab/d5 — D5 의존 충돌 탐지.
//
// 화면이 보여야 하는 것은 넷이다.
//
//   ① **겹친다고 다툼은 아니다.** 겹침 열둘 중 다툼이 되는 것은 다섯뿐이고, 나머지 일곱에는
//      왜 안 싸우는지가 값으로 남는다.
//   ② **한 몸이 두 곳에 있을 수 없다.** 사냥꾼 넷이 각자 제 안에 이 다툼을 진다 —
//      D2 가 명시적으로 D5 에 넘긴 자리다.
//   ③ **창고가 비면 넷이 같은 고기를 놓고 갈린다.** 재고 10 에서는 다툼이 아니었다 —
//      단계 3 의 대표 장면이 여기서 값으로 선다.
//   ④ **누가 이기는지는 아무도 모른다.** 이분 그래프의 선은 주체에서 대상으로만 가고,
//      주체끼리는 이어지지 않는다.

import {
  ALONE,
  AUDIT,
  BIPARTITE,
  BODY_CONFLICT,
  BROKEN_CONFLICTS,
  CLAIMS,
  CONTESTS,
  CONTEST_ROWS,
  FOOD_CONFLICT,
  FULL_AUDIT,
  FULL_BIPARTITE,
  GRAPHS,
  NO_WINNER_NOTE,
  PEACES,
  PEACE_NOTE,
  STOCK_WALK,
  TABLE,
} from '@hkt/scenarios/suites/d5-veil-conflicts';
import { d5Scenarios } from '@hkt/scenarios/suites/d5';
import { runScenarios } from '@hkt/scenarios';
import { conflictFieldVerdict, conflictLine } from '@hkt/core/d5';

import { pageView, lines, type PageSpec } from '../page.ts';
import { diffView, keyValueView } from '../renderers/diff.ts';
import { gaugeView } from '../renderers/gauge.ts';
import { graphView } from '../renderers/graph.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const BIPARTITE_KINDS = ['subject', 'opposed', 'scarcity'];
const KIND_LABELS: Readonly<Record<string, string>> = {
  subject: '주체',
  opposed: '양립 불가',
  scarcity: '모자람',
};

/** 주체↔경합 대상 이분 그래프 — 공용 렌더러 ②의 여섯째 소비자. */
function bipartiteView(caption: string, source = BIPARTITE): VElement {
  return graphView(
    source.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      hint: node.hint,
      root: node.root,
    })),
    source.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      relation: edge.relation,
      strength: Math.max(0.15, Math.min(1, edge.strength * 3)),
    })),
    source.nodes.filter((node) => node.root).map((node) => node.id),
    { kinds: BIPARTITE_KINDS, kindLabels: KIND_LABELS, legend: true, caption },
  );
}

/** 겹침마다 어떻게 판정됐는가. */
function contestTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['겹침']),
        h('th', {}, ['축']),
        h('th', {}, ['어디']),
        h('th', {}, ['요구']),
        h('th', {}, ['판정']),
        h('th', {}, ['왜']),
      ]),
    ]),
    h(
      'tbody',
      {},
      CONTEST_ROWS.map((row) =>
        h('tr', { class: row.verdict === '다툼 아님' ? '' : 'warn' }, [
          h('td', {}, [row.label]),
          h('td', {}, [row.axis === 'slot' ? '자리' : '대상']),
          h('td', {}, [row.scope === 'internal' ? '한 주체 안' : '주체 사이']),
          h('td', {}, [String(row.claims)]),
          h('td', { class: 'path' }, [row.verdict]),
          h('td', {}, [row.reason]),
        ]),
      ),
    ),
  ]);
}

/** 주체마다 무엇에 끼어 있는가. */
function subjectTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['주체']),
        h('th', {}, ['다툼']),
        h('th', {}, ['제 안']),
        h('th', {}, ['남과']),
        h('th', {}, ['가장 급한 것']),
      ]),
    ]),
    h(
      'tbody',
      {},
      TABLE.map((row) =>
        h('tr', { class: row.conflicts > 0 ? 'warn' : 'ok' }, [
          h('td', {}, [row.label]),
          h('td', {}, [String(row.conflicts)]),
          h('td', {}, [String(row.internal)]),
          h('td', {}, [String(row.between)]),
          h('td', {}, [
            row.conflicts === 0
              ? '(다툼 없음)'
              : `${row.worst} · 급함 ${row.severity.toFixed(2)}`,
          ]),
        ]),
      ),
    ),
  ]);
}

/** 창고가 비어 가는 걸음 — 어느 칸에서 다툼이 서는가. */
function walkGauge(): VElement {
  const peak = Math.max(...STOCK_WALK.map((step) => step.stock), 1);
  return gaugeView(
    STOCK_WALK.map((step) => ({
      label: `재고 ${String(step.stock)}`,
      value: step.stock / peak,
      level: step.scarcity > 0 ? 'collapsing' : 'met',
      detail: `다툼 ${String(step.conflicts)}(모자람 ${String(step.scarcity)}) · 다툼 아닌 겹침 ${String(step.peaces)} — ${step.note}`,
    })),
    { caption: '넷의 요구를 합치면 12 다 — 세계에 그만큼이 없어지는 칸에서 다툼이 선다' },
  );
}

/** 설 수 없는 다툼들. */
function brokenTable(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['무엇을 어겼나']),
        h('th', {}, ['사유']),
        h('th', {}, ['남은 말']),
      ]),
    ]),
    h(
      'tbody',
      {},
      BROKEN_CONFLICTS.map((entry) =>
        h('tr', {}, [
          h('td', {}, [entry.broke]),
          h('td', { class: 'path' }, [entry.rules.join(', ')]),
          h('td', {}, [entry.messages[0] ?? '']),
        ]),
      ),
    ),
  ]);
}

export function d5Page(): VElement {
  const suite = runScenarios(d5Scenarios);
  const passed = suite.failed === 0 && AUDIT.complete;

  const spec: PageSpec = {
    id: 'D5',
    title: '의존 충돌 탐지',
    purpose:
      '주체 내부·주체 간 의존 충돌을 찾는다 — 같은 것을 원한다고 다 다툼은 아니고, 여기서 콘텐츠의 기본 압력이 만들어진다.',
    verdict: {
      passed,
      label: passed
        ? `겹침 ${String(AUDIT.contests)} · 다툼 ${String(AUDIT.conflicts)} · 다툼 아닌 겹침 ${String(AUDIT.peaces)} · 아무 다툼에도 없는 주체 ${String(AUDIT.calm)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : '검증 실패',
    },
    sections: {
      input: [
        h('p', {}, [
          'D4 까지의 겨울에는 사냥꾼 넷이 있었지만 **넷은 서로를 몰랐다** — 각자의 그래프가 있고 각자의 압력이 있었을 뿐이다. 원문 §18 이 다툼을 다주체가 선 뒤에 두는 이유가 그것이다. 여기서 같은 겨울에 나머지 넷(장막벌레·채집 결사·협곡을 낀 나라·붉은 장막의 어미)을 마저 세운다.',
        ]),
        keyValueView([
          ['그래프 (D1~D3)', `${String(GRAPHS.length)} — 사냥꾼 넷의 개인 그래프와 종 표본 넷 (D2 specimenOf)`],
          ['요구 (D5-a DependencyClaim)', `${String(CLAIMS.length)} — 자리에 걸린 노드는 전부 요구가 된다`],
          ['압력 (D4 PressureReport)', 'D5 는 급함을 다시 재지 않는다 — 그 자리에 기대는 간선의 압력을 읽어 온다'],
          ['세계 (D4 WorldSnapshot)', '모자람을 잴 때만 본다 — 나머지 판정은 그래프끼리의 일이다'],
          ['시간에 걸린 기댐', '요구가 되지 않는다 — 누구에게나 같은 속도로 오고 한 사람이 많이 쓴다고 남의 몫이 줄지 않는다'],
        ]),
      ],

      process: [
        h('p', {}, [
          'D5 가 새로 정하는 것은 **다툼의 조건 둘**뿐이다. 나머지는 전부 앞 계층에서 읽어 온다.',
        ]),
        lines(
          '① 요구 — D1 노드의 자리·대역·대상·대체 가능성을 한 평면에 늘어놓는다 (D5-a)',
          '② 겹침 — 같은 **자리**를 보거나 같은 **대상**을 가리키는 요구 둘 이상 (D5-b)',
          '③ **겹친다고 다툼은 아니다** — 나란히 만족될 수 있으면 다툼이 아니고, 그 사유가 남는다',
          '④ opposed — 같은 자리에 동시에 만족될 수 없는 대역 둘 (한 몸이 두 곳에 있을 수 없다)',
          '⑤ scarcity — 같은 대상에 걸린 최소 필요 합이 세계에 있는 것보다 크다 (**이 조건만 세계를 본다**)',
          '⑥ 셋째 조건(배타적 점유)은 **유예** — 세계에 수용량을 적을 자리가 없다 (W 계층이 갚는다)',
          '⑦ 급함은 D4 에서 읽어 온다 — 두 곳에서 재면 두 값이 갈린다',
          '⑧ **D5 는 이기는 자를 정하지 않는다** — 상황으로 묶는 것은 E0, 확정하는 것은 E3 다',
        ),
        keyValueView([
          ['겹침', `${String(CONTESTS.length)} — 자리 축과 대상 축을 합쳐`],
          ['그중 다툼', `${String(AUDIT.conflicts)} (양립 불가 ${String(AUDIT.opposed)} · 모자람 ${String(AUDIT.scarcity)})`],
          ['겹치지만 다투지 않는 것', `${String(AUDIT.peaces)}`],
          ['그것은 빠뜨림인가', PEACE_NOTE],
        ]),
      ],

      candidates: [
        h('p', {}, [
          '겹침마다 어떻게 판정됐는지가 사유와 함께 선다. **다툼이 아닌 줄이 더 많다** — 사냥꾼과 결사는 같은 협곡을 보고, 여섯이 같은 통행법을 보고, 벌레와 신은 같은 둥지를 보는데 셋 다 다툼이 아니다.',
        ]),
        contestTable(),
        keyValueView([
          [
            '배타적 점유는 왜 유예인가',
            '"이 대상은 한 번에 한 요구만 받는다" 를 판정하려면 세계에 수용량을 적을 자리가 있어야 하는데 O2 에 없다 — 여기서 지어내면 D5 가 정하는 것이 늘어난다 (W 계층이 갚는다)',
          ],
        ]),
      ],

      selection: [
        h('p', {}, [
          '**주체↔경합 대상 이분 그래프.** 한쪽 열은 주체, 다른 열은 그들이 함께 보는 것이다 — **선은 언제나 주체에서 대상으로만 가고 주체끼리는 이어지지 않는다.**',
        ]),
        bipartiteView(
          `바닥난 겨울 — ${conflictFieldVerdict(AUDIT)}`,
        ),
        keyValueView([
          ['왜 주체끼리 잇지 않는가', NO_WINNER_NOTE],
          ['선의 굵기', '그 요구의 압력 — D4 가 잰 값이다'],
        ]),
        subjectTable(),
      ],

      beforeAfter: [
        h('p', {}, [
          '**창고가 비면 넷이 같은 고기를 놓고 갈린다.** 재고 10 에서는 같은 것을 원해도 다툼이 아니었다 — 넷의 요구를 합쳐도 세계에 있는 것이 더 많았기 때문이다. 단계 3 의 대표 장면("두 인간이 음식 하나를 원한다")이 여기서 값으로 선다.',
        ]),
        walkGauge(),
        diffView(
          {
            다툼: FULL_AUDIT.conflicts,
            '모자람 다툼': FULL_AUDIT.scarcity,
            '다툼 아닌 겹침': FULL_AUDIT.peaces,
            겹침: FULL_AUDIT.contests,
          },
          {
            다툼: AUDIT.conflicts,
            '모자람 다툼': AUDIT.scarcity,
            '다툼 아닌 겹침': AUDIT.peaces,
            겹침: AUDIT.contests,
          },
          { leftLabel: '재고 10 (가득한 겨울)', rightLabel: '재고 0 (바닥난 겨울)' },
        ),
        h('h3', {}, ['가득한 겨울의 이분 그래프 — 같은 여덟인데 대상 하나가 없다']),
        bipartiteView('재고 10 — 넷의 요구를 합쳐도 세계에 있는 것이 더 많다', FULL_BIPARTITE),
        keyValueView([
          ['넷이 같은 고기를 놓고', FOOD_CONFLICT === null ? '(없다)' : conflictLine(FOOD_CONFLICT)],
          ['한 몸이 두 곳에', BODY_CONFLICT === null ? '(없다)' : conflictLine(BODY_CONFLICT)],
          [
            '혼자 선 세계에서는',
            `겹침 ${String(ALONE.contests.length)} · 다툼 ${String(ALONE.field.conflicts.length)} — **남과의 다툼만 사라진다.** 제 안의 다툼은 혼자여도 남는다`,
          ],
        ]),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 다툼은 던지지 않고 물린다. **틀린 것과 다툼이 아닌 것은 다르다** — 겹치지만 다투지 않는 것은 위반이 아니라 사실이다.',
        ]),
        brokenTable(),
        h('h3', {}, ['다툼이 되지 못한 겹침들 — 사유와 함께']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [h('tr', {}, [h('th', {}, ['겹침']), h('th', {}, ['왜 다툼이 아닌가'])])]),
          h(
            'tbody',
            {},
            PEACES.map((peace) =>
              h('tr', { class: 'ok' }, [h('td', {}, [peace.label]), h('td', {}, [peace.reason])]),
            ),
          ),
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          'D1 DependencyNode.condition → 요구의 자리와 대역 — D5 가 새로 적지 않는다',
          'D1 DependencyEdge.substitutability → 대신할 수 있는가 (그 자리에 기대는 간선이 답한다)',
          'D2 blueprint → 종의 그래프 · specimenOf → 개체 없는 종도 세계에 설 수 있다',
          'D2 가 남긴 한 줄 → 한 몸이 두 곳에 있을 수 없다는 다툼 (여기서 갚는다)',
          'D4 EdgePressure → 다툼의 급함 — D5 는 재지 않고 읽어 온다',
          'D4 WorldSnapshot → 모자람 — 다툼 조건 중 이것만 세계를 본다',
          'ModulePlan D5 예시(치료사·마물·국가) → 대상이 주체의 몸일 때의 opposed',
          '원문 §18 → 다툼은 다주체가 선 뒤에 붙는다',
          '다음 → E0 압력과 상황 군집: 다툼들을 하나의 상황으로 묶는다',
          '다음 → E3 행동 판정: 이기는 자를 확정한다 (D5 는 그것을 적지 않는다)',
          '다음 → P1 rivals: 겨루는 자가 여기서 계산된다 — 다만 그것을 주체가 아는지는 R3·R4 가 정한다',
          '남은 자리: 배타적 점유는 세계에 수용량을 적을 자리가 서야 판정된다 (W 계층)',
        ),
      ],
    },
  };

  return pageView(spec);
}
