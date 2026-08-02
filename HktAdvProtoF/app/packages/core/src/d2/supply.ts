// D2-b 채움 갈래 — 무너지는 자리를 무엇이 채우는가.
//
// S1 은 종이 무너지는 자리까지만 말했다("사냥꾼은 허기로 무너진다"). 그 자리를 무엇이 채우는가는
// 경계 밖에 있고, 그래서 D 계층이 필요했다. **채움 선언이 그 바깥을 적는 자리다.**
//
// 채움은 종의 것이지 개체의 것이 아니다. 그래서 선언에는 개체의 이름이 없다 — 자리의 주인은
// `self`(자기) · `body`(몸) · `other`(세계에 이미 있는 그것) 셋 중 하나로만 적고, 개체가 태어날 때
// 채워진다 (S1-d 의 빈칸 채우기와 같은 태도).
//
// 시간도 종의 것이다. 채움이 적는 것은 **성체(대사 1) 기준 시한**이고, 실제 시한은 단계의 대사가
// 나눈다 — 빨리 태우는 유체는 같은 그래프를 더 짧은 시한으로 받는다 (S1-c `collapseTicksAt`).
// 하나의 수가 종 전체의 시간을 흔든다는 S1 의 문장이 여기서 그래프 전체로 퍼진다.
//
// 그리고 뿌리를 채우는 간선은 **급함과 시한을 적지 못한다.** 그 둘은 종이 이미 말했다
// (`NeedTemplate.urgency`·`baseTicks`). 두 번 적을 수 있게 두면 두 답이 갈린다.

import type { Id } from '../v1/id.ts';
import type { SlotRef } from '../o0/definition.ts';
import type { Band } from '../s0/stake.ts';
import { resolveHolder, type ValueHolder, type ValuePlace } from '../s2/value.ts';
import { collapseTicksAt, type LifeStage } from '../s1/lifecycle.ts';
import {
  edgeIdOf,
  nodeIdOf,
  type DependencyEdge,
  type DependencyNode,
  type EdgeRelation,
  type FailureEffect,
  type NodeCondition,
  type NodeTarget,
} from '../d1/index.ts';
import { kindLabel, type DependencyKind } from '../d0/index.ts';
import { slotKey, type RootSpec } from './root.ts';
import { violateBlueprint, type SpeciesGraphRef, type SpeciesGraphViolation } from './violation.ts';

/**
 * 자리의 주인 — 개체가 태어날 때 채워질 빈칸.
 * S2 가 문화의 유지를 찍어 낼 때 쓴 것과 같은 것이므로 새로 만들지 않는다
 * (`self` 자기 · `body` 몸 · `other` 세계에 이미 있는 그것).
 */
export type SupplyHolder = ValueHolder;

/** 무엇이 충족인가 — 채움도 노드이므로 D1 의 두 가지 조건을 그대로 쓴다. */
export type SupplyCondition =
  | {
      readonly kind: 'slot';
      readonly slot: SlotRef;
      readonly holder: SupplyHolder;
      readonly band: Band;
    }
  | { readonly kind: 'clock'; readonly everyTicks: number; readonly withinTicks: number };

/** 끊겼을 때 세계에 남는 것 하나 — 주인만 종의 빈칸으로 적는다. */
export interface SupplyEffect {
  readonly slot: SlotRef;
  readonly holder: SupplyHolder;
  readonly change: FailureEffect['change'];
  readonly note: string;
}

/** 이 채움이 무엇을 채우는가. */
export type FillRef =
  | { readonly kind: 'root'; readonly slot: SlotRef } // 무너지는 자리를 곧바로
  | { readonly kind: 'supply'; readonly label: string }; // 다른 채움을

/** 채움 하나의 선언 — 종이 물려주는 갈래 한 줄기. */
export interface SupplySpec {
  /** 사람이 읽는 이름이자 다른 채움이 가리키는 열쇠 (`겨울 식량`) */
  readonly label: string;
  /** 무엇을 채우는가 — 하나 이상 */
  readonly fills: readonly FillRef[];
  readonly kind: DependencyKind;
  readonly relation: EdgeRelation;
  /** 종 수준에서 이름을 댈 수 있을 때만 (그 협곡·그 법). 아니면 null */
  readonly target: NodeTarget | null;
  readonly condition: SupplyCondition;
  /** 끊겼을 때의 타격 0 초과 1 이하 */
  readonly strength: number;
  /** 얼마나 갈아탈 수 있는가 0~1 */
  readonly substitutability: number;
  /** 뿌리만 채우면 null — 급함은 종이 이미 말했다 */
  readonly urgency: number | null;
  /** 뿌리만 채우면 null — 성체(대사 1) 기준 시한. 실제 시한은 단계의 대사가 나눈다 */
  readonly baseDelayTicks: number | null;
  readonly failureEffects: readonly SupplyEffect[];
  readonly note: string;
}

/** 개체가 태어나는 자리 — 누구로, 어느 몸으로. S2 의 것과 같다. */
export type GraphPlace = ValuePlace;

export { resolveHolder };

/** 채움의 조건을 노드의 조건으로 — 빈칸만 채운다. */
export function resolveCondition(
  condition: SupplyCondition,
  where: GraphPlace,
): NodeCondition {
  if (condition.kind === 'clock') return condition;
  return {
    kind: 'slot',
    slot: condition.slot,
    holderId: resolveHolder(condition.holder, where),
    band: condition.band,
  };
}

/** 채움 노드 하나를 찍어 낸다. */
export function supplyNodeFrom(spec: SupplySpec, where: GraphPlace): DependencyNode {
  return {
    id: nodeIdOf(where.subjectId, spec.kind, spec.label),
    subjectId: where.subjectId,
    kind: spec.kind,
    label: spec.label,
    target: spec.target,
    condition: resolveCondition(spec.condition, where),
    note: spec.note,
  };
}

/** 끊김의 흔적을 개체의 자리로 옮긴다. */
export function resolveEffects(
  effects: readonly SupplyEffect[],
  where: GraphPlace,
): readonly FailureEffect[] {
  return effects.map((effect) => ({
    slot: effect.slot,
    holderId: resolveHolder(effect.holder, where),
    change: effect.change,
    note: effect.note,
  }));
}

/** 이 채움이 뿌리를 곧바로 채우는가. */
export function fillsRoot(spec: SupplySpec): boolean {
  return spec.fills.some((fill) => fill.kind === 'root');
}

/** 이 채움이 다른 채움을 채우는가. */
export function fillsSupply(spec: SupplySpec): boolean {
  return spec.fills.some((fill) => fill.kind === 'supply');
}

/** 한 간선의 급함과 시한 — 뿌리를 채우면 종이 말한 것, 아니면 채움이 적은 것. */
export interface EdgeTiming {
  readonly urgency: number;
  /** 성체 기준 시한 — 대사가 나누기 전 */
  readonly baseDelayTicks: number;
}

/**
 * 채움 간선 하나를 찍어 낸다. 시한은 단계의 대사가 나눈다.
 * @param from 채워지는 쪽 (기대는 쪽)
 * @param to   채우는 쪽
 */
export function supplyEdgeFrom(
  from: DependencyNode,
  to: DependencyNode,
  spec: SupplySpec,
  timing: EdgeTiming,
  stage: LifeStage | null,
  where: GraphPlace,
): DependencyEdge {
  return {
    id: edgeIdOf(from.id, to.id, spec.relation),
    from: from.id,
    to: to.id,
    relation: spec.relation,
    strength: spec.strength,
    urgency: timing.urgency,
    substitutability: spec.substitutability,
    failureDelayTicks: collapseTicksAt(timing.baseDelayTicks, stage),
    failureEffects: resolveEffects(spec.failureEffects, where),
    note: spec.note,
  };
}

/**
 * 채움 선언이 온전한가 — 가리키는 것이 실재하는가, 시한을 두 번 적지 않았는가.
 * 노드·간선 자체의 온전함은 D1 `checkGraph` 가 유일한 판정자다 (같은 판정을 두 번 만들지 않는다).
 */
export function checkSupplySpecs(
  species: SpeciesGraphRef,
  supplies: readonly SupplySpec[],
  roots: readonly RootSpec[],
  out: SpeciesGraphViolation[],
): void {
  const labels = new Map<string, number>();
  const rootSlots = new Set(roots.map((root) => slotKey(root.slot)));

  for (const [index, spec] of supplies.entries()) {
    const path = `$.supplies[${String(index)}]`;
    const at = spec.label === '' ? `#${String(index)}` : spec.label;

    if (spec.label === '') {
      violateBlueprint(
        out,
        species,
        'bad-blueprint',
        at,
        `${path}.label`,
        '이름 없는 채움은 다른 채움이 가리킬 수 없다',
      );
    } else {
      const first = labels.get(spec.label);
      if (first !== undefined) {
        violateBlueprint(
          out,
          species,
          'duplicate-supply',
          at,
          `${path}.label`,
          `${spec.label} 이라는 채움이 둘이다 (앞의 것은 ${String(first)}번) — 가리켜도 어느 쪽인지 알 수 없다`,
        );
        continue;
      }
      labels.set(spec.label, index);
    }
    if (spec.note === '') {
      violateBlueprint(
        out,
        species,
        'bad-blueprint',
        at,
        `${path}.note`,
        '왜 이것이 그 자리를 채우는지 적지 않았다 — 근거 없는 채움은 종을 설명하지 못한다',
      );
    }

    if (spec.fills.length === 0) {
      violateBlueprint(
        out,
        species,
        'fillless-supply',
        at,
        `${path}.fills`,
        `${kindLabel(spec.kind)} ${spec.label} 은 아무것도 채우지 않는다 — 무엇 때문에 있는지 말하지 못하는 의존은 종의 것이 아니다`,
      );
    }
  }

  // 가리킴 해소는 이름이 다 모인 뒤에 본다 — 뒤에 선언된 채움도 가리킬 수 있어야 한다.
  for (const [index, spec] of supplies.entries()) {
    const path = `$.supplies[${String(index)}]`;
    const at = spec.label === '' ? `#${String(index)}` : spec.label;

    for (const [order, fill] of spec.fills.entries()) {
      const where = `${path}.fills[${String(order)}]`;
      if (fill.kind === 'root') {
        if (!rootSlots.has(slotKey(fill.slot))) {
          violateBlueprint(
            out,
            species,
            'dangling-fill',
            at,
            where,
            `${slotKey(fill.slot)} 자리의 뿌리가 없다 — 없는 무너짐을 채울 수는 없다`,
          );
        }
        continue;
      }
      if (fill.label === spec.label) {
        violateBlueprint(
          out,
          species,
          'dangling-fill',
          at,
          where,
          '자기 자신을 채운다 — 스스로 채워지는 결핍은 결핍이 아니다',
        );
        continue;
      }
      if (labels.get(fill.label) === undefined) {
        violateBlueprint(
          out,
          species,
          'dangling-fill',
          at,
          where,
          `${JSON.stringify(fill.label)} 라는 채움이 설계도에 없다`,
        );
      }
    }

    // 시한은 한 번만 적는다 — 뿌리를 채우면 종이, 그 밖이면 채움이.
    const bare = fillsSupply(spec);
    if (bare) {
      if (spec.urgency === null || spec.baseDelayTicks === null) {
        violateBlueprint(
          out,
          species,
          'bare-supply-timing',
          at,
          `${path}.${spec.urgency === null ? 'urgency' : 'baseDelayTicks'}`,
          '뿌리 밖의 채움은 급함과 시한을 스스로 적어야 한다 — 종이 말한 무너짐 시한은 뿌리에만 걸린다',
        );
      }
    } else if (spec.fills.length > 0 && (spec.urgency !== null || spec.baseDelayTicks !== null)) {
      violateBlueprint(
        out,
        species,
        'overridden-need-timing',
        at,
        `${path}.${spec.urgency === null ? 'baseDelayTicks' : 'urgency'}`,
        '뿌리를 채우면서 급함·시한을 따로 적었다 — 그 둘은 종이 이미 말했다 (S1 NeedTemplate). 두 번 적으면 두 답이 갈린다',
      );
    }
  }
}

/** 채움 하나를 한 줄로 접는다 — 설계도 표용. */
export function supplySummary(spec: SupplySpec): string {
  const what = spec.fills
    .map((fill) => (fill.kind === 'root' ? slotKey(fill.slot) : fill.label))
    .join(', ');
  return `${what} --${spec.relation}--> [${kindLabel(spec.kind)}] ${spec.label}`;
}
