// =====================================================================
// done_when 판정 (step B3)
// ---------------------------------------------------------------------
// 노드 완료 = done_when 술어의 현재값이다 (불변 원칙 ①). 영구 플래그가 아니다:
// 세계가 변해 술어가 다시 거짓이 되면 노드는 재개방된다 (퀘스트 플래그 금지의 귀결).
// 완료 스냅샷은 사건 기록에만 남는다.
// (Design-StepPlan §4 B3)
// =====================================================================
import { evalPred } from '../substrate/predicate.js';

// 노드 하나의 완료 판정.
export function checkDone(node, ctx) {
  const r = evalPred(node.done_when, ctx);
  return { id: node.id, done: r.value, trace: r.trace };
}

// 그래프 전체의 완료 상태를 재계산하고, 이전 상태와 비교해 전이를 검출한다.
// prevDone: Map<id, bool>. → { doneNow, completed[], reopened[] }
export function detectTransitions(graph, ctx, prevDone = new Map()) {
  const doneNow = new Map();
  const completed = [];
  const reopened = [];
  for (const [id, node] of graph.goalsById) {
    const now = checkDone(node, ctx).done;
    doneNow.set(id, now);
    const was = prevDone.get(id) ?? false;
    if (!was && now) completed.push(id);
    if (was && !now) reopened.push(id);
  }
  return { doneNow, completed, reopened };
}
