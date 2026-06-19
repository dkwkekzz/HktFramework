// step_0004/verify.js — 별의 점화 = *임계 방출*(밀도 게이트, P≥crit 인 곳만 방출)의 수치 검증. 순수·독립·영구.
//
//   step_0003 의 방출은 *무조건적*(잠재력 있는 모든 곳이 똑같이 방출) — "별"이라 가리킬 대상이 없었다.
//   이 step 은 방출에 **점화 임계(crit)** 게이트를 단다: P ≥ crit 인 밀집한 연료만 방출한다 = 별.
//   별은 author 하지 않는다 — "별의 형태" = 임계를 넘긴 영역의 모양. 옅은 배경은 어두운 가스로 남는다.
//
//   검증 대상(이 step 의 법칙을 완전히 못 박는다):
//     1. 게이트     — 임계 미만(어두운 가스) 셀은 방출하지 않는다(P 불변·E=0).
//     2. 별의 형태  — 에너지가 태어난 셀 = *정확히* 초기 P≥crit 셀(임계가 별을 깎아낸다).
//     3. 보존       — 게이트가 있어도 Σ(potential+energy) 불변(방출은 형태 변환일 뿐).
//     4. 가법/회귀  — crit=0 → step_0003 의 무조건 방출과 *완전히 동일*(지문 일치).
//     5. 수명       — 별이 타며 P↓ → 결국 P<crit 으로 점화 정지(E 더 안 늘어남). 임계 아래 잔여 연료는 잠긴다.
//     6. 비음수     — rate∈(0,1] 에서 잠재력·에너지 ≥ 0.
//     7. 결정론     — 같은 초기조건·스텝 → 동일 (potential·energy) 지문.
//     8. 항등(rate=0) — 노브 0 이면 세계 불변.
//     9. 통합       — 게이트 방출+확산: 별이 만든 에너지가 *어두운 가스로 퍼진다*(가스는 방출 0 인데 E>0). 보존 유지.
//
//   실행: node HTJ/steps/step_0004/verify.js
//   닫힌 뒤 불변 — 이후 어떤 step 을 진행해도 통과해야 한다.
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Eng = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Pot = require(path.resolve(__dirname, '../../engine/htj-potential.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function totalPE(w) { return w.total('potential') + w.total('energy'); }

const CORE = 1000, BG = 50, CRIT = 300, RATE = 0.05;   // 배경 BG < CRIT < CORE 정점

// 초기 P≥crit 셀 집합(별)을 기록해 반환.
function igniteMask(w, crit) {
  const P = w.fields.potential, m = new Uint8Array(P.length);
  let n = 0;
  for (let i = 0; i < P.length; i++) if (P[i] >= crit) { m[i] = 1; n++; }
  return { m, n };
}

// ── 1. 게이트 — 임계 미만 셀은 방출하지 않음 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.25 });
  const P0 = Float64Array.from(w.fields.potential);
  const { m } = igniteMask(w, CRIT);
  for (let t = 0; t < 20; t++) Pot.releaseEnergy(w, RATE, { crit: CRIT });
  const P = w.fields.potential, E = w.fields.energy;
  let darkChanged = 0, darkEnergy = 0;
  for (let i = 0; i < P.length; i++) if (!m[i]) {        // 어두운 가스 셀
    if (P[i] !== P0[i]) darkChanged++;
    if (E[i] > 0) darkEnergy++;
  }
  check('게이트 — 어두운 가스(P<crit)는 P 불변', darkChanged === 0, `변한 가스 셀 ${darkChanged}`);
  check('게이트 — 어두운 가스는 에너지 생성 0', darkEnergy === 0, `E>0 인 가스 셀 ${darkEnergy}`);
}

// ── 2. 별의 형태 — 에너지 탄생 셀 = 초기 P≥crit 셀 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.25 });
  const { m, n } = igniteMask(w, CRIT);
  Pot.releaseEnergy(w, RATE, { crit: CRIT });             // 확산 끄고 1스텝
  const E = w.fields.energy;
  let born = 0, mismatch = 0;
  for (let i = 0; i < E.length; i++) {
    const lit = E[i] > 0 ? 1 : 0;
    if (lit) born++;
    if (lit !== m[i]) mismatch++;
  }
  check('별의 형태 — 에너지 탄생 셀 = 초기 P≥crit 셀(임계가 별을 깎음)', mismatch === 0 && born === n, `점화 ${born} = 별 ${n} 셀`);
  check('별의 형태 — 별이 전체보다 작다(국소 구조)', n > 0 && n < E.length, `별 ${n} / 전체 ${E.length}`);
}

// ── 3. 보존 — 게이트가 있어도 Σ(P+E) 불변 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.25 });
  const S0 = totalPE(w);
  for (let t = 0; t < 300; t++) Pot.releaseEnergy(w, RATE, { crit: CRIT });
  const relErr = Math.abs(totalPE(w) - S0) / S0;
  check('보존 — Σ(potential+energy) 불변(300스텝, 상대오차<1e-9)', relErr < 1e-9, `ΔΣ/Σ0 = ${relErr.toExponential(2)}`);
}

// ── 4. 가법/회귀 — crit=0 이면 step_0003 무조건 방출과 동일 ──
{
  function run(useCrit0) {
    const w = W.createWorld(14);
    Pot.seedPotential(w, { P0: 1000 });                   // step_0003 와 동일 시드
    for (let t = 0; t < 40; t++) useCrit0 ? Pot.releaseEnergy(w, 0.05, { crit: 0 }) : Pot.releaseEnergy(w, 0.05);
    return [w.fingerprint('potential'), w.fingerprint('energy')];
  }
  const a = run(false), b = run(true);                    // 무인자 vs crit:0
  check('가법 — crit=0 은 무조건 방출(step_0003)과 byte-동일', a[0] === b[0] && a[1] === b[1],
    `0x${a[0].toString(16)}/0x${a[1].toString(16)}`);
}

// ── 5. 수명 — 별이 타서 점화 정지(P<crit) → E 정체 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.25 });
  for (let t = 0; t < 2000; t++) Pot.releaseEnergy(w, RATE, { crit: CRIT });
  const maxP = w.max('potential'), Eburn = w.total('energy');
  Pot.releaseEnergy(w, RATE, { crit: CRIT });             // 한 스텝 더
  const Eafter = w.total('energy');
  check('수명 — 별이 다 타 점화 정지(max P < crit)', maxP < CRIT, `max P = ${maxP.toFixed(2)} < crit ${CRIT}`);
  check('수명 — 점화 정지 후 에너지 정체(E 더 안 늘어남)', Eafter === Eburn, `ΔE = ${(Eafter - Eburn).toExponential(2)}`);
  check('수명 — 임계 아래 잔여 연료가 잠긴다(P 총량 > 0)', w.total('potential') > 0, `잔여 P = ${w.total('potential').toFixed(2)}`);
}

// ── 6. 비음수 — rate∈(0,1] 에서 P·E ≥ 0 ──
{
  const N = 12, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG });
  let minP = Infinity, minE = Infinity;
  for (let t = 0; t < 100; t++) {
    Pot.releaseEnergy(w, 1.0, { crit: CRIT });
    const P = w.fields.potential, E = w.fields.energy;
    for (let i = 0; i < P.length; i++) { if (P[i] < minP) minP = P[i]; if (E[i] < minE) minE = E[i]; }
  }
  check('비음수 — rate=1 에서도 잠재력·에너지 ≥ 0', minP >= 0 && minE >= 0, `min P=${minP.toExponential(2)}, min E=${minE.toExponential(2)}`);
}

// ── 7. 결정론 — 같은 흐름 → 동일 지문 ──
{
  function run() {
    const w = W.createWorld(14);
    Pot.seedStarField(w, { core: CORE, background: BG });
    for (let t = 0; t < 40; t++) { Pot.releaseEnergy(w, RATE, { crit: CRIT }); Eng.diffuseEnergy(w, 1 / 7); }
    return [w.fingerprint('potential'), w.fingerprint('energy')];
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 (potential·energy) 지문', a[0] === b[0] && a[1] === b[1],
    `0x${a[0].toString(16)}/0x${a[1].toString(16)}`);
}

// ── 8. 항등(rate=0) — 세계 불변 ──
{
  const w = W.createWorld(14);
  Pot.seedStarField(w, { core: CORE, background: BG });
  const fpP = w.fingerprint('potential'), fpE = w.fingerprint('energy');
  Pot.releaseEnergy(w, 0, { crit: CRIT });
  check('항등 — rate=0 이면 세계 불변(회귀 0)', w.fingerprint('potential') === fpP && w.fingerprint('energy') === fpE,
    `0x${fpP.toString(16)}/0x${fpE.toString(16)}`);
}

// ── 9. 통합 — 게이트 방출+확산: 별의 에너지가 어두운 가스로 퍼진다 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.25 });
  const { m } = igniteMask(w, CRIT);
  const S0 = totalPE(w);
  for (let t = 0; t < 150; t++) { Pot.releaseEnergy(w, RATE, { crit: CRIT }); Eng.diffuseEnergy(w, 1 / 7); }
  const E = w.fields.energy;
  let gasReached = 0;
  for (let i = 0; i < E.length; i++) if (!m[i] && E[i] > 0) gasReached++;   // 방출 안 한 가스인데 E>0
  const relErr = Math.abs(totalPE(w) - S0) / S0;
  check('통합 — 별의 에너지가 어두운 가스로 *확산*해 도달(방출 0 인데 E>0)', gasReached > 0, `도달한 가스 셀 ${gasReached}`);
  check('통합 — 게이트 방출+확산에도 Σ(P+E) 보존', relErr < 1e-9, `ΔΣ/Σ0 = ${relErr.toExponential(2)}`);
}

// ── 결과 ──
console.log('\n=== step_0004 수치 검증: 별의 점화 = 임계 방출(밀도 게이트) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS ✅' : 'FAIL ❌'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
