// D0 늦은 진입자 프로브 (Design-Intuition §20 D0 검증) — "살아있는 채로 유지되는 세계" 실측.
//
// 진단(progress/intuition.md 단절 1)의 사각지대를 닫는다: 기존 검증(M5·M9·walk)은 전부 세계 나이
// t=0 조인만 봐서 "첫 1분의 드라마"에 통과하지만, 수 분 뒤 진입한 플레이어(늦은 진입자)에게
// 세계가 박물관이 되는지는 아무도 재지 않았다. 이 프로브는 세계를 무입력으로 T0 틱 굴린 뒤,
// 그 시점에 갓 도착한 플레이어의 감각을 재현해(결핍·인지 리셋 = 처음 겪는 눈) W 틱을 관찰한다.
//
//   판정 D0 (셋 다 초록이어야 세계 재장전 성공):
//     ① 압력 법칙 ≥1 작동   — 관찰창 W 틱 안에 위협·결핍 압력 법칙이 실제로 발화한다
//                              (세계가 늦은 진입자에게도 압력을 만든다 — 자가소진 아님)
//     ② 필요(need) ≥1        — 늦은 진입자가 W 틱 안에 결핍·위협을 스스로 인지한다(저널 「필요」)
//                              그중 ≥1 은 위협 기원(습격·추위) — 허기만으론 부족(세계가 위험을 준다)
//     ③ 기회(opportunity) ≥1 — 경제·세력·힘 단서가 T0 에도 살아 있어 「기회」가 뜬다(호황이 소진 안 됨)
//
// 늦은 진입자 모델: T0 시점 스냅샷에서 플레이어 결핍(허기·온기·상처)과 플레이어 인지 once 를
//   init 으로 되돌린다(= 갓 도착해 아직 아무것도 겪지 않은 눈). 세계 자체(생태·경제·세력·사건)는
//   손대지 않는다 — 오직 "이 살아있(어야 하)는 세계가 새 눈에게 무엇을 겪게 하는가"만 잰다.
//   압력·기회가 뜨지 않으면 그것은 진입자의 문제가 아니라 세계가 소진된 것이다.
//
// 실행: node data/simulate-latejoin.mjs [--at 300] [--window 60] [--verbose]
import { buildInitial, recomputeDerived, newCtx, tick, indexVars } from "./state-engine.mjs";
import { loadWorld } from "./load-world.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; };
const has = (name) => argv.includes(name);
const T0 = Number(opt("--at", 300));      // 늦은 진입 시점(세계 나이)
const W = Number(opt("--window", 60));    // 관찰창(진입 후 몇 틱을 보는가)
const VERBOSE = has("--verbose");

const { graph, state } = loadWorld();
const varIdx = indexVars(state);
const PLAYER = "E_플레이어";

// 압력 법칙 = 결핍·위협을 만드는 법칙(회복/균형/사슬 진행 아님). 세계가 진입자에게 쓰는 힘.
const PRESSURE_LAWS = new Set([
  "LAW_허기", "LAW_한기", "LAW_습격피해",          // 결핍 삼축(미는 힘)
  "RULE_늑대_기근", "LAW_늑대_방목압",              // 늑대 위협 재발화 사이클
  "LAW_카르마_흡수",                                 // 강 위협 재확장
  "LAW_구름고래_항로교란", "LAW_기억나방_폭풍피해",  // 클럭 위협
  "LAW_M_지배오염", "LAW_역병_확산",                 // 질병 압력
]);
// 위협 기원 인지(결핍 단순 허기와 구분) — 세계가 '위험'을 겪게 했다는 증거
const THREAT_COGS = new Set(["E_플레이어.인지.G2.1", "E_플레이어.인지.G1.3.1"]);
// 기회 인지(당기는 힘) — 경제·세력·힘 단서가 살아 있어야 뜬다
const OPP_COGS = ["E_플레이어.인지.G5.1", "E_플레이어.인지.G6.1", "E_플레이어.인지.G3.2.1"];
const NEED_COGS = ["E_플레이어.인지.G1.1.1", "E_플레이어.인지.G2.1", "E_플레이어.인지.G1.3.1"];

// 플레이어 인지 once 법칙 — 늦은 진입자 리셋 시 재무장(갓 도착한 눈으로 다시 겪게)
const PLAYER_COG_LAWS = ["LAW_인지_허기", "LAW_인지_습격", "LAW_인지_추위", "LAW_인지_시세", "LAW_인지_모집", "LAW_인지_신살"];

const snap = buildInitial(state);
recomputeDerived(snap, varIdx);
const ctx = newCtx(state);

// ── 세계를 무입력으로 T0 틱 굴린다(늦은 진입자가 도착하기까지의 세계 역사) ──────────
const pressureBefore = new Set();
for (let t = 1; t <= T0; t++) {
  const fired = tick(snap, state, ctx);
  for (const r of fired.rules) if (PRESSURE_LAWS.has(r)) pressureBefore.add(r);
}
if (ctx.errors.length) { console.error("엔진 오류(T0 주행):\n  " + ctx.errors.join("\n  ")); process.exit(1); }

console.log(`■ D0 늦은 진입자 프로브 — 세계 나이 t=${T0} 도착, 이후 ${W}틱 관찰`);
console.log("─".repeat(74));
// 진입 시점 세계 상태 요지
const worldSnapshot = [
  ["늑대", snap["E_회색등늑대.개체수"]], ["숲먹이", snap["L_재의숲.먹이"]],
  ["늑대공격", snap["X_늑대공격.활성"]], ["카르마서식", snap["E_카르마.서식"]],
  ["심연유리수요", snap["R_심연유리.수요"]], ["검은태양병", snap["X_검은태양병.강도"]],
  ["아르카론잠식", snap["E_아르카론.잠식"]],
];
console.log("진입 시점 세계:", worldSnapshot.map(([k, v]) => `${k}=${v}`).join(" · "));
console.log(`T0 까지 발화한 압력 법칙: ${[...pressureBefore].join(", ") || "(없음 — 이미 소진)"}`);

// ── 늦은 진입자 도착: 결핍·인지 리셋(갓 도착한 눈) ──────────────────────────────
for (const v of state.vars || []) {
  if (v.scope !== "player") continue;
  if (v.axis === "허기" || v.axis === "온기" || v.axis === "상처" || v.axis === "인지") snap[v.id] = v.init;
}
for (const id of PLAYER_COG_LAWS) snap[id + ".발화됨"] = false;  // 인지 once 재무장
recomputeDerived(snap, varIdx);
console.log(`\n늦은 진입자 도착 — 결핍·인지 리셋(허기=${snap[PLAYER + ".허기"]} 온기=${snap[PLAYER + ".온기"]} 상처=${snap[PLAYER + ".상처"]}, 인지 전부 미지)`);
console.log("─".repeat(74));

// ── 관찰창 W 틱 (무입력 — 플레이어는 세계를 겪기만 한다) ────────────────────────
const firedPressure = new Set();
const gainedNeed = [];       // [id, t]
const gainedThreatNeed = [];
const gainedOpp = [];
const seen = new Set();
for (let t = 1; t <= W; t++) {
  const before = {};
  for (const id of [...NEED_COGS, ...OPP_COGS]) before[id] = snap[id];
  const fired = tick(snap, state, ctx);
  const at = T0 + t;
  for (const r of fired.rules) if (PRESSURE_LAWS.has(r)) firedPressure.add(r);
  for (const id of NEED_COGS) if (!before[id] && snap[id] && !seen.has(id)) {
    seen.add(id); gainedNeed.push([id, at]); if (THREAT_COGS.has(id)) gainedThreatNeed.push([id, at]);
  }
  for (const id of OPP_COGS) if (!before[id] && snap[id] && !seen.has(id)) { seen.add(id); gainedOpp.push([id, at]); }
  if (VERBOSE) {
    const ev = [...fired.rules.filter((r) => PRESSURE_LAWS.has(r)), ...fired.clocks];
    if (ev.length) console.log(`  t${at} | ${ev.join(" · ")}`);
  }
}
if (ctx.errors.length) { console.error("엔진 오류(관찰창):\n  " + ctx.errors.join("\n  ")); process.exit(1); }

const cogTitle = (id) => id.replace("E_플레이어.인지.", "");
console.log(`\n관찰 결과 (${W}틱):`);
console.log(`  압력 법칙 발화: ${[...firedPressure].join(", ") || "(없음!)"}`);
console.log(`  필요(need) 인지: ${gainedNeed.map(([id, t]) => `${cogTitle(id)}@t${t}`).join(", ") || "(없음!)"}`);
console.log(`    └ 위협 기원: ${gainedThreatNeed.map(([id, t]) => `${cogTitle(id)}@t${t}`).join(", ") || "(없음 — 허기뿐)"}`);
console.log(`  기회(opportunity) 인지: ${gainedOpp.map(([id, t]) => `${cogTitle(id)}@t${t}`).join(", ") || "(없음!)"}`);

const line = (ok, msg) => console.log(`  ${ok ? "✔" : "✗"} ${msg}`);
console.log("\n판정 (검증 D0 — 늦은 진입자에게도 살아있는 세계):");
const okPressure = firedPressure.size >= 1;
const okNeed = gainedNeed.length >= 1 && gainedThreatNeed.length >= 1;
const okOpp = gainedOpp.length >= 1;
line(okPressure, `① 압력 법칙 ≥1 작동 — ${firedPressure.size}종 발화 (세계가 늦은 진입자에게 압력을 만든다)`);
line(okNeed, `② 필요 ≥1(위협 기원 포함) — need ${gainedNeed.length}·위협 ${gainedThreatNeed.length} (세계가 위험을 겪게 한다)`);
line(okOpp, `③ 기회 ≥1 — opp ${gainedOpp.length} (경제·세력·힘 단서가 T0 에도 살아 있다)`);

const allOk = okPressure && okNeed && okOpp;
console.log(`\n${allOk ? "✅ D0 통과 — 세계가 t=" + T0 + " 늦은 진입자에게도 살아있다(재장전 성공)" : "❌ D0 미달 — 세계가 소진돼 늦은 진입자에게 박물관이다(위 ✗ 확인)"}`);
if (!allOk) process.exit(1);
