// Master Graph Model — master/graph/*.yaml 과 constraints/DC-*.yaml 을 하나의 IR 로 읽는다.
//
// 이 파일은 아무것도 그리지 않는다. 읽기 · 정규화 · 무결성 검사 · 파생값 계산만 한다.
// 그리는 일은 mermaid.ts (정적 스냅샷) 와 html.ts (인터랙티브 뷰어) 가 나눠 맡는다.
//
// 읽기 전용 도구다 — master/ 의 어떤 파일도 이 코드가 수정하지 않는다.
// 관계의 원본은 노드 안의 필드다 (edges.yaml 은 중복 기록을 금지한다 — SCHEMA.md).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

export type NodeType =
  | 'world_state'
  | 'actor'
  | 'goal'
  | 'possibility'
  | 'capability'
  | 'knowledge'
  | 'belief';

export type Overlay = 'IMPLEMENTED' | 'PARTIAL' | 'MISSING';

/** part_of 소속 하나 — 이 조각이 어느 시스템의 어느 자리에 속하는가 */
export interface Membership {
  system: string;
  segment?: string;
  role?: string;
  source?: string;
}

/** part_of — 조각의 척추 정보. grounded=false 면 semantic 이 잠정이다 */
export interface PartOf {
  grounded: boolean;
  memberships: Membership[];
}

/** 노드 하나 — YAML 원문을 그대로 담되, 자주 쓰는 필드만 타입을 준다 */
export interface GraphNode {
  id: string;
  type: NodeType;
  /** 노드 종류마다 다른 본문 필드(statement / semantic / desired_state / perspective)를 하나로 모은 것 */
  text: string;
  overlay?: Overlay;
  partOf?: PartOf;
  constraints: string[];
  constraintEvaluation: Record<string, string>;
  /** YAML 원문 — 뷰어 상세 패널이 그대로 보여 준다 */
  raw: Record<string, unknown>;
  /** 이 노드를 정의한 파일 (진단 메시지용) */
  file: string;
}

/** 시스템 레지스트리 항목 (graph/systems.yaml MS-*) — part_of 가 가리키는 "전체" */
export interface SystemDef {
  id: string;
  name: string;
  source: string;
  status: string; // DEFINED | DRAFT | PLANNED
  semantic: string;
  /** 순서 있는 자리 — 첫 항목이 바닥. 순서가 없는 시스템은 빈 배열 */
  segments: { id: string; name: string }[];
}

/** 관계 하나 — 노드 필드에서 유도한다 */
export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  /** 옆에 적힌 주석 (근거 인용 — 있으면 뷰어가 보여 준다) */
  note?: string;
}

export type EdgeKind =
  | 'arises_from' // MW → MW   이 상태를 낳은 상위 세계 상태 — **세계의 인과 척추**
  | 'causes' // MW → MG   이 상태가 Goal 을 발생시킨다
  | 'changed_by' // MW → MP   이 상태를 바꾸는 Possibility
  | 'demands' // MW → MC   이곳을 감당하려면 갖춰야 하는 Capability
  | 'wants' // MA → MG
  | 'knows' // MA → MK
  | 'believes' // MA → MB
  | 'motivation' // MG → MG   상위 Goal
  | 'achieves' // MP → MG   (OR 갈래)
  | 'requires' // MP → MC/MK/MG/MW  (AND 요구)
  | 'supports' // MP → MG/MP
  | 'opposes' // MP → MG/MP
  | 'reveals' // MP → MK
  | 'creates_goal' // MP → MG
  | 'holder' // MK → MA
  | 'contradicts'; // MK → MW/MK

export interface Constraint {
  id: string;
  statement: string;
  rationale: string;
  scope: string[];
  status: string;
  supports: string[];
  conflictsWith: string[];
  raw: Record<string, unknown>;
}

/** Possibility 하나의 준비도 — 요구 Capability 중 세계에 이미 있는 것의 비율 */
export interface Readiness {
  implemented: number;
  partial: number;
  missing: number;
  total: number;
  /** IMPLEMENTED 1.0 · PARTIAL 0.5 로 계산한 0~1 값 — 어느 경로가 세계에 가장 가까운지 */
  score: number;
  /** 요구 Capability 를 아직 하나도 적지 않은 상태 — 0% 가 아니라 미기재(구멍)다 */
  unspecified: boolean;
  /** 아직 없는 요구 Capability — Frontier 후보의 원재료다 */
  blockers: string[];
}

/** 채워지지 않은 자리 — "구멍이 어디인가" 를 노드에 붙여 둔다 */
export interface Hole {
  nodeId: string;
  field: string;
  /** YAML 주석이 사유를 적어 두었으면 그것 */
  reason?: string;
}

export interface MasterGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  constraints: Map<string, Constraint>;
  /** 시스템 레지스트리 (graph/systems.yaml) — 없으면 빈 Map (part_of 검사도 꺼진다) */
  systems: Map<string, SystemDef>;
  readiness: Map<string, Readiness>;
  holes: Hole[];
  problems: Problem[];
  /** 노드가 걸린 Constraint 의 역인덱스 — DC 를 고르면 걸리는 노드가 나온다 */
  constrainedBy: Map<string, string[]>;
}

export interface Problem {
  severity: 'ERROR' | 'WARN';
  code: string;
  message: string;
}

/** 노드 종류별 본문 필드 — SCHEMA.md 가 정한 이름 */
const TEXT_FIELD: Record<string, string> = {
  world_state: 'statement',
  actor: 'perspective',
  goal: 'desired_state',
  possibility: 'meaningful_difference',
  capability: 'semantic',
  knowledge: 'statement',
  belief: 'statement',
};

/** "비어 있으면 그래프에 구멍" 인 필드 — SCHEMA.md 의 인과 필드들 */
const HOLE_FIELDS: Record<string, string[]> = {
  goal: ['motivation', 'caused_by', 'belief_context'],
  world_state: ['causes', 'changed_by'],
  actor: ['wants', 'knows', 'believes'],
  possibility: ['achieves'],
  capability: [], // required_by / demanded_by 는 아래 ORPHAN_CAPABILITY 가 함께 본다
};

/** `MW-…` `MG-…` 처럼 Node ID 형태인가 — 아니면 자유 서술이다 */
export function isNodeId(v: string): boolean {
  return /^[A-Z]{2}-[A-Z0-9-]+$/.test(v.trim());
}

/** requires 중 ID 를 담는 버킷 — 나머지(relationship · resource)는 자유 서술이라 엣지가 아니다 */
export const ID_REQUIRE_BUCKETS = ['goals', 'capabilities', 'knowledge', 'world_state'] as const;

/** requires 중 자유 서술 버킷 — 그림에서는 노드가 아니라 재료 칩으로 붙는다 */
export const FREE_REQUIRE_BUCKETS = ['relationship', 'resource'] as const;

const asList = (v: unknown): string[] => {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x) => typeof x === 'string') as string[];
  if (typeof v === 'string') return [v];
  return [];
};

const flatten = (v: string): string => v.replace(/\s+/g, ' ').trim();

/** master/ 루트를 받아 Graph 를 통째로 읽는다 */
export function loadMasterGraph(masterDir: string): MasterGraph {
  const nodes = new Map<string, GraphNode>();
  const problems: Problem[] = [];
  const graphDir = join(masterDir, 'graph');

  for (const file of readdirSync(graphDir).filter((f) => f.endsWith('.yaml')).sort()) {
    const doc = parseYaml(readFileSync(join(graphDir, file), 'utf8')) as
      | { nodes?: unknown[]; edges?: unknown[] }
      | null;
    for (const entry of (doc?.nodes ?? []) as Record<string, unknown>[]) {
      const id = String(entry.id ?? '');
      const type = String(entry.type ?? '') as NodeType;
      if (!id) {
        problems.push({ severity: 'ERROR', code: 'NO_ID', message: `${file}: id 없는 노드` });
        continue;
      }
      if (nodes.has(id)) {
        problems.push({ severity: 'ERROR', code: 'DUPLICATE_ID', message: `${id} 가 중복 정의되었다` });
        continue;
      }
      const textField = TEXT_FIELD[type];
      nodes.set(id, {
        id,
        type,
        text: flatten(String((textField && entry[textField]) ?? '')),
        overlay: entry.overlay as Overlay | undefined,
        partOf: parsePartOf(entry.part_of),
        constraints: asList(entry.constraints),
        constraintEvaluation: (entry.constraint_evaluation as Record<string, string>) ?? {},
        raw: entry,
        file,
      });
    }
    // edges.yaml 에 직접 적힌 관계도 받는다 (현재는 비어 있지만 형식상 허용된다)
    for (const e of (doc?.edges ?? []) as Record<string, unknown>[]) {
      if (e.from && e.to) {
        problems.push({
          severity: 'WARN',
          code: 'EXPLICIT_EDGE',
          message: `edges.yaml 의 명시 엣지 ${String(e.from)}→${String(e.to)} — 노드 필드와 중복인지 확인할 것`,
        });
      }
    }
  }

  const constraints = loadConstraints(join(masterDir, 'constraints'));
  const systems = loadSystems(graphDir);
  const edges = deriveEdges(nodes);
  const readiness = computeReadiness(nodes);
  const holes = findHoles(nodes);
  problems.push(...checkIntegrity(nodes, edges, constraints, systems));

  const constrainedBy = new Map<string, string[]>();
  for (const node of nodes.values()) {
    for (const dc of node.constraints) {
      constrainedBy.set(dc, [...(constrainedBy.get(dc) ?? []), node.id]);
    }
  }

  return { nodes, edges, constraints, systems, readiness, holes, problems, constrainedBy };
}

/** part_of 필드를 정규화한다 — 형태가 아니면 undefined (검사는 checkIntegrity 가 한다) */
function parsePartOf(v: unknown): PartOf | undefined {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const memberships: Membership[] = [];
  for (const m of Array.isArray(o.memberships) ? o.memberships : []) {
    if (m == null || typeof m !== 'object') continue;
    const mm = m as Record<string, unknown>;
    if (!mm.system) continue;
    memberships.push({
      system: String(mm.system),
      segment: mm.segment != null ? String(mm.segment) : undefined,
      role: mm.role != null ? flatten(String(mm.role)) : undefined,
      source: mm.source != null ? flatten(String(mm.source)) : undefined,
    });
  }
  return { grounded: o.grounded === true, memberships };
}

/** graph/systems.yaml — 없는 팩에서는 빈 Map 을 돌려주고 part_of 검사도 꺼진다 */
function loadSystems(graphDir: string): Map<string, SystemDef> {
  const out = new Map<string, SystemDef>();
  let doc: Record<string, unknown> | null = null;
  try {
    doc = parseYaml(readFileSync(join(graphDir, 'systems.yaml'), 'utf8')) as Record<string, unknown>;
  } catch {
    return out;
  }
  for (const s of Array.isArray(doc?.systems) ? (doc.systems as Record<string, unknown>[]) : []) {
    const id = String(s.id ?? '');
    if (!id) continue;
    const segments = (Array.isArray(s.segments) ? (s.segments as Record<string, unknown>[]) : []).map((g) => ({
      id: String(g.id ?? ''),
      name: String(g.name ?? g.id ?? ''),
    }));
    out.set(id, {
      id,
      name: String(s.name ?? id),
      source: flatten(String(s.source ?? '')),
      status: String(s.status ?? 'DEFINED'),
      semantic: flatten(String(s.semantic ?? '')),
      segments,
    });
  }
  return out;
}

function loadConstraints(dir: string): Map<string, Constraint> {
  const out = new Map<string, Constraint>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) {
    const d = (parseYaml(readFileSync(join(dir, file), 'utf8')) ?? {}) as Record<string, unknown>;
    const id = String(d.id ?? '');
    if (!id) continue;
    const relations = (d.relations ?? {}) as Record<string, unknown>;
    out.set(id, {
      id,
      statement: flatten(String(d.statement ?? '')),
      rationale: flatten(String(d.rationale ?? '')),
      scope: asList(d.scope),
      status: String(d.status ?? ''),
      supports: asList(relations.supports),
      conflictsWith: asList(relations.conflicts_with),
      raw: d,
    });
  }
  return out;
}

/** 관계는 노드 필드에서만 나온다 — 같은 관계를 양쪽에서 두 번 만들지 않는다 */
function deriveEdges(nodes: Map<string, GraphNode>): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const push = (from: string, to: string, kind: EdgeKind) => edges.push({ from, to, kind });

  for (const node of nodes.values()) {
    const r = node.raw;
    switch (node.type) {
      case 'world_state':
        // arises_from 은 **부모를 가리킨다** — 간선은 낳은 쪽에서 낳아진 쪽으로 그린다.
        // SCHEMA.md 가 이것을 "세계의 인과 척추" 라 부르는데도 오래 간선이 아니었다.
        // 그동안 척추는 world-state.yaml 머리의 손으로 그린 ASCII 주석으로만 있었고,
        // 그래서 GRAPH.md 를 읽는 사람은 세계의 인과를 볼 수 없었다.
        for (const t of asList(r.arises_from)) push(t, node.id, 'arises_from');
        for (const t of asList(r.causes)) push(node.id, t, 'causes');
        for (const t of asList(r.changed_by)) push(node.id, t, 'changed_by');
        for (const t of asList(r.demands)) push(node.id, t, 'demands');
        break;
      case 'actor':
        for (const t of asList(r.wants)) push(node.id, t, 'wants');
        for (const t of asList(r.knows)) push(node.id, t, 'knows');
        for (const t of asList(r.believes)) push(node.id, t, 'believes');
        break;
      case 'goal':
        // motivation 은 "상위 Goal 또는 서술" 이다 (SCHEMA.md) — ID 형태만 관계가 된다
        for (const t of asList(r.motivation)) if (isNodeId(t)) push(node.id, t, 'motivation');
        // caused_by 는 MW 쪽 causes 와 같은 관계다 — 한 번만 만든다 (아래에서 보강)
        for (const t of asList(r.caused_by)) {
          const already = edges.some((e) => e.from === t && e.to === node.id && e.kind === 'causes');
          if (!already) push(t, node.id, 'causes');
        }
        break;
      case 'possibility': {
        for (const t of asList(r.achieves)) push(node.id, t, 'achieves');
        const req = (r.requires ?? {}) as Record<string, unknown>;
        // ID 를 담는 버킷만 관계가 된다 — relationship · resource 는 자유 서술이다
        // (SCHEMA.md 의 requires 예시 · `resource: [축적된 CP]`)
        for (const bucket of ID_REQUIRE_BUCKETS) {
          for (const t of asList(req[bucket])) push(node.id, t, 'requires');
        }
        for (const t of asList(r.supports)) push(node.id, t, 'supports');
        for (const t of asList(r.opposes)) push(node.id, t, 'opposes');
        for (const t of asList(r.reveals)) push(node.id, t, 'reveals');
        for (const t of asList(r.creates_goal)) push(node.id, t, 'creates_goal');
        break;
      }
      case 'knowledge':
      case 'belief':
        for (const t of asList(r.holder)) push(node.id, t, 'holder');
        for (const t of asList(r.contradicts)) push(node.id, t, 'contradicts');
        break;
      case 'capability':
        // required_by 는 Possibility 의 requires 와 같은 관계다 — 여기서 만들지 않는다.
        // 무결성 검사가 양쪽 일치를 강제한다.
        break;
    }
  }
  return edges;
}

/** 요구 Capability 의 overlay 로 각 Possibility 가 세계에 얼마나 가까운지 계산한다 */
function computeReadiness(nodes: Map<string, GraphNode>): Map<string, Readiness> {
  const out = new Map<string, Readiness>();
  for (const node of nodes.values()) {
    if (node.type !== 'possibility') continue;
    const caps = asList(((node.raw.requires ?? {}) as Record<string, unknown>).capabilities);
    let implemented = 0;
    let partial = 0;
    let missing = 0;
    const blockers: string[] = [];
    for (const capId of caps) {
      const overlay = nodes.get(capId)?.overlay;
      if (overlay === 'IMPLEMENTED') implemented += 1;
      else if (overlay === 'PARTIAL') {
        partial += 1;
        blockers.push(capId);
      } else {
        missing += 1;
        blockers.push(capId);
      }
    }
    const total = caps.length;
    out.set(node.id, {
      implemented,
      partial,
      missing,
      total,
      score: total === 0 ? 0 : (implemented + partial * 0.5) / total,
      unspecified: total === 0,
      blockers,
    });
  }
  return out;
}

/** 빈 인과 필드를 구멍으로 수집한다 — 지어내지 않은 자리를 그림이 말하게 한다 */
function findHoles(nodes: Map<string, GraphNode>): Hole[] {
  const holes: Hole[] = [];
  for (const node of nodes.values()) {
    for (const field of HOLE_FIELDS[node.type] ?? []) {
      const v = node.raw[field];
      const empty = v == null || (Array.isArray(v) && v.length === 0);
      if (empty) holes.push({ nodeId: node.id, field });
    }
    if (node.type === 'possibility') {
      const req = (node.raw.requires ?? {}) as Record<string, unknown>;
      if (asList(req.capabilities).length === 0) {
        holes.push({ nodeId: node.id, field: 'requires.capabilities' });
      }
    }
  }
  return holes;
}

/** 시각화가 겸하는 린터 — 그림을 그리려면 어차피 참조를 전부 훑어야 한다 */
function checkIntegrity(
  nodes: Map<string, GraphNode>,
  edges: GraphEdge[],
  constraints: Map<string, Constraint>,
  systems: Map<string, SystemDef>,
): Problem[] {
  const problems: Problem[] = [];

  // ⓪ part_of ↔ 시스템 레지스트리 정합 — 레지스트리가 있는 팩에서만 검사한다
  if (systems.size > 0) {
    for (const node of nodes.values()) {
      if (node.type !== 'capability') continue;
      if (!node.partOf) {
        problems.push({
          severity: 'WARN',
          code: 'MISSING_PART_OF',
          message: `${node.id} 에 part_of 가 없다 — 어느 시스템의 조각인지 보이지 않는다`,
        });
        continue;
      }
      if (node.partOf.memberships.length === 0) {
        problems.push({
          severity: 'WARN',
          code: 'EMPTY_MEMBERSHIPS',
          message: `${node.id}.part_of.memberships 가 비어 있다`,
        });
      }
      for (const m of node.partOf.memberships) {
        const sys = systems.get(m.system);
        if (!sys) {
          problems.push({
            severity: 'ERROR',
            code: 'UNKNOWN_SYSTEM',
            message: `${node.id} 가 레지스트리에 없는 시스템 ${m.system} 를 가리킨다 (graph/systems.yaml)`,
          });
          continue;
        }
        if (m.segment && !sys.segments.some((g) => g.id === m.segment)) {
          problems.push({
            severity: 'ERROR',
            code: 'UNKNOWN_SEGMENT',
            message: `${node.id} 가 ${m.system} 에 없는 자리 ${m.segment} 를 가리킨다`,
          });
        }
      }
    }
  }

  // ① 존재하지 않는 노드를 가리키는 참조
  for (const e of edges) {
    if (!nodes.has(e.to)) {
      problems.push({
        severity: 'ERROR',
        code: 'DANGLING_REF',
        message: `${e.from} --${e.kind}--> ${e.to} — ${e.to} 가 정의되지 않았다`,
      });
    }
  }

  // ①-b demands ↔ demanded_by 양방향 일치 (SCHEMA.md — requires↔required_by 와 같은 쌍)
  for (const node of nodes.values()) {
    if (node.type === 'world_state') {
      for (const capId of asList(node.raw.demands)) {
        const cap = nodes.get(capId);
        if (cap && !asList(cap.raw.demanded_by).includes(node.id)) {
          problems.push({
            severity: 'ERROR',
            code: 'ASYMMETRIC_DEMANDS',
            message: `${node.id} 가 ${capId} 를 요구하는데 ${capId}.demanded_by 에 ${node.id} 가 없다`,
          });
        }
      }
    }
    if (node.type === 'capability') {
      for (const wId of asList(node.raw.demanded_by)) {
        const w = nodes.get(wId);
        if (w && !asList(w.raw.demands).includes(node.id)) {
          problems.push({
            severity: 'ERROR',
            code: 'ASYMMETRIC_DEMANDS',
            message: `${node.id}.demanded_by 가 ${wId} 를 적었는데 ${wId}.demands 에 ${node.id} 가 없다`,
          });
        }
      }
    }
  }

  // ② requires ↔ required_by 양방향 일치 (SCHEMA.md 가 양쪽에 적게 한 유일한 관계)
  for (const node of nodes.values()) {
    if (node.type === 'possibility') {
      const caps = asList(((node.raw.requires ?? {}) as Record<string, unknown>).capabilities);
      for (const capId of caps) {
        const cap = nodes.get(capId);
        if (cap && !asList(cap.raw.required_by).includes(node.id)) {
          problems.push({
            severity: 'ERROR',
            code: 'ASYMMETRIC_REQUIRES',
            message: `${node.id} 가 ${capId} 를 요구하는데 ${capId}.required_by 에 ${node.id} 가 없다`,
          });
        }
      }
    }
    if (node.type === 'capability') {
      for (const pId of asList(node.raw.required_by)) {
        const p = nodes.get(pId);
        if (p) {
          const caps = asList(((p.raw.requires ?? {}) as Record<string, unknown>).capabilities);
          if (!caps.includes(node.id)) {
            problems.push({
              severity: 'ERROR',
              code: 'ASYMMETRIC_REQUIRED_BY',
              message: `${node.id}.required_by 가 ${pId} 를 적었는데 ${pId}.requires.capabilities 에 ${node.id} 가 없다`,
            });
          }
        }
      }
    }
  }

  // ③ 존재하지 않는 Constraint 참조 · 평가 누락
  for (const node of nodes.values()) {
    for (const dc of node.constraints) {
      if (!constraints.has(dc)) {
        problems.push({
          severity: 'ERROR',
          code: 'UNKNOWN_CONSTRAINT',
          message: `${node.id} 가 없는 Constraint ${dc} 를 가리킨다`,
        });
      }
      if (!(dc in node.constraintEvaluation)) {
        problems.push({
          severity: 'WARN',
          code: 'UNEVALUATED_CONSTRAINT',
          message: `${node.id} 가 ${dc} 아래 있는데 constraint_evaluation 에 판정이 없다`,
        });
      }
    }
    for (const dc of Object.keys(node.constraintEvaluation)) {
      if (!node.constraints.includes(dc)) {
        problems.push({
          severity: 'WARN',
          code: 'ORPHAN_EVALUATION',
          message: `${node.id} 가 constraints 에 없는 ${dc} 를 평가했다`,
        });
      }
    }
  }

  // 걸린 노드가 0 인 Constraint 는 문제로 올리지 않는다 — DC-GROWTH-* 는 growth/ 를,
  // GLOBAL Scope 는 World/View 경계를 규율한다. graph/ 노드에 안 걸리는 것이 정상이다.
  // 그 수는 GRAPH.md 표와 뷰어 렌즈 목록이 그대로 보여 준다.

  // ④ Constraint 사이 참조
  for (const c of constraints.values()) {
    for (const t of [...c.supports, ...c.conflictsWith]) {
      if (!constraints.has(t)) {
        problems.push({
          severity: 'ERROR',
          code: 'DANGLING_CONSTRAINT_REF',
          message: `${c.id} 가 없는 Constraint ${t} 를 가리킨다`,
        });
      }
    }
  }

  // ⑤ 아무 Goal 도 달성하지 않는 Possibility · 아무도 요구하지 않는 Capability
  for (const node of nodes.values()) {
    if (node.type === 'possibility' && asList(node.raw.achieves).length === 0) {
      problems.push({
        severity: 'WARN',
        code: 'ORPHAN_POSSIBILITY',
        message: `${node.id} 가 어떤 Goal 도 achieves 하지 않는다`,
      });
    }
    if (
      node.type === 'capability' &&
      asList(node.raw.required_by).length === 0 &&
      asList(node.raw.demanded_by).length === 0
    ) {
      // 방법이 요구하거나(required_by) 장소가 요구하거나(demanded_by) 둘 중 하나는 있어야 한다.
      // 둘 다 비면 아무도 필요로 하지 않는 능력이다 (SCHEMA.md · DC-GROWTH-NEED-FROM-POSSIBILITY).
      problems.push({
        severity: 'WARN',
        code: 'ORPHAN_CAPABILITY',
        message: `${node.id} 를 요구하는 Possibility 도 장소도 없다 — 왜 필요한지 경로가 설명하지 못한다`,
      });
    }
  }

  return problems;
}

/** 세로 층 — 인과가 왼쪽에서 오른쪽으로 흐른다 */
export const LAYERS: { key: string; label: string; types: NodeType[] }[] = [
  { key: 'world', label: 'WORLD STATE', types: ['world_state'] },
  { key: 'actor', label: 'ACTOR', types: ['actor'] },
  { key: 'goal', label: 'GOAL', types: ['goal'] },
  { key: 'possibility', label: 'POSSIBILITY (OR)', types: ['possibility'] },
  { key: 'capability', label: 'CAPABILITY (AND)', types: ['capability'] },
  { key: 'knowledge', label: 'KNOWLEDGE', types: ['knowledge', 'belief'] },
];

export function layerOf(type: NodeType): string {
  return LAYERS.find((l) => l.types.includes(type))?.key ?? 'other';
}
