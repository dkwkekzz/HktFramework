// 표현 정합 검증기 (Design-MMO §7) — world-map.json · world-visual.json 이 상태·법칙과 어긋나지 않는지 점검.
//   V1  지도: 그래프 L 노드 ↔ 지역 배치 전단사, 인접 대칭·참조 무결
//   V2  표현 커버리지: 모든 상태 변수가 사전 항목을 갖는다 (none 은 reason 필수, 중복·고아 금지)
//   V3  연대기 커버리지: 모든 법칙·행동·목적(생애 문장)·시계(on/off)에 번역문
//   V4  참조 무결성: 사전·fx 의 var/region/feature/channel/kind 가 전부 선언된 것
//   V6  사슬 가시성: EV 단계를 쓰는 법칙 전부에 fx (보이지 않는 사건 단계 금지)
// 실행: node data/validate-visual.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadWorld } from "./state-engine.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const { graph, state } = loadWorld(HERE);
const map = JSON.parse(readFileSync(join(HERE, "world-map.json"), "utf8"));
const visual = JSON.parse(readFileSync(join(HERE, "world-visual.json"), "utf8"));

const errors = [];
const warns = [];

// ── V1 지도 ──────────────────────────────────────────────────────────
const graphL = new Set(graph.nodes.filter((n) => n.type === "L").map((n) => n.id));
const regionIds = new Set((map.regions || []).map((r) => r.id));
const featureIds = new Set((map.features || []).map((f) => f.id));
for (const id of graphL) if (!regionIds.has(id)) errors.push(`V1: 그래프 L 노드 ${id} 의 지도 배치가 없다`);
for (const r of map.regions || []) {
  if (!graphL.has(r.id)) errors.push(`V1: 지도 지역 ${r.id} 가 그래프에 없다 (근거 없는 지역 금지)`);
  if (!Array.isArray(r.pos) || r.pos.length !== 2 || r.pos.some((v) => v < 0 || v > 100))
    errors.push(`V1: ${r.id} pos 가 0..100 범위의 [x,y] 가 아니다`);
  if (!r.basis) errors.push(`V1: ${r.id} 에 배치 근거(basis)가 없다`);
  if (!map.meta?.terrains?.[r.terrain]) errors.push(`V1: ${r.id} terrain '${r.terrain}' 이 meta.terrains 에 없다`);
  for (const adj of r.adjacent || []) {
    if (!regionIds.has(adj)) errors.push(`V1: ${r.id} 인접 ${adj} 가 지도에 없다`);
    else {
      const other = map.regions.find((x) => x.id === adj);
      if (!(other.adjacent || []).includes(r.id)) errors.push(`V1: 인접 비대칭 — ${r.id}→${adj} 만 있고 역방향이 없다`);
    }
  }
}
for (const f of map.features || []) if (!f.basis) errors.push(`V1: feature ${f.id} 에 basis 가 없다`);

// ── V2 표현 커버리지 ─────────────────────────────────────────────────
const channels = new Set(Object.keys(visual.meta?.channels || {}));
const varIds = new Set((state.vars || []).map((v) => v.id));
const entryByVar = new Map();
for (const e of visual.vars || []) {
  if (entryByVar.has(e.var)) errors.push(`V2: ${e.var} 사전 항목 중복`);
  entryByVar.set(e.var, e);
  if (!varIds.has(e.var)) errors.push(`V2: 사전 항목 ${e.var} 가 선언되지 않은 변수다 (고아 항목)`);
  if (!channels.has(e.channel)) errors.push(`V2: ${e.var} channel '${e.channel}' 이 meta.channels 에 없다`);
  if (e.channel === "none" && !e.reason) errors.push(`V2: ${e.var} 는 비표현(none)인데 reason 이 없다 (침묵 누락 금지)`);
  if (e.channel !== "none" && !e.basis) errors.push(`V2: ${e.var} 에 basis 가 없다`);
}
for (const v of state.vars || []) if (!entryByVar.has(v.id)) errors.push(`V2: 변수 ${v.id} 의 표현 사전 항목이 없다`);

// ── V3 연대기 커버리지 ───────────────────────────────────────────────
const ch = visual.chronicle || {};
for (const r of state.rules || []) if (!ch.rules?.[r.id]) errors.push(`V3: 법칙 ${r.id} 의 연대기 문장이 없다`);
for (const a of state.actions || []) if (!ch.actions?.[a.id]) errors.push(`V3: 행동 ${a.id} 의 연대기 문장이 없다`);
for (const o of state.objectives || []) {
  const entry = ch.objectives?.[o.id];
  if (!entry) { errors.push(`V3: 목적 ${o.id} 의 연대기 항목이 없다`); continue; }
  for (const phase of ["발견", "진행", "완료"]) if (!entry[phase]) errors.push(`V3: ${o.id} 의 '${phase}' 문장이 없다`);
  if (o.fail && !entry["실패"]) errors.push(`V3: ${o.id} 는 fail 이 있는데 '실패' 문장이 없다`);
}
for (const c of state.clocks || []) {
  const entry = ch.clocks?.[c.id];
  if (!entry?.on || !entry?.off) errors.push(`V3: 시계 ${c.id} 의 on/off 문장이 없다`);
}
const known = new Set([
  ...(state.rules || []).map((r) => r.id), ...(state.actions || []).map((a) => a.id),
  ...(state.objectives || []).map((o) => o.id), ...(state.clocks || []).map((c) => c.id),
]);
for (const sect of ["rules", "actions", "objectives", "clocks"])
  for (const id of Object.keys(ch[sect] || {})) if (!known.has(id)) warns.push(`V3: 연대기 고아 항목 ${sect}.${id} (해당 id 없음)`);

// ── V4 참조 무결성 (사전 region · fx) ────────────────────────────────
const varIdx = new Map((state.vars || []).map((v) => [v.id, v]));
for (const e of visual.vars || []) {
  if (e.region == null) continue;
  if (e.region === "@ref") {
    if (varIdx.get(e.var)?.kind !== "ref") errors.push(`V4: ${e.var} 는 ref 축이 아닌데 region '@ref' 를 쓴다`);
  } else if (!regionIds.has(e.region) && !featureIds.has(e.region)) {
    errors.push(`V4: ${e.var} region '${e.region}' 이 지도에 없다`);
  }
}
const fxKinds = new Set(Object.keys(visual.meta?.fxKinds || {}));
for (const [id, fx] of Object.entries(visual.fx || {})) {
  if (!known.has(id)) errors.push(`V4: fx ${id} 가 법칙·행동 어디에도 없다`);
  if (!fxKinds.has(fx.kind)) errors.push(`V4: fx ${id} kind '${fx.kind}' 가 meta.fxKinds 에 없다`);
  if (fx.region !== "global" && !regionIds.has(fx.region) && !featureIds.has(fx.region))
    errors.push(`V4: fx ${id} region '${fx.region}' 이 지도에 없다`);
}

// ── V6 사슬 가시성 ───────────────────────────────────────────────────
const evWriters = (state.rules || []).filter((r) => (r.then || []).some((e) => /^EV_.+\.단계$/.test(e.var)));
for (const r of evWriters) if (!visual.fx?.[r.id]) errors.push(`V6: 사건 단계를 쓰는 법칙 ${r.id} 에 fx 가 없다 (보이지 않는 사건 단계 금지)`);
for (const v of state.vars || [])
  if (/^EV_.+\.단계$/.test(v.id) && entryByVar.get(v.id)?.max == null)
    warns.push(`V6: 사건 게이지 ${v.id} 에 max 가 없다 (게이지 눈금 표시 불가)`);

// ── 결과 ─────────────────────────────────────────────────────────────
const nCover = [...entryByVar.values()].filter((e) => e.channel !== "none").length;
console.log(`지도: 지역 ${regionIds.size} (그래프 L ${graphL.size}) · feature ${featureIds.size}`);
console.log(`표현 커버리지: 변수 ${varIds.size} 중 표현 ${nCover} · 비표현(사유 명시) ${varIds.size - nCover}`);
console.log(`연대기: 법칙 ${Object.keys(ch.rules || {}).length} · 행동 ${Object.keys(ch.actions || {}).length} · 목적 ${Object.keys(ch.objectives || {}).length} · 시계 ${Object.keys(ch.clocks || {}).length}`);
console.log(`fx: ${Object.keys(visual.fx || {}).length} (EV 단계 법칙 ${evWriters.length} 전부 포함 여부는 V6)`);
for (const w of warns) console.warn("경고 — " + w);
if (errors.length) {
  console.error(`\n실패 ${errors.length}건:`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}
console.log(`\n검증 통과 (V1·V2·V3·V4·V6) — 경고 ${warns.length}건`);
