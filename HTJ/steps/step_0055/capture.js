// step_0055/capture.js — 눈 검증: SW5 자동 이주 트리거 — 조건 충족 격자 영역을 SPH 입자로 *이동*(격자 은퇴).
//   design/sphere-world.md §6 SW5 "격자 유체를 구체로 이주 → 격자 은퇴". 0051(복사)와 달리 *이동* — 옮긴 셀은
//   격자에서 빈다. 4 패널: ① 격자 블롭(슬라이스·전부 격자) → ② 코어 region 이주 후 *격자 잔류만*(코어 구멍 = 은퇴) →
//   ③ 이주된 입자만(SPH 가 코어를 이어받음) → ④ 입자 SPH 자유 붕괴. 전역 총량 정확 보존(콘솔). PNG=tools/htj-capture.js.
//   실행: node HTJ/steps/step_0055/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const W = require(path.resolve(__dirname, '../../engine/htj-world.js'));
const Gr = require(path.resolve(__dirname, '../../engine/htj-gravity.js'));
const Th = require(path.resolve(__dirname, '../../engine/htj-thermal.js'));
const Ine = require(path.resolve(__dirname, '../../engine/htj-inertia.js'));
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 24, c = (N - 1) / 2, sig = N * 0.16, zc = (c | 0);
// 격자 유체 블롭 — 자기중력으로 살짝 붕괴(운동량·코어 가열).
const w = W.createWorld(N); { const rho = w.fields.energy, u = w.addField('therm');
  w.addField('mom_x'); w.addField('mom_y'); w.addField('mom_z');
  for (let z = 0; z < N; z++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d2 = (x - c) ** 2 + (y - c) ** 2 + (z - c) ** 2, i = (z * N + y) * N + x;
    const r = 2.0 * Math.exp(-d2 / (2 * sig * sig)); rho[i] = r; u[i] = r * 0.3; } }
for (let t = 0; t < 8; t++) { Gr.applyGravity(w, 0.2, { G: 0.25, iters: 40 }); Th.applyThermalPressure(w, 0.2, { Kth: 0.3, gamma: 5 / 3 }); Ine.advect(w, 0.2, { scalars: ['therm'] }); }

const fSum = (nm) => { const a = w.fields[nm]; if (!a) return 0; let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
const occ = () => w.count('energy', 0.05);
// 전역 총량(격자 + 입자) — 이동 보존 확인용.
const total = (ps) => ({ M: fSum('energy') + ps.reduce((s, p) => s + p.mass, 0), U: fSum('therm') + ps.reduce((s, p) => s + p.internalE, 0) });

// 격자 z=중앙 슬라이스 스냅(색=온도).
function latSlice(rmin) {
  const rho = w.fields.energy, u = w.fields.therm, pts = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = (zc * N + y) * N + x, r = rho[i];
    if (r < (rmin || 0.05)) continue;
    pts.push({ cx: x, cy: y, r: 0.62, T: r > 1e-9 ? u[i] / r : 0 });
  }
  return pts;
}
function parSlice(ps) { return ps.filter(p => Math.abs(p.cz - c) < 1.2).map(p => ({ cx: p.cx, cy: p.cy, r: 0.62, T: p.mass > 1e-9 ? p.internalE / p.mass : 0 })); }

const occBefore = occ();
const t0 = total([]);
const panel1 = latSlice();                               // ① 전부 격자

// ── 자동 이주 트리거: 코어 region(반지름 5)만 SPH 로 *이동*(격자에서 비움) ──
const res = SPH.migrateRegionToSPH(w, { region: (x, y, z) => Math.hypot(x - c, y - c, z - c) < 5, threshold: 0.05 });
let ps = res.particles;
const occAfter = occ();
const t1 = total(ps);

const panel2 = latSlice();                               // ② 격자 잔류만 — 코어 구멍(은퇴)
const panel3 = parSlice(ps);                             // ③ 이주된 입자만 — SPH 가 코어 이어받음

// ④ 입자 SPH 자유 붕괴(격자 못 하던 것).
const maxRho = () => { SPH.sphDensity(ps, { h: 2.2 }); let mx = 0; for (const p of ps) if (p.density > mx) mx = p.density; return mx; };
const r0 = maxRho();
for (let s = 0; s < 14; s++) { En.applyEntityGravity(ps, 0.12, { G: 0.25, soft: 2.5 }); SPH.sphThermalPressureForce(ps, 0.12, { gamma: 5 / 3, h: 2.2 }); En.stepEntities(ps, 0.12, { N }); }
const r1 = maxRho();
const panel4 = parSlice(ps);

const snaps = [panel1, panel2, panel3, panel4];
let Tmax = 0; for (const f of snaps) for (const p of f) if (p.T > Tmax) Tmax = p.T;
const frames = snaps.map(f => ({ pts: f.map(p => ({ cx: p.cx, cy: p.cy, r: p.r, v: Tmax > 0 ? Math.min(1, p.T / Tmax) : 0 })) }));
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

const conserved = Math.abs(t1.M - t0.M) < 1e-9 && Math.abs(t1.U - t0.U) < 1e-9;   // 이동 = 총량 불변
const retired = occAfter < occBefore && res.migratedCells > 0;                     // 격자 은퇴(활성 셀↓)
const evolved = r1 > r0 * 1.1;                                                     // 입자 자유 붕괴 계속
const ok = fs.existsSync(outPath) && conserved && retired && evolved;
console.log('\n=== 눈 검증: SW5 자동 이주 트리거(조건 영역 → SPH 이동·격자 은퇴) ===');
console.log(`  코어 region 이주: ${res.migratedCells}개 셀 → SPH 입자 ${ps.length}개 · 격자 활성 셀 ${occBefore}→${occAfter}(은퇴: ${retired})`);
console.log(`  이동 보존(복사 아님) — (격자+입자) 질량 ${t0.M.toFixed(4)}→${t1.M.toFixed(4)} · 내부E ${t0.U.toFixed(4)}→${t1.U.toFixed(4)} (Δ≈0: ${conserved})`);
console.log(`  이주 후 입자 최대ρ(자유 붕괴 계속): ${r0.toFixed(2)} → ${r1.toFixed(2)}`);
console.log('  패널: 격자 블롭 → 이주 후 격자 잔류(코어 구멍=은퇴) → 이주된 입자 → 입자 SPH 붕괴 · 색=온도 / 스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 조건 영역이 격자에서 빠져 SPH 로 이동, 격자가 은퇴하되 총량은 보존' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
