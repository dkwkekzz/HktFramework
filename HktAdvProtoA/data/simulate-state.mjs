// 틱 시뮬레이터(§13-5) — world-state.json 을 무입력으로 굴려 세계가 스스로 변하는지 실증한다.
// state-engine.mjs 의 틱 루프(①~⑦)를 반복 호출하고, 변화한 변수와 발화 이력을 추적한다.
//
// 실행:
//   node data/simulate-state.mjs                 무입력 40틱 (플레이어 개입 없음 → 검증 13·14)
//   node data/simulate-state.mjs --ticks 60      틱 수 지정
//   node data/simulate-state.mjs --quiet         변화 요약만
//   node data/simulate-state.mjs --at 1:ACT_늑대_계약@E_플레이어   특정 틱에 플레이어 행동 주입
import { loadWorld, buildInitial, recomputeDerived, newCtx, tick, indexVars } from "./state-engine.mjs";

const argv = process.argv.slice(2);
function opt(name, def) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : def; }
const TICKS = Number(opt("--ticks", 40));
const QUIET = argv.includes("--quiet");
const NO_POLICY = argv.includes("--no-policy");

let { state } = loadWorld();
if (NO_POLICY) state = { ...state, subjects: (state.subjects || []).filter((s) => s.driver !== "policy") };
const varIdx = indexVars(state);
const snap = buildInitial(state);

// 초기 상태 강제: --force <var>=<value> (숫자/true/false/null). 검증6(WorldLaws §7) 시나리오용
for (let i = 0; i < argv.length; i++) if (argv[i] === "--force") {
  const [name, raw] = argv[i + 1].split("=");
  let v = raw === "true" ? true : raw === "false" ? false : raw === "null" ? null : Number(raw);
  if (typeof v === "number" && Number.isNaN(v)) v = raw;
  if (!varIdx.has(name)) { console.error(`--force: 미선언 var ${name}`); process.exit(1); }
  snap[name] = v;
}
recomputeDerived(snap, varIdx);
const ctx = newCtx(state);

// 플레이어 행동 주입: --at <tick>:<actionId>@<actor>
for (let i = 0; i < argv.length; i++) if (argv[i] === "--at") {
  const [tickStr, rest] = argv[i + 1].split(":");
  const [actionId, actor] = rest.split("@");
  const t = Number(tickStr);
  if (!ctx.inputs.has(t)) ctx.inputs.set(t, []);
  ctx.inputs.get(t).push({ actionId, actor: actor || "E_플레이어" });
}

// 라벨 붙은 값 출력기
function show(id) {
  const v = varIdx.get(id);
  const val = snap[id];
  if (v?.kind === "level" && v.levels) return `${v.levels[val] ?? val}(${val})`;
  return String(val);
}
const TRACK = [
  "L_제어탑.가동", "S_강흐름.단계", "L_굶주린평원.생산", "R_식량.공급",
  "F_청동수문회.세력", "EV_강의귀환.단계", "E_늪생명체.서식",
  "L_재의숲.먹이", "E_회색등늑대.개체수", "X_늑대공격.활성",
  "E_초식동물.개체수", "L_재의숲.식생", "S_토양침식.활성", "EV_늑대멸종.단계",
  "G1.2.6.진행", "G2.1.진행", "G_수문회_제어탑파괴.진행", "G_늑대복원.진행",
];

console.log(`무입력 시뮬레이션 — ${TICKS}틱. 주체: ${state.subjects.map((s) => `${s.node}(${s.driver})`).join(", ")}`);
console.log("초기:", TRACK.map((id) => `${id.split(".").slice(-1)[0]}=${show(id)}`).slice(0, 6).join(" "));
console.log("─".repeat(72));

let prev = {}; for (const id of TRACK) prev[id] = snap[id];
for (let t = 1; t <= TICKS; t++) {
  const fired = tick(snap, state, ctx);
  const changes = TRACK.filter((id) => snap[id] !== prev[id]).map((id) => `${id}→${show(id)}`);
  const events = [...fired.clocks, ...fired.rules, ...fired.objectives, ...fired.actions];
  if (!QUIET && (changes.length || events.length)) {
    console.log(`t${String(t).padStart(2)} | ${events.join(" · ") || "-"}`);
    if (changes.length) console.log(`     ⇒ ${changes.join("  ")}`);
  }
  if (fired.skipped.length) console.log(`t${String(t).padStart(2)} | ✗ 입력 불발: ${fired.skipped.join(" · ")}`);
  for (const id of TRACK) prev[id] = snap[id];
}

console.log("─".repeat(72));
console.log("최종 상태:");
for (const id of TRACK) console.log(`  ${id.padEnd(28)} = ${show(id)}`);

const done = (id) => (snap[id + ".진행"] ?? 0) === 3;
const progLabel = (id) => (varIdx.get(id + ".진행")?.levels || [])[snap[id + ".진행"] ?? 0] ?? snap[id + ".진행"];
console.log("\n판정:");
console.log(`  [사건 1] 강의 귀환 도달 단계 = ${snap["EV_강의귀환.단계"]} / 6`);
console.log(`     G1.2.6(강 복구) 완료 = ${done("G1.2.6")} (완료방식 ${snap["G1.2.6.완료방식"]})`);
console.log(`     G2.1(늑대 공격 차단) 완료 = ${done("G2.1")} (완료방식 ${snap["G2.1.완료방식"] ?? "생태 회복=무행동"})`);
console.log(`     G_수문회_제어탑파괴(NPC 반격) 완료 = ${done("G_수문회_제어탑파괴")} (방식 ${snap["G_수문회_제어탑파괴.완료방식"]})`);
console.log(`  [사건 2] 늑대 멸종 도달 단계 = ${snap["EV_늑대멸종.단계"]} / 6`);
console.log(`     G_늑대복원(사건 종결이 발견) 상태 = ${progLabel("G_늑대복원")} (완료방식 ${snap["G_늑대복원.완료방식"] ?? "-"})`);
if (ctx.errors.length) { console.error("\n엔진 오류:\n  " + ctx.errors.join("\n  ")); process.exit(1); }
console.log("\n※ 플레이어 입력 0회. 위 변화는 전부 법칙·시계·NPC 정책의 발화 결과다 (트리 §16 검증 13·14).");
