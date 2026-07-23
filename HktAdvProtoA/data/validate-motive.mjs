// 동기층 검증기 (Design-Motive §11) — 동기층 데이터가 설계 불변을 지키는지 기계로 점검한다.
//   M2  인지 도달 가능 — 모든 E_플레이어.인지.* 축에 set(true) 경로(대화·경험 행동/법칙 효과) ≥1. 도달 불가능한 목적 금지.
//   M3  동기 문장 커버리지 — 인지 가능한 모든 목적에 journal 사전 항목(kind·motive) 존재.
//   M8① 노출 목적 해결 경로 — 인지-노출 말단 목적은 서로 다른 행동 ≥2 (자율성 불변 13①·validate-graph 단일해결의 승격).
//   불변 8  인지 발화의 경험 술어 — 모든 인지 set 법칙·행동은 비어있지 않은 when(겪었다·들었다·봤다) 전제를 갖는다.
// 실행: node data/validate-motive.mjs
import { loadWorld, HERE } from "./load-world.mjs";
import { terminalGoals, buildInitial, recomputeDerived, newCtx, tick, indexVars, evalPred } from "./state-engine.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { graph, state } = loadWorld();
const visual = JSON.parse(readFileSync(join(HERE, "world-visual.json"), "utf8"));
const nodeTitle = new Map(graph.nodes.map((n) => [n.id, n.title || n.id]));
const errors = [], warnings = [], info = [];

// 인지 축 = E_플레이어.인지.{goal}
const cogVars = (state.vars || []).filter((v) => v.owner === "E_플레이어" && v.axis === "인지");
const cogGoals = cogVars.map((v) => v.target);
const askActs = (state.actions || []).filter((a) => a.id.startsWith("ACT_묻다_"));

// ── 인지 set 경로 수집(법칙·행동) — true 로 set 하는 효과
const setters = new Map();                 // cogVarId -> [srcId...]
const setterSrc = new Map();               // srcId -> {when}
for (const src of [...(state.rules || []), ...(state.actions || [])]) {
  for (const e of src.then || []) {
    if (e.op === "set" && e.value === true && /^E_플레이어\.인지\./.test(e.var)) {
      if (!setters.has(e.var)) setters.set(e.var, []);
      setters.get(e.var).push(src.id);
      setterSrc.set(src.id, src);
    }
  }
}

// ── M2 인지 도달 가능
for (const v of cogVars) {
  const paths = setters.get(v.id) || [];
  if (!paths.length) errors.push(`M2 위반: 인지 축 ${v.id} 에 set 경로(대화·경험 행동/법칙) 없음 — 도달 불가능한 저널 목적`);
}
// 인지 축 owner/target 무결성 (target 은 그래프 목적 노드)
for (const v of cogVars) if (!nodeTitle.has(v.target)) errors.push(`M2 위반: 인지 축 ${v.id} 의 target ${v.target} 가 그래프에 없음`);

// ── 불변 8 경험 술어 — set 하는 법칙/행동에 when 전제
for (const [srcId, src] of setterSrc) {
  const clauses = src.when?.all || src.when?.any || (src.when ? [src.when] : []);
  if (!clauses.length) errors.push(`불변8 위반: ${srcId} 가 인지를 set 하는데 경험 술어(when)가 없음 — 세계 술어 단독 발견 금지`);
}

// ── M3 동기 문장 커버리지
const jrn = Object.fromEntries(Object.entries(visual.journal || {}).filter(([k]) => k !== "meta"));

for (const goal of cogGoals) {
  const j = jrn[goal];
  if (!j) { errors.push(`M3 위반: 인지-노출 목적 ${goal} 의 journal 항목(kind·motive)이 없음`); continue; }
  if (!j.motive) errors.push(`M3 위반: journal ${goal} 에 motive(왜 지금 나에게) 문장이 없음`);
  if (j.kind !== "필요" && j.kind !== "기회") errors.push(`M3 위반: journal ${goal} 의 kind '${j.kind}' 가 필요|기회 아님`);
}
// journal 고아 — 인지 축 없는 목적 항목 금지
for (const goal of Object.keys(jrn)) {
  if (!cogGoals.includes(goal)) errors.push(`M3 위반: journal 항목 ${goal} 에 대응하는 인지 축(E_플레이어.인지.${goal})이 없음`);
  const cog = jrn[goal].cognition;
  if (cog && cog !== `E_플레이어.인지.${goal}`) warnings.push(`M3 경고: journal ${goal} cognition 표기 불일치`);
}

// ── M8① 노출 목적 해결 경로 ≥2 (말단 목적 한정)
const term = terminalGoals(graph);
for (const goal of cogGoals) {
  if (!term.has(goal)) continue;                          // 비말단(상위 묶음)은 하위 목적이 해결을 담당
  const acts = (state.actions || []).filter((a) => a.objective === goal);
  if (acts.length < 2) errors.push(`M8① 위반: 인지-노출 말단 목적 ${goal} 의 해결 행동이 ${acts.length}개 (자율성 — 서로 다른 행동 ≥2 필요)`);
}

// ── M9 도달성 — '플레이하는' 플레이어(지역을 순회하는 탐사자)가 모든 인지 전제에 실제로 닿는가.
//   "만날 수 있는 것만 노출"(§1.5 성립 조건)을 기계로 강제. 위치 무관 경험(허기·상처)은 방치로도 닿고,
//   위치 게이트 경험(북방 한기 등)은 순회로 닿는다. 어느 것도 참이 안 되면 = 도달 불가능한 목적(오류).
const N9 = 80;
const reachTick = new Map();               // cogVarId -> 최초 도달 틱 (setter when 참)
{
  const varIdx = indexVars(state);
  const snap = buildInitial(state); recomputeDerived(snap, varIdx);
  const ctx = newCtx(state);
  const Ls = graph.nodes.filter((n) => n.type === "L").map((n) => n.id);   // 순회 대상 지역
  const check = () => {
    for (const v of cogVars) {
      if (reachTick.has(v.id)) continue;
      for (const srcId of setters.get(v.id) || []) {
        if (evalPred(setterSrc.get(srcId).when, snap, "E_플레이어")) { reachTick.set(v.id, ctx.t); break; }
      }
    }
  };
  check();                                  // t0
  for (let i = 0; i < N9 && reachTick.size < cogVars.length; i++) {
    snap["E_플레이어.위치"] = Ls[i % Ls.length];   // 탐사 모델 — 지역 순회(위치 게이트 경험 도달 가능화)
    tick(snap, state, ctx);
    check();
  }
}
for (const v of cogVars) {
  if (!reachTick.has(v.id))
    errors.push(`M9 위반: 인지 ${v.target} 의 발견 전제가 자율 세계 ${N9}틱 내 참이 되지 않음 — 도달 불가능한 노출 목적(§1.5)`);
}

// ── M9 직관층 즉각 보상 — 직관 기점 행동은 즉각 체감 보상(허기↓ ∨ 보유↑)을 보증(보상 이중성 충족).
const INTUITIVE = ["ACT_식사", "ACT_초식동물_사냥", "ACT_유리열매_채집"];
const actById = new Map((state.actions || []).map((a) => [a.id, a]));
for (const id of INTUITIVE) {
  const a = actById.get(id);
  if (!a) { errors.push(`M9 위반: 직관층 행동 ${id} 가 없음`); continue; }
  const reward = (a.then || []).some((e) => {
    const nm = e.var.replace("{actor}", "E_플레이어"); const vv = (state.vars || []).find((x) => x.id === nm);
    if (!vv) return false;
    const 보유증가 = vv.axis === "보유" && e.op === "add" && e.value > 0;
    const 허기개선 = vv.axis === "허기" && e.op === "add" && e.value < 0;
    return 보유증가 || 허기개선;
  });
  if (!reward) errors.push(`M9 위반: 직관층 행동 ${id} 에 즉각 체감 보상(허기↓·보유↑) 없음 — 충족 없는 루프(낚시) 금지`);
}

// ── 리드 커버리지 — 모든 묻기에 소문(lead) 실마리가 있어 상향 입구가 보이는가 (§6 ④ 정보 루프)
const actVis = visual.actions || {};
for (const a of askActs) if (!actVis[a.id]?.lead)
  warnings.push(`리드 경고: 묻기 ${a.id} 에 lead(소문 실마리) 없음 — 저널 '소문' 섹션에 안 뜬다(막힘→묻기 입구 누락)`);

// ── 필요/기회 균형 리포트
const need = cogGoals.filter((g) => jrn[g]?.kind === "필요");
const chance = cogGoals.filter((g) => jrn[g]?.kind === "기회");
info.push(`인지-노출 목적 ${cogGoals.length} — 필요 ${need.length} · 기회 ${chance.length}`);
info.push(`인지 set 경로: ${[...setters.entries()].map(([v, s]) => `${v.replace("E_플레이어.인지.", "")}←${s.join(",")}`).join(" · ")}`);
info.push(`묻기 행동 ${askActs.length} · 경험 인지 법칙 ${(state.rules || []).filter((r) => r.id.startsWith("LAW_인지_")).length}`);
info.push(`M9 도달성: 인지 ${cogVars.length}개 전부 자율 세계에서 도달 — ${[...reachTick.entries()].map(([v, t]) => `${v.replace("E_플레이어.인지.", "")}@t${t}`).join(" · ")}`);

// ── 결과
console.log(`동기층: 인지 축 ${cogVars.length} · 묻기 ${askActs.length} · journal 항목 ${Object.keys(jrn).length}`);
for (const m of info) console.log("  " + m);
if (warnings.length) console.log("경고:\n  " + warnings.join("\n  "));
if (errors.length) { console.error("오류:\n  " + errors.join("\n  ")); process.exit(1); }
console.log("검증 통과 — 동기층 무결성 이상 없음 (M2 인지 도달 · M3 motive 커버리지 · M8① 해결 ≥2 · 불변 8 경험 술어).");
