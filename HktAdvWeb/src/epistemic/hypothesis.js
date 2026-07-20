// =====================================================================
// 가설·실험·검증·반증 루프 (step C2)
// ---------------------------------------------------------------------
// 가설 = epistemic:추정 인 지식 노드. 실험 사건의 반응과 가설의 예측을 대조해
// 전이한다: 추정→확인(예측 일치, 재현 ≥ const.재현_최소) / 추정→반증(불일치).
// 반증 시 그 가설에만 serves 하던 하위 가지가 BeliefView 에서 붕괴한다 — 전역
// 데이터는 불변, 믿음만 죽는다. 다른 부모도 섬기던 노드는 생존(DAG 의 이점).
// (Design-StepPlan §5 C2) — "지식도 소모·갱신되는 자원"의 실체 (M3)
// =====================================================================

// 가설 판정. hyp = {id, stimulus, threshold}. experiments = [{stimulus, response}].
export function evaluateHypothesis(hyp, experiments, { 재현_최소 = 2 } = {}) {
  const matches = experiments.filter((e) => e.stimulus === hyp.stimulus);
  const confirms = matches.filter((e) => e.response >= hyp.threshold).length;
  const refutes = matches.filter((e) => e.response < hyp.threshold).length;
  let verdict = '추정';
  if (confirms >= 재현_최소) verdict = '확인';
  else if (refutes >= 1) verdict = '반증';
  return { id: hyp.id, verdict, confirms, refutes, matched: matches.length };
}

// 반증된 가설의 하위 가지를 믿음에서 붕괴시킨다. 노드는 "모든 부모가 붕괴 집합에
// 속할 때만" 함께 붕괴한다 (다른 살아있는 부모가 있으면 생존).
export function collapseInBelief(belief, graph, refutedId) {
  const collapsed = new Set([refutedId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of graph.goalsById.keys()) {
      if (collapsed.has(id)) continue;
      const parents = graph.parentsOf.get(id) ?? [];
      if (parents.length && parents.every((p) => collapsed.has(p))) {
        collapsed.add(id);
        changed = true;
      }
    }
  }
  for (const id of collapsed) belief.set(id, '반증');
  return [...collapsed];
}

// 판정 결과를 믿음에 반영하고 이벤트를 낸다.
export function applyVerdict(belief, graph, hyp, evalResult) {
  const events = [];
  if (evalResult.verdict === '확인') {
    belief.set(hyp.id, '확인');
    events.push({ type: 'confirm', id: hyp.id });
  } else if (evalResult.verdict === '반증') {
    const collapsed = collapseInBelief(belief, graph, hyp.id);
    events.push({ type: 'collapse', id: hyp.id, collapsed });
  }
  return events;
}
