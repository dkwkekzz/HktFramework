// S1-e 종 원형 조립 — 넷을 하나로 합치고, 종에서 개체가 나온다.
//
// 원형은 새 타입이 아니다. **O0 종 정의에 살을 붙인 것**이다 —
// `SpeciesArchetype extends SpeciesDefinition`. 그래서 원형은 여전히 O1 Rule 이고, O0 공리 검사를
// 그대로 지나야 하며, S0 이 개체를 검사할 때 쓰는 종 정의로 그대로 쓰인다. 확장하되 빼지 않는다
// (S0 SubjectProfile 이 O1 Subject 를 확장한 것과 같은 태도).
//
// 여기서 두 가지가 새로 걸린다.
//
//   ① 능력은 인용이고 단계와 함께 열린다. 종은 능력을 정의하지 않는다 — O0 를 지난 능력을
//      가리킬 뿐이다(S0 과 같다). 다만 언제 열리는지는 종이 안다: 유체 사냥꾼은 아직 전언을
//      새기지 못한다. 그래서 종이 인용한 능력은 생애 어딘가에서 반드시 열려야 하고,
//      생애가 여는 능력은 반드시 종이 인용한 것이어야 한다.
//   ② 개체는 씨앗을 받는다. `seedFromSpecies` 가 감각·의존·능력 셋을 한 번에 찍어 내고,
//      S0 SubjectSpec 은 그것을 그대로 받는다. 개체가 손으로 적는 것은 이제 경계·유지뿐이다 —
//      **무엇을 원하는가는 개체의 것이고, 무엇으로 무너지는가는 종의 것이다.**

import type { Id } from '../v1/id.ts';
import { idKind } from '../v1/id.ts';
import {
  validateDefinition,
  type Definition,
  type SpeciesDefinition,
} from '../o0/definition.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { abilityOf } from '../s0/subject.ts';
import type { PerceptionProfile } from '../s0/perception.ts';
import type { Need } from '../s0/stake.ts';
import { checkBody, speciesRef, type BodyPlan } from './body.ts';
import { checkSenses, perceptionOf, type SenseSpec } from './senses.ts';
import {
  ages,
  capabilitiesAt,
  checkLifecycle,
  stageOf,
  type Lifecycle,
  type LifeStage,
} from './lifecycle.ts';
import { checkNeedTemplates, instantiateNeeds, type NeedTemplate } from './needs.ts';
import { violateSpecies, type SpeciesRef, type SpeciesViolation } from './violation.ts';

/** 종 원형 — O0 종 정의 + 신체 · 감각 · 생애 · 기본 의존 · 능력. */
export interface SpeciesArchetype extends SpeciesDefinition {
  /** 몸. 조직·국가·신은 null */
  readonly body: BodyPlan | null;
  readonly senses: readonly SenseSpec[];
  /** 생애. 몸 없는 종은 빈 줄(늙지 않는다) */
  readonly lifecycle: Lifecycle;
  readonly baseNeeds: readonly NeedTemplate[];
  /** 이 종이 여는 능력 — O0 AbilityDefinition 의 ID 들 (인용만 한다) */
  readonly capabilities: readonly Id[];
}

/** 원형을 세울 때 손으로 적는 것 — 정의는 O0 에서 그대로 가져온다. */
export interface SpeciesSpec {
  readonly definition: SpeciesDefinition;
  readonly body: BodyPlan | null;
  readonly senses: readonly SenseSpec[];
  readonly lifecycle: Lifecycle;
  readonly baseNeeds: readonly NeedTemplate[];
  readonly capabilities: readonly Id[];
}

/** 종이 개체에게 물려주는 것 — S0 SubjectSpec 의 감각·의존·능력이 이걸로 채워진다. */
export interface SpeciesSeed {
  readonly speciesId: Id;
  /** 어느 단계로 태어나는가. 늙지 않는 종은 null */
  readonly stage: string | null;
  readonly perception: PerceptionProfile;
  readonly needs: readonly Need[];
  readonly capabilities: readonly Id[];
}

/** 선언에서 원형을 세운다 — 정의의 필드는 그대로 두고 살만 붙인다. */
export function buildArchetype(spec: SpeciesSpec): SpeciesArchetype {
  return {
    ...spec.definition,
    body: spec.body,
    senses: spec.senses,
    lifecycle: spec.lifecycle,
    baseNeeds: spec.baseNeeds,
    capabilities: spec.capabilities,
  };
}

/** 능력 인용이 온전한가 — 실재하고, 공리를 지났고, 생애 어딘가에서 열리는가. */
export function checkCapabilities(
  species: SpeciesRef,
  archetype: SpeciesArchetype,
  definitions: readonly Definition[],
  out: SpeciesViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  const seen = new Set<Id>();

  for (const [index, id] of archetype.capabilities.entries()) {
    const path = `$.capabilities[${String(index)}]`;
    if (idKind(id) !== 'rule') {
      violateSpecies(
        out,
        species,
        'bad-capability',
        path,
        `능력은 규칙이다 — rule 종류의 ID 여야 한다 (${JSON.stringify(id)})`,
      );
      continue;
    }
    if (seen.has(id)) {
      violateSpecies(out, species, 'duplicate-capability', path, `같은 능력을 두 번 인용했다 — ${id}`);
      continue;
    }
    seen.add(id);

    const ability = abilityOf(id, definitions);
    if (ability === null) {
      violateSpecies(
        out,
        species,
        'unknown-capability',
        path,
        `세계에 없는 능력을 인용했다 — ${id}. 능력은 O0 를 지난 정의여야 한다`,
      );
      continue;
    }
    const reasons = validateDefinition(ability, undefined, schema);
    if (reasons.length > 0) {
      violateSpecies(
        out,
        species,
        'unlawful-capability',
        path,
        `${ability.name} 은 공리를 어긴다 (${reasons[0]?.rule ?? ''}) — 공리를 어긴 능력은 어느 종도 열지 못한다`,
      );
    }
  }

  if (archetype.capabilities.length === 0) {
    // 인용이 아예 없으면 단계가 여는 것마다 사유가 붙어 읽을 수 없게 된다 — 그 하나만 지목한다.
    violateSpecies(
      out,
      species,
      'incapable-species',
      '$.capabilities',
      '아무것도 할 수 없는 종에서 태어난 개체는 "무엇을 할 수 있는가" 에 답하지 못한다 — 그것은 사물이다',
    );
    return;
  }

  // 생애가 있으면 능력은 단계에서 열린다. 열리지 않는 능력은 평생 쓰이지 않고,
  // 종이 인용하지 않은 능력이 단계에서 열리면 그것은 공리를 지나지 않은 채 붙은 능력이다.
  if (!ages(archetype.lifecycle)) return;

  const opened = capabilitiesAt(archetype.lifecycle, null);
  for (const [index, id] of archetype.capabilities.entries()) {
    if (opened.includes(id)) continue;
    violateSpecies(
      out,
      species,
      'unreachable-capability',
      `$.capabilities[${String(index)}]`,
      `${abilityOf(id, definitions)?.name ?? id} 은 생애의 어느 단계에서도 열리지 않는다 — 평생 쓰이지 않는 능력은 이 종의 것이 아니다`,
    );
  }
  for (const [index, stage] of archetype.lifecycle.stages.entries()) {
    for (const [order, id] of stage.opens.entries()) {
      if (seen.has(id)) continue;
      violateSpecies(
        out,
        species,
        'unreachable-capability',
        `$.lifecycle.stages[${String(index)}].opens[${String(order)}]`,
        `${stage.stage} 가 종이 인용하지 않은 능력을 연다 — ${id}. 인용되지 않은 능력은 공리 검사를 지나지 않는다`,
      );
    }
  }
}

/**
 * 종 원형 하나가 세계에 설 수 있는가 — S1 의 모든 검사를 한 자리에서 돌린다.
 * 던지지 않는다. 거부된 종도 사유·경로와 함께 화면에 실린다.
 */
export function checkArchetype(
  archetype: SpeciesArchetype,
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): readonly SpeciesViolation[] {
  const out: SpeciesViolation[] = [];
  const species = speciesRef(archetype);

  // 정의가 무너지면 뒤의 사유가 두 겹으로 쌓여 읽을 수 없게 된다 (O0·S0 과 같은 태도).
  const axiomReasons = validateDefinition(archetype, undefined, schema);
  if (axiomReasons.length > 0) {
    for (const reason of axiomReasons) {
      violateSpecies(
        out,
        species,
        'bad-species',
        reason.path,
        `종 정의가 O0 를 지나지 못한다 (${reason.rule}) — ${reason.message}`,
      );
    }
    return out;
  }

  checkBody(species, archetype.body, archetype, out);
  checkSenses(species, archetype.senses, archetype.body, out);
  checkLifecycle(species, archetype.lifecycle, archetype.body, out, schema);
  checkNeedTemplates(species, archetype.baseNeeds, archetype, archetype.body, out, schema);
  checkCapabilities(species, archetype, definitions, out, schema);
  return out;
}

/** 종 여럿을 한 번에 세울 때의 결과 — 무엇이 섰고 무엇이 왜 막혔는가. */
export interface ArchetypeReport {
  readonly accepted: readonly SpeciesArchetype[];
  readonly rejected: readonly SpeciesArchetype[];
  readonly violations: readonly SpeciesViolation[];
  readonly complete: boolean;
}

/** 종 목록을 관문에 통과시킨다. 어긴 종은 세계에 들어가지 않고 사유로 남는다. */
export function checkArchetypes(
  archetypes: readonly SpeciesArchetype[],
  definitions: readonly Definition[] = [],
  schema: StateSchema = STATE_SCHEMA,
): ArchetypeReport {
  const accepted: SpeciesArchetype[] = [];
  const rejected: SpeciesArchetype[] = [];
  const violations: SpeciesViolation[] = [];

  for (const archetype of archetypes) {
    const reasons = checkArchetype(archetype, definitions, schema);
    if (reasons.length === 0) {
      accepted.push(archetype);
      continue;
    }
    rejected.push(archetype);
    violations.push(...reasons);
  }

  return {
    accepted,
    rejected,
    violations,
    complete: archetypes.length > 0 && rejected.length === 0,
  };
}

/** 개체가 태어날 자리 — 누구로, 어느 몸으로, 어느 단계로. */
export interface BirthPlace {
  readonly subjectId: Id;
  /** 몸이 걸리는 사물. 몸 없는 종은 null */
  readonly bodyId: Id | null;
  /** 어느 단계로 태어나는가. 적지 않으면 첫 단계 (늙지 않는 종은 무시된다) */
  readonly stage?: string;
}

/** 그 단계를 찾는다 — 적지 않았으면 첫 단계, 늙지 않는 종이면 null. */
export function birthStage(archetype: SpeciesArchetype, stage?: string): LifeStage | null {
  if (!ages(archetype.lifecycle)) return null;
  if (stage === undefined) return archetype.lifecycle.stages[0] ?? null;
  return stageOf(archetype.lifecycle, stage);
}

/**
 * 종에서 개체의 씨앗을 낸다 — 감각·의존·능력 셋이 한 번에 나온다.
 * 같은 종·같은 자리·같은 단계면 언제나 같은 씨앗이다 (V1 태도 그대로).
 */
export function seedFromSpecies(archetype: SpeciesArchetype, where: BirthPlace): SpeciesSeed {
  const stage = birthStage(archetype, where.stage);
  return {
    speciesId: archetype.id,
    stage: stage?.stage ?? null,
    perception: perceptionOf(archetype.senses, stage?.senseScale ?? 1),
    needs: instantiateNeeds(archetype.baseNeeds, where, stage),
    capabilities:
      stage === null ? archetype.capabilities : capabilitiesAt(archetype.lifecycle, stage.stage),
  };
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function archetypeVerdict(report: ArchetypeReport): string {
  if (report.complete) {
    const kinds = [...new Set(report.accepted.map((archetype) => archetype.subjectKind))];
    return `종 ${String(report.accepted.length)}개가 섰다 (${kinds.join(', ')})`;
  }
  if (report.accepted.length + report.rejected.length === 0) return '세울 종이 없다';
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `종 ${String(report.rejected.length)}개가 막혔다 — ${rules.join(', ')}`;
}
