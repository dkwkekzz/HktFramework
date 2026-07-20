// =====================================================================
// 생성 제약 검사기 (step E2)
// ---------------------------------------------------------------------
// 어떤 가지(수동 작성이든 미래의 LLM 생성이든)도 세계에 들어오기 전에 §5 제약을
// 통과해야 한다:
//   (a) 모든 말단 demand 가 재료 10종으로 환원되는가
//   (b) done_when 이 DSL 로 기계 판정 가능한가
//   (c) 응답 기회가 현재 세계에 ≥ 1 실존하는가 (E1 스캔 재사용)
// B1 정적 검사의 동적 확장판 — (a)(b)는 정적, (c)는 세계가 필요해 여기서.
// "수행 불가능한 목적은 세계에 들어올 수 없다"의 기계 관문.
// (Design-StepPlan §7 E2)
// =====================================================================
import { evalPred } from '../substrate/predicate.js';
import { scan } from './reinterpret.js';

// §4.1 — 재료 열 갈래 (보유형 6 + 상태형 4).
export const MATERIAL_KINDS = new Set([
  '물질', '에너지', '정보', '지식', '능력', '생명체', // 보유형
  '관계', '접근권', '환경 상태', '시간과 기회',        // 상태형
]);

// trace 안에 실제로 정의된 상태 경로가 있는지 (창이 세계에 존재하는가).
function traceHasFoundState(trace) {
  if (!trace) return false;
  if (trace.op === 'state') return trace.found === true;
  if (trace.children) return trace.children.some(traceHasFoundState);
  if (trace.child) return traceHasFoundState(trace.child);
  return false;
}

// 하나의 demand 에 응답 기회가 세계에 실존하는가 (제약 c).
export function opportunityExists(demand, world, ctx = {}) {
  if (demand.kind === '에너지') return true; // 에너지는 공통 통화 — 무대가 아니다
  if (demand.property) return scan(demand, world, ctx).length >= 1;
  if (demand.when) {
    const r = evalPred(demand.when, { ...ctx });
    return r.value === true || traceHasFoundState(r.trace);
  }
  return false;
}

// 가지(노드) 하나를 관문에 통과시킨다 → {ok, failures:[{constraint, reason}]}.
export function checkBranch(node, world, ctx = {}) {
  const failures = [];

  // (a) demand 가 10 재료종으로 환원
  for (const d of node.demand ?? []) {
    if (!MATERIAL_KINDS.has(d.kind)) {
      failures.push({ constraint: 'a', reason: `demand kind '${d.kind}' 이 재료 10종 밖` });
    }
  }

  // (b) done_when 이 DSL 로 기계 판정 가능
  if (node.done_when) {
    try { evalPred(node.done_when, { ...ctx, actor: ctx.actor ?? { id: '_gate', inventory: [] } }); }
    catch (e) { failures.push({ constraint: 'b', reason: `done_when 파싱 실패: ${e.message}` }); }
  } else {
    failures.push({ constraint: 'b', reason: 'done_when 이 없다' });
  }

  // (c) 응답 기회가 세계에 ≥ 1 실존
  for (const d of node.demand ?? []) {
    if (!opportunityExists(d, world, ctx)) {
      const desc = d.property ? `${d.kind}:${d.property.name}` : `${d.kind}(상태형)`;
      failures.push({ constraint: 'c', reason: `demand '${desc}' 에 응답 기회가 세계에 없다` });
    }
  }

  return { ok: failures.length === 0, failures };
}

// 반려 리포트 포맷 (미래 LLM 루프의 반려 사유 포맷).
export function rejectionReport(node, result) {
  return {
    node: node.id ?? '(무명 가지)',
    admitted: result.ok,
    reasons: result.failures.map((f) => `(${f.constraint}) ${f.reason}`),
  };
}

// seed 그래프 전체를 세계에 대고 돌려 (c) 실패 목록(백로그)을 얻는다.
// = "이 세계에 아직 없는 무대"의 백로그 (미발견 무대 S-0201·S-0202 등).
export function backlogAgainstWorld(graph, world, ctx = {}) {
  const passed = [];
  const backlog = [];
  for (const g of graph.goals) {
    if (!(g.demand?.length)) continue; // demand 있는 노드(말단)만 (c) 대상
    const res = checkBranch(g, world, ctx);
    if (res.ok) passed.push(g.id);
    else if (res.failures.some((f) => f.constraint === 'c')) {
      backlog.push({ id: g.id, unmet: res.failures.filter((f) => f.constraint === 'c').map((f) => f.reason) });
    }
  }
  return { passed, backlog };
}
