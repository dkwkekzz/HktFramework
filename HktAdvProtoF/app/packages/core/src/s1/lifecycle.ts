// S1-c 생애 — 원문 S1 의 셋째 낱말, "종의 생애".
//
// 생애를 지어내지 않는다. O2 가 이미 두 자리를 열어 두었다:
//
//   biological.growthStage   ['씨' '유체' '성체' '노체']   — 지금 어느 단계인가
//   biological.metabolism    0~10 배 (1 이 종의 기준 속도)  — 얼마나 빨리 태우는가
//
// 그래서 단계 이름은 마음대로 지을 수 없고 저 넷 중에서만 고른다. 순서도 저 선택지의
// 순서를 따른다 — 노체에서 유체로 돌아가는 종은 세계에 없다. **생애는 세계에 적히는 값이다.**
//
// 대사가 생애를 세계와 잇는다. S0 은 `Need.collapseAfterTicks` 를 개체마다 손으로 적게
// 두었지만(사냥꾼은 서른 틱을 굶으면 무너진다), 그 숫자가 어디서 오는지는 아무 데도 없었다.
// 여기서 온다: **기준 시한 ÷ 대사.** 빨리 태우는 유체는 같은 종·같은 자리에서도 더 빨리
// 무너지고, 느려진 노체는 더 오래 버틴다. 하나의 수가 종 전체의 시간을 흔든다.
//
// 몸 없는 종은 단계를 갖지 않는다. growthStage 는 생물 영역의 자리이고, 조직·국가·신은
// 생물 자리를 열 수 없다 (S1-a). **나라는 늙지 않는다** — 정당성이 말라서 무너질 뿐이다.
// 그래서 그들에게는 대사도 없고(배수 1), 붕괴 시한은 기준 시한 그대로다.

import type { Id } from '../v1/id.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { numericRange } from '../o2/field.ts';
import { MAX_COLLAPSE_TICKS } from '../s0/stake.ts';
import { isBodiedKind, type BodyPlan } from './body.ts';
import { MAX_SENSE_SCALE } from './senses.ts';
import { violateSpecies, type SpeciesRef, type SpeciesViolation } from './violation.ts';

/** 성장 단계가 적히는 자리 — 단계 이름은 이 자리의 선택지에서만 나온다. */
export const GROWTH_STAGE_SLOT = { domain: 'biological', path: 'growthStage' } as const;
/** 대사가 적히는 자리 — 배수의 범위는 이 자리가 정한다. */
export const METABOLISM_SLOT = { domain: 'biological', path: 'metabolism' } as const;

/** O2 `biological.growthStage` 의 선택지 — 순서가 곧 생애의 순서다. */
export function growthStages(schema: StateSchema = STATE_SCHEMA): readonly string[] {
  const spec = lookupField(schema, GROWTH_STAGE_SLOT.domain, GROWTH_STAGE_SLOT.path)?.spec;
  return spec?.value.type === 'enum' ? spec.value.options : [];
}

/** O2 `biological.metabolism` 이 받는 배수의 범위. */
export function metabolismRange(schema: StateSchema = STATE_SCHEMA): {
  readonly min: number;
  readonly max: number;
} {
  const spec = lookupField(schema, METABOLISM_SLOT.domain, METABOLISM_SLOT.path)?.spec;
  const range = spec === undefined ? null : numericRange(spec.value);
  return range === null ? { min: 0, max: 10 } : { min: range.min, max: range.max };
}

/** 생애 단계 하나 — 얼마나 머물고, 그동안 얼마나 빨리 태우고 얼마나 멀리 보는가. */
export interface LifeStage {
  /** O2 `biological.growthStage` 의 선택지 중 하나 */
  readonly stage: string;
  /** 이 단계에 머무는 틱 (1 이상) */
  readonly ticks: number;
  /** 대사 배수 — 클수록 빨리 태우고 빨리 무너진다. 성체가 1 */
  readonly metabolism: number;
  /** 감각 배수 — 클수록 멀리 보고 예민하다. 성체가 1 */
  readonly senseScale: number;
  /** 이 단계에서 새로 열리는 능력 (앞 단계의 것은 그대로 남는다) */
  readonly opens: readonly Id[];
}

/** 종의 생애 — 단계의 줄. 몸 없는 종은 빈 줄이다 (늙지 않는다). */
export interface Lifecycle {
  readonly stages: readonly LifeStage[];
}

/** 수명의 위쪽 끝 — 붕괴 시한과 같은 축을 쓴다. 이보다 길면 죽지 않는 것과 같다. */
export const MAX_LIFESPAN_TICKS = MAX_COLLAPSE_TICKS;

/** 단계 없는 생애 — 몸 없는 종(조직·국가·신)의 것. */
export const AGELESS: Lifecycle = { stages: [] };

/** 이 종은 늙는가. */
export function ages(lifecycle: Lifecycle): boolean {
  return lifecycle.stages.length > 0;
}

/** 수명 — 단계들의 합. 늙지 않는 종은 0 이다 (수명이 없다는 뜻). */
export function lifespanTicks(lifecycle: Lifecycle): number {
  return lifecycle.stages.reduce((sum, stage) => sum + stage.ticks, 0);
}

/** 그 단계를 찾는다. 늙지 않는 종이거나 없는 단계면 null. */
export function stageOf(lifecycle: Lifecycle, stage: string): LifeStage | null {
  return lifecycle.stages.find((entry) => entry.stage === stage) ?? null;
}

/** 태어나서 몇 틱이 지났을 때 어느 단계인가. 수명을 넘겼거나 늙지 않는 종이면 null. */
export function stageAt(lifecycle: Lifecycle, ticksLived: number): LifeStage | null {
  let passed = 0;
  for (const stage of lifecycle.stages) {
    passed += stage.ticks;
    if (ticksLived < passed) return stage;
  }
  return null;
}

/** 이 단계까지 열린 능력 전부 (단계 순서, 중복 없음). 늙지 않는 종은 빈 목록. */
export function capabilitiesAt(lifecycle: Lifecycle, stage: string | null): readonly Id[] {
  const out: Id[] = [];
  for (const entry of lifecycle.stages) {
    for (const id of entry.opens) {
      if (!out.includes(id)) out.push(id);
    }
    if (entry.stage === stage) break;
  }
  return out;
}

/**
 * 기준 시한이 이 단계에서 몇 틱이 되는가 — **기준 ÷ 대사.**
 * 빨리 태우는 단계는 더 빨리 무너진다. 아무리 빨라도 즉사(1틱)보다 짧아지지는 않는다.
 * 늙지 않는 종(stage === null)은 기준 시한 그대로다.
 */
export function collapseTicksAt(baseTicks: number, stage: LifeStage | null): number {
  if (stage === null) return baseTicks;
  return Math.max(1, Math.round(baseTicks / stage.metabolism));
}

/** 생애가 이 종에게 온전한가 — 몸이 있으면 늙고, 몸이 없으면 늙지 않는다. */
export function checkLifecycle(
  species: SpeciesRef,
  lifecycle: Lifecycle,
  body: BodyPlan | null,
  out: SpeciesViolation[],
  schema: StateSchema = STATE_SCHEMA,
): void {
  const bodied = isBodiedKind(species.subjectKind) && body !== null;

  if (!bodied) {
    if (ages(lifecycle)) {
      violateSpecies(
        out,
        species,
        'aging-abstraction',
        '$.lifecycle.stages',
        `${species.subjectKind} 은 늙지 않는다 — 성장 단계는 생물 영역의 자리(${GROWTH_STAGE_SLOT.path})이고 몸 없는 종은 그 자리를 열 수 없다. 무너짐은 의존에서 온다`,
      );
    }
    return;
  }

  if (!ages(lifecycle)) {
    violateSpecies(
      out,
      species,
      'ageless-body',
      '$.lifecycle.stages',
      '몸이 있는데 생애 단계가 없다 — 늙지 않는 몸은 세계를 멈춘다. 죽지 않는 것은 그 자리를 대신할 다른 것을 낳지 않는다',
    );
    return;
  }

  const options = growthStages(schema);
  const metabolism = metabolismRange(schema);
  const seen = new Set<string>();
  let lastOrder = -1;

  for (const [index, stage] of lifecycle.stages.entries()) {
    const path = `$.lifecycle.stages[${String(index)}]`;
    const order = options.indexOf(stage.stage);
    if (order < 0) {
      violateSpecies(
        out,
        species,
        'unknown-stage',
        `${path}.stage`,
        `성장 단계는 [${options.join(' ')}] 중 하나여야 한다 (O2 ${GROWTH_STAGE_SLOT.path}) — ${JSON.stringify(stage.stage)}`,
      );
      continue;
    }
    if (seen.has(stage.stage)) {
      violateSpecies(
        out,
        species,
        'duplicate-stage',
        `${path}.stage`,
        `${stage.stage} 를 두 번 지난다 — 같은 단계로 돌아오는 종은 세계에 없다`,
      );
      continue;
    }
    if (order < lastOrder) {
      violateSpecies(
        out,
        species,
        'unordered-stage',
        `${path}.stage`,
        `${stage.stage} 가 ${options[lastOrder] ?? ''} 뒤에 온다 — 생애는 O2 선택지의 순서를 따른다 (${options.join(' → ')})`,
      );
      continue;
    }
    seen.add(stage.stage);
    lastOrder = order;

    if (!Number.isInteger(stage.ticks) || stage.ticks < 1 || stage.ticks > MAX_LIFESPAN_TICKS) {
      violateSpecies(
        out,
        species,
        'bad-stage',
        `${path}.ticks`,
        `${stage.stage} 에 머무는 틱은 1~${String(MAX_LIFESPAN_TICKS)} 의 정수여야 한다 — ${String(stage.ticks)}`,
      );
    }
    if (
      !Number.isFinite(stage.metabolism) ||
      stage.metabolism <= metabolism.min ||
      stage.metabolism > metabolism.max
    ) {
      violateSpecies(
        out,
        species,
        'bad-stage',
        `${path}.metabolism`,
        `${stage.stage} 의 대사는 ${String(metabolism.min)} 초과 ${String(metabolism.max)} 이하여야 한다 (O2 ${METABOLISM_SLOT.path}) — ${String(stage.metabolism)}. 대사 0 은 아무것도 태우지 않는다는 뜻이고, 그러면 굶주림이 성립하지 않는다`,
      );
    }
    if (
      !Number.isFinite(stage.senseScale) ||
      stage.senseScale <= 0 ||
      stage.senseScale > MAX_SENSE_SCALE
    ) {
      violateSpecies(
        out,
        species,
        'bad-stage',
        `${path}.senseScale`,
        `${stage.stage} 의 감각 배수는 0 초과 ${String(MAX_SENSE_SCALE)} 이하여야 한다 — ${String(stage.senseScale)}`,
      );
    }
  }

  const lifespan = lifespanTicks(lifecycle);
  if (lifespan > MAX_LIFESPAN_TICKS) {
    violateSpecies(
      out,
      species,
      'unending-life',
      '$.lifecycle.stages',
      `수명 ${String(lifespan)} 틱은 상한 ${String(MAX_LIFESPAN_TICKS)} 을 넘는다 — 죽지 않는 몸은 자리를 비우지 않고, 자리가 비지 않으면 다음 세대가 자라지 않는다`,
    );
  }
}

/** 생애를 한 줄로 접는다 — 종 카드용. */
export function lifecycleSummary(lifecycle: Lifecycle): string {
  if (!ages(lifecycle)) return '늙지 않는다';
  return `${lifecycle.stages
    .map((stage) => `${stage.stage} ${String(stage.ticks)}틱 (대사 ${String(stage.metabolism)})`)
    .join(' → ')} · 수명 ${String(lifespanTicks(lifecycle))}틱`;
}
