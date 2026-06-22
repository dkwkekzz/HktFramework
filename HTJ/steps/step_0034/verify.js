// step_0034/verify.js — S7(레버3): 공간 LOD — 보는 곳만 정밀, 비용을 세계 크기에서 분리. 순수·독립·영구.
//
//   design §2 레버3·§4 S7. 관찰자 근처는 fine, 멀수록 coarse(블록 평균) → 시뮬 비용이 세계 크기가 아니라
//   관찰되는 국소에 묶인다. downsample/upsample 은 Σ 보존(형상은 손실=근사 LOD). 검증 포인트(design §4 S7):
//   "고정 LOD 시나리오 결정론·접합면 보존·관찰자 이동 시(=세계 키워도) 비용 평탄."
//
//   검증 대상:
//     1. 다운샘플 Σ 보존 — 블록 합의 합 = 전체 합(거친 표현이 질량 안 샘).
//     2. 왕복(down→up) Σ 보존 — 업샘플 후 전체 합 = 원래(접합면 누설 0·형상은 손실).
//     3. 거친 표현 비용 절감 — coarse 셀 수 = 블록 수 ≪ fine 셀 수(bs³ 배).
//     4. 관찰자 LOD — near 블록 fine·far 블록 coarse(거리 정책).
//     5. 비용이 세계 크기와 분리(레버3 핵심) — 관찰자 radius 고정, N 키워도 fine 예산 일정·유효 ≪ N³.
//     6. 다중 필드 보존 — 질량·운동량 각각 Σ 보존.
//     7. 결정론(동일 정책 → 동일 결과).
//
//   실행: node HTJ/steps/step_0034/verify.js
'use strict';
const path = require('path');
const LOD = require(path.resolve(__dirname, '../../engine/htj-lod.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }
const sum = (f) => { let s = 0; for (let i = 0; i < f.length; i++) s += f[i]; return s; };
const relOk = (a, b) => Math.abs(a - b) <= 1e-7 + 1e-9 * Math.abs(b);
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function randField(N, seed) { const r = rng(seed), f = new Float64Array(N * N * N); for (let i = 0; i < f.length; i++) f[i] = r() < 0.3 ? r() * 10 : 0; return f; }

const N = 24, BS = 8;

// ── 1. 다운샘플 Σ 보존 ──
{
  const f = randField(N, 1), coarse = LOD.downsample(f, N, BS);
  check('다운샘플 Σ 보존 — 블록 합의 합 = 전체 합(거친 표현 질량 안 샘)', relOk(sum(coarse), sum(f)),
    `Σfine ${sum(f).toFixed(3)} = Σcoarse ${sum(coarse).toFixed(3)}`);
}

// ── 2. 왕복(down→up) Σ 보존 ──
{
  const f = randField(N, 2), back = LOD.upsample(LOD.downsample(f, N, BS), N, BS);
  check('왕복(down→up) Σ 보존 — 업샘플 후 전체 합 = 원래(접합면 누설 0·형상 손실)', relOk(sum(back), sum(f)),
    `Σ원래 ${sum(f).toFixed(3)} → Σ왕복 ${sum(back).toFixed(3)} (Δ ${Math.abs(sum(back) - sum(f)).toExponential(1)})`);
}

// ── 3. 거친 표현 비용 절감 ──
{
  const nbx = LOD.blocksPerAxis(N, BS);
  const coarseCells = nbx * nbx * nbx, fineCells = N * N * N;
  check('거친 표현 비용 절감 — coarse 셀 수(블록) ≪ fine 셀 수(bs³ 배)', coarseCells * 100 < fineCells,
    `coarse ${coarseCells}블록 vs fine ${fineCells}셀 (${(fineCells / coarseCells).toFixed(0)}× 절감)`);
}

// ── 4. 관찰자 LOD — near fine·far coarse ──
{
  const obs = [N / 2, N / 2, N / 2], radius = 1;   // 블록 단위 반경 1
  const lv = LOD.lodLevels(N, BS, obs, radius), nbx = LOD.blocksPerAxis(N, BS);
  const centerBlock = lv[(((N / 2 / BS) | 0) * nbx + ((N / 2 / BS) | 0)) * nbx + ((N / 2 / BS) | 0)];
  const cornerBlock = lv[0];   // (0,0,0) — 멀다
  check('관찰자 LOD — near 블록 fine(0)·far 블록 coarse(1)', centerBlock === 0 && cornerBlock === 1,
    `중심 블록 lv ${centerBlock}(fine) · 모서리 블록 lv ${cornerBlock}(coarse)`);
}

// ── 5. 비용이 세계 크기와 분리(레버3 핵심) ──
let scaleInfo = '';
{
  // 관찰자 국소 radius 고정, N 키움 → fine 예산 일정·유효 ≪ N³.
  const radius = 1.5;
  const small = LOD.effectiveCellCount(32, BS, [16, 16, 16], radius);
  const big = LOD.effectiveCellCount(64, BS, [32, 32, 32], radius);
  scaleInfo = `N=32: 유효 ${small.effective}(fine ${small.fine}+coarse ${small.coarse})/조밀 ${small.dense} · N=64: 유효 ${big.effective}/조밀 ${big.dense}`;
  // fine 예산은 N 두 배에도 거의 그대로(관찰자 국소)·유효 셀 ≪ 조밀 N³.
  const fineFlat = Math.abs(big.fine - small.fine) <= small.fine * 0.5;     // fine 예산 거의 일정
  const muchLess = big.effective < big.dense / 50;                          // 유효 ≪ N³
  check('비용이 세계 크기와 분리(레버3) — N 키워도 fine 예산 일정·유효 셀 ≪ 조밀 N³',
    fineFlat && muchLess, scaleInfo);
}

// ── 6. 다중 필드 보존(질량·운동량) ──
{
  const rho = randField(N, 3), mom = randField(N, 4);
  const rB = LOD.upsample(LOD.downsample(rho, N, BS), N, BS), mB = LOD.upsample(LOD.downsample(mom, N, BS), N, BS);
  check('다중 필드 보존 — 질량·운동량 각각 Σ 보존', relOk(sum(rB), sum(rho)) && relOk(sum(mB), sum(mom)),
    `Σ질량 ${sum(rho).toFixed(2)}→${sum(rB).toFixed(2)} · Σ운동량 ${sum(mom).toFixed(2)}→${sum(mB).toFixed(2)}`);
}

// ── 7. 결정론(동일 정책 → 동일 결과) ──
{
  function run() { const f = randField(N, 9); const b = LOD.upsample(LOD.downsample(f, N, BS), N, BS); let h = 0; for (let i = 0; i < b.length; i++) h = (h * 131 + Math.round(b[i] * 1e6)) >>> 0; return h; }
  const a = run(), b = run();
  check('결정론 — 동일 LOD 정책 → 동일 결과 지문', a === b, `0x${(a >>> 0).toString(16)}`);
}

console.log('\n=== step_0034 수치 검증: S7(레버3) 공간 LOD — 비용을 세계 크기에서 분리 ===');
console.log(`  [레버3 핵심] ${scaleInfo}`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`);
const ok = checks.every(c => c.pass);
console.log(`\n결과: ${ok ? 'PASS' : 'FAIL'} (${checks.filter(c => c.pass).length}/${checks.length})\n`);
process.exit(ok ? 0 : 1);
