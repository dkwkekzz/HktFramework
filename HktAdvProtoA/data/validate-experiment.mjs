// D3 실패=사건 감사 (Design-Intuition §11·정합 4) — 실험 행동이 '무효과 실패' 없이 사건으로 갈리는지 점검.
//   정합 4: 전제 미충족=불발(UX 유지)과 달리, 발화된 실험 행동은 잘못된 때·맥락에서도 효과를 가진다(무효과 금지).
//   결정론 유지(§19): 결과 분기는 RNG 가 아니라 숨은 맥락(별빛 등)의 법칙 교차로. 엔진 무변경 —
//   분기는 데이터(시도 마커 + 상호배타 분기 법칙)로 구현.
//
//   E1  무효과 금지 — experiment:true 행동은 발화 시 반드시 효과(then 비어있지 않음)를 낸다.
//   E2  분기 실재 — 시도 마커(axis=실험)를 세우는 실험 행동은 그 마커를 읽는 분기 법칙 ≥2 를 갖고,
//       각 분기의 then 이 마커 소거 외 실효(≥1 상태 변화)를 낸다(무효과 분기 금지).
//   E3  상호배타 — 분기 법칙들은 공유 ==-가드로 정적 배타(동시 발화 불가 — 검증9 와 같은 규율).
//   E4  분기 행동 실측 — 각 분기 맥락에서 실제로 서로 다른 결과가 나온다(발화된 실험은 늘 사건).
// 실행: node data/validate-experiment.mjs
import { loadWorld } from "./load-world.mjs";
import { buildInitial, recomputeDerived, newCtx, tick, indexVars, evalPred } from "./state-engine.mjs";

const { state } = loadWorld();
const varIdx = indexVars(state);
const errors = [], warnings = [], info = [];

const experiments = (state.actions || []).filter((a) => a.experiment);
if (!experiments.length) errors.push("실험 행동(experiment:true)이 하나도 없다 — D3 대상 부재");

// 마커 var = axis '실험' (실험 행동이 세우는 시도 표식)
const markerVars = new Set((state.vars || []).filter((v) => v.axis === "실험").map((v) => v.id));

// ── E1 무효과 금지 — 발화 시 효과가 있는가
for (const a of experiments) {
  if (!(a.then && a.then.length)) errors.push(`E1 무효과: 실험 행동 ${a.id} 의 then 이 비어있다 — 발화해도 아무 일도 안 일어난다(§11 무효과 금지)`);
}

// == 가드 수집(정적 배타 판정 — 검증9 규율)
function eqGuards(pred, map) {
  if (!pred) return;
  if (pred.all) return pred.all.forEach((p) => eqGuards(p, map));
  if (pred.var && pred.op === "==") { if (!map.has(pred.var)) map.set(pred.var, new Set()); map.get(pred.var).add(JSON.stringify(pred.value)); }
}
const readsMarker = (pred, m) => {
  if (!pred) return false;
  if (pred.all) return pred.all.some((p) => readsMarker(p, m));
  if (pred.any) return pred.any.some((p) => readsMarker(p, m));
  return pred.var === m;
};

let branchingCount = 0;
for (const a of experiments) {
  // 이 행동이 세우는 마커 ({actor} 치환 후 매칭 — 법칙은 리터럴 E_플레이어 로 읽는다)
  const setMarkers = (a.then || []).map((e) => e.var.replace("{actor}", "E_플레이어")).filter((v) => markerVars.has(v));
  if (!setMarkers.length) continue;   // 단순 실험(비분기) — E1 로 충분
  branchingCount++;
  for (const mk of setMarkers) {
    const branches = (state.rules || []).filter((r) => readsMarker(r.when, mk));
    // ── E2 분기 ≥2 · 각 분기 실효
    if (branches.length < 2) { errors.push(`E2 분기 부재: 실험 행동 ${a.id} 의 마커 ${mk} 를 읽는 분기 법칙이 ${branches.length}개 (≥2 필요 — 실패=사건 분기)`); continue; }
    for (const r of branches) {
      const real = (r.then || []).filter((e) => !(markerVars.has(e.var)));   // 마커 소거 외 실효
      if (!real.length) errors.push(`E2 무효과 분기: 분기 법칙 ${r.id} 가 마커 소거 말고는 효과가 없다(§11 무효과 금지)`);
    }
    // ── E3 상호배타 — 분기쌍이 공유 ==-가드로 배타인가
    for (let i = 0; i < branches.length; i++) for (let j = i + 1; j < branches.length; j++) {
      const gi = new Map(), gj = new Map(); eqGuards(branches[i].when, gi); eqGuards(branches[j].when, gj);
      let exclusive = false;
      for (const [gv, vs] of gi) if (gj.has(gv)) { if ([...vs].filter((x) => gj.get(gv).has(x)).length === 0) exclusive = true; }
      if (!exclusive) errors.push(`E3 비배타: 분기 법칙 ${branches[i].id}·${branches[j].id} 가 공유 ==-가드로 상호배타가 아니다(동시 발화 가능)`);
    }
    // ── E4 분기 실측 — 각 분기 맥락에서 서로 다른 실효가 나오는가
    const outcomes = [];
    for (const r of branches) {
      const snap = buildInitial(state); recomputeDerived(snap, varIdx);
      snap[mk] = 1;                                   // 마커 세움
      forcePred(r.when, snap);                        // 이 분기의 맥락 조성
      recomputeDerived(snap, varIdx);
      const before = { ...snap };
      const ctx = newCtx(state); ctx.t = 0;
      tick(snap, state, ctx);
      const changed = Object.keys(snap).filter((k) => snap[k] !== before[k] && !markerVars.has(k));
      if (!changed.length) errors.push(`E4 무효과 실측: 분기 ${r.id} 맥락에서 마커 외 상태 변화가 없다`);
      outcomes.push(changed.sort().join(","));
    }
    if (new Set(outcomes).size < 2) warnings.push(`E4 경고: 마커 ${mk} 의 분기들이 실측상 같은 결과를 낸다(분기 의미 약함) — ${outcomes.join(" | ")}`);
  }
}

function forcePred(pred, snap) {
  if (!pred) return;
  if (pred.all) return pred.all.forEach((p) => forcePred(p, snap));
  if (pred.any) return forcePred(pred.any[0], snap);
  if (pred.not) return;
  const { var: name, op, value } = pred;
  if (value && typeof value === "object") return;
  if (name && varIdx.get(name)?.axis === "실험") return;   // 마커는 위에서 세움
  const num = typeof value === "number";
  if (op === "==" || op === ">=" || op === "<=") snap[name] = value;
  else if (op === ">") snap[name] = num ? value + 1 : value;
  else if (op === "<") snap[name] = num ? value - 1 : value;
  else if (op === "!=") snap[name] = typeof value === "boolean" ? !value : num ? value + 1 : value;
}

info.push(`실험 행동 ${experiments.length}: ${experiments.map((a) => a.id).join(", ")}`);
info.push(`분기(마커) 실험 ${branchingCount} · 마커 축 var ${markerVars.size}`);
// ── E3 가능성 밀도 — 분기 실험 ≥3 (§11 목록의 밀도: 재료 생성·상태 이상·위험 보상 등 서로 다른 갈래)
if (branchingCount < 3) errors.push(`분기 실험 밀도: 마커 분기 실험이 ${branchingCount}개 (E3 ≥3 필요 — 실험할수록 다른 사건이 나는 밀도)`);

for (const m of info) console.log("  " + m);
if (warnings.length) { console.log("\n경고:"); for (const w of warnings) console.log("  ⚠ " + w); }
if (errors.length) { console.error("\n검증 실패:"); for (const e of errors) console.error("  ✗ " + e); process.exit(1); }
console.log(`\n검증 통과 (D3 실패=사건 감사 — 무효과 실패 0) — 경고 ${warnings.length}건`);
