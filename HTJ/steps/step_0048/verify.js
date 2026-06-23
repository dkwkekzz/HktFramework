// step_0048/verify.js — SW5 적응 평활길이 h(자기일관 측정). 순수·독립·영구.
//
//   design/sphere-world.md §6 SW5 / §4 — 고정 h 는 밀도가 자릿수로 변하는 붕괴 코어를 과평활/희박부 미분해.
//   표준 SPH 는 h_i 를 국소 밀도에 묶어 *이웃 수를 일정*하게 유지: h_i = η(m_i/ρ_i)^⅓ (자기일관·고정점 반복).
//   SW4 적응 LOD(분해능이 물질을 따라감)의 SPH·연속판. 0040 밀도처럼 *수동 측정*(a.h·a.density 만·힘 없음→회귀0).
//   적정 검증: ① 자기일관 수렴(h_i=η(m_i/ρ_i)^⅓) ② 밀도 적응=이웃 수 일정(고정 h 대비 개선·코어 h<헤일로 h)
//   ③ 항등(균일 밀도→균일 h) ④ 측정만(운동량·내부E·위치 불변·신규 함수→회귀0) ⑤ 결정론.
//   실행: node HTJ/steps/step_0048/verify.js
'use strict';
const path = require('path');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));

const checks = [];
function check(name, pass, value) { checks.push({ name, pass: !!pass, value: value == null ? '' : String(value) }); }

function ent(cx, cy, cz, mass) { return { cx, cy, cz, mass, px: 0, py: 0, pz: 0, internalE: 1, energy: 1 }; }
const clone = (ps) => ps.map(p => ({ ...p }));
function rndGen(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
// 변밀도 구름 — 조밀 코어(반경 1.5) + 희박 헤일로(반경 4~8). 앞 nCore 개=코어, 뒤=헤일로.
function variedCloud(nCore, nHalo, seed) {
  const rnd = rndGen(seed), ps = [];
  const shell = (rmin, rmax) => { const r = rmin + rnd() * (rmax - rmin), th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1); return ent(r * Math.sin(ph) * Math.cos(th), r * Math.sin(ph) * Math.sin(th), r * Math.cos(ph), 1); };
  for (let i = 0; i < nCore; i++) ps.push(shell(0, 1.5));
  for (let i = 0; i < nHalo; i++) ps.push(shell(4, 8));
  return ps;
}
// 2h_i 안의 이웃 수(자기 포함). 변동계수 CoV = std/mean.
function nbCount(ps, fixedH) { return ps.map(p => { let c = 0; for (const q of ps) { const dx = p.cx - q.cx, dy = p.cy - q.cy, dz = p.cz - q.cz; const hh = fixedH != null ? fixedH : p.h; if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 2 * hh) c++; } return c; }); }
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const cov = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length) / m; };

const ETA = 1.3;

// ── 1. 자기일관 수렴 — 모든 입자에서 h_i = η(m_i/ρ_i)^⅓ 성립(고정점 수렴·잔차→0) ──
{
  const ps = variedCloud(60, 60, 5);
  SPH.sphAdaptiveH(ps, { eta: ETA, h0: 1.5 });
  let maxRes = 0;
  for (const p of ps) { const want = ETA * Math.cbrt(p.mass / p.density); maxRes = Math.max(maxRes, Math.abs(want - p.h) / p.h); }
  check('자기일관 수렴 — h_i = η(m_i/ρ_i)^⅓ (잔차→0)', maxRes < 1e-4, `max 상대 잔차 ${maxRes.toExponential(2)}`);
}

// ── 2. 밀도 적응 = 이웃 수 일정(고정 h 대비 개선) — 코어 h < 헤일로 h, 이웃수 CoV 적응 ≪ 고정 ──
{
  const ps = variedCloud(60, 60, 5);
  SPH.sphAdaptiveH(ps, { eta: ETA, h0: 1.5 });
  const coreH = mean(ps.slice(0, 60).map(p => p.h)), haloH = mean(ps.slice(60).map(p => p.h));
  const covAdapt = cov(nbCount(ps, null));          // 적응 h_i 로 잰 이웃 수
  const covFixed = cov(nbCount(ps, 1.5));           // 같은 구름·고정 h=1.5
  // 코어가 더 조밀 → 더 좁은 h. 적응이면 이웃 수가 균일(낮은 CoV), 고정이면 코어에 몰림(높은 CoV).
  check('밀도 적응 — 코어 h < 헤일로 h · 이웃 수 CoV 적응 ≪ 고정',
    coreH < haloH * 0.6 && covAdapt < covFixed * 0.7,
    `코어 h ${coreH.toFixed(2)} < 헤일로 h ${haloH.toFixed(2)}(${(haloH / coreH).toFixed(1)}×) · 이웃수 CoV 적응 ${covAdapt.toFixed(2)} vs 고정 ${covFixed.toFixed(2)}`);
}

// ── 3. 항등 — 균일 밀도(격자)면 (내부) h 가 거의 균일 ──
{
  const ps = []; const s = 1.0;
  for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) for (let z = -3; z <= 3; z++) ps.push(ent(x * s, y * s, z * s, 1));  // 7³ 균일 격자
  SPH.sphAdaptiveH(ps, { eta: ETA, h0: 1.2 });
  // 중심 근방(경계 효과 없는) 입자만 — |coord| ≤ 1 인 3³ 코어
  const inner = ps.filter(p => Math.abs(p.cx) <= 1 && Math.abs(p.cy) <= 1 && Math.abs(p.cz) <= 1).map(p => p.h);
  const covInner = cov(inner);
  check('항등 — 균일 밀도 → 내부 h 균일', covInner < 0.02, `내부(3³) h CoV ${covInner.toExponential(2)} · h≈${mean(inner).toFixed(3)}`);
}

// ── 4. 측정만(보존·안전) — 위치·운동량·내부E 불변(힘 없음)·빈/특이 무탈 ──
{
  const ps = variedCloud(30, 30, 9), before = clone(ps);
  SPH.sphAdaptiveH(ps, { eta: ETA, h0: 1.5 });
  let untouched = true;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = before[i];
    if (a.cx !== b.cx || a.cy !== b.cy || a.cz !== b.cz) untouched = false;   // 위치 불변(자유 운동 안 함)
    if (a.px !== b.px || a.py !== b.py || a.pz !== b.pz) untouched = false;   // 운동량 불변(힘 없음)
    if (a.internalE !== b.internalE || a.energy !== b.energy) untouched = false;   // 내부E 불변
  }
  const empty = SPH.sphAdaptiveH([], { eta: ETA });
  const single = [ent(0, 0, 0, 2)]; SPH.sphAdaptiveH(single, { eta: ETA, h0: 1 });
  const safeSingle = isFinite(single[0].h) && single[0].h > 0 && isFinite(single[0].density) && single[0].density > 0;  // 외톨이=분해 척도 없음·발산 안 함(유한)
  check('측정만 — 위치·운동량·내부E 불변 · 빈/특이 무탈', untouched && empty.length === 0 && safeSingle,
    `불변 ${untouched} · 빈 [] · 단일 유한(h=${single[0].h.toExponential(1)})`);
}

// ── 5. 결정론 — 같은 입력 → 같은 h 지문 ──
{
  function fnv(ps) {
    let h = 0x811c9dc5 >>> 0;
    const push = (x) => { const b = Buffer.alloc(8); b.writeDoubleLE(Math.round(x * 1e6) / 1e6, 0); for (let k = 0; k < 8; k++) { h ^= b[k]; h = Math.imul(h, 0x01000193) >>> 0; } };
    for (const p of ps) { push(p.h); push(p.density); }
    return h >>> 0;
  }
  const a = fnv(SPH.sphAdaptiveH(variedCloud(40, 40, 77), { eta: ETA, h0: 1.5 }));
  const b = fnv(SPH.sphAdaptiveH(variedCloud(40, 40, 77), { eta: ETA, h0: 1.5 }));
  check('결정론 — 같은 입력 → 같은 h 지문', a === b, `0x${a.toString(16)}`);
}

let pass = 0;
for (const c of checks) { if (c.pass) pass++; console.log(`${c.pass ? 'PASS' : 'FAIL'}  ${c.name}${c.value ? ' = ' + c.value : ''}`); }
console.log(`\n${pass}/${checks.length} ${pass === checks.length ? 'PASS — SW5 적응 평활길이 h: h_i=η(m_i/ρ_i)^⅓ 자기일관·분해능이 밀도를 따라감(이웃 수 일정)' : 'FAIL'}`);
process.exit(pass === checks.length ? 0 : 1);
