// D1-b 의존 간선 — 기댐의 방식 하나를 그래프의 한 선으로 세운다.
//
// 원문의 간선은 관계 7종과 네 수치, 그리고 끊겼을 때의 효과를 지닌다. 방향은 원문이 `from`/`to`
// 로만 적어 두었으므로 여기서 못박는다: **from 이 to 에 기댄다.** 사냥꾼의 사냥이 협곡에 기대면
// `사냥 --requires--> 협곡` 이고, 화살표는 언제나 결핍에서 채우는 쪽을 가리킨다.
//
// 관계 7종은 이름만 다른 일곱 개의 `requires` 가 아니다. 각각은 **그 관계로 기댈 수 있는 종**을
// 갖는다. 허락은 제도·규칙만 할 수 있고, 알려 주는 것은 정보만 하고, 되풀이로 떠받치는 것은
// 의례·관계만 한다. 그리고 D0 가 종마다 못박아 둔 성격이 여기서 강제된다:
//
//   `consumes` 는 줄어드는 종에만 걸린다 — 규칙을 다 써 버릴 수는 없다 (D0 `depletes`).
//   `substitutability` 는 그 대상이어야 하는 종에서 1 이 될 수 없다 (D0 `targeting='named'`).
//   시간에 기대는 것은 갈아탈 수 없다 — 기다리는 것 말고 방법이 없다.
//
// 마지막 자리는 `failureEffects` 다. 원문은 `EffectSpec[]` 이라고만 적지만, 우리 세계에서
// "효과" 는 O2 의 자리에 값이 남는 일이다 (O0 공리: 큰 변화는 흔적을 남긴다).
// 그래서 **끊겨도 아무 자리에도 아무것도 남지 않는 간선은 거부한다** — 흔적 없는 끊김은
// 아무도 눈치채지 못하고, 눈치채지 못하는 결핍은 목적을 만들지 못한다.

import type { Id } from '../v1/id.ts';
import { deterministicId } from '../v1/id.ts';
import type { StateValue } from '../o1/being.ts';
import type { SlotRef } from '../o0/definition.ts';
import { checkHolder, numericRange } from '../o2/field.ts';
import { lookupField, STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { isStateDomain } from '../o2/domain.ts';
import { kindGrounding, kindLabel, type DependencyKind } from '../d0/index.ts';
import type { DependencyNode } from './node.ts';
import { violateGraph, type GraphViolation } from './violation.ts';

/** 기댐의 방식 7종 (원문 D1 `DependencyEdge.relation`). */
export const EDGE_RELATIONS = [
  'requires', // 있어야 한다 — 가장 넓은 기댐
  'consumes', // 써서 없앤다
  'protected_by', // 지켜 준다
  'produced_by', // 만들어 낸다
  'authorized_by', // 허락해 준다
  'informed_by', // 알게 해 준다
  'sustained_by', // 되풀이로 떠받친다
] as const;
export type EdgeRelation = (typeof EDGE_RELATIONS)[number];

/** 관계 하나의 성격 — 무엇에 이 방식으로 기댈 수 있는가. */
export interface RelationSpec {
  readonly relation: EdgeRelation;
  readonly label: string;
  /** 이 관계로 기댈 수 있는 대상 종. 비면 전부 */
  readonly targetKinds: readonly DependencyKind[];
  /** 왜 그 종들인가 */
  readonly note: string;
}

export const RELATION_SPECS: readonly RelationSpec[] = [
  {
    relation: 'requires',
    label: '있어야 한다',
    targetKinds: [],
    note: '가장 넓은 기댐 — 어느 종에도 걸린다. 무엇을 어떻게 기대는지가 더 분명하면 아래 여섯 중 하나를 쓴다',
  },
  {
    relation: 'consumes',
    label: '써서 없앤다',
    targetKinds: ['resource', 'body', 'relationship'],
    note: 'D0 가 쓰면 준다고 못박은 종에만 걸린다 — 규칙이나 장소는 다 써 버릴 수 없다',
  },
  {
    relation: 'protected_by',
    label: '지켜 준다',
    targetKinds: ['space', 'institution', 'subject', 'rule'],
    note: '무너짐을 늦추거나 막는 것 — 성벽·법·동료·세계 규칙. 채워 주는 것과는 다르다',
  },
  {
    relation: 'produced_by',
    label: '만들어 낸다',
    targetKinds: ['resource', 'information', 'relationship', 'institution', 'subject'],
    note: '없던 것을 있게 하는 것. 만들어질 수 없는 것(장소·환경·몸·규칙·의례·시간)에는 걸리지 않는다',
  },
  {
    relation: 'authorized_by',
    label: '허락해 준다',
    targetKinds: ['institution', 'rule'],
    note: '해도 된다고 정해 주는 것 — 자격·통행권·세계 규칙. 사람이 허락해도 그것을 세우는 것은 제도다',
  },
  {
    relation: 'informed_by',
    label: '알게 해 준다',
    targetKinds: ['information'],
    note: '앎으로만 채워지는 기댐 — 어디 있는지·어떻게 하는지. D0 가 유일하게 나눠도 줄지 않는다고 못박은 종이다',
  },
  {
    relation: 'sustained_by',
    label: '되풀이로 떠받친다',
    targetKinds: ['ritual', 'relationship', 'time'],
    note: '한 번으로 끝나지 않고 되풀이해야 유지되는 것 — 제사·신뢰·주기',
  },
];

/** 끊겼을 때 세계에 남는 것 하나 (원문 `EffectSpec`). */
export interface FailureEffect {
  readonly slot: SlotRef;
  readonly holderId: Id;
  /** 얼마나 움직이는가 (수치 자리) 또는 무엇이 되는가 */
  readonly change:
    | { readonly kind: 'delta'; readonly by: number }
    | { readonly kind: 'set'; readonly value: StateValue };
  readonly note: string;
}

/** 기댐 하나 — 그래프의 한 선. `from` 이 `to` 에 기댄다. */
export interface DependencyEdge {
  readonly id: Id;
  /** 기대는 쪽 노드 */
  readonly from: Id;
  /** 기대어지는 쪽 노드 */
  readonly to: Id;
  readonly relation: EdgeRelation;
  /** 끊겼을 때의 타격 0 초과 1 이하 — 0 이면 기대지 않는 것이다 */
  readonly strength: number;
  /** 얼마나 급한가 0~1 */
  readonly urgency: number;
  /** 얼마나 갈아탈 수 있는가 0~1 — 1 이면 무엇으로든 대체 가능 */
  readonly substitutability: number;
  /** 끊긴 채 이만큼 지나면 효과가 온다 (1 이상) */
  readonly failureDelayTicks: number;
  /** 그때 세계에 무엇이 남는가 — 비면 아무도 눈치채지 못한다 */
  readonly failureEffects: readonly FailureEffect[];
  readonly note: string;
}

/** 끊김이 오기까지 걸릴 수 있는 최대 틱 — 이보다 길면 "온다" 가 아니다. */
export const MAX_FAILURE_DELAY = 100000;

/** 간선 ID — 같은 두 노드·같은 관계면 항상 같다 (V1 결정적 ID). */
export function edgeIdOf(from: Id, to: Id, relation: EdgeRelation): Id {
  return deterministicId('dep-edge', from, to, relation);
}

/** 관계 하나의 성격을 찾는다. */
export function relationSpec(relation: EdgeRelation): RelationSpec | null {
  return RELATION_SPECS.find((spec) => spec.relation === relation) ?? null;
}

/** 문자열이 관계 7종 중 하나인가. */
export function isEdgeRelation(value: unknown): value is EdgeRelation {
  return typeof value === 'string' && (EDGE_RELATIONS as readonly string[]).includes(value);
}

/** 그 관계로 이 종에 기댈 수 있는가. */
export function relationAccepts(relation: EdgeRelation, kind: DependencyKind): boolean {
  const spec = relationSpec(relation);
  if (spec === null) return false;
  return spec.targetKinds.length === 0 || spec.targetKinds.includes(kind);
}

/** 어떤 종에 걸 수 있는 관계들 — 화면·D2 가 고를 때 쓴다. */
export function relationsFor(kind: DependencyKind): readonly EdgeRelation[] {
  return RELATION_SPECS.filter((spec) => relationAccepts(spec.relation, kind)).map(
    (spec) => spec.relation,
  );
}

/** 간선을 한 줄로 접는다 — 그래프 표·화면용. */
export function edgeSummary(edge: DependencyEdge, nodes: readonly DependencyNode[]): string {
  const name = (id: Id): string => nodes.find((node) => node.id === id)?.label ?? id;
  return `${name(edge.from)} --${edge.relation}--> ${name(edge.to)} (강도 ${String(edge.strength)} · 급함 ${String(edge.urgency)} · 대체 ${String(edge.substitutability)})`;
}

/** 0~1 인가 (양끝 포함). */
function isUnit(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

/** 끊김의 흔적 하나가 세계에 적힐 수 있는가. */
function checkEffect(
  edge: DependencyEdge,
  label: string,
  effect: FailureEffect,
  index: number,
  out: GraphViolation[],
  path: string,
  schema: StateSchema,
): void {
  const at = `${path}.failureEffects[${String(index)}]`;
  if (!isStateDomain(effect.slot.domain)) {
    violateGraph(
      out,
      edge.id,
      label,
      'phantom-effect-slot',
      `${at}.slot.domain`,
      `9영역에 없는 영역에 흔적을 남기려 한다 — ${JSON.stringify(effect.slot.domain)}`,
    );
    return;
  }
  const match = lookupField(schema, effect.slot.domain, effect.slot.path);
  if (match === null) {
    violateGraph(
      out,
      edge.id,
      label,
      'phantom-effect-slot',
      `${at}.slot.path`,
      `세계에 ${effect.slot.domain}.${effect.slot.path} 자리가 없다 — 없는 자리에는 흔적이 남지 않는다`,
    );
    return;
  }
  const holderReason = checkHolder(match.spec.holder, effect.holderId);
  if (holderReason !== null) {
    violateGraph(out, edge.id, label, 'phantom-effect-slot', `${at}.holderId`, holderReason);
    return;
  }
  if (effect.change.kind === 'delta') {
    if (numericRange(match.spec.value) === null) {
      violateGraph(
        out,
        edge.id,
        label,
        'phantom-effect-slot',
        `${at}.change`,
        `${match.spec.label} 은 수치 자리가 아니다 — 얼마나 움직이는지로 적을 수 없다`,
      );
      return;
    }
    if (!Number.isFinite(effect.change.by) || effect.change.by === 0) {
      violateGraph(
        out,
        edge.id,
        label,
        'traceless-failure',
        `${at}.change.by`,
        '0 만큼 움직인다는 것은 아무것도 남지 않는다는 뜻이다',
      );
    }
  }
  if (effect.note === '') {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${at}.note`,
      '무엇이 남는지 적지 않았다 — 근거 없는 흔적은 흔적이 아니다',
    );
  }
}

/**
 * 간선 하나가 온전한가.
 * @param nodes 그래프의 노드들 — 가리키는 노드가 실재하는지, 그 종에 이 관계를 걸 수 있는지 본다.
 */
export function checkEdge(
  edge: DependencyEdge,
  nodes: readonly DependencyNode[],
  out: GraphViolation[],
  path = '$',
  schema: StateSchema = STATE_SCHEMA,
): void {
  const to = nodes.find((node) => node.id === edge.to);
  const from = nodes.find((node) => node.id === edge.from);
  const label =
    from === undefined || to === undefined
      ? edge.id
      : `${from.label} --${edge.relation}--> ${to.label}`;

  if (!isEdgeRelation(edge.relation)) {
    violateGraph(
      out,
      edge.id,
      label,
      'unknown-relation',
      `${path}.relation`,
      `관계 7종에 없다 — ${JSON.stringify(edge.relation)}`,
    );
    return;
  }
  if (edge.id !== edgeIdOf(edge.from, edge.to, edge.relation)) {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${path}.id`,
      '손으로 지은 ID 다 — edgeIdOf(from, to, relation) 이 만든 값이어야 한다',
    );
  }
  if (edge.from === edge.to) {
    violateGraph(
      out,
      edge.id,
      label,
      'self-edge',
      `${path}.to`,
      '자기 자신에 기댄다 — 스스로 채워지는 결핍은 결핍이 아니다',
    );
    return;
  }
  if (from === undefined || to === undefined) {
    violateGraph(
      out,
      edge.id,
      label,
      'dangling-edge',
      from === undefined ? `${path}.from` : `${path}.to`,
      `그래프에 없는 노드를 가리킨다 — ${from === undefined ? edge.from : edge.to}`,
    );
    return;
  }

  // ① 그 관계로 그 종에 기댈 수 있는가.
  if (!relationAccepts(edge.relation, to.kind)) {
    const spec = relationSpec(edge.relation);
    const rule: GraphViolation['rule'] =
      edge.relation === 'consumes' ? 'consumes-undepleting' : 'relation-kind-mismatch';
    violateGraph(
      out,
      edge.id,
      label,
      rule,
      `${path}.relation`,
      edge.relation === 'consumes'
        ? `${kindLabel(to.kind)} 는 써도 줄지 않는다 — 소모할 수 없는 것을 소모한다고 적었다 (D0 depletes=false). 걸 수 있는 관계: ${relationsFor(to.kind).join(' ')}`
        : `「${spec?.label ?? edge.relation}」 는 [${spec?.targetKinds.map(kindLabel).join(' ') ?? ''}] 에만 걸린다 — ${kindLabel(to.kind)} 에는 ${relationsFor(to.kind).join(' ')} 중 하나를 쓴다`,
    );
  }

  // ② D0 가 못박은 가리킴 방식과 대체 가능성이 어긋나지 않는가.
  const grounding = kindGrounding(to.kind);
  if (grounding !== null && grounding.targeting === 'named' && edge.substitutability >= 1) {
    violateGraph(
      out,
      edge.id,
      label,
      'substitutable-named',
      `${path}.substitutability`,
      `${kindLabel(to.kind)} 는 그 대상이어야 하는 종이다 — 무엇으로든 대체 가능하다고 적으면 대상을 가리킨 뜻이 없어진다 (D0 targeting=named)`,
    );
  }
  if (to.kind === 'time' && edge.substitutability > 0) {
    violateGraph(
      out,
      edge.id,
      label,
      'substitutable-named',
      `${path}.substitutability`,
      '시간은 갈아탈 수 없다 — 기다리는 것 말고 방법이 없다',
    );
  }

  // ③ 네 수치.
  if (!(edge.strength > 0) || edge.strength > 1) {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${path}.strength`,
      `강도는 0 초과 1 이하여야 한다 — ${String(edge.strength)}. 0 이면 끊겨도 아무 일이 없고, 그것은 기댐이 아니다`,
    );
  }
  if (!isUnit(edge.urgency)) {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${path}.urgency`,
      `급함은 0~1 이어야 한다 — ${String(edge.urgency)}`,
    );
  }
  if (!isUnit(edge.substitutability)) {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${path}.substitutability`,
      `대체 가능성은 0~1 이어야 한다 — ${String(edge.substitutability)}`,
    );
  }
  if (
    !Number.isInteger(edge.failureDelayTicks) ||
    edge.failureDelayTicks < 1 ||
    edge.failureDelayTicks > MAX_FAILURE_DELAY
  ) {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${path}.failureDelayTicks`,
      `끊김이 오기까지의 틱은 1~${String(MAX_FAILURE_DELAY)} 의 정수여야 한다 — ${String(edge.failureDelayTicks)}`,
    );
  }
  if (edge.note === '') {
    violateGraph(
      out,
      edge.id,
      label,
      'bad-edge',
      `${path}.note`,
      '왜 이렇게 기대는지 적지 않았다 — 근거 없는 간선은 그래프를 설명하지 못한다',
    );
  }

  // ④ 끊김의 흔적 — 아무것도 남지 않으면 아무도 눈치채지 못한다.
  if (edge.failureEffects.length === 0) {
    violateGraph(
      out,
      edge.id,
      label,
      'traceless-failure',
      `${path}.failureEffects`,
      '끊겨도 세계에 아무것도 남지 않는다 — 눈치채지 못하는 결핍은 목적을 만들지 못한다 (O0: 큰 변화는 흔적을 남긴다)',
    );
    return;
  }
  for (const [index, effect] of edge.failureEffects.entries()) {
    checkEffect(edge, label, effect, index, out, path, schema);
  }
}

/** 간선 목록이 온전한가 — 같은 기댐을 두 번 적지 않았는가까지 본다. */
export function checkEdges(
  edges: readonly DependencyEdge[],
  nodes: readonly DependencyNode[],
  out: GraphViolation[],
  path = '$.edges',
  schema: StateSchema = STATE_SCHEMA,
): void {
  const seen = new Set<string>();
  for (const [index, edge] of edges.entries()) {
    const at = `${path}[${String(index)}]`;
    checkEdge(edge, nodes, out, at, schema);

    const key = `${edge.from}|${edge.to}|${edge.relation}`;
    if (seen.has(key)) {
      violateGraph(
        out,
        edge.id,
        edge.id,
        'duplicate-edge',
        at,
        '같은 두 노드를 같은 관계로 두 번 이었다 — 수치가 다르면 어느 쪽이 참인지 알 수 없다',
      );
      continue;
    }
    seen.add(key);
  }
}
