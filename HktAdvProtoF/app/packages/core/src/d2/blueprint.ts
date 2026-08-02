// D2-c 설계도 조립 — 종 하나에서 그래프 하나가 나오고, 생존·번식 경로가 끊기지 않는지 본다.
//
// 여기서 원문 D2 의 검증 조항이 코드가 된다: **"종 하나를 생성하면 생존과 번식에 필요한 의존
// 경로가 끊기지 않아야 한다."** 끊김은 두 곳에서 온다.
//
//   ① 생존   무너지는 자리에 채움이 하나도 없다 — 굶는다고 말해 놓고 먹을 것이 없는 종.
//            그런 종의 개체는 P 계층이 아무리 목적을 만들어도 채울 길이 없다.
//   ② 번식   늙는 종이 대를 잇는 자리를 밝히지 않았다 — 한 세대로 끝나는 종.
//            몸이 있으면 수명이 있고(S1-c), 수명이 있는데 대가 없으면 세계에서 사라진다.
//            거꾸로 늙지 않는 종(조직·국가·신)은 낳지 않는다 — 그들은 세워지고 흩어진다.
//
// 그리고 대 잇는 자리가 무너지는 자리와 **같을 수 있다.** 장막벌레 군집의 개체군이 그렇다 —
// 스무 마리 아래로 내려가면 지금의 군집이 끊기고 다음 세대도 없다. 하나의 뿌리가 둘을 떠받친다.
// 사람은 갈린다 — 굶는 것과 대가 끊기는 것은 다른 자리다.
//
// 조립 자체는 새 판정을 만들지 않는다. 찍어 낸 그래프는 D1 의 `checkGraph` 를 그대로 지나고,
// 거기서 나온 사유는 `broken-graph` 로 안고 옮긴다 — 판정자는 하나여야 두 답이 갈리지 않는다.

import { deterministicId, type Id } from '../v1/id.ts';
import { stateHash } from '../v1/hash.ts';
import { compareStrings, stableSort } from '../v1/stable-sort.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import type { Need } from '../s0/stake.ts';
import { ages, type LifeStage } from '../s1/lifecycle.ts';
import { instantiateNeeds, opensSlot, templateLabel, type NeedTemplate } from '../s1/needs.ts';
import { birthStage, type SpeciesArchetype } from '../s1/archetype.ts';
import {
  checkGraph,
  conditionSummary,
  graphIdOf,
  type DependencyEdge,
  type DependencyGraph,
  type DependencyNode,
  type GraphReport,
} from '../d1/index.ts';
import {
  checkRootSpecs,
  rootNodeFrom,
  slotKey,
  type RootService,
  type RootSpec,
  type SpeciesNeed,
} from './root.ts';
import {
  checkSupplySpecs,
  fillsRoot,
  supplyEdgeFrom,
  supplyNodeFrom,
  type GraphPlace,
  type SupplySpec,
} from './supply.ts';
import {
  violateBlueprint,
  type SpeciesGraphRef,
  type SpeciesGraphViolation,
} from './violation.ts';

/** 종이 물려주는 설계도 — 무엇으로 무너지고(S1), 그것을 무엇이 채우는가(D2). */
export interface SpeciesBlueprint {
  readonly speciesId: Id;
  /** 무너지는 자리마다 하나씩 */
  readonly roots: readonly RootSpec[];
  /** 대를 잇는 자리 — 늙는 종은 반드시, 늙지 않는 종은 없어야 한다 */
  readonly lineage: NeedTemplate | null;
  readonly supplies: readonly SupplySpec[];
}

/** 그래프를 찍어 낼 자리 — 누구로, 어느 몸으로, 어느 단계로. */
export interface GraphBirth extends GraphPlace {
  /** 적지 않으면 첫 단계. 늙지 않는 종은 무시된다 */
  readonly stage?: string | undefined;
}

/** 종 검사용 표본 — 개체 없이 종의 그래프를 세워 볼 때의 자리. */
export function specimenOf(archetype: SpeciesArchetype, stage?: string): GraphBirth {
  return {
    subjectId: deterministicId('subject', 'specimen', archetype.id),
    bodyId: archetype.body === null ? null : deterministicId('entity', 'body', archetype.id),
    stage,
  };
}

/**
 * 종이 무너지는 자리 전부 — 생존의 것과 대 잇는 것.
 * 대 잇는 자리가 무너지는 자리와 같으면 하나로 합쳐지고, 그 뿌리는 둘을 함께 떠받친다.
 */
export function speciesNeeds(
  archetype: SpeciesArchetype,
  blueprint: SpeciesBlueprint,
): readonly SpeciesNeed[] {
  const lineage = blueprint.lineage;
  const out: SpeciesNeed[] = archetype.baseNeeds.map((template) => ({
    template,
    serves:
      lineage !== null && slotKey(lineage.slot) === slotKey(template.slot)
        ? ('both' as RootService)
        : ('survival' as RootService),
  }));
  if (lineage === null) return out;
  if (out.some((need) => need.serves === 'both')) return out;
  return [...out, { template: lineage, serves: 'lineage' }];
}

/** 뿌리 하나가 세워진 결과 — 노드와 그것이 온 무너짐. */
interface RootBuild {
  readonly node: DependencyNode;
  readonly need: SpeciesNeed;
  /** 개체의 자리로 채워진 무너짐 */
  readonly instance: Need;
}

/** 뿌리들을 세운다 — 선언이 없는 무너짐은 건너뛴다(사유는 검사기가 남긴다). */
function buildRoots(
  archetype: SpeciesArchetype,
  blueprint: SpeciesBlueprint,
  where: GraphBirth,
  stage: LifeStage | null,
): readonly RootBuild[] {
  const needs = speciesNeeds(archetype, blueprint);
  const instances = instantiateNeeds(
    needs.map((need) => need.template),
    { subjectId: where.subjectId, bodyId: where.bodyId },
    stage,
  );
  const out: RootBuild[] = [];
  for (const [index, need] of needs.entries()) {
    const spec = blueprint.roots.find(
      (root) => slotKey(root.slot) === slotKey(need.template.slot),
    );
    const instance = instances[index];
    if (spec === undefined || instance === undefined) continue;
    out.push({
      node: rootNodeFrom(spec, need.template, instance, where.subjectId),
      need,
      instance,
    });
  }
  return out;
}

/**
 * 종 원형과 설계도에서 기본 의존 그래프를 찍어 낸다.
 * 같은 종·같은 자리·같은 단계면 언제나 같은 그래프다 (V1 태도 그대로).
 */
export function buildSpeciesGraph(
  archetype: SpeciesArchetype,
  blueprint: SpeciesBlueprint,
  where: GraphBirth,
): DependencyGraph {
  const stage = birthStage(archetype, where.stage);
  const roots = buildRoots(archetype, blueprint, where, stage);
  const supplyNodes = blueprint.supplies.map((spec) => ({
    spec,
    node: supplyNodeFrom(spec, where),
  }));

  const edges: DependencyEdge[] = [];
  for (const { spec, node } of supplyNodes) {
    for (const fill of spec.fills) {
      if (fill.kind === 'root') {
        const root = roots.find(
          (entry) => slotKey(entry.need.template.slot) === slotKey(fill.slot),
        );
        if (root === undefined) continue;
        edges.push(
          supplyEdgeFrom(
            root.node,
            node,
            spec,
            {
              // 뿌리에 걸린 시한은 종이 이미 말했다 — 단계의 대사는 S1 이 이미 나눴다.
              urgency: root.need.template.urgency,
              baseDelayTicks: root.instance.collapseAfterTicks,
            },
            null,
            where,
          ),
        );
        continue;
      }
      const parent = supplyNodes.find((entry) => entry.spec.label === fill.label);
      if (parent === undefined || parent.node.id === node.id) continue;
      edges.push(
        supplyEdgeFrom(
          parent.node,
          node,
          spec,
          {
            urgency: spec.urgency ?? 0,
            baseDelayTicks: spec.baseDelayTicks ?? 1,
          },
          stage,
          where,
        ),
      );
    }
  }

  const name = `${archetype.name} 의 기본 의존`;
  return {
    id: graphIdOf(where.subjectId, name),
    subjectId: where.subjectId,
    name,
    nodes: [...roots.map((root) => root.node), ...supplyNodes.map((entry) => entry.node)],
    edges,
    rootIds: roots.map((root) => root.node.id),
  };
}

/**
 * 그래프의 **모양** 해시 — 누구의 것인지를 지운 값.
 * 같은 종에서 태어난 둘은 ID 가 달라도 이 값이 같다: 종은 모양을 물려준다.
 */
export function graphShapeHash(graph: DependencyGraph): string {
  const label = (id: Id): string => graph.nodes.find((node) => node.id === id)?.label ?? id;
  const nodes = stableSort(
    graph.nodes.map(
      (node) =>
        `${node.kind}|${node.label}|${node.target?.name ?? ''}|${conditionSummary(node.condition)}`,
    ),
    compareStrings,
  );
  const edges = stableSort(
    graph.edges.map(
      (edge) =>
        `${label(edge.from)}|${label(edge.to)}|${edge.relation}|${String(edge.strength)}|${String(edge.urgency)}|${String(edge.substitutability)}|${String(edge.failureDelayTicks)}`,
    ),
    compareStrings,
  );
  const roots = stableSort(graph.rootIds.map(label), compareStrings);
  return stateHash({ nodes, edges, roots });
}

/** 뿌리 하나의 경로 판정 — 끊겼는가, 어디까지 뻗는가. */
export interface PathVerdict {
  readonly rootId: Id;
  readonly label: string;
  /** 어느 자리의 무너짐인가 */
  readonly slot: string;
  readonly serves: RootService;
  /** 이 뿌리를 곧바로 채우는 것의 수 */
  readonly supplied: number;
  /** 사슬이 몇 단계까지 뻗는가 (뿌리만 있으면 0) */
  readonly depth: number;
  /** 몇 틱 뒤에 무너지는가 — 이 단계의 몸으로 */
  readonly collapseAfterTicks: number;
  readonly unbroken: boolean;
}

/** 뿌리에서 간선을 따라 가장 깊은 곳까지의 단계 수. */
function depthFrom(rootId: Id, edges: readonly DependencyEdge[], seen: readonly Id[] = []): number {
  if (seen.includes(rootId)) return 0;
  const next = edges.filter((edge) => edge.from === rootId);
  if (next.length === 0) return 0;
  return (
    1 +
    Math.max(...next.map((edge) => depthFrom(edge.to, edges, [...seen, rootId])))
  );
}

/** 설계도 검사 결과 — 그래프와, 그 그래프가 종을 살게 하는가. */
export interface BlueprintReport {
  readonly speciesId: Id;
  readonly speciesName: string;
  readonly graph: DependencyGraph;
  /** D1 관문의 판정 — 판정자는 하나다 */
  readonly graphReport: GraphReport;
  /** 뿌리마다의 경로 판정 */
  readonly paths: readonly PathVerdict[];
  /** 대를 잇는 뿌리 (늙지 않는 종은 null) */
  readonly lineage: PathVerdict | null;
  readonly violations: readonly SpeciesGraphViolation[];
  /** 모양 해시 — 같은 종이면 개체가 달라도 같다 */
  readonly shapeHash: string;
  readonly complete: boolean;
}

/**
 * 종 하나가 살 수 있는 그래프를 물려주는가. 던지지 않는다 — 어긋남은 값으로 남는다.
 * @param where 적지 않으면 종 표본으로 세운다 (개체 없이 종만 검사할 때).
 */
export function checkBlueprint(
  archetype: SpeciesArchetype,
  blueprint: SpeciesBlueprint,
  where: GraphBirth = specimenOf(archetype),
  schema: StateSchema = STATE_SCHEMA,
): BlueprintReport {
  const species: SpeciesGraphRef = { speciesId: archetype.id, name: archetype.name };
  const violations: SpeciesGraphViolation[] = [];
  const needs = speciesNeeds(archetype, blueprint);

  if (blueprint.speciesId !== archetype.id) {
    violateBlueprint(
      violations,
      species,
      'bad-blueprint',
      archetype.name,
      '$.speciesId',
      `다른 종의 설계도다 — ${blueprint.speciesId}`,
    );
  }

  // ① 대 잇기 — 늙는 종은 밝혀야 하고, 늙지 않는 종은 낳지 않는다.
  const lineage = blueprint.lineage;
  if (ages(archetype.lifecycle) && lineage === null) {
    violateBlueprint(
      violations,
      species,
      'lineage-missing',
      archetype.name,
      '$.lineage',
      `${archetype.name} 은 늙는다(수명이 있다) — 대를 잇는 자리를 밝히지 않으면 한 세대로 끝난다. 죽지 않는 것만이 대 없이 선다`,
    );
  }
  if (!ages(archetype.lifecycle) && lineage !== null) {
    violateBlueprint(
      violations,
      species,
      'ageless-lineage',
      archetype.name,
      '$.lineage',
      `${archetype.name} 은 늙지 않는다 — 낳는 것이 아니라 세워지고 흩어진다 (S1-c). 대를 잇는 자리는 몸이 있는 종의 것이다`,
    );
  }
  if (lineage !== null && !opensSlot(archetype, lineage.slot, schema)) {
    violateBlueprint(
      violations,
      species,
      'off-species-lineage',
      templateLabel(lineage),
      '$.lineage.slot',
      `${archetype.name} 은 ${templateLabel(lineage)} 자리를 열지 않는다 — 종이 갖지 않은 자리로 대를 이을 수는 없다 (S1-d 와 같은 관문)`,
    );
  }

  // ② 뿌리와 채움의 선언.
  checkRootSpecs(species, blueprint.roots, needs, violations);
  checkSupplySpecs(species, blueprint.supplies, blueprint.roots, violations);

  // ③ 찍어 낸 그래프 — 판정은 D1 이 한다.
  const graph = buildSpeciesGraph(archetype, blueprint, where);
  const graphReport = checkGraph(graph, schema);
  for (const violation of graphReport.violations) {
    violateBlueprint(
      violations,
      species,
      'broken-graph',
      violation.label,
      violation.path,
      `찍어 낸 그래프가 D1 관문을 지나지 못한다 (${violation.rule}) — ${violation.message}`,
    );
  }

  // ④ 생존·번식 무단절 — 원문 D2 의 검증 조항.
  // 시한은 이 단계의 몸으로 다시 읽는다 — 채움이 없어도 무너지는 시각은 종이 이미 말했다.
  const instances = instantiateNeeds(
    needs.map((need) => need.template),
    { subjectId: where.subjectId, bodyId: where.bodyId },
    birthStage(archetype, where.stage),
  );
  const paths: PathVerdict[] = [];
  for (const [index, need] of needs.entries()) {
    const spec = blueprint.roots.find(
      (root) => slotKey(root.slot) === slotKey(need.template.slot),
    );
    if (spec === undefined) continue;
    const node = graph.nodes.find(
      (entry) => entry.kind === spec.kind && entry.label === spec.label,
    );
    if (node === undefined) continue;

    const supplied = graph.edges.filter((edge) => edge.from === node.id).length;
    const delay = instances[index]?.collapseAfterTicks ?? need.template.baseTicks;
    const verdict: PathVerdict = {
      rootId: node.id,
      label: node.label,
      slot: slotKey(need.template.slot),
      serves: need.serves,
      supplied,
      depth: depthFrom(node.id, graph.edges),
      collapseAfterTicks: delay,
      unbroken: supplied > 0,
    };
    paths.push(verdict);

    if (supplied > 0) continue;
    const lineageOnly = need.serves === 'lineage';
    violateBlueprint(
      violations,
      species,
      lineageOnly ? 'unsupplied-lineage' : 'unsupplied-need',
      node.label,
      '$.supplies',
      lineageOnly
        ? `${node.label} 을 채우는 것이 하나도 없다 — ${String(verdict.collapseAfterTicks)}틱 뒤에 대가 끊기는데 이을 방법이 그래프에 없다`
        : `${node.label} 을 채우는 것이 하나도 없다 — ${String(verdict.collapseAfterTicks)}틱 뒤에 무너지는데 채울 길이 그래프에 없다${need.serves === 'both' ? ' (이 자리는 대 잇기도 함께 떠받친다)' : ''}`,
    );
  }

  return {
    speciesId: archetype.id,
    speciesName: archetype.name,
    graph,
    graphReport,
    paths,
    lineage: paths.find((path) => path.serves !== 'survival') ?? null,
    violations,
    shapeHash: graphShapeHash(graph),
    complete: violations.length === 0 && graphReport.complete,
  };
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function blueprintVerdict(report: BlueprintReport): string {
  if (report.complete) {
    const lineage =
      report.lineage === null
        ? '대는 잇지 않는다(늙지 않는 종)'
        : `대는 ${report.lineage.label} 로 이어진다`;
    return `${report.speciesName} — 뿌리 ${String(report.paths.length)}개가 전부 채워지고 ${lineage} (노드 ${String(report.graph.nodes.length)} · 모양 ${report.shapeHash.slice(0, 8)})`;
  }
  const rules = [...new Set(report.violations.map((violation) => violation.rule))];
  return `${report.speciesName} 의 설계도가 막혔다 — ${rules.join(', ')}`;
}

/** 종 여럿을 한 번에 세울 때의 결과. */
export interface BlueprintBatch {
  readonly reports: readonly BlueprintReport[];
  readonly broken: readonly BlueprintReport[];
  readonly complete: boolean;
}

/** 종 목록을 관문에 통과시킨다 — 어긴 종의 그래프는 세계에 들어가지 않는다. */
export function checkBlueprints(
  entries: readonly { readonly archetype: SpeciesArchetype; readonly blueprint: SpeciesBlueprint }[],
  schema: StateSchema = STATE_SCHEMA,
): BlueprintBatch {
  const reports = entries.map((entry) =>
    checkBlueprint(entry.archetype, entry.blueprint, specimenOf(entry.archetype), schema),
  );
  const broken = reports.filter((report) => !report.complete);
  return { reports, broken, complete: entries.length > 0 && broken.length === 0 };
}
