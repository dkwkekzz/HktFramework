// cycle:trace C01 — 구간 2 종료 조건 검사.
// 정식 세계의 모든 요소가 공리까지 인과로 이어지는지 전 사슬을 걷는다:
//   세계 요소 ← 요구(Q) ← 전략(P) ← 의존 계열(D) ← 주체(S) ← 공리(O)
// 한 고리라도 끊기면 그 요소는 임의 배치다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileC01World } from '../packages/world-compiler/src/c01World.js';
import { buildC01RequirementGraph } from '../packages/world-requirements/src/c01Requirements.js';
import { C01_STRATEGIES } from '../packages/possibilities/src/c01Strategies.js';
import { buildBaseScene } from '../packages/dependencies/src/c01Scenes.js';
import { buildC01DependencyGraph } from '../packages/dependencies/src/c01Dependencies.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const trace = JSON.parse(readFileSync(`${root}/cycles/C01-border-canyon/TRACE.graph.json`, 'utf8'));

const graph = buildC01RequirementGraph(C01_STRATEGIES);
const world = compileC01World({ requirementGraph: graph, seed: 11 });
const scene = buildBaseScene();
const deps = buildC01DependencyGraph(scene);

/** 주체 원형/역할 키 → 그 주체가 실제로 가진 의존 계열 */
const kindsByActor = new Map();
for (const d of deps) {
  const s = scene.state.subjects[d.holder];
  const key = s.role ? `player:${s.role}` : s.archetype;
  if (!kindsByActor.has(key)) kindsByActor.set(key, new Set());
  kindsByActor.get(key).add(d.kind);
}
/** TRACE 의 주체 → 공리 결속 (마지막 고리) */
const axiomByArchetype = new Map();
for (const e of trace.edges) {
  if (e.relation !== 'constrained_by') continue;
  const sub = trace.nodes.find((n) => n.id === e.from && n.layer === 'subject');
  if (!sub) continue;
  const key = sub.label;
  if (!axiomByArchetype.has(key)) axiomByArchetype.set(key, []);
  // TRACE 는 공리 id 를 소문자 꼬리로 적었다 — 코드 레지스트리 표기(대문자)로 정규화한다
  axiomByArchetype.get(key).push(e.to.toUpperCase());
}
const ARCHETYPE_LABEL = {
  villager: '마을 주민', 'hunters-guild': '사냥꾼 조합', merchant: '부산물 상인',
  'herd-beast': '초식 무리 (뿔사슴 무리)', 'apex-monster': '거대 포식 마물', 'resource-colony': '자원 군락 (약초·먹이)',
};
const axiomsFor = (actorKey) => {
  if (actorKey.startsWith('player:')) return ['AX-AUTHORITY']; // 플레이어 행동도 권위 확정에 매인다
  return axiomByArchetype.get(ARCHETYPE_LABEL[actorKey]) ?? [];
};

const elements = [
  ...Object.keys(world.places).map((ref) => ({ kind: 'space', ref, group: 'place' })),
  ...Object.keys(world.routes).map((ref) => ({ kind: 'space', ref, group: 'route' })),
  ...Object.keys(world.rules).map((ref) => ({ kind: 'rule', ref, group: 'rule' })),
  ...Object.keys(world.resources).map((ref) => ({ kind: 'resource', ref, group: 'resource' })),
];

const broken = [];
const chains = [];
for (const el of elements) {
  const p = world.provenance(el.kind, el.ref);
  if (!p?.requirementIds.length) { broken.push(`${el.group}/${el.ref}: 요구 근거 없음`); continue; }

  const reqs = graph.requirements.filter((r) => p.requirementIds.includes(r.id));
  if (!reqs.length) { broken.push(`${el.group}/${el.ref}: 요구 그래프에 없음`); continue; }

  let linked = false;
  for (const req of reqs) {
    for (const d of req.derivedFrom) {
      const strategy = C01_STRATEGIES.find((s) => s.id === d.strategy);
      if (!strategy) { broken.push(`${el.group}/${el.ref} ← ${req.id}: 미지 전략 ${d.strategy}`); continue; }
      for (const actor of d.actors) {
        const holds = kindsByActor.get(actor)?.has(d.dependencyKind);
        if (!holds) continue;                              // 그 주체가 실제로 그 의존을 갖지 않으면 이 고리는 성립 안 함
        const ax = axiomsFor(actor);
        if (!ax.length) { broken.push(`${el.group}/${el.ref} ← ${actor}: 공리 결속 없음`); continue; }
        linked = true;
        if (chains.length < 6)
          chains.push(`${el.group}/${el.ref} ← ${req.id} ← ${strategy.id} ← ${d.dependencyKind} ← ${actor} ← ${ax[0]}`);
        break;
      }
      if (linked) break;
    }
    if (linked) break;
  }
  if (!linked) broken.push(`${el.group}/${el.ref}: 요구는 있으나 실제 주체의 의존·공리까지 이어지지 않음`);
}

console.log(`cycle:trace C01 — 정식 세계 요소 ${elements.length}종 전 사슬 검사`);
console.log('  (세계 요소 ← 요구 ← 전략 ← 의존 계열 ← 주체 ← 공리)\n');
for (const c of chains) console.log('  ' + c);
console.log();
if (broken.length) {
  console.error(`❌ 미근거 세계 요소 ${broken.length}건`);
  for (const b of broken) console.error('  ' + b);
  process.exit(1);
}
console.log(`✅ 미근거 세계 요소 0건 — 구간 2 종료 조건 충족`);
