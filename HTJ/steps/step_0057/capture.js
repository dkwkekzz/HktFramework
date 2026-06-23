// step_0057/capture.js — 눈 검증: TW1 마찰. 안식각 — 같은 더미를 마찰 없이/있게 떨궈 비교.
//   design/environment.md §3 TW1. 마찰의 진짜 효과 = 안식각(angle of repose): 마찰 없으면 구가 액체처럼
//   *퍼져 팬케이크*가 되고, 마찰 있으면 *쌓여 더미*가 된다(딛는 표면이 모양을 유지). 위=마찰X·아래=마찰O,
//   각 4 패널(시간 경과). 색=속도(빠름→느림=정착). x-z 단면. PNG=tools/htj-capture.js.
//   실행: node HTJ/steps/step_0057/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const N = 48, R = 50, sr = 1.1, gold = Math.PI * (3 - Math.sqrt(5));
const OX = N / 2, OZ = N * 0.16;                                // 화면 투영 원점(지면 꼭대기를 화면에)
const gopt = { G: 5e-6, soft: 2 }, copt = { k: 25, cDamp: 22 };

function ent(cx, cy, cz, mass, r, anchored) {
  return { cx, cy, cz, mass, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0,
    KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!anchored };
}
// 같은 초기 더미(좁은 기둥)를 만든다 — 마찰 노브만 다르게.
function build() {
  const es = [ent(0, 0, 0, 1e7, R, true)];
  for (let i = 0; i < 26; i++) {
    const rr = Math.sqrt(i / 26) * 2.4, th = gold * i;
    es.push(ent(Math.cos(th) * rr, Math.sin(th) * rr * 0.5, R + 3 + i * 0.9, 50, sr, false));
  }
  return es;
}
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
// 지면 꼭대기(z=R) 부근만 화면에 — z 를 (z-R) 로 옮겨 표면을 바닥에 둔다.
function snap(es) {
  let vmax = 0; for (const e of es) if (!e.anchored) vmax = Math.max(vmax, speed(e));
  return es.map(e => ({ cx: OX + e.cx, cy: OZ + (e.cz - R) + (e.anchored ? 0 : 0), r: e.anchored ? 60 : e.radius,
    v: e.anchored ? 0.1 : (vmax > 0 ? Math.min(1, speed(e) / vmax) : 0) }));
}
function pin(g) { g.cx = g.cy = g.cz = 0; g.px = g.py = g.pz = 0; g.Lx = g.Ly = g.Lz = 0; }

function runFrames(mu) {
  const es = build(), g = es[0], fopt = { k: 25, mu };
  const marks = [120, 900, 2500, 6000], frames = [];
  for (let s = 1; s <= 6000; s++) {
    En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt);
    En.applyEntityFriction(es, 0.02, fopt); En.stepEntities(es, 0.02); pin(g);
    if (marks.includes(s)) frames.push(snap(es));
  }
  const sm = es.slice(1);
  const spread = Math.sqrt(sm.reduce((s, e) => s + e.cx * e.cx + e.cy * e.cy, 0) / sm.length);
  return { frames, spread, settled: sm.every(e => speed(e) < 0.2) };
}

const free = runFrames(0), grip = runFrames(0.9);
// 위 줄=마찰X(4 패널)·아래 줄=마찰O(4 패널). writeFramesPNG 는 1 줄 = frames 배열 → 두 번 호출 대신 8 프레임.
const frames = free.frames.concat(grip.frames).map(f => ({ pts: f.map(p => ({ cx: p.cx, cy: p.cy, r: p.r, v: p.v })) }));
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N });

// 정착은 정보로만(곡면 위 구가 느리게 계속 구를 수 있음) — 게이트는 안식각 대조(핵심 가설).
const ok = fs.existsSync(outPath) && grip.spread < free.spread * 0.7;
console.log('\n=== 눈 검증: TW1 마찰 — 안식각(마찰X 퍼짐 vs 마찰O 더미) ===');
console.log(`  위 4 패널 = 마찰 없음(μ=0) · 아래 4 패널 = 마찰 있음(μ=0.9) · 같은 초기 더미`);
console.log(`  퍼짐(수평 반경 RMS): 마찰X ${free.spread.toFixed(2)}(팬케이크) · 마찰O ${grip.spread.toFixed(2)}(더미·${(grip.spread / free.spread * 100).toFixed(0)}%) · 정착 ${free.settled && grip.settled}`);
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 마찰이 구를 더미로 쌓는다(안식각·딛는 표면이 모양 유지)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
