// S3-c 개체 조립 — 원문 S3 조립식 전체를 한 값으로 세운다.
//
//   종 원형 + 문화 원형 + 역할 + 과거 사건 + 관계 + 개인 성격 = 개별 주체
//
// 다섯 층이 쌓이면 문제가 하나 생긴다: **이 개체의 이 값은 도대체 어디서 왔는가.**
// 허기의 급함 0.9 가 종이 정한 것인지 겁 많은 성격이 흔든 것인지 알 수 없으면, 개체 카드는
// 숫자 더미가 되고 세계는 손으로 지은 값과 물려받은 값을 구별하지 못한다. 그래서 조립하면서
// 유래를 함께 적는다 — `Provenance`.
//
//   **개체는 지어내지 않는다.** 모든 값이 종·문화·자리·이력·성격 중 하나를 유래로 대야 하고,
//   개체 자신(self)이 대는 것은 둘뿐이다: 이름표와 경계.
//
// 유래를 못 대는 값이 하나라도 있으면 개체는 서지 못한다(`orphan-value`). 이것이 S3 가 여는
// 마지막 관문이고, 그 관문이 A 계층(AI 생성)의 검사대가 된다 — 생성기가 만든 개체도 같은
// 질문에 답해야 한다.

import { subjectIdOf, type SubjectProfile, type SubjectSpec } from '../s0/subject.ts';
import { buildSubject, checkSubjectProfile } from '../s0/subject.ts';
import type { Boundary } from '../s0/boundary.ts';
import type { Need, ValueTarget } from '../s0/stake.ts';
import type { Id } from '../v1/id.ts';
import type { Tick } from '../v1/tick.ts';
import type { Definition } from '../o0/definition.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { seedFromSpecies, type SpeciesArchetype } from '../s1/archetype.ts';
import type { ReadingRule } from '../s2/reading.ts';
import { readingLabel } from '../s2/reading.ts';
import { seedWithCulture, type CultureArchetype } from '../s2/culture.ts';
import type { RoleArchetype } from '../s2/role.ts';
import { checkHistory, historyResidue, type PastEvent, type Residue } from './history.ts';
import {
  checkTraits,
  scaleFor,
  tuned,
  tuneTable,
  type TunableKeys,
  type Trait,
} from './trait.ts';
import { violateInstance, type InstanceRef, type InstanceViolation } from './violation.ts';

/** 값이 올 수 있는 곳 — 여섯. 늘리려면 그것도 작업 카드로. */
export const VALUE_ORIGINS = [
  'species', // 종 (S1) — 감각·의존·능력
  'culture', // 문화 (S2) — 읽기·원함
  'role', // 자리 (S2) — 덧댄 읽기·원함, 연 능력
  'history', // 이력 (S3-a) — 지금 남은 값
  'trait', // 성격 (S3-b) — 흔든 값
  'self', // 개체 자신 — 이름표와 경계뿐이다
] as const;
export type ValueOrigin = (typeof VALUE_ORIGINS)[number];

/** 유래를 사람이 읽는 한 마디로. */
export const ORIGIN_LABELS: Readonly<Record<ValueOrigin, string>> = {
  species: '종',
  culture: '문화',
  role: '자리',
  history: '이력',
  trait: '성격',
  self: '개체',
};

/** 값 하나의 유래. */
export interface Provenance {
  /** 무엇의 유래인가 — `need:hunger`, `value:trust.…`, `reading:light:…`, `capability:rule:…` */
  readonly key: string;
  readonly origin: ValueOrigin;
  /** 그 유래의 이름 — 종·문화·자리·사건·성격의 이름 */
  readonly from: string;
  /** 성격이 흔들었으면 그 배수. 흔들지 않았으면 undefined */
  readonly scale?: number;
}

/** 개별 주체 — S0 SubjectProfile 을 확장한다 (필드를 빼지 않고 더한다). */
export interface SubjectInstance extends SubjectProfile {
  readonly cultureId: Id;
  /** 어느 자리에 섰는가. 문화만 지니면 null */
  readonly roleId: Id | null;
  /** 이 개체가 세계에 서는 시각 */
  readonly bornAtTick: Tick;
  readonly readings: readonly ReadingRule[];
  readonly history: readonly PastEvent[];
  readonly traits: readonly Trait[];
  /** 이력이 지금 남긴 값 — 세계에 적힐 첫 상태 */
  readonly residue: readonly Residue[];
  /** 값마다 어디서 왔는가 */
  readonly provenance: readonly Provenance[];
}

/** 개체를 세울 때 손으로 적는 것 — 이름표·경계·이력·성격뿐이다. */
export interface InstanceSpec {
  readonly species: SpeciesArchetype;
  readonly culture: CultureArchetype;
  readonly role: RoleArchetype | null;
  /** 같은 종 안에서 이 개체를 가르는 이름표 — ID 의 재료가 된다 */
  readonly label: string;
  readonly name: string;
  readonly partOfId: Id | null;
  /** 몸이 걸리는 사물. 몸 없는 종은 null */
  readonly bodyId: Id | null;
  /** 어느 단계로 서는가. 늙지 않는 종은 무시된다 */
  readonly stage?: string | undefined;
  readonly bornAtTick: Tick;
  readonly boundaries: readonly Boundary[];
  readonly history?: readonly PastEvent[];
  readonly traits?: readonly Trait[];
}

/** 유래 열쇠 — 값의 종류마다 한 모양. */
export function needKey(need: Need): string {
  return `need:${need.slot.path}`;
}
export function valueKey(value: ValueTarget): string {
  return `value:${value.slot.path}`;
}
export function readingKey(reading: ReadingRule): string {
  return `reading:${readingLabel(reading)}`;
}
export function capabilityKey(id: Id): string {
  return `capability:${id}`;
}

/** 성격이 흔들 수 있는 자리 목록 — 이 개체가 실제로 가진 것. */
export function tunableKeys(instance: {
  readonly needs: readonly Need[];
  readonly values: readonly ValueTarget[];
  readonly readings: readonly ReadingRule[];
}): TunableKeys {
  return {
    needs: instance.needs.map((need) => need.slot.path),
    values: instance.values.map((value) => value.slot.path),
    readings: instance.readings.map((reading) => readingLabel(reading)),
  };
}

/**
 * 다섯 층을 한 개체로 합친다.
 * 같은 선언이면 언제나 같은 개체다 — 손으로 지은 값이 하나도 없기 때문이다 (V1 태도 그대로).
 */
export function buildInstance(spec: InstanceSpec): SubjectInstance {
  const subjectId = subjectIdOf(spec.species.id, spec.label);
  const history = spec.history ?? [];
  const traits = spec.traits ?? [];

  const speciesSeed = seedFromSpecies(spec.species, {
    subjectId,
    bodyId: spec.bodyId,
    stage: spec.stage,
  });
  const seed = seedWithCulture(speciesSeed, spec.culture, spec.role, {
    subjectId,
    bodyId: spec.bodyId,
  });

  const table = tuneTable(traits);
  const traitFor = (target: Parameters<typeof scaleFor>[1], key: string): Trait | null =>
    traits.find((trait) =>
      trait.tunes.some((tune) => tune.target === target && tune.key === key),
    ) ?? null;

  const provenance: Provenance[] = [];
  const add = (key: string, origin: ValueOrigin, from: string, scale?: number): void => {
    provenance.push(scale === undefined ? { key, origin, from } : { key, origin, from, scale });
  };

  // 의존 — 종이 준다. 성격이 급함을 흔든다.
  const needs: Need[] = seed.needs.map((need) => {
    const scale = scaleFor(table, 'need-urgency', need.slot.path);
    const tweak = scale === 1 ? null : traitFor('need-urgency', need.slot.path);
    add(
      needKey(need),
      tweak === null ? 'species' : 'trait',
      tweak?.name ?? spec.species.name,
      tweak === null ? undefined : scale,
    );
    return scale === 1 ? need : { ...need, urgency: tuned(need.urgency, scale) };
  });

  // 원함 — 문화나 자리가 준다. 성격이 미는 힘을 흔든다.
  const roleValuePaths = new Set(
    (spec.role?.values ?? []).map((template) => template.slot.path),
  );
  const values: ValueTarget[] = seed.values.map((value) => {
    const scale = scaleFor(table, 'value-weight', value.slot.path);
    const tweak = scale === 1 ? null : traitFor('value-weight', value.slot.path);
    const source = roleValuePaths.has(value.slot.path) ? 'role' : 'culture';
    add(
      valueKey(value),
      tweak === null ? source : 'trait',
      tweak?.name ??
        (source === 'role' ? (spec.role?.name ?? spec.culture.name) : spec.culture.name),
      tweak === null ? undefined : scale,
    );
    return scale === 1 ? value : { ...value, weight: tuned(value.weight, scale) };
  });

  // 읽기 — 문화나 자리가 준다. 성격이 확신을 흔든다.
  const roleReadings = new Set((spec.role?.readings ?? []).map((entry) => readingLabel(entry)));
  const readings: ReadingRule[] = seed.readings.map((reading) => {
    const label = readingLabel(reading);
    const scale = scaleFor(table, 'reading-confidence', label);
    const tweak = scale === 1 ? null : traitFor('reading-confidence', label);
    const source = roleReadings.has(label) ? 'role' : 'culture';
    add(
      readingKey(reading),
      tweak === null ? source : 'trait',
      tweak?.name ??
        (source === 'role' ? (spec.role?.name ?? spec.culture.name) : spec.culture.name),
      tweak === null ? undefined : scale,
    );
    return scale === 1 ? reading : { ...reading, confidence: tuned(reading.confidence, scale) };
  });

  // 능력 — 종이 열었거나 자리가 열었다.
  const granted = new Set(spec.role?.grants ?? []);
  for (const id of seed.capabilities) {
    add(
      capabilityKey(id),
      granted.has(id) ? 'role' : 'species',
      granted.has(id) ? (spec.role?.name ?? spec.culture.name) : spec.species.name,
    );
  }

  // 이력이 남긴 값 — 어느 사건이 남겼는지까지 적는다.
  const residue = historyResidue(history);
  for (const entry of residue) {
    const event = [...history]
      .reverse()
      .find((past) =>
        past.residue.some(
          (candidate) =>
            candidate.slot.domain === entry.slot.domain &&
            candidate.slot.path === entry.slot.path &&
            candidate.holderId === entry.holderId,
        ),
      );
    add(`residue:${entry.slot.domain}.${entry.slot.path}`, 'history', event?.name ?? '(모를 일)');
  }

  // 개체가 스스로 적는 것 — 이름표와 경계뿐이다.
  for (const boundary of spec.boundaries) {
    add(`boundary:${boundary.kind}`, 'self', spec.name);
  }

  const subjectSpec: SubjectSpec = {
    speciesId: spec.species.id,
    label: spec.label,
    name: spec.name,
    subjectKind: spec.species.subjectKind,
    partOfId: spec.partOfId,
    boundaries: spec.boundaries,
    perception: seed.perception,
    needs,
    values,
    capabilities: seed.capabilities,
  };

  return {
    ...buildSubject(subjectSpec),
    cultureId: spec.culture.id,
    roleId: spec.role?.id ?? null,
    bornAtTick: spec.bornAtTick,
    readings,
    history,
    traits,
    residue,
    provenance,
  };
}

/** 그 값의 유래를 찾는다. 못 대면 null. */
export function originOf(
  instance: SubjectInstance,
  key: string,
): Provenance | null {
  return instance.provenance.find((entry) => entry.key === key) ?? null;
}

/** 유래별로 몇 개가 왔는가 — 개체 카드의 요약. */
export function originCounts(
  instance: SubjectInstance,
): Readonly<Record<ValueOrigin, number>> {
  const counts = Object.fromEntries(VALUE_ORIGINS.map((origin) => [origin, 0])) as Record<
    ValueOrigin,
    number
  >;
  for (const entry of instance.provenance) counts[entry.origin] += 1;
  return counts;
}

/**
 * 개체 하나가 세계에 설 수 있는가 — S3 의 모든 검사를 한 자리에서 돌린다.
 * 던지지 않는다. 거부된 개체도 사유·경로와 함께 화면에 실린다.
 */
export function checkInstance(
  instance: SubjectInstance,
  culture: CultureArchetype | null = null,
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): readonly InstanceViolation[] {
  const out: InstanceViolation[] = [];
  const subject: InstanceRef = { id: instance.id, name: instance.name };

  if (instance.name === '') {
    violateInstance(
      out,
      subject,
      'unnamed-instance',
      '$.name',
      '이름표 없는 개체는 같은 종의 다른 개체와 구별되지 않는다 — ID 가 서지 않는다',
    );
  }

  // S0 관문을 그대로 지나야 한다 — 개체는 여전히 주체다 (확장했지 빼지 않았다).
  for (const violation of checkSubjectProfile(instance, definitions, schema)) {
    violateInstance(
      out,
      subject,
      'bad-instance',
      violation.path,
      `주체로 서지 못한다 (${violation.rule}) — ${violation.message}`,
    );
  }

  if (culture !== null) {
    if (culture.id !== instance.cultureId) {
      violateInstance(
        out,
        subject,
        'off-culture-role',
        '$.cultureId',
        `이 개체가 지닌 문화가 아니다 — ${instance.cultureId}`,
      );
    } else {
      if (!culture.speciesIds.includes(instance.speciesId)) {
        violateInstance(
          out,
          subject,
          'off-species-culture',
          '$.cultureId',
          `${culture.name} 은 이 종이 지닐 수 있는 문화가 아니다 — 문화는 그것을 지닐 몸이 있어야 선다`,
        );
      }
      if (
        instance.roleId !== null &&
        !culture.roles.some((role) => role.id === instance.roleId)
      ) {
        violateInstance(
          out,
          subject,
          'off-culture-role',
          '$.roleId',
          `${culture.name} 에 없는 자리에 섰다 — ${instance.roleId}`,
        );
      }
    }
  }

  checkHistory(subject, instance.history, instance.bornAtTick, out, schema);
  checkTraits(subject, instance.traits, tunableKeys(instance), out);

  // 유래를 못 대는 값이 하나라도 있으면 개체가 서지 못한다.
  const claimed = new Set(instance.provenance.map((entry) => entry.key));
  const required: readonly { readonly key: string; readonly what: string }[] = [
    ...instance.needs.map((need) => ({ key: needKey(need), what: `의존 ${need.slot.path}` })),
    ...instance.values.map((value) => ({ key: valueKey(value), what: `원함 ${value.slot.path}` })),
    ...instance.readings.map((reading) => ({
      key: readingKey(reading),
      what: `읽기 ${readingLabel(reading)}`,
    })),
    ...instance.capabilities.map((id) => ({ key: capabilityKey(id), what: `능력 ${id}` })),
  ];
  for (const entry of required) {
    if (claimed.has(entry.key)) continue;
    violateInstance(
      out,
      subject,
      'orphan-value',
      `$.provenance`,
      `${entry.what} 의 유래를 댈 수 없다 — 개체는 값을 지어내지 않는다 (종·문화·자리·이력·성격 중 하나여야 한다)`,
    );
  }

  return out;
}

/** 개체 여럿을 한 번에 세울 때의 결과. */
export interface InstanceReport {
  readonly accepted: readonly SubjectInstance[];
  readonly rejected: readonly SubjectInstance[];
  readonly violations: readonly InstanceViolation[];
  readonly complete: boolean;
}

/** 개체 목록을 관문에 통과시킨다. 어긴 개체는 세계에 들어가지 않고 사유로 남는다. */
export function checkInstances(
  instances: readonly SubjectInstance[],
  cultures: readonly CultureArchetype[] = [],
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): InstanceReport {
  const accepted: SubjectInstance[] = [];
  const rejected: SubjectInstance[] = [];
  const violations: InstanceViolation[] = [];

  for (const instance of instances) {
    const culture = cultures.find((entry) => entry.id === instance.cultureId) ?? null;
    const reasons = checkInstance(instance, culture, definitions, schema);
    if (reasons.length === 0) {
      accepted.push(instance);
      continue;
    }
    rejected.push(instance);
    violations.push(...reasons);
  }

  return {
    accepted,
    rejected,
    violations,
    complete: instances.length > 0 && rejected.length === 0,
  };
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function instanceVerdict(report: InstanceReport): string {
  if (report.complete) {
    const cultures = new Set(report.accepted.map((instance) => instance.cultureId));
    return `개체 ${String(report.accepted.length)}명이 섰다 (문화 ${String(cultures.size)}개)`;
  }
  if (report.accepted.length + report.rejected.length === 0) return '세울 개체가 없다';
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `개체 ${String(report.rejected.length)}명이 막혔다 — ${rules.join(', ')}`;
}
