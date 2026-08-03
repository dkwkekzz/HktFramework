// /lab/p0 — P0 행동 원자 16종.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **원문이 흩어 적은 행동이 열여섯으로 접힌다.** 사냥·징수·법제화·영역 변형이 새 행동이
//      아니라 원자의 조합이거나 같은 원자다. 징수와 약탈이 한 칸에 서는 것이 이 표의 핵심이다.
//   ② **열여섯은 축으로 서지 목록으로 서지 않는다.** 손대는 곳 넷(세계·앎·사이·자기)이
//      4·3·6·3 으로 나뉘고, 사이의 여섯은 동의 하나로 셋씩 짝을 이룬다.
//   ③ **같은 굶주림 앞에서 넷의 길이 갈린다.** 문법이 아홉을 놓고, 세계가 그중 낼 수 있는 것을
//      고른다 — 빚진 04 에게 남은 것은 협곡 하나뿐이고, 벗어날 수 있는 것은 사제뿐이다.
//
// 아래로는 설 수 없는 요청 아홉이 왜 막히는지를 편다.

import {
  BROKEN_PROPOSALS,
  closedFor,
  CRISIS_PRESSURE,
  CRISIS_TICK,
  pathsFor,
  subjectPaths,
  VEIL_PROPOSALS,
} from '@hkt/scenarios/suites/p0-veil-actions';
import { p0Scenarios } from '@hkt/scenarios/suites/p0';
import { runScenarios } from '@hkt/scenarios';
import { DEPENDENCY_KINDS, kindLabel } from '@hkt/core/d0';
import {
  ACTION_ATOM_SPECS,
  ATOM_GROUNDINGS,
  ATOM_RECONCILIATION,
  atomGrounding,
  atomGroundingVerdict,
  atomLabel,
  atomReconciliationVerdict,
  atomsFilling,
  checkAtomGroundings,
  fitAction,
  P1_DIRECTIONS,
  P2_EXAMPLES,
  reconcileAtoms,
  slotText,
  UNFILLABLE_KINDS,
  UNUSED_ATOM_DEBT,
  type ActionAtom,
  type AtomBearing,
  type AtomGrounding,
} from '@hkt/core/p0';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const TOUCH_LABELS: Readonly<Record<string, string>> = {
  world: '세계',
  knowing: '앎',
  between: '사이',
  self: '자기',
};

const BEARING_LABELS: Readonly<Record<AtomBearing, string>> = {
  fill: '채운다',
  guard: '지킨다',
  clear: '지운다',
  escape: '벗어난다',
};

const CONSENT_LABELS: Readonly<Record<string, string>> = {
  mutual: '동의',
  against: '거스름',
  none: '—',
};

const RESOLUTION_LABELS: Readonly<Record<string, string>> = {
  same: '같음',
  compound: '조합',
  direction: '방향',
};

function atomsText(atoms: readonly ActionAtom[]): string {
  return atoms.length === 0 ? '(없다)' : atoms.map(atomLabel).join(' · ');
}

export function p0Page(): VElement {
  const reconciliation = reconcileAtoms();
  const grounding = checkAtomGroundings();
  const suite = runScenarios(p0Scenarios);

  const proposalRows = VEIL_PROPOSALS.map((entry) => {
    const fit = fitAction(entry.proposal);
    return { ...entry, fit };
  });

  const brokenRows = BROKEN_PROPOSALS.map((entry) => {
    const fit = fitAction(entry.proposal, '$.plan.steps[0]');
    const first = fit.violations[0];
    return {
      broke: entry.broke,
      expected: entry.expected,
      actual: first?.rule ?? '(통과해 버렸다)',
      path: first?.path ?? '',
      message: first?.message ?? '',
    };
  });

  const allRejected = brokenRows.every((row) => row.expected === row.actual);
  const foodPaths = pathsFor('resource');
  const subjects = subjectPaths();

  const spec: PageSpec = {
    id: 'P0',
    title: '행동 원자',
    purpose:
      '가능성을 구성하는 최소 행동을 16원자로 확정하고, 각 원자가 무엇을 요구하고 세계의 어느 자리를 바꾸며 무엇을 치르는지를 못박는다.',
    verdict: {
      passed: reconciliation.complete && grounding.complete && allRejected && suite.failed === 0,
      label: reconciliation.complete
        ? `${atomReconciliationVerdict(reconciliation)} · ${atomGroundingVerdict(grounding)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`
        : atomReconciliationVerdict(reconciliation),
    },
    sections: {
      input: keyValueView([
        [
          '원문 목록 ① (P0)',
          `16원자 — ${ACTION_ATOM_SPECS.map((entry) => entry.label).join(' · ')}`,
        ],
        [
          '원문 목록 ② (P1)',
          `대응 방향 ${String(P1_DIRECTIONS.length)}개 — 행동이 아니라 원자를 고르는 방향이어야 한다`,
        ],
        [
          '원문 목록 ③ (P2)',
          `주체별 예시 ${String(P2_EXAMPLES.length)}개 — 새 행동이 아니라 원자의 조합이어야 한다`,
        ],
        ['세계의 자리', 'O2 9영역 — 바꿀 자리도 치를 자리도 여기 말고는 없다'],
        ['의존 종', `D0 11종 — 원자가 닿는 곳`],
        ['D4 가 넘긴 것', `몰이꾼 04 의 굶주림, ${String(CRISIS_TICK)}틱에 압력 ${CRISIS_PRESSURE.peak.toFixed(2)} (${CRISIS_PRESSURE.peakLevel})`],
        ['결함 요청', `${String(BROKEN_PROPOSALS.length)}종`],
      ]),

      process: [
        h('p', {}, [
          '원문은 행동을 세 곳에서 다르게 적는다. 앞 계층(O2 영역·D0 대상)은 두 목록을 하나로 좁혔지만, 여기서는 방향이 반대다 — 흩어진 이름들이 열여섯으로 **환원**되어야 한다. 환원되지 않는 이름이 하나라도 남으면 16 은 최소 집합이 아니다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원문이 적은 이름']),
              h('th', {}, ['환원']),
              h('th', {}, ['원자']),
              h('th', {}, ['왜']),
            ]),
          ]),
          h(
            'tbody',
            {},
            ATOM_RECONCILIATION.map((entry) =>
              h('tr', { class: entry.resolution === 'compound' ? 'ok' : '' }, [
                h('td', {}, [h('code', {}, [entry.original])]),
                h('td', {}, [RESOLUTION_LABELS[entry.resolution] ?? entry.resolution]),
                h('td', {}, [atomsText(entry.atoms)]),
                h('td', {}, [entry.reason]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          `조합으로만 서는 이름 ${String(reconciliation.compounds.length)}개 · 방향으로 남는 이름 ${String(P1_DIRECTIONS.length)}개 · 환원되지 않은 이름 ${String(reconciliation.unresolved.length)}개. 징수와 영역 침범이 빼앗다 한 칸에 선다 — 갈리는 것은 행동이 아니라 그 뒤에 institutional.law 자리가 서 있는가 하나뿐이다.`,
        ]),
      ],

      candidates: [
        h('p', {}, [
          '확정 16원자 — 각 칸이 다섯 가지에 답한다. 답하지 못하는 칸은 이름뿐이고, 이름뿐인 칸은 R2 가 세계 변경 요청으로 받지 못한다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['원자']),
              h('th', {}, ['하는 일']),
              h('th', {}, ['손대는 곳']),
              h('th', {}, ['동의']),
              h('th', {}, ['의존에 대해']),
              h('th', {}, ['바꾸는 자리']),
              h('th', {}, ['치르는 자리']),
              h('th', {}, ['짝']),
            ]),
          ]),
          h(
            'tbody',
            {},
            ACTION_ATOM_SPECS.map((entry) => {
              const ground = atomGrounding(entry.atom) as AtomGrounding;
              return h('tr', { class: 'ok' }, [
                h('td', {}, [entry.label]),
                h('td', {}, [entry.does]),
                h('td', {}, [TOUCH_LABELS[ground.touches] ?? ground.touches]),
                h('td', {}, [CONSENT_LABELS[ground.consent] ?? ground.consent]),
                h('td', {}, [
                  `${BEARING_LABELS[ground.bearing]} ${ground.kinds.length === 0 ? '(종을 가리지 않는다)' : `— ${ground.kinds.map(kindLabel).join(' ')}`}`,
                ]),
                h('td', {}, [ground.writes.map(slotText).join(' · ')]),
                h('td', {}, [ground.pays.map(slotText).join(' · ')]),
                h('td', {}, [ground.counterpart === null ? '—' : atomLabel(ground.counterpart)]),
              ]);
            }),
          ),
        ]),
        h('h3', {}, ['축으로 본 열여섯 — 목록이 아니라 구조다']),
        lines(
          ...Object.entries(grounding.byTouch).map(
            ([touch, atoms]) =>
              `${TOUCH_LABELS[touch] ?? touch} ${String(atoms.length)} — ${atomsText(atoms as readonly ActionAtom[])}`,
          ),
        ),
        h('p', {}, [
          '상대가 끼는 여섯은 동의 하나로 셋씩 짝을 이룬다. 물건을 주고받기와 빼앗기, 마음을 이유로와 두려움으로, 약속을 맺기와 어기기 — 노리는 것은 같고 갈리는 것은 동의뿐이다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['동의를 받으면']),
              h('th', {}, ['거스르면']),
              h('th', {}, ['같이 노리는 것']),
              h('th', {}, ['되돌릴 수 있는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            grounding.pairs.map((pair) => {
              const [left, right] = pair.split('↔') as [ActionAtom, ActionAtom];
              const a = atomGrounding(left) as AtomGrounding;
              const b = atomGrounding(right) as AtomGrounding;
              const mutual = a.consent === 'against' ? b : a;
              const against = a.consent === 'against' ? a : b;
              return h('tr', { class: 'ok' }, [
                h('td', {}, [atomLabel(mutual.atom)]),
                h('td', {}, [atomLabel(against.atom)]),
                h('td', {}, [
                  [...new Set([...mutual.kinds, ...against.kinds])].map(kindLabel).join(' · ') ||
                    '(종을 가리지 않는다)',
                ]),
                h('td', {}, [
                  `${mutual.reversible ? '된다' : '안 된다'} / ${against.reversible ? '된다' : '안 된다'}`,
                ]),
              ]);
            }),
          ),
        ]),
        h('h3', {}, ['의존 종마다 놓이는 길 — 채울 수 없는 둘이 있다']),
        lines(
          ...DEPENDENCY_KINDS.map((kind) => {
            const fillers = atomsFilling(kind);
            const owed = UNFILLABLE_KINDS.find((entry) => entry.kind === kind);
            return fillers.length > 0
              ? `${kindLabel(kind)} — ${atomsText(fillers)}`
              : `${kindLabel(kind)} — 채우는 원자가 없다 (${owed?.owedTo ?? '선언되지 않은 빈칸'})`;
          }),
        ),
      ],

      selection: [
        h('p', {}, [
          `몰이꾼 04 의 굶주림 하나 앞. ${String(CRISIS_TICK)}틱에 창고는 비었고 압력은 ${CRISIS_PRESSURE.peak.toFixed(2)}(${CRISIS_PRESSURE.peakLevel})다. 그 앞에 열여섯이 다 놓이지는 않는다 — 자원 의존에 닿는 것은 아홉이고, 나머지 일곱은 이 결핍과 무관하다.`,
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['놓이는 길']),
              h('th', {}, ['하는 일']),
              h('th', {}, ['치러야 하는 것']),
            ]),
          ]),
          h(
            'tbody',
            {},
            foodPaths.map((path) =>
              h('tr', { class: path.bearing === 'fill' ? 'ok' : '' }, [
                h('td', {}, [path.label]),
                h('td', {}, [BEARING_LABELS[path.bearing]]),
                h('td', {}, [path.pays.map(slotText).join(' · ')]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          `놓이지 않는 일곱: ${atomsText(closedFor('resource'))} — 굶주림은 설득으로도 배신으로도 채워지지 않는다.`,
        ]),
        h('h3', {}, ['같은 굶주림, 네 개의 다른 길']),
        h('p', {}, [
          '문법이 길을 놓고(P0) 세계가 그중 낼 수 있는 것을 고른다(D4). 원자는 저마다 치를 자리를 요구하므로, 손에 쥔 것이 다르면 열리는 길이 다르다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['누구']),
              h('th', {}, ['문법이 놓는 채움 넷']),
              h('th', {}, ['지금 치를 수 있는 것']),
              h('th', {}, ['벗어날 수 있는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            subjects.map((entry) =>
              h('tr', { class: entry.escapes.length > 0 ? 'ok' : '' }, [
                h('td', {}, [entry.label]),
                h('td', {}, [atomsText(entry.filling)]),
                h('td', {}, [atomsText(entry.payable)]),
                h('td', {}, [
                  entry.escapes.length === 0 ? '못 벗어난다' : atomsText(entry.escapes),
                ]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          '빚 40 이 마을의 신뢰를 다 갉아먹은 04 에게 남은 것은 협곡으로 들어가는 것 하나뿐이다 — 살 수도, 설득할 수도 없다. 의념이 남은 사제만 기대는 구조 자체를 갈아탈 수 있다. 다만 **치를 것이 없다는 것이 길이 막혔다는 뜻인지 브레이크가 없다는 뜻인지는 P0 가 판정하지 않는다** — 비용과 위험을 재는 것은 P4 의 몫이고, P0 는 어느 자리가 걸리는지만 지목한다.',
        ]),
        h('h3', {}, ['04 가 실제로 낸 요청 다섯']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['요청']),
              h('th', {}, ['원자']),
              h('th', {}, ['무엇이 갈리는가']),
              h('th', {}, ['판정']),
            ]),
          ]),
          h(
            'tbody',
            {},
            proposalRows.map((row) =>
              h('tr', { class: row.fit.fits ? 'ok' : 'bad' }, [
                h('td', {}, [row.label]),
                h('td', {}, [atomLabel(row.fit.atom as ActionAtom)]),
                h('td', {}, [row.telling]),
                h('td', {}, [row.fit.fits ? '선다' : (row.fit.violations[0]?.rule ?? '')]),
              ]),
            ),
          ),
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'D4 까지 세운 것은 "무엇이 얼마나 비었는가" 였다. 압력은 올랐지만 아무도 움직이지 않았다 — 무엇을 할 수 있는지가 없었기 때문이다. P0 이후로는 그 결핍 앞에 이름을 가진 길이 놓인다.',
        ]),
        keyValueView([
          ['전 — D 계층이 남긴 것', '의존 그래프 + 압력 5단계. 결핍은 있는데 갈 길이 없다'],
          [
            '후 — P0 이 더한 것',
            `행동 원자 ${String(reconciliation.atoms.length)}종 + 원자마다의 걸림(바꾸는 자리·치르는 자리·닿는 의존·동의·관측)`,
          ],
          [
            'O1 이 열어 둔 자리',
            'Affordance.action 이 문자열이었다 → 이제 16종 밖의 이름은 거부된다 (checkAtomAffordance)',
          ],
          [
            'MasterPlan §19 의 여덟 물음',
            '넷을 P0 가 미리 답한다 (대상 지정·비용 지불·조건·불변 규칙). 나머지 넷(능력 보유·충돌·지역 규칙·저항)은 세계를 봐야 하므로 R2·R3·D5 의 몫이다',
          ],
          [
            '아직 안 쓰인 원자',
            Object.entries(UNUSED_ATOM_DEBT)
              .map(([atom, owed]) => `${atomLabel(atom as ActionAtom)} → ${owed}`)
              .join(' / '),
          ],
        ]),
      ],

      failure: [
        h('p', {}, [
          '설 수 없는 요청은 조용히 통과하지 않는다. 어느 원자의·어디가·왜 막혔는지가 경로와 함께 남는다 — 세계를 보지 않고도 알 수 있는 거절은 여기서 끝난다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['무엇을 어겼나']),
              h('th', {}, ['예상 사유']),
              h('th', {}, ['실제']),
              h('th', {}, ['어디']),
              h('th', {}, ['뭐라고 하는가']),
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
                h('td', {}, [h('code', {}, [row.path])]),
                h('td', {}, [row.message]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          '걸림 자체가 무너지는 경우도 같다 — 아무것도 치르지 않는 원자(costless-atom), 아무 자리도 바꾸지 않는 원자(changeless-atom), 보지 않고 세계를 바꾸는 원자(blind-manipulation), 축과 자리가 완전히 겹쳐 하나로 접히는 원자(redundant-atom)는 목록에 들어오지 못한다.',
        ]),
        suiteView(suite),
      ],

      causality: [
        lines(
          '원문 P0 16개 · P1 방향 7 · P2 예시 15 → 환원 대조 → 확정 16원자 (P0-a)',
          '원자 → 손대는 곳·동의·의존에 대한 태도 + O2 실재 자리(읽기·바꾸기·치르기) → 걸림 (P0-b)',
          '걸림 → 요청 문법: 열지 않은 자리를 바꾸거나 치르지 않거나 보지 않고 겨누면 거부 (P0-c)',
          'D0 11종 ↔ 원자: 아홉은 채워지고 규칙은 W2 가, 시간은 V1 틱이 갚는다',
          'O0 verifiable-cost → 모든 원자가 치를 자리를 댄다 · observed-manipulation → 열다섯이 대상을 먼저 봐야 한다 (실행 층 강제는 R3)',
          'O1 Affordance.action ← P0 이 집합을 닫는다 (O1 이 주석으로 남겨 둔 자리)',
          '다음 → P1 이 이 원자들로 대응 방향 7종을 펼치고, P4 가 그중 하나를 고른다',
        ),
      ],
    },
  };

  return pageView(spec);
}
