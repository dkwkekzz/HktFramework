// S2-b 가치 템플릿 — 개체가 손으로 적던 마지막 자리를 문화가 가져간다.
//
// S1-d 는 "무엇으로 무너지는가" 를 종에게 넘겼다. 남은 것이 "무엇을 원하는가"(S0 `values`)였고,
// 그것은 아직 개체마다 손으로 적혔다. 그래서 같은 종·같은 마을의 둘이 아무 근거 없이 서로 다른
// 것을 원할 수 있었다 — **무엇을 원하는지는 개체가 지어내는 것이 아니라 물려받는 것이다.**
// 여기서 그 자리를 문화·역할이 가져간다.
//
// 의존(Need)과 유지(ValueTarget)의 갈림은 S0-c 가 이미 그어 두었다: 벗어나면 무너지는가.
// 그 갈림이 **누가 정하는가**로도 이어진다.
//
//   Need   종이 정한다 (S1). 사냥꾼이면 굶으면 죽는다 — 문화로 바뀌지 않는다.
//   Value  문화·역할이 정한다 (S2). 무엇을 밀고 갈지는 어디서 자랐는지에 달렸다.
//
// 그리고 경계 규칙도 그대로 이어진다. Need 는 자기 안이어야 하지만 Value 는 밖이어도 된다 —
// 오히려 밖을 원하는 데서 목적이 자란다. 그래서 템플릿의 보유자에는 셋째 칸이 있다:
// 자기(self)·몸(body) 말고 **세계의 특정 대상**(entity). 협곡의 통행권을 원하는 문화가 여기 선다.
//
// 겹침 하나를 여기서 막는다. 종이 이미 무너지는 자리로 잡은 것을 문화가 다시 밀면, 그 자리는
// 무너지는 자리인가 미는 자리인가를 알 수 없게 된다. 그것은 문화가 아니라 종의 것이다.

import type { Id } from '../v1/id.ts';
import type { SlotRef } from '../o0/definition.ts';
import { isStateDomain } from '../o2/domain.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { checkBand, describeBand, type Band, type ValueTarget } from '../s0/stake.ts';
import type { NeedTemplate } from '../s1/needs.ts';
import { violateCulture, type CultureRef, type CultureViolation } from './violation.ts';

/** 이 자리는 누구의 것인가 — 개체가 태어날 때 채워질 빈칸. 유지는 경계 밖도 된다. */
export type ValueHolder =
  | { readonly of: 'self' } // 자기에게 적힌다 — 확신·평판
  | { readonly of: 'body' } // 몸에 적힌다 — 체력·기력
  | { readonly of: 'entity'; readonly id: Id }; // 세계의 특정 대상 — 협곡의 통행권

/** 문화·역할이 정하는 유지 하나 — S0 ValueTarget 에서 "누구의" 를 뺀 것. */
export interface ValueTemplate {
  /** O2 영역 + 경로 */
  readonly slot: SlotRef;
  /** 이 자리가 누구의 것인가 */
  readonly holder: ValueHolder;
  /** 어디로 밀고 가는가 */
  readonly band: Band;
  /** 얼마나 강하게 미는가 0 초과 1 이하 — P4 목적 선택의 가중치 */
  readonly weight: number;
  /** 왜 이 문화가 이 자리를 미는가 */
  readonly note: string;
}

/** 개체가 태어날 자리 — 유지를 찍어 낼 때 채워지는 것. */
export interface ValuePlace {
  readonly subjectId: Id;
  /** 몸이 걸리는 사물. 몸 없는 종은 null */
  readonly bodyId: Id | null;
}

/** 자리 하나를 사람이 읽는 한 줄로. */
export function valueTemplateLabel(template: ValueTemplate): string {
  return `${template.slot.domain}.${template.slot.path}`;
}

/** 보유자를 사람이 읽는 한 마디로. */
export function holderLabel(holder: ValueHolder): string {
  if (holder.of === 'self') return '자기';
  if (holder.of === 'body') return '몸';
  return `대상 ${holder.id}`;
}

/** 그 자리가 개체에게서 누구에게 적히는가. 몸 없는 종의 몸 자리는 자기로 접힌다. */
export function resolveHolder(holder: ValueHolder, where: ValuePlace): Id {
  if (holder.of === 'entity') return holder.id;
  if (holder.of === 'body' && where.bodyId !== null) return where.bodyId;
  return where.subjectId;
}

/**
 * 문화의 유지를 개체의 유지로 찍어 낸다.
 * 빈칸 하나가 여기서 채워진다 — 누구의 자리인가.
 * 같은 문화·같은 자리면 언제나 같은 유지다 (V1 태도 그대로).
 */
export function instantiateValues(
  templates: readonly ValueTemplate[],
  where: ValuePlace,
): readonly ValueTarget[] {
  return templates.map((template) => ({
    slot: template.slot,
    holderId: resolveHolder(template.holder, where),
    band: template.band,
    weight: template.weight,
    note: template.note,
  }));
}

/** 문화의 유지가 온전한가 — 자리는 실재하고, 종이 이미 무너지는 자리를 다시 밀지 않는가. */
export function checkValueTemplates(
  culture: CultureRef,
  templates: readonly ValueTemplate[],
  baseNeeds: readonly NeedTemplate[] | null,
  hasBody: boolean,
  out: CultureViolation[],
  schema: StateSchema = STATE_SCHEMA,
  base = '$.values',
): void {
  const seen = new Set<string>();
  const needSlots = new Set(
    (baseNeeds ?? []).map((need) => `${need.slot.domain}.${need.slot.path}`),
  );

  for (const [index, template] of templates.entries()) {
    const path = `${base}[${String(index)}]`;

    if (!isStateDomain(template.slot.domain)) {
      violateCulture(
        out,
        culture,
        'phantom-slot',
        `${path}.slot`,
        `9영역에 없는 영역이다 — ${JSON.stringify(template.slot.domain)}`,
      );
      continue;
    }
    const match = lookupField(schema, template.slot.domain, template.slot.path);
    if (match === null) {
      violateCulture(
        out,
        culture,
        'phantom-slot',
        `${path}.slot`,
        `세계에 ${valueTemplateLabel(template)} 자리가 없다 — 없는 것을 원할 수는 없다`,
      );
      continue;
    }

    const key = valueTemplateLabel(template);
    if (seen.has(key)) {
      violateCulture(
        out,
        culture,
        'duplicate-value',
        `${path}.slot`,
        `${match.spec.label} 자리를 두 번 원한다 — 어느 쪽으로 미는지 알 수 없다`,
      );
      continue;
    }
    seen.add(key);

    // 무너지는 자리와 미는 자리는 겹칠 수 없다 — 겹치면 그 자리의 성격을 잃는다.
    if (needSlots.has(key)) {
      violateCulture(
        out,
        culture,
        'need-shadowing-value',
        `${path}.slot`,
        `${match.spec.label} 은 이 종이 무너지는 자리다 — 무너지는 자리를 문화가 다시 밀 수는 없다. 그것은 문화가 아니라 종의 것이다`,
      );
    }

    if (template.holder.of === 'body' && !hasBody) {
      violateCulture(
        out,
        culture,
        'bodiless-body-value',
        `${path}.holder`,
        `몸 없는 종의 문화가 ${match.spec.label} 을 몸에 적으려 한다 — 적힐 몸이 없다`,
      );
    } else {
      // 개체가 태어나면 이 자리에 무엇이 올지는 이미 정해져 있다 — 주체이거나 사물이다.
      const holderKind = template.holder.of === 'self' ? 'subject' : 'entity';
      if (match.spec.holder !== 'any' && match.spec.holder !== holderKind) {
        violateCulture(
          out,
          culture,
          'bad-value-template',
          `${path}.holder`,
          `${match.spec.label} 은 ${match.spec.holder} 만 가질 수 있는 상태다 — ${holderLabel(template.holder)}에게 적을 수 없다`,
        );
      }
    }

    const bandReason = checkBand(match.spec, template.band);
    if (bandReason !== null) {
      violateCulture(
        out,
        culture,
        'bad-band',
        `${path}.band`,
        `${match.spec.label} — ${bandReason}`,
      );
      continue;
    }

    if (!(template.weight > 0) || template.weight > 1) {
      violateCulture(
        out,
        culture,
        'bad-value-template',
        `${path}.weight`,
        `미는 힘은 0 초과 1 이하여야 한다 — ${String(template.weight)}. 0 이면 밀지 않는 것이고, 밀지 않는 방향은 가치가 아니다`,
      );
    }
    if (template.note === '') {
      violateCulture(
        out,
        culture,
        'bad-value-template',
        `${path}.note`,
        `${match.spec.label} 자리를 왜 미는지 적지 않았다 — 근거 없는 가치는 문화를 설명하지 못한다`,
      );
    }
  }
}

/** 문화 전체가 원하는 것이 있는가 — 문화 자체에만 묻는다 (역할은 덧대는 것이므로 비어도 된다). */
export function checkValuesPresent(
  culture: CultureRef,
  templates: readonly ValueTemplate[],
  out: CultureViolation[],
  base = '$.values',
): void {
  if (templates.length > 0) return;
  violateCulture(
    out,
    culture,
    'valueless-culture',
    base,
    '원하는 것이 없는 문화는 개체를 가르지 못한다 — 무너지지만 않으면 되는 삶은 종이 이미 준다',
  );
}

/** 역할의 유지가 문화의 유지를 덮는다 — 같은 자리면 역할이 이긴다. */
export function mergeValues(
  base: readonly ValueTemplate[],
  overlay: readonly ValueTemplate[],
): readonly ValueTemplate[] {
  const kept = base.filter(
    (template) =>
      !overlay.some(
        (over) =>
          over.slot.domain === template.slot.domain && over.slot.path === template.slot.path,
      ),
  );
  return [...kept, ...overlay];
}

/** 유지를 한 줄로 접는다 — 문화 카드용. */
export function valueTemplateSummary(templates: readonly ValueTemplate[]): string {
  if (templates.length === 0) return '원하는 것이 없다';
  return templates
    .map(
      (template) =>
        `${template.slot.path} → ${describeBand(template.band)} (${holderLabel(template.holder)}, 힘 ${String(template.weight)})`,
    )
    .join(' · ');
}
