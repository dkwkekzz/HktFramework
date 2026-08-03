// P2-b 문화·역할 겹침 — 같은 종의 둘이 서로 다른 문법을 갖는다.
//
// 유형 격자(P2-a)는 "그 원자를 낼 손이 있는가" 까지만 답한다. 사냥꾼 셋은 같은 몸을 가졌으니
// 거기까지는 똑같다. 갈리는 것은 그 다음이다:
//
//   능력   그 원자를 **의념으로도** 낼 수 있게 한다 (대가가 몸에서 의념으로 옮겨 간다)
//   금기   그 원자를 닫는다 — 할 수 있는데 하지 않는 것, 그것이 문화다
//
// S2 는 이미 문화·역할이 능력을 열고 닫는 것을 세웠다. P2 는 그 위에 두 가지를 더한다:
// **능력이 어느 원자를 실어 나르는가**(AbilityGrant)와 **문화가 어느 원자를 금하는가**(CultureBan).
// 둘 다 세계가 선언하는 값이고, 검사기는 그것이 거짓이 아닌지만 본다 — 없는 능력을 인용하거나,
// 16원자 밖을 적거나, 아무도 열지 않은 것을 금하거나, 금기가 낼 수 있는 것을 전부 닫으면 거부한다.
//
// 이 하위 작업의 한 문장: **할 수 있는데 하지 않는 것이 문화다.** 어미를 섬기는 자들은
// 장막벌레를 죽일 손이 있고 죽일 이유도 있지만 죽이지 않는다 — 그 한 칸이 그들을 만든다.

import type { Id } from '../v1/id.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import type { SubjectKind } from '../o1/being.ts';
import type { Definition } from '../o0/index.ts';
import type { SpeciesArchetype } from '../s1/index.ts';
import type { CultureArchetype, RoleArchetype } from '../s2/index.ts';
import { ACTION_ATOMS, atomLabel, type ActionAtom } from '../p0/index.ts';
import { accessOf, atomsFor, type AtomAccess } from './access.ts';
import { violateGrammar, type GrammarViolation } from './violation.ts';

/** 능력 하나가 실어 나르는 원자들 — 세계가 선언하고 검사기가 본다. */
export interface AbilityGrant {
  readonly abilityId: Id;
  readonly atoms: readonly ActionAtom[];
  /** 왜 그 능력이 그 원자를 싣는가 */
  readonly note: string;
}

/** 문화·역할이 금하는 원자 — 할 수 있는데 하지 않는 자리. */
export interface AtomBan {
  /** 어느 문화·역할의 금기인가 */
  readonly ruleId: Id;
  readonly atoms: readonly ActionAtom[];
  readonly note: string;
}

/** 원자 하나가 이 주체에게 어떻게 서는가. */
export interface GrammarEntry {
  readonly atom: ActionAtom;
  readonly access: AtomAccess;
  /** 무엇이 이 자리를 열었는가 */
  readonly openedBy: 'kind' | 'ability';
  /** 무엇이 닫았는가. 열려 있으면 null */
  readonly closedBy: 'kind' | 'taboo' | null;
  /** 닫은 것이 금기라면 어느 규칙인가 */
  readonly byRuleId: Id | null;
  readonly note: string;
}

/** 한 주체의 가능성 문법 — 무엇을 어떻게 낼 수 있고 무엇을 하지 않는가. */
export interface PossibilityGrammar {
  readonly subjectKind: SubjectKind;
  readonly speciesId: Id;
  readonly cultureId: Id | null;
  readonly roleId: Id | null;
  /** 열여섯 전부 — 닫힌 것도 자리를 지킨다 (P1 과 같은 원칙) */
  readonly entries: readonly GrammarEntry[];
  readonly allowed: readonly ActionAtom[];
  readonly denied: readonly ActionAtom[];
  /** 의념으로도 낼 수 있게 된 원자 — 능력이 실어 나른 것 */
  readonly empowered: readonly ActionAtom[];
  /** 금기가 닫은 원자 */
  readonly banned: readonly ActionAtom[];
}

/** 문법을 세울 재료. */
export interface GrammarSpec {
  readonly archetype: SpeciesArchetype;
  readonly culture?: CultureArchetype | null;
  readonly role?: RoleArchetype | null;
  /** 이 주체가 지금 지닌 능력 (S2 가 종+역할−금기로 계산해 준 것) */
  readonly capabilities?: readonly Id[];
  /** 세계가 선언한 능력↔원자 배정 */
  readonly grants?: readonly AbilityGrant[];
  /** 세계가 선언한 문화·역할의 원자 금기 */
  readonly bans?: readonly AtomBan[];
}

/** 재료에서 문법을 세운다 — 유형이 깔고, 능력이 얹고, 금기가 덜어 낸다. */
export function buildGrammar(spec: GrammarSpec): PossibilityGrammar {
  const kind = spec.archetype.subjectKind;
  const capabilities = spec.capabilities ?? [];
  const grants = (spec.grants ?? []).filter((grant) => capabilities.includes(grant.abilityId));
  const ruleIds = [spec.culture?.id ?? null, spec.role?.id ?? null].filter(
    (id): id is Id => id !== null,
  );
  const bans = (spec.bans ?? []).filter((ban) => ruleIds.includes(ban.ruleId));

  const byKind = new Set(atomsFor(kind));
  const empowered = new Map<ActionAtom, AbilityGrant>();
  for (const grant of grants) {
    for (const atom of grant.atoms) {
      // 능력은 유형이 막은 자리를 열지 못한다 — 몸이 없으면 능력으로도 물건을 집지 못한다.
      if (!byKind.has(atom)) continue;
      empowered.set(atom, grant);
    }
  }
  const banned = new Map<ActionAtom, AtomBan>();
  for (const ban of bans) {
    for (const atom of ban.atoms) banned.set(atom, ban);
  }

  const entries: GrammarEntry[] = ACTION_ATOMS.map((atom) => {
    const rule = accessOf(kind, atom);
    const kindAccess = rule?.access ?? 'denied';
    const grant = empowered.get(atom) ?? null;
    const ban = banned.get(atom) ?? null;

    if (kindAccess === 'denied') {
      return {
        atom,
        access: 'denied' as const,
        openedBy: 'kind' as const,
        closedBy: 'kind' as const,
        byRuleId: null,
        note: rule?.basis ?? '',
      };
    }
    if (ban !== null) {
      return {
        atom,
        access: 'denied' as const,
        openedBy: grant === null ? ('kind' as const) : ('ability' as const),
        closedBy: 'taboo' as const,
        byRuleId: ban.ruleId,
        note: `${ban.note} — 낼 손은 있으나 하지 않는다`,
      };
    }
    if (grant !== null) {
      return {
        atom,
        access: 'viaAbility' as const,
        openedBy: 'ability' as const,
        closedBy: null,
        byRuleId: null,
        note: `${grant.note} — 대가가 몸에서 의념으로 옮겨 간다`,
      };
    }
    return {
      atom,
      access: kindAccess,
      openedBy: 'kind' as const,
      closedBy: null,
      byRuleId: null,
      note: rule?.basis ?? '',
    };
  });

  return {
    subjectKind: kind,
    speciesId: spec.archetype.id,
    cultureId: spec.culture?.id ?? null,
    roleId: spec.role?.id ?? null,
    entries,
    allowed: entries.filter((entry) => entry.access !== 'denied').map((entry) => entry.atom),
    denied: entries.filter((entry) => entry.access === 'denied').map((entry) => entry.atom),
    empowered: entries.filter((entry) => entry.openedBy === 'ability' && entry.closedBy === null).map((entry) => entry.atom),
    banned: entries.filter((entry) => entry.closedBy === 'taboo').map((entry) => entry.atom),
  };
}

/** 그 원자가 이 문법에서 어떻게 서는가. */
export function entryOf(grammar: PossibilityGrammar, atom: ActionAtom): GrammarEntry | null {
  return grammar.entries.find((entry) => entry.atom === atom) ?? null;
}

/** 이 문법이 허락하는가. */
export function allows(grammar: PossibilityGrammar, atom: ActionAtom): boolean {
  return grammar.allowed.includes(atom);
}

/** 문법이 온전한가 — 인용이 실재하고, 금기가 무엇을 닫는지 알고, 전부를 닫지 않는가. */
export function checkGrammar(
  grammar: PossibilityGrammar,
  spec: GrammarSpec,
  definitions: readonly Definition[] = [],
  path = '$.grammar',
): readonly GrammarViolation[] {
  const violations: GrammarViolation[] = [];
  const subject = grammar.speciesId;

  // 문화가 이 종을 받는가 (S2 가 이미 못박은 조항을 여기서도 지킨다).
  if (spec.culture != null && !spec.culture.speciesIds.includes(grammar.speciesId)) {
    violateGrammar(
      violations,
      subject,
      'foreign-culture',
      `${path}.cultureId`,
      `${spec.culture.name} 은 이 종이 지닐 수 있는 문화가 아니다 — 감각이 다르면 같은 것을 읽지 못한다 (S2)`,
    );
  }
  // 역할은 문화 안의 자리다.
  if (spec.role != null && spec.culture != null && spec.role.cultureId !== spec.culture.id) {
    violateGrammar(
      violations,
      subject,
      'roleless-grant',
      `${path}.roleId`,
      `${spec.role.name} 은 ${spec.culture.name} 의 자리가 아니다`,
    );
  }
  if (spec.role != null && spec.culture == null) {
    violateGrammar(
      violations,
      subject,
      'roleless-grant',
      `${path}.roleId`,
      `문화 없이 자리만 선 개체다 — 자리는 문화 안에서만 선다 (S2)`,
    );
  }

  // 능력↔원자 배정이 실재하는 능력과 16원자를 가리키는가.
  for (const [index, grant] of (spec.grants ?? []).entries()) {
    const at = `${path}.grants[${String(index)}]`;
    if (!knownAbility(grant.abilityId, definitions)) {
      violateGrammar(
        violations,
        subject,
        'unknown-ability',
        at,
        `세계에 없는 능력 ${grant.abilityId} 이 원자를 싣는다고 적혔다`,
      );
    }
    for (const atom of grant.atoms) {
      if ((ACTION_ATOMS as readonly string[]).includes(atom)) continue;
      violateGrammar(violations, subject, 'phantom-atom', at, `16원자 밖의 이름 ${atom} 을 실었다`);
    }
    if (grant.note === '') {
      violateGrammar(
        violations,
        subject,
        'unreasoned-denial',
        `${at}.note`,
        `${grant.abilityId} 이 왜 그 원자를 싣는지 적지 않았다`,
      );
    }
  }

  // 금기가 실제로 무엇인가를 닫는가 — 아무도 열지 않은 것은 금할 수 없다 (S2 선례).
  const openByKind = new Set(atomsFor(grammar.subjectKind));
  for (const [index, ban] of (spec.bans ?? []).entries()) {
    const at = `${path}.bans[${String(index)}]`;
    for (const atom of ban.atoms) {
      if (!(ACTION_ATOMS as readonly string[]).includes(atom)) {
        violateGrammar(violations, subject, 'phantom-atom', at, `16원자 밖의 이름 ${atom} 을 금했다`);
        continue;
      }
      if (openByKind.has(atom)) continue;
      violateGrammar(
        violations,
        subject,
        'ungranted-taboo',
        at,
        `${atomLabel(atom)} 는 이 유형이 애초에 낼 수 없다 — 아무도 열지 않은 것을 금할 수는 없다`,
      );
    }
  }

  if (grammar.allowed.length === 0) {
    violateGrammar(
      violations,
      subject,
      'total-taboo',
      `${path}.allowed`,
      `낼 수 있는 원자가 하나도 남지 않았다 — 금기가 전부를 닫으면 그 개체는 아무것도 하지 못한다 (S2 total-taboo)`,
    );
  }

  return violations;
}

/** 인용한 능력이 세계에 있는가 — 정의 목록이 주어졌을 때만 본다 (없으면 검사하지 않는다). */
function knownAbility(abilityId: Id, definitions: readonly Definition[]): boolean {
  if (definitions.length === 0) return true;
  return definitions.some(
    (definition) => definition.id === abilityId && definition.definitionKind === 'ability',
  );
}

/** 두 문법이 어디서 갈리는가 — 화면 대조표용. */
export interface GrammarDiff {
  readonly onlyLeft: readonly ActionAtom[];
  readonly onlyRight: readonly ActionAtom[];
  readonly bothAllowed: readonly ActionAtom[];
  /** 같은 원자를 다르게 내는 자리 (`제거: direct ↔ viaAbility`) */
  readonly differentAccess: readonly string[];
}

export function diffGrammars(
  left: PossibilityGrammar,
  right: PossibilityGrammar,
): GrammarDiff {
  const differentAccess: string[] = [];
  for (const atom of ACTION_ATOMS) {
    const a = entryOf(left, atom);
    const b = entryOf(right, atom);
    if (a === null || b === null) continue;
    if (a.access !== b.access && a.access !== 'denied' && b.access !== 'denied') {
      differentAccess.push(`${atomLabel(atom)}: ${a.access} ↔ ${b.access}`);
    }
  }
  return {
    onlyLeft: left.allowed.filter((atom) => !right.allowed.includes(atom)),
    onlyRight: right.allowed.filter((atom) => !left.allowed.includes(atom)),
    bothAllowed: left.allowed.filter((atom) => right.allowed.includes(atom)),
    differentAccess: stableSort(differentAccess, compareStrings),
  };
}

/** 문법을 한 줄로 접는다 — 터미널·배지용. */
export function grammarVerdict(grammar: PossibilityGrammar): string {
  return `열여섯 중 ${String(grammar.allowed.length)}을 낸다 (의념으로 ${String(grammar.empowered.length)} · 금기로 닫힌 것 ${String(grammar.banned.length)} · 유형이 막은 것 ${String(grammar.denied.length - grammar.banned.length)})`;
}
