// D3-c 전환 검사 — 원문 D3 의 검증 조항이 코드가 되는 자리.
//
//   "새 능력이 의존성을 완전히 제거하는 것이 아니라 다른 비용이나 의존 대상으로 전환되는지 확인한다."
//
// 이 한 문장이 D3 를 D2 와 갈라 놓는다. D2 는 "이 종이 살 수 있는가" 를 물었고, D3 는
// **"이 개체가 공짜로 벗어났는가"** 를 묻는다. 벗어남에는 언제나 장부가 따라야 한다:
//
//   덜어 낸 무게(약화·끊음의 강도 합) ≤ 새로 선 무게(더한 채움의 강도 합)
//
// 그리고 능력이 유래일 때는 한 가지가 더 붙는다. **새 의존은 그 능력이 치르는 대가의 자리여야
// 한다.** 붉은 장막이 의념을 태워 허기를 대신한다면, 새로 서는 의존은 의념(psychic.energy)에
// 걸려야 한다 — 아무 자리에나 걸면 그것은 대가가 아니라 그냥 다른 이야기다.
// (O0 `verifiable-cost` 는 능력이 정의될 때 대가를 요구한다. D3 는 그 대가가 **그래프에 실제로
// 서는지**를 본다 — 같은 결의 서로 다른 관문이다.)
//
// 마지막으로 무단절은 여전히 지켜진다. 변형 뒤에도 뿌리마다 채움이 하나는 남아야 한다 —
// 전환을 허용한다는 것이 굶어 죽는 개체를 허용한다는 뜻은 아니다 (D2 의 조항이 여기서도 산다).

import type { Id } from '../v1/id.ts';
import type { Definition } from '../o0/definition.ts';
import { STATE_SCHEMA, type StateSchema } from '../o2/schema.ts';
import { abilityOf } from '../s0/subject.ts';
import type { LifeStage } from '../s1/lifecycle.ts';
import type { SubjectInstance } from '../s3/instance.ts';
import {
  checkGraph,
  diffGraphs,
  graphHash,
  type DependencyGraph,
  type GraphDiff,
  type GraphReport,
} from '../d1/index.ts';
import { slotKey } from '../d2/index.ts';
import {
  checkPersonalBase,
  personalizeRoots,
  personalRef,
  type RootRetune,
} from './personal.ts';
import {
  applyVariation,
  checkVariations,
  edgeOfEdit,
  hasOrigin,
  originLabel,
  variationsFor,
  type VariationSpec,
} from './variation.ts';
import { violatePersonal, type PersonalViolation } from './violation.ts';

/** 전환 장부 한 줄 — 무엇을 덜어 내고 무엇을 세웠는가. */
export interface ConversionEntry {
  readonly variationId: string;
  readonly name: string;
  readonly origin: string;
  /** 덜어 낸 무게의 합 */
  readonly lost: number;
  /** 새로 선 무게의 합 */
  readonly gained: number;
  /** 무엇에서 덜어 냈는가 (`겨울 식량 0.95→0.45`) */
  readonly lostFrom: readonly string[];
  /** 무엇이 새로 섰는가 (`의념의 샘 0.6`) */
  readonly gainedTo: readonly string[];
  /** 능력이 유래면 그 능력이 치르는 자리들 */
  readonly costSlots: readonly string[];
  /** 새 의존이 그 대가의 자리에 걸렸는가 (능력 유래일 때만 뜻이 있다) */
  readonly onCostSlot: boolean;
  /** 덜어 낸 것이 있는가 — 없으면 이 변형은 더하기만 한 것이다 */
  readonly converts: boolean;
}

/** 수치 흔들림의 허용 오차 — 소수 합의 부동소수 오차만 눈감는다. */
const EPSILON = 1e-9;

/** 변형 하나의 장부를 센다. */
export function ledgerOf(
  variation: VariationSpec,
  graph: DependencyGraph,
  definitions: readonly Definition[],
): ConversionEntry {
  const lostFrom: string[] = [];
  const gainedTo: string[] = [];
  const addedSlots: string[] = [];
  let lost = 0;
  let gained = 0;

  for (const edit of variation.edits) {
    if (edit.kind === 'add') {
      gained += edit.supply.strength;
      gainedTo.push(`${edit.supply.label} ${String(edit.supply.strength)}`);
      if (edit.supply.condition.kind === 'slot') {
        addedSlots.push(slotKey(edit.supply.condition.slot));
      }
      continue;
    }
    const edge = edgeOfEdit(graph, edit);
    if (edge === null) continue;
    if (edit.kind === 'drop') {
      lost += edge.strength;
      lostFrom.push(`${edit.to} ${String(edge.strength)}→끊김`);
      continue;
    }
    lost += Math.max(0, edge.strength - edit.strength);
    lostFrom.push(`${edit.to} ${String(edge.strength)}→${String(edit.strength)}`);
  }

  const ability =
    variation.origin.kind === 'capability'
      ? abilityOf(variation.origin.abilityId, definitions)
      : null;
  const costSlots = (ability?.costs ?? []).map((cost) => slotKey(cost));

  return {
    variationId: variation.id,
    name: variation.name,
    origin: originLabel(variation.origin),
    lost,
    gained,
    lostFrom,
    gainedTo,
    costSlots,
    onCostSlot: costSlots.some((slot) => addedSlots.includes(slot)),
    converts: lost > 0,
  };
}

/** 전환이 성립하는가 — 덜어 낸 만큼 다른 것이 섰는가. */
export function checkConversion(
  instance: SubjectInstance,
  variation: VariationSpec,
  entry: ConversionEntry,
  path: string,
  out: PersonalViolation[],
): void {
  if (!entry.converts) return;
  const subject = personalRef(instance);
  const at = variation.name === '' ? variation.id : variation.name;

  if (entry.gained <= 0) {
    violatePersonal(
      out,
      subject,
      'free-conversion',
      at,
      `${path}.edits`,
      `${entry.lostFrom.join(' · ')} 만큼 덜어 내고 아무 의존도 세우지 않았다 — 의존은 사라지지 않고 옮겨 갈 뿐이다 (원문 D3: 제거가 아니라 전환)`,
    );
    return;
  }
  if (entry.gained + EPSILON < entry.lost) {
    violatePersonal(
      out,
      subject,
      'light-conversion',
      at,
      `${path}.edits`,
      `덜어 낸 무게 ${entry.lost.toFixed(2)} 보다 새로 선 무게 ${entry.gained.toFixed(2)} 가 가볍다 — 남는 장사는 세계에 없다`,
    );
    return;
  }
  if (variation.origin.kind !== 'capability') return;
  if (entry.costSlots.length === 0) {
    violatePersonal(
      out,
      subject,
      'costless-conversion',
      at,
      `${path}.origin`,
      '대가를 치르지 않는 능력이 의존을 덜어 냈다 — 그 능력으로는 아무것도 갈아탈 수 없다 (O0 verifiable-cost 와 같은 결)',
    );
    return;
  }
  if (!entry.onCostSlot) {
    violatePersonal(
      out,
      subject,
      'costless-conversion',
      at,
      `${path}.edits`,
      `새로 선 의존이 그 능력이 치르는 자리(${entry.costSlots.join(' · ')})에 걸리지 않는다 — 대가가 아닌 것은 전환이 아니라 다른 이야기다`,
    );
  }
}

/** 개인화 결과 — 기본 그래프와 이 개체의 그래프, 그리고 그 사이의 장부. */
export interface PersonalReport {
  readonly subjectId: Id;
  readonly name: string;
  readonly base: DependencyGraph;
  readonly graph: DependencyGraph;
  /** 뿌리 간선이 개체의 Need 로 다시 읽힌 자국 */
  readonly retunes: readonly RootRetune[];
  /** 이 개체에게 실제로 걸린 변형 */
  readonly applied: readonly VariationSpec[];
  readonly conversions: readonly ConversionEntry[];
  readonly diff: GraphDiff;
  readonly graphReport: GraphReport;
  readonly violations: readonly PersonalViolation[];
  readonly complete: boolean;
}

/** 개인화에 필요한 곁가지. */
export interface PersonalizeOptions {
  /** 능력의 대가를 읽을 세계의 정의들 */
  readonly definitions?: readonly Definition[];
  /** 지금 어느 단계인가 — 더해지는 사슬의 시한을 나눈다. 뿌리 간선은 개체의 Need 가 이미 나눴다 */
  readonly stage?: LifeStage | null;
  readonly schema?: StateSchema;
}

/**
 * 종의 그래프를 이 개체의 그래프로 만든다.
 * ① 뿌리를 개체의 Need 로 다시 읽고 ② 걸린 변형을 적용하고 ③ 전환 장부를 검사한다.
 *
 * `variations` 는 **이 개체에 걸린다고 주장된 목록**이다 — 유래를 갖지 않은 것이 섞여 있으면
 * `orphan-variation` 으로 막힌다. 세계의 변형 전부에서 고르려면 `personalizeFromWorld` 를 쓴다.
 * 던지지 않는다 — 어긋남은 값으로 남는다.
 */
export function personalizeGraph(
  base: DependencyGraph,
  instance: SubjectInstance,
  variations: readonly VariationSpec[],
  options: PersonalizeOptions = {},
): PersonalReport {
  const definitions = options.definitions ?? [];
  const schema = options.schema ?? STATE_SCHEMA;
  const violations: PersonalViolation[] = [];
  const subject = personalRef(instance);

  checkPersonalBase(base, instance, violations);

  const personalized = personalizeRoots(base, instance);
  const mine = variationsFor(instance, variations);

  // 유래를 갖지 않은 변형도 사유를 남긴다 — 손으로 골라 넘긴 목록이 잘못된 경우다.
  for (const [index, variation] of variations.entries()) {
    if (hasOrigin(instance, variation.origin)) continue;
    violatePersonal(
      violations,
      subject,
      'orphan-variation',
      variation.name === '' ? variation.id : variation.name,
      `$.variations[${String(index)}].origin`,
      `${instance.name} 은 이 변형의 유래(${originLabel(variation.origin)})를 갖지 않는다 — 갖지 않은 것으로 그래프를 바꿀 수는 없다`,
    );
  }

  let graph = personalized.graph;
  const conversions: ConversionEntry[] = [];

  for (const variation of mine) {
    const index = variations.indexOf(variation);
    const path = `$.variations[${String(index)}]`;

    // 검사는 적용 전 그래프에서 한다 — 가리키는 것이 그때 실재했는가를 보기 위해.
    checkVariationShape(instance, variation, graph, path, violations);
    const entry = ledgerOf(variation, graph, definitions);
    conversions.push(entry);
    checkConversion(instance, variation, entry, path, violations);

    graph = applyVariation(graph, variation, instance, options.stage ?? null);
  }

  // 전환을 허용한다고 굶어 죽는 개체를 허용하는 것은 아니다 (D2 의 무단절 조항).
  for (const rootId of graph.rootIds) {
    if (graph.edges.some((edge) => edge.from === rootId)) continue;
    const node = graph.nodes.find((entry) => entry.id === rootId);
    violatePersonal(
      violations,
      subject,
      'severed-need',
      node?.label ?? rootId,
      '$.variations',
      `변형 뒤 ${node?.label ?? rootId} 을 채우는 것이 하나도 남지 않았다 — 갈아탄 것이 아니라 끊어 낸 것이다`,
    );
  }

  const graphReport = checkGraph(graph, schema);
  for (const violation of graphReport.violations) {
    violatePersonal(
      violations,
      subject,
      'broken-graph',
      violation.label,
      violation.path,
      `개인 그래프가 D1 관문을 지나지 못한다 (${violation.rule}) — ${violation.message}`,
    );
  }

  return {
    subjectId: instance.id,
    name: instance.name,
    base,
    graph,
    retunes: personalized.retunes,
    applied: mine,
    conversions,
    diff: diffGraphs(base, graph),
    graphReport,
    violations,
    complete: violations.length === 0 && graphReport.complete,
  };
}

/**
 * 변형 하나의 서식 검사 — D3-b 의 검사기를 한 변형에 대해 부른다.
 * 목록으로 부르면 경로가 `$.variations[0]` 으로 고정되므로 실제 순번으로 고쳐 싣는다 —
 * 어디를 고쳐야 하는지가 흐려지지 않게.
 */
function checkVariationShape(
  instance: SubjectInstance,
  variation: VariationSpec,
  graph: DependencyGraph,
  path: string,
  out: PersonalViolation[],
): void {
  const local: PersonalViolation[] = [];
  checkVariations(instance, [variation], graph, local);
  for (const violation of local) {
    out.push({ ...violation, path: violation.path.replace('$.variations[0]', path) });
  }
}

/**
 * 세계에 선언된 변형 전부에서 이 개체의 것만 골라 개인화한다.
 * 고르는 일과 검사하는 일을 나눠 둔다 — 고르지 않고 넘긴 목록은 주장으로 보고 사유를 남긴다.
 */
export function personalizeFromWorld(
  base: DependencyGraph,
  instance: SubjectInstance,
  world: readonly VariationSpec[],
  options: PersonalizeOptions = {},
): PersonalReport {
  return personalizeGraph(base, instance, variationsFor(instance, world), options);
}

/** 판정을 한 줄로 접는다 — 터미널·배지용. */
export function personalVerdict(report: PersonalReport): string {
  if (!report.complete) {
    const rules = [...new Set(report.violations.map((violation) => violation.rule))];
    return `${report.name} 의 그래프가 막혔다 — ${rules.join(', ')}`;
  }
  const moved = report.retunes.filter((retune) => retune.moved).length;
  const converted = report.conversions.filter((entry) => entry.converts).length;
  return `${report.name} — 변형 ${String(report.applied.length)}개 · 다시 읽은 뿌리 ${String(moved)}개 · 전환 ${String(converted)}건 (노드 ${String(report.graph.nodes.length)} · ${graphHash(report.graph).slice(0, 8)})`;
}
