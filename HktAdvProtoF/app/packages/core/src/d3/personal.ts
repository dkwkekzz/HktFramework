// D3-a 개인화 — 종의 그래프를 이 개체의 것으로 세운다.
//
// D2 가 찍어 낸 그래프는 종의 것이다. 같은 종의 넷은 완전히 같은 그래프를 받았다 — 이름도
// 사슬도 수치도 같았다. 그런데 S3 는 이미 그 넷을 갈라 두었다: 겁 많은 04 는 같은 허기를 더
// 급하게 느끼고(×1.4), 욕심 많은 11 은 덜 급하게 느낀다(×0.7). **그 갈림이 그래프에 실려야 한다.**
//
// 그래서 개인화의 첫 일은 변형이 아니라 **다시 읽기**다. 뿌리에 걸린 간선의 급함과 시한을
// 종의 템플릿이 아니라 **개체의 실제 Need**(S3 가 성격·단계로 이미 흔든 값)에서 다시 읽는다.
// 성격은 D3 의 변형 문법을 쓰지 않는다 — 개체의 Need 가 이미 흔들려 있고, 여기서는 그것을
// 옮겨 적을 뿐이다. 같은 값을 두 곳에서 흔들면 두 답이 갈린다 (D2 와 같은 태도).
//
// 뿌리는 개체가 바꾸지 못한다. 사제도 굶고, 겁 많은 자도 굶는다 — 무엇으로 무너지는가는
// 종의 것이다(S1). 개체가 바꾸는 것은 **그 무너짐을 무엇이 채우는가**뿐이다.

import type { Id } from '../v1/id.ts';
import type { Need } from '../s0/stake.ts';
import type { SubjectInstance } from '../s3/instance.ts';
import type { DependencyEdge, DependencyGraph, DependencyNode } from '../d1/index.ts';
import type { GraphBirth } from '../d2/index.ts';
import { slotKey } from '../d2/index.ts';
import { violatePersonal, type PersonalRef, type PersonalViolation } from './violation.ts';

/** 개체를 가리키는 최소 참조. */
export function personalRef(instance: SubjectInstance): PersonalRef {
  return { subjectId: instance.id, name: instance.name };
}

/** 개체의 몸 — 경계에 적힌 것. 몸 없는 주체는 null. */
export function bodyIdOf(instance: SubjectInstance): Id | null {
  return instance.boundaries.find((boundary) => boundary.kind === 'body')?.ofId ?? null;
}

/**
 * 이 개체의 자리 — D2 가 기본 그래프를 찍어 낼 때 받는 것.
 * 개체의 그래프는 개체의 ID 로 서야 한다: 종의 표본으로 찍은 그래프는 이 개체의 것이 아니다.
 */
export function graphBirthOf(instance: SubjectInstance, stage?: string): GraphBirth {
  return { subjectId: instance.id, bodyId: bodyIdOf(instance), stage };
}

/** 뿌리 하나가 개체에게서 어떻게 다시 읽혔는가 — 화면의 "무엇이 갈렸는가". */
export interface RootRetune {
  readonly rootId: Id;
  readonly label: string;
  readonly slot: string;
  /** 종이 말한 급함 → 이 개체의 급함 */
  readonly urgency: readonly [number, number];
  /** 종이 말한 시한 → 이 개체의 시한 */
  readonly delayTicks: readonly [number, number];
  /** 성격·단계가 흔들었는가 */
  readonly moved: boolean;
}

/** 그 뿌리에 걸린 개체의 무너짐을 찾는다 — 자리와 주인이 같아야 같은 무너짐이다. */
export function needForRoot(node: DependencyNode, instance: SubjectInstance): Need | null {
  if (node.condition.kind !== 'slot') return null;
  const key = slotKey(node.condition.slot);
  const holderId = node.condition.holderId;
  return (
    instance.needs.find(
      (need) => slotKey(need.slot) === key && need.holderId === holderId,
    ) ?? null
  );
}

/** 개인화 결과 — 뿌리 간선이 다시 읽힌 그래프와, 무엇이 갈렸는가. */
export interface Personalized {
  readonly graph: DependencyGraph;
  readonly retunes: readonly RootRetune[];
}

/**
 * 기본 그래프의 뿌리 간선을 개체의 Need 로 다시 읽는다.
 * 노드와 사슬은 그대로다 — 흔들리는 것은 뿌리에 걸린 급함과 시한뿐이다.
 */
export function personalizeRoots(
  base: DependencyGraph,
  instance: SubjectInstance,
): Personalized {
  const retunes: RootRetune[] = [];
  const edges: DependencyEdge[] = base.edges.map((edge) => {
    if (!base.rootIds.includes(edge.from)) return edge;
    const node = base.nodes.find((entry) => entry.id === edge.from);
    if (node === undefined) return edge;
    const need = needForRoot(node, instance);
    if (need === null) return edge;

    if (!retunes.some((entry) => entry.rootId === node.id)) {
      retunes.push({
        rootId: node.id,
        label: node.label,
        slot: slotKey(need.slot),
        urgency: [edge.urgency, need.urgency],
        delayTicks: [edge.failureDelayTicks, need.collapseAfterTicks],
        moved:
          edge.urgency !== need.urgency || edge.failureDelayTicks !== need.collapseAfterTicks,
      });
    }
    return { ...edge, urgency: need.urgency, failureDelayTicks: need.collapseAfterTicks };
  });

  return { graph: { ...base, edges }, retunes };
}

/**
 * 기본 그래프가 이 개체의 것인가 — 주체가 같고, 뿌리마다 개체의 무너짐이 있는가.
 * 뿌리와 개체의 무너짐이 어긋나면 개인화는 아무것도 다시 읽지 못한다.
 */
export function checkPersonalBase(
  base: DependencyGraph,
  instance: SubjectInstance,
  out: PersonalViolation[],
): void {
  const subject = personalRef(instance);

  if (base.subjectId !== instance.id) {
    violatePersonal(
      out,
      subject,
      'foreign-base',
      base.name,
      '$.base.subjectId',
      `${instance.name} 의 그래프가 아니다 — 종의 표본이나 다른 개체의 그래프는 이 개체의 것이 될 수 없다 (${base.subjectId})`,
    );
    return;
  }

  // 뿌리 하나하나가 개체의 무너짐일 필요는 없다 — 대를 잇는 뿌리(D2 lineage)는 종이 끊기는
  // 자리이지 개체가 무너지는 자리가 아니다(S1). 그런 뿌리는 다시 읽을 것이 없을 뿐이다.
  // 그러나 **하나도 맞지 않으면** 그것은 이 개체의 그래프가 아니다.
  const roots = base.rootIds
    .map((rootId) => base.nodes.find((entry) => entry.id === rootId))
    .filter((node): node is DependencyNode => node !== undefined);
  if (roots.length === 0 || roots.some((node) => needForRoot(node, instance) !== null)) return;

  violatePersonal(
    out,
    subject,
    'unrooted-instance',
    roots.map((node) => node.label).join(', '),
    '$.base.rootIds',
    `뿌리 ${String(roots.length)}개 중 ${instance.name} 이 실제로 무너지는 자리가 하나도 없다 — 다른 종의 그래프이거나 자리의 주인이 어긋났다`,
  );
}

/** 다시 읽기를 한 줄로 접는다 — 개체 카드용. */
export function retuneSummary(retune: RootRetune): string {
  if (!retune.moved) return `${retune.label} — 종이 말한 그대로 (급함 ${String(retune.urgency[1])})`;
  return `${retune.label} — 급함 ${String(retune.urgency[0])} → ${String(retune.urgency[1])} · 시한 ${String(retune.delayTicks[0])} → ${String(retune.delayTicks[1])}틱`;
}
