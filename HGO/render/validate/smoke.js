// render/validate/smoke.js — 렌더 트랙 헤드리스 스모크.
//   화면(눈 검증)이 권위지만, 그 전에 *번역이 옳게 도는지*를 수치로 확인한다:
//     ① atom 엔진을 읽기 전용으로 로드해 장면(빛 있는 step)을 돌리면 광자가 나온다.
//     ② 각 광자 λ 가 유효한 RGB 로 번역된다(0..255, 검정 아님).
//     ③ 물리 순서 보존 — 짧은 λ(고에너지)는 더 파랗고, 긴 λ(저에너지)는 더 빨갛다.
//   알리바이(atom/ 진짜 diff 0 — viewer 는 트랙 밖 HGO/ 루트 공유 셸)는
//   커밋 전 `git status` 로 확인(RENDER.md §5).
//
// 사용: node render/validate/smoke.js
'use strict';
const path = require('path');
const ATOM = path.join(__dirname, '..', '..', 'atom', 'engine');
const K = require(path.join(ATOM, 'hgo-kernel.js'));
const S = require(path.join(ATOM, 'hgo-sim.js'));
const SC = require(path.join(ATOM, 'scenes.js'));
const SP = require(path.join(__dirname, '..', 'engine', 'spectral.js'));
const R3 = require(path.join(__dirname, '..', 'engine', 'render.js'));

const SCENE = 'step-0002';
const SEED = 42;

function run() {
  const scene = SC.SCENES[SCENE];
  if (!scene) throw new Error(`장면 ${SCENE} 없음 — atom 트랙이 빛을 내보내지 않음(활성 게이트 미충족)`);
  const sim = S.createSim(scene.init(K.mulberry32(SEED >>> 0), K));
  S.run(sim, scene.ticks);

  const checks = [];
  const ph = sim.photons;

  // ① 광자가 나온다(읽을 빛)
  checks.push({ name: '광자 방출됨(읽을 빛 존재)', pass: ph.length > 0, value: ph.length });

  // ② 모든 광자가 유효한 비-검정 RGB 로 번역
  const range = SP.measureRange(ph) || { lo: 1, hi: 2 };
  let allValid = ph.length > 0, anyDark = false;
  for (const p of ph) {
    const c = SP.photonColor(p.lambda, range);
    const ok = c.length === 3 && c.every(v => Number.isFinite(v) && v >= 0 && v <= 255);
    if (!ok) allValid = false;
    if (c[0] + c[1] + c[2] === 0) anyDark = true;
  }
  checks.push({ name: '모든 광자 → 유효 RGB(0..255)', pass: allValid, value: allValid ? 'ok' : 'BAD' });
  checks.push({ name: '검정으로 죽는 광자 없음', pass: !anyDark, value: anyDark ? 'dark!' : 'none' });

  // ③ 물리 순서: 가장 짧은 λ vs 가장 긴 λ → 전자가 더 파랗고 후자가 더 빨갛다
  let order = 'n/a';
  if (range.hi > range.lo) {
    const blue = SP.photonColor(range.lo, range);   // 짧은 λ = 고에너지
    const red = SP.photonColor(range.hi, range);    // 긴 λ = 저에너지
    const bluer = blue[2] > red[2];                 // 짧은 λ 의 B 채널이 더 큼
    const redder = red[0] > blue[0];                // 긴 λ 의 R 채널이 더 큼
    order = bluer && redder;
    checks.push({ name: '스펙트럼 순서(짧은 λ=파랑, 긴 λ=빨강)', pass: bluer && redder, value: `B${blue[2]}>${red[2]} R${red[0]}>${blue[0]}` });
  } else {
    checks.push({ name: '스펙트럼 순서(단일 선 — 생략)', pass: true, value: 'single line' });
  }

  // 측정된 스펙트럼선 수
  const lines = new Set(ph.map(p => p.from + '→' + p.to));
  checks.push({ name: '측정된 스펙트럼선 수(≥1)', pass: lines.size >= 1, value: lines.size });

  // ④ L-3d 투영(렌즈 assert): 평면 z=0 세계를 원근 카메라로 투영한다.
  //    캔버스 무관 순수 수학만 검증(눈 검증은 브라우저가 권위). cv 미지정 → 560×560 기본.
  const cam = R3.makeCamera(sim.W, sim.H, sim.tick);
  const center = R3.project({ x: sim.W / 2, y: sim.H / 2, z: 0 }, cam);
  const corner = R3.project({ x: 0, y: 0, z: 0 }, cam);
  const far = R3.project({ x: sim.W, y: sim.H, z: 0 }, cam);
  // 타깃(평면 중심)은 화면 중앙 근처로 투영
  const centered = Math.abs(center.sx - cam.cw / 2) < 1 && Math.abs(center.sy - cam.ch / 2) < 1;
  checks.push({ name: 'L-3d: 평면 중심 → 화면 중앙', pass: centered, value: `(${center.sx.toFixed(0)},${center.sy.toFixed(0)})` });
  // 모든 평면 점이 카메라 앞(depth>0)으로 투영(뒤집힘·NaN 없음)
  const inFront = [center, corner, far].every(p => p.depth > 0 && Number.isFinite(p.sx) && Number.isFinite(p.sy));
  checks.push({ name: 'L-3d: 평면 점 카메라 앞(depth>0·유한)', pass: inFront, value: `d=[${corner.depth.toFixed(0)},${far.depth.toFixed(0)}]` });
  // 원근 깊이차 — 가까운 모서리와 먼 모서리의 depth 가 분리(평행이 아닌 입체)
  const hasPerspective = Math.abs(corner.depth - far.depth) > 1;
  checks.push({ name: 'L-3d: 원근 깊이차 존재(입체)', pass: hasPerspective, value: `Δdepth=${Math.abs(corner.depth - far.depth).toFixed(1)}` });

  return { checks, range, lineCount: lines.size, photonCount: ph.length };
}

const { checks, range, lineCount, photonCount } = run();
console.log(`[render smoke] 장면 ${SCENE} seed ${SEED} — 광자 ${photonCount} · 선 ${lineCount} · λ범위 [${range.lo.toFixed(3)}, ${range.hi.toFixed(3)}]`);
let allPass = true;
for (const c of checks) { const tag = c.pass ? 'PASS' : 'FAIL'; if (!c.pass) allPass = false; console.log(`  [${tag}] ${c.name} = ${c.value}`); }
console.log(allPass ? '\n✅ 렌더 스모크 PASS — 번역 옳게 돈다. 다음은 눈 검증(브라우저).' : '\n❌ 렌더 스모크 FAIL');
process.exit(allPass ? 0 : 1);
