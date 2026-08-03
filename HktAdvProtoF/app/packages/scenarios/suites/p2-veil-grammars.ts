// P2 검증 장면 — 같은 겨울, 다섯 유형과 세 문화가 서로 다른 문법을 갖는다.
//
// P1 의 장면은 같은 결핍 앞에서 사람 넷을 세웠다. 넷의 갈래가 갈린 것은 세계가 그들에게 다른
// 값을 주었기 때문이지, 그들이 다른 존재여서가 아니었다 — 넷 다 사람이고 넷 다 같은 손을 가졌다.
//
// 이 장면은 그 앞을 묻는다. **손이 다르면 어떻게 되는가.**
//
//   ① 붉은 장막 세계의 다섯(사냥꾼·장막벌레·채집 결사·협곡을 낀 나라·붉은 장막의 어미)이
//      각자의 유형으로 서고, 열여섯 중 몇을 어떻게 내는지가 갈린다.
//   ② 같은 사냥꾼 종의 셋(몰이꾼·사제·상단)이 문화·역할·금기로 다시 갈린다 — 사제만 의념으로
//      내고, 어미를 섬기는 자들만 장막벌레를 죽이지 않는다.
//   ③ 그 문법을 P1 갈래에 씌우면 갈래가 한 번 더 좁아진다.

import type { Id } from '@hkt/core/v1';
import { evaluatePressure } from '@hkt/core/d4';
import { expandStrategies, type StrategyTree } from '@hkt/core/p1';
import {
  buildGrammar,
  narrowTree,
  type AbilityGrant,
  type AtomBan,
  type NarrowedTree,
  type PossibilityGrammar,
} from '@hkt/core/p2';

import {
  personalGraphOf,
  priestInstance,
  sinceFor,
  trackerInstance,
  S3_DEFINITIONS,
  VEIL_INSTANCES,
} from './d4-veil-world.ts';
import { CRISIS_WORLD, CRISIS_TICK } from './p0-veil-actions.ts';
import { VEIL_CULTURES } from './s2-veil-cultures.ts';
import { hunterArchetype, S1_DEFINITIONS, VEIL_SPECIES } from './s1-veil-species.ts';

/** 세계의 능력 셋 — O0 정의 목록에서 그대로 읽어 온다. */
export function veilAbilities() {
  return S1_DEFINITIONS.filter((definition) => definition.definitionKind === 'ability');
}

export { CRISIS_TICK, CRISIS_WORLD, VEIL_CULTURES, VEIL_SPECIES, hunterArchetype, S1_DEFINITIONS };

/** 붉은 장막 세계의 능력이 어느 원자를 실어 나르는가 — 세계가 선언하고 P2 가 검사한다. */
export const VEIL_GRANTS: readonly AbilityGrant[] = veilAbilities().map((ability) => {
  switch (ability.name) {
    case '붉은 장막':
      return {
        abilityId: ability.id,
        atoms: ['conceal', 'protect'] as const,
        note: '장막을 불러 덮는다 — 가리는 일과 지키는 일을 의념으로 낸다',
      };
    case '독 감별':
      return {
        abilityId: ability.id,
        atoms: ['investigate'] as const,
        note: '무엇이 마비독인지 가려 읽는다 — 조사를 의념으로 낸다',
      };
    default:
      return {
        abilityId: ability.id,
        atoms: ['persuade'] as const,
        note: '전언을 새겨 멀리 있는 이를 움직인다 — 설득을 의념으로 낸다',
      };
  }
});

/** 문화가 금하는 원자 — 할 수 있는데 하지 않는 자리. */
export const VEIL_BANS: readonly AtomBan[] = [
  {
    ruleId: (VEIL_CULTURES.find((culture) => culture.name.includes('어미')) ?? VEIL_CULTURES[0])
      ?.id as Id,
    atoms: ['destroy'],
    note: '어미를 섬기는 자들은 장막벌레를 죽이지 않는다 — 그것은 어미의 숨이 지나간 몸이다',
  },
  {
    ruleId: (VEIL_CULTURES.find((culture) => culture.name.includes('상단')) ?? VEIL_CULTURES[0])
      ?.id as Id,
    atoms: ['seize'],
    note: '고개를 넘는 상단은 빼앗지 않는다 — 한 번 빼앗으면 다음 겨울에 아무도 문을 열지 않는다',
  },
];

/** 유형 다섯이 붉은 장막 세계에서 어떻게 서는가. */
export interface KindCase {
  readonly label: string;
  readonly grammar: PossibilityGrammar;
}

/** 세계에 선 종 다섯 — S1·S2 가 세운 그대로 가져온다. */
export const KIND_CASES: readonly KindCase[] = VEIL_SPECIES.map((species) => ({
  label: species.name,
  grammar: buildGrammar({ archetype: species, culture: null, role: null, capabilities: [] }),
}));

/** 같은 사냥꾼 종의 셋 — 문화·역할이 갈라 놓는다. */
export interface CultureCase {
  readonly label: string;
  readonly grammar: PossibilityGrammar;
  readonly tells: string;
}

function grammarFor(cultureName: string, roleName: string | null, capabilities: readonly Id[]) {
  const culture = VEIL_CULTURES.find((entry) => entry.name.includes(cultureName)) ?? null;
  const role =
    roleName === null
      ? null
      : (culture?.roles.find((entry) => entry.name.includes(roleName)) ?? null);
  return buildGrammar({
    archetype: hunterArchetype,
    culture,
    role,
    capabilities,
    grants: VEIL_GRANTS,
    bans: VEIL_BANS,
  });
}

const veilId = veilAbilities().find((ability) => ability.name === '붉은 장막')?.id ?? '';
const toxinId = veilAbilities().find((ability) => ability.name === '독 감별')?.id ?? '';

export const CULTURE_CASES: readonly CultureCase[] = [
  {
    label: '자국을 쫓는 자들 · 몰이꾼',
    grammar: grammarFor('자국', '몰이꾼', [toxinId]),
    tells: '독을 가려 읽는 눈만 의념으로 낸다 — 나머지는 전부 제 손이다',
  },
  {
    label: '어미를 섬기는 자들 · 사제',
    grammar: grammarFor('어미', '사제', [veilId]),
    tells: '장막을 불러 가리고 지킨다. 그리고 죽이지 않는다 — 낼 손이 있는데도',
  },
  {
    label: '고개를 넘는 상단',
    grammar: grammarFor('상단', null, []),
    tells: '전부 제 손으로 내지만 빼앗지 않는다 — 다음 겨울에 문이 닫히기 때문이다',
  },
];

/**
 * 개체 하나의 P1 갈래.
 * 겨루는 자를 하나 쥐여 준다 — D5 가 서기 전에는 호출자가 주는 값이고(P1 이 남긴 자리),
 * 그래야 경쟁 제거 방향이 열려 **문화가 그 안의 원자를 걸러 내는 것**이 보인다.
 */
export function treeOf(
  instance: typeof trackerInstance,
  rivals: readonly Id[] = [],
): StrategyTree {
  const graph = personalGraphOf(instance);
  return expandStrategies(
    graph,
    evaluatePressure(graph, CRISIS_WORLD, { since: sinceFor(graph) }),
    rivals.length === 0 ? {} : { rivals },
  );
}

/** 겨루는 자가 하나 알려진 몰이꾼의 갈래 — 일곱이 전부 열린다. */
export const RIVAL_TREE: StrategyTree = treeOf(trackerInstance, [priestInstance.id]);

/** 같은 갈래에 문화 셋을 씌운 것 — 남는 원자가 갈린다. */
export interface NarrowedCase {
  readonly label: string;
  readonly tells: string;
  readonly narrowed: NarrowedTree;
  /** 굶주림 앞 충족의 원자 · 경쟁 제거의 원자 */
  readonly fulfillAtoms: readonly string[];
  readonly rivalAtoms: readonly string[];
}

export const CULTURE_NARROWED: readonly NarrowedCase[] = CULTURE_CASES.map((entry) => {
  const narrowed = narrowTree(RIVAL_TREE, entry.grammar);
  const food = narrowed.branches.find((branch) => branch.label === '겨울 식량') ?? null;
  const atomsOfDirection = (direction: string): readonly string[] =>
    food?.options.find((option) => option.direction === direction)?.atoms ?? [];
  return {
    label: entry.label,
    tells: entry.tells,
    narrowed,
    fulfillAtoms: atomsOfDirection('fulfill'),
    rivalAtoms: atomsOfDirection('removeRival'),
  };
});

export const trackerTree: StrategyTree = treeOf(trackerInstance);
export const priestTree: StrategyTree = treeOf(priestInstance);

/** 몰이꾼·사제의 갈래에 각자의 문법을 씌운 것. */
export const trackerNarrowed: NarrowedTree = narrowTree(
  trackerTree,
  CULTURE_CASES[0]?.grammar as PossibilityGrammar,
);
export const priestNarrowed: NarrowedTree = narrowTree(
  priestTree,
  CULTURE_CASES[1]?.grammar as PossibilityGrammar,
);

/** 짐승의 문법으로 사람의 갈래를 좁히면 — 말이 없는 자에게 무엇이 닫히는가. */
export const beastNarrowed: NarrowedTree = narrowTree(
  trackerTree,
  KIND_CASES.find((entry) => entry.label.includes('장막벌레'))?.grammar as PossibilityGrammar,
);

export { S3_DEFINITIONS, VEIL_INSTANCES, priestInstance, trackerInstance };
