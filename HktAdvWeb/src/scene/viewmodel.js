// =====================================================================
// Scene 서술자 + ViewModel (step D1)
// ---------------------------------------------------------------------
// 세계 + BeliefView + 이벤트 큐 → Scene 서술자. 렌더러는 서술자만 읽는다
// (불변 원칙 ⑥ 구조 강제 — 렌더러 안에서 세계 규칙을 재유도하지 않는다).
// goalGraph.nodes 는 BeliefView 파생 — 전역 그래프 직접 노출 금지(미발견은 "?").
//
// Scene = {
//   tick,
//   entities: [{id, archetype, pos:{x,y}, channels:{GLOW,JITTER}}],
//   decals: [],
//   effects: [{kind:'ripple'|'collapse'|'retro-bind'|'confirm'|'discover', ...}],
//   ui: { goalGraph:{nodes[],edges[]}, card, dial }
// }
// (Design-StepPlan §6 D1 / Design-Visualization §9 최소형)
// =====================================================================
import { readFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { dataPath } from '../paths.js';
import { evalPred } from '../substrate/predicate.js';

let _channelMap = null;
export function loadChannelMap(file = dataPath('channel-map.yaml')) {
  if (!_channelMap) {
    const raw = yaml.load(readFileSync(file, 'utf8'));
    _channelMap = raw.channels ?? [];
  }
  return _channelMap;
}

// 뿌리 G-0 로부터의 깊이(최소 홉 수). 방사형/별자리 레이아웃의 반지름.
function computeDepths(graph) {
  const depth = new Map();
  const visit = (id, seen) => {
    if (depth.has(id)) return depth.get(id);
    if (seen.has(id)) return 0; // 사이클 방지(로더가 이미 배제)
    seen.add(id);
    const parents = graph.parentsOf.get(id) ?? [];
    if (parents.length === 0) { depth.set(id, 0); return 0; }
    let best = Infinity;
    for (const p of parents) best = Math.min(best, visit(p, seen) + 1);
    if (!Number.isFinite(best)) best = 0;
    depth.set(id, best);
    return best;
  };
  for (const id of graph.goalsById.keys()) visit(id, new Set());
  return depth;
}

// 술어 trace → 조건 슬롯 텍스트 (퍼센트 금지 — 상태 서술 §6.3).
export function traceToConditions(trace) {
  if (!trace) return [];
  switch (trace.op) {
    case 'all':
    case 'any':
      return trace.children.flatMap(traceToConditions);
    case 'not':
      return traceToConditions(trace.child).map((c) => ({ ...c, text: `아님: ${c.text}` }));
    case 'state': {
      const cur = trace.found ? `현재 ${trace.actual}` : '아직 미정의';
      return [{ text: `${trace.path} ${trace.cmp.op} ${trace.cmp.value} (${cur})`, met: trace.value }];
    }
    case 'has': {
      if (trace.source === 'ledger') return [{ text: `에너지 잔고 ${trace.cmp.op} ${trace.cmp.value} (현재 ${trace.balance})`, met: trace.value }];
      const p = trace.property;
      return [{ text: `${trace.kind ?? '재료'} ${p.name} ${p.op} ${p.value} 보유 (후보 ${trace.count}/${trace.needed})`, met: trace.value }];
    }
    case 'epistemic': {
      if (trace.stub) return [{ text: '발견 상태 판정(믿음 미주입 — 미확정)', met: false }];
      const s = trace.spec;
      return [{ text: `${s.tag ?? s.target} 지식 ${s.is}`, met: trace.value }];
    }
    case 'event':
      return [{ text: `${trace.verb} 기록 ${trace.count}/${trace.needed}`, met: trace.value }];
    default:
      return [{ text: JSON.stringify(trace), met: !!trace.value }];
  }
}

// 이벤트 큐 → effects (파문·붕괴·역결합·확인·발견 연출).
export function translateEffects(events = []) {
  const out = [];
  for (const e of events) {
    if (e.type === 'ripple') out.push({ kind: 'ripple', completed: e.completed, branch: e.branch, path: [e.completed, ...e.ancestors.map((a) => a.id)] });
    else if (e.type === 'collapse') out.push({ kind: 'collapse', node: e.id, nodes: e.collapsed });
    else if (e.type === 'retro-bind') out.push({ kind: 'retro-bind', node: e.node, links: e.links });
    else if (e.type === 'confirm') out.push({ kind: 'confirm', node: e.id });
    else if (e.type === 'discover') out.push({ kind: 'discover', node: e.id });
  }
  return out;
}

// 세계 물질 → 엔티티(속성→채널 번역). pos 는 id 순서 기반 결정론적 배치.
function buildEntities(world) {
  if (!world) return [];
  const map = loadChannelMap();
  const all = world.all();
  return all.map((s, i) => {
    const channels = {};
    for (const c of map) {
      if (s.properties[c.property] !== undefined) channels[c.channel] = s.properties[c.property];
    }
    const ang = (i / Math.max(1, all.length)) * Math.PI * 2;
    return {
      id: s.id, archetype: s.archetype,
      pos: { x: Math.round(Math.cos(ang) * 100) / 100, y: Math.round(Math.sin(ang) * 100) / 100 },
      channels,
    };
  });
}

// BeliefView 파생 goalGraph — 미발견은 "?", 발견 노드는 상태·조건 슬롯.
function buildGoalGraph(graph, belief, depths, predCtx) {
  const nodes = [];
  for (const g of graph.goals) {
    const state = belief.stateOf(g.id);
    const childCount = (graph.childrenOf.get(g.id) ?? []).length;
    const depth = depths.get(g.id) ?? 0;
    if (state === '미발견') {
      nodes.push({ id: g.id, masked: true, label: '?', state, depth, childCount });
    } else {
      const node = { id: g.id, masked: false, title: g.title, state, depth, childCount };
      if (predCtx) node.conditions = traceToConditions(evalPred(g.done_when, predCtx).trace);
      nodes.push(node);
    }
  }
  const edges = [];
  for (const g of graph.goals) {
    for (const p of graph.parentsOf.get(g.id) ?? []) edges.push({ from: g.id, to: p });
  }
  return { nodes, edges };
}

// Scene 서술자를 만든다. predCtx 를 주면 조건 슬롯을 채운다.
export function buildScene({ graph, belief, world = null, tick = 0, events = [], focus = null, predCtx = null, dialExtra = {} }) {
  const depths = computeDepths(graph);
  const goalGraph = buildGoalGraph(graph, belief, depths, predCtx);

  let card = null;
  if (focus) {
    const fn = goalGraph.nodes.find((n) => n.id === focus);
    if (fn && !fn.masked) card = { id: fn.id, title: fn.title, state: fn.state, conditions: fn.conditions ?? [] };
  }

  return {
    tick,
    entities: buildEntities(world),
    decals: [],
    effects: translateEffects(events),
    ui: { goalGraph, card, dial: { tick, ...dialExtra } },
  };
}
