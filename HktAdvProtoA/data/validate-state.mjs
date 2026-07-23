// 세계 상태 검증기(§12) — world-state.json 을 objective-graph.json 에 대조해 13종을 점검한다.
// + WorldLaws §7 법칙검증: 회복 짝(5)·EV 매핑(4)·detail 커버리지(7)·노드 커버리지(8).
// 데이터는 담지 않는다. 실행: node data/validate-state.mjs [--strict-coverage]
import {
  indexVars, buildInitial, recomputeDerived, evalPred,
  newCtx, tick, terminalGoals, subst,
} from "./state-engine.mjs";
import { loadWorld, HERE } from "./load-world.mjs";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STRICT_COVERAGE = process.argv.includes("--strict-coverage");

const { graph, state } = loadWorld();
const nodeIds = new Set(graph.nodes.map((n) => n.id));
const byNode = new Map(graph.nodes.map((n) => [n.id, n]));
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

// ── 검증 18(§18): 존속 루트를 가진 모든 주체가 세계 상태에 표현되어 있는가 (그래프↔세계상태 층 교차)
//   주체 = 플레이어(G0) + 그래프의 모든 F·subjectKind 마킹 E/X. 존속 루트 = 주체에서 파생된 parent 없는 G.
//   ① subjects 등록(driver: input/policy/law) ② 자기 존속 트리 안 objective ≥1 ③ 구동 법칙·정책·행동 ≥1.
//   검증 16 은 트리의 '존재'를, 검증 18 은 트리의 '작동'을 묻는다. 예외는 detail '보류' 태그가 아니라
//   아래 명시적 화이트리스트로만 허용한다 — 화이트리스트 크기 = 주체 세계상태 표현 전수(Phase 1~3) 진행 카운터.
//   주체를 배선하면 그 주체를 화이트리스트에서 제거해야 초록이 유지된다(스테일 방지).
const V18_WHITELIST = new Set([
  // Phase 1 생태·질병 7 — 배선 완료(2026-07), 화이트리스트에서 제거됨.
  // Phase 2 세력 4 (정책화)
  "F_거인부활교단", "F_무명대장간", "F_북방유목민", "F_씨앗보존회",
]);
{
  // 존속 루트: 주체 → 파생 → parent 없는 G
  const derivedRootOf = new Map();
  for (const l of graph.links) {
    if (l.type !== "파생") continue;
    const t = byNode.get(l.target);
    if (t && t.type === "G" && !t.parent) {
      if (!derivedRootOf.has(l.source)) derivedRootOf.set(l.source, new Set());
      derivedRootOf.get(l.source).add(l.target);
    }
  }
  // 존속 트리 하위 G 집합 (parent 하향 순회)
  const childrenOf = new Map();
  for (const n of graph.nodes) if (n.parent) {
    if (!childrenOf.has(n.parent)) childrenOf.set(n.parent, []);
    childrenOf.get(n.parent).push(n.id);
  }
  const subtreeGoals = (roots) => {
    const out = new Set(), st = [...roots];
    while (st.length) { const c = st.pop(); if (out.has(c)) continue; out.add(c); for (const ch of childrenOf.get(c) || []) st.push(ch); }
    return out;
  };
  // 주체 목록 = 플레이어(G0) + F·subjectKind
  const subjects = [{ node: "E_플레이어", roots: new Set(["G0"]) }];
  for (const n of graph.nodes) if (n.type === "F" || n.subjectKind) subjects.push({ node: n.id, roots: derivedRootOf.get(n.id) || new Set() });
  const subjectNodes = new Set(subjects.map((su) => su.node));
  const regByNode = new Map((state.subjects || []).map((su) => [su.node, su]));
  const objGoals = new Set((state.objectives || []).map((o) => o.goal));
  // 구동 판정 재료: actor_type 로 행동을 수행하는 주체 · 법칙이 값을 쓰는 var 의 owner
  const actorNodes = new Set();
  for (const a of state.actions || []) for (const at of a.actor_type || []) actorNodes.add(at);
  const lawWritesOwner = new Set();
  for (const r of state.rules || []) for (const e of r.then || []) { const v = varIdx.get(e.var); if (v) lawWritesOwner.add(v.owner); }

  let wired = 0; const pending = [];
  for (const su of subjects) {
    const reg = regByNode.get(su.node);
    const treeGoals = subtreeGoals(su.roots);
    const hasObj = [...objGoals].some((g) => treeGoals.has(g));
    const moved = (reg && reg.driver === "input")
      || (reg && reg.driver === "policy" && (reg.policy || []).length)
      || actorNodes.has(su.node)
      || lawWritesOwner.has(su.node);
    const miss = [];
    if (!reg) miss.push("①subjects 미등록");
    else if (!["input", "policy", "law"].includes(reg.driver)) miss.push(`①driver '${reg.driver}' 부적합`);
    if (!hasObj) miss.push("②존속 트리 내 objective 없음");
    if (!moved) miss.push("③구동 법칙·정책·행동 없음");
    if (!miss.length) { wired++; continue; }
    // 미배선 — 화이트리스트에 있으면 진행 백로그(경고), 없으면 오류
    if (V18_WHITELIST.has(su.node)) pending.push(`${su.node}: ${miss.join(", ")}`);
    else errors.push(`검증18 위반: 주체 ${su.node} 미배선 — ${miss.join(", ")} (화이트리스트에 없음 — §19 공정 2 로 배선)`);
  }
  // 화이트리스트 무결성 — 실존 주체만 · 이미 배선된 주체가 남으면 회귀(제거하라)
  for (const w of V18_WHITELIST) {
    if (!subjectNodes.has(w)) errors.push(`검증18 위반: 화이트리스트 '${w}' 가 존속 주체가 아님(오탈자·삭제된 주체)`);
    else if (!pending.some((p) => p.startsWith(w + ":"))) errors.push(`검증18 위반: 화이트리스트 '${w}' 가 이미 배선됨 — 화이트리스트에서 제거하라(진행 반영)`);
  }
  info.push(`검증18 주체 세계상태 배선: ${wired}/${subjects.length} 배선 · 미배선(화이트리스트) ${pending.length}`);
  for (const p of pending) info.push(`  └ 미배선 ${p}`);
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

// ── 검증 11 / WorldLaws 법칙검증 4: EV 사슬의 각 단계가 규칙·행동·목적 세팅과 1:1 (EV 노드별)
const evStageMax = new Map(); // evVar -> 최대 단계값
for (const src of [...(state.rules || []), ...(state.actions || [])])
  for (const e of src.then || [])
    if (e.op === "set" && /^EV_.*\.단계$/.test(e.var))
      evStageMax.set(e.var, Math.max(evStageMax.get(e.var) ?? 0, e.value));
for (const ev of graph.nodes.filter((n) => n.type === "EV")) {
  const chainLen = ev.detail?.흐름?.length || 0;
  const mapped = evStageMax.get(ev.id + ".단계") ?? 0;
  info.push(`검증11 ${ev.id}: 흐름 ${chainLen}단계 · 매핑 단계 ${mapped}`);
}

// ── WorldLaws 법칙검증(§7): once/every 배타
for (const r of state.rules || [])
  if (r.once && r.every !== undefined) errors.push(`법칙검증 위반: 규칙 ${r.id} 가 once 와 every 를 동시에 가짐(§5.1 배타)`);

// ── WorldLaws 법칙검증 5(§6): 압력·소모 법칙에 회복 짝이 있는가.
//   회복원 = 어디서든(법칙·행동·목적 효과) 같은 var 를 되돌리는 양수 add 또는 복원 set.
//   monotonic:true 로 표시된 규칙(사건 5 처럼 비가역 클라이맥스)은 회복 짝 요구에서 면제한다.
const push = (m, k, id) => { if (!m.has(k)) m.set(k, []); m.get(k).push(id); };
const negAdd = new Map(), recover = new Map();
for (const r of state.rules || []) for (const e of r.then || []) {
  const v = varIdx.get(e.var); if (!v || (v.kind !== "level" && v.kind !== "count")) continue;
  if (e.op === "add" && e.value < 0 && !r.monotonic) push(negAdd, e.var, r.id);
  if ((e.op === "add" && e.value > 0) || e.op === "set") push(recover, e.var, r.id);
}
for (const src of [...(state.actions || []), ...(state.objectives || [])])
  for (const e of [...(src.then || []), ...(src.on_complete || []), ...(src.on_fail || [])]) {
    const v = varIdx.get(e.var); if (!v || (v.kind !== "level" && v.kind !== "count")) continue;
    if ((e.op === "add" && e.value > 0) || e.op === "set") push(recover, e.var, src.id);
  }
for (const [v, rs] of negAdd)
  if (!recover.has(v)) warnings.push(`법칙검증5 경고(§6 회복 짝 없음): ${v} 를 깎는 법칙(${rs.join(",")})의 회복(양수 add·복원 set)이 없음 — 단조 붕괴 위험. 의도된 비가역이면 규칙에 monotonic:true 표기`);

// ── MMO 검증 M1·M2 (Design-MMO §12)
// M1: E_플레이어 소유 변수는 전부 scope: player — 캐릭터별 인스턴스화 대상 누락 금지
for (const v of state.vars) if (v.owner === "E_플레이어" && v.scope !== "player")
  errors.push(`검증M1 위반: ${v.id} 는 E_플레이어 소유인데 scope: player 가 아니다`);
// M2: world 목적(complete 가 world 축만 읽는 목적)의 complete/fail 이 player 변수를 참조하지 않는다
const playerVars = new Set(state.vars.filter((v) => v.scope === "player").map((v) => v.id));
for (const o of state.objectives || []) {
  for (const key of ["complete", "fail"]) {
    const refs = new Set(); collectRefs(o[key], refs);
    for (const nm of refs) if (playerVars.has(nm))
      errors.push(`검증M2 위반: ${o.id}.${key} 가 player 스코프 변수 ${nm} 를 읽는다 (world 목적은 world 축만)`);
  }
}

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

// ── WorldLaws 법칙검증 7·8(§7): detail 커버리지 + 노드 커버리지 (현상 세 서식지 §0 의 ②)
//   유니버스 = 그래프 전 노드의 모든 detail 항목. EV '흐름' 은 검증11 매핑으로 자동 커버.
//   나머지는 detail-coverage.json 원장이 §9-7 분류를 담당. 원장에 없으면 미분류(=침묵 누락=백로그).
{
  const TRANSLATED = new Set(["초기값", "법칙", "행동", "목적", "파생축", "사슬"]);
  const CLASSES = new Set([...TRANSLATED, "서사", "보류"]);
  let ledger = { entries: {} };
  try { ledger = JSON.parse(readFileSync(join(HERE, "detail-coverage.json"), "utf8")); }
  catch { warnings.push("법칙검증7 경고: data/detail-coverage.json 을 읽을 수 없음 — 전 항목 미분류로 집계"); }
  const entries = ledger.entries || {};
  // 벌크 분류 — 백로그를 컴팩트하게: narrative[](서사) · deferred{key:reason}(보류)
  const narrative = new Set(ledger.narrative || []);
  const deferred = ledger.deferred || {};
  const bulkClass = (full) => narrative.has(full) ? "서사" : (deferred[full] ? "보류" : null);

  // 원장 무결성 — 존재하지 않는 노드·detail 키를 가리키는 원장 항목 거부
  const detailKeySet = new Set();
  for (const n of graph.nodes)
    for (const k of Object.keys(n.detail || {})) detailKeySet.add(`${n.id}.${k}`);
  for (const [key, rec] of Object.entries(entries)) {
    if (!detailKeySet.has(key)) errors.push(`법칙검증7 위반: 원장 항목 '${key}' 가 그래프 detail 에 없음(오탈자·삭제된 노드)`);
    if (!CLASSES.has(rec.c)) errors.push(`법칙검증7 위반: 원장 항목 '${key}' 의 분류 '${rec.c}' 가 허용 분류 아님`);
  }
  for (const key of [...narrative, ...Object.keys(deferred)])
    if (!detailKeySet.has(key)) errors.push(`법칙검증7 위반: 벌크 분류 항목 '${key}' 가 그래프 detail 에 없음`);

  // 항목별 분류 집계 + 노드 롤업(검증8)
  const tally = { 초기값: 0, 법칙: 0, 행동: 0, 목적: 0, 파생축: 0, 사슬: 0, 서사: 0, 보류: 0, 미분류: 0 };
  const perTypeUnclassified = {};
  const backlog = [];
  let total = 0, nodesDone = 0, nodesPartial = 0, nodesUntouched = 0, nodesWithDetail = 0;
  for (const n of graph.nodes) {
    const keys = Object.keys(n.detail || {});
    if (!keys.length) continue;
    nodesWithDetail++;
    let classified = 0;
    for (const k of keys) {
      total++;
      const full = `${n.id}.${k}`;
      let cls = null;
      if (n.type === "EV" && k === "흐름") {
        // EV 흐름 = 검증11 매핑(evStageMax>0)으로 자동 커버
        cls = (evStageMax.get(n.id + ".단계") ?? 0) > 0 ? "사슬" : null;
      } else if (entries[full]) {
        cls = entries[full].c;         // 명시 분류 우선
      } else {
        cls = bulkClass(full);         // 벌크 서사/보류
      }
      if (cls) { tally[cls]++; classified++; }
      else {
        tally.미분류++;
        perTypeUnclassified[n.type] = (perTypeUnclassified[n.type] || 0) + 1;
        backlog.push(full);
      }
    }
    if (classified === keys.length) nodesDone++;
    else if (classified === 0) nodesUntouched++;
    else nodesPartial++;
  }

  const classifiedCount = total - tally.미분류;
  const translatedCount = [...TRANSLATED].reduce((s, c) => s + tally[c], 0);
  const pct = (a, b) => b ? ((a / b) * 100).toFixed(1) + "%" : "-";
  info.push(`법칙검증7 detail 커버리지: 전체 ${total} · 분류 ${classifiedCount}(${pct(classifiedCount, total)}) · 미분류 ${tally.미분류}`);
  info.push(`  └ 번역 ${translatedCount}(초기값 ${tally.초기값}·법칙 ${tally.법칙}·행동 ${tally.행동}·목적 ${tally.목적}·파생축 ${tally.파생축}·사슬 ${tally.사슬}) · 서사 ${tally.서사} · 보류 ${tally.보류}`);
  info.push(`법칙검증8 노드 커버리지: detail 보유 ${nodesWithDetail} · 완료 ${nodesDone} · 부분 ${nodesPartial} · 미착수 ${nodesUntouched}`);
  const typeStr = Object.entries(perTypeUnclassified).sort((a, b) => b[1] - a[1]).map(([t, c]) => `${t} ${c}`).join(" · ");
  if (tally.미분류) info.push(`  └ 미분류 타입 분포: ${typeStr}`);

  // 백로그를 파일로 — 콘솔 절단 없이 후속 §9 절차의 작업 목록
  const backlogPath = join(HERE, "coverage-backlog.json");
  writeFileSync(backlogPath, JSON.stringify({
    meta: { total, classified: classifiedCount, unclassified: tally.미분류, generated: "validate-state.mjs 법칙검증7" },
    byType: perTypeUnclassified, items: backlog,
  }, null, 2) + "\n");
  info.push(`  └ 미분류 ${tally.미분류}항목 → data/coverage-backlog.json (§9 절차 작업 목록)`);

  if (STRICT_COVERAGE && tally.미분류)
    errors.push(`법칙검증7 위반(--strict-coverage): 미분류 detail ${tally.미분류}항목 — data/coverage-backlog.json 참조, §9-7 로 분류 필요`);
}

// ── 요약
console.log(`world-state: vars ${state.vars.length} · rules ${(state.rules || []).length} · actions ${(state.actions || []).length} · objectives ${(state.objectives || []).length} · clocks ${(state.clocks || []).length}`);
for (const m of info) console.log("  " + m);
if (warnings.length) console.log("경고:\n  " + warnings.join("\n  "));
if (errors.length) { console.error("오류:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("검증 통과 — 세계 상태 무결성 이상 없음 (WorldState §12 검증 1~13 + WorldLaws §7 법칙검증).");
