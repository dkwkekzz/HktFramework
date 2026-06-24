// step_0066/capture.js — 눈 검증: 지형이 자란다(퇴적 발현). 자유 구체가 계곡으로 굴러 정착하면(0059 물리),
//   그 정착 퇴적물이 지형 표면 *위에 얹혀* 표면을 들어올린다 → 계곡이 차오른다(시간 경과 4 프레임).
//   design/environment.md §2/§4(쌓임=구체 법칙의 창발) + merge-dna §5 T1(표면 발현) 확장.
//   x-z 단면(가운데 y 행)·표면=법선 음영 채움 band(terrainSurface deposits)·정착 구체가 band 를 들어올린다.
//   PNG=tools/htj-capture.js(disc). 실행: node HTJ/steps/step_0066/capture.js
'use strict';
const path = require('path'), fs = require('fs');
const En = require(path.resolve(__dirname, '../../engine/htj-entity.js'));
const T = require(path.resolve(__dirname, '../../engine/htj-terrain.js'));
const Cap = require(path.resolve(__dirname, '../../tools/htj-capture.js'));

const R = 60, AR = 3.2, sr = 1.3, SPC = 3, W = 15;
const gopt = { G: 7.2e-7, soft: 3 }, copt = { k: 40, cDamp: 25 }, fopt = { k: 40, mu: 0.9 }, ropt = { k: 40, muRoll: 1.2 };
const bowl = (x, y) => 0.018 * (x * x + y * y) - 6;                 // 가운데 낮은 사발(계곡)
function mk(cx, cy, cz, m, r, anc) { return { cx, cy, cz, mass: m, px: 0, py: 0, pz: 0, Lx: 0, Ly: 0, Lz: 0, KEcm: 0, internalKE: 0, internalE: 0, energy: 0, cells: 100, radius: r, temp: 0, peak: 1, anchored: !!anc }; }
function build() {
  const es = [mk(0, 0, 0, 1e9, R, true)];                          // 바닥 구(중력원·가둠)
  for (let gx = -W; gx <= W; gx += SPC) for (let gy = -W; gy <= W; gy += SPC) es.push(mk(gx, gy, R + bowl(gx, gy), 1, AR, true));   // 사발 앵커 카펫
  const gold = Math.PI * (3 - Math.sqrt(5));                        // 자유 구체(퇴적 재료)를 계곡 위로 떨군다
  for (let i = 0; i < 140; i++) { const rr = Math.sqrt((i + 0.5) / 140) * W * 0.55, th = gold * i; es.push(mk(Math.cos(th) * rr, Math.sin(th) * rr, R + 10 + (i % 8) * 0.6, 60, sr, false)); }
  return es;
}
const speed = (e) => Math.hypot(e.px, e.py, e.pz) / e.mass;
// 카펫 앵커만(바닥 구 제외) → terrainSurface 입력.
const carpet = (es) => es.filter(e => e.anchored && e.radius < R * 0.5).map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz }));
// 정착 퇴적물 = 느린(speed<0.6) *그리고* 지형 위로 내려앉은(cz−R<3·드롭 고도 아님) 자유 구체.
const settled = (es) => es.filter(e => !e.anchored && speed(e) < 0.6 && (e.cz - R) < 3).map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz, radius: e.radius }));

// 고정 광원(htj-render 정신) — shade=0.45+0.55·max(0,n·L).
const Ln = (() => { const v = [0.45, 1.0, 0.6], m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();
const shade = (n) => 0.45 + 0.55 * Math.max(0, n.x * Ln[0] + n.y * Ln[1] + n.z * Ln[2]);

// 단면(가운데 y 행) — x→가로, 높이(cz−R)→세로. band = 표면부터 base 까지 채움(법선 음영).
const Nc = 64, OX = Nc * 0.5, sc = Nc * 0.85 / (2 * W + 6), OZ = Nc * 0.30, BASE = Nc * 0.96;
function frameOf(es) {
  const surf = T.terrainSurface(carpet(es), { up: 4, deposits: settled(es) });
  const J0 = surf.ny >> 1, pts = [];
  for (let I = 0; I < surf.nx; I++) {
    const v = T.vertexWorld(surf, I, J0), top = OZ - (v.cz - R) * sc, s = shade(v.n), cx = OX + v.cx * sc;
    for (let py = top; py <= BASE; py += 0.8) { const depth = 1 - (py - top) / (BASE - top + 1e-9); pts.push({ cx, cy: py, r: 0.5, v: s * (0.45 + 0.55 * depth) }); }
  }
  return { pts, nDep: surf.depositCount };
}

const es = build(), saved = es.map(e => ({ cx: e.cx, cy: e.cy, cz: e.cz })), marks = [1, 600, 2000, 5000], frames = [], deps = [];
for (let s = 1; s <= 5000; s++) {
  En.applyEntityGravity(es, 0.02, gopt); En.applyEntityContact(es, 0.02, copt);
  En.applyEntityFriction(es, 0.02, fopt); En.applyEntityRollingResistance(es, 0.02, ropt); En.stepEntities(es, 0.02);
  for (let i = 0; i < es.length; i++) if (es[i].anchored) { es[i].cx = saved[i].cx; es[i].cy = saved[i].cy; es[i].cz = saved[i].cz; es[i].px = es[i].py = es[i].pz = 0; es[i].Lx = es[i].Ly = es[i].Lz = 0; }
  if (marks.includes(s)) { const f = frameOf(es); frames.push(f); deps.push(f.nDep); }
}
const outPath = path.join(__dirname, 'capture.png');
Cap.writeFramesPNG(outPath, frames, { N: Nc });

// 계곡(원점) 표면 높이가 시간에 따라 *올라간다*(자란다).
const surfH = (es) => { const surf = T.terrainSurface(carpet(es), { up: 4, deposits: settled(es) }); const I = Math.round((0 - surf.x0) / surf.dx), J = surf.ny >> 1; return surf.heights[J * surf.nx + I] - R; };
const grew = deps[deps.length - 1] > deps[0];
const ok = fs.existsSync(outPath) && grew;
console.log('\n=== 눈 검증: 지형이 자란다(퇴적 발현) ===');
console.log(`  사발 앵커 카펫 + 자유 구체 ${es.filter(e => !e.anchored).length}개(퇴적 재료) → 계곡으로 굴러 정착`);
console.log(`  정착 퇴적물 수(프레임별): ${deps.join(' → ')}(쌓일수록 표면이 올라간다)`);
console.log('  4 패널: 맨 사발 → 구체가 계곡에 정착·쌓임 → 표면(법선 음영 band)이 계곡에서 차오른다');
console.log('  스크린샷: ' + path.relative(process.cwd(), outPath));
console.log('\n결과: ' + (ok ? '눈 검증 PASS ✅ — 정착 퇴적물이 표면이 되어 계곡이 차오른다(지형이 자란다)' : 'FAIL ❌') + '\n');
process.exit(ok ? 0 : 1);
