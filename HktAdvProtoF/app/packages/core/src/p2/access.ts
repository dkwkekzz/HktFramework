// P2-a 주체 유형별 접근 — 같은 원자를 누가 어떻게 내는가.
//
// P1 까지는 결핍의 **종**만이 갈래를 좁혔다. 자원이 비면 누구에게나 여섯이 열렸다 — 사냥꾼에게도
// 나라에게도 신에게도. 그것은 아직 세계가 아니다. 이 하위 작업이 묻는 것은 하나다:
// **그 원자를 낼 손이 있는가.**
//
// 답은 S0 이 이미 못박아 두었다. 주체는 네 가지 방식으로만 세계에 걸린다:
//
//   사람·생물   몸으로 걸린다        → 손으로 직접 낸다
//   조직        구성원으로 걸린다     → 구성원이 대신 손을 낸다
//   국가        영역 + 구성원        → 구성원이 내고, 제도를 세울 수 있다
//   신          앵커로 걸린다        → 몸도 구성원도 없다. 의념을 치르는 능력으로만 낸다
//
// 그래서 접근은 네 가지다 — 직접 · 구성원 경유 · 능력 경유 · 막힘. 이것은 P2 가 지어낸 규칙이
// 아니라 S0 의 경계 4종을 **행동의 언어로 번역한 것**이고, 검사기가 그 번역이 거짓이 아닌지 본다:
// 몸 없는 종이 직접 한다고 적으면 거부하고, 구성원 없는 종이 시킨다고 적으면 거부하고,
// 의념 자리 없는 종이 능력으로 한다고 적으면 거부한다.
//
// 이 하위 작업의 한 문장: **신은 물건을 집지 못한다.** 그래서 신은 사람을 움직여야 하고,
// 그것이 의례가 생기는 이유다.

import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { SUBJECT_KINDS, type SubjectKind } from '../o1/being.ts';
import type { SpeciesArchetype } from '../s1/index.ts';
import { ACTION_ATOMS, atomGrounding, atomLabel, type ActionAtom } from '../p0/index.ts';
import { violateGrammar, type GrammarViolation } from './violation.ts';

/** 원자를 내는 방식 — S0 경계 4종의 번역. */
export const ATOM_ACCESSES = [
  'direct', // 제 몸으로 낸다
  'viaMembers', // 구성원이 대신 낸다
  'viaAbility', // 의념을 치르는 능력으로 낸다
  'denied', // 낼 길이 없다
] as const;
export type AtomAccess = (typeof ATOM_ACCESSES)[number];

/** 유형 하나가 원자 하나를 어떻게 내는가. */
export interface AccessRule {
  readonly subjectKind: SubjectKind;
  readonly atom: ActionAtom;
  readonly access: AtomAccess;
  /** 왜 그런가 — S0·S1 이 못박은 사실을 든다. 막힘이면 사유가 된다 */
  readonly basis: string;
}

/** 유형이 세계에 걸리는 방식 — 접근 표의 근거가 되는 사실들. */
export interface KindFooting {
  readonly subjectKind: SubjectKind;
  readonly label: string;
  /** 몸이 있는가 (S1 BodyPlan) */
  readonly hasBody: boolean;
  /** 구성원이 있는가 (S0 경계) */
  readonly hasMembers: boolean;
  /** 의념 자리를 갖는가 — 능력은 의념을 치른다 (O0 verifiable-cost) */
  readonly hasPsyche: boolean;
  /** 제도를 세울 수 있는가 — 정당성 자리를 갖는 유형만 */
  readonly makesLaw: boolean;
  readonly note: string;
}

export const KIND_FOOTINGS: readonly KindFooting[] = [
  {
    subjectKind: 'person',
    label: '사람',
    hasBody: true,
    hasMembers: false,
    hasPsyche: true,
    makesLaw: false,
    note: '몸으로 세계에 걸린다 — 열여섯을 전부 제 손으로 낼 수 있는 유일한 유형이다. 대신 혼자다',
  },
  {
    subjectKind: 'creature',
    label: '생물',
    hasBody: true,
    hasMembers: false,
    hasPsyche: true,
    makesLaw: false,
    note: '몸은 있으나 말과 제도가 없다 — 사람과 같은 손을 가지고도 절반만 낸다',
  },
  {
    subjectKind: 'organization',
    label: '조직',
    hasBody: false,
    hasMembers: true,
    hasPsyche: true,
    makesLaw: false,
    note: '몸이 없어 스스로 걷지 못한다 — 구성원이 손이다. 그래서 조직은 굶지 않고 늙지 않는다',
  },
  {
    subjectKind: 'nation',
    label: '국가',
    hasBody: false,
    hasMembers: true,
    hasPsyche: true,
    makesLaw: true,
    note: '구성원이 손이고, 그 위에 제도라는 두 번째 손이 있다 — 법은 남의 손을 움직인다',
  },
  {
    subjectKind: 'god',
    label: '신',
    hasBody: false,
    hasMembers: false,
    hasPsyche: true,
    makesLaw: false,
    note: '몸도 구성원도 없고 앵커만 있다 — 의념을 치르는 능력으로만 세계에 닿는다. 물건을 집지 못한다',
  },
];

export function footingOf(subjectKind: SubjectKind): KindFooting | null {
  return KIND_FOOTINGS.find((entry) => entry.subjectKind === subjectKind) ?? null;
}

/** 원자가 몸을 요구하는가 — 체력을 치르는 원자는 손이 필요하다 (P0 pays). */
export function needsBody(atom: ActionAtom): boolean {
  return atomGrounding(atom)?.pays.some(
    (ref) => ref.domain === 'biological' && ref.path === 'vitality',
  ) === true;
}

/**
 * 원자가 상대의 동의를 요구하는가 — P0 동의 축을 그대로 읽는다.
 * 말이 없는 종은 이 원자들을 낼 수 없다: 합의는 말로만 성립한다.
 */
export function needsAgreement(atom: ActionAtom): boolean {
  return atomGrounding(atom)?.consent === 'mutual';
}

/** 원자가 몸으로 자리를 옮기는가 — 앵커로만 걸린 존재가 못 하는 일의 기준. */
export function carriesMatter(atom: ActionAtom): boolean {
  return atomGrounding(atom)?.writes.some(
    (ref) => ref.domain === 'physical' && ref.path === 'region',
  ) === true;
}

/** 유형 × 원자 격자 — 5 × 16 = 80칸. 순서는 SUBJECT_KINDS × ACTION_ATOMS 그대로다. */
export const ACCESS_RULES: readonly AccessRule[] = buildAccessRules();

/**
 * 격자를 손으로 여든 줄 적지 않는다 — **세 사실에서 계산한다.**
 * 몸이 있으면 직접, 없고 구성원이 있으면 구성원 경유, 둘 다 없고 의념이 있으면 능력 경유.
 * 그 위에 유형별 사정(생물의 말·제도 없음, 신의 물건 못 집음)이 얹힌다.
 *
 * 계산으로 두는 까닭은 표를 손으로 적으면 근거와 값이 갈라지기 때문이다 — D0·P0 에서와 같다.
 */
function buildAccessRules(): readonly AccessRule[] {
  const rules: AccessRule[] = [];
  for (const footing of KIND_FOOTINGS) {
    for (const atom of ACTION_ATOMS) {
      rules.push({ subjectKind: footing.subjectKind, atom, ...decide(footing, atom) });
    }
  }
  return rules;
}

/** 원자가 무엇을 요구하는지와 유형이 무엇을 가졌는지를 맞대어 접근을 정한다. */
function decide(
  footing: KindFooting,
  atom: ActionAtom,
): { readonly access: AtomAccess; readonly basis: string } {
  const ground = atomGrounding(atom);
  const label = atomLabel(atom);

  // 생물은 말이 없다 — 몸이 사람과 같아도 합의로 서는 원자를 내지 못한다.
  if (footing.subjectKind === 'creature' && needsAgreement(atom)) {
    return {
      access: 'denied',
      basis: `${footing.label}은 말이 없다 — ${label}는 상대의 동의로 서는 원자이고 합의는 말로만 성립한다 (P0 동의 축)`,
    };
  }
  // 맺지 못하는 자는 어기지도 못한다 — 동맹이 막히면 배신도 막힌다.
  if (footing.subjectKind === 'creature' && atom === 'betray') {
    return {
      access: 'denied',
      basis: `${footing.label}은 약속을 맺지 못하므로 어길 것도 없다 — 동맹이 막힌 자리의 그림자다`,
    };
  }

  // 신은 물건을 집지 못한다 — 몸으로 자리를 옮기는 원자가 막힌다.
  if (footing.subjectKind === 'god' && carriesMatter(atom)) {
    return {
      access: 'denied',
      basis: `${footing.label}은 앵커로만 걸린다 — ${label}는 물건이나 몸의 자리를 옮기는 일이라 손이 필요하다. 그래서 신은 사람을 움직여야 하고, 그것이 의례가 생기는 자리다`,
    };
  }

  if (!needsBody(atom)) {
    // 몸을 안 쓰는 원자(치르는 것이 재고·신뢰·빚·의념)는 유형을 가리지 않는다.
    return {
      access: footing.hasBody ? 'direct' : footing.hasMembers ? 'viaMembers' : 'viaAbility',
      basis: `${label}는 몸이 아니라 ${(ground?.pays ?? []).map((ref) => ref.domain).join('·')} 를 치른다 — ${
        footing.hasBody ? '제 손으로 낸다' : footing.hasMembers ? '구성원이 낸다' : '의념으로 낸다'
      }`,
    };
  }

  if (footing.hasBody) {
    return { access: 'direct', basis: `${footing.label}은 몸이 있으므로 ${label}를 제 손으로 낸다` };
  }
  if (footing.hasMembers) {
    return {
      access: 'viaMembers',
      basis: `${footing.label}은 몸이 없다 — ${label}는 구성원의 손을 빌려야 선다`,
    };
  }
  if (footing.hasPsyche) {
    return {
      access: 'viaAbility',
      basis: `${footing.label}은 몸도 구성원도 없다 — ${label}는 의념을 치르는 능력으로만 낸다`,
    };
  }
  return { access: 'denied', basis: `${footing.label}은 ${label}를 낼 어떤 길도 갖지 않는다` };
}

/** 유형 하나가 원자 하나를 어떻게 내는가. */
export function accessOf(
  subjectKind: SubjectKind,
  atom: ActionAtom,
  rules: readonly AccessRule[] = ACCESS_RULES,
): AccessRule | null {
  return rules.find((rule) => rule.subjectKind === subjectKind && rule.atom === atom) ?? null;
}

/** 그 유형이 어떻게든 낼 수 있는 원자들. */
export function atomsFor(
  subjectKind: SubjectKind,
  rules: readonly AccessRule[] = ACCESS_RULES,
): readonly ActionAtom[] {
  return rules
    .filter((rule) => rule.subjectKind === subjectKind && rule.access !== 'denied')
    .map((rule) => rule.atom);
}

/** 접근 격자 검사 결과. */
export interface AccessReport {
  /** 유형별로 낼 수 있는 원자 */
  readonly byKind: Readonly<Record<string, readonly ActionAtom[]>>;
  /** 유형별 접근 방식 개수 */
  readonly counts: Readonly<Record<string, Readonly<Record<string, number>>>>;
  /** 아무 원자도 못 내는 유형 */
  readonly muteKinds: readonly SubjectKind[];
  /** 모든 유형이 낼 수 있는 원자 — 누구에게나 열린 길 */
  readonly universal: readonly ActionAtom[];
  readonly violations: readonly GrammarViolation[];
  readonly complete: boolean;
}

/** 격자가 온전한가 — 빈 칸 없이 서고, 선언한 접근이 유형의 사실과 어긋나지 않는가. */
export function checkAccess(
  rules: readonly AccessRule[] = ACCESS_RULES,
  footings: readonly KindFooting[] = KIND_FOOTINGS,
): AccessReport {
  const violations: GrammarViolation[] = [];
  const seen = new Set<string>();

  for (const [index, rule] of rules.entries()) {
    const at = `$.rules[${String(index)}]`;
    const footing = footings.find((entry) => entry.subjectKind === rule.subjectKind) ?? null;

    if (footing === null) {
      violateGrammar(
        violations,
        rule.subjectKind,
        'phantom-kind',
        at,
        `주체 5종 밖의 유형 ${JSON.stringify(rule.subjectKind)} 이다`,
      );
      continue;
    }
    if (!(ACTION_ATOMS as readonly string[]).includes(rule.atom)) {
      violateGrammar(violations, rule.subjectKind, 'phantom-atom', at, `16원자 밖의 이름 ${rule.atom} 이다`);
      continue;
    }
    if (!(ATOM_ACCESSES as readonly string[]).includes(rule.access)) {
      violateGrammar(
        violations,
        rule.subjectKind,
        'unknown-access',
        `${at}.access`,
        `선언되지 않은 접근 ${JSON.stringify(rule.access)} 이다`,
      );
      continue;
    }

    const key = `${rule.subjectKind}/${rule.atom}`;
    if (seen.has(key)) {
      violateGrammar(violations, rule.subjectKind, 'duplicate-access', at, `${key} 가 두 번 적혔다`);
    }
    seen.add(key);

    if (rule.basis === '') {
      violateGrammar(
        violations,
        rule.subjectKind,
        'unreasoned-denial',
        `${at}.basis`,
        `${footing.label}의 ${atomLabel(rule.atom)} 판정에 근거가 없다 — 근거 없는 문법은 임의의 게임 규칙이다`,
      );
    }

    // 선언한 접근이 유형의 사실과 어긋나는가 — 여기가 이 검사기의 심장이다.
    if (rule.access === 'direct' && !footing.hasBody) {
      violateGrammar(
        violations,
        rule.subjectKind,
        'bodiless-direct',
        `${at}.access`,
        `${footing.label}은 몸이 없는데 ${atomLabel(rule.atom)} 를 제 손으로 낸다고 적었다`,
      );
    }
    if (rule.access === 'viaMembers' && !footing.hasMembers) {
      violateGrammar(
        violations,
        rule.subjectKind,
        'memberless-delegation',
        `${at}.access`,
        `${footing.label}은 구성원이 없는데 ${atomLabel(rule.atom)} 를 시켜서 낸다고 적었다`,
      );
    }
    if (rule.access === 'viaAbility' && !footing.hasPsyche) {
      violateGrammar(
        violations,
        rule.subjectKind,
        'mindless-ability',
        `${at}.access`,
        `${footing.label}은 의념 자리가 없는데 ${atomLabel(rule.atom)} 를 능력으로 낸다고 적었다 — 능력은 의념을 치른다 (O0 verifiable-cost)`,
      );
    }
  }

  // 격자에 빈 칸이 있는가.
  for (const footing of footings) {
    for (const atom of ACTION_ATOMS) {
      if (seen.has(`${footing.subjectKind}/${atom}`)) continue;
      violateGrammar(
        violations,
        footing.subjectKind,
        'missing-access',
        '$.rules',
        `${footing.label} × ${atomLabel(atom)} 칸이 비었다 — 못 낸다면 못 낸다고 적어야 한다`,
      );
    }
  }

  const byKind: Record<string, readonly ActionAtom[]> = {};
  const counts: Record<string, Record<string, number>> = {};
  const muteKinds: SubjectKind[] = [];
  for (const footing of footings) {
    const mine = rules.filter((rule) => rule.subjectKind === footing.subjectKind);
    byKind[footing.subjectKind] = mine
      .filter((rule) => rule.access !== 'denied')
      .map((rule) => rule.atom);
    counts[footing.subjectKind] = Object.fromEntries(
      ATOM_ACCESSES.map((access) => [access, mine.filter((rule) => rule.access === access).length]),
    );
    if ((byKind[footing.subjectKind] ?? []).length === 0) {
      muteKinds.push(footing.subjectKind);
      violateGrammar(
        violations,
        footing.subjectKind,
        'atomless-kind',
        '$.rules',
        `${footing.label}은 어떤 원자도 내지 못한다 — 아무것도 못 하는 주체는 세계에 설 수 없다`,
      );
    }
  }

  const universal = ACTION_ATOMS.filter((atom) =>
    SUBJECT_KINDS.every((kind) => (byKind[kind] ?? []).includes(atom)),
  );

  return {
    byKind,
    counts,
    muteKinds,
    universal: stableSort([...universal], compareStrings) as readonly ActionAtom[],
    violations,
    complete: rules.length > 0 && violations.length === 0,
  };
}

/**
 * 그 종이 제도를 세울 수 있는가 — 정당성 자리를 갖는 종만 법을 세운다.
 * 유형 표가 아니라 **그 종이 실제로 선언한 자리**에서 읽는다 (O0 SpeciesDefinition.slots).
 * 그래서 결사와 나라는 같은 구성원의 손을 쓰고도 법 앞에서 갈린다.
 */
export function makesLaw(archetype: SpeciesArchetype): boolean {
  return archetype.slots.some(
    (slot) => slot.domain === 'transcendent' && slot.path === 'legitimacy',
  );
}

/** 종 원형이 선언한 사실이 유형의 걸림과 맞는가 — 표와 실제 종이 어긋나지 않게. */
export function checkArchetypeFooting(
  archetype: SpeciesArchetype,
  path = '$.archetype',
): readonly GrammarViolation[] {
  const violations: GrammarViolation[] = [];
  const footing = footingOf(archetype.subjectKind);
  if (footing === null) {
    violateGrammar(
      violations,
      archetype.subjectKind,
      'phantom-kind',
      `${path}.subjectKind`,
      `주체 5종 밖의 유형이다`,
    );
    return violations;
  }
  if (footing.hasBody !== (archetype.body !== null)) {
    violateGrammar(
      violations,
      archetype.subjectKind,
      footing.hasBody ? 'bodiless-direct' : 'unreasoned-denial',
      `${path}.body`,
      `${footing.label}은 몸이 ${footing.hasBody ? '있어야' : '없어야'} 하는데 ${archetype.name} 은 반대로 서 있다`,
    );
  }
  if (footing.hasPsyche && !archetype.slots.some((slot) => slot.domain === 'psychic')) {
    violateGrammar(
      violations,
      archetype.subjectKind,
      'mindless-ability',
      `${path}.slots`,
      `${archetype.name} 에 의념 자리가 없다 — 능력으로 무엇도 낼 수 없다`,
    );
  }
  return violations;
}

/** 격자를 한 줄 판정으로 접는다. */
export function accessVerdict(report: AccessReport): string {
  if (report.complete) {
    return `유형 5 × 원자 16 격자가 다 찼다 (누구에게나 열린 원자 ${String(report.universal.length)} · 아무것도 못 하는 유형 ${String(report.muteKinds.length)})`;
  }
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `격자가 막혔다 — ${rules.join(', ')}`;
}
