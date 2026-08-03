// P2 검증 시나리오 3종 — 손이 다르면 갈래가 다른가, 문화가 정말 덜어 내는가.

import { stateHash } from '@hkt/core/v1';
import { SUBJECT_KINDS } from '@hkt/core/o1';
import { ACTION_ATOMS, atomLabel } from '@hkt/core/p0';
import {
  ACCESS_RULES,
  accessOf,
  accessVerdict,
  buildGrammar,
  checkAccess,
  checkExamples,
  checkGrammar,
  diffGrammars,
  entryOf,
  EXAMPLE_LINES,
  exampleVerdict,
  grammarVerdict,
  narrowTree,
  narrowVerdict,
  type AccessRule,
  type PossibilityGrammar,
} from '@hkt/core/p2';

import {
  defineScenario,
  expectDeterministic,
  expectState,
  expectTrue,
  type Assertion,
} from '../src/index.ts';

import {
  beastNarrowed,
  CULTURE_CASES,
  VEIL_SPECIES,
  CULTURE_NARROWED,
  hunterArchetype,
  KIND_CASES,
  RIVAL_TREE,
  S1_DEFINITIONS,
  VEIL_BANS,
  VEIL_CULTURES,
  VEIL_GRANTS,
} from './p2-veil-grammars.ts';

/** 정상 — 유형이 손을 가르고, 문화가 그 위에서 다시 가른다. */
export const p2FiveGrammars = defineScenario({
  id: 'p2-five-grammars',
  module: 'P2',
  kind: 'normal',
  purpose:
    '주체 유형 다섯이 각자 다른 손으로 원자를 내고, 원문 P2 의 다섯 줄이 그 격자에서 도출되며, 같은 종의 셋이 문화·역할로 다시 갈린다.',
  arrange: () => ({ kinds: KIND_CASES, cultures: CULTURE_CASES }),
  act: ({ kinds, cultures }) => {
    const access = checkAccess();
    const examples = checkExamples();
    return {
      // ① 유형 격자
      gridSize: ACCESS_RULES.length,
      counts: Object.fromEntries(
        SUBJECT_KINDS.map((kind) => [
          kind,
          `직접 ${String(access.counts[kind]?.['direct'] ?? 0)} · 구성원 ${String(access.counts[kind]?.['viaMembers'] ?? 0)} · 의념 ${String(access.counts[kind]?.['viaAbility'] ?? 0)} · 막힘 ${String(access.counts[kind]?.['denied'] ?? 0)}`,
        ]),
      ),
      universal: access.universal,
      accessVerdict: accessVerdict(access),

      // ② 원문 다섯 줄이 도출된다
      exampleCount: examples.checks.length,
      unreachable: examples.unreachable,
      exampleVerdict: exampleVerdict(examples),

      // ③ 세계에 선 종 다섯이 각자의 유형으로 선다
      species: kinds.map((entry) => ({
        label: entry.label,
        kind: entry.grammar.subjectKind,
        allowed: entry.grammar.allowed.length,
      })),

      // ④ 같은 사냥꾼 종의 셋이 갈린다
      cultures: cultures.map((entry) => ({
        label: entry.label,
        allowed: entry.grammar.allowed.length,
        empowered: entry.grammar.empowered,
        banned: entry.grammar.banned,
      })),
      diff: diffGrammars(
        cultures[0]?.grammar as PossibilityGrammar,
        cultures[1]?.grammar as PossibilityGrammar,
      ),
      verdict: grammarVerdict(cultures[1]?.grammar as PossibilityGrammar),
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('유형 5 × 원자 16 격자가 선다', 80, result.gridSize),
    expectState(
      '유형마다 손이 다르다 — 사람만 전부 제 손으로, 조직·국가는 전부 구성원으로, 신은 전부 의념으로',
      {
        person: '직접 16 · 구성원 0 · 의념 0 · 막힘 0',
        creature: '직접 12 · 구성원 0 · 의념 0 · 막힘 4',
        organization: '직접 0 · 구성원 16 · 의념 0 · 막힘 0',
        nation: '직접 0 · 구성원 16 · 의념 0 · 막힘 0',
        god: '직접 0 · 구성원 0 · 의념 14 · 막힘 2',
      },
      result.counts,
    ),
    expectState('누구에게나 열린 원자는 열이다', 10, result.universal.length),
    expectState('원문 다섯 줄 열다섯 행동이 하나도 빠짐없이 도달된다', [], result.unreachable),
    expectState('그 열다섯이 전부 대조된다', 15, result.exampleCount),
    expectState(
      '세계에 선 다섯이 각자의 유형으로 선다',
      [
        { label: '사냥꾼', kind: 'person', allowed: 16 },
        { label: '장막벌레', kind: 'creature', allowed: 12 },
        { label: '채집 결사', kind: 'organization', allowed: 16 },
        { label: '협곡을 낀 나라', kind: 'nation', allowed: 16 },
        { label: '붉은 장막의 어미', kind: 'god', allowed: 14 },
      ],
      result.species,
    ),
    expectState(
      '같은 사냥꾼 종의 셋이 의념과 금기로 갈린다',
      [
        { label: '자국을 쫓는 자들 · 몰이꾼', allowed: 16, empowered: ['investigate'], banned: [] },
        {
          label: '어미를 섬기는 자들 · 사제',
          allowed: 15,
          empowered: ['protect', 'conceal'],
          banned: ['destroy'],
        },
        { label: '고개를 넘는 상단', allowed: 15, empowered: [], banned: ['seize'] },
      ],
      result.cultures,
    ),
    expectState('몰이꾼은 하고 사제는 하지 않는 것이 하나 있다', ['destroy'], result.diff.onlyLeft),
    expectState(
      '같은 원자를 다르게 내는 자리가 셋이다',
      ['보호: direct ↔ viaAbility', '은폐: direct ↔ viaAbility', '조사: viaAbility ↔ direct'],
      result.diff.differentAccess,
    ),
    expectTrue(
      '판정 세 줄이 격자·대조·문법을 말한다',
      result.accessVerdict.includes('격자가 다 찼다') &&
        result.exampleVerdict.includes('도출된다') &&
        result.verdict.includes('열여섯 중 15을 낸다'),
      [result.accessVerdict, result.exampleVerdict, result.verdict],
    ),
    expectDeterministic('같은 문법을 100번 물어도 같은 답이다', () =>
      stateHash([checkAccess().byKind, KIND_CASES.map((entry) => entry.grammar.allowed)]),
    ),
  ],
});

/** 실패 — 설 수 없는 격자·문법·좁히기가 각자의 사유로 거부된다. */
export const p2BrokenGrammarsRejected = defineScenario({
  id: 'p2-broken-grammars-rejected',
  module: 'P2',
  kind: 'failure',
  purpose:
    '몸 없는 자의 직접 행동·구성원 없는 자의 위임·없는 능력의 배정·아무도 열지 않은 것의 금기·전부를 닫는 금기·넓히는 좁히기가 각각 자기 사유로 거부된다.',
  arrange: () => ({ rules: ACCESS_RULES, cultures: CULTURE_CASES }),
  act: ({ rules, cultures }) => {
    const patch = (change: (rule: AccessRule) => AccessRule) => checkAccess(rules.map(change));
    const priest = cultures[1]?.grammar;
    const spec = {
      archetype: hunterArchetype,
      culture: VEIL_CULTURES.find((entry) => entry.name.includes('어미')) ?? null,
      role: null,
      capabilities: [],
      grants: VEIL_GRANTS,
      bans: VEIL_BANS,
    };
    return {
      bodilessDirect: patch((rule) =>
        rule.subjectKind === 'god' && rule.atom === 'destroy'
          ? { ...rule, access: 'direct' as const }
          : rule,
      ).violations[0]?.rule,
      memberlessDelegation: patch((rule) =>
        rule.subjectKind === 'person' && rule.atom === 'seek'
          ? { ...rule, access: 'viaMembers' as const }
          : rule,
      ).violations[0]?.rule,
      missingCell: checkAccess(rules.filter((rule) => rule.atom !== 'betray')).violations[0]?.rule,
      unknownAbility: checkGrammar(
        priest ?? buildGrammar({ archetype: hunterArchetype }),
        spec,
        S1_DEFINITIONS.filter((definition) => definition.definitionKind === 'species'),
      )[0]?.rule,
      // 짐승에게 교환을 금하는 것 — 애초에 낼 수 없는 것은 금할 수 없다
      ungrantedTaboo: (() => {
        const beast = KIND_CASES.find((entry) => entry.grammar.subjectKind === 'creature');
        const beastSpec = {
          archetype: VEIL_SPECIES.find((species) => species.subjectKind === 'creature') ?? hunterArchetype,
          culture: null,
          role: null,
          capabilities: [],
          grants: [],
          bans: [{ ruleId: 'rule:none', atoms: ['exchange' as const], note: '짐승에게 거래를 금한다' }],
        };
        return checkGrammar(beast?.grammar ?? buildGrammar(beastSpec), beastSpec)[0]?.rule;
      })(),
      // 까닭 없이 싣는 배정
      unreasonedGrant: checkGrammar(priest ?? buildGrammar({ archetype: hunterArchetype }), {
        ...spec,
        grants: [{ abilityId: VEIL_GRANTS[0]?.abilityId ?? '', atoms: ['protect'], note: '' }],
      })[0]?.rule,
      totalTaboo: (() => {
        const muted = buildGrammar({
          ...spec,
          bans: [
            {
              ruleId: spec.culture?.id ?? '',
              atoms: [...ACTION_ATOMS],
              note: '전부 금한다',
            },
          ],
        });
        return {
          allowed: muted.allowed.length,
          rule: checkGrammar(muted, {
            ...spec,
            bans: [
              { ruleId: spec.culture?.id ?? '', atoms: [...ACTION_ATOMS], note: '전부 금한다' },
            ],
          })[0]?.rule,
        };
      })(),
      widened: narrowTree(
        { ...RIVAL_TREE, branches: [] },
        priest ?? buildGrammar({ archetype: hunterArchetype }),
      ).violations.length,
    };
  },
  assert: (result): readonly Assertion[] => [
    expectState('몸 없는 신이 제 손으로 부순다고 적으면 거부된다', 'bodiless-direct', result.bodilessDirect),
    expectState('구성원 없는 사람이 시켜서 찾는다고 적으면 거부된다', 'memberless-delegation', result.memberlessDelegation),
    expectState('격자에 빈 칸이 있으면 거부된다', 'missing-access', result.missingCell),
    expectState('세계에 없는 능력이 원자를 싣는다고 적으면 거부된다', 'unknown-ability', result.unknownAbility),
    expectState('짐승에게 거래를 금할 수는 없다 — 애초에 낼 수 없는 것이다', 'ungranted-taboo', result.ungrantedTaboo),
    expectState('까닭 없이 원자를 싣는 배정도 걸린다', 'unreasoned-denial', result.unreasonedGrant),
    expectState('금기가 전부를 닫으면 낼 수 있는 것이 하나도 없다', 0, result.totalTaboo.allowed),
    expectState('그 사실이 total-taboo 로 남는다', 'total-taboo', result.totalTaboo.rule),
    expectState('빈 갈래를 좁혀도 넓어지지 않는다', 0, result.widened),
  ],
});

/** 경계 — 아무것도 못 하는 유형, 능력이 열지 못하는 자리, 문화가 걸러 내는 원자. */
export const p2Boundary = defineScenario({
  id: 'p2-boundary',
  module: 'P2',
  kind: 'boundary',
  purpose:
    '능력은 유형이 막은 자리를 열지 못하고, 금기는 낼 손이 있는 것만 닫으며, 좁히기는 P1 이 연 것만 닫는다.',
  arrange: () => ({ cases: CULTURE_NARROWED }),
  act: ({ cases }) => ({
    // ① 능력은 열지 못한다 — 신에게 획득을 실어도 열리지 않는다
    abilityCannotOpen: (() => {
      const god = KIND_CASES.find((entry) => entry.grammar.subjectKind === 'god');
      const forced = buildGrammar({
        archetype: hunterArchetype,
        capabilities: [],
        grants: [{ abilityId: 'rule:none', atoms: ['acquire'], note: '없는 능력' }],
      });
      return {
        godDenies: entryOf(god?.grammar ?? forced, 'acquire')?.closedBy,
        forcedEmpowered: forced.empowered.length,
      };
    })(),

    // ② 같은 갈래에 문화 셋을 씌우면 남는 원자가 갈린다
    byCulture: cases.map((entry) => ({
      label: entry.label,
      fulfill: entry.fulfillAtoms.map((atom) => atomLabel(atom as never)),
      rival: entry.rivalAtoms.map((atom) => atomLabel(atom as never)),
    })),

    // ③ 짐승의 문법을 사람의 갈래에 씌우면 말이 필요한 방향이 닫힌다
    beast: {
      before: beastNarrowed.openBefore,
      after: beastNarrowed.openAfter,
      closed: beastNarrowed.branches.flatMap((branch) => branch.closedByGrammar),
      verdict: narrowVerdict(beastNarrowed),
    },

    // ④ 유형별 막힌 원자와 그 사유
    denials: SUBJECT_KINDS.map((kind) => ({
      kind,
      denied: ACTION_ATOMS.filter((atom) => accessOf(kind, atom)?.access === 'denied'),
    })),

    exampleLines: EXAMPLE_LINES.length,
  }),
  assert: (result): readonly Assertion[] => [
    expectState('신에게 획득은 유형이 막은 자리다', 'kind', result.abilityCannotOpen.godDenies),
    expectState('내 능력이 아닌 배정은 얹히지 않는다', 0, result.abilityCannotOpen.forcedEmpowered),
    expectState(
      '같은 굶주림 앞에서 문화 셋이 다른 원자를 남긴다 — 사제는 죽이지 않고 상단은 빼앗지 않는다',
      [
        {
          label: '자국을 쫓는 자들 · 몰이꾼',
          fulfill: ['획득', '교환', '빼앗다'],
          rival: ['제거', '협박', '은폐'],
        },
        {
          label: '어미를 섬기는 자들 · 사제',
          fulfill: ['획득', '교환', '빼앗다'],
          rival: ['협박', '은폐'],
        },
        { label: '고개를 넘는 상단', fulfill: ['획득', '교환'], rival: ['제거', '협박', '은폐'] },
      ],
      result.byCulture,
    ),
    expectState('짐승의 손으로는 위임이 닫힌다', ['delegate'], result.beast.closed),
    expectTrue(
      '좁히기는 줄이기만 한다',
      result.beast.after < result.beast.before,
      [result.beast.before, result.beast.after],
    ),
    expectState(
      '유형마다 막히는 자리가 다르다 — 사람은 하나도 막히지 않는다',
      [
        { kind: 'person', denied: [] },
        { kind: 'creature', denied: ['exchange', 'persuade', 'ally', 'betray'] },
        { kind: 'organization', denied: [] },
        { kind: 'nation', denied: [] },
        { kind: 'god', denied: ['acquire', 'seize'] },
      ],
      result.denials,
    ),
    expectState('원문이 든 줄은 다섯이다', 5, result.exampleLines),
  ],
});

export const p2Scenarios = [p2FiveGrammars, p2BrokenGrammarsRejected, p2Boundary];
