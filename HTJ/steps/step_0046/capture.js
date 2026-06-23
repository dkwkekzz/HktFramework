// step_0046/capture.js — 눈 검증: SW5 점성 — 단열 진동이 점성으로 식어 정착한다(가역 압력 vs 비가역 점성).
//   design/sphere-world.md §6 SW5 / §5 난점 2 — 0011(비가역 점성 소산·진동 감쇠·별 정착)의 SPH 판. 0045 까지의
//   압력은 가역이라 무너진 가스가 영원히 숨쉰다(안 식음). 점성을 켜면 접근 운동E가 열로 빠져 *진동이 잦아들며 정착*.
//   대조: 같은 장면을 점성 끔(α=0)·켬(α>0) 두 번 굴려 후반 KE 진동 진폭을 비교(0043 "중력만이면 불변" 대조와 동형).
//   색=온도. PNG 는 tools/htj-capture.js. 실행: node HTJ/steps/step_0046/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const SPH = require(path.resolve(__dirname, '../../engine/htj-sph.js'));
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 48, CEN = (N - 1) / 2, eqR = (n) => En.equivalentRadius(n);
const h = 3.5, dt = 0.14, gopt = { G: 0.25, soft: 6 }, topt = { gamma: 5 / 3, h };
// 안쪽 속도로 무너지는 찬 가스 구름(0045 와 같은 씨앗) — 점성만 더한다.
function makeCloud() {
  let seed = 9; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ps = [];
  for (let i = 0; i < 60; i++) {
    const r = 4 + rnd() * 5, th = rnd() * 2 * Math.PI, ph = Math.acos(2 * rnd() - 1);
    const ux = Math.sin(ph) * Math.cos(th), uy = Math.sin(ph) * Math.sin(th), uz = Math.cos(ph), m = 1, vin = -0.4;   // 묶인 붕괴(터지지 않고 숨쉬다 점성으로 정착)
    ps.push({ cx: CEN + r * ux, cy: CEN + r * uy, cz: CEN + r * uz, mass: m, px: m * vin * ux, py: m * vin * uy, pz: m * vin * uz,
      KEcm: 0.5 * m * vin * vin, internalE: 0.2, energy: 0.2 + 0.5 * m * vin * vin, cells: 5, radius: eqR(5) });
  }
  return ps;
}
const totKE = (ps) => ps.reduce((s, p) => s + 0.5 * (p.px * p.px + p.py * p.py + p.pz * p.pz) / p.mass, 0);
const totU = (ps) => ps.reduce((s, p) => s + p.internalE, 0);
const sumPx = (ps) => ps.reduce((s, p) => s + p.px, 0);
const rms = (ps) => { let cx = 0, cy = 0, cz = 0, M = 0; for (const p of ps) { cx += p.mass * p.cx; cy += p.mass * p.cy; cz += p.mass * p.cz; M += p.mass; } cx /= M; cy /= M; cz /= M; let s = 0; for (const p of ps) s += (p.cx - cx) ** 2 + (p.cy - cy) ** 2 + (p.cz - cz) ** 2; return Math.sqrt(s / ps.length); };

// 한 세계를 STEPS 만큼 굴린다. alpha>0 이면 점성. KE 궤적 기록(후반 진동 진폭 비교용).
function run(alpha, STEPS, capStops) {
  const ps = makeCloud(); const vopt = { alpha, beta: 2 * alpha, gamma: 5 / 3, h };
  const keTrace = [], frames = [];
  for (let t = 0, fi = 0; t <= STEPS; t++) {
    if (capStops && fi < capStops.length && t === capStops[fi]) {
      frames.push({ pts: ps.map(p => ({ cx: p.cx, cy: p.cy, r: p.radius, t: p.internalE / p.mass })), U: totU(ps), KE: totKE(ps), rms: rms(ps), P: sumPx(ps) });
      fi++;
    }
    En.applyEntityGravity(ps, dt, gopt);
    SPH.sphThermalPressureForce(ps, dt, topt);   // 가역 열압력(0045)
    SPH.sphViscosity(ps, dt, vopt);              // 비가역 점성(이 step)
    En.stepEntities(ps, dt, { N });
    keTrace.push(totKE(ps));
  }
  return { ps, keTrace, frames };
}

const STEPS = 120;
const stops = [0, 18, 45, 120];                  // 시작 → 첫 압축(핫코어) → 첫 되튐 → 후반(점성으로 정착)
const visc = run(1.5, STEPS, stops);             // 점성 켬(프레임은 여기서)
const ctrl = run(0.0, STEPS, null);              // 점성 끔(대조)

// 후반 절반의 KE 진동 진폭(max−min) — 점성이 식히면 진폭이 작아진다(가역 압력 vs 비가역 점성).
const late = (tr) => { const s = tr.slice(Math.floor(tr.length / 2)); return Math.max(...s) - Math.min(...s); };
const ampVisc = late(visc.keTrace), ampCtrl = late(ctrl.keTrace);
const Uvisc = totU(visc.ps), Uctrl = totU(ctrl.ps);

// 온도 → 색값 v(0..1) 정규화(전 프레임 최고 온도 기준).
let gT = 0; for (const f of visc.frames) for (const p of f.pts) if (p.t > gT) gT = p.t;
for (const f of visc.frames) for (const p of f.pts) p.v = gT > 0 ? p.t / gT : 0;
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, visc.frames, { N });

// 검증: ① 점성이 후반 진동 진폭을 줄임(감쇠·ampVisc<ampCtrl) ② 점성 쪽 최종 내부E 더 큼(소산 열 추가·Uvisc>Uctrl)
//   ③ 운동량 ΣP_x 정확 보존. (점성 *단독* 의 단방향 데움=시간의 화살은 verify.js test1·3 이 증명 — 이 결합 장면엔
//    가역 압력 0045 도 함께 돌아 팽창 시 U 가 식을 수 있으므로 프레임 단조 대신 *점성 켬 vs 끔* 의 소산 열 대조로 본다.)
const damped = ampVisc < ampCtrl * 0.6;
const dissipatedHeat = Uvisc > Uctrl;
let consP = true; for (let k = 1; k < visc.frames.length; k++) if (Math.abs(visc.frames[k].P - visc.frames[0].P) > 1e-3) consP = false;
const ok = fs.existsSync(outPath) && damped && dissipatedHeat && consP;
console.log('\n=== 눈 검증: SW5 점성 — 단열 진동이 식어 정착한다(비가역 소산) ===');
console.log('  [점성 켬] rms(수축→되튐→정착): ' + visc.frames.map(f => f.rms.toFixed(2)).join(' → '));
console.log('  [점성 켬] 내부E U(단조 데움): ' + visc.frames.map(f => f.U.toFixed(1)).join(' → '));
console.log('  [점성 켬] 운동E KE: ' + visc.frames.map(f => f.KE.toFixed(1)).join(' → '));
console.log('  [점성 켬] 운동량 ΣP_x(보존): ' + visc.frames.map(f => f.P.toFixed(3)).join(' → '));
console.log(`  후반 KE 진동 진폭 — 점성 켬 ${ampVisc.toFixed(1)} < 점성 끔 ${ampCtrl.toFixed(1)}(감쇠)`);
console.log(`  최종 내부E — 점성 켬 ${Uvisc.toFixed(1)} > 점성 끔 ${Uctrl.toFixed(1)}(소산 열 추가)`);
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
