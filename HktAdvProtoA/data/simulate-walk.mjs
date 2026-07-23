// §10 재배선 완주 실증 (Design-Motive §10·§1) — M1~M4 가 한 줄기 상향 사슬로 이어지는가.
//   "교두보를 왜 세워?"의 재배선: 세계 술어로 게이지에 뜨던 G4.2 를, 내 결핍(허기)에서 출발해
//   개인 경험(상처)·정보 루프(묻기)를 거쳐 '기회'로 인지하고 → 삼축을 관리하며 → 손으로 완주한다.
//   반응형 봇(매 틱 상태를 보고 결정)이 걷는다 — 고정 스크립트가 아니라 규칙이 길을 만든다.
// 실행: node data/simulate-walk.mjs
import { buildInitial, recomputeDerived, newCtx, tick, indexVars } from "./state-engine.mjs";
import { loadWorld } from "./load-world.mjs";

const { graph, state } = loadWorld();
const varIdx = indexVars(state);
const nodeTitle = new Map(graph.nodes.map((n) => [n.id, n.title || n.id]));
const P = "E_플레이어";
const MAX = 80;

const snap = buildInitial(state);
snap[P + ".보유.R_식량"] = 8;            // 봇이 식량을 넉넉히 챙겨 출발(허기 압력은 유지, 미시 채집은 M1 에서 실증됨)
recomputeDerived(snap, varIdx);
const ctx = newCtx(state);
const g = (id) => snap[id];
const loc = () => snap[P + ".위치"];
const free = () => (ctx.busy[P] ?? 0) <= ctx.t;
const lvl = (id) => { const v = varIdx.get(id); return (v?.levels ? v.levels[snap[id]] : snap[id]); };

// 반응형 봇 — 우선순위대로 다음 한 행동을 고른다(규칙이 길을 만든다). null=대기.
function decide() {
  const H = g(P + ".허기"), W = g(P + ".상처"), food = g(P + ".보유.R_식량");
  const asked = g(P + ".인지.G4.2"), camp = g("L_지열도시.거점");
  const reclaim = g("L_폭풍절벽.개척"), storm = g("X_별빛폭풍.활성"), estab = g("L_폭풍절벽.개척확립");
  if (estab) return null;                                             // 목표 달성
  if (H >= 2 && food >= 1) return { actionId: "ACT_식사" };            // 1) 배고프면 먹는다(중노동 전제 유지)
  if (food === 0 && H >= 1)                                           // 2) 식량 소진 시 해안 채집
    return loc() === "L_침몰해안" ? { actionId: "ACT_유리열매_채집" } : { actionId: "ACT_이동", target: "L_침몰해안" };
  if (!asked)                                                         // 3) 아직 못 들었으면 상인연합에 묻는다
    return loc() === "L_지열도시" ? { actionId: "ACT_묻다_상인연합_변방" } : { actionId: "ACT_이동", target: "L_지열도시" };
  if (W >= 2) {                                                       // 4) 상처가 깊으면 거점 마련 후 요양(탐사 전제)
    if (loc() !== "L_지열도시") return { actionId: "ACT_이동", target: "L_지열도시" };
    return camp < 1 ? { actionId: "ACT_야영지_설치" } : { actionId: "ACT_상처_요양" };
  }
  if (H <= 1 && W <= 1) {                                             // 5) 삼축 안정 → 변방 개척 완주
    if (loc() !== "L_폭풍절벽") return { actionId: "ACT_이동", target: "L_폭풍절벽" };
    if (storm) return null;                                          // 폭풍 중엔 못 건넌다(막힘 — 대기)
    if (reclaim < 1) return { actionId: "ACT_변방_탐사" };
    if (reclaim === 1) return { actionId: "ACT_교두보_구축" };
  }
  return null;
}

// 이정표
const M = { hunger: 0, wound: 0, opp: 0, blockedStorm: 0, explore: 0, done: 0 };
const say = (t, s) => console.log(`t${String(t).padStart(2)} | ${s}`);
console.log("§10 완주 — 봇이 허기에서 출발해 '변방 개척(G4.2)'을 완주한다");
console.log(`초기: 위치=${nodeTitle.get(loc())} 허기=${lvl(P + ".허기")} 상처=${lvl(P + ".상처")} 식량=${g(P + ".보유.R_식량")}`);
console.log("─".repeat(74));

let lastAct = "";
for (let t = 1; t <= MAX && !g("L_폭풍절벽.개척확립"); t++) {
  if (free()) {
    const act = decide();
    if (act) { ctx.inputs.set(t, [{ actionId: act.actionId, actor: P, target: act.target }]); lastAct = act.actionId + (act.target ? `>${nodeTitle.get(act.target)}` : ""); }
  }
  const fired = tick(snap, state, ctx);
  if (process.env.DBG && (fired.actions.some((s) => s.includes("@" + P)) || fired.skipped.some((s) => s.includes("@" + P))))
    console.log(`   dbg t${t} act=[${fired.actions.filter((s) => s.includes("@" + P))}] skip=[${fired.skipped}] 개척=${g("L_폭풍절벽.개척")} 허기=${g(P + ".허기")} 상처=${g(P + ".상처")} 폭풍=${g("X_별빛폭풍.활성")} busy=${ctx.busy[P]}`);
  // 이정표 포착
  if (!M.hunger && g(P + ".인지.G1.1.1")) { M.hunger = t; say(t, `① 허기를 겪어 '식량 확보'(G1.1.1)를 스스로 인지  [허기=${lvl(P + ".허기")}]`); }
  if (!M.wound && g(P + ".인지.G2.1")) { M.wound = t; say(t, `② 늑대에 다쳐 '위협 해소'(G2.1)를 인지  [상처=${lvl(P + ".상처")}]`); }
  if (!M.opp && g(P + ".인지.G4.2")) { M.opp = t; say(t, `③ 상인연합에게 들어 '변방 개척'(G4.2)을 기회로 인지  ★ "교두보를 왜?"의 재배선`); }
  if (M.opp && !M.blockedStorm && loc() === "L_폭풍절벽" && g("X_별빛폭풍.활성") && g(P + ".허기") <= 1 && g(P + ".상처") <= 1) { M.blockedStorm = t; say(t, `④ 변방 절벽 도착 — 별빛폭풍에 막혀 대기(폭풍 중엔 못 건넌다)`); }
  if (!M.explore && g("L_폭풍절벽.개척") >= 1) { M.explore = t; say(t, `⑤ 폭풍이 지나가 변방 탐사 성공(개척 시작)`); }
  if (fired.actions.some((s) => s.startsWith("ACT_교두보_구축"))) say(t, `⑥ 교두보 구축 착수`);
  if (!M.done && g("L_폭풍절벽.개척확립")) { M.done = t; say(t, `⑦ 개척 완료 — G4.2 달성! 개척=${lvl("L_폭풍절벽.개척")}·확립=${g("L_폭풍절벽.개척확립")}`); }
}

console.log("─".repeat(74));
console.log(`최종: 위치=${nodeTitle.get(loc())} 허기=${lvl(P + ".허기")} 상처=${lvl(P + ".상처")} 개척=${lvl("L_폭풍절벽.개척")}`);
console.log("\n판정 (§10 상향 사슬 완주):");
const line = (ok, m) => console.log(`  ${ok ? "✔" : "✗"} ${m}`);
line(M.hunger, `① 직관 기점 — 허기 겪음 → G1.1.1 인지 (t${M.hunger || "-"})`);
line(M.wound, `② 개인화 — 상처 겪음 → G2.1 인지 (t${M.wound || "-"})`);
line(M.opp, `③ 정보 루프 — 묻기 → G4.2 '기회' 인지 (t${M.opp || "-"})  [세계 술어 아닌 내 경험에서]`);
line(M.blockedStorm, `④ 막힘 — 별빛폭풍이 변방 이동을 막음 (t${M.blockedStorm || "-"})`);
line(M.explore, `⑤ 재개 — 폭풍 후 탐사 (t${M.explore || "-"})`);
line(M.done, `⑦ 완주 — 손으로 G4.2 개척확립 달성 (t${M.done || "-"})`);
const ok = M.hunger && M.wound && M.opp && M.explore && M.done;
if (ctx.errors.length) { console.error("\n엔진 오류:\n  " + ctx.errors.join("\n  ")); process.exit(1); }
console.log(`\n${ok ? "§10 완주 통과 — 허기(직관)에서 변방 개척(서사)까지 한 줄기로 이어진다" : "미완 — 위 판정 확인"}.`);
if (!ok) process.exit(1);
