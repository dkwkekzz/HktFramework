// step_0002/verify.js — 에너지 흐름 = 열역학 제2법칙(확산)의 *수치 검증*. 순수·독립·영구.
//
//   검증 대상(이 step 의 법칙을 완전히 못 박는다):
//     1. 국소성       — 단일 핫셀 1스텝 후 에너지는 *직접 이웃*까지만 퍼진다(원거리 0).
//     2. 제1법칙(보존) — 임의 스텝 수 후 총 에너지 불변(닫힌 경계·대칭 flux).
//     3. 제2법칙(증가) — 엔트로피가 매 스텝 단조 증가(이중확률 사상의 majorization).
//     4. 평형 수렴     — 오래 굴리면 분산→0, 엔트로피→ln(N³)(완전 균일·최대 무질서).
//     5. 비음수        — α≤1/6 에서 에너지는 음수가 되지 않는다.
//     6. 결정론        — 같은 초기조건·스텝 → 동일 에너지 지문.
//     7. 항등(α=0)     — 노브 0 이면 세계 불변(가법성/회귀 0 가드).
//
//   실행: node HTJ/steps/step_0002/verify.js
//   닫힌 뒤 불변 — 이후 어떤 step 을 진행해도 통과해야 한다.
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Eng = require(path.resolve(__dirname, '../../engine/htj-energy.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

// ── 1. 국소성 — 단일 핫셀 1스텝 후 직접 이웃까지만 ──
{
  const N = 9, w = W.createWorld(N), c = (N - 1) >> 1;
  Eng.seedHotSpot(w, { E0: 1000, half: 0 });
  Eng.diffuseEnergy(w, 1 / 7);
  let nonzero = 0, farLeak = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (w.get('energy', x, y, z) > 0) {
      nonzero++;
      const manhattan = Math.abs(x - c) + Math.abs(y - c) + Math.abs(z - c);
      if (manhattan > 1) farLeak++;          // 직접 이웃은 맨해튼 거리 1
    }
  }
  check('국소성 — 1스텝 후 점유 = 중심+6이웃(=7)', nonzero === 7, `${nonzero} 셀`);
  check('국소성 — 거리 2+ 로 새어나간 에너지 0', farLeak === 0, `누출 ${farLeak} 셀`);
}

// ── 2. 제1법칙 — 총 에너지 보존(임의 스텝 후) ──
{
  const N = 16, w = W.createWorld(N);
  Eng.seedHotSpot(w, { E0: 1000, half: 0 });
  const E0 = w.total('energy');
  for (let t = 0; t < 300; t++) Eng.diffuseEnergy(w, 1 / 7);
  const E1 = w.total('energy');
  const relErr = Math.abs(E1 - E0) / E0;
  check('제1법칙 — 총 에너지 보존(300스텝, 상대오차<1e-9)', relErr < 1e-9, `ΔE/E0 = ${relErr.toExponential(2)}`);
}

// ── 3. 제2법칙 — 엔트로피 단조 증가 + 실제 증가 ──
{
  const N = 16, w = W.createWorld(N);
  Eng.seedHotSpot(w, { E0: 1000, half: 0 });
  const S0 = Eng.entropy(w);
  let prev = S0, monotone = true, minStep = Infinity;
  for (let t = 0; t < 300; t++) {
    Eng.diffuseEnergy(w, 1 / 7);
    const S = Eng.entropy(w);
    const d = S - prev;
    if (d < -1e-12) monotone = false;        // float 오차 허용폭 밖의 감소만 위반
    if (d < minStep) minStep = d;
    prev = S;
  }
  check('제2법칙 — 엔트로피 매 스텝 단조 증가(감소 없음)', monotone, `min ΔS/step = ${minStep.toExponential(2)}`);
  check('제2법칙 — 엔트로피 실제 증가(S0≈0 → S↑)', prev > S0 + 1 && S0 < 1e-9, `S: ${S0.toFixed(4)} → ${prev.toFixed(4)} nats`);
}

// ── 4. 평형 수렴 — 분산↓·엔트로피→ln(N³) ──
{
  const N = 12, w = W.createWorld(N);
  Eng.seedHotSpot(w, { E0: 1000, half: 0 });
  const v0 = Eng.energyVariance(w);
  for (let t = 0; t < 6000; t++) Eng.diffuseEnergy(w, 1 / 7);
  const vEq = Eng.energyVariance(w);
  const Smax = Math.log(N * N * N), Seq = Eng.entropy(w);
  check('평형 — 분산이 크게 감소(균일로 수렴)', vEq < v0 * 1e-3, `var ${v0.toExponential(2)} → ${vEq.toExponential(2)}`);
  check('평형 — 엔트로피 → ln(N³) 의 99%+', Seq > Smax * 0.99, `${Seq.toFixed(4)} / ${Smax.toFixed(4)} nats`);
}

// ── 5. 비음수 — α≤1/6 에서 에너지는 음수가 되지 않음 ──
{
  const N = 16, w = W.createWorld(N);
  Eng.seedHotSpot(w, { E0: 1000, half: 0 });
  let minVal = Infinity;
  for (let t = 0; t < 200; t++) {
    Eng.diffuseEnergy(w, 1 / 6);             // 상한 α 에서도 비음수
    const E = w.fields.energy;
    for (let i = 0; i < E.length; i++) if (E[i] < minVal) minVal = E[i];
  }
  check('비음수 — α=1/6 에서도 에너지 ≥ 0', minVal >= 0, `min E = ${minVal.toExponential(2)}`);
}

// ── 6. 결정론 — 같은 초기조건·스텝 → 동일 에너지 지문 ──
{
  function run() {
    const w = W.createWorld(16);
    Eng.seedHotSpot(w, { E0: 1000, half: 1 });
    for (let t = 0; t < 50; t++) Eng.diffuseEnergy(w, 1 / 7);
    return w.fingerprint('energy');
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 에너지 지문', a === b, `0x${a.toString(16)} == 0x${b.toString(16)}`);
}

// ── 7. 항등(α=0) — 세계 불변 ──
{
  const w = W.createWorld(16);
  Eng.seedHotSpot(w, { E0: 1000, half: 1 });
  const fp0 = w.fingerprint('energy');
  Eng.diffuseEnergy(w, 0);
  check('항등 — α=0 이면 에너지 장 불변(회귀 0)', w.fingerprint('energy') === fp0, `0x${fp0.toString(16)}`);
}

// ── 결과 ──
console.log('\n=== step_0002 수치 검증: 에너지 흐름 = 열역학 제2법칙(확산) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS ✅' : 'FAIL ❌'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
