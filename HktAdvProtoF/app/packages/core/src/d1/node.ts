// D1-a 의존 노드 — 기대는 대상 하나를 그래프의 한 점으로 세운다.
//
// 원문의 노드는 세 자리다: `id`, `kind`, `desiredCondition: PredicateSpec`.
// 앞의 둘은 D0 가 이미 확정했고(11종), 남은 것은 **조건을 무엇으로 적는가** 다.
// 원문은 `PredicateSpec` 이라는 이름만 주고 내용을 주지 않는데, 마음대로 술어 언어를 만들면
// 세계에 없는 것을 조건으로 걸 수 있게 된다 — "장막이 아름다울 것" 같은 것.
//
// 그래서 조건은 **이미 있는 두 가지**로만 적는다.
//
//   ① 자리 조건  O2 의 실재하는 자리 + S0-c 의 `Band`(범위 또는 딱 그 값).
//      S0-c 가 주체의 Need 를 적을 때 쓴 것과 같은 모양이다 — 같은 것을 두 번 만들지 않는다.
//   ② 틱 조건    V1 틱의 주기와 기한. **시간 종만** 쓴다.
//
// 그리고 갈림은 D0 가 이미 정해 뒀다. 각 종은 `readDomains` 로 "충족을 어디서 읽는가" 를
// 밝혔으므로, **노드의 조건 자리는 그 종이 읽는 영역이어야 한다.** 자원 노드가 남의 신뢰를
// 조건으로 걸 수는 없다 — 그것은 자원 의존이 아니라 관계 의존이다. 시간만 읽을 자리가 없어
// 틱을 읽고, 그래서 시간만 틱 조건을 갖는다.
//
// 대상 검사는 새로 만들지 않는다. D0 의 `fitTarget` 이 이미 "선언한 종이 이 대상을 받는가" 를
// 판정하므로 그대로 부른다.

import type { Id } from '../v1/id.ts';
import { deterministicId } from '../v1/id.ts';
import type { EntityKind, StateDomain } from '../o1/being.ts';
import type { OnticBase, OntologyKind } from '../o1/kinds.ts';
import type { SlotRef } from '../o0/definition.ts';
import { checkHolder } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { isStateDomain } from '../o2/domain.ts';
import { checkBand, describeBand, type Band } from '../s0/stake.ts';
import {
  fitTarget,
  isDependencyKind,
  kindGrounding,
  kindLabel,
  type DependencyKind,
} from '../d0/index.ts';
import { violateGraph, type GraphViolation } from './violation.ts';

export type { Band };

/**
 * 노드가 가리키는 대상 — 세계에 실재하는 O1 원소의 최소 참조.
 * 그래프는 세계 스냅샷 없이도 검사되어야 하므로 판정에 필요한 자리만 지고 다닌다.
 */
export interface NodeTarget {
  /** O1 12타입 중 무엇으로 서는가 */
  readonly ontology: OntologyKind;
  readonly id: Id;
  readonly name: string;
  /** 사물이면 어느 사물인가. 아니면 null */
  readonly entityKind: EntityKind | null;
  /** 상태면 어느 영역인가. 아니면 null */
  readonly domain: StateDomain | null;
}

/** 무엇이 충족인가 — 자리의 값이거나, 흐른 틱이거나. */
export type NodeCondition =
  | {
      readonly kind: 'slot';
      /** O2 영역 + 경로 */
      readonly slot: SlotRef;
      /** 누구의 자리인가 */
      readonly holderId: Id;
      /** 어디에 있어야 하는가 */
      readonly band: Band;
    }
  | {
      readonly kind: 'clock';
      /** 몇 틱마다 오는가 (1 이상) */
      readonly everyTicks: number;
      /** 온 뒤 몇 틱 안에 써야 하는가 (1 이상, everyTicks 이하) */
      readonly withinTicks: number;
    };

/** 기대는 대상 하나 — 그래프의 한 점. */
export interface DependencyNode {
  readonly id: Id;
  /** 누구의 의존인가 — 그래프는 한 주체의 것이다 */
  readonly subjectId: Id;
  readonly kind: DependencyKind;
  /** 사람이 읽는 이름 (`겨울 식량`) */
  readonly label: string;
  /** 무엇을 가리키는가. 종류로만 걸리면 null (`아무 식량이든`) */
  readonly target: NodeTarget | null;
  readonly condition: NodeCondition;
  /** 왜 이 노드인가 — 근거 없는 노드는 그래프를 설명하지 못한다 */
  readonly note: string;
}

/** 주기의 최대 — 이보다 길면 "온다" 가 아니라 "오지 않는다" 다. */
export const MAX_CYCLE_TICKS = 100000;

/** 노드 ID — 같은 주체·종·이름이면 항상 같다 (V1 결정적 ID). */
export function nodeIdOf(subjectId: Id, kind: DependencyKind, label: string): Id {
  return deterministicId('dep-node', subjectId, kind, label);
}

/** 대상 참조를 D0 관문이 읽는 모양(O1 원소)으로 바꾼다. */
export function targetAsOntic(target: NodeTarget): OnticBase {
  return {
    kind: target.ontology,
    id: target.id,
    ...(target.entityKind === null ? {} : { entityKind: target.entityKind }),
    ...(target.domain === null ? {} : { domain: target.domain }),
  } as OnticBase;
}

/** 조건을 사람이 읽는 한 줄로. */
export function conditionSummary(condition: NodeCondition): string {
  if (condition.kind === 'clock') {
    return `${String(condition.everyTicks)}틱마다 · ${String(condition.withinTicks)}틱 안에`;
  }
  return `${condition.slot.domain}.${condition.slot.path} ${describeBand(condition.band)}`;
}

/** 노드를 한 줄로 접는다 — 그래프 표·화면용. */
export function nodeSummary(node: DependencyNode): string {
  const where = node.target === null ? '종류로만' : node.target.name;
  return `[${kindLabel(node.kind)}] ${node.label} → ${where} · ${conditionSummary(node.condition)}`;
}

/** 노드 하나가 온전한가. 던지지 않는다 — 어긋남은 값으로 남는다. */
export function checkNode(
  node: DependencyNode,
  out: GraphViolation[],
  path = '$',
  schema: StateSchema = STATE_SCHEMA,
): void {
  const label = node.label === '' ? node.id : node.label;

  if (node.label === '') {
    violateGraph(
      out,
      node.id,
      label,
      'bad-node',
      `${path}.label`,
      '이름 없는 노드는 그래프에서 구별되지 않는다',
    );
  }
  if (node.note === '') {
    violateGraph(
      out,
      node.id,
      label,
      'bad-node',
      `${path}.note`,
      '왜 이 노드인지 적지 않았다 — 근거 없는 노드는 그래프를 설명하지 못한다',
    );
  }
  if (node.id !== nodeIdOf(node.subjectId, node.kind, node.label)) {
    violateGraph(
      out,
      node.id,
      label,
      'bad-node',
      `${path}.id`,
      `손으로 지은 ID 다 — nodeIdOf(주체, 종, 이름) 이 만든 값이어야 한다 (${nodeIdOf(node.subjectId, node.kind, node.label)})`,
    );
  }

  if (!isDependencyKind(node.kind)) {
    violateGraph(
      out,
      node.id,
      label,
      'unknown-kind',
      `${path}.kind`,
      `D0 11종에 없는 종이다 — ${JSON.stringify(node.kind)}`,
    );
    return; // 종을 모르면 조건도 대상도 따질 수 없다.
  }
  const grounding = kindGrounding(node.kind);
  if (grounding === null) {
    violateGraph(
      out,
      node.id,
      label,
      'unknown-kind',
      `${path}.kind`,
      `${node.kind} 의 세계 걸림이 없다 — D0 가 못박지 않은 종으로는 노드를 세울 수 없다`,
    );
    return;
  }

  // 대상 검사는 D0 관문을 그대로 지난다 — 같은 판정을 두 번 만들지 않는다.
  const fit = fitTarget(
    node.kind,
    node.target === null ? null : targetAsOntic(node.target),
    path,
  );
  for (const violation of fit.violations) {
    violateGraph(
      out,
      node.id,
      label,
      'kind-target-mismatch',
      violation.path,
      violation.message,
    );
  }

  checkCondition(node, grounding.readsClock, grounding.readDomains, out, path, schema);
}

/** 조건이 그 종에게 온전한가. */
function checkCondition(
  node: DependencyNode,
  readsClock: boolean,
  readDomains: readonly StateDomain[],
  out: GraphViolation[],
  path: string,
  schema: StateSchema,
): void {
  const label = node.label === '' ? node.id : node.label;
  const condition = node.condition;

  if (condition.kind === 'clock') {
    if (!readsClock) {
      violateGraph(
        out,
        node.id,
        label,
        'clock-condition-misuse',
        `${path}.condition`,
        `${kindLabel(node.kind)} 는 세계의 자리(${readDomains.join('·')})에서 충족을 읽는다 — 틱 조건은 시간 종만 쓴다`,
      );
      return;
    }
    if (
      !Number.isInteger(condition.everyTicks) ||
      condition.everyTicks < 1 ||
      condition.everyTicks > MAX_CYCLE_TICKS
    ) {
      violateGraph(
        out,
        node.id,
        label,
        'bad-node',
        `${path}.condition.everyTicks`,
        `주기는 1~${String(MAX_CYCLE_TICKS)} 의 정수여야 한다 — ${String(condition.everyTicks)}. 오지 않는 것은 기다림이 아니다`,
      );
      return;
    }
    if (
      !Number.isInteger(condition.withinTicks) ||
      condition.withinTicks < 1 ||
      condition.withinTicks > condition.everyTicks
    ) {
      violateGraph(
        out,
        node.id,
        label,
        'bad-node',
        `${path}.condition.withinTicks`,
        `쓸 수 있는 창은 1~주기(${String(condition.everyTicks)}) 사이여야 한다 — ${String(condition.withinTicks)}. 주기보다 긴 창은 늘 열려 있는 것과 같다`,
      );
    }
    return;
  }

  if (readsClock) {
    violateGraph(
      out,
      node.id,
      label,
      'slot-condition-missing',
      `${path}.condition`,
      `${kindLabel(node.kind)} 는 세계에 적힐 자리가 없다 — 충족은 틱으로만 읽는다 (D0 가 남긴 부채)`,
    );
    return;
  }

  if (!isStateDomain(condition.slot.domain)) {
    violateGraph(
      out,
      node.id,
      label,
      'phantom-slot',
      `${path}.condition.slot.domain`,
      `9영역에 없는 영역이다 — ${JSON.stringify(condition.slot.domain)}`,
    );
    return;
  }
  if (!readDomains.includes(condition.slot.domain)) {
    violateGraph(
      out,
      node.id,
      label,
      'off-domain-condition',
      `${path}.condition.slot.domain`,
      `${kindLabel(node.kind)} 는 [${readDomains.join(' ')}] 자리로 충족을 읽는다 — ${condition.slot.domain} 을 조건으로 걸면 그것은 다른 종의 의존이다`,
    );
    return;
  }

  const match = lookupField(schema, condition.slot.domain, condition.slot.path);
  if (match === null) {
    violateGraph(
      out,
      node.id,
      label,
      'phantom-slot',
      `${path}.condition.slot.path`,
      `세계에 ${condition.slot.domain}.${condition.slot.path} 자리가 없다 — 없는 것이 채워지기를 기다릴 수는 없다`,
    );
    return;
  }
  const holderReason = checkHolder(match.spec.holder, condition.holderId);
  if (holderReason !== null) {
    violateGraph(
      out,
      node.id,
      label,
      'phantom-slot',
      `${path}.condition.holderId`,
      holderReason,
    );
    return;
  }
  const bandReason = checkBand(match.spec, condition.band);
  if (bandReason !== null) {
    violateGraph(
      out,
      node.id,
      label,
      'bad-band',
      `${path}.condition.band`,
      `${match.spec.label} — ${bandReason}`,
    );
  }
}

/** 노드 목록이 온전한가 — 같은 것을 두 번 세우지 않았는가까지 본다. */
export function checkNodes(
  nodes: readonly DependencyNode[],
  out: GraphViolation[],
  path = '$.nodes',
  schema: StateSchema = STATE_SCHEMA,
): void {
  const seen = new Map<string, string>();
  for (const [index, node] of nodes.entries()) {
    const at = `${path}[${String(index)}]`;
    checkNode(node, out, at, schema);

    const key = `${node.kind}|${node.target?.id ?? '(종류)'}|${conditionSummary(node.condition)}`;
    const first = seen.get(key);
    if (first !== undefined) {
      violateGraph(
        out,
        node.id,
        node.label === '' ? node.id : node.label,
        'duplicate-node',
        at,
        `「${first}」 와 같은 것에 같은 조건으로 두 번 기댄다 — 하나로 합치거나 조건을 갈라야 한다`,
      );
      continue;
    }
    seen.set(key, node.label === '' ? node.id : node.label);
  }
}
