// /lab/d0 — D0 의존 대상 타입.
//
// 화면이 보여야 하는 것은 둘이다.
//
//   ① **굶주림 하나 앞에 열한 갈래가 있다.** 식량만 놓으면 흔한 MMORPG 다. 사냥꾼의 허기 앞에는
//      실제로 열 가지가 놓이고, 그 하나하나가 다른 종으로 서고 다르게 채워진다.
//   ② **종을 정하는 것은 대상이 아니라 기대는 방식이다.** 고개 통행법 하나가 제도로도, 규칙으로도,
//      의례로도 걸린다 — 어느 것인지는 선언이 가르고, D0 는 거짓 선언만 막는다.
//
// 그 위로는 원문 두 목록이 11종으로 좁혀지는 대조표를, 아래로는 설 수 없는 걸림·선언 열여덟이
// 왜 막히는지를 편다.

import {
  BROKEN_CASES,
  BROKEN_GROUNDINGS,
  DEPENDENCY_CASES,
  passageLaw,
  TARGET_CASES,
} from '@hkt/scenarios/suites/d0-veil-targets';
import { d0Scenarios } from '@hkt/scenarios/suites/d0';
import { runScenarios } from '@hkt/scenarios';
import { STATE_DOMAINS } from '@hkt/core/o1';
import {
  checkDependencyTarget,
  checkGroundings,
  DEPENDENCY_KIND_SPECS,
  fitTarget,
  groundingSummary,
  groundingVerdict,
  KIND_GROUNDINGS,
  KIND_RECONCILIATION,
  kindGrounding,
  kindLabel,
  kindReconciliationVerdict,
  kindsAccepting,
  NODE_KIND_NAMES,
  reconcileKinds,
  type DependencyKind,
} from '@hkt/core/d0';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

/** 종 목록을 한 줄로 — 빈 목록도 말이 되게. */
function kindsText(kinds: readonly DependencyKind[]): string {
  return kinds.length === 0 ? '(어느 종도 받지 않는다)' : kinds.map(kindLabel).join(' · ');
}

export function d0Page(): VElement {
  const reconciliation = reconcileKinds();
  const grounding = checkGroundings();
  const suite = runScenarios(d0Scenarios);

  /** 굶주림 앞에 놓인 것들이 어느 종으로 서는가. */
  const targetRows = TARGET_CASES.map((entry) => ({
    ...entry,
    kinds: kindsAccepting(entry.element),
  }));

  /** 같은 법 하나가 세 종으로 선다. */
  const lawKinds = kindsAccepting(passageLaw);
  const lawSplit = lawKinds.length === 3;

  const declaredRows = DEPENDENCY_CASES.map((entry) => ({
    label: entry.label,
    kind: entry.dependency.dependencyKind,
    condition: entry.dependency.desiredCondition,
    passed: checkDependencyTarget(entry.dependency, entry.target).length === 0,
  }));

  const brokenGroundingRows = BROKEN_GROUNDINGS.map((entry) => {
    const report = checkGroundings(entry.patch(KIND_GROUNDINGS));
    const first = report.violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });

  const brokenTargetRows = BROKEN_CASES.map((entry) => {
    const fit = fitTarget(entry.kind, entry.target, '$.graph.nodes[0]');
    const first = fit.violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });

  const allRejected =
    brokenGroundingRows.every((row) => row.expected === row.actual) &&
    brokenTargetRows.every((row) => row.expected === row.actual);

  const spec: PageSpec = {
    id: 'D0',
    title: '의존 대상 타입',
    purpose:
      '주체가 기댈 수 있는 대상을 11종으로 확정하고, 각 종이 세계의 무엇으로 서고 어느 자리에서 충족을 읽는지를 못박는다.',
    verdict: {
      passed:
        reconciliation.complete && grounding.complete && lawSplit && allRejected && suite.failed === 0,
      label: reconciliation.complete
        ? `${kindReconciliationVerdict(reconciliation)} · ${groundingVerdict(grounding)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : kindReconciliationVerdict(reconciliation),
    },
    sections: {
      input: keyValueView([
        [
          '원문 목록 ①',
          `ModulePlan D0 — 11종 (${DEPENDENCY_KIND_SPECS.map((spec) => spec.originalName.replace(' 의존', '')).join(' · ')})`,
        ],
        ['원문 목록 ②', `ModulePlan D1 DependencyNode.kind — 9종 (${NODE_KIND_NAMES.join(' ')})`],
        ['O1 이 고정한 이름표', `DEPENDENCY_KINDS 11종 — D0 는 여기에 근거와 성격을 붙인다`],
        ['세계의 자리', `O2 9영역 — 충족을 읽을 곳이 여기 말고는 없다`],
        ['대상 후보', `${String(TARGET_CASES.length)}개 — 몰이꾼 04 의 굶주림 앞에 실제로 놓인 것들`],
        ['결함 걸림·선언', `${String(BROKEN_GROUNDINGS.length)} + ${String(BROKEN_CASES.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '원문은 의존 대상을 두 번 나열하는데 목록이 다르다. 어느 한쪽을 조용히 고르면 "원문에 있는데 코드에 없다" 가 반복되므로, 대조 자체를 값으로 남긴다 — D1 의 9개는 하나도 빠짐없이 확정 11종으로 간다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['D1 이 적은 이름']),
              h('th', {}, ['해소']),
              h('th', {}, ['확정 종']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            KIND_RECONCILIATION.map((entry) =>
              h('tr', { class: entry.resolution === 'split' ? 'ok' : '' }, [
                h('td', {}, [h('code', {}, [entry.original])]),
                h('td', {}, [entry.resolution === 'same' ? '같음' : '갈림']),
                h('td', {}, [kindsText(entry.kinds)]),
                h('td', {}, [entry.reason]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          `D1 목록에 없어서 근거를 따로 든 종: ${reconciliation.d0Only.map(kindLabel).join(' · ')} — 세계에 시간을 적을 자리가 O2 에 없으므로, 이 종만 V1 틱을 읽는다.`,
        ]),
      ],

      candidates: [
        h('p', {}, [
          '확정 11종 — 각 칸이 네 가지에 답한다. 답하지 못하는 칸은 이름뿐이고, 이름뿐인 칸으로는 D2 가 아무것도 짓지 못한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['종']),
              h('th', {}, ['무엇에 기대는가']),
              h('th', {}, ['대상은 세계의 무엇인가']),
              h('th', {}, ['어디서 읽는가']),
              h('th', {}, ['쓰면']),
              h('th', {}, ['갈아탐']),
              h('th', {}, ['붉은 장막 세계의 예']),
            ]),
          ]),
          h(
            'tbody',
            {},
            DEPENDENCY_KIND_SPECS.map((spec) => {
              const ground = kindGrounding(spec.kind);
              return h('tr', { class: 'ok' }, [
                h('td', {}, [spec.label]),
                h('td', {}, [spec.holds]),
                h('td', {}, [
                  ground === null || ground.targetKinds.length === 0
                    ? '대상 없음'
                    : ground.targetKinds.join(' · ') +
                      (ground.targetEntityKinds.length > 0
                        ? ` (${ground.targetEntityKinds.join(' ')})`
                        : ''),
                ]),
                h('td', {}, [
                  ground === null ? '' : ground.readsClock ? 'V1 틱' : ground.readDomains.join(' · '),
                ]),
                h('td', {}, [ground?.depletes === true ? '준다' : '줄지 않는다']),
                h('td', {}, [ground?.transferable === true ? '된다' : '안 된다']),
                h('td', {}, [spec.example]),
              ]);
            }),
          ),
        ]),
        h('h3', {}, ['거꾸로 본 표 — 세계의 자리마다 누가 그것에 기대는가']),
        h('p', {}, [
          '아무 종도 기대지 않는 영역이 있으면 그 영역의 상태는 아무의 결핍도 만들지 못한다 — 장식이다.',
        ]),
        lines(
          ...STATE_DOMAINS.map(
            (domain) =>
              `${domain} — ${kindsText((grounding.byDomain[domain] ?? []) as readonly DependencyKind[])}`,
          ),
        ),
      ],

      selection: [
        h('p', {}, [
          '몰이꾼 04 의 굶주림 앞에 실제로 놓인 것들. 하나가 아니라 열이고, 열이 서로 다른 종으로 선다 — 채우는 방법도, 쓰면 줄어드는지도, 남에게 맡길 수 있는지도 전부 다르다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['앞에 놓인 것']),
              h('th', {}, ['O1 원소']),
              h('th', {}, ['어느 종으로 서는가']),
              h('th', {}, ['몰이꾼에게 이것은']),
            ]),
          ]),
          h(
            'tbody',
            {},
            targetRows.map((row) =>
              h('tr', { class: row.kinds.length === 0 ? '' : row.kinds.length > 1 ? 'ok' : '' }, [
                h('td', {}, [row.label]),
                h('td', {}, [h('code', {}, [row.element.kind])]),
                h('td', {}, [kindsText(row.kinds)]),
                h('td', {}, [row.why]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['종을 정하는 것은 대상이 아니라 기대는 방식이다']),
        keyValueView([
          ['하나의 대상', `${passageLaw.name} — O1 Rule 하나. 세계에 딱 한 번 적혀 있다`],
          ['제도로 기대면', '통행권을 지녔는가 — institutional 자리를 읽는다. 누군가 주고 누군가 뺏는다'],
          ['규칙으로 기대면', '그 법이 아직 성립하는가 — psychic·transcendent 자리를 읽는다. 갈아탈 수 없다'],
          ['의례로 기대면', '되풀이가 이어지는가 — 남이 대신 치를 수 있다'],
          [
            '판정',
            lawSplit
              ? `같은 법 하나가 ${kindsText(lawKinds)} 셋으로 걸린다 — 어느 것인지는 선언이 가른다`
              : '갈리지 않았다',
          ],
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'S3 까지 세운 것은 "무엇으로 무너지는가"(내 경계 안의 자리)뿐이었다. D0 이후로는 그 자리를 "무엇이 채우는가"(경계 밖)가 종류를 갖는다.',
        ]),
        keyValueView([
          ['전 — S 계층이 남긴 것', 'Need{자리, 범위, 급함, 붕괴 시한} — 전부 자기 경계 안이다'],
          ['후 — D0 이 더한 것', '기댈 수 있는 대상 11종 + 각 종이 세계에 걸리는 방식'],
          ['원문 목록', `D1 9종 → 확정 ${String(reconciliation.kinds.length)}종 (state 하나가 환경·신체로 갈리고, 시간이 더해진다)`],
          [
            '읽히는 영역',
            `${String(STATE_DOMAINS.length - grounding.uncoveredDomains.length)}/${String(STATE_DOMAINS.length)} — 남는 영역이 없다`,
          ],
          ['아직 없는 것', 'D1 노드·간선 — 이 종들을 무엇으로 잇는가(requires·consumes·produced_by…)는 다음 모듈이다'],
        ]),
        h('h3', {}, ['몰이꾼 04 가 실제로 선언한 의존']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['선언']),
              h('th', {}, ['종']),
              h('th', {}, ['무엇이 충족인가']),
              h('th', {}, ['관문']),
            ]),
          ]),
          h(
            'tbody',
            {},
            declaredRows.map((row) =>
              h('tr', { class: row.passed ? 'ok' : 'bad' }, [
                h('td', {}, [row.label]),
                h('td', {}, [kindLabel(row.kind)]),
                h('td', {}, [row.condition]),
                h('td', {}, [row.passed ? '지난다' : '막힌다']),
              ]),
            ),
          ),
        ]),
      ],

      failure: [
        h('p', {}, ['① 분류표 자체가 무너지는 자리 — 읽을 자리 없는 종은 D4 가 압력을 계산하지 못한다.']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenGroundingRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          '② 선언과 대상이 어긋나는 자리 — 거부하면서 무엇으로 적어야 하는지까지 말한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['어긴 것']),
              h('th', {}, ['걸려야 할 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['자리']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            brokenTargetRows.map((row) =>
              h('tr', { class: row.expected === row.actual ? 'ok' : 'bad' }, [
                h('td', {}, [row.broke]),
                h('td', {}, [h('code', {}, [row.expected])]),
                h('td', {}, [h('code', {}, [row.actual])]),
                h('td', { class: 'path' }, [row.path]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['시나리오 3종']),
        suiteView(suite),
      ],

      causality: lines(
        '주체의 자리는 자기 경계 안에 있고, 그 자리를 채우는 것은 경계 밖에 있다 — 그래서 세계가 필요해진다 (S0-c 가 D 계층에 넘긴 자리)',
        '분류는 목록이 아니라 걸림이다 — 대상이 O1 의 무엇으로 서고 충족을 O2 어느 자리에서 읽는지 대지 못하는 종은 이름뿐인 칸이다',
        '읽을 자리가 없으면 결핍도 없다 — D4 의 압력은 자리의 값에서만 나오므로, 아무 자리도 읽지 않는 종은 영원히 충족으로 남는다',
        '시간만 예외다 — 세계에 시간을 적을 자리가 O2 에 없어서 V1 틱을 읽는다. 채울 수 없고 기다릴 뿐이라 P 계층의 전략도 이 종에는 거의 걸리지 않는다',
        '의존의 종류는 대상이 정하는 것이 아니라 기대는 방식이 정한다 — 같은 법 하나가 제도·규칙·의례 셋으로 걸리고, 그 갈림이 같은 세계에서 다른 인물을 낳는다',
        '쓰면 주는가(소모)가 갈등의 씨앗이다 — 자원·신체·관계만 줄어들고, 줄어드는 것 위에서만 D5 의 경합이 생긴다',
        '갈아탈 수 있는가가 P1 전략의 전제다 — 정보·제도·의례는 남에게 맡길 수 있고, 몸·장소·환경은 그럴 수 없다',
        '다음은 D1 — 이 종들을 노드로 세우고 무엇으로 잇는지(requires·consumes·produced_by…)를 확정한다',
      ),
    },
  };

  return pageView(spec);
}
