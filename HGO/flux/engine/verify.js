// verify.js — 공용 헤드리스 검증기(트랙당 1벌, step 마다 복사 0). 장면 id 를 인자로 4기둥 + 가설 assert 를 수치 출력.
//   4기둥(SPINE §9): ① 닫힌 장부 Σq 불변 ② 결정론(같은 시드 → 같은 해시) ③ 회귀 0(골든 해시) ④ 창발 측정(장면 assert).
//   + ⑤ 직관 설명 게이트: did(한 일)·observe(관찰) 필수(뷰어 표시·SKILL §2.1) — 없으면 FAIL = 설명 없는 step 닫기 차단.
//   사용: node engine/verify.js [step-NNNN | all] [--update]   (--update = 골든 해시 갱신/생성)
'use strict';
const fs = require('fs');
const path = require('path');
const K = require('./flux-kernel.js');
const L = require('./flux-laws.js');
const S = require('./flux-sim.js');
const SC = require('./scenes.js');

const GOLDEN = path.join(__dirname, 'validate', 'golden-flux.json');
const SEED = 42;

function loadGolden() { try { return JSON.parse(fs.readFileSync(GOLDEN, 'utf8')); } catch (e) { return {}; } }
function saveGolden(g) {
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify(g, null, 2) + '\n');
}

// 장면을 결정론적으로 ticks 만큼 돌리고 시작·끝 측정 + 끝 상태 해시를 반환.
function runScene(id, seed) {
  const scene = SC.SCENES[id];
  const sim = S.createSim(scene.init(K.mulberry32(seed >>> 0), K));
  const w0 = scene.watch(sim, K);
  for (let t = 0; t < scene.ticks; t++) S.step(sim);
  const w1 = scene.watch(sim, K);
  return { scene, sim, w0, w1, hash: K.hashSim(sim) };
}

function verifyOne(id, golden, update) {
  const scene = SC.SCENES[id];
  if (!scene) { console.log(`  ✗ unknown scene: ${id}`); return false; }
  const r = runScene(id, SEED);
  const lines = [];
  let ok = true;
  const mark = p => (p ? '✓' : '✗');

  // ① 닫힌 장부 — Σq 시작 vs 끝(반대칭 알리바이)
  const dQ = Math.abs(r.w1.sumQ - r.w0.sumQ), ledger = dQ < 1e-6;
  ok = ok && ledger;
  lines.push(`  ${mark(ledger)} 닫힌 장부: Σq ${r.w0.sumQ} → ${r.w1.sumQ} (|Δ|=${dQ.toExponential(2)})`);

  // ② 결정론 — 같은 시드 재실행 해시 일치
  const r2 = runScene(id, SEED);
  const det = r2.hash === r.hash;
  ok = ok && det;
  lines.push(`  ${mark(det)} 결정론: hash ${r.hash} == ${r2.hash}`);

  // ③ 회귀 0 — 골든 해시(규칙 고정이므로 비트 불변)
  const gold = golden[id];
  let reg;
  if (gold == null) {
    if (update) { golden[id] = r.hash; reg = true; lines.push(`  ⊕ 골든 생성: ${id} = ${r.hash}`); }
    else { reg = false; lines.push(`  ✗ 골든 없음: ${id} (최초면 --update 로 생성)`); }
  } else {
    reg = gold === r.hash;
    lines.push(`  ${mark(reg)} 회귀 0: 골든 ${gold} == ${r.hash}`);
    if (!reg && update) { golden[id] = r.hash; lines.push(`  ⊕ 골든 갱신: ${id} = ${r.hash}`); reg = true; }
  }
  ok = ok && reg;

  // ④ 창발 측정 — 장면 가설 assert(author 아닌 측정)
  for (const a of scene.assert(r.w0, r.w1, K)) {
    ok = ok && a.pass;
    lines.push(`  ${mark(a.pass)} ${a.name}: ${a.value}`);
  }

  // ⑤ 직관 설명 게이트 — 뷰어가 보여줄 did(한 일)·observe(관찰) 필수(SKILL §2.1·§6).
  //   텍스트라 해시·결정론·골든과 직교하지만, 비전문가도 화면만 보고 따라오게 하려면 step 을 닫기 전 반드시 채운다.
  //   닫기 체크리스트가 이 verify PASS 를 요구하므로, 이 게이트가 "설명 없는 step 닫기"를 기계적으로 막는다.
  const hasDid = typeof scene.did === 'string' && scene.did.trim().length > 0;
  const hasObs = typeof scene.observe === 'string' && scene.observe.trim().length > 0;
  const explain = hasDid && hasObs;
  ok = ok && explain;
  lines.push(`  ${mark(explain)} 직관 설명(did·observe 필수): did ${hasDid ? '✓' : '✗'} · observe ${hasObs ? '✓' : '✗'}`);

  console.log(`\n[${id}] ${scene.title}`);
  console.log(lines.join('\n'));
  console.log(`  → ${ok ? 'PASS' : 'FAIL'}`);
  return ok;
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const target = args.find(a => !a.startsWith('--')) || 'all';
  const ids = target === 'all' ? Object.keys(SC.SCENES) : [target];
  const golden = loadGolden();
  let allOk = true;
  for (const id of ids) allOk = verifyOne(id, golden, update) && allOk;
  if (update) saveGolden(golden);
  console.log(`\n=== ${allOk ? 'ALL PASS' : 'FAIL'} (${ids.length} scene) ===`);
  process.exit(allOk ? 0 : 1);
}

main();
