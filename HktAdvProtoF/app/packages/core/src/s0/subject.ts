// S0-d 주체 골격 — 원문 S0 의 인터페이스를 한 값으로 세운다.
//
//   interface Subject { id, boundaries, needs, values, capabilities, perceptionProfile,
//                       memoryStoreId, beliefGraphId, dependencyGraphId, possibilityGraphId }
//
// 앞의 셋(S0-a·b·c)이 조각을 만들었고 여기서 합친다. 합치면서 두 가지가 새로 걸린다.
//
//   ① 능력은 인용이다. 주체는 능력을 스스로 정의하지 않는다 — O0 가 공리로 검사해 통과시킨
//      능력 정의(AbilityDefinition)를 가리킬 뿐이다. 공리를 어긴 능력은 아무에게도 붙지 않는다.
//      "누구는 예외" 가 성립하는 순간 세계의 규칙은 장식이 된다.
//   ② 개체는 종에서 태어난다. 종 정의(SpeciesDefinition)가 열어 둔 자리 밖에서 무너질 수는
//      없다 — 아가미 없는 종의 개체가 산소 부족으로 죽을 수 없듯이. 유지(values)는 다르다:
//      종이 갖지 않은 자리를 원하는 것은 얼마든지 가능하고, 거기서 목적이 자란다.
//
// 개체의 ID 도 종에서 나온다 (deterministicId('subject', speciesId, label)) — 같은 종·같은
// 이름표면 언제나 같은 개체다. S3(개별 주체 생성)이 이 자리를 그대로 쓴다.

import { deterministicId, type Id } from '../v1/id.ts';
import { idKind } from '../v1/id.ts';
import type { Subject } from '../o1/being.ts';
import {
  validateDefinition,
  type AbilityDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../o0/definition.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { isStateDomain } from '../o2/domain.ts';
import { violateSubject, type SubjectRef, type SubjectViolation } from './violation.ts';
import {
  checkBoundaries,
  checkGraphIds,
  checkSubjectRef,
  subjectGraphIds,
  subjectRef,
  type Boundary,
  type SubjectGraphIds,
} from './boundary.ts';
import { checkPerception, type PerceptionProfile } from './perception.ts';
import { checkNeeds, checkValues, stakeLabel, type Need, type ValueTarget } from './stake.ts';

/** 원문 S0 인터페이스의 구현 — O1 Subject 를 확장한다 (필드를 빼지 않고 더한다). */
export interface SubjectProfile extends Subject, SubjectGraphIds {
  /** 어느 종에서 태어났는가 — O0 SpeciesDefinition 의 ID (rule 종류) */
  readonly speciesId: Id;
  readonly boundaries: readonly Boundary[];
  readonly perception: PerceptionProfile;
  readonly needs: readonly Need[];
  readonly values: readonly ValueTarget[];
  /** 무엇을 할 수 있는가 — O0 AbilityDefinition 의 ID 들 (인용만 한다) */
  readonly capabilities: readonly Id[];
}

/** 주체를 세울 때 손으로 적는 것 — ID 와 그래프 자리는 유래에서 나오므로 적지 않는다. */
export interface SubjectSpec {
  readonly speciesId: Id;
  /** 같은 종 안에서 이 개체를 가르는 이름표 — ID 의 재료가 된다 */
  readonly label: string;
  readonly name: string;
  readonly subjectKind: Subject['subjectKind'];
  /** 상위 주체 (구성원→조직). 독립 주체면 null */
  readonly partOfId: Id | null;
  readonly boundaries: readonly Boundary[];
  readonly perception: PerceptionProfile;
  readonly needs: readonly Need[];
  readonly values: readonly ValueTarget[];
  readonly capabilities: readonly Id[];
}

/** 개체의 ID — 같은 종·같은 이름표면 언제나 같은 개체다. */
export function subjectIdOf(speciesId: Id, label: string): Id {
  return deterministicId('subject', speciesId, label);
}

/** 선언에서 주체를 세운다. ID·그래프 자리는 유래에서 나온다 — 손으로 지을 자리가 없다. */
export function buildSubject(spec: SubjectSpec): SubjectProfile {
  const id = subjectIdOf(spec.speciesId, spec.label);
  return {
    kind: 'Subject',
    id,
    subjectKind: spec.subjectKind,
    name: spec.name,
    partOfId: spec.partOfId,
    speciesId: spec.speciesId,
    boundaries: spec.boundaries,
    perception: spec.perception,
    needs: spec.needs,
    values: spec.values,
    capabilities: spec.capabilities,
    ...subjectGraphIds(id),
  };
}

/** 정의 집합에서 종 정의를 찾는다. */
export function speciesOf(
  speciesId: Id,
  definitions: readonly Definition[],
): SpeciesDefinition | null {
  const found = definitions.find(
    (definition) => definition.id === speciesId && definition.definitionKind === 'species',
  );
  return found === undefined ? null : (found as SpeciesDefinition);
}

/** 정의 집합에서 능력 정의를 찾는다. */
export function abilityOf(
  abilityId: Id,
  definitions: readonly Definition[],
): AbilityDefinition | null {
  const found = definitions.find(
    (definition) => definition.id === abilityId && definition.definitionKind === 'ability',
  );
  return found === undefined ? null : (found as AbilityDefinition);
}

/** 능력 인용이 온전한가 — 인용한 능력이 실재하고 공리를 지났는가. */
export function checkCapabilities(
  subject: SubjectRef,
  capabilities: readonly Id[],
  definitions: readonly Definition[],
  out: SubjectViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  const seen = new Set<Id>();
  for (const [index, id] of capabilities.entries()) {
    const path = `$.capabilities[${String(index)}]`;
    if (idKind(id) !== 'rule') {
      violateSubject(
        out,
        subject,
        'bad-capability',
        path,
        `능력은 규칙이다 — rule 종류의 ID 여야 한다 (${JSON.stringify(id)})`,
      );
      continue;
    }
    if (seen.has(id)) {
      violateSubject(out, subject, 'duplicate-capability', path, `같은 능력을 두 번 인용했다 — ${id}`);
      continue;
    }
    seen.add(id);

    const ability = abilityOf(id, definitions);
    if (ability === null) {
      violateSubject(
        out,
        subject,
        'unknown-capability',
        path,
        `세계에 없는 능력을 인용했다 — ${id}. 능력은 O0 를 지난 정의여야 한다`,
      );
      continue;
    }
    const reasons = validateDefinition(ability, undefined, schema);
    if (reasons.length > 0) {
      violateSubject(
        out,
        subject,
        'unlawful-capability',
        path,
        `${ability.name} 은 공리를 어긴다 (${reasons[0]?.rule ?? ''}) — 공리를 어긴 능력은 아무에게도 붙지 않는다`,
      );
    }
  }

  if (capabilities.length === 0) {
    violateSubject(
      out,
      subject,
      'incapable-subject',
      '$.capabilities',
      '아무것도 할 수 없는 주체는 "무엇을 할 수 있는가" 에 답하지 못한다 — 그것은 사물이다',
    );
  }
}

/** 개체가 자기 종과 어긋나지 않는가. */
export function checkSpecies(
  subject: SubjectRef,
  speciesId: Id,
  needs: readonly Need[],
  definitions: readonly Definition[],
  out: SubjectViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  const species = speciesOf(speciesId, definitions);
  if (species === null) {
    violateSubject(
      out,
      subject,
      'unknown-species',
      '$.speciesId',
      `세계에 없는 종에서 태어났다 — ${JSON.stringify(speciesId)}. 개체는 O0 를 지난 종 정의에서 나온다`,
    );
    return;
  }
  if (species.subjectKind !== subject.subjectKind) {
    violateSubject(
      out,
      subject,
      'species-mismatch',
      '$.subjectKind',
      `${species.name} 은 ${species.subjectKind} 의 종이다 — 이 개체는 ${subject.subjectKind} 라고 적혀 있다`,
    );
  }

  // 종이 열어 두지 않은 자리로 무너질 수는 없다. 유지(values)는 자유다 — 종이 갖지 않은 것을
  // 원하는 데서 목적이 자란다.
  for (const [index, need] of needs.entries()) {
    if (!isStateDomain(need.slot.domain)) continue;
    const match = lookupField(schema, need.slot.domain, need.slot.path);
    if (match === null) continue; // 없는 자리는 checkNeeds 가 이미 잡았다
    const opened = species.slots.some(
      (slot) =>
        slot.domain === need.slot.domain &&
        (slot.path === match.spec.path || slot.path === need.slot.path),
    );
    if (opened) continue;
    violateSubject(
      out,
      subject,
      'off-species-slot',
      `$.needs[${String(index)}].slot`,
      `${species.name} 은 ${stakeLabel(need)} 자리를 열지 않는다 — 종이 갖지 않은 자리로 무너질 수는 없다`,
    );
  }
}

/**
 * 주체 하나가 세계에 설 수 있는가 — S0 의 모든 검사를 한 자리에서 돌린다.
 * 던지지 않는다. 거부된 주체도 사유·경로와 함께 화면에 실린다.
 */
export function checkSubjectProfile(
  profile: SubjectProfile,
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): readonly SubjectViolation[] {
  const out: SubjectViolation[] = [];
  const subject = subjectRef(profile);

  // 신원이 무너지면 뒤의 사유가 두 겹으로 쌓여 읽을 수 없게 된다 (O0 정의 검사와 같은 태도).
  if (!checkSubjectRef(subject, out)) return out;

  checkBoundaries(subject, profile.boundaries, out);
  checkGraphIds(subject, profile, out);
  checkPerception(subject, profile.perception, profile.boundaries, out);
  checkNeeds(subject, profile.needs, profile.boundaries, out, schema);
  checkValues(subject, profile.values, out, schema);
  checkCapabilities(subject, profile.capabilities, definitions, out, schema);
  checkSpecies(subject, profile.speciesId, profile.needs, definitions, out, schema);
  return out;
}

/** 주체 여럿을 한 번에 세울 때의 결과 — 무엇이 섰고 무엇이 왜 막혔는가. */
export interface SubjectReport {
  readonly accepted: readonly SubjectProfile[];
  readonly rejected: readonly SubjectProfile[];
  readonly violations: readonly SubjectViolation[];
  readonly complete: boolean;
}

/** 주체 목록을 관문에 통과시킨다. 어긴 주체는 세계에 들어가지 않고 사유로 남는다. */
export function checkSubjects(
  profiles: readonly SubjectProfile[],
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): SubjectReport {
  const accepted: SubjectProfile[] = [];
  const rejected: SubjectProfile[] = [];
  const violations: SubjectViolation[] = [];

  for (const profile of profiles) {
    const reasons = checkSubjectProfile(profile, definitions, schema);
    if (reasons.length === 0) {
      accepted.push(profile);
      continue;
    }
    rejected.push(profile);
    violations.push(...reasons);
  }

  return {
    accepted,
    rejected,
    violations,
    complete: profiles.length > 0 && rejected.length === 0,
  };
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function subjectVerdict(report: SubjectReport): string {
  if (report.complete) {
    const kinds = [...new Set(report.accepted.map((profile) => profile.subjectKind))];
    return `주체 ${String(report.accepted.length)}명이 섰다 (${kinds.join(', ')})`;
  }
  if (report.accepted.length + report.rejected.length === 0) return '세울 주체가 없다';
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `주체 ${String(report.rejected.length)}명이 막혔다 — ${rules.join(', ')}`;
}
