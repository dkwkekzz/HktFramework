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

const { graph, state } = loadWorld();
const varIdx = indexVars(state);
const actIdx = new Map((state.actions || []).map((a) => [a.id, a]));
const nodeTitle = new Map(graph.nodes.map((n) => [n.id, n.title || n.id]));
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
line(sawBlocked, "M5 막힘 — 결핍(허기·상처)으로 중노동(시추) 전제가 미충족되었다");
line(sawEatEmpty, "M5 소진 — 식량 0 에서 ACT_식사 가 전제 미충족으로 불발했다");
line(sawRefill, "M9 대안 — 사냥·채집으로 식량을 재충전했다(직관 기점)");
line(m9ok && huntSurplus.length > 0, "M9 보상 이중성 — 직관층 행동이 충족을 보증하고 사냥은 잉여(속털)를 심었다");

const m1Ok = sawPressure && sawBlocked && sawEatEmpty && sawRefill && m9ok && huntSurplus.length > 0;
if (ctx.errors.length) { console.error("\n엔진 오류:\n  " + ctx.errors.join("\n  ")); process.exit(1); }
console.log(`\n${m1Ok ? "동기층 M1 허기 루프 실증 통과" : "일부 미충족 — 위 판정 확인"} (플레이어 입력은 --at 스크립트로만, 압력·막힘은 전부 법칙·전제의 산물).`);

// ═══════════════════════════════════════════════════════════════════════
// M3 개인 스테이크 실증 (Design-Motive §4) — 세계의 위협이 '내 몸'으로 느껴지는가.
//   세계의 겨울 → 내 온기 ↓ → 인지.G1.3.1 · 세계의 늑대 → 내 상처 ↑ → 인지.G2.1
//   삼축 최악 겹침 → 쓰러짐(죽음 아닌 구조) · 온기·상처 충족(불쬐기·요양)
// ═══════════════════════════════════════════════════════════════════════
function fresh() { const s = buildInitial(state); recomputeDerived(s, varIdx); return { s, c: newCtx(state) }; }
function inj(x, t, actionId, target) { if (!x.c.inputs.has(t)) x.c.inputs.set(t, []); x.c.inputs.get(t).push({ actionId, actor: PLAYER, target }); }
const lab = (s, id) => { const v = varIdx.get(id); return (v?.kind === "level" && v.levels) ? `${v.levels[s[id]]}(${s[id]})` : String(s[id]); };

console.log("\n" + "═".repeat(74));
console.log("■ 검증 M3 — 개인 스테이크: 세계의 위협이 내 몸이 된다");

// M3a) 북방 노출 — 온기 하락 → 겨울 목적 인지, 상처 상승 → 늑대 목적 인지
let a = fresh();
if (!a.c.inputs.has(2)) a.c.inputs.set(2, []); a.c.inputs.get(2).push({ actionId: "ACT_이동", actor: PLAYER, target: "L_북방빙원" });
let coldCog = false, woundCog = false, coldMin = 3, woundMax = 0;
for (let t = 1; t <= 12; t++) {
  const fired = tick(a.s, state, a.c);
  coldMin = Math.min(coldMin, a.s[PLAYER + ".온기"]); woundMax = Math.max(woundMax, a.s[PLAYER + ".상처"]);
  if (a.s[PLAYER + ".인지.G1.3.1"] && !coldCog) { coldCog = true; console.log(`t${String(t).padStart(2)} | LAW_인지_추위 → 겨울 목적(G1.3.1) 인지  (온기=${lab(a.s, PLAYER + ".온기")})`); }
  if (a.s[PLAYER + ".인지.G2.1"] && !woundCog) { woundCog = true; console.log(`t${String(t).padStart(2)} | LAW_인지_습격 → 위협 목적(G2.1) 인지  (상처=${lab(a.s, PLAYER + ".상처")})`); }
}
console.log(`  → 북방 노출로 온기 최저 ${coldMin}(얼어붙음)·상처 최고 ${woundMax}(중상) — 세계의 겨울·늑대가 내 몸이 됐다`);

// M3c) 충족(회복 짝) — 거점/도시에서 불쬐기·요양이 온기·상처를 되돌린다(한기 없는 곳에서 깨끗이 실증)
let c1 = fresh();
c1.s[PLAYER + ".온기"] = 1;                                   // 도시(북방 아님) — LAW_한기 미발화
if (!c1.c.inputs.has(1)) c1.c.inputs.set(1, []); c1.c.inputs.get(1).push({ actionId: "ACT_불쬐기", actor: PLAYER });
for (let t = 1; t <= 3; t++) tick(c1.s, state, c1.c);
const warmRecovered = c1.s[PLAYER + ".온기"] > 1;
let c2 = fresh();
c2.s[PLAYER + ".상처"] = 2; c2.s["L_지열도시.거점"] = 1; c2.s["L_지열도시.거점확립"] = true;  // 거점 확립 = 습격피해 멎음(요양처)
if (!c2.c.inputs.has(1)) c2.c.inputs.set(1, []); c2.c.inputs.get(1).push({ actionId: "ACT_상처_요양", actor: PLAYER });
for (let t = 1; t <= 4; t++) tick(c2.s, state, c2.c);
const woundHealed = c2.s[PLAYER + ".상처"] < 2;
console.log(`충족: 불쬐기 온기 1→${c1.s[PLAYER + ".온기"]} · 요양 상처 2→${c2.s[PLAYER + ".상처"]} (거점 있을 때)`);

// M3b) 삼축 최악 → 쓰러짐(구조). 결정론 재현을 위해 최악 상태를 직접 조성한 뒤 한 틱.
let b = fresh();
b.s[PLAYER + ".위치"] = "L_북방빙원"; b.s[PLAYER + ".허기"] = 3; b.s[PLAYER + ".온기"] = 0; b.s[PLAYER + ".상처"] = 3;
recomputeDerived(b.s, varIdx);
const beforeLoc = b.s[PLAYER + ".위치"];
const fb = tick(b.s, state, b.c);
const collapsed = fb.rules.includes("LAW_쓰러짐") && b.s[PLAYER + ".위치"] === "L_지열도시" && beforeLoc !== "L_지열도시";
console.log(`쓰러짐: ${collapsed ? "발화" : "미발화"} — 위치 ${nodeTitle.get(beforeLoc)}→${nodeTitle.get(b.s[PLAYER + ".위치"])}, 삼축 구조 후 허기=${lab(b.s, PLAYER + ".허기")} 온기=${lab(b.s, PLAYER + ".온기")} 상처=${lab(b.s, PLAYER + ".상처")}`);

console.log("\n판정 (검증 M3):");
line(coldCog, "M3 개인화 — 북방에서 얼어(온기↓) 겨울 목적(G1.3.1)을 스스로 인지");
line(woundCog, "M3 개인화 — 늑대에 다쳐(상처↑) 위협 목적(G2.1)을 스스로 인지");
line(warmRecovered && woundHealed, "M3 충족 — 불쬐기가 온기를, 거점 요양이 상처를 되돌렸다(회복 짝)");
line(collapsed, "M3 쓰러짐 — 삼축 최악에서 죽지 않고 거점으로 구조됐다");

const m3Ok = coldCog && woundCog && warmRecovered && woundHealed && collapsed;

// ═══════════════════════════════════════════════════════════════════════
// M5 탐욕 실증 (Design-Motive §5.1) — 당기는 힘: 시세를 보고 경제에 진입한다.
//   수요 활성(값이 뛴다) → 기회 인지 → 채굴로 재화 획득 → 시세 따라 교역(희소=고가) → 금지령 충돌
// ═══════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(74));
console.log("■ 검증 M5 — 탐욕: 시세가 당긴다(게이지 아닌 기회)");
let e = fresh();
// 수요가 뜰 때까지 몇 틱(신살 무기 제작 진행 → R_심연유리.수요 파생 활성)
for (let t = 1; t <= 3; t++) tick(e.s, state, e.c);
const oppSeen = e.s[PLAYER + ".인지.G5.1"];
console.log(`기회 인지: 수요=${e.s["R_심연유리.수요"]} → 저널 「기회」 G5.1 = ${oppSeen ? "떴다(값이 뛴다)" : "안 뜸"}  [게이지 아닌 시세 단서]`);
// 채굴 기여 — 심연유리 재화 획득(공급 소모)
const supBefore = e.s["R_심연유리.공급"];
inj(e, e.c.t + 1, "ACT_채굴_기여"); for (let i = 0; i < 3; i++) tick(e.s, state, e.c);
inj(e, e.c.t + 1, "ACT_채굴_기여"); for (let i = 0; i < 3; i++) tick(e.s, state, e.c);
const mined = e.s[PLAYER + ".보유.R_심연유리"];
console.log(`채굴 기여: 보유 심연유리 0→${mined} · 공급 ${supBefore}→${e.s["R_심연유리.공급"]}(소모=사건 3 사슬 압력) · 기여 기록 ${e.s[PLAYER + ".기여.EV_심연유리호황"]}`);
// 시세 교역 — 희소(공급≤1)면 고가(식량 3), 풍부면 저가. 지금 공급 소모돼 희소일 것
const foodBefore = e.s[PLAYER + ".보유.R_식량"];
const highPrice = e.s["R_심연유리.공급"] <= 1;
inj(e, e.c.t + 1, highPrice ? "ACT_교역_유리팔기_고가" : "ACT_교역_유리팔기_저가");
for (let i = 0; i < 2; i++) tick(e.s, state, e.c);
const sold = e.s[PLAYER + ".보유.R_식량"] > foodBefore;
console.log(`시세 교역: 공급 ${e.s["R_심연유리.공급"]}(${highPrice ? "희소=고가" : "풍부=저가"}) → 심연유리를 팔아 식량 ${foodBefore}→${e.s[PLAYER + ".보유.R_식량"]}  [재화=결핍의 보험, 불변 12]`);
// 금지령 충돌 — 채굴금지 시 채굴 막힘(탐욕↔안전)
let z = fresh(); for (let t = 1; t <= 3; t++) tick(z.s, state, z.c);
z.s["R_심연유리.채굴금지"] = true;
inj(z, z.c.t + 1, "ACT_채굴_기여"); const fz = tick(z.s, state, z.c);
const banned = fz.skipped.some((s) => s.startsWith("ACT_채굴_기여"));
console.log(`금지령 충돌: 채굴금지=true → 채굴_기여 ${banned ? "막힘(탐욕↔안전 충돌)" : "발화(예상과 다름)"}`);

console.log("\n판정 (로드맵 M5 탐욕 · 검증 M6 진입 일부):");
line(oppSeen, "M5 기회 인지 — 시세(수요)를 보고 「기회」가 떴다(게이지 금지·단서로)");
line(mined >= 1, "M5 채굴 진입 — 호황의 심연유리를 캐 개인 재화·기여를 얻었다");
line(sold, "M5 시세 교역 — 공급에 따라 값이 갈리는 물물 교환으로 재화→식량(결핍 보험)");
line(banned, "M5 충돌 — 금지령 아래선 채굴이 막힌다(탐욕↔안전)");
const m5Ok = oppSeen && mined >= 1 && sold && banned;

const allOk = m1Ok && m3Ok && m5Ok;
console.log(`\n${allOk ? "동기층 M1+M3+M5 실증 통과" : "일부 미충족 — 위 판정 확인"} — 미는 결핍(허기·온기·상처)과 당기는 욕망(시세)이 병렬로 플레이어를 세계에 건다.`);
if (ctx.errors.length || e.c.errors.length || z.c.errors.length) { console.error("엔진 오류 발생"); process.exit(1); }
if (!allOk) process.exit(1);
