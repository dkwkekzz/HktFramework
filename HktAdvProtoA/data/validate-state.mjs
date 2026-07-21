// 세계 상태 검증기(§12) — world-state.json 을 objective-graph.json 에 대조해 13종을 점검한다.
// 데이터는 담지 않는다. 실행: node data/validate-state.mjs
import {
  loadWorld, indexVars, buildInitial, recomputeDerived, evalPred,
  newCtx, tick, terminalGoals, subst,
} from "./state-engine.mjs";

const { graph, state } = loadWorld();
const nodeIds = new Set(graph.nodes.map((n) => n.id));
const varIdx = indexVars(state);
const varIds = new Set(varIdx.keys());
const errors = [];
const warnings = [];
const info = [];

// 술어/효과가 참조하는 모든 var 이름을 {actor} 치환군까지 펼쳐 수집
function collectRefs(pred, out) {
  if (!pred) return;
  if (pred.all) return pred.all.forEach((p) => collectRefs(p, out));
  if (pred.any) return pred.any.forEach((p) => collectRefs(p, out));
  if (pred.not) return collectRefs(pred.not, out);
  if (pred.var) { out.add(pred.var); if (pred.value && pred.value.var) out.add(pred.value.var); }
}
// {actor} 를 실제 주체로 치환해 존재 검증
function actorsFor(container) {
  return (container.actor_type && container.actor_type.length) ? container.actor_type : [null];
}
function checkRef(name, actors, where) {
  const names = name.includes("{actor}") ? actors.map((a) => subst(name, a)) : [name];
  for (const nm of names) {
    // 목적 진행 축은 vars 에 선언돼 있어야 함
    if (!varIds.has(nm)) errors.push(`검증2 위반(${where}): 미선언 var 참조 — ${nm}`);
  }
}

// ── 검증 1: var owner/target 이 그래프에 존재 (고아 상태 금지)
for (const v of state.vars) {
  if (!nodeIds.has(v.owner)) errors.push(`검증1 위반: ${v.id} 의 owner ${v.owner} 가 그래프에 없음`);
  if (v.target && !nodeIds.has(v.target)) errors.push(`검증1 위반: ${v.id} 의 target ${v.target} 가 그래프에 없음`);
}

// ── 검증 3: 모든 var 에 basis
for (const v of state.vars) if (!v.basis) errors.push(`검증3 위반: ${v.id} 에 basis 없음`);

// ── 검증 4: 모든 S 노드가 최소 1개의 var
const varsByOwner = new Map();
for (const v of state.vars) {
  if (!varsByOwner.has(v.owner)) varsByOwner.set(v.owner, []);
  varsByOwner.get(v.owner).push(v);
}
for (const n of graph.nodes) if (n.type === "S" && !varsByOwner.has(n.id))
  errors.push(`검증4 위반: S 노드 ${n.id} 에 var 없음`);

// ── 검증 2: 모든 술어/효과가 선언된 var 만 참조
for (const r of state.rules || []) {
  const refs = new Set(); collectRefs(r.when, refs);
  for (const nm of refs) checkRef(nm, [null], `rule ${r.id}.when`);
  for (const e of r.then || []) checkRef(e.var, [null], `rule ${r.id}.then`);
}
for (const a of state.actions || []) {
  const refs = new Set(); collectRefs(a.when, refs);
  for (const nm of refs) checkRef(nm, actorsFor(a), `action ${a.id}.when`);
  for (const e of [...(a.cost || []), ...(a.then || [])]) checkRef(e.var, actorsFor(a), `action ${a.id}`);
}
for (const o of state.objectives || []) {
  for (const key of ["discover", "complete", "fail"]) {
    const refs = new Set(); collectRefs(o[key], refs);
    for (const nm of refs) checkRef(nm, [null], `obj ${o.id}.${key}`);
  }
  for (const e of [...(o.on_complete || []), ...(o.on_fail || [])]) checkRef(e.var, [null], `obj ${o.id}`);
}
for (const c of state.clocks || [])
  for (const e of [...(c.then_on || []), ...(c.then_off || [])]) checkRef(e.var, [null], `clock ${c.id}`);

// ── 검증 8: 파생축에 쓰기 금지
const derived = new Set(state.vars.filter((v) => v.derived).map((v) => v.id));
function checkNoDerivedWrite(effects, where) {
  for (const e of effects || []) { const nm = e.var; if (derived.has(nm)) errors.push(`검증8 위반(${where}): 파생축 ${nm} 에 쓰기`); }
}
for (const r of state.rules || []) checkNoDerivedWrite(r.then, `rule ${r.id}`);
for (const a of state.actions || []) { checkNoDerivedWrite(a.cost, `action ${a.id}.cost`); checkNoDerivedWrite(a.then, `action ${a.id}.then`); }
for (const o of state.objectives || []) { checkNoDerivedWrite(o.on_complete, `obj ${o.id}`); checkNoDerivedWrite(o.on_fail, `obj ${o.id}`); }
for (const c of state.clocks || []) checkNoDerivedWrite([...(c.then_on || []), ...(c.then_off || [])], `clock ${c.id}`);

// ── 검증 5: objective 를 가진 말단 G 는 complete 필수
const term = terminalGoals(graph);
const objByGoal = new Map((state.objectives || []).map((o) => [o.goal, o]));
for (const o of state.objectives || []) {
  if (term.has(o.goal) && !o.complete) errors.push(`검증5 위반: 말단 목적 ${o.goal} 의 objective 에 complete 없음`);
}

// ── 검증 6: on_complete/on_fail 이 최소 1개의 다른 변수를 바꾸는가
for (const o of state.objectives || []) {
  if (o.complete && !(o.on_complete && o.on_complete.length))
    warnings.push(`검증6 경고: ${o.id} 에 on_complete 없음(완료가 세계를 바꾸지 않음)`);
  if (o.fail && !(o.on_fail && o.on_fail.length))
    warnings.push(`검증6 경고: ${o.id} 에 on_fail 없음`);
}

// ── 검증 7: objective 를 가진 말단 G 에 서로 다른 행동 2개 이상
for (const o of state.objectives || []) {
  if (!term.has(o.goal)) continue;
  const acts = (state.actions || []).filter((a) => a.objective === o.goal);
  if (acts.length < 2) errors.push(`검증7 위반: 말단 목적 ${o.goal} 에 행동이 ${acts.length}개 (2개 이상 필요)`);
}

// ── 검증 9: 같은 var 를 set 하는 규칙 쌍이 동시 발화 가능한가(정적)
function eqGuards(pred, map) { // {var: [values]} — == 로 고정된 값
  if (!pred) return;
  if (pred.all) return pred.all.forEach((p) => eqGuards(p, map));
  if (pred.var && pred.op === "==") { if (!map.has(pred.var)) map.set(pred.var, new Set()); map.get(pred.var).add(JSON.stringify(pred.value)); }
}
const setters = new Map(); // varName -> [ruleId...]
for (const r of state.rules || []) for (const e of r.then || []) if (e.op === "set") {
  if (!setters.has(e.var)) setters.set(e.var, []);
  setters.get(e.var).push(r);
}
for (const [name, rs] of setters) {
  if (rs.length < 2) continue;
  for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
    const gi = new Map(), gj = new Map(); eqGuards(rs[i].when, gi); eqGuards(rs[j].when, gj);
    let exclusive = false;
    for (const [gv, vs] of gi) if (gj.has(gv)) { const inter = [...vs].filter((x) => gj.get(gv).has(x)); if (inter.length === 0) exclusive = true; }
    if (!exclusive) errors.push(`검증9 위반: 규칙 ${rs[i].id}·${rs[j].id} 가 상호배타 없이 ${name} 를 set`);
  }
}

// ── 검증 12: policy 주체의 목적·행동 존재 + actor_type 정합
for (const s of state.subjects || []) {
  if (s.driver !== "policy") continue;
  if (!nodeIds.has(s.node)) errors.push(`검증12 위반: subject ${s.node} 가 그래프에 없음`);
  for (const g of s.policy || []) {
    if (!objByGoal.has(g)) errors.push(`검증12 위반: ${s.node} 정책의 목적 ${g} 에 objective 없음`);
    const acts = (state.actions || []).filter((a) => a.objective === g && (a.actor_type || []).includes(s.node));
    if (!acts.length) errors.push(`검증12 위반: ${s.node} 가 목적 ${g} 를 수행할 행동(actor_type 포함) 없음`);
  }
}

// ── 검증 10: 그래프 관계 번역 커버리지 보고 (상태화된 양끝 기준)
const relCount = {}, relCovered = {};
for (const l of graph.links) {
  relCount[l.type] = (relCount[l.type] || 0) + 1;
  const both = varsByOwner.has(l.source) && varsByOwner.has(l.target);
  if (both) relCovered[l.type] = (relCovered[l.type] || 0) + 1;
}
for (const t of ["변화", "방해", "충돌", "필요", "제공"]) {
  const c = relCount[t] || 0, cov = relCovered[t] || 0;
  info.push(`검증10 커버리지 ${t}: ${cov}/${c} (양끝 상태화)`);
}

// ── 검증 11: EV 사슬의 각 단계가 규칙(또는 목적 발견)과 1:1 대응
const evStages = new Set();
for (const r of state.rules || []) for (const e of r.then || [])
  if (e.op === "set" && /^EV_.*\.단계$/.test(e.var)) evStages.add(`${e.var}=${e.value}`);
for (const a of state.actions || []) for (const e of a.then || [])
  if (e.op === "set" && /^EV_.*\.단계$/.test(e.var)) evStages.add(`${e.var}=${e.value}`);
const evNode = graph.nodes.find((n) => n.id === "EV_강의귀환");
const chainLen = evNode?.detail?.흐름?.length || 0;
const mapped = [...evStages].filter((s) => s.startsWith("EV_강의귀환.단계=")).length;
info.push(`검증11 EV_강의귀환: 흐름 ${chainLen}단계 중 단계 세팅 ${mapped}종 매핑 (${[...evStages].join(", ")})`);
if (mapped < 5) warnings.push(`검증11 경고: 강의 귀환 단계 매핑이 5 미만(${mapped})`);

// ── 검증 13: 행동 없이 법칙·시계만으로 상태가 변하는 경로가 존재 (무입력 시뮬로 실증)
{
  const snap = buildInitial(state);
  recomputeDerived(snap, varIdx);
  const before = JSON.stringify(snap);
  const ctx = newCtx(state);
  // 정책 주체를 비활성화해 '순수 법칙·시계' 경로만 본다
  const noPolicy = { ...state, subjects: (state.subjects || []).filter((s) => s.driver !== "policy") };
  let changedBy = null;
  for (let i = 0; i < 20 && !changedBy; i++) {
    const snapPrev = JSON.stringify(snap);
    const fired = tick(snap, noPolicy, ctx);
    if (JSON.stringify(snap) !== snapPrev && (fired.rules.length || fired.clocks.length))
      changedBy = fired.rules.length ? `법칙 ${fired.rules.join(",")}` : `시계 ${fired.clocks.join(",")}`;
  }
  if (changedBy) info.push(`검증13 통과: 무입력 20틱 내 자율 변화 확인 — ${changedBy}`);
  else errors.push(`검증13 위반: 무입력 20틱 동안 법칙·시계로 인한 상태 변화 없음`);
  if (JSON.stringify(snap) === before && !changedBy) {/* 이미 위에서 처리 */}
}

// ── 요약
console.log(`world-state: vars ${state.vars.length} · rules ${(state.rules || []).length} · actions ${(state.actions || []).length} · objectives ${(state.objectives || []).length} · clocks ${(state.clocks || []).length}`);
for (const m of info) console.log("  " + m);
if (warnings.length) console.log("경고:\n  " + warnings.join("\n  "));
if (errors.length) { console.error("오류:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("검증 통과 — 세계 상태 무결성 이상 없음 (검증 1~13).");
