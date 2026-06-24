// step_0059/capture.js — 눈 검증: TW1 펼쳐진 지형. 높이장 봉우리·계곡 위에 대량 구체가 정착·계곡에 모인다.
//   design/environment.md §3 TW1. 0056~0058(딛는 지형 물리)을 *펼쳐진 연속 지형*으로 키워 "이게 지형이다"를 보인다.
//   골격 = 바닥 구 + 높이장 봉우리 앵커(보라). 그 위 대량 구체(색=높이)가 떨어져 표면에 정착·봉우리서 굴러내려
//   계곡에 모인다. 4 패널(시간 경과). x-z 단면. PNG=tools/htj-capture.js. 실행: node HTJ/steps/step_0059/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const R = 60, AR = 4.0, sr = 1.1, SPC = 3, W = 16;
const gopt = { G: 7.2e-7, soft: 3 }, copt = { k: 40, cDamp: 25 }, fopt = { k: 40, mu: 0.9 }, ropt = { k: 40, muRoll: 1.5 };
function hf(x, y) { return 3.2 * Math.sin(0.36 * x) * Math.cos(0.3 * y) + 2.2 * Math.sin(0.24 * x + 0.2 * y); }
function mk(cx, cy, cz, m, r, anc) { return { cx, cy, cz, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!anc }; }
function build() {
  const es = [mk(0, 0, 0, 1e9, R, true)];
  for (let gx = -W; gx <= W; gx += SPC) for (let gy = -W; gy <= W; gy += SPC) es.push(mk(gx, gy, R + hf(gx, gy), 1, AR, true));
  const gold = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 130; i++) { const rr = Math.sqrt((i + 0.5) / 130) * W * 0.7, th = gold * i; es.push(mk(Math.cos(th) * rr, Math.sin(th) * rr, R + 13 + (i % 10) * 0.5, 50, sr, false)); }
  return es;
}
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
// x-z 단면(|y|<4 인 것만 = 가운데 슬랩) — 옆에서 본 지형 윤곽. 색: 앵커=어둡게·구체=높이.
const Nc = 64, OX = Nc / 2, OZb = Nc * 0.62, sc = Nc * 0.85 / 26;
function snap(es) {
  let hmin = 1e9, hmax = -1e9; for (const e of es) if (!e.anchored) { hmin = Math.min(hmin, e.cz - R); hmax = Math.max(hmax, e.cz - R); }
  const pts = [];
  for (const e of es) {
    if (Math.abs(e.cy) > 4.5) continue;                          // 가운데 단면만
    pts.push({ cx: OX + e.cx * sc, cy: OZb - (e.cz - R) * sc, r: e.anchored ? AR * sc * 1.1 : Math.max(0.7, sr * sc * 1.7),
      v: e.anchored ? 0.12 : Math.max(0.15, Math.min(1, ((e.cz - R) - hmin) / (hmax - hmin + 1e-9))) });
  }
  return { pts };
}
const es = build(), saved = es.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz })), marks = [200, 1200, 3500, 8000], frames = [];
for (let s = 1; s <= 8000; s++) {
  En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt);
  En.applyEntityFriction(es, 0.02, fopt); En.applyEntityRollingResistance(es, 0.02, ropt);
  En.stepEntities(es, 0.02);
  // 앵커 고정 = 정적 지형(위치·속도·스핀 매 step 복원·environment §4).
  for (let i = 0; i < es.length; i++) if (es[i].anchored) { es[i].cx = saved[i].cx; es[i].cy = saved[i].cy; es[i].cz = saved[i].cz; es[i].px = es[i].py = es[i].pz = 0; es[i].Lx = es[i].Ly = es[i].Lz = 0; }
  if (marks.includes(s)) frames.push(snap(es));
}
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc });

const free = es.filter(e => !e.anchored);
const meanHF = free.reduce((s, e) => s + hf(e.cx, e.cy), 0) / free.length;
const meanSpeed = free.reduce((s, e) => s + speed(e), 0) / free.length;
const ok = fs.existsSync(outPath) && meanHF < -0.5 && meanSpeed < 0.35;
console.log('\n=== 눈 검증: TW1 펼쳐진 지형(높이장 봉우리·계곡 위에 구체 정착·계곡 모임) ===');
console.log(`  지형 = 바닥 구 + 높이장 봉우리 앵커 + 자유 구체 ${free.length}개`);
console.log(`  정착 평균 속도 ${meanSpeed.toFixed(3)} · 계곡 모임: 평균 지형높이 ${meanHF.toFixed(2)}(<0=계곡 선호)`);
console.log('  4 패널: 구체가 떨어져 → 기복 표면에 닿아 → 봉우리서 굴러내려 → 계곡에 모인다(색=높이)');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 펼쳐진 지형(봉우리·계곡) 위에 구체가 정착·계곡에 모인다' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
