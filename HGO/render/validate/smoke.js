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

  // ⑥ L-line 정제(렌즈 assert): 전이선별 빈도 집계 — 선 수가 유니크 전이와 일치하고,
  //    빈도 합 = 전체 광자 수(누락·중복 0), maxCount 가 데이터에서 측정됨(세기 정규화 기준).
  const agg = SP.measureLines(ph);
  const sumCount = agg.lines.reduce((s, l) => s + l.count, 0);
  checks.push({ name: 'L-line: 집계 선 수 = 유니크 전이', pass: agg.lines.length === lines.size, value: `${agg.lines.length}` });
  checks.push({ name: 'L-line: 빈도 합 = 전체 광자(보존)', pass: sumCount === ph.length, value: `${sumCount}/${ph.length}` });
  checks.push({ name: 'L-line: maxCount 측정됨(≥1·세기 정규화)', pass: agg.maxCount >= 1, value: `${agg.maxCount}` });
  // λ 오름차순 정렬(보라→빨강 순 = 분광기 배치) 보존
  const sortedAsc = agg.lines.every((l, i) => i === 0 || agg.lines[i - 1].lambda <= l.lambda);
  checks.push({ name: 'L-line: λ 오름차순 정렬(분광 배치)', pass: sortedAsc, value: sortedAsc ? 'ok' : 'BAD' });

  // ⑦ L-recoil(렌즈 assert): propagate 장면(step-0004)은 광자에 운동량(px,py = p=E/c) 방향을 실어 보낸다.
  //    렌더는 그 방향을 읽어 빛 줄기를 그린다 — px=py=0(방출만)이면 줄기 없음(방향 author 0).
  const scene4 = SC.SCENES['step-0004'];
  const sim4 = S.createSim(scene4.init(K.mulberry32(SEED >>> 0), K));
  S.run(sim4, scene4.ticks);
  const maxP = R3.measureMaxMomentum(sim4.photons);
  const directed = sim4.photons.filter(p => Math.hypot(p.px || 0, p.py || 0) > 1e-9).length;
  checks.push({ name: 'L-recoil: 광자 운동량 방향 실림(시뮬 선행)', pass: maxP > 0 && directed > 0, value: `dir ${directed}/${sim4.photons.length}·maxP ${maxP.toFixed(3)}` });

  const cam4 = R3.makeCamera(sim4.W, sim4.H, 0);
  const worldLen = 0.08 * Math.max(sim4.W, sim4.H);
  const pdir = sim4.photons.find(p => Math.hypot(p.px || 0, p.py || 0) > 1e-9);
  const stk = R3.photonStreak(pdir, cam4, maxP, worldLen);
  const streakPx = stk ? Math.hypot(stk.head.sx - stk.tail.sx, stk.head.sy - stk.tail.sy) : 0;
  checks.push({ name: 'L-recoil: 방향 광자 → 화면 줄기(머리≠꼬리)', pass: streakPx > 1, value: stk ? `Δpx=${streakPx.toFixed(0)}` : 'null' });

  // 줄기 축이 *투영된 운동량 방향*과 정렬(읽기 충실 — 양의 내적). 머리−꼬리 = +운동량 투영.
  let aligned = false;
  if (stk) {
    const a2 = R3.project({ x: pdir.rx, y: pdir.ry, z: 0 }, cam4);
    const b2 = R3.project({ x: pdir.rx + pdir.px, y: pdir.ry + pdir.py, z: 0 }, cam4);
    const sdx = stk.head.sx - stk.tail.sx, sdy = stk.head.sy - stk.tail.sy;
    const mdx = b2.sx - a2.sx, mdy = b2.sy - a2.sy;
    aligned = (sdx * mdx + sdy * mdy) > 0;
  }
  checks.push({ name: 'L-recoil: 줄기 축 = 투영 운동량 방향', pass: aligned, value: aligned ? 'ok' : 'no' });

  // author 0: 운동량 0 광자(step-0002 방출만)는 줄기 없음(null)
  const stkNone = R3.photonStreak({ rx: 1, ry: 1, px: 0, py: 0 }, cam4, maxP, worldLen);
  checks.push({ name: 'L-recoil: 무방향 광자 → 줄기 없음(author 0)', pass: stkNone === null, value: stkNone === null ? 'null' : 'BAD' });

  // ⑦b L-trail(렌즈 assert): propagate 장면(step-0004)은 광자가 출생(rx0,ry0)에서 *실제로* 이동(rx,ry)한다.
  //    렌더는 그 측정 변위를 읽어 전파 트레일(출생→현재)을 그린다 — 정규화 글리프가 아니라 실거리.
  //    변위 0(방출만)이면 트레일 0(author 0).
  const movedPh = sim4.photons.filter(p => Math.hypot(p.rx - p.rx0, p.ry - p.ry0) > 1e-9).length;
  checks.push({ name: 'L-trail: 광자 출생→현재 실변위(시뮬 선행)', pass: movedPh > 0, value: `${movedPh}/${sim4.photons.length}` });
  const ptr = sim4.photons.find(p => Math.hypot(p.rx - p.rx0, p.ry - p.ry0) > 1e-9);
  const trail = R3.photonTrail(ptr, cam4);
  const trailPx = trail ? Math.hypot(trail.head.sx - trail.tail.sx, trail.head.sy - trail.tail.sy) : 0;
  checks.push({ name: 'L-trail: 변위 광자 → 화면 트레일(출생≠현재)', pass: trailPx > 1, value: trail ? `Δpx=${trailPx.toFixed(0)}` : 'null' });
  // 트레일 축이 *투영된 출생→현재 방향*과 정렬(읽기 충실 — 머리−꼬리 = +변위 투영)
  let trAligned = false;
  if (trail) {
    const a3 = R3.project({ x: ptr.rx0, y: ptr.ry0, z: 0 }, cam4);
    const b3 = R3.project({ x: ptr.rx, y: ptr.ry, z: 0 }, cam4);
    const sdx = trail.head.sx - trail.tail.sx, sdy = trail.head.sy - trail.tail.sy;
    const mdx = b3.sx - a3.sx, mdy = b3.sy - a3.sy;
    trAligned = (sdx * mdx + sdy * mdy) > 0;
  }
  checks.push({ name: 'L-trail: 트레일 축 = 출생→현재 방향', pass: trAligned, value: trAligned ? 'ok' : 'no' });
  // author 0: 변위 0 광자(step-0002 방출만 — rx0==rx)는 트레일 없음(null)
  const emitOnly = ph.find(p => Math.hypot(p.rx - p.rx0, p.ry - p.ry0) <= 1e-9) || { rx: 1, ry: 1, rx0: 1, ry0: 1 };
  const trNone = R3.photonTrail(emitOnly, cam4);
  checks.push({ name: 'L-trail: 무변위 광자 → 트레일 없음(author 0)', pass: trNone === null, value: trNone === null ? 'null' : 'BAD' });

  // ⑧ L-bond(렌즈 assert): 결합 장면(step-0012)은 sim.bonds = [i,j] 원자쌍(연결 성분 간선)을 내보낸다.
  //    렌더는 그 쌍을 *읽어* 두 원자를 잇는 선분으로 번역한다 — 결합 없으면 선 0(author 0).
  const sceneB = SC.SCENES['step-0012'];
  const simB = S.createSim(sceneB.init(K.mulberry32(SEED >>> 0), K));
  S.run(simB, sceneB.ticks);
  const bonds = simB.bonds || [];
  checks.push({ name: 'L-bond: 시뮬이 결합쌍 내보냄(시뮬 선행)', pass: bonds.length > 0, value: `${bonds.length} 결합` });
  // 모든 결합이 유효 원자 인덱스 쌍(읽기 충실 — 없는 원자/자기참조 0)
  const validIdx = bonds.every(([i, j]) => simB.atoms[i] && simB.atoms[j] && i !== j);
  checks.push({ name: 'L-bond: 결합쌍이 유효 원자 인덱스(읽기 충실)', pass: validIdx, value: validIdx ? 'ok' : 'BAD' });
  // 대표 결합 → 화면 선분(두 원자 분리 — 머리≠꼬리)
  const camB = R3.makeCamera(simB.W, simB.H, 0);
  const seg = R3.bondSegment(bonds[0], simB, camB);
  const segPx = seg ? Math.hypot(seg.a.sx - seg.b.sx, seg.a.sy - seg.b.sy) : 0;
  checks.push({ name: 'L-bond: 결합 → 화면 선분(두 원자 잇기)', pass: segPx > 0, value: seg ? `Δpx=${segPx.toFixed(0)}` : 'null' });
  // author 0: 무효 원자 인덱스(빈 원자 배열) → 선분 없음
  const segNone = R3.bondSegment([0, 1], { atoms: [] }, camB);
  checks.push({ name: 'L-bond: 무효 원자 → 선분 없음(author 0)', pass: segNone === null, value: segNone === null ? 'null' : 'BAD' });

  // ⑨ L-glow(렌즈 assert): 원자 들뜸 준위 x(양자수 0..3)를 *광원 밝기*로 *등급* 읽는다(불리언 on/off 아님).
  //    측정 최댓값(maxX)으로 정규화 — 더 들뜬 원자가 더 밝다. x=0(바닥)이면 글로우 0(빛 author 0).
  const maxX = R3.measureMaxExcitation(sim.atoms);
  checks.push({ name: 'L-glow: 원자 들뜸 준위 측정됨(시뮬 선행)', pass: maxX > 0, value: `maxX ${maxX}` });
  checks.push({ name: 'L-glow: 바닥 원자(x=0) → 글로우 0(author 0)', pass: R3.excitationGlow(0, maxX) === 0, value: `${R3.excitationGlow(0, maxX)}` });
  if (maxX >= 2) {
    const graded = R3.excitationGlow(maxX, maxX) > R3.excitationGlow(1, maxX);
    checks.push({ name: 'L-glow: 높은 들뜸 = 더 밝음(등급, 불리언 아님)', pass: graded, value: `g(${maxX})=${R3.excitationGlow(maxX, maxX).toFixed(2)}>g(1)=${R3.excitationGlow(1, maxX).toFixed(2)}` });
  } else {
    checks.push({ name: 'L-glow: 등급(단일 준위 — 생략)', pass: true, value: 'single level' });
  }
  // 단조 증가(읽기 충실 — 준위↑ → 밝기↑) + 정규화 상한 1(클램프)
  const mono = R3.excitationGlow(1, maxX) <= R3.excitationGlow(2, maxX) && R3.excitationGlow(2, maxX) <= R3.excitationGlow(3, maxX);
  checks.push({ name: 'L-glow: 준위↑ → 밝기↑ 단조·상한 1', pass: mono && R3.excitationGlow(99, maxX) === 1, value: mono ? 'ok' : 'BAD' });

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

  // ⑤ L-cam 카메라 조종(렌즈 assert): 궤도(yaw)·줌(distScale)이 화면에 반영되고, 타깃은 늘 중앙.
  const cs = R3.camState, saved = { ...cs };
  const cornerBefore = R3.project({ x: 0, y: 0, z: 0 }, R3.makeCamera(sim.W, sim.H, 0));
  cs.yaw += 0.5;                                   // 회전
  const cam2 = R3.makeCamera(sim.W, sim.H, 0);
  const cornerAfter = R3.project({ x: 0, y: 0, z: 0 }, cam2);
  const center2 = R3.project({ x: sim.W / 2, y: sim.H / 2, z: 0 }, cam2);
  const orbitMoves = Math.hypot(cornerAfter.sx - cornerBefore.sx, cornerAfter.sy - cornerBefore.sy) > 5;
  const stillCentered = Math.abs(center2.sx - cam2.cw / 2) < 1 && Math.abs(center2.sy - cam2.ch / 2) < 1;
  cs.distScale *= 0.5;                             // 줌 인 → 모서리가 화면 중심에서 더 멀어짐(스케일↑)
  const cornerZoom = R3.project({ x: 0, y: 0, z: 0 }, R3.makeCamera(sim.W, sim.H, 0));
  const zoomChanges = Math.abs(cornerZoom.scale - cornerAfter.scale) > 1e-6;
  Object.assign(cs, saved);                        // 상태 복원(다른 검증에 영향 0)
  checks.push({ name: 'L-cam: 궤도 회전이 화면 반영', pass: orbitMoves, value: `Δpx=${Math.hypot(cornerAfter.sx - cornerBefore.sx, cornerAfter.sy - cornerBefore.sy).toFixed(0)}` });
  checks.push({ name: 'L-cam: 회전해도 타깃 중앙 고정', pass: stillCentered, value: `(${center2.sx.toFixed(0)},${center2.sy.toFixed(0)})` });
  checks.push({ name: 'L-cam: 줌이 스케일 변경', pass: zoomChanges, value: zoomChanges ? 'ok' : 'no' });

  return { checks, range, lineCount: lines.size, photonCount: ph.length };
}

const { checks, range, lineCount, photonCount } = run();
console.log(`[render smoke] 장면 ${SCENE} seed ${SEED} — 광자 ${photonCount} · 선 ${lineCount} · λ범위 [${range.lo.toFixed(3)}, ${range.hi.toFixed(3)}]`);
let allPass = true;
for (const c of checks) { const tag = c.pass ? 'PASS' : 'FAIL'; if (!c.pass) allPass = false; console.log(`  [${tag}] ${c.name} = ${c.value}`); }
console.log(allPass ? '\n✅ 렌더 스모크 PASS — 번역 옳게 돈다. 다음은 눈 검증(브라우저).' : '\n❌ 렌더 스모크 FAIL');
process.exit(allPass ? 0 : 1);
