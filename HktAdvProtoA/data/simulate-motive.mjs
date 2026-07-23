// 동기층 M1 실증 시뮬레이터 (Design-Motive §11 검증 M5·M9) — 허기 루프를 헤드리스로 굴려
// "방치하면 굶주리고, 굶주리면 막히고, 먹으면 풀리고, 먹을 것을 구하는 길에 다음 문이 보인다"를 실측한다.
//
//   검증 M5  무개입 방치 → 압력 법칙(LAW_허기) 발화 → 허기 도달 → 중노동 행동 전제 미충족(막힘)
//   검증 M9  직관 기점 도달 + 보상 이중성 — 직관층 행동(식사·사냥·채집)이 즉각 체감 보상(충족)을
//            보증하고, 사냥은 잉여(속털)까지 준다. 식량 소진 시 ACT_식사 전제 미충족 → 사냥·채집으로 재충전.
//
// 실행: node data/simulate-motive.mjs [--ticks 40]
import { buildInitial, recomputeDerived, newCtx, tick, indexVars, evalPred, subst } from "./state-engine.mjs";
import { loadWorld } from "./load-world.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const TICKS = Number(opt("--ticks", 40));

const { state } = loadWorld();
const varIdx = indexVars(state);
const actIdx = new Map((state.actions || []).map((a) => [a.id, a]));
const PLAYER = "E_플레이어";

const HEAVY = "ACT_지열정_시추";           // 중노동 표본(when: 에너지<1 ∧ 허기≤보통) — 시작부터 허기만 전제
const EAT = "ACT_식사", HUNT = "ACT_초식동물_사냥", GATHER = "ACT_유리열매_채집";

const snap = buildInitial(state);
recomputeDerived(snap, varIdx);
const ctx = newCtx(state);

// ── 정적 검사: 직관층 3행동이 즉각 체감 보상(E_플레이어.* 개선 ∨ 보유 증가)을 보증하는가 (검증 M9 충족)
function immediateReward(a) {
  const gains = [];
  for (const e of [...(a.then || [])]) {
    const v = varIdx.get(subst(e.var, PLAYER));
    if (!v) continue;
    const isPlayer = v.owner === PLAYER;
    const 보유증가 = v.axis === "보유" && e.op === "add" && e.value > 0;
    const 상태개선 = isPlayer && ((e.op === "add" && e.value < 0 && v.axis === "허기") || 보유증가); // 허기↓ = 개선
    if (상태개선 || 보유증가) gains.push(`${e.var}${e.op === "add" ? (e.value > 0 ? "+" : "") + e.value : ""}`);
  }
  return gains;
}
console.log("■ 검증 M9 — 직관층 행동의 즉각 체감 보상(충족) 정적 검사");
let m9ok = true;
for (const id of [EAT, HUNT, GATHER]) {
  const a = actIdx.get(id);
  const gains = a ? immediateReward(a) : [];
  const ok = gains.length >= 1;
  m9ok = m9ok && ok;
  console.log(`  ${ok ? "✔" : "✗"} ${id.padEnd(18)} 충족: ${gains.join(", ") || "없음(위반!)"}`);
}
// 잉여(보상 이중성) — 사냥이 식량 외 부산물을 주는가 (불변 14 잉여 후보)
const huntSurplus = (actIdx.get(HUNT)?.then || []).filter((e) => {
  const v = varIdx.get(e.var); return v && v.owner !== PLAYER && v.axis === "보유" && e.op === "add" && e.value > 0;
});
console.log(`  ${huntSurplus.length ? "✔" : "✗"} ${HUNT} 잉여: ${huntSurplus.map((e) => e.var).join(", ") || "없음"} (보상 이중성 — 겨울 대비 지렛대, 불변 12·14)`);

function label(id) { const v = varIdx.get(id); const val = snap[id]; return (v?.kind === "level" && v.levels) ? `${v.levels[val]}(${val})` : String(val); }
function unmetReasons(id) {
  const a = actIdx.get(id); const out = [];
  const walk = (p) => { if (!p) return; if (p.all) return p.all.forEach(walk);
    if (!evalPred(p, snap, PLAYER)) out.push(`${subst(p.var, PLAYER)} ${p.op} ${p.value}`); };
  walk(a.when); for (const c of a.cost || []) if (!evalPred({ var: c.var, op: ">=", value: -c.value }, snap, PLAYER)) out.push(`비용 부족 ${subst(c.var, PLAYER)}`);
  return out;
}
const fireable = (id) => unmetReasons(id).length === 0;
function inject(t, actionId, target) {
  if (!ctx.inputs.has(t)) ctx.inputs.set(t, []);
  ctx.inputs.get(t).push({ actionId, actor: PLAYER, target });
}

// ── 시나리오 ────────────────────────────────────────────────────────
// t3    사냥(초식동물 아직 있음) — 충족=식량 +1, 잉여=속털 +1 을 라이브로 실증(보상 이중성).
// Phase A(방치): t1~t23 무개입 — LAW_허기 로 허기가 오른다. 굶주리면 중노동(시추)이 막힌다.
// Phase B(충족): 보유 식량으로 식사 → 허기 하락 → 시추 재개방. 식량 소진.
// Phase C(막힘→대안): 식량 0 이면 ACT_식사 전제 미충족 → 사냥은 짐승이 없어 막히고(대안 강제) → 해안 채집으로 재충전.
inject(3, HUNT);                                        // 초식동물 생존 중 사냥 — 충족+잉여 라이브
inject(24, EAT); inject(26, EAT); inject(28, EAT);      // Phase B: 비축 식량 소진(굶주림 완화)
inject(30, EAT);                                        // Phase C: 식량 0 → 미발화(전제 미충족) 실측
inject(32, HUNT);                                       // 짐승이 없어 사냥도 막힌다(막힘의 발견)
inject(34, "ACT_이동", "L_침몰해안");                    // 먹을 것을 구하러 해안으로
inject(37, GATHER);                                     // 유리열매 채집(충족=식량 +1) — 대안 경로
inject(39, EAT);                                        // 재충전한 식량으로 식사

console.log(`\n■ 검증 M5 — 방치→압력→막힘, 충족→해소, 소진→대안 (${TICKS}틱)`);
console.log(`초기: 허기=${label(PLAYER + ".허기")} 식량=${snap[PLAYER + ".보유.R_식량"]} · 중노동(${HEAVY}) 발화가능=${fireable(HEAVY)}`);
console.log("─".repeat(74));

const track = [PLAYER + ".허기", PLAYER + ".보유.R_식량", "R_속털.보유", "E_초식동물.개체수", PLAYER + ".위치"];
let prev = {}; for (const id of track) prev[id] = snap[id];
let sawPressure = false, sawBlocked = false, sawEatEmpty = false, sawRefill = false;
let heavyBlockedShown = false;

for (let t = 1; t <= TICKS; t++) {
  const beforeHeavy = fireable(HEAVY);
  const fired = tick(snap, state, ctx);
  const changes = track.filter((id) => snap[id] !== prev[id]).map((id) => `${id.split(".").slice(-1)[0]}=${label(id)}`);
  const events = [...fired.rules, ...fired.actions];
  if (fired.rules.includes("LAW_허기")) sawPressure = true;
  if (fired.skipped.length) {
    console.log(`t${String(t).padStart(2)} | ✗ 입력 불발: ${fired.skipped.join(" · ")}  (전제 미충족 실측)`);
    if (fired.skipped.some((s) => s.startsWith(EAT))) sawEatEmpty = true;
  }
  if (events.length || changes.length) console.log(`t${String(t).padStart(2)} | ${events.join(" · ") || "-"}${changes.length ? "  ⇒ " + changes.join(" ") : ""}`);
  // 중노동 막힘의 순간 포착
  if (beforeHeavy && !fireable(HEAVY) && !heavyBlockedShown) {
    console.log(`     ↳ 중노동 막힘: ${HEAVY} 전제 미충족 — ${unmetReasons(HEAVY).join(", ")}  (굶주리면 못 한다)`);
    sawBlocked = true; heavyBlockedShown = true;
  }
  if (fired.actions.some((s) => s.startsWith(GATHER) || s.startsWith(HUNT))) {
    // 재충전 = 식량 보유가 실제로 늘어난 사냥/채집 (효과 적용 틱)
    if (snap[PLAYER + ".보유.R_식량"] > (prev[PLAYER + ".보유.R_식량"] ?? 0)) sawRefill = true;
  }
  for (const id of track) prev[id] = snap[id];
}

console.log("─".repeat(74));
console.log("최종:", track.map((id) => `${id.split(".").slice(-1)[0]}=${label(id)}`).join(" · "));
console.log(`중노동(${HEAVY}) 발화가능 = ${fireable(HEAVY)} (충족 후 재개방)`);

console.log("\n판정 (검증 M5·M9):");
const line = (ok, msg) => console.log(`  ${ok ? "✔" : "✗"} ${msg}`);
line(sawPressure, "M5 압력 발화 — LAW_허기 가 방치 중 허기를 올렸다");
line(sawBlocked, "M5 막힘 — 굶주려 중노동(시추) 전제가 미충족되었다");
line(sawEatEmpty, "M5 소진 — 식량 0 에서 ACT_식사 가 전제 미충족으로 불발했다");
line(sawRefill, "M9 대안 — 사냥·채집으로 식량을 재충전했다(직관 기점)");
line(m9ok && huntSurplus.length > 0, "M9 보상 이중성 — 직관층 행동이 충족을 보증하고 사냥은 잉여(속털)를 심었다");

const allOk = sawPressure && sawBlocked && sawEatEmpty && sawRefill && m9ok && huntSurplus.length > 0;
if (ctx.errors.length) { console.error("\n엔진 오류:\n  " + ctx.errors.join("\n  ")); process.exit(1); }
console.log(`\n${allOk ? "동기층 M1 허기 루프 실증 통과" : "일부 미충족 — 위 판정 확인"} (플레이어 입력은 --at 스크립트로만, 압력·막힘은 전부 법칙·전제의 산물).`);
if (!allOk) process.exit(1);
