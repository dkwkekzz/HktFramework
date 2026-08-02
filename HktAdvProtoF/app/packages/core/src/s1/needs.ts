// S1-d 기본 의존 — 원문 S1 의 넷째 낱말, "종의 기본 의존성".
//
// S0-c 는 개체가 무엇에 의존하는지를 개체마다 손으로 적게 두었다. 그래서 같은 사냥꾼 종에서
// 태어난 둘이 서로 다른 것에 의존해도 아무것도 막지 못했다 — 한 명은 굶어 죽고 한 명은
// 굶지 않는 세계가 성립했다. **무엇에 의존하는지는 종이 정한다.** 개체가 정하는 것은
// 그 위에 얹히는 것(문화·역할·이력)이고, 그것은 S2·S3 의 몫이다.
//
// 템플릿에는 **누구의 자리인지가 비어 있다.** 종은 "허기" 를 알지만 "누구의 허기" 는 모른다 —
// 그것은 개체가 태어날 때 채워진다. 채울 곳은 둘뿐이다:
//
//   self  자기에게 적힌다 — 사냥꾼의 허기는 사냥꾼에게 (O2 holder=subject)
//   body  몸에 적힌다     — 장막벌레 군집의 개체군은 둥지에 (O2 holder=entity/any)
//
// 그리고 여기서 D 계층으로 넘어가는 자리가 하나 열린다: 이 템플릿이 곧 **종 기본 의존 그래프**
// (D2)의 씨앗이다. 무엇이 그 자리를 채워 주는가(음식·장소·다른 주체)는 D1~D3 이 잇는다.
// S1 은 "이 종은 이 자리가 이 범위를 벗어나면 무너진다" 까지만 말한다.

import type { Id } from '../v1/id.ts';
import type { SlotRef, SpeciesDefinition } from '../o0/definition.ts';
import { isStateDomain } from '../o2/domain.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { checkBand, MAX_COLLAPSE_TICKS, type Band, type Need } from '../s0/stake.ts';
import { collapseTicksAt, type LifeStage } from './lifecycle.ts';
import type { BodyPlan } from './body.ts';
import { violateSpecies, type SpeciesRef, type SpeciesViolation } from './violation.ts';

/** 이 자리는 누구에게 적히는가 — 개체가 태어날 때 채워질 빈칸. */
export type NeedHolder = 'self' | 'body';

/** 종이 정하는 의존 하나 — S0 Need 에서 "누구의" 와 "몇 틱 뒤" 를 뺀 것. */
export interface NeedTemplate {
  /** O2 영역 + 경로. 매개 자리(`stock.{entity}`)는 실제 ID 로 적는다 */
  readonly slot: SlotRef;
  /** 이 자리가 적히는 곳 */
  readonly holder: NeedHolder;
  /** 벗어나면 무너지는 범위 */
  readonly band: Band;
  /** 얼마나 급한가 0~1 — D4 압력의 재료 */
  readonly urgency: number;
  /** 성체(대사 1) 기준 붕괴 시한 — 단계의 대사가 이 값을 나눈다 */
  readonly baseTicks: number;
  /** 왜 이 종이 이 자리에 걸려 있는가 */
  readonly note: string;
}

/** 자리 하나를 사람이 읽는 한 줄로. */
export function templateLabel(template: NeedTemplate): string {
  return `${template.slot.domain}.${template.slot.path}`;
}

/**
 * 종의 의존을 개체의 의존으로 찍어 낸다.
 * 빈칸 둘이 여기서 채워진다 — 누구의 자리인가(holder), 몇 틱 뒤에 무너지는가(단계의 대사).
 */
export function instantiateNeeds(
  templates: readonly NeedTemplate[],
  where: { readonly subjectId: Id; readonly bodyId: Id | null },
  stage: LifeStage | null = null,
): readonly Need[] {
  return templates.map((template) => ({
    slot: template.slot,
    holderId:
      template.holder === 'body' && where.bodyId !== null ? where.bodyId : where.subjectId,
    band: template.band,
    urgency: template.urgency,
    collapseAfterTicks: collapseTicksAt(template.baseTicks, stage),
    note: template.note,
  }));
}

/** 종 정의가 그 자리를 열어 두었는가 — 매개 자리(`stock.{entity}`)도 실제 경로도 받는다. */
export function opensSlot(
  definition: SpeciesDefinition,
  slot: SlotRef,
  schema: StateSchema = STATE_SCHEMA,
): boolean {
  const match = isStateDomain(slot.domain)
    ? lookupField(schema, slot.domain, slot.path)
    : null;
  return definition.slots.some(
    (opened) =>
      opened.domain === slot.domain &&
      (opened.path === slot.path || opened.path === match?.spec.path),
  );
}

/** 기본 의존이 이 종에게 온전한가. */
export function checkNeedTemplates(
  species: SpeciesRef,
  templates: readonly NeedTemplate[],
  definition: SpeciesDefinition,
  body: BodyPlan | null,
  out: SpeciesViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  const seen = new Set<string>();

  for (const [index, template] of templates.entries()) {
    const path = `$.baseNeeds[${String(index)}]`;

    if (!isStateDomain(template.slot.domain)) {
      violateSpecies(
        out,
        species,
        'phantom-slot',
        `${path}.slot`,
        `9영역에 없는 영역이다 — ${JSON.stringify(template.slot.domain)}`,
      );
      continue;
    }
    const match = lookupField(schema, template.slot.domain, template.slot.path);
    if (match === null) {
      violateSpecies(
        out,
        species,
        'phantom-slot',
        `${path}.slot`,
        `세계에 ${templateLabel(template)} 자리가 없다 — 없는 것에 의존할 수는 없다`,
      );
      continue;
    }

    const key = templateLabel(template);
    if (seen.has(key)) {
      violateSpecies(
        out,
        species,
        'duplicate-template',
        `${path}.slot`,
        `${match.spec.label} 자리에 기본 의존이 둘이다 — 어느 범위를 벗어나야 무너지는지 알 수 없다`,
      );
      continue;
    }
    seen.add(key);

    // 종이 열지 않은 자리로 무너질 수는 없다. S0 은 개체에서 이것을 잡았지만,
    // 여기서 막으면 그 종의 어떤 개체도 그 자리로 무너지지 않는다 — 원천이다.
    if (!opensSlot(definition, template.slot, schema)) {
      violateSpecies(
        out,
        species,
        'off-species-slot',
        `${path}.slot`,
        `${species.name} 은 ${match.spec.label} 자리를 열지 않는다 — 종이 갖지 않은 자리로 무너질 수는 없다`,
      );
    }
    if (template.holder === 'body' && body === null) {
      violateSpecies(
        out,
        species,
        'bodiless-body-need',
        `${path}.holder`,
        `몸 없는 ${species.subjectKind} 이 ${match.spec.label} 을 몸에 적으려 한다 — 적힐 몸이 없다`,
      );
    } else {
      // 개체가 태어나면 이 자리에 무엇이 올지는 이미 정해져 있다 — 자기(주체)이거나 몸(사물)이다.
      // 그 종류를 O2 가 받는지 종에서 미리 본다.
      const holderKind = template.holder === 'body' ? 'entity' : 'subject';
      if (match.spec.holder !== 'any' && match.spec.holder !== holderKind) {
        violateSpecies(
          out,
          species,
          'bad-template',
          `${path}.holder`,
          `${match.spec.label} 은 ${match.spec.holder} 만 가질 수 있는 상태다 — ${template.holder === 'body' ? '몸(entity)' : '주체 자신(subject)'}에게 적을 수 없다`,
        );
      }
    }

    const bandReason = checkBand(match.spec, template.band);
    if (bandReason !== null) {
      violateSpecies(
        out,
        species,
        'bad-band',
        `${path}.band`,
        `${match.spec.label} — ${bandReason}`,
      );
      continue;
    }

    if (!(template.urgency >= 0) || template.urgency > 1) {
      violateSpecies(
        out,
        species,
        'bad-template',
        `${path}.urgency`,
        `급함은 0~1 이어야 한다 — ${String(template.urgency)}`,
      );
    }
    if (
      !Number.isInteger(template.baseTicks) ||
      template.baseTicks < 1 ||
      template.baseTicks > MAX_COLLAPSE_TICKS
    ) {
      violateSpecies(
        out,
        species,
        'bad-template',
        `${path}.baseTicks`,
        `기준 붕괴 시한은 1~${String(MAX_COLLAPSE_TICKS)} 의 정수여야 한다 — ${String(template.baseTicks)}. 무너지지 않는 것은 의존이 아니다`,
      );
    }
    if (template.note === '') {
      violateSpecies(
        out,
        species,
        'bad-template',
        `${path}.note`,
        `${match.spec.label} 자리에 왜 걸려 있는지 적지 않았다 — 근거 없는 의존은 종을 설명하지 못한다`,
      );
    }
  }

  if (templates.length === 0) {
    violateSpecies(
      out,
      species,
      'needless-species',
      '$.baseNeeds',
      '무너질 조건이 없는 종에서 태어난 개체는 "무엇에 의존하는가" 에 답하지 못한다 — 잃을 것이 없으면 목적도 생기지 않는다',
    );
  }
}

/** 기본 의존을 한 줄로 접는다 — 종 카드용. */
export function needTemplateSummary(templates: readonly NeedTemplate[]): string {
  if (templates.length === 0) return '무너질 조건이 없다';
  return templates
    .map(
      (template) =>
        `${template.slot.path} (${template.holder === 'body' ? '몸' : '자기'}) ${String(template.baseTicks)}틱`,
    )
    .join(' · ');
}
