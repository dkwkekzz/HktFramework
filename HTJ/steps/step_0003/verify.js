// step_0003/verify.js — 에너지의 *탄생* = 잠재력 방출(potential→energy)의 *수치 검증*. 순수·독립·영구.
//
//   검증 대상(이 step 의 법칙을 완전히 못 박는다):
//     1. 보존(제1법칙) — 방출 임의 스텝 후 총합 Σ(potential+energy) 불변. "생성"은 형태 변환일 뿐.
//     2. 생성        — 에너지 총량이 0 에서 증가하고, 잠재력 총량은 그만큼 감소.
//     3. 지수 붕괴   — 잠재력 총량이 P₀·(1−rate)ᵗ 를 따른다(자발적 붕괴).
//     4. 국소성      — 방출만으로는 에너지가 *이동하지 않는다*(저장고 셀 밖에 에너지 0).
//     5. 비음수      — rate∈(0,1] 에서 잠재력·에너지 모두 ≥ 0.
//     6. 수렴        — 오래 굴리면 P→0, 총에너지→P₀(저장고가 완전히 풀림).
//     7. 결정론      — 같은 초기조건·스텝 → 동일 (potential·energy) 지문.
//     8. 항등(rate=0) — 노브 0 이면 세계 불변(가법성/회귀 0 가드).
//     9. 통합        — 방출+확산을 함께 굴려도 Σ(P+E) 보존 AND 에너지가 퍼진다(source 가 흐름을 먹임).
//
//   실행: node HTJ/steps/step_0003/verify.js
//   닫힌 뒤 불변 — 이후 어떤 step 을 진행해도 통과해야 한다.
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Eng = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Pot = require(path.resolve(__dirname, '../../engine/htj-potential.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
function totalPE(w) { return w.total('potential') + w.total('energy'); }

// ── 1. 보존(제1법칙) — Σ(potential+energy) 불변 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedPotential(w, { P0: 1000 });
  const S0 = totalPE(w);
  for (let t = 0; t < 300; t++) Pot.releaseEnergy(w, 0.02);
  const S1 = totalPE(w);
  const relErr = Math.abs(S1 - S0) / S0;
  check('보존 — Σ(potential+energy) 불변(300스텝, 상대오차<1e-9)', relErr < 1e-9, `ΔΣ/Σ0 = ${relErr.toExponential(2)}`);
}

// ── 2. 생성 — 에너지 총량 0→↑, 잠재력 총량 ↓ ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedPotential(w, { P0: 1000 });
  const E0 = w.total('energy'), P0 = w.total('potential');
  for (let t = 0; t < 50; t++) Pot.releaseEnergy(w, 0.02);
  const E1 = w.total('energy'), P1 = w.total('potential');
  check('생성 — 에너지가 0 에서 태어난다(E0=0 → E↑)', E0 === 0 && E1 > 0, `E: ${E0.toFixed(2)} → ${E1.toFixed(2)}`);
  check('생성 — 잠재력이 그만큼 줄어든다(P↓, ΔP=−ΔE)', P1 < P0 && Math.abs((P0 - P1) - (E1 - E0)) < 1e-9, `P: ${P0.toFixed(2)} → ${P1.toFixed(2)}`);
}

// ── 3. 지수 붕괴 — 잠재력 총량 = P₀·(1−rate)ᵗ ──
{
  const N = 12, w = W.createWorld(N), rate = 0.05;
  Pot.seedPotential(w, { P0: 1000 });
  const P0 = w.total('potential');
  let maxErr = 0;
  for (let t = 1; t <= 60; t++) {
    Pot.releaseEnergy(w, rate);
    const expected = P0 * Math.pow(1 - rate, t);
    const err = Math.abs(w.total('potential') - expected) / P0;
    if (err > maxErr) maxErr = err;
  }
  check('지수 붕괴 — P(t)=P₀·(1−rate)ᵗ (상대오차<1e-9)', maxErr < 1e-9, `max err = ${maxErr.toExponential(2)}`);
}

// ── 4. 국소성 — 방출만으로는 에너지가 이동하지 않음 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedPotential(w, { P0: 1000, r: N * 0.18 });
  // 저장고가 있던 셀 집합을 기록.
  const hadStore = new Uint8Array(w.fields.potential.length);
  for (let i = 0; i < hadStore.length; i++) hadStore[i] = w.fields.potential[i] > 0 ? 1 : 0;
  for (let t = 0; t < 30; t++) Pot.releaseEnergy(w, 0.05);
  let leak = 0;
  const E = w.fields.energy;
  for (let i = 0; i < E.length; i++) if (E[i] > 0 && !hadStore[i]) leak++;
  check('국소성 — 방출은 그 자리에서만(저장고 밖 에너지 0)', leak === 0, `누출 ${leak} 셀`);
}

// ── 5. 비음수 — rate∈(0,1] 에서 잠재력·에너지 ≥ 0 ──
{
  const N = 12, w = W.createWorld(N);
  Pot.seedPotential(w, { P0: 1000 });
  let minP = Infinity, minE = Infinity;
  for (let t = 0; t < 100; t++) {
    Pot.releaseEnergy(w, 1.0);                          // 상한 rate=1(즉시 전부 방출)에서도 비음수
    const P = w.fields.potential, E = w.fields.energy;
    for (let i = 0; i < P.length; i++) { if (P[i] < minP) minP = P[i]; if (E[i] < minE) minE = E[i]; }
  }
  check('비음수 — rate=1 에서도 잠재력·에너지 ≥ 0', minP >= 0 && minE >= 0, `min P=${minP.toExponential(2)}, min E=${minE.toExponential(2)}`);
}

// ── 6. 수렴 — P→0, 총에너지→P₀ ──
{
  const N = 12, w = W.createWorld(N);
  Pot.seedPotential(w, { P0: 1000 });
  const P0 = w.total('potential');
  for (let t = 0; t < 2000; t++) Pot.releaseEnergy(w, 0.05);
  const Pend = w.total('potential'), Eend = w.total('energy');
  check('수렴 — 잠재력이 완전히 풀림(P→0)', Pend < P0 * 1e-6, `P: ${P0.toFixed(2)} → ${Pend.toExponential(2)}`);
  check('수렴 — 총에너지 → 초기 저장고량(E→P₀)', Math.abs(Eend - P0) / P0 < 1e-6, `E → ${Eend.toFixed(4)} / ${P0.toFixed(2)}`);
}

// ── 7. 결정론 — 같은 흐름 → 동일 지문 ──
{
  function run() {
    const w = W.createWorld(14);
    Pot.seedPotential(w, { P0: 1000 });
    for (let t = 0; t < 40; t++) { Pot.releaseEnergy(w, 0.05); Eng.diffuseEnergy(w, 1 / 7); }
    return [w.fingerprint('potential'), w.fingerprint('energy')];
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 (potential·energy) 지문', a[0] === b[0] && a[1] === b[1],
    `0x${a[0].toString(16)}/0x${a[1].toString(16)}`);
}

// ── 8. 항등(rate=0) — 세계 불변 ──
{
  const w = W.createWorld(14);
  Pot.seedPotential(w, { P0: 1000 });
  const fpP = w.fingerprint('potential'), fpE = w.fingerprint('energy');
  Pot.releaseEnergy(w, 0);
  check('항등 — rate=0 이면 세계 불변(회귀 0)', w.fingerprint('potential') === fpP && w.fingerprint('energy') === fpE,
    `0x${fpP.toString(16)}/0x${fpE.toString(16)}`);
}

// ── 9. 통합 — 방출+확산 함께: Σ(P+E) 보존 AND 에너지 퍼짐 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedPotential(w, { P0: 1000, r: N * 0.18 });
  const S0 = totalPE(w);
  const occ0 = w.count('energy', 1e-9);                 // 시작: 에너지 0 셀
  for (let t = 0; t < 200; t++) { Pot.releaseEnergy(w, 0.02); Eng.diffuseEnergy(w, 1 / 7); }
  const S1 = totalPE(w);
  const occ1 = w.count('energy', 1e-9);
  const relErr = Math.abs(S1 - S0) / S0;
  check('통합 — 방출+확산에도 Σ(P+E) 보존', relErr < 1e-9, `ΔΣ/Σ0 = ${relErr.toExponential(2)}`);
  check('통합 — 태어난 에너지가 저장고 밖으로 퍼진다(점유↑)', occ1 > occ0 && occ1 > w.count('potential', 1e-9),
    `점유 ${occ0} → ${occ1} 셀`);
}

// ── 결과 ──
console.log('\n=== step_0003 수치 검증: 에너지의 탄생 = 잠재력 방출(potential→energy) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS ✅' : 'FAIL ❌'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
