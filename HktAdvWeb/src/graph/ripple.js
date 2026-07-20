// =====================================================================
// 상향 파문 (step B3)
// ---------------------------------------------------------------------
// 노드 완료가 serves 계보를 타고 조상의 조건 슬롯을 갱신한다. DAG 다중 부모면
// 갈래별 파문. 파문 이벤트 = 경유 조상 목록 + 각 조상의 충족 조건 서술
// (A4 trace 재사용 — "숫자 없는 진행"의 데이터 원천).
// (Design-StepPlan §4 B3)
// =====================================================================
import { checkDone } from './complete.js';

// 시작 노드에서 serves 를 따라 위로 도달 가능한 조상들을 순서대로 수집(BFS, 중복 제거).
function ancestorsFrom(startId, graph) {
  const out = [];
  const seen = new Set();
  const queue = [startId];
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const p of graph.parentsOf.get(id) ?? []) queue.push(p);
  }
  return out;
}

// 한 노드의 완료가 만드는 파문 이벤트들. 즉시 부모(=갈래)마다 하나씩.
export function ripple(node, graph, ctx) {
  const events = [];
  const parents = graph.parentsOf.get(node.id) ?? [];
  for (const p of parents) {
    const chain = ancestorsFrom(p, graph);
    const ancestors = chain.map((id) => {
      const g = graph.goalsById.get(id);
      const d = checkDone(g, ctx);
      return { id, title: g.title, done: d.done, condition: d.trace };
    });
    events.push({ type: 'ripple', completed: node.id, branch: p, ancestors });
  }
  return events;
}
