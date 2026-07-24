// D4 변환 커버리지 감사 (Design-Intuition §14·§20 D4·§21⑤ 최종 감사) — 저널에 뜨는 모든 목적이
// '지시'가 아니라 §14 변환 8항(상황+복수 가능성)으로 번역되어 있는가. D 시리즈의 최종 감사다.
//   C1  커버리지 — 모든 노출(인지) 목적이 objective-conversion.json 에 있다(고아 없음, 100%).
//   C2  8항 완비 — 각 항목이 §14 변환 8항(내부목적·욕망대상·작은방해·눈에띄는수단·간단한행동·
//       즉시보상·예상밖결과·다음목적)을 모두 채운다(빈칸=미완성, 특히 욕망대상·예상밖결과 §21①).
//   C3  해결 경로 ≥2 전수 — 노출 목적마다 실제 플레이어 해결 행동 ≥2(정합 5·§13 승격). 카탈로그
//       간단한행동도 실재 행동 id ≥2.
//   C4  참조 무결성 — 간단한행동 행동 id 실재 · 다음목적 은 실재 goal 이거나 '—'(종착).
//   C5  보상 연출 매핑 (E2) — 노출 목적의 모든 실제 플레이어 해결 행동이 그 목적의 간단한행동에
//       올라 있다. 클라이언트 즉시보상 연출(goalOfAction)은 이 목록으로 매핑되므로, 빠진 행동은
//       발화해도 보상 사슬이 침묵한다 — 화면 도달 감사.
// 실행: node data/validate-conversion.mjs
import { loadWorld, HERE } from "./load-world.mjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const { graph, state } = loadWorld();
const conv = JSON.parse(readFileSync(join(HERE, "objective-conversion.json"), "utf8"));
const errors = [], warnings = [], info = [];

const exposed = (state.vars || []).filter((v) => v.owner === "E_플레이어" && v.axis === "인지").map((v) => v.target);
const goalIds = new Set(graph.nodes.filter((n) => n.type === "G").map((n) => n.id));
const actionIds = new Set((state.actions || []).map((a) => a.id));
const entries = conv.objectives || {};
const SLOTS = ["내부목적", "욕망대상", "작은방해", "눈에띄는수단", "간단한행동", "즉시보상", "예상밖결과", "다음목적"];

// 실제 플레이어 해결 행동 수 (world 진실)
const solveCount = (goal) => (state.actions || []).filter((a) => a.objective === goal && (a.actor_type || []).includes("E_플레이어")).length;

// ── C1 커버리지
for (const g of exposed) if (!entries[g]) errors.push(`C1 커버리지: 노출 목적 ${g} 의 변환 항목이 없다(§14 미번역)`);
for (const g of Object.keys(entries)) if (!exposed.includes(g)) errors.push(`C1 고아: 변환 항목 ${g} 에 대응하는 인지 축(노출 목적)이 없다`);

for (const g of exposed) {
  const e = entries[g];
  if (!e) continue;
  // ── C2 8항 완비
  for (const s of SLOTS) {
    const val = e[s];
    const empty = val == null || (Array.isArray(val) ? val.length === 0 : String(val).trim() === "");
    if (empty) errors.push(`C2 8항 미완: ${g}.${s} 가 비었다 (§14 빈칸=미완성)`);
  }
  // ── C3 해결 경로 ≥2 전수 (world 진실 + 카탈로그)
  const wc = solveCount(g);
  if (wc < 2) errors.push(`C3 해결경로: 노출 목적 ${g} 의 실제 플레이어 해결 행동이 ${wc}개 (§13 ≥2 필요 — 정답 지시 대신 복수 가능성)`);
  const acts = Array.isArray(e?.간단한행동) ? e.간단한행동 : [];
  if (acts.length < 2) errors.push(`C3 카탈로그: ${g}.간단한행동 이 ${acts.length}개 (≥2 필요)`);
  // ── C4 참조 무결성
  for (const id of acts) if (!actionIds.has(id)) errors.push(`C4 참조: ${g}.간단한행동 의 ${id} 가 실재 행동이 아니다`);
  const nx = e?.다음목적;
  if (nx && nx !== "—" && !goalIds.has(nx)) errors.push(`C4 참조: ${g}.다음목적 '${nx}' 가 실재 goal 이 아니다(종착이면 '—')`);
  // ── C5 보상 연출 매핑 (E2 — 해결 행동 100% 즉시보상 연출)
  const solvers = (state.actions || []).filter((a) => a.objective === g && (a.actor_type || []).includes("E_플레이어"));
  for (const a of solvers) if (!acts.includes(a.id))
    errors.push(`C5 연출 매핑: 해결 행동 ${a.id} 이 ${g}.간단한행동 에 없다 — 발화해도 즉시보상 연출이 침묵한다(E2)`);
}

// ── 집계
const need = exposed.filter((g) => { const v = state.vars.find((x) => x.target === g && x.axis === "인지"); return true; });
const terminalNext = exposed.filter((g) => entries[g]?.다음목적 === "—");
info.push(`노출 목적 ${exposed.length} · 변환 ${Object.keys(entries).length}(${(Object.keys(entries).length / exposed.length * 100).toFixed(0)}%)`);
info.push(`해결 경로: ${exposed.map((g) => solveCount(g)).reduce((a, b) => a + b, 0)}개 (목적당 평균 ${(exposed.map((g) => solveCount(g)).reduce((a, b) => a + b, 0) / exposed.length).toFixed(1)}, 전수 ≥2)`);
info.push(`다음목적 사슬 ${exposed.length - terminalNext.length} · 종착 ${terminalNext.length}`);

for (const m of info) console.log("  " + m);
if (warnings.length) { console.log("\n경고:"); for (const w of warnings) console.log("  ⚠ " + w); }
if (errors.length) { console.error("\n검증 실패:"); for (const e of errors) console.error("  ✗ " + e); process.exit(1); }
console.log(`\n검증 통과 (D4 변환 커버리지 + E2 보상 연출 매핑 — 저널 모든 목적이 상황+복수 가능성으로 번역되고 모든 해결 행동에 즉시보상 연출이 매핑됨) — 경고 ${warnings.length}건`);
