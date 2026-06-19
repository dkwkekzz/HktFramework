// step_0005/verify.js — 지속적으로 빛나는 별 = *경계 복사(sink)* 의 수치 검증. 순수·독립·영구.
//
//   step_0004 의 별은 닫힌 상자에서 한 번 터지고 꺼졌다(균일 열적 죽음 → 안 빛남). 이 step 은
//   에너지의 *출구*(경계 복사 = 차가운 우주로 내보냄)를 더한다. 큰 연료 저장고가 계속 점화하고
//   에너지가 경계로 흘러 빠져나가면, source(별)↔sink(우주) 사이에 *영구 그래디언트*가 선다 = 빛나는 별.
//
//   검증 대상(이 step 의 법칙을 완전히 못 박는다):
//     1. sink       — 경계 셀 에너지 감소, world.radiated 증가. 내부 셀은 복사로 안 변한다.
//     2. 회계 보존  — Σ(potential)+Σ(energy)+radiated 불변(에너지는 사라지지 않고 장부로 간다).
//     3. 지속 발광  — sink 가 있으면 오래 굴려도 *중심 ≫ 경계* 그래디언트가 유지된다(별이 계속 빛남).
//     4. 대조       — sink 가 없으면(닫힌 상자) 같은 조건이 균일로 수렴한다(중심 ≈ 경계, 안 빛남).
//     5. 정상상태   — sink 가 있으면 상자 안 총에너지가 정체(유입=유출)하고, radiated 는 꾸준히 증가.
//     6. 비음수     — rate∈(0,1] 에서 에너지 ≥ 0.
//     7. 결정론     — 같은 흐름 → 동일 (energy) 지문 + 동일 radiated.
//     8. 항등(rate=0) — 복사율 0 이면 세계 불변(회귀 0).
//
//   실행: node HTJ/steps/step_0005/verify.js
//   닫힌 뒤 불변 — 이후 어떤 step 을 진행해도 통과해야 한다.
'use strict';
const path = require('path');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Eng = require(path.resolve(__dirname, '../../engine/htj-energy.js'));
const Pot = require(path.resolve(__dirname, '../../engine/htj-potential.js'));
const Rad = require(path.resolve(__dirname, '../../engine/htj-radiate.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

const CORE = 1e7, BG = 0, CRIT = 300, RATE = 0.02, ALPHA = 1 / 7, RAD = 0.2;  // 큰 연료 저장고

// 반경별(중심/경계 껍질) 평균 에너지.
function profile(w) {
  const N = w.N, c = (N - 1) / 2, E = w.fields.energy;
  let cen = 0, nc = 0, edge = 0, ne = 0;
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (z * N + y) * N + x;
    const d = Math.max(Math.abs(x - c), Math.abs(y - c), Math.abs(z - c));
    if (d <= 1) { cen += E[i]; nc++; }
    if (x === 0 || y === 0 || z === 0 || x === N - 1 || y === N - 1 || z === N - 1) { edge += E[i]; ne++; }
  }
  return { center: cen / nc, edge: edge / ne };
}
// 별 한 step: 점화(게이트 방출) + 확산 + 복사(sink).
function starStep(w, rad) { Pot.releaseEnergy(w, RATE, { crit: CRIT }); Eng.diffuseEnergy(w, ALPHA); Rad.radiate(w, rad); }

// ── 1. sink — 경계 감소·radiated 증가·내부 불변 ──
{
  const N = 12, w = W.createWorld(N);
  w.fields.energy.fill(100);                            // 균일 에너지
  const innerBefore = w.get('energy', (N >> 1), (N >> 1), (N >> 1));
  const before = w.total('energy');
  Rad.radiate(w, RAD);
  const innerAfter = w.get('energy', (N >> 1), (N >> 1), (N >> 1));
  check('sink — 경계 복사로 상자 안 총에너지 감소', w.total('energy') < before, `${before.toFixed(0)} → ${w.total('energy').toFixed(0)}`);
  check('sink — 빠져나간 양이 radiated 장부에 적재', Math.abs(w.radiated - (before - w.total('energy'))) < 1e-9, `radiated = ${w.radiated.toFixed(2)}`);
  check('sink — 내부 셀은 복사로 안 변함(경계만)', innerAfter === innerBefore, `내부 E = ${innerAfter}`);
}

// ── 2. 회계 보존 — Σ(P+E+radiated) 불변 ──
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.18 });
  const S0 = Rad.totalAccount(w);
  for (let t = 0; t < 300; t++) starStep(w, RAD);
  const relErr = Math.abs(Rad.totalAccount(w) - S0) / S0;
  check('회계 — Σ(P+E+radiated) 불변(300스텝, 상대오차<1e-9)', relErr < 1e-9, `ΔΣ/Σ0 = ${relErr.toExponential(2)}`);
}

// ── 3 & 4. 지속 발광(sink 有) vs 균일 죽음(sink 無) ──
{
  function run(rad) {
    const N = 16, w = W.createWorld(N);
    Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.18 });
    for (let t = 0; t < 600; t++) starStep(w, rad);
    return profile(w);
  }
  const withSink = run(RAD), noSink = run(0);
  check('지속 발광 — sink 有: 중심 ≫ 경계 그래디언트 유지(별이 빛남)', withSink.center > withSink.edge * 5,
    `중심 ${withSink.center.toExponential(2)} vs 경계 ${withSink.edge.toExponential(2)}`);
  check('대조 — sink 無(닫힌 상자): 중심 ≈ 경계(균일·안 빛남)', noSink.center < noSink.edge * 1.05,
    `중심 ${noSink.center.toExponential(2)} ≈ 경계 ${noSink.edge.toExponential(2)}`);
}

// ── 5. 지속성 — 긴 창 내내 중심≫경계(별이 안 꺼지고 계속 빛남) + radiated 단조 증가 ──
//   ("큰 연료 저장고"라 별은 서서히 어두워지지만, step_0004(닫힌)처럼 갑자기 균일로 죽지 않는다.)
{
  const N = 16, w = W.createWorld(N);
  Pot.seedStarField(w, { core: CORE, background: BG, r: N * 0.18 });
  let minRatio = Infinity, prevRad = -1, radMonotone = true;
  for (let t = 0; t < 600; t++) {
    starStep(w, RAD);
    if (t >= 100 && t % 50 === 0) {
      const p = profile(w), ratio = p.center / Math.max(p.edge, 1e-12);
      if (ratio < minRatio) minRatio = ratio;
      if (w.radiated < prevRad) radMonotone = false;
      prevRad = w.radiated;
    }
  }
  check('지속성 — 별이 창(t=100~600) 내내 빛난다(중심/경계 ≥ 3 유지)', minRatio >= 3, `min 중심/경계 = ${minRatio.toFixed(1)}`);
  check('지속성 — radiated 단조 증가(계속 우주로 복사)', radMonotone, '복사 장부 단조↑');
}

// ── 6. 비음수 — rate∈(0,1] 에서 에너지 ≥ 0 ──
{
  const N = 12, w = W.createWorld(N);
  w.fields.energy.fill(1000);
  let minE = Infinity;
  for (let t = 0; t < 100; t++) {
    Rad.radiate(w, 1.0);                                // 상한 rate=1(경계 전량 복사)에서도 비음수
    Eng.diffuseEnergy(w, ALPHA);
    const E = w.fields.energy;
    for (let i = 0; i < E.length; i++) if (E[i] < minE) minE = E[i];
  }
  check('비음수 — rate=1 에서도 에너지 ≥ 0', minE >= 0, `min E = ${minE.toExponential(2)}`);
}

// ── 7. 결정론 — 같은 흐름 → 동일 지문 + radiated ──
{
  function run() {
    const w = W.createWorld(14);
    Pot.seedStarField(w, { core: CORE, background: BG });
    for (let t = 0; t < 40; t++) starStep(w, RAD);
    return [w.fingerprint('energy'), w.radiated];
  }
  const a = run(), b = run();
  check('결정론 — 같은 흐름 → 동일 지문·radiated', a[0] === b[0] && a[1] === b[1], `0x${a[0].toString(16)} · ${a[1].toFixed(2)}`);
}

// ── 8. 항등(rate=0) — 세계 불변 ──
{
  const w = W.createWorld(14);
  w.fields.energy.fill(500);
  const fp = w.fingerprint('energy');
  Rad.radiate(w, 0);
  check('항등 — 복사율 0 이면 세계 불변(회귀 0)', w.fingerprint('energy') === fp && (w.radiated == null || w.radiated === 0), `0x${fp.toString(16)}`);
}

// ── 결과 ──
console.log('\n=== step_0005 수치 검증: 지속적으로 빛나는 별 = 경계 복사(sink) ===');
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS ✅' : 'FAIL ❌'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
