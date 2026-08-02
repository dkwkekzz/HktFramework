// D2-a 뿌리 만들기 — 종이 무너진다고 말한 자리마다 그래프의 시작점을 하나씩 세운다.
//
// D1 은 그래프의 뿌리를 손으로 적게 두었다. 그래서 "허기로 무너진다" 고 말해 놓고 뿌리는
// 통행권에 걸린 그래프를 아무것도 막지 못했다 — D1 은 개체를 받지 않으므로 뿌리가 실재
// 노드인지만 볼 수 있었다. **여기서 그 자리를 갚는다.**
//
// 규칙은 하나다: **뿌리는 종이 이미 말한 것을 옮겨 적을 뿐 고쳐 적지 않는다.**
// S1-d 의 `NeedTemplate` 이 자리(slot)·범위(band)·급함(urgency)·기준 시한(baseTicks)을 이미
// 정했으므로, 설계도가 뿌리에 대해 새로 정하는 것은 둘뿐이다:
//
//   ① 어느 종으로 세우는가 (D0 11종 중 — 같은 자리라도 기대는 방식이 종을 가른다)
//   ② 그 자리의 값 자체를 대상으로 가리키는가 (State 를 받는 종만)
//
// 조건을 다시 적을 자리를 아예 두지 않았으므로 "종은 허기로 무너진다는데 뿌리는 0.9 까지
// 괜찮다고 적힌" 그래프는 만들어질 수 없다. 막는 것이 아니라 **적을 수 없게 하는 것**이다.

import { deterministicId, type Id } from '../v1/id.ts';
import type { SlotRef } from '../o0/definition.ts';
import type { Need } from '../s0/stake.ts';
import { templateLabel, type NeedTemplate } from '../s1/needs.ts';
import { nodeIdOf, type DependencyNode, type NodeTarget } from '../d1/index.ts';
import { kindLabel, type DependencyKind } from '../d0/index.ts';
import { violateBlueprint, type SpeciesGraphRef, type SpeciesGraphViolation } from './violation.ts';

/** 뿌리 하나가 무엇을 떠받치는가 — 생존인가, 대 잇기인가, 둘 다인가. */
export type RootService = 'survival' | 'lineage' | 'both';

/** 종이 무너지는 자리 하나 + 그것이 떠받치는 것. */
export interface SpeciesNeed {
  readonly template: NeedTemplate;
  readonly serves: RootService;
}

/** 뿌리 하나의 선언 — 조건은 적지 않는다. 종이 이미 말했다. */
export interface RootSpec {
  /** 어느 무너짐인가 — 종의 `baseNeeds`(또는 대 잇는 자리)의 자리 */
  readonly slot: SlotRef;
  /** 어느 종으로 세우는가 (D0 11종) */
  readonly kind: DependencyKind;
  /** 사람이 읽는 이름 (`주린 몸`) */
  readonly label: string;
  /** 그 자리의 값 자체를 대상으로 가리키는가 — State 를 대상으로 받는 종만 참 */
  readonly targetsOwnState: boolean;
  /** 왜 이 종으로 세우는가 */
  readonly note: string;
}

/** 자리 하나의 열쇠 — 뿌리와 무너짐을 맞출 때 쓴다. */
export function slotKey(slot: SlotRef): string {
  return `${slot.domain}.${slot.path}`;
}

/** 뿌리가 가리키는 대상 — 그 자리의 값 자체. State 를 받지 않는 종은 null. */
export function ownStateTarget(need: Need, template: NeedTemplate): NodeTarget {
  return {
    ontology: 'State',
    id: deterministicId('state', need.holderId, templateLabel(template)),
    name: templateLabel(template),
    entityKind: null,
    domain: template.slot.domain as NodeTarget['domain'],
  };
}

/**
 * 뿌리 노드 하나를 찍어 낸다.
 * @param need 개체의 자리로 채워진 무너짐 (S1 `instantiateNeeds` 가 holder 를 채운 것)
 */
export function rootNodeFrom(
  spec: RootSpec,
  template: NeedTemplate,
  need: Need,
  subjectId: Id,
): DependencyNode {
  return {
    id: nodeIdOf(subjectId, spec.kind, spec.label),
    subjectId,
    kind: spec.kind,
    label: spec.label,
    target: spec.targetsOwnState ? ownStateTarget(need, template) : null,
    condition: {
      kind: 'slot',
      slot: template.slot,
      holderId: need.holderId,
      band: template.band,
    },
    note: spec.note,
  };
}

/**
 * 뿌리 선언이 종의 무너짐과 하나도 어긋나지 않는가.
 * 무너짐 하나에 뿌리 하나 — 남아도 모자라도 그래프는 이 종의 것이 아니다.
 */
export function checkRootSpecs(
  species: SpeciesGraphRef,
  specs: readonly RootSpec[],
  needs: readonly SpeciesNeed[],
  out: SpeciesGraphViolation[],
): void {
  const seen = new Map<string, number>();

  for (const [index, spec] of specs.entries()) {
    const path = `$.roots[${String(index)}]`;
    const key = slotKey(spec.slot);
    const at = spec.label === '' ? key : spec.label;

    if (spec.label === '') {
      violateBlueprint(
        out,
        species,
        'bad-blueprint',
        at,
        `${path}.label`,
        '이름 없는 뿌리는 그래프에서 구별되지 않는다',
      );
    }
    if (spec.note === '') {
      violateBlueprint(
        out,
        species,
        'bad-blueprint',
        at,
        `${path}.note`,
        `왜 ${kindLabel(spec.kind)} 로 세우는지 적지 않았다 — 같은 자리라도 기대는 방식이 종을 가른다 (D0)`,
      );
    }

    const first = seen.get(key);
    if (first !== undefined) {
      violateBlueprint(
        out,
        species,
        'duplicate-root',
        at,
        `${path}.slot`,
        `${key} 자리에 뿌리가 둘이다 (앞의 것은 ${String(first)}번) — 한 무너짐은 한 곳에서 시작한다`,
      );
      continue;
    }
    seen.set(key, index);

    if (!needs.some((need) => slotKey(need.template.slot) === key)) {
      violateBlueprint(
        out,
        species,
        'phantom-root',
        at,
        `${path}.slot`,
        `종은 ${key} 로 무너진다고 말한 적이 없다 — 무너지지 않는 자리에서 시작하는 그래프는 아무 무너짐과도 이어지지 않는다`,
      );
    }
  }

  for (const [index, need] of needs.entries()) {
    const key = slotKey(need.template.slot);
    if (seen.has(key)) continue;
    violateBlueprint(
      out,
      species,
      'unrooted-need',
      key,
      `$.roots (${need.serves === 'lineage' ? '$.lineage' : `$.baseNeeds[${String(index)}]`})`,
      `종은 ${key} 로 무너진다고 말했는데 그 자리에서 시작하는 뿌리가 없다 — 무너지는데 그래프가 그것을 모른다`,
    );
  }
}

/** 뿌리 하나를 한 줄로 접는다 — 설계도 표용. */
export function rootSummary(spec: RootSpec, serves: RootService): string {
  const what = serves === 'both' ? '생존·대' : serves === 'lineage' ? '대' : '생존';
  return `[${kindLabel(spec.kind)}] ${spec.label} — ${slotKey(spec.slot)} (${what})`;
}
