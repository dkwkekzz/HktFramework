// S2-c 역할 — 원문 S2 의 둘째 낱말, "다른 **행동 가능성**".
//
// 문화가 무엇을 읽고 무엇을 원하는지를 주었다면, 역할은 **무엇을 할 수 있고 무엇을 해서는
// 안 되는지**를 준다. 같은 사냥 문화 안에서도 몰이꾼과 활잡이가 다른 것을 하고, 같은 제의
// 문화 안에서도 사제와 신도가 다른 것을 한다. 자리가 곧 가능성이다.
//
// 여기서 능력이 두 방향으로 움직인다.
//
//   grants  입문 의례가 연다. **종이 열지 않은 능력도 연다** — 배우는 것이기 때문이다.
//           대신 그 능력은 O0 를 지나야 한다. 문화라고 공리를 비켜 갈 수는 없다(S1 과 같은 태도).
//           종이 이미 여는 것을 또 여는 것은 입문 의례가 아니다 — 아무것도 더하지 않는다.
//   taboos  금기가 막는다. 막을 것이 있어야 금기다 — 아무도 열지 않은 능력을 금하는 것은
//           금기가 아니라 빈말이다. 자기가 연 것을 자기가 막는 자리도 설 수 없다.
//
// 역할은 문화 위에 덧댄다 — 읽기도 원함도 덮어쓸 수 있다(mergeReadings·mergeValues).
// 덮되 빼지 않는다: 역할이 아무것도 덧대지 않으면 그것은 자리가 아니라 이름표다.

import { idKind, type Id } from '../v1/id.ts';
import type { Rule } from '../o1/operation.ts';
import { validateDefinition, type Definition } from '../o0/definition.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { abilityOf } from '../s0/subject.ts';
import type { NeedTemplate } from '../s1/needs.ts';
import type { SenseSpec } from '../s1/senses.ts';
import { checkReadings, type ReadingRule } from './reading.ts';
import { checkValueTemplates, type ValueTemplate } from './value.ts';
import {
  roleRef,
  violateCulture,
  type CultureRef,
  type CultureViolation,
} from './violation.ts';

/** 문화 안의 자리 하나 — O1 Rule 이다 ("이 자리에 선 자는 이것을 할 수 있다"). */
export interface RoleArchetype extends Rule {
  /** 어느 문화의 자리인가 — CultureArchetype 의 ID */
  readonly cultureId: Id;
  /** 입문 의례가 여는 능력 — O0 를 지난 능력 ID (종이 열지 않은 것도 된다) */
  readonly grants: readonly Id[];
  /** 금기가 막는 능력 — 종이나 문화가 연 것만 막을 수 있다 */
  readonly taboos: readonly Id[];
  /** 이 자리만의 읽기 — 문화의 읽기를 덮는다 */
  readonly readings: readonly ReadingRule[];
  /** 이 자리만의 원함 — 문화의 원함을 덮는다 */
  readonly values: readonly ValueTemplate[];
}

/** 역할을 세울 때 손으로 적는 것 — Rule 의 껍데기는 여기서 만든다. */
export interface RoleSpec {
  readonly cultureId: Id;
  readonly id: Id;
  readonly name: string;
  readonly domain: Rule['domain'];
  readonly when: readonly string[];
  readonly then: readonly string[];
  /** 이 자리가 어느 공리에 기대는가. 근거 없으면 null */
  readonly axiomId: Id | null;
  readonly grants?: readonly Id[];
  readonly taboos?: readonly Id[];
  readonly readings?: readonly ReadingRule[];
  readonly values?: readonly ValueTemplate[];
}

/** 선언에서 역할을 세운다 — 빠진 목록은 빈 줄이다 (역할은 덧대는 것이므로). */
export function buildRole(spec: RoleSpec): RoleArchetype {
  return {
    kind: 'Rule',
    id: spec.id,
    domain: spec.domain,
    name: spec.name,
    when: spec.when,
    then: spec.then,
    axiomId: spec.axiomId,
    cultureId: spec.cultureId,
    grants: spec.grants ?? [],
    taboos: spec.taboos ?? [],
    readings: spec.readings ?? [],
    values: spec.values ?? [],
  };
}

/** 이 자리가 무엇이든 덧대는가 — 아무것도 덧대지 않으면 이름표다. */
export function roleAdds(role: RoleArchetype): boolean {
  return (
    role.grants.length > 0 ||
    role.taboos.length > 0 ||
    role.readings.length > 0 ||
    role.values.length > 0
  );
}

/** 능력 인용 하나가 온전한가 — 실재하고 공리를 지났는가. 걸리면 사유 한 줄. */
function abilityReason(
  id: Id,
  definitions: readonly Definition[],
  schema: StateSchema,
): { readonly rule: 'bad-grant' | 'unknown-grant' | 'unlawful-grant'; readonly message: string } | null {
  if (idKind(id) !== 'rule') {
    return { rule: 'bad-grant', message: `능력은 규칙이다 — rule 종류의 ID 여야 한다 (${JSON.stringify(id)})` };
  }
  const ability = abilityOf(id, definitions);
  if (ability === null) {
    return {
      rule: 'unknown-grant',
      message: `세계에 없는 능력을 연다 — ${id}. 문화가 여는 것도 O0 를 지난 정의여야 한다`,
    };
  }
  const reasons = validateDefinition(ability, undefined, schema);
  if (reasons.length > 0) {
    return {
      rule: 'unlawful-grant',
      message: `${ability.name} 은 공리를 어긴다 (${reasons[0]?.rule ?? ''}) — 입문 의례로도 공리는 비켜 가지 못한다`,
    };
  }
  return null;
}

/** 개체가 실제로 할 수 있는 것 — 종이 연 것 + 역할이 연 것 − 막힌 것. 순서는 유지된다. */
export function applyRole(
  speciesCapabilities: readonly Id[],
  grants: readonly Id[],
  taboos: readonly Id[],
): readonly Id[] {
  const out: Id[] = [];
  for (const id of [...speciesCapabilities, ...grants]) {
    if (taboos.includes(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * 역할 하나가 이 문화·이 종 위에 설 수 있는가.
 * `speciesCapabilities` 는 종이 여는 능력 — 덧댐·금기 판정의 바닥이다.
 * 종이 정해지지 않았으면 null 을 넘긴다: 바닥을 모르는 채 "이미 열려 있다"·"열려 있지 않다" 를
 * 판정하면 앞선 사유(종을 못 찾았다) 위에 사유가 두 겹으로 쌓인다.
 */
export function checkRole(
  culture: CultureRef,
  role: RoleArchetype,
  context: {
    readonly cultureId: Id;
    readonly speciesCapabilities: readonly Id[] | null;
    readonly cultureTaboos?: readonly Id[];
    readonly senses?: readonly SenseSpec[] | null;
    readonly baseNeeds?: readonly NeedTemplate[] | null;
    readonly hasBody?: boolean;
  },
  definitions: readonly Definition[] = [],
  out: CultureViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  const ref = roleRef(culture, role.name);

  if (role.cultureId !== context.cultureId) {
    violateCulture(
      out,
      ref,
      'foreign-role',
      '$.cultureId',
      `${role.name} 은 이 문화의 자리가 아니다 — ${role.cultureId} 를 가리킨다`,
    );
  }

  if (!roleAdds(role)) {
    violateCulture(
      out,
      ref,
      'empty-role',
      '$',
      `${role.name} 은 더하지도 막지도 원하지도 읽지도 않는다 — 아무것도 덧대지 않는 자리는 이름표일 뿐 개체를 가르지 못한다`,
    );
  }

  const granted = new Set<Id>();
  for (const [index, id] of role.grants.entries()) {
    const path = `$.grants[${String(index)}]`;
    const reason = abilityReason(id, definitions, schema);
    if (reason !== null) {
      violateCulture(out, ref, reason.rule, path, reason.message);
      continue;
    }
    if (context.speciesCapabilities?.includes(id) === true) {
      violateCulture(
        out,
        ref,
        'redundant-grant',
        path,
        `${abilityOf(id, definitions)?.name ?? id} 은 종이 이미 연다 — 아무것도 더하지 않는 입문 의례는 자리를 만들지 않는다`,
      );
      continue;
    }
    granted.add(id);
  }

  // 막을 것이 있어야 금기다. 바닥은 종이 여는 것 + 이 자리가 연 것, 빼기 문화가 이미 금한 것.
  const openable =
    context.speciesCapabilities === null
      ? null
      : new Set<Id>([...context.speciesCapabilities, ...granted]);
  if (openable !== null) {
    for (const id of context.cultureTaboos ?? []) openable.delete(id);
  }
  for (const [index, id] of role.taboos.entries()) {
    const path = `$.taboos[${String(index)}]`;
    if (granted.has(id)) {
      violateCulture(
        out,
        ref,
        'self-defeating-role',
        path,
        `${abilityOf(id, definitions)?.name ?? id} 을 스스로 열고 스스로 막는다 — 그 자리는 아무 데도 서지 못한다`,
      );
      continue;
    }
    if (openable !== null && !openable.has(id)) {
      violateCulture(
        out,
        ref,
        'phantom-taboo',
        path,
        `${abilityOf(id, definitions)?.name ?? id} 은 이 종에게도 이 자리에게도 열려 있지 않다 — 없는 것을 금하는 것은 금기가 아니다`,
      );
    }
  }

  checkReadings(ref, role.readings, context.senses ?? null, out);
  checkValueTemplates(
    ref,
    role.values,
    context.baseNeeds ?? null,
    context.hasBody ?? true,
    out,
    schema,
  );
}

/** 역할을 한 줄로 접는다 — 문화 카드용. */
export function roleSummary(role: RoleArchetype): string {
  const parts: string[] = [];
  if (role.grants.length > 0) parts.push(`+${String(role.grants.length)}능력`);
  if (role.taboos.length > 0) parts.push(`−${String(role.taboos.length)}금기`);
  if (role.readings.length > 0) parts.push(`읽기 ${String(role.readings.length)}`);
  if (role.values.length > 0) parts.push(`원함 ${String(role.values.length)}`);
  return parts.length === 0 ? `${role.name} — 덧대는 것이 없다` : `${role.name} — ${parts.join(' · ')}`;
}
