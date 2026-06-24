// step_0058/capture.js — 눈 검증: TW1 구름 저항 → 진짜 산. 대량 구체를 평평 바닥에 쏟아 더미를 쌓는다.
//   design/environment.md §3 TW1. 구름 저항 없으면(0057) 구가 데굴데굴 굴러 *납작하게 퍼지고*, 있으면 굴러가다
//   멈춰 *가파른 원뿔 산*이 선다. 좌2 패널=구름저항 X(퍼짐)·우2 패널=구름저항 O(산이 솟는다). x-z 단면·색=속도.
//   PNG=tools/htj-capture.js. 실행: node HTJ/steps/step_0058/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const R = 40, sr = 0.9, gold = Math.PI * (3 - Math.sqrt(5)), NS = 150;
const gopt = { G: 0.3 * R * R / 1e9, soft: 3 }, copt = { k: 20, cDamp: 18 }, fopt = { k: 20, mu: 0.9 };
function mk(cx, cy, cz, m, r, anc) { return { cx, cy, cz, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!anc }; }
function build() {
  const es = [mk(0, 0, 0, 1e9, R, true)];
  // 꼭대기 위 뭉친 덩어리로 떨군다(좁은 원판·낮게) → 빨리 쌓인다.
  for (let i = 0; i < NS; i++) { const rr = Math.sqrt(i / NS) * 6, th = gold * i; es.push(mk(Math.cos(th) * rr, Math.sin(th) * rr * 0.35, R + 3 + (i % 25) * 0.8, 1, sr)); }
  return es;
}
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
const Nc = 64, OX = Nc / 2, OZb = Nc * 0.72, sc = Nc * 0.85 / 22;       // 바닥 곡선 보이게·지면+더미(높이 22) 확대
function snap(es) {
  // 색 = 높이(바닥 위 z−R) → 봉우리=뜨겁게·바닥=차갑게(지형 윤곽이 읽힌다).
  let hmax = 1e-9; for (const e of es) if (!e.anchored) hmax = Math.max(hmax, Math.hypot(e.cx, e.cy, e.cz) - R);
  return { pts: es.map(e => ({ cx: OX + e.cx * sc, cy: OZb - (e.cz - R) * sc, r: e.anchored ? R * sc : Math.max(0.6, e.radius * sc * 1.6),
    v: e.anchored ? 0.06 : Math.max(0.12, Math.min(1, (Math.hypot(e.cx, e.cy, e.cz) - R) / hmax)) })) };
}
function run(muRoll, marks) {
  const es = build(), g = es[0], ropt = { k: 20, muRoll }, frames = [];
  for (let s = 1; s <= 9000; s++) {
    En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt);
    En.applyEntityFriction(es, 0.02, fopt); if (muRoll > 0) En.applyEntityRollingResistance(es, 0.02, ropt);
    En.stepEntities(es, 0.02);
    g.cx = g.cy = g.cz = 0; g.px = g.py = g.pz = 0; g.Lx = g.Ly = g.Lz = 0;
    if (marks.includes(s)) frames.push(snap(es));
  }
  const sm = es.slice(1);
  const h = Math.max(...sm.map(e => Math.hypot(e.cx, e.cy, e.cz) - R));
  const rms = Math.sqrt(sm.reduce((s, e) => s + e.cx * e.cx + e.cy * e.cy, 0) / sm.length);
  return { frames, angle: Math.atan2(h, rms) * 180 / Math.PI, h, rms };
}

const free = run(0, [1500, 9000]);            // 구름저항 X — 쌓이다 퍼짐
const roll = run(1.0, [1500, 9000]);          // 구름저항 O — 가파른 산
const frames = [free.frames[0], free.frames[1], roll.frames[0], roll.frames[1]];   // 좌2=X(퍼짐)·우2=O(산)
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc });

const ok = fs.existsSync(outPath) && roll.angle > free.angle * 1.8 && roll.angle > 18;
console.log('\n=== 눈 검증: TW1 구름 저항 → 진짜 산(가파른 원뿔 더미) ===');
console.log(`  구체 ${NS}개 투하 (평평 바닥 R=${R})`);
console.log(`  안식각: 구름저항 X ${free.angle.toFixed(1)}°(납작·퍼짐) → 구름저항 O ${roll.angle.toFixed(1)}°(가파른 산·높이 ${roll.h.toFixed(1)}/반경 ${roll.rms.toFixed(1)})`);
console.log('  패널: [구름저항X 최종=팬케이크] · [구름저항O 산이 솟는다 ×3]');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 구름 저항으로 구체가 가파른 산으로 쌓인다(딛는 지형 창발)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
