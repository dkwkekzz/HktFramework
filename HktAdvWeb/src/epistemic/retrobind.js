// =====================================================================
// 상향 발견 — 역결합 (step C3)
// ---------------------------------------------------------------------
// 용도 불명 재료를 먼저 얻고, 나중에 그 속성 demand 와 만나는 순간 가지가
// 역결합으로 밝혀진다 — "그 비늘이 여기 쓰이는 거였구나".
// (Design-StepPlan §5 C3)
// =====================================================================
import { matchDemand } from '../graph/demand.js';

// 현재 발견된(미발견 아님) 노드들의 demand 가 요구하는 속성 집합.
function discoveredDemandProps(graph, belief) {
  const props = new Set();
  for (const g of graph.goals) {
    if (belief.stateOf(g.id) === '미발견') continue;
    for (const d of g.demand ?? []) if (d.property?.name) props.add(d.property.name);
  }
  return props;
}

// 보유 재료 중 발견된 어떤 demand 와도 안 닿는 것 = 용도 불명.
export function findUnbound(actor, graph, belief) {
  const wanted = discoveredDemandProps(graph, belief);
  return (actor.inventory ?? []).filter(
    (s) => !Object.keys(s.properties).some((p) => wanted.has(p)),
  );
}

// 노드를 발견하는 순간, 보유 재료를 그 노드의 demand 에 대조한다.
// 매칭되면 retro-bind 이벤트를 낸다(가지 발견 전이 + 재료·노드 연결 정보).
export function discoverNode(belief, graph, actor, nodeId, ctx = {}) {
  const events = [];
  const from = belief.stateOf(nodeId);
  const discoverEv = belief.discover(nodeId, { via: ctx.via ?? '탐색' });
  events.push(discoverEv);

  const node = graph.goalsById.get(nodeId);
  const links = [];
  for (const d of node?.demand ?? []) {
    if (!d.property) continue;
    const r = matchDemand(actor, d, ctx.world ?? null, { ...ctx, actor });
    for (const c of r.candidates) {
      if (c.source === '보유') links.push({ material: c.id, property: d.property.name, node: nodeId });
    }
  }
  if (links.length) {
    events.push({ type: 'retro-bind', node: nodeId, from, links });
  }
  return { events, links };
}
