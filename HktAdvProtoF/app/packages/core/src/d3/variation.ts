// D3-b 변형 문법 — 개체가 그래프에 할 수 있는 일은 셋뿐이다.
//
// 변형을 자유 편집으로 두면 개체는 무엇이든 될 수 있다 — 굶지 않는 사람, 아무것에도 기대지
// 않는 사람. 그래서 문법을 셋으로 못박는다:
//
//   더함(add)     새 채움 갈래를 잇는다 — D2 의 `SupplySpec` 을 그대로 쓴다
//   약화(weaken)  이미 있는 기댐의 강도를 낮춘다
//   끊음(drop)    이미 있는 기댐을 끊는다
//
// **없는 것: 노드를 지우는 편집.** 뿌리는 종의 것이고(S1), 개체는 무엇으로 무너지는지를 바꾸지
// 못한다 — 사제도 굶는다. 바꿀 수 있는 것은 그 무너짐을 무엇이 채우는가뿐이다.
//
// 그리고 모든 변형은 **유래를 댄다.** 능력·문화·자리·이력·성격 중 하나이고, 그것을 이 개체가
// 실제로 가지고 있어야 한다 (S3 `Provenance` 의 태도 그대로 — 유래를 못 대는 값은 서지 못한다).
// 세계에 선언된 변형 중 이 개체가 유래를 가진 것만 적용된다.

import type { Id } from '../v1/id.ts';
import type { SubjectInstance } from '../s3/instance.ts';
import type { LifeStage } from '../s1/lifecycle.ts';
import {
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
  type EdgeRelation,
} from '../d1/index.ts';
import {
  slotKey,
  supplyEdgeFrom,
  supplyNodeFrom,
  type SupplySpec,
} from '../d2/index.ts';
import { needForRoot, personalRef } from './personal.ts';
import { violatePersonal, type PersonalViolation } from './violation.ts';

/** 변형이 어디서 왔는가 — 다섯 중 하나. */
export type VariationOrigin =
  | { readonly kind: 'capability'; readonly abilityId: Id } // 이 개체가 여는 능력
  | { readonly kind: 'culture'; readonly cultureId: Id } // 이 개체의 문화
  | { readonly kind: 'role'; readonly roleId: Id } // 이 개체가 선 자리
  | { readonly kind: 'history'; readonly eventName: string } // 지고 온 것
  | { readonly kind: 'trait'; readonly traitId: Id }; // 타고난 기울기

/** 그래프에 할 수 있는 편집 — 셋뿐이다. */
export type VariationEdit =
  | { readonly kind: 'add'; readonly supply: SupplySpec }
  | {
      readonly kind: 'weaken';
      /** 기대는 쪽 노드의 이름 (종의 것이므로 세계 수준에서 적을 수 있다) */
      readonly from: string;
      readonly to: string;
      readonly relation: EdgeRelation;
      /** 낮출 강도 — 0 초과, 지금 강도 미만 */
      readonly strength: number;
    }
  | {
      readonly kind: 'drop';
      readonly from: string;
      readonly to: string;
      readonly relation: EdgeRelation;
    };

/** 변형 하나 — 어디서 왔고, 무엇을 하고, 왜인가. */
export interface VariationSpec {
  readonly id: string;
  readonly name: string;
  readonly origin: VariationOrigin;
  readonly edits: readonly VariationEdit[];
  readonly note: string;
}

/** 유래를 사람이 읽는 한 마디로. */
export function originLabel(origin: VariationOrigin): string {
  if (origin.kind === 'capability') return '능력';
  if (origin.kind === 'culture') return '문화';
  if (origin.kind === 'role') return '자리';
  if (origin.kind === 'history') return '이력';
  return '성격';
}

/** 이 개체가 그 유래를 실제로 가지고 있는가. */
export function hasOrigin(instance: SubjectInstance, origin: VariationOrigin): boolean {
  if (origin.kind === 'capability') return instance.capabilities.includes(origin.abilityId);
  if (origin.kind === 'culture') return instance.cultureId === origin.cultureId;
  if (origin.kind === 'role') return instance.roleId === origin.roleId;
  if (origin.kind === 'history') {
    return instance.history.some((event) => event.name === origin.eventName);
  }
  return instance.traits.some((trait) => trait.id === origin.traitId);
}

/** 세계에 선언된 변형 중 이 개체의 것만 — 순서는 선언 순서다 (V1 태도). */
export function variationsFor(
  instance: SubjectInstance,
  variations: readonly VariationSpec[],
): readonly VariationSpec[] {
  return variations.filter((variation) => hasOrigin(instance, variation.origin));
}

/** 이름으로 노드를 찾는다 — 노드의 이름은 종의 것이므로 세계 수준에서 가리킬 수 있다. */
export function nodeByLabel(graph: DependencyGraph, label: string): DependencyNode | null {
  return graph.nodes.find((node) => node.label === label) ?? null;
}

/** 그 편집이 가리키는 간선을 찾는다. */
export function edgeOfEdit(
  graph: DependencyGraph,
  edit: Extract<VariationEdit, { kind: 'weaken' | 'drop' }>,
): DependencyEdge | null {
  const from = nodeByLabel(graph, edit.from);
  const to = nodeByLabel(graph, edit.to);
  if (from === null || to === null) return null;
  return (
    graph.edges.find(
      (edge) => edge.from === from.id && edge.to === to.id && edge.relation === edit.relation,
    ) ?? null
  );
}

/** 편집 하나를 한 줄로. */
export function editSummary(edit: VariationEdit): string {
  if (edit.kind === 'add') return `+ ${edit.supply.label}`;
  if (edit.kind === 'drop') return `✕ ${edit.from} --${edit.relation}--> ${edit.to}`;
  return `↓ ${edit.from} --${edit.relation}--> ${edit.to} (강도 ${String(edit.strength)})`;
}

/** 변형 하나를 그래프에 적용한다 — 가리키는 것이 없으면 건너뛴다(사유는 검사기가 남긴다). */
export function applyVariation(
  graph: DependencyGraph,
  variation: VariationSpec,
  instance: SubjectInstance,
  stage: LifeStage | null,
): DependencyGraph {
  let nodes = [...graph.nodes];
  let edges = [...graph.edges];
  const where = { subjectId: instance.id, bodyId: bodyOf(instance) };

  for (const edit of variation.edits) {
    if (edit.kind === 'drop') {
      const edge = edgeOfEdit({ ...graph, nodes, edges }, edit);
      if (edge === null) continue;
      edges = edges.filter((entry) => entry.id !== edge.id);
      continue;
    }
    if (edit.kind === 'weaken') {
      const edge = edgeOfEdit({ ...graph, nodes, edges }, edit);
      if (edge === null) continue;
      edges = edges.map((entry) =>
        entry.id === edge.id ? { ...entry, strength: edit.strength } : entry,
      );
      continue;
    }

    // 더함 — D2 의 채움 문법을 그대로 쓴다. 노드 하나와, 채우는 것마다 간선 하나.
    const node = supplyNodeFrom(edit.supply, where);
    if (!nodes.some((entry) => entry.id === node.id)) nodes = [...nodes, node];

    for (const fill of edit.supply.fills) {
      const parent =
        fill.kind === 'supply'
          ? nodes.find((entry) => entry.label === fill.label) ?? null
          : nodes.find(
              (entry) =>
                graph.rootIds.includes(entry.id) &&
                entry.condition.kind === 'slot' &&
                slotKey(entry.condition.slot) === slotKey(fill.slot),
            ) ?? null;
      if (parent === null || parent.id === node.id) continue;

      const need = fill.kind === 'root' ? needForRoot(parent, instance) : null;
      const timing =
        need === null
          ? { urgency: edit.supply.urgency ?? 0, baseDelayTicks: edit.supply.baseDelayTicks ?? 1 }
          : { urgency: need.urgency, baseDelayTicks: need.collapseAfterTicks };
      // 뿌리에 걸린 시한은 개체의 Need 가 이미 단계로 나눈 값이다 — 두 번 나누지 않는다.
      const edge = supplyEdgeFrom(
        parent,
        node,
        edit.supply,
        timing,
        need === null ? stage : null,
        where,
      );
      if (!edges.some((entry) => entry.id === edge.id)) edges = [...edges, edge];
    }
  }

  return { ...graph, nodes, edges };
}

/** 개체의 몸 — 경계에 적힌 것 (personal.ts 의 것과 같다, 순환 수입을 피해 여기서 다시 읽는다). */
function bodyOf(instance: SubjectInstance): Id | null {
  return instance.boundaries.find((boundary) => boundary.kind === 'body')?.ofId ?? null;
}

/**
 * 변형 선언이 온전한가 — 유래를 대는가, 가리키는 것이 실재하는가, 값이 서식에 맞는가.
 * 전환 검사(줄인 만큼 다른 것이 서는가)는 D3-c 가 본다.
 */
export function checkVariations(
  instance: SubjectInstance,
  variations: readonly VariationSpec[],
  graph: DependencyGraph,
  out: PersonalViolation[],
): void {
  const subject = personalRef(instance);

  for (const [index, variation] of variations.entries()) {
    const path = `$.variations[${String(index)}]`;
    const at = variation.name === '' ? variation.id : variation.name;

    if (!hasOrigin(instance, variation.origin)) {
      violatePersonal(
        out,
        subject,
        'orphan-variation',
        at,
        `${path}.origin`,
        `${instance.name} 은 이 변형의 유래(${originLabel(variation.origin)})를 갖지 않는다 — 갖지 않은 것으로 그래프를 바꿀 수는 없다`,
      );
      continue;
    }
    if (variation.note === '') {
      violatePersonal(
        out,
        subject,
        'bad-variation',
        at,
        `${path}.note`,
        '왜 이렇게 갈라지는지 적지 않았다 — 근거 없는 변형은 개체를 설명하지 못한다',
      );
    }
    if (variation.edits.length === 0) {
      violatePersonal(
        out,
        subject,
        'bad-variation',
        at,
        `${path}.edits`,
        '아무것도 바꾸지 않는 변형이다 — 갈라지지 않는 갈림은 갈림이 아니다',
      );
    }

    for (const [order, edit] of variation.edits.entries()) {
      const where = `${path}.edits[${String(order)}]`;
      if (edit.kind === 'add') {
        for (const [fillOrder, fill] of edit.supply.fills.entries()) {
          const found =
            fill.kind === 'supply'
              ? nodeByLabel(graph, fill.label) !== null
              : graph.nodes.some(
                  (node) =>
                    graph.rootIds.includes(node.id) &&
                    node.condition.kind === 'slot' &&
                    slotKey(node.condition.slot) === slotKey(fill.slot),
                );
          if (found) continue;
          violatePersonal(
            out,
            subject,
            'phantom-edit',
            at,
            `${where}.supply.fills[${String(fillOrder)}]`,
            fill.kind === 'supply'
              ? `그래프에 「${fill.label}」 이 없다 — 없는 것을 채울 수는 없다`
              : `${slotKey(fill.slot)} 자리의 뿌리가 그래프에 없다`,
          );
        }
        if (edit.supply.fills.length === 0) {
          violatePersonal(
            out,
            subject,
            'bad-variation',
            at,
            `${where}.supply.fills`,
            '아무것도 채우지 않는 채움을 더했다 — 무엇 때문에 있는지 말하지 못한다 (D2 와 같은 관문)',
          );
        }
        continue;
      }

      const edge = edgeOfEdit(graph, edit);
      if (edge === null) {
        violatePersonal(
          out,
          subject,
          'phantom-edit',
          at,
          `${where}`,
          `그래프에 「${edit.from} --${edit.relation}--> ${edit.to}」 라는 기댐이 없다`,
        );
        continue;
      }
      if (edit.kind === 'weaken') {
        if (!(edit.strength > 0)) {
          violatePersonal(
            out,
            subject,
            'bad-variation',
            at,
            `${where}.strength`,
            `강도를 0 이하로 낮춘다 — 끊는 것이면 끊음(drop)으로 적어야 한다 (${String(edit.strength)})`,
          );
        } else if (edit.strength >= edge.strength) {
          violatePersonal(
            out,
            subject,
            'bad-variation',
            at,
            `${where}.strength`,
            `약화인데 강도가 줄지 않는다 — 지금 ${String(edge.strength)}, 적은 값 ${String(edit.strength)}`,
          );
        }
      }
    }
  }
}
