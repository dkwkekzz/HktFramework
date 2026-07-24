// D2 재료 다용도 감사 (Design-Intuition §7·§8) — 재료가 '수집물'이 아니라 '가능성'인지 기계로 점검.
//   D1  성질 계열 커버리지 — 모든 R 재료 노드가 material-families.json 에 성질 계열(§7)로 분류됨.
//   D2  핵심 다용도 — role=핵심 재료는 즉시·조합·사건(§8) 세 용도가 모두 채워짐.
//   D3  배선 교차검증 — use.via 가 ACT_/LAW_/EV_ 를 가리키면 실제로 존재하는 행동·법칙·사건이어야 함(허구 배선 금지).
//   D4  조합 행동 존재 — 재료 ≥2 를 비용으로 소비하는 조합 행동(§6 조합 verb)이 ≥3, 그중
//       서로 다른 성질 계열을 섞는 교차 계열 조합(§5 붉은+푸른 → 예상 밖)이 ≥1 (E3 가능성 밀도).
//   무결성 — 카탈로그 항목이 실재 R 노드를 가리키고(고아 금지), family 가 families 에 선언됨.
// 실행: node data/validate-material.mjs
import { loadWorld, HERE } from "./load-world.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { graph, state } = loadWorld();
const cat = JSON.parse(readFileSync(join(HERE, "material-families.json"), "utf8"));
const errors = [], warnings = [], info = [];

const Rnodes = graph.nodes.filter((n) => n.type === "R").map((n) => n.id);
const actionIds = new Set((state.actions || []).map((a) => a.id));
const ruleIds = new Set((state.rules || []).map((r) => r.id));
const evNodes = new Set(graph.nodes.filter((n) => n.type === "EV").map((n) => n.id));
const families = cat.families || {};
const mats = cat.materials || {};

// ── 무결성: 카탈로그 항목 ↔ 실재 R 노드
for (const id of Object.keys(mats)) if (!Rnodes.includes(id)) errors.push(`무결성: 카탈로그 항목 ${id} 가 실재 R 노드가 아니다(고아)`);
for (const id of Object.keys(mats)) {
  const fam = mats[id].family;
  if (!fam) errors.push(`무결성: ${id} 에 family(성질 계열)가 없다`);
  else if (!families[fam]) errors.push(`무결성: ${id} 의 family '${fam}' 가 families 에 선언되지 않았다`);
}

// ── D1 성질 계열 커버리지 — 모든 R 노드가 분류되었는가 (100%)
const uncovered = Rnodes.filter((id) => !mats[id]);
if (uncovered.length) errors.push(`D1 커버리지: 성질 계열 미분류 R 재료 ${uncovered.length} — ${uncovered.join(", ")}`);

// ── D2 핵심 다용도 — role=핵심 은 즉시·조합·사건 3용도 모두 채워짐
const SLOTS = ["즉시", "조합", "사건"];
const core = Object.entries(mats).filter(([, m]) => m.role === "핵심").map(([id]) => id);
for (const id of core) {
  const uses = mats[id].uses || {};
  const missing = SLOTS.filter((s) => !uses[s] || !(uses[s].text || "").trim());
  if (missing.length) errors.push(`D2 핵심 다용도: ${id}(핵심) 의 용도 슬롯 미충족 — ${missing.join("·")} 없음 (§8 즉시·조합·사건 ≥3)`);
}

// ── D3 배선 교차검증 — use.via 가 실재 행동·법칙·사건을 가리키는가
let wired = 0;
for (const [id, m] of Object.entries(mats)) for (const s of SLOTS) {
  const via = m.uses?.[s]?.via;
  if (!via) continue;
  wired++;
  if (via.startsWith("ACT_") && !actionIds.has(via)) errors.push(`D3 배선: ${id}.${s}.via 행동 ${via} 가 world-state 에 없다`);
  else if (via.startsWith("LAW_") && !ruleIds.has(via)) errors.push(`D3 배선: ${id}.${s}.via 법칙 ${via} 가 world-state 에 없다`);
  else if (via.startsWith("RULE_") && !ruleIds.has(via)) errors.push(`D3 배선: ${id}.${s}.via 법칙 ${via} 가 world-state 에 없다`);
  else if (via.startsWith("EV_") && !evNodes.has(via)) errors.push(`D3 배선: ${id}.${s}.via 사건 ${via} 가 그래프에 없다`);
}

// ── D4 조합 행동 — 재료 ≥2 소비 조합 verb ≥3 + 교차 계열 ≥1 (§6·E3 가능성 밀도)
const combines = (state.actions || []).filter((a) => a.id.startsWith("ACT_조합"));
const matOfCostVar = (v) => { const m = v.match(/(R_[^.]+)(?:\.보유)?$/) || v.match(/보유\.(R_[^.]+)$/); return m ? m[1] : null; };
const realCombines = combines.filter((a) => (a.cost || []).filter((c) => /R_/.test(c.var) && c.op === "add" && c.value < 0).length >= 2);
if (realCombines.length < 3) errors.push(`D4 조합 행동: 재료 ≥2 를 소비하는 ACT_조합* 행동이 ${realCombines.length}개 (E3 ≥3 필요 — §6 '매번 다른 가능성'의 밀도)`);
const crossCombines = realCombines.filter((a) => {
  const fams = new Set((a.cost || []).filter((c) => c.op === "add" && c.value < 0)
    .map((c) => matOfCostVar(c.var)).filter(Boolean).map((id) => mats[id]?.family).filter(Boolean));
  return fams.size >= 2;
});
if (!crossCombines.length) errors.push("D4 교차 계열: 서로 다른 성질 계열을 섞는 조합 행동이 없다 (§5 붉은+푸른 → 예상 밖)");

// ── 핵심 재료 배선 실질 — 핵심의 용도 중 실제 배선(via) ≥1
for (const id of core) {
  const vias = SLOTS.map((s) => mats[id].uses?.[s]?.via).filter(Boolean);
  if (!vias.length) warnings.push(`핵심 배선 경고: ${id}(핵심) 의 세 용도 중 실제 배선(via ACT_/LAW_/EV_)이 하나도 없다 — 문서만의 가능성`);
}

// ── 집계
const byFam = {};
for (const [, m] of Object.entries(mats)) byFam[m.family] = (byFam[m.family] || 0) + 1;
info.push(`R 재료 ${Rnodes.length} · 분류 ${Object.keys(mats).length}(${(Object.keys(mats).length / Rnodes.length * 100).toFixed(0)}%) · 핵심 ${core.length} · 서사 ${Object.keys(mats).length - core.length}`);
info.push(`성질 계열 ${Object.keys(families).length}: ${Object.entries(byFam).map(([f, n]) => `${f} ${n}`).join(" · ")}`);
info.push(`배선 교차검증: use.via ${wired}건 실재 확인 · 조합 행동 ${realCombines.length}(${realCombines.map((a) => a.id).join(", ")}) · 교차 계열 ${crossCombines.length}`);

for (const m of info) console.log("  " + m);
if (warnings.length) { console.log("\n경고:"); for (const w of warnings) console.log("  ⚠ " + w); }
if (errors.length) { console.error("\n검증 실패:"); for (const e of errors) console.error("  ✗ " + e); process.exit(1); }
console.log(`\n검증 통과 (D2 재료 다용도 감사) — 경고 ${warnings.length}건`);
