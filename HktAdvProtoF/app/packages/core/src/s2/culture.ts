// S2-d 문화 원형 조립 — 셋을 하나로 합치고, 종 위에 문화를 겹치면 개체가 갈린다.
//
// S1-e 는 종에서 씨앗(감각·의존·능력)을 냈고, 그 씨앗으로 태어난 둘은 완전히 같았다.
// 여기서 그 위에 문화를 겹친다. 겹친 뒤 남는 것이 `SubjectSeed` — S0 SubjectSpec 이
// 손으로 적을 것이 이제 이름표·경계뿐이 되는 자리다.
//
//   종에서 온다   감각(perception) · 의존(needs)
//   문화에서 온다 읽기(readings) · 원함(values)
//   둘이 겹친다   능력(capabilities) — 종이 연 것 + 역할이 연 것 − 금기
//
// 문화는 종을 고르지 못한다. 몸도 감각도 다른 종은 같은 것을 읽을 수 없으므로, 문화는
// **어느 종의 것인지**를 밝혀야 한다 (speciesIds). 그리고 그 종의 감각과 대조되어,
// 열리지 않은 통로를 읽는 문화는 그 종에게 얹히지 않는다 (S2-a 의 관문).
//
// 마지막 관문 하나가 여기서 닫힌다. 금기가 개체의 능력을 전부 막으면 그 개체는 아무것도
// 할 수 없다 — S0 이 "무엇을 할 수 있는가" 에 답하지 못하는 주체를 사물이라 불렀던 그 자리다.

import type { Id } from '../v1/id.ts';
import type { Rule } from '../o1/operation.ts';
import { classify } from '../o1/index.ts';
import type { Definition } from '../o0/definition.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import type { PerceptionProfile } from '../s0/perception.ts';
import type { Need, ValueTarget } from '../s0/stake.ts';
import type { SpeciesArchetype, SpeciesSeed } from '../s1/archetype.ts';
import {
  checkReadings,
  checkReadingsPresent,
  mergeReadings,
  type ReadingRule,
} from './reading.ts';
import {
  checkValuesPresent,
  checkValueTemplates,
  instantiateValues,
  mergeValues,
  type ValuePlace,
  type ValueTemplate,
} from './value.ts';
import { applyRole, checkRole, roleSummary, type RoleArchetype } from './role.ts';
import {
  cultureRef,
  roleRef,
  violateCulture,
  type CultureRef,
  type CultureViolation,
} from './violation.ts';

/** 문화 원형 — O1 Rule 이다 ("이 문화에 속한 자는 이렇게 읽고 이것을 원한다"). */
export interface CultureArchetype extends Rule {
  /** 어느 종들이 이 문화를 지닐 수 있는가 — 감각이 다르면 같은 것을 읽지 못한다 */
  readonly speciesIds: readonly Id[];
  readonly readings: readonly ReadingRule[];
  readonly values: readonly ValueTemplate[];
  /** 문화 전체의 금기 — 어느 자리에 서든 막힌다 */
  readonly taboos: readonly Id[];
  /** 문화 안의 자리들 — 자리 없는 문화는 개체를 더 가르지 못한다 */
  readonly roles: readonly RoleArchetype[];
}

/** 문화를 세울 때 손으로 적는 것. */
export interface CultureSpec {
  readonly id: Id;
  readonly name: string;
  readonly domain: Rule['domain'];
  readonly when: readonly string[];
  readonly then: readonly string[];
  readonly axiomId: Id | null;
  readonly speciesIds: readonly Id[];
  readonly readings: readonly ReadingRule[];
  readonly values: readonly ValueTemplate[];
  readonly taboos?: readonly Id[];
  readonly roles: readonly RoleArchetype[];
}

/** 선언에서 문화를 세운다. */
export function buildCulture(spec: CultureSpec): CultureArchetype {
  return {
    kind: 'Rule',
    id: spec.id,
    domain: spec.domain,
    name: spec.name,
    when: spec.when,
    then: spec.then,
    axiomId: spec.axiomId,
    speciesIds: spec.speciesIds,
    readings: spec.readings,
    values: spec.values,
    taboos: spec.taboos ?? [],
    roles: spec.roles,
  };
}

/** 그 자리를 찾는다. 없으면 null. */
export function roleOf(culture: CultureArchetype, roleId: Id): RoleArchetype | null {
  return culture.roles.find((role) => role.id === roleId) ?? null;
}

/**
 * 문화 하나가 이 종 위에 설 수 있는가 — S2 의 모든 검사를 한 자리에서 돌린다.
 * 던지지 않는다. 거부된 문화도 사유·경로와 함께 화면에 실린다.
 */
export function checkCulture(
  culture: CultureArchetype,
  species: readonly SpeciesArchetype[] = [],
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): readonly CultureViolation[] {
  const out: CultureViolation[] = [];
  const ref: CultureRef = cultureRef(culture);

  // 문화가 O1 Rule 로 서지 못하면 뒤의 사유가 두 겹으로 쌓여 읽을 수 없게 된다 (O0·S0·S1 과 같은 태도).
  const shape = classify(culture);
  if (shape.kind !== 'Rule') {
    for (const violation of shape.violations) {
      violateCulture(
        out,
        ref,
        'bad-culture',
        violation.path,
        `문화가 O1 Rule 로 서지 못한다 (${violation.rule}) — ${violation.message}`,
      );
    }
    return out;
  }

  // 어느 종의 문화인가 — 이것이 정해져야 읽기를 감각과 대조할 수 있다.
  const bearers: SpeciesArchetype[] = [];
  const seenSpecies = new Set<Id>();
  for (const [index, id] of culture.speciesIds.entries()) {
    const path = `$.speciesIds[${String(index)}]`;
    if (seenSpecies.has(id)) {
      violateCulture(out, ref, 'duplicate-culture-species', path, `같은 종을 두 번 적었다 — ${id}`);
      continue;
    }
    seenSpecies.add(id);
    const found = species.find((archetype) => archetype.id === id);
    if (found === undefined) {
      violateCulture(
        out,
        ref,
        'unknown-species',
        path,
        `세계에 없는 종에 얹힌다 — ${id}. 문화는 그것을 지닐 몸이 있어야 선다`,
      );
      continue;
    }
    bearers.push(found);
  }
  if (culture.speciesIds.length === 0) {
    violateCulture(
      out,
      ref,
      'speciesless-culture',
      '$.speciesIds',
      '어느 종의 문화인지 없다 — 지닐 자가 없는 문화는 아무것도 가르지 못한다',
    );
  }

  checkReadingsPresent(ref, culture.readings, out);
  checkValuesPresent(ref, culture.values, out);

  // 종마다 대조한다 — 한 종에게는 서고 다른 종에게는 서지 못하는 문화가 그대로 드러난다.
  if (bearers.length === 0) {
    checkReadings(ref, culture.readings, null, out);
    checkValueTemplates(ref, culture.values, null, true, out, schema);
  }
  for (const bearer of bearers) {
    checkReadings(ref, culture.readings, bearer.senses, out);
    checkValueTemplates(
      ref,
      culture.values,
      bearer.baseNeeds,
      bearer.body !== null,
      out,
      schema,
    );
  }

  if (culture.roles.length === 0) {
    violateCulture(
      out,
      ref,
      'roleless-culture',
      '$.roles',
      '자리가 없는 문화는 그 안의 둘을 더 가르지 못한다 — 사냥 문화에도 몰이꾼과 활잡이가 있다',
    );
  }

  const seenRoles = new Set<string>();
  for (const [index, role] of culture.roles.entries()) {
    if (seenRoles.has(role.name)) {
      violateCulture(
        out,
        roleRef(ref, role.name),
        'duplicate-role',
        `$.roles[${String(index)}].name`,
        `같은 이름의 자리가 둘이다 — ${role.name}`,
      );
      continue;
    }
    seenRoles.add(role.name);

    // 종이 없으면 능력 바닥을 알 수 없다 — 그때는 자리의 형태만 본다 (사유가 두 겹으로 쌓이지 않게).
    const capabilities = bearers[0]?.capabilities ?? null;
    checkRole(
      ref,
      role,
      {
        cultureId: culture.id,
        speciesCapabilities: capabilities,
        cultureTaboos: culture.taboos,
        senses: bearers[0]?.senses ?? null,
        baseNeeds: bearers[0]?.baseNeeds ?? null,
        hasBody: bearers[0] === undefined ? true : bearers[0].body !== null,
      },
      definitions,
      out,
      schema,
    );

    // 아무것도 할 수 없는 개체는 사물이다 (S0 이 그은 선).
    for (const bearer of bearers) {
      const left = applyRole(bearer.capabilities, role.grants, [
        ...culture.taboos,
        ...role.taboos,
      ]);
      if (left.length > 0) continue;
      violateCulture(
        out,
        roleRef(ref, role.name),
        'total-taboo',
        `$.roles[${String(index)}].taboos`,
        `${bearer.name} 의 ${role.name} 은 아무것도 할 수 없게 된다 — 금기가 능력을 전부 막으면 그것은 문화가 아니라 소멸이다`,
      );
    }
  }

  return out;
}

/** 문화 여럿을 한 번에 세울 때의 결과 — 무엇이 섰고 무엇이 왜 막혔는가. */
export interface CultureReport {
  readonly accepted: readonly CultureArchetype[];
  readonly rejected: readonly CultureArchetype[];
  readonly violations: readonly CultureViolation[];
  readonly complete: boolean;
}

/** 문화 목록을 관문에 통과시킨다. 어긴 문화는 세계에 들어가지 않고 사유로 남는다. */
export function checkCultures(
  cultures: readonly CultureArchetype[],
  species: readonly SpeciesArchetype[] = [],
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): CultureReport {
  const accepted: CultureArchetype[] = [];
  const rejected: CultureArchetype[] = [];
  const violations: CultureViolation[] = [];

  for (const culture of cultures) {
    const reasons = checkCulture(culture, species, definitions, schema);
    if (reasons.length === 0) {
      accepted.push(culture);
      continue;
    }
    rejected.push(culture);
    violations.push(...reasons);
  }

  return {
    accepted,
    rejected,
    violations,
    complete: cultures.length > 0 && rejected.length === 0,
  };
}

/** 종 씨앗 위에 문화가 겹쳐진 것 — S0 SubjectSpec 이 그대로 받는다. */
export interface SubjectSeed extends SpeciesSeed {
  readonly cultureId: Id;
  /** 어느 자리에 섰는가. 문화만 지니고 자리가 없으면 null */
  readonly roleId: Id | null;
  readonly perception: PerceptionProfile;
  readonly needs: readonly Need[];
  /** 문화 + 역할의 읽기 — 역할이 덮는다 */
  readonly readings: readonly ReadingRule[];
  /** 문화 + 역할의 원함이 개체의 자리로 찍힌 것 */
  readonly values: readonly ValueTarget[];
  /** 종 + 역할이 연 것 − 문화·역할의 금기 */
  readonly capabilities: readonly Id[];
}

/**
 * 종 씨앗 위에 문화를 겹쳐 개체 씨앗을 낸다.
 * 같은 종·같은 문화·같은 자리·같은 곳이면 언제나 같은 씨앗이다 (V1 태도 그대로).
 */
export function seedWithCulture(
  seed: SpeciesSeed,
  culture: CultureArchetype,
  role: RoleArchetype | null,
  where: ValuePlace,
): SubjectSeed {
  const readings = mergeReadings(culture.readings, role?.readings ?? []);
  const values = mergeValues(culture.values, role?.values ?? []);
  const taboos = [...culture.taboos, ...(role?.taboos ?? [])];
  return {
    ...seed,
    cultureId: culture.id,
    roleId: role?.id ?? null,
    readings,
    values: instantiateValues(values, where),
    capabilities: applyRole(seed.capabilities, role?.grants ?? [], taboos),
  };
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function cultureVerdict(report: CultureReport): string {
  if (report.complete) {
    const roles = report.accepted.reduce((sum, culture) => sum + culture.roles.length, 0);
    return `문화 ${String(report.accepted.length)}개가 섰다 (자리 ${String(roles)}개)`;
  }
  if (report.accepted.length + report.rejected.length === 0) return '세울 문화가 없다';
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `문화 ${String(report.rejected.length)}개가 막혔다 — ${rules.join(', ')}`;
}

/** 문화를 한 줄로 접는다 — 문화 카드용. */
export function cultureSummary(culture: CultureArchetype): string {
  return `${culture.name} — 읽기 ${String(culture.readings.length)} · 원함 ${String(culture.values.length)} · 자리 ${culture.roles.map((role) => roleSummary(role)).join(' / ')}`;
}
