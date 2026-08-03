// /lab/p2 — P2 종·문화·개인 가능성 문법.
//
// 화면이 보여야 하는 것은 셋이다.
//
//   ① **유형 × 원자 격자 80칸.** 사람은 열여섯을 제 손으로, 조직·국가는 전부 구성원의 손으로,
//      신은 의념으로 낸다 — 그리고 신은 물건을 집지 못한다. 그 표가 S0 의 경계 4종에서 계산된다.
//   ② **원문 P2 의 다섯 줄이 그 격자에서 도출된다.** 사냥꾼 추적·사냥·해체부터 신의 영역 변형까지
//      열다섯 행동이 전부 P0 환원표를 지나 그 유형의 문법 안에 있는지 대조된다.
//   ③ **같은 굶주림 앞에서 문화 셋이 다른 원자를 남긴다.** 사제는 죽이지 않고 상단은 빼앗지
//      않는다 — 낼 손이 있는데도. 할 수 있는데 하지 않는 것이 문화다.

import {
  beastNarrowed,
  CULTURE_CASES,
  CULTURE_NARROWED,
  CRISIS_TICK,
  KIND_CASES,
  RIVAL_TREE,
  VEIL_BANS,
  VEIL_GRANTS,
} from '@hkt/scenarios/suites/p2-veil-grammars';
import { p2Scenarios } from '@hkt/scenarios/suites/p2';
import { runScenarios } from '@hkt/scenarios';
import { SUBJECT_KINDS } from '@hkt/core/o1';
import { ACTION_ATOMS, atomLabel, type ActionAtom } from '@hkt/core/p0';
import { directionLabel } from '@hkt/core/p1';
import {
  accessOf,
  accessVerdict,
  checkAccess,
  checkExamples,
  diffGrammars,
  entryOf,
  exampleVerdict,
  footingOf,
  grammarVerdict,
  KIND_FOOTINGS,
  narrowVerdict,
  type AtomAccess,
  type PossibilityGrammar,
} from '@hkt/core/p2';

import { pageView, lines, type PageSpec } from '../page.ts';
import { keyValueView } from '../renderers/diff.ts';
import { suiteView } from '../renderers/scenario.ts';
import { h, type VElement } from '../vnode.ts';

const ACCESS_MARKS: Readonly<Record<AtomAccess, string>> = {
  direct: '손',
  viaMembers: '구성원',
  viaAbility: '의념',
  denied: '✕',
};

function markClass(access: AtomAccess): string {
  return access === 'denied' ? 'bad' : access === 'direct' ? 'ok' : '';
}

/** 유형 × 원자 격자. */
function accessGrid(): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [
        h('th', {}, ['유형']),
        ...ACTION_ATOMS.map((atom) => h('th', {}, [atomLabel(atom)])),
      ]),
    ]),
    h(
      'tbody',
      {},
      SUBJECT_KINDS.map((kind) =>
        h('tr', {}, [
          h('td', {}, [footingOf(kind)?.label ?? kind]),
          ...ACTION_ATOMS.map((atom) => {
            const rule = accessOf(kind, atom);
            const access = rule?.access ?? 'denied';
            return h('td', { class: markClass(access), title: rule?.basis ?? '' }, [
              ACCESS_MARKS[access],
            ]);
          }),
        ]),
      ),
    ),
  ]);
}

/** 문법 하나를 원자별로 편 표. */
function grammarRow(grammar: PossibilityGrammar): VElement {
  return h('table', { class: 'kv-table' }, [
    h('thead', {}, [
      h('tr', {}, [h('th', {}, ['원자']), ...ACTION_ATOMS.map((atom) => h('th', {}, [atomLabel(atom)]))]),
    ]),
    h('tbody', {}, [
      h('tr', {}, [
        h('td', {}, ['어떻게']),
        ...ACTION_ATOMS.map((atom) => {
          const entry = entryOf(grammar, atom);
          const access = entry?.access ?? 'denied';
          const closed = entry?.closedBy;
          return h(
            'td',
            { class: markClass(access), title: entry?.note ?? '' },
            [closed === 'taboo' ? '금기' : ACCESS_MARKS[access]],
          );
        }),
      ]),
    ]),
  ]);
}

export function p2Page(): VElement {
  const access = checkAccess();
  const examples = checkExamples();
  const suite = runScenarios(p2Scenarios);
  const tracker = CULTURE_CASES[0]?.grammar as PossibilityGrammar;
  const priest = CULTURE_CASES[1]?.grammar as PossibilityGrammar;
  const diff = diffGrammars(tracker, priest);

  const spec: PageSpec = {
    id: 'P2',
    title: '종·문화·개인 가능성 문법',
    purpose:
      '같은 결핍 앞에서도 주체 유형과 문화에 따라 다른 갈래가 나오게 한다 — 낼 손이 있는가, 낼 수 있어도 하지 않는가.',
    verdict: {
      passed: access.complete && examples.complete && suite.failed === 0,
      label: `${accessVerdict(access)} · ${exampleVerdict(examples)} · 시나리오 ${String(suite.passed)}/${String(suite.total)}`,
    },
    sections: {
      input: keyValueView([
        ['S0 이 넘긴 것', '주체 경계 4종 — 몸 · 구성원 · 영역+구성원 · 앵커'],
        ['S1·S2 가 넘긴 것', `세계에 선 종 ${String(KIND_CASES.length)} · 문화 ${String(CULTURE_CASES.length)}(역할 포함)`],
        ['P0 이 넘긴 것', '원자 16과 그 걸림 — 치르는 자리·동의 축·바꾸는 자리'],
        ['P1 이 넘긴 것', `${String(CRISIS_TICK)}틱 몰이꾼 04 의 갈래 ${String(RIVAL_TREE.branches.length)}자리 (겨루는 자 하나를 쥐여 준 상태)`],
        ['세계가 선언한 것', `능력↔원자 배정 ${String(VEIL_GRANTS.length)} · 문화의 금기 ${String(VEIL_BANS.length)}`],
        ['원문 대조', `ModulePlan P2 의 다섯 줄 ${String(examples.checks.length)}개 행동`],
      ]),

      process: [
        h('p', {}, [
          'S0 은 주체가 네 가지 방식으로만 세계에 걸린다고 못박았다 — 몸, 구성원, 영역+구성원, 앵커. P2 는 그것을 행동의 언어로 번역한다: 제 손으로 내는가, 구성원이 대신 내는가, 의념을 치르는 능력으로 내는가, 아니면 낼 길이 없는가. 격자는 손으로 적지 않고 **세 사실에서 계산된다** — 몸이 있는가, 구성원이 있는가, 의념 자리가 있는가.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['유형']),
              h('th', {}, ['몸']),
              h('th', {}, ['구성원']),
              h('th', {}, ['의념']),
              h('th', {}, ['어떻게 세계에 걸리는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            KIND_FOOTINGS.map((footing) =>
              h('tr', { class: footing.hasBody ? 'ok' : '' }, [
                h('td', {}, [footing.label]),
                h('td', {}, [footing.hasBody ? '있다' : '없다']),
                h('td', {}, [footing.hasMembers ? '있다' : '없다']),
                h('td', {}, [footing.hasPsyche ? '있다' : '없다']),
                h('td', {}, [footing.note]),
              ]),
            ),
          ),
        ]),
        lines(
          '몸을 요구하는 원자 = 체력을 치르는 원자 (P0 pays) — 그래서 몸 없는 자는 남의 손을 빌린다',
          '합의를 요구하는 원자 = P0 동의 축이 mutual 인 셋 — 말이 없는 짐승은 그것을 내지 못한다',
          '자리를 옮기는 원자 = physical.region 을 바꾸는 둘 — 앵커로만 걸린 신은 그것을 내지 못한다',
        ),
      ],

      candidates: [
        h('p', {}, [
          '유형 5 × 원자 16 = 80칸. 손=제 몸, 구성원=시켜서, 의념=능력으로, ✕=낼 길 없음. 칸에 마우스를 올리면 왜 그런지가 나온다.',
        ]),
        accessGrid(),
        h('p', {}, [
          `누구에게나 열린 원자 ${String(access.universal.length)}: ${access.universal.map(atomLabel).join(' · ')} — 몸도 말도 필요 없는 길들이다. 반대로 사람만이 열여섯을 전부 제 손으로 낸다. 그 대신 사람은 혼자다.`,
        ]),
        h('h3', {}, ['원문 P2 의 다섯 줄이 이 격자에서 도출되는가']),
        h('p', {}, [
          '원문은 유형별 행동을 예시로 들었다. 그 이름들은 P0-a 가 이미 원자로 환원해 두었으므로 물어볼 수 있다 — 그 원자들이 그 유형의 문법 안에 있는가? 없으면 격자가 틀렸거나 예시가 틀렸다.',
        ]),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['유형']),
              h('th', {}, ['원문이 든 행동']),
              h('th', {}, ['P0 이 준 원자']),
              h('th', {}, ['도달']),
            ]),
          ]),
          h(
            'tbody',
            {},
            examples.checks.map((check) =>
              h('tr', { class: check.reachable ? 'ok' : 'bad' }, [
                h('td', {}, [footingOf(check.subjectKind)?.label ?? check.subjectKind]),
                h('td', {}, [check.name]),
                h('td', {}, [check.atoms.map(atomLabel).join(' · ')]),
                h('td', {}, [check.reachable ? '된다' : `✕ ${check.missing.map(atomLabel).join('·')}`]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          `유형이 낼 수 있는데 원문이 예로 들지 않은 원자도 값으로 남는다 — 사람: ${(examples.unusedByOriginal['person'] ?? []).map(atomLabel).join(' ')}. 원문의 세 줄은 그 유형의 전부가 아니라 **가장 그다운 세 가지**였다.`,
        ]),
      ],

      selection: [
        h('p', {}, ['세계에 선 종 다섯이 각자의 유형으로 선다 — 같은 세계, 다섯 개의 손.']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['종']),
              h('th', {}, ['유형']),
              h('th', {}, ['낼 수 있는 원자']),
              h('th', {}, ['막힌 것']),
            ]),
          ]),
          h(
            'tbody',
            {},
            KIND_CASES.map((entry) =>
              h('tr', {}, [
                h('td', {}, [entry.label]),
                h('td', {}, [footingOf(entry.grammar.subjectKind)?.label ?? '']),
                h('td', {}, [String(entry.grammar.allowed.length)]),
                h('td', {}, [
                  entry.grammar.denied.length === 0
                    ? '(없다)'
                    : entry.grammar.denied.map(atomLabel).join(' · '),
                ]),
              ]),
            ),
          ),
        ]),
        h('h3', {}, ['같은 사냥꾼 종의 셋 — 문화가 다시 가른다']),
        ...CULTURE_CASES.flatMap((entry) => [
          h('p', {}, [`${entry.label} — ${grammarVerdict(entry.grammar)}. ${entry.tells}`]),
          grammarRow(entry.grammar),
        ]),
        keyValueView([
          ['몰이꾼은 하고 사제는 하지 않는 것', diff.onlyLeft.map(atomLabel).join(' · ') || '(없다)'],
          ['같은 원자를 다르게 내는 자리', diff.differentAccess.join(' · ')],
          ['둘 다 낼 수 있는 것', `${String(diff.bothAllowed.length)}가지`],
        ]),
        h('h3', {}, ['같은 굶주림 앞, 남는 원자가 갈린다']),
        h('table', { class: 'kv-table' }, [
          h('thead', {}, [
            h('tr', {}, [
              h('th', {}, ['누구']),
              h('th', {}, ['충족으로 남는 원자']),
              h('th', {}, ['경쟁 제거로 남는 원자']),
              h('th', {}, ['무엇이 그를 만드는가']),
            ]),
          ]),
          h(
            'tbody',
            {},
            CULTURE_NARROWED.map((entry) =>
              h('tr', { class: 'ok' }, [
                h('td', {}, [entry.label]),
                h('td', {}, [entry.fulfillAtoms.map((atom) => atomLabel(atom as ActionAtom)).join(' · ')]),
                h('td', {}, [entry.rivalAtoms.map((atom) => atomLabel(atom as ActionAtom)).join(' · ')]),
                h('td', {}, [entry.tells]),
              ]),
            ),
          ),
        ]),
        h('p', {}, [
          '셋 다 같은 몸이고 같은 결핍 앞에 서 있다. 그런데 사제의 경쟁 제거에는 제거가 없고, 상단의 충족에는 빼앗다가 없다 — 낼 손이 있는데도 하지 않기 때문이다. **할 수 있는데 하지 않는 것, 그것이 문화다.**',
        ]),
      ],

      beforeAfter: [
        h('p', {}, [
          'P1 까지의 갈래는 누가 서 있는지를 몰랐다 — 자원이 비면 누구에게나 여섯이 열렸다. P2 이후로는 같은 결핍이 유형과 문화를 지나며 다시 좁아진다.',
        ]),
        keyValueView([
          ['전 — P1 이 남긴 것', '결핍의 종이 좁힌 갈래. 사람이든 신이든 같은 답이었다'],
          [
            '후 — P2 가 더한 것',
            `유형 격자 80칸 + 문화·역할의 겹침(능력 ${String(VEIL_GRANTS.length)} · 금기 ${String(VEIL_BANS.length)}) + 갈래 좁히기`,
          ],
          ['짐승의 손으로 사람의 갈래를 좁히면', narrowVerdict(beastNarrowed)],
          [
            '문법은 닫기만 한다',
            'P1 이 닫은 것을 다시 열지 못하고, 없던 원자를 만들지도 못한다 (widened-branch 로 막는다)',
          ],
          [
            '능력은 열지 못하고 옮긴다',
            '유형이 막은 자리를 능력이 열지는 못한다 — 대가를 몸에서 의념으로 옮길 뿐이다. 그래서 신은 사람을 움직여야 한다',
          ],
        ]),
      ],

      failure: [
        h('p', {}, [
          '문법이 거짓이면 조용히 통과하지 않는다. 몸 없는 자가 손으로 한다거나, 구성원 없는 자가 시킨다거나, 없는 능력이 원자를 싣는다거나, 아무도 열지 않은 것을 금하면 각자의 사유로 거부된다.',
        ]),
        lines(
          'bodiless-direct — 몸이 없는데 제 손으로 낸다고 적었다',
          'memberless-delegation — 구성원이 없는데 시켜서 낸다고 적었다',
          'mindless-ability — 의념 자리가 없는데 능력으로 낸다고 적었다',
          'missing-access — 격자에 빈 칸이 있다 (못 낸다면 못 낸다고 적어야 한다)',
          'unknown-ability — 세계에 없는 능력이 원자를 싣는다',
          'ungranted-taboo — 아무도 열지 않은 것을 금했다 (짐승에게 거래를 금할 수는 없다)',
          'total-taboo — 금기가 전부를 닫아 아무것도 하지 못한다',
          'unreachable-example — 원문이 든 예시가 격자에서 도달되지 않는다',
          'widened-branch — 좁히기가 갈래를 넓혔다',
        ),
        suiteView(suite),
      ],

      causality: [
        lines(
          'S0 경계 4종(몸·구성원·영역+구성원·앵커) → 접근 4종(직접·구성원·의념·막힘) = 유형 격자 (P2-a)',
          'P0 원자의 걸림(치르는 자리·동의 축·바꾸는 자리) → 격자의 계산 근거 — 손으로 적지 않는다',
          'S1 종 + S2 문화·역할·능력 → 능력이 대가를 의념으로 옮기고 금기가 원자를 닫는다 (P2-b)',
          'P1 갈래 × 문법 → 좁혀진 갈래 — 문법은 닫기만 한다 (P2-c)',
          '원문 P2 다섯 줄 → P0 환원표 → 유형 격자 대조: 열다섯 행동이 전부 도출된다',
          '다음 → P3 이 지금 관련된 가능성만 펼치고, P4 가 그중 하나를 고른다',
          '남은 자리: 조직·국가는 구성원이 실제로 누구인지를 아직 묻지 않는다 — R 계층이 그 손을 세운다',
        ),
      ],
    },
  };

  return pageView(spec);
}
