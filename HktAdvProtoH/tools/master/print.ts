// Master Intent Graph Print — 설계 그래프를 한 화면에 관찰하고 정합을 검사한다.
//
//   npm run master              Overlay(Capability 구현 상태) + 그래프 통계 + Frontier 재료를 출력한다
//   npm run master:check        참조 무결성과 Quality Gate 만 검사한다 — 위반이 있으면 종료 코드 1
//
// 코드는 아무것도 바꾸지 않는다 — 읽기 전용 관찰 도구다.
// 정책은 design/Master-Intent-Graph-Policy.md, 파일 규격은
// .claude/skills/advprotoh-master/references/graph-format.md 가 단일 출처다.

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parse } from 'yaml';

export type NodeType =
  | 'worldstate'
  | 'actor'
  | 'knowledge'
  | 'belief'
  | 'goal'
  | 'possibility'
  | 'capability';

export type CapabilityStatus = 'IMPLEMENTED' | 'PARTIAL' | 'MISSING';

/** 노드 Id 접두 규약 — type 과 접두가 어긋나면 검사 실패다 */
const ID_PREFIX: Record<NodeType, string> = {
  worldstate: 'W-',
  actor: 'A-',
  knowledge: 'K-',
  belief: 'B-',
  goal: 'G-',
  possibility: 'P-',
  capability: 'C_',
};

const ALL_TYPES = Object.keys(ID_PREFIX) as NodeType[];
const CAPABILITY_STATUSES: CapabilityStatus[] = ['IMPLEMENTED', 'PARTIAL', 'MISSING'];

/** Id 처럼 생긴 토큰 — free text 안에 섞여 있어도 실재하는 노드를 가리켜야 한다 */
const ID_TOKEN = /\b(?:[WAKBGP]-[A-Z0-9-]+|C_[A-Z0-9_]+)\b/g;

export interface GraphNode {
  id: string;
  type: NodeType;
  file: string;
  raw: Record<string, unknown>;
}

export interface GraphFile {
  path: string;
  kind: string;
  region?: string;
  title?: string;
  nodes: GraphNode[];
}

export interface Graph {
  files: GraphFile[];
  byId: Map<string, GraphNode>;
  errors: string[];
  warnings: string[];
}

export function projectRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const asStrings = (v: unknown): string[] => asArray(v).map((x) => String(x));
const field = (node: GraphNode, name: string): unknown => node.raw[name];

// ── 읽기 ─────────────────────────────────────────────────────────────

/** 이미 파싱된 문서들로 그래프를 세운다 — fs 없이도 검사할 수 있다 (테스트가 이것을 쓴다) */
export function buildGraph(docs: { path: string; doc: unknown }[]): Graph {
  const errors: string[] = [];
  const warnings: string[] = [];
  const files: GraphFile[] = [];
  const byId = new Map<string, GraphNode>();

  for (const entry of docs) {
    const rel = entry.path;
    const doc = entry.doc as Record<string, unknown>;
    if (!doc || typeof doc !== 'object') {
      errors.push(`${rel}: 최상위가 매핑이 아니다`);
      continue;
    }

    const kind = String(doc.kind ?? '');
    if (!['root', 'region', 'capabilities'].includes(kind)) {
      errors.push(`${rel}: kind 는 root | region | capabilities 중 하나여야 한다 (지금: "${kind}")`);
    }

    const nodes: GraphNode[] = [];
    for (const entry of asArray(doc.nodes)) {
      const raw = entry as Record<string, unknown>;
      const id = String(raw?.id ?? '');
      const type = String(raw?.type ?? '') as NodeType;
      if (!id) {
        errors.push(`${rel}: id 없는 노드가 있다`);
        continue;
      }
      if (!ALL_TYPES.includes(type)) {
        errors.push(`${rel} ${id}: 알 수 없는 type "${type}"`);
        continue;
      }
      if (!id.startsWith(ID_PREFIX[type])) {
        errors.push(`${rel} ${id}: ${type} 의 Id 는 "${ID_PREFIX[type]}" 로 시작해야 한다`);
      }
      if (byId.has(id)) {
        errors.push(`${rel} ${id}: Id 중복 — ${byId.get(id)!.file} 에 이미 있다`);
        continue;
      }
      // Reuse Gate — Capability 는 capabilities.yaml 한 곳에만 산다 (Policy §32)
      if (type === 'capability' && kind !== 'capabilities') {
        errors.push(`${rel} ${id}: Capability 는 master/graph/capabilities.yaml 에만 정의한다`);
      }
      const node: GraphNode = { id, type, file: rel, raw };
      nodes.push(node);
      byId.set(id, node);
    }

    files.push({
      path: rel,
      kind,
      region: doc.region ? String(doc.region) : undefined,
      title: doc.title ? String(doc.title) : undefined,
      nodes,
    });
  }

  return { files, byId, errors, warnings };
}

/** master/graph/ 의 YAML 을 모두 읽어 그래프를 세운다 */
export function loadGraph(root = projectRoot()): Graph {
  const dir = join(root, 'master', 'graph');
  let names: string[] = [];
  try {
    names = readdirSync(dir)
      .filter((n) => n.endsWith('.yaml') || n.endsWith('.yml'))
      .sort();
  } catch {
    return { files: [], byId: new Map(), errors: [`master/graph/ 를 읽을 수 없다 (${dir})`], warnings: [] };
  }

  const docs: { path: string; doc: unknown }[] = [];
  const parseErrors: string[] = [];
  for (const name of names) {
    const rel = `master/graph/${name}`;
    try {
      docs.push({ path: rel, doc: parse(readFileSync(join(dir, name), 'utf8')) });
    } catch (e) {
      parseErrors.push(`${rel}: YAML 파싱 실패 — ${(e as Error).message}`);
    }
  }

  const graph = buildGraph(docs);
  graph.errors.unshift(...parseErrors);
  if (names.length === 0) graph.errors.push('master/graph/ 에 그래프 파일이 없다');
  return graph;
}

// ── 검사 ─────────────────────────────────────────────────────────────

/** 참조 하나를 검사한다 — 실재해야 하고 허용된 type 이어야 한다 */
function checkRef(
  graph: Graph,
  node: GraphNode,
  fieldName: string,
  ref: string,
  allowed: NodeType[],
): void {
  const target = graph.byId.get(ref);
  if (!target) {
    graph.errors.push(`${node.file} ${node.id}.${fieldName}: "${ref}" 는 존재하지 않는 노드다`);
    return;
  }
  if (!allowed.includes(target.type)) {
    graph.errors.push(
      `${node.file} ${node.id}.${fieldName}: "${ref}" 는 ${target.type} 이다 (허용: ${allowed.join(' | ')})`,
    );
  }
}

function checkRefs(
  graph: Graph,
  node: GraphNode,
  fieldName: string,
  allowed: NodeType[],
  value: unknown = field(node, fieldName),
): void {
  for (const ref of asStrings(value)) checkRef(graph, node, fieldName, ref, allowed);
}

/** free text 안에 섞인 Id 토큰도 실재해야 한다 — 예: "W-R001-DEEP-SEAM 의 참/거짓이 정해진다" */
function checkEmbeddedIds(graph: Graph, node: GraphNode, fieldName: string): void {
  for (const line of asStrings(field(node, fieldName))) {
    if (graph.byId.has(line)) continue; // 순수 참조는 위에서 이미 본다
    for (const token of line.match(ID_TOKEN) ?? []) {
      if (!graph.byId.has(token)) {
        graph.errors.push(
          `${node.file} ${node.id}.${fieldName}: "${token}" 는 존재하지 않는 노드다`,
        );
      }
    }
  }
}

export function validate(graph: Graph): Graph {
  for (const node of graph.byId.values()) {
    switch (node.type) {
      case 'worldstate':
        checkRefs(graph, node, 'causes', ['worldstate']);
        checkRefs(graph, node, 'motivates', ['goal']);
        break;

      case 'actor':
        checkRefs(graph, node, 'wants', ['goal']);
        checkRefs(graph, node, 'believes', ['belief']);
        checkRefs(graph, node, 'knows', ['knowledge']);
        break;

      case 'knowledge':
      case 'belief':
        checkRefs(graph, node, 'holder', ['actor']);
        checkRefs(graph, node, 'creates_goal', ['goal']);
        checkRefs(graph, node, 'reframes', ['goal']);
        break;

      case 'goal': {
        // Goal Quality Gate (Policy §29)
        if (!field(node, 'owner')) graph.errors.push(`${node.file} ${node.id}: owner 가 없다`);
        if (!field(node, 'desired_state'))
          graph.errors.push(`${node.file} ${node.id}: desired_state 가 없다`);
        if (asStrings(field(node, 'motivation')).length === 0)
          graph.errors.push(`${node.file} ${node.id}: motivation 이 없다 — Capability 를 Goal 로 쓴 것이 아닌가`);
        checkRefs(graph, node, 'owner', ['actor']);
        checkRefs(graph, node, 'belief_context', ['knowledge', 'belief']);
        break;
      }

      case 'possibility': {
        // Possibility Quality Gate (Policy §30)
        const achieves = asStrings(field(node, 'achieves'));
        if (achieves.length === 0)
          graph.errors.push(`${node.file} ${node.id}: achieves 가 없다 — 무슨 Goal 을 전진시키는가`);
        const requires = (field(node, 'requires') ?? {}) as Record<string, unknown>;
        const requireCount = ['capabilities', 'knowledge', 'world', 'goals'].reduce(
          (sum, key) => sum + asStrings(requires[key]).length,
          0,
        );
        if (requireCount === 0)
          graph.errors.push(`${node.file} ${node.id}: requires 가 비어 있다 — 무엇 없이는 성립하지 않는가`);
        if (asStrings(field(node, 'changes')).length === 0)
          graph.errors.push(`${node.file} ${node.id}: changes 가 없다 — 세계가 달라지지 않는 선택이다`);

        checkRefs(graph, node, 'achieves', ['goal']);
        checkRefs(graph, node, 'requires.capabilities', ['capability'], requires.capabilities);
        checkRefs(graph, node, 'requires.knowledge', ['knowledge', 'belief'], requires.knowledge);
        checkRefs(graph, node, 'requires.world', ['worldstate'], requires.world);
        checkRefs(graph, node, 'requires.goals', ['goal'], requires.goals);
        checkRefs(graph, node, 'supports', ['goal']);
        checkRefs(graph, node, 'opposes', ['goal']);
        checkRefs(graph, node, 'reveals', ['knowledge', 'belief']);
        checkRefs(graph, node, 'creates_goal', ['goal']);
        checkEmbeddedIds(graph, node, 'changes');
        break;
      }

      case 'capability': {
        // Capability Gate (Policy §28 Step 8) — 상태는 주장이 아니라 근거다
        const status = String(field(node, 'status') ?? '') as CapabilityStatus;
        if (!CAPABILITY_STATUSES.includes(status)) {
          graph.errors.push(
            `${node.file} ${node.id}: status 는 ${CAPABILITY_STATUSES.join(' | ')} 중 하나여야 한다 (지금: "${status}")`,
          );
          break;
        }
        if (!field(node, 'semantic'))
          graph.errors.push(`${node.file} ${node.id}: semantic 이 없다 — 플레이 가능한 의미로 적는다`);
        const cycles = asStrings(field(node, 'cycles'));
        const where = asStrings(field(node, 'where'));
        if (status === 'MISSING') {
          if (cycles.length || where.length)
            graph.errors.push(`${node.file} ${node.id}: MISSING 인데 cycles/where 가 채워져 있다`);
        } else {
          if (cycles.length === 0)
            graph.errors.push(`${node.file} ${node.id}: ${status} 인데 근거 Cycle 이 없다`);
          if (where.length === 0)
            graph.errors.push(`${node.file} ${node.id}: ${status} 인데 구현 위치가 없다`);
          if (status === 'PARTIAL' && !field(node, 'note'))
            graph.errors.push(`${node.file} ${node.id}: PARTIAL 인데 무엇이 아직 아닌지 note 가 없다`);
        }
        break;
      }
    }
  }

  // 확장 여지 — 실패가 아니라 다음에 넓힐 곳의 신호다 (Policy §34.1)
  const achieversOf = goalAchievers(graph);
  for (const node of graph.byId.values()) {
    if (node.type !== 'goal') continue;
    const count = achieversOf.get(node.id)?.length ?? 0;
    if (count <= 1) {
      graph.warnings.push(
        `${node.id}: 이 Goal 에 이르는 길이 ${count} 개다 — 의미가 다른 Possibility 를 더 탐색할 여지`,
      );
    }
  }
  for (const node of graph.byId.values()) {
    if (node.type !== 'capability') continue;
    if (field(node, 'platform') === true) continue; // 바탕 능력은 requires 로 나타나지 않는다
    if (requiringPossibilities(graph, node.id).length === 0) {
      graph.warnings.push(`${node.id}: 어떤 Possibility 도 요구하지 않는다 — 왜 존재하는가`);
    }
  }

  return graph;
}

// ── 조회 ─────────────────────────────────────────────────────────────

export function goalAchievers(graph: Graph): Map<string, GraphNode[]> {
  const map = new Map<string, GraphNode[]>();
  for (const node of graph.byId.values()) {
    if (node.type !== 'possibility') continue;
    for (const goal of asStrings(field(node, 'achieves'))) {
      const list = map.get(goal) ?? [];
      list.push(node);
      map.set(goal, list);
    }
  }
  return map;
}

export function requiringPossibilities(graph: Graph, capabilityId: string): GraphNode[] {
  const out: GraphNode[] = [];
  for (const node of graph.byId.values()) {
    if (node.type !== 'possibility') continue;
    const requires = (field(node, 'requires') ?? {}) as Record<string, unknown>;
    if (asStrings(requires.capabilities).includes(capabilityId)) out.push(node);
  }
  return out;
}

/**
 * 이 Possibility 가 지금 어디서 막히는가.
 *   missing  세계에 아예 없는 것 — 이것이 있으면 이 길은 닫혀 있다
 *   partial  일부만 있는 것 — 열릴 수도 있고 모자랄 수도 있다. 사람이 판단한다
 */
export function capabilityGaps(
  graph: Graph,
  possibility: GraphNode,
): { missing: string[]; partial: string[] } {
  const requires = (field(possibility, 'requires') ?? {}) as Record<string, unknown>;
  const missing: string[] = [];
  const partial: string[] = [];
  for (const id of asStrings(requires.capabilities)) {
    const cap = graph.byId.get(id);
    const status = cap ? String(field(cap, 'status')) : 'MISSING';
    if (status === 'MISSING') missing.push(id);
    else if (status === 'PARTIAL') partial.push(id);
  }
  return { missing, partial };
}

/** 화면 한 줄로 요약한 가용성 */
function readiness(graph: Graph, possibility: GraphNode): string {
  const { missing, partial } = capabilityGaps(graph, possibility);
  if (missing.length) {
    const tail = partial.length ? `  (부분: ${partial.join(' ')})` : '';
    return `✕ 없다: ${missing.join(' ')}${tail}`;
  }
  if (partial.length) return `◐ 부분만 있다: ${partial.join(' ')}`;
  return '▶ 지금 가능';
}

// ── 출력 ─────────────────────────────────────────────────────────────

const STATUS_MARK: Record<CapabilityStatus, string> = {
  IMPLEMENTED: '●',
  PARTIAL: '◐',
  MISSING: '○',
};

function printOverlay(graph: Graph): void {
  console.log('\n════ CAPABILITY OVERLAY ════════════════════════════════════');
  console.log('  ● IMPLEMENTED   ◐ PARTIAL   ○ MISSING\n');

  const caps = [...graph.byId.values()].filter((n) => n.type === 'capability');
  const order: CapabilityStatus[] = ['IMPLEMENTED', 'PARTIAL', 'MISSING'];
  for (const status of order) {
    const group = caps.filter((c) => String(field(c, 'status')) === status);
    if (group.length === 0) continue;
    console.log(`  ── ${status} (${group.length}) ─────────────────────────────`);
    for (const cap of group) {
      const users = requiringPossibilities(graph, cap.id);
      const mark = STATUS_MARK[status];
      console.log(`  ${mark} ${cap.id.padEnd(18)} ${field(cap, 'semantic')}`);
      const cycles = asStrings(field(cap, 'cycles'));
      if (cycles.length) console.log(`      근거   ${cycles.join(' · ')}  →  ${asStrings(field(cap, 'where')).join(' · ')}`);
      if (field(cap, 'note')) console.log(`      note   ${String(field(cap, 'note')).trim()}`);
      console.log(`      쓰는 곳 ${users.length ? users.map((u) => u.id).join(' · ') : '(없음)'}`);
    }
    console.log('');
  }
}

function printGraph(graph: Graph): void {
  console.log('\n════ MASTER INTENT GRAPH ═══════════════════════════════════');
  const counts = new Map<NodeType, number>();
  for (const node of graph.byId.values())
    counts.set(node.type, (counts.get(node.type) ?? 0) + 1);
  console.log(
    '  ' + ALL_TYPES.map((t) => `${t} ${counts.get(t) ?? 0}`).join('  ·  ') + `  (총 ${graph.byId.size})`,
  );

  const achieversOf = goalAchievers(graph);
  for (const file of graph.files) {
    if (file.kind !== 'region') continue;
    console.log(`\n  ── ${file.region}  ${file.title ?? ''} ────────────────────`);
    for (const goal of file.nodes.filter((n) => n.type === 'goal')) {
      const owner = String(field(goal, 'owner'));
      console.log(`  G ${goal.id}   owner ${owner}`);
      console.log(`      원하는 상태  ${field(goal, 'desired_state')}`);
      for (const p of achieversOf.get(goal.id) ?? []) {
        console.log(`      └ P ${p.id.padEnd(26)} ${field(p, 'name')}   ${readiness(graph, p)}`);
      }
    }
  }

  // 부딪침 — Narrative Gate 의 재료 (Policy §31)
  const conflicts = [...graph.byId.values()].filter(
    (n) => n.type === 'possibility' && asStrings(field(n, 'opposes')).length > 0,
  );
  console.log(`\n  ── 목적 충돌 (${conflicts.length}) ──────────────────────────`);
  for (const p of conflicts) {
    console.log(`  ${p.id}`);
    console.log(`      돕는다  ${asStrings(field(p, 'supports')).join(' · ') || '(없음)'}`);
    console.log(`      막는다  ${asStrings(field(p, 'opposes')).join(' · ')}`);
  }

  // 틀린 믿음 — 조사·반전이 걸릴 자리
  const wrongBeliefs = [...graph.byId.values()].filter(
    (n) => n.type === 'belief' && String(field(n, 'true_in_world')) !== 'true',
  );
  console.log(`\n  ── 세계와 어긋날 수 있는 믿음 (${wrongBeliefs.length}) ────────`);
  for (const b of wrongBeliefs) {
    console.log(`  ${b.id.padEnd(30)} true_in_world: ${field(b, 'true_in_world')}`);
    console.log(`      ${field(b, 'text')}`);
  }
}

function printFrontierMaterial(graph: Graph): void {
  console.log('\n════ FRONTIER 재료 ═════════════════════════════════════════');
  console.log('  아직 없는 Capability 를 그것을 기다리는 Possibility 수로 줄 세운다.');
  console.log('  이것은 후보의 재료일 뿐이다 — Cycle Goal 은 Human 이 고른다 (Policy §25).\n');

  const pending = [...graph.byId.values()]
    .filter((n) => n.type === 'capability' && String(field(n, 'status')) !== 'IMPLEMENTED')
    .map((cap) => ({ cap, users: requiringPossibilities(graph, cap.id) }))
    .sort((a, b) => b.users.length - a.users.length || a.cap.id.localeCompare(b.cap.id));

  for (const { cap, users } of pending) {
    const status = String(field(cap, 'status'));
    console.log(`  ${STATUS_MARK[status as CapabilityStatus]} ${cap.id.padEnd(18)} ${users.length} 개 Possibility 가 기다린다  [${status}]`);
    console.log(`      ${field(cap, 'semantic')}`);
    for (const u of users) {
      const gaps = capabilityGaps(graph, u);
      const stillMissing = gaps.missing.filter((id) => id !== cap.id);
      const stillPartial = gaps.partial.filter((id) => id !== cap.id);
      const rest = stillMissing.length
        ? `  (이것만으로는 부족: ${stillMissing.join(' ')})`
        : stillPartial.length
          ? `  (이것과 함께 ${stillPartial.join(' ')} 가 부분만 있다)`
          : '  (이것만 채우면 열린다)';
      console.log(`      └ ${u.id.padEnd(26)} ${field(u, 'name')}${rest}`);
    }
    console.log('');
  }
}

function printIssues(graph: Graph): void {
  if (graph.warnings.length) {
    console.log(`\n════ 확장 여지 (${graph.warnings.length}) ══════════════════════════════`);
    for (const w of graph.warnings) console.log(`  · ${w}`);
  }
  if (graph.errors.length) {
    console.log(`\n════ 위반 (${graph.errors.length}) ═══════════════════════════════════`);
    for (const e of graph.errors) console.log(`  ✕ ${e}`);
  }
}

// CLI 로 직접 실행될 때만 동작한다 (import 로는 조용하다)
function main(): void {
  const checkOnly = process.argv.includes('--check');
  const graph = validate(loadGraph());

  if (!checkOnly) {
    printGraph(graph);
    printOverlay(graph);
    printFrontierMaterial(graph);
  }
  printIssues(graph);

  if (graph.errors.length) {
    console.log(`\nMASTER CHECK  FAIL — 위반 ${graph.errors.length} 건\n`);
    process.exit(1);
  }
  console.log(
    `\nMASTER CHECK  PASS — 노드 ${graph.byId.size} · 확장 여지 ${graph.warnings.length} 건\n`,
  );
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) main();
