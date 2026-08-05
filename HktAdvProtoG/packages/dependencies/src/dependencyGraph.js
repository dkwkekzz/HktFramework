// D0·D1·D4·D5 — 의존 대상 타입, 의존 그래프 스키마, 충족도 평가, 충돌 탐지.
//
// 평가 모델(할당 캐스케이드): 각 의존은 우선순위 순 target 목록을 갖는다.
// 앞 target 의 잔여 공급으로 요구를 채우고, 못 채운 잔여는 다음 target 으로 흘러간다.
// - 충족도(D4) = (요구 - 잔여) / 요구
// - 요구 신청(claim)은 실제 할당과 별개로 기록된다 → 신청 합계 > 공급 이면 충돌(D5).
// 할당 순서는 의존 id 의 안정 정렬로 고정한다 (결정성). 실제 경쟁 해소는 E3 의 몫이다.
import { stableSort, stateHash } from '../../verification/src/deterministic.js';

export const DEPENDENCY_KINDS = ['prey', 'safety', 'byproduct', 'healing', 'habitat', 'reputation'];

export function makeDependency({ holder, kind, targets, demand, rationale }) {
  if (!holder) throw new Error('의존에 holder 필수');
  if (!DEPENDENCY_KINDS.includes(kind)) throw new Error(`미지 의존 종류: ${kind}`);
  if (!Array.isArray(targets) || targets.length === 0) throw new Error(`의존 target 필수: ${holder}/${kind}`);
  if (!Number.isFinite(demand) || demand < 0) throw new Error(`의존 요구 불량: ${holder}/${kind}=${demand}`);
  if (!rationale) throw new Error(`의존 근거(rationale) 필수: ${holder}/${kind}`);
  return { id: `${holder}:${kind}:${targets[0]}`, holder, kind, targets: [...targets], demand, rationale };
}

/** 의존 그래프 정합 검사 — 중복 id·미지 target 을 거부 */
export function validateDependencyGraph(deps, supplies) {
  const errors = [];
  const seen = new Set();
  for (const d of deps) {
    if (seen.has(d.id)) errors.push(`중복 의존 id: ${d.id}`);
    seen.add(d.id);
    for (const t of d.targets) if (!(t in supplies)) errors.push(`공급자 없는 의존 대상: ${t} (${d.id})`);
  }
  return errors;
}

function allocate(deps, supplies, ctx) {
  const supply = {};
  for (const [t, fn] of Object.entries(supplies)) supply[t] = Math.max(0, fn(ctx));
  const remaining = { ...supply };
  const claims = {};   // target → [{holder, kind, depId, amount}]
  const rows = [];

  for (const d of stableSort([...deps], (a, b) => a.id.localeCompare(b.id))) {
    let residual = d.demand;
    const via = [];
    for (const t of d.targets) {
      if (residual <= 0) break;
      (claims[t] ??= []).push({ depId: d.id, holder: d.holder, kind: d.kind, amount: residual });
      const taken = Math.min(residual, remaining[t] ?? 0);
      if (taken > 0) { remaining[t] -= taken; via.push({ target: t, taken }); }
      residual -= taken;
    }
    const satisfaction = d.demand === 0 ? 1 : (d.demand - residual) / d.demand;
    rows.push({
      id: d.id, holder: d.holder, kind: d.kind, targets: d.targets, demand: d.demand,
      unmet: residual, satisfaction, pressure: 1 - satisfaction, via, rationale: d.rationale,
    });
  }
  return { rows, supply, remaining, claims };
}

/** D4 — 의존 충족도 평가. 주체별 압력과 지배 결핍(dominant)을 낸다 (P 계층의 목적 선택 입력) */
export function evaluateDependencies(deps, supplies, ctx) {
  const { rows, supply } = allocate(deps, supplies, ctx);
  const byHolder = {};
  for (const r of rows) {
    const h = (byHolder[r.holder] ??= { holder: r.holder, kinds: {}, dominant: null });
    h.kinds[r.kind] = Math.max(h.kinds[r.kind] ?? 0, r.pressure);
  }
  for (const h of Object.values(byHolder)) {
    const ranked = stableSort(Object.entries(h.kinds), (a, b) => b[1] - a[1]);
    h.dominant = ranked[0][1] > 0 ? ranked[0][0] : null;
    h.maxPressure = ranked[0][1];
  }
  const pressures = stableSort(rows, (a, b) => b.pressure - a.pressure || a.id.localeCompare(b.id));
  return { pressures, byHolder, supply, hash: stateHash({ pressures, byHolder }) };
}

/**
 * D5 — 의존 충돌 탐지.
 * 충돌 = 공급이 존재하는(>0) 대상에 둘 이상의 주체가 신청하고, 신청 합계가 공급을 넘는 경우.
 * 공급 0 은 충돌이 아니라 결핍이다 (D4 압력으로 보고된다).
 */
export function detectConflicts(deps, supplies, ctx) {
  const { supply, claims } = allocate(deps, supplies, ctx);
  const conflicts = [];
  for (const [target, list] of Object.entries(claims)) {
    const totalDemand = list.reduce((s, c) => s + c.amount, 0);
    const holders = new Set(list.map((c) => c.holder));
    if (supply[target] > 0 && totalDemand > supply[target] && holders.size >= 2) {
      conflicts.push({
        target,
        supply: supply[target],
        totalDemand,
        shortfall: totalDemand - supply[target],
        claimants: stableSort(list, (a, b) => a.depId.localeCompare(b.depId)),
        selfContention: false,
      });
    } else if (supply[target] > 0 && totalDemand > supply[target] && holders.size === 1 && list.length >= 2) {
      // 같은 주체의 서로 다른 의존이 같은 대상을 두고 경합한다 (예: 무리의 먹이 대 서식지)
      conflicts.push({
        target,
        supply: supply[target],
        totalDemand,
        shortfall: totalDemand - supply[target],
        claimants: stableSort(list, (a, b) => a.depId.localeCompare(b.depId)),
        selfContention: true,
      });
    }
  }
  return stableSort(conflicts, (a, b) => b.shortfall - a.shortfall || a.target.localeCompare(b.target));
}
