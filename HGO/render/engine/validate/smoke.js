// render/engine/validate/smoke.js — 렌더 트랙 헤드리스 스모크.
//   화면(눈 검증)이 권위지만, 그 전에 *번역이 옳게 도는지*를 수치로 확인한다:
//     ① atom 엔진을 읽기 전용으로 로드해 장면(빛 있는 step)을 돌리면 광자가 나온다.
//     ② 각 광자 λ 가 유효한 RGB 로 번역된다(0..255, 검정 아님).
//     ③ 물리 순서 보존 — 짧은 λ(고에너지)는 더 파랗고, 긴 λ(저에너지)는 더 빨갛다.
//   알리바이(atom/ 진짜 diff 0 — viewer 는 트랙 밖 HGO/ 루트 공유 셸)는
//   커밋 전 `git status` 로 확인(RENDER.md §5).
//
// 사용: node render/engine/validate/smoke.js
'use strict';
const path = require('path');
const ATOM = path.join(__dirname, '..', '..', '..', 'atom', 'engine');
const K = require(path.join(ATOM, 'hgo-kernel.js'));
const S = require(path.join(ATOM, 'hgo-sim.js'));
const SC = require(path.join(ATOM, 'scenes.js'));
const SP = require(path.join(__dirname, '..', 'spectral.js'));
const R3 = require(path.join(__dirname, '..', 'render.js'));

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

  // ⑩ L-order(렌즈 assert): bondOrder 장면(step-0018)은 sim.bonds 에 결합 차수(bond[3] = 공유 전자쌍 수,
  //    단일1·이중2·삼중3)를 실어 보낸다. 렌더는 그 차수를 *읽어* 결합선을 차수만큼 평행 복제한다(O=O 두 줄·N≡N 세 줄).
  //    차수 없는 결합(step-0010~12, bond[3]===undefined)은 단일선(order 1, author 0).
  const sceneO = SC.SCENES['step-0018'];
  const simO = S.createSim(sceneO.init(K.mulberry32(SEED >>> 0), K));
  S.run(simO, sceneO.ticks);
  const bondsO = simO.bonds || [];
  const maxOrder = bondsO.reduce((m, b) => Math.max(m, R3.bondOrder(b)), 0);
  checks.push({ name: 'L-order: 시뮬이 결합 차수 내보냄(시뮬 선행)', pass: maxOrder >= 2, value: `maxOrder ${maxOrder}` });
  // 차수 분포 읽기 충실 — 합 = 결합 수(누락·중복 0)
  const odist = {};
  for (const b of bondsO) { const o = R3.bondOrder(b); odist[o] = (odist[o] || 0) + 1; }
  const osum = Object.values(odist).reduce((s, v) => s + v, 0);
  checks.push({ name: 'L-order: 차수 분포 합 = 결합 수(읽기 충실)', pass: osum === bondsO.length, value: JSON.stringify(odist) });
  // 차수 k → 평행선 k 줄
  const camO = R3.makeCamera(simO.W, simO.H, 0);
  const bondMax = bondsO.find(b => R3.bondOrder(b) === maxOrder);
  const segO = R3.bondSegment(bondMax, simO, camO);
  const mlines = R3.bondMultiline(segO, maxOrder, 6);
  checks.push({ name: 'L-order: 차수 k → 평행선 k 줄', pass: mlines.length === maxOrder, value: `${mlines.length} 줄(order ${maxOrder})` });
  // 평행선은 *평행*(각 줄 축 방향 동일, 외적 0) + *분리*(첫↔끝 줄 겹치지 않음)
  let parallelSep = mlines.length >= 2;
  if (parallelSep) {
    const d0 = { x: mlines[0].b.sx - mlines[0].a.sx, y: mlines[0].b.sy - mlines[0].a.sy };
    for (const ln of mlines) {
      const d = { x: ln.b.sx - ln.a.sx, y: ln.b.sy - ln.a.sy };
      if (Math.abs(d0.x * d.y - d0.y * d.x) > 1e-6) parallelSep = false;   // 외적≠0 → 안 평행
    }
    const last = mlines[mlines.length - 1];
    const sep = Math.hypot(mlines[0].a.sx - last.a.sx, mlines[0].a.sy - last.a.sy);
    if (!(sep > 1)) parallelSep = false;
  }
  checks.push({ name: 'L-order: 평행선 평행·분리(겹침 0)', pass: parallelSep, value: parallelSep ? 'ok' : 'no' });
  // author 0: 차수 없는 결합(step-0012, bond[3]===undefined) → 단일선(order 1)
  const order12 = R3.bondOrder(bonds[0]);
  checks.push({ name: 'L-order: 차수 없는 결합 → 단일(author 0)', pass: order12 === 1, value: `order ${order12}` });

  // ⑪ L-Ebond(렌즈 assert): bondLocalE 장면(step-0015)은 sim.bonds 에 결합 E(bond[2]=Eabs)를 실어 보낸다.
  //    렌더는 그 E 를 *읽어* 결합선 밝기로 등급화(maxE 정규화) — 강한 결합=밝게. E 없으면 밝기 0(author 0).
  const sceneE = SC.SCENES['step-0015'];
  const simE = S.createSim(sceneE.init(K.mulberry32(SEED >>> 0), K));
  S.run(simE, sceneE.ticks);
  const bondsE = simE.bonds || [];
  const maxE = R3.measureMaxBondEnergy(bondsE);
  checks.push({ name: 'L-Ebond: 시뮬이 결합 E 내보냄(시뮬 선행)', pass: maxE > 0, value: `maxE ${maxE.toFixed(3)}` });
  // 강한 결합 → 약한 결합보다 밝다(등급, 읽기 충실)
  const es = bondsE.map(b => R3.bondEnergy(b)).filter(e => e > 0).sort((p, q) => p - q);
  const graded = es.length >= 2 && R3.bondGlow(es[es.length - 1], maxE) > R3.bondGlow(es[0], maxE);
  checks.push({ name: 'L-Ebond: 강한 결합 = 더 밝음(등급)', pass: graded, value: es.length >= 2 ? `g(${es[es.length-1].toFixed(2)})=${R3.bondGlow(es[es.length-1],maxE).toFixed(2)}>g(${es[0].toFixed(2)})=${R3.bondGlow(es[0],maxE).toFixed(2)}` : 'single' });
  // 단조·정규화 상한 1(클램프)
  const monoE = R3.bondGlow(0.1, maxE) <= R3.bondGlow(0.5, maxE) && R3.bondGlow(0.5, maxE) <= R3.bondGlow(maxE, maxE);
  checks.push({ name: 'L-Ebond: E↑ → 밝기↑ 단조·상한 1', pass: monoE && R3.bondGlow(maxE * 9, maxE) === 1, value: monoE ? 'ok' : 'BAD' });
  // author 0: E 없는 결합(step-0012, bond[2]===undefined) → 밝기 0
  checks.push({ name: 'L-Ebond: E 없는 결합 → 밝기 0(author 0)', pass: R3.bondEnergy(bonds[0]) === 0 && R3.bondGlow(R3.bondEnergy(bonds[0]), maxE) === 0, value: `${R3.bondEnergy(bonds[0])}` });

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

  // ⑫ L-element(렌즈 assert): 핵 변환 장면(step-0035, ²²C→C/N/O/F 다단 사슬)은 원자들의 *양성자 수* Z(원소)를
  //    바꾼다 — 종단엔 Z∈{6,7,8,9} 가 공존한다. 렌더는 그 Z 를 *읽어* 색조로 번역(측정 Z 범위 정규화) →
  //    원소가 바뀌면 색이 바뀐다. 종류별 색 박기 0(연속 사상). 변이 없는 장면(단일 원소)은 무채색(가짜 색 author 0).
  const sceneZ = SC.SCENES['step-0035'];
  const simZ = S.createSim(sceneZ.init(K.mulberry32(SEED >>> 0), K));
  S.run(simZ, sceneZ.ticks);
  const zr = R3.measureZRange(simZ.atoms);
  const zset = [...new Set(simZ.atoms.map(a => a.Z | 0))].sort((p, q) => p - q);
  checks.push({ name: 'L-element: 시뮬이 원소(Z) 변이 내보냄(시뮬 선행)', pass: zr.hi > zr.lo, value: `Z[${zr.lo},${zr.hi}]·${zset.length}종` });
  // 서로 다른 원소 → 서로 다른 색조(읽기 충실 — 원소가 구분된다)
  const hueLo = R3.elementHue(zr.lo, zr.lo, zr.hi), hueHi = R3.elementHue(zr.hi, zr.lo, zr.hi);
  checks.push({ name: 'L-element: 다른 원소 → 다른 색조(원소 구분)', pass: Math.abs(hueLo - hueHi) > 1e-6, value: `hue ${hueLo.toFixed(2)}→${hueHi.toFixed(2)}` });
  // 색조가 Z 에 단조(연속 사상 — 저 Z→파랑(큰 hue)·고 Z→빨강(작은 hue))
  const monoZ = zset.every((z, i) => i === 0 || R3.elementHue(zset[i - 1], zr.lo, zr.hi) >= R3.elementHue(z, zr.lo, zr.hi));
  checks.push({ name: 'L-element: 색조 Z 단조(연속 사상·종류별 색 박기 0)', pass: monoZ, value: monoZ ? 'ok' : 'BAD' });
  // 모든 Z → 유효 RGB(HSV 변환·0..255·검정 아님)
  let zRgbOk = true;
  for (const z of zset) { const c = R3.hsvToRgb(R3.elementHue(z, zr.lo, zr.hi), 0.55, 0.5); if (!(c.length === 3 && c.every(v => v >= 0 && v <= 255)) || c[0] + c[1] + c[2] === 0) zRgbOk = false; }
  checks.push({ name: 'L-element: 모든 원소 → 유효 RGB(0..255·비검정)', pass: zRgbOk, value: zRgbOk ? 'ok' : 'BAD' });
  // author 0: 변이 없는 장면(단일 원소 lo==hi)은 Z 무관 중립 색조(가짜 색 author 0)
  const flat = R3.elementHue(6, 8, 8) === R3.elementHue(9, 8, 8);
  checks.push({ name: 'L-element: 단일 원소(범위 0) → 중립 색조(author 0)', pass: flat, value: flat ? 'neutral' : 'BAD' });

  // ⑬ L-ion(렌즈 assert): 이온결합 장면(step-0010)은 원자 전하 Q=Z−e 를 양이온(+1)·음이온(−1) 둘 다 실어 보낸다.
  //    렌더는 그 전하를 *읽어* 테두리 고리로 번역(부호 발산 — 양이온 따뜻·음이온 차가움·세기=|Q|/maxQ 측정).
  //    중성(Q=0)은 고리 0(author 0). e·Z 는 atoms 채널에 늘 실림(계약 감사서 드러난 미독 채널).
  const sceneI = SC.SCENES['step-0010'];
  const simI = S.createSim(sceneI.init(K.mulberry32(SEED >>> 0), K));
  S.run(simI, sceneI.ticks);
  const maxQ = R3.measureMaxAbsCharge(simI.atoms);
  const qset = [...new Set(simI.atoms.map(a => R3.ionCharge(a)))].sort((p, q) => p - q);
  checks.push({ name: 'L-ion: 시뮬이 전하(Z−e) 실음(시뮬 선행)', pass: maxQ > 0, value: `Q${JSON.stringify(qset)}·maxQ ${maxQ}` });
  // 부호 구분: 양이온·음이온 둘 다 고리 세기 >0(읽기 충실), 중성은 0(author 0)
  const cation = qset.find(q => q > 0), anion = qset.find(q => q < 0);
  const signOk = cation !== undefined && anion !== undefined && R3.ionRing(cation, maxQ) > 0 && R3.ionRing(anion, maxQ) > 0 && R3.ionRing(0, maxQ) === 0;
  checks.push({ name: 'L-ion: 양·음이온 고리>0·중성 고리=0(부호 발산·author 0)', pass: signOk, value: `+${cation}/${anion}·중성0` });
  // 세기 단조(|Q|↑ → 고리↑) + 정규화 상한 1(클램프)
  const monoQ = R3.ionRing(0, maxQ) <= R3.ionRing(maxQ, maxQ) && R3.ionRing(maxQ * 9, maxQ) === 1;
  checks.push({ name: 'L-ion: |Q|↑ → 고리↑ 단조·상한 1', pass: monoQ, value: monoQ ? 'ok' : 'BAD' });

  // ⑭ L-isotope(렌즈 assert): 다단 사슬 장면(step-0035)은 같은 A=22 에서 N(중성자·동위원소)을 13~16 으로 바꾼다.
  //    렌더는 그 N 을 *읽어* 안쪽 코어 밝기로 번역(측정 N 범위 정규화 — 중성자↑ 밝은 코어). 단일 동위원소는 코어 0(author 0).
  const sceneN = SC.SCENES['step-0035'];
  const simN = S.createSim(sceneN.init(K.mulberry32(SEED >>> 0), K));
  S.run(simN, sceneN.ticks);
  const nr = R3.measureNRange(simN.atoms);
  const nset = [...new Set(simN.atoms.map(a => a.N | 0))].sort((p, q) => p - q);
  checks.push({ name: 'L-isotope: 시뮬이 중성자 수(N) 변이 실음(시뮬 선행)', pass: nr.hi > nr.lo, value: `N[${nr.lo},${nr.hi}]·${nset.length}종` });
  // 중성자 많은 동위원소 = 더 밝은 코어(등급, 읽기 충실) · 최소 N = 코어 0(정규화 바닥)
  const gradedN = R3.isotopeShade(nr.hi, nr.lo, nr.hi) > R3.isotopeShade(nr.lo, nr.lo, nr.hi) && R3.isotopeShade(nr.lo, nr.lo, nr.hi) === 0;
  checks.push({ name: 'L-isotope: 중성자↑ → 밝은 코어(등급)', pass: gradedN, value: `c(${nr.hi})=${R3.isotopeShade(nr.hi, nr.lo, nr.hi).toFixed(2)}>c(${nr.lo})=0` });
  // 단조 + 정규화 상한 1(클램프)
  const monoN = R3.isotopeShade(nr.lo + 1, nr.lo, nr.hi) <= R3.isotopeShade(nr.hi, nr.lo, nr.hi) && R3.isotopeShade(nr.hi + 99, nr.lo, nr.hi) === 1;
  checks.push({ name: 'L-isotope: N↑ → 코어↑ 단조·상한 1', pass: monoN, value: monoN ? 'ok' : 'BAD' });
  // author 0: 단일 동위원소(범위 0) → 코어 0(가짜 구분 없음)
  const flatN = R3.isotopeShade(10, 10, 10) === 0 && R3.isotopeShade(13, 10, 10) === 0;
  checks.push({ name: 'L-isotope: 단일 동위원소(범위 0) → 코어 0(author 0)', pass: flatN, value: flatN ? 'none' : 'BAD' });

  // ⑮ L-molecule(렌즈 assert): 결합 그래프의 *연결 성분* = 분자(같은 분자 한 덩이). 결합 간선(sim.bonds=[i,j])을
  //    *읽어* union-find 로 측정한다 — 분포 author 0. 합성 그래프로 측정 정확성 + 실제 장면(step-0012)서 분자 수.
  const cgTwo = R3.connectedComponents([[0, 1], [2, 3]], 4);   // 두 분자(0-1·2-3)
  const twoOk = cgTwo.count === 2 && cgTwo.comp[0] === cgTwo.comp[1] && cgTwo.comp[2] === cgTwo.comp[3] && cgTwo.comp[0] !== cgTwo.comp[2];
  checks.push({ name: 'L-molecule: 연결 성분 측정(0-1·2-3 → 2 분자)', pass: twoOk, value: `count ${cgTwo.count}·comp[${cgTwo.comp.join(',')}]` });
  // 이행적 연결(사슬 0-1-2)은 한 분자로 합쳐진다(읽기 충실 — union-find)
  const cgChain = R3.connectedComponents([[0, 1], [1, 2]], 3);
  checks.push({ name: 'L-molecule: 사슬(0-1-2) → 한 분자(이행 연결)', pass: cgChain.count === 1 && cgChain.comp[0] === cgChain.comp[2], value: `count ${cgChain.count}` });
  // 같은 분자=같은 색·다른 분자=다른 색(그룹 구분 채널) · 단일 분자/미결합 = 중립(author 0)
  const hA = R3.moleculeHue(0, 2), hB = R3.moleculeHue(1, 2);
  checks.push({ name: 'L-molecule: 다른 분자 → 다른 색(같은 분자 동색)', pass: Math.abs(hA - hB) > 1e-6, value: `hue ${hA.toFixed(2)}≠${hB.toFixed(2)}` });
  const molNeutral = R3.moleculeHue(0, 1) === R3.moleculeHue(5, 1) && R3.moleculeHue(-1, 3) === R3.moleculeHue(0, 1);
  checks.push({ name: 'L-molecule: 단일 분자/미결합 → 중립(author 0)', pass: molNeutral, value: molNeutral ? 'neutral' : 'BAD' });
  // 실제 장면(step-0012) — 시뮬 결합서 분자 수 측정(읽기), 결합 원자는 같은 분자·미결합 원자는 −1
  const ccB = R3.connectedComponents(simB.bonds || [], simB.atoms.length);
  const bondedSameMol = (simB.bonds || []).every(([i, j]) => ccB.comp[i] >= 0 && ccB.comp[i] === ccB.comp[j]);
  checks.push({ name: 'L-molecule: 결합 원자 같은 분자(연결 읽기 충실)', pass: ccB.count >= 1 && bondedSameMol, value: `${ccB.count} 분자` });

  // ⑯ L-source(렌즈 assert): 광자 색(L-λ)은 *전이*(from→to 준위차)로 정해져 원소 무관 — 같은 전이를 탄소·산소·헬륨이
  //    방출해도 *같은 lambda(같은 색)*. 그래서 *방출 원소* srcZ(광자에 늘 실림)는 색으로 안 보였다(계약 감사 미독 채널).
  //    렌더는 srcZ 를 *읽어* 출처 고리 색조로(측정 srcZ 범위 정규화·L-element 와 동일 사상). 단일 원소면 고리 0(author 0).
  const szr = R3.measureSrcZRange(ph);
  const szset = [...new Set(ph.map(p => p.srcZ).filter(z => z !== undefined))].sort((a, b) => a - b);
  checks.push({ name: 'L-source: 광자에 방출 원소 srcZ 실림(시뮬 선행)', pass: szr.hi > szr.lo, value: `srcZ[${szr.lo},${szr.hi}]·${szset.length}종` });
  // 부채 입증: 같은 전이(from→to)를 다른 원소가 내면 lambda(색) 동일인데 srcZ 는 다르다(색이 출처를 못 가린다)
  const byT = {};
  for (const p of ph) { const k = p.from + '>' + p.to; (byT[k] = byT[k] || []).push(p); }
  let sameColorDiffSrc = false;
  for (const k in byT) {
    const g = byT[k];
    const lset = new Set(g.map(p => +p.lambda.toFixed(6))), zs = new Set(g.map(p => p.srcZ));
    if (lset.size === 1 && zs.size > 1) sameColorDiffSrc = true;   // 같은 색·다른 출처 = 미독 부채 실재
  }
  checks.push({ name: 'L-source: 같은 전이·다른 원소 = 같은 색(부채 실재)', pass: sameColorDiffSrc, value: sameColorDiffSrc ? '색이 출처 못 가림' : 'n/a' });
  // 다른 출처 원소 → 다른 고리 색조(읽기 충실 — 출처가 구분된다)
  const hSrcLo = R3.elementHue(szr.lo, szr.lo, szr.hi), hSrcHi = R3.elementHue(szr.hi, szr.lo, szr.hi);
  checks.push({ name: 'L-source: 다른 출처 → 다른 고리 색(출처 구분)', pass: Math.abs(hSrcLo - hSrcHi) > 1e-6, value: `hue ${hSrcLo.toFixed(2)}→${hSrcHi.toFixed(2)}` });
  // 색조가 srcZ 에 단조(L-element 와 동일 사상 — 저 Z 파랑(큰 hue)·고 Z 빨강(작은 hue))
  const monoSrc = szset.every((z, i) => i === 0 || R3.elementHue(szset[i - 1], szr.lo, szr.hi) >= R3.elementHue(z, szr.lo, szr.hi));
  checks.push({ name: 'L-source: 고리 색조 srcZ 단조(L-element 동일 사상)', pass: monoSrc, value: monoSrc ? 'ok' : 'BAD' });
  // author 0: 단일 출처 원소(범위 0)면 중립(고리 author 0 — drawPhoton 이 szRange.hi>lo 일 때만 고리)
  const srcFlat = R3.measureSrcZRange([{ srcZ: 6 }, { srcZ: 6 }]);
  checks.push({ name: 'L-source: 단일 출처(범위 0) → 고리 0(author 0)', pass: !(srcFlat.hi > srcFlat.lo), value: `[${srcFlat.lo},${srcFlat.hi}]` });

  // ⑰ L-scatter(렌즈 assert): 산란 장면(step-0005)은 광자에 *산란 횟수* nscatter 를 싣는다(몇 번 튕겼나).
  //    광자 색(L-λ)은 *현재* 에너지만 보여 11번 산란한 광자와 갓 방출된 같은 색 광자가 똑같았다(산란 이력 미독).
  //    렌더는 nscatter 를 *읽어* 산란 헤일로로 등급화(maxScatter 정규화 — 많이 튕길수록 넓고 짙게). 직진(0)이면 0(author 0).
  const sceneSc = SC.SCENES['step-0005'];
  const simSc = S.createSim(sceneSc.init(K.mulberry32(SEED >>> 0), K));
  S.run(simSc, sceneSc.ticks);
  const maxSc = R3.measureMaxScatter(simSc.photons);
  const scattered = simSc.photons.filter(p => (p.nscatter | 0) > 0).length;
  checks.push({ name: 'L-scatter: 광자에 산란 횟수 nscatter 실림(시뮬 선행)', pass: maxSc > 0 && scattered > 0, value: `maxScatter ${maxSc}·산란광자 ${scattered}/${simSc.photons.length}` });
  // 부채 입증: 색(L-λ)은 *현재 에너지*만 보인다 — 산란할수록 λ 가 변해도, 같은 색 구간(λ 0.1폭)에
  //   산란 횟수가 *여럿* 공존한다(색=에너지 연속·nscatter=사건 수 이산 — 색이 산란 *횟수*를 못 가린다).
  const byLam = {};
  for (const p of simSc.photons) { const k = (+p.lambda).toFixed(1); (byLam[k] = byLam[k] || new Set()).add(p.nscatter | 0); }
  const bandsMultiScatter = Object.values(byLam).filter(s => s.size > 1).length;
  checks.push({ name: 'L-scatter: 같은 색 구간에 산란 횟수 복수(부채 실재)', pass: bandsMultiScatter > 0, value: `${bandsMultiScatter} 구간 — 색이 횟수 못 가림` });
  // 많이 산란한 광자 = 더 짙은 헤일로(등급, 읽기 충실) · 직진(0)이면 0(author 0)
  const gradedSc = R3.scatterGlow(maxSc, maxSc) > R3.scatterGlow(1, maxSc) && R3.scatterGlow(0, maxSc) === 0;
  checks.push({ name: 'L-scatter: 많이 산란 = 더 짙은 헤일로(등급)·직진 0', pass: gradedSc, value: `g(${maxSc})=${R3.scatterGlow(maxSc, maxSc).toFixed(2)}>g(1)=${R3.scatterGlow(1, maxSc).toFixed(2)}·g(0)=0` });
  // 단조 + 정규화 상한 1(클램프) + maxScatter=0(산란 장면 아님)이면 전부 0(author 0)
  const monoSc = R3.scatterGlow(1, maxSc) <= R3.scatterGlow(2, maxSc) && R3.scatterGlow(2, maxSc) <= R3.scatterGlow(maxSc, maxSc) && R3.scatterGlow(maxSc * 9, maxSc) === 1 && R3.scatterGlow(5, 0) === 0;
  checks.push({ name: 'L-scatter: n↑ → 헤일로↑ 단조·상한 1·무산란 0', pass: monoSc, value: monoSc ? 'ok' : 'BAD' });

  // ⑱ L-velocity(렌즈 assert): 원자는 거의 모든 장면서 vx,vy 로 움직이나(step-0009 maxV~2.4) 정지 프레임엔 정적 구로만
  //    보였다(운동 방향 미독). 렌더는 속도 벡터를 *읽어* 운동 자취로 번역(머리=현 위치·꼬리=−속도, 길이 ∝ |v|/maxV).
  //    ⛔blocked 인 *온도색(L-T)* 과 다르다 — 열 의미화 아닌 순수 운동 방향(광자 L-recoil 의 원자판). 정지(|v|=0)면 자취 0(author 0).
  const sceneV = SC.SCENES['step-0009'];
  const simV = S.createSim(sceneV.init(K.mulberry32(SEED >>> 0), K));
  S.run(simV, sceneV.ticks);
  const maxV = R3.measureMaxSpeed(simV.atoms);
  const movingAtoms = simV.atoms.filter(a => Math.hypot(a.vx || 0, a.vy || 0) > 1e-9).length;
  checks.push({ name: 'L-velocity: 원자 속도 벡터 실림(시뮬 선행)', pass: maxV > 0 && movingAtoms > 0, value: `maxV ${maxV.toFixed(3)}·운동 ${movingAtoms}/${simV.atoms.length}` });
  const camV = R3.makeCamera(simV.W, simV.H, 0);
  const velWorld = 0.08 * Math.max(simV.W, simV.H);
  const av = simV.atoms.find(a => Math.hypot(a.vx || 0, a.vy || 0) > 1e-9);
  const vstk = R3.atomVelocityStreak(av, camV, maxV, velWorld);
  const velPx = vstk ? Math.hypot(vstk.head.sx - vstk.tail.sx, vstk.head.sy - vstk.tail.sy) : 0;
  checks.push({ name: 'L-velocity: 운동 원자 → 화면 자취(머리≠꼬리)', pass: velPx > 1, value: vstk ? `Δpx=${velPx.toFixed(0)}` : 'null' });
  // 자취 축이 *투영된 속도 방향*과 정렬(읽기 충실 — 머리−꼬리 = +속도 투영, 꼬리=−v 라 head−tail=+v)
  let vAligned = false;
  if (vstk) {
    const a0 = R3.project({ x: av.rx, y: av.ry, z: 0 }, camV);
    const b0 = R3.project({ x: av.rx + av.vx, y: av.ry + av.vy, z: 0 }, camV);
    const sdx = vstk.head.sx - vstk.tail.sx, sdy = vstk.head.sy - vstk.tail.sy;
    const mdx = b0.sx - a0.sx, mdy = b0.sy - a0.sy;
    vAligned = (sdx * mdx + sdy * mdy) > 0;
  }
  checks.push({ name: 'L-velocity: 자취 축 = 투영 속도 방향', pass: vAligned, value: vAligned ? 'ok' : 'no' });
  // author 0: 정지 원자(v=0)는 자취 없음(null)
  const vNone = R3.atomVelocityStreak({ rx: 1, ry: 1, vx: 0, vy: 0 }, camV, maxV, velWorld);
  checks.push({ name: 'L-velocity: 정지 원자 → 자취 없음(author 0)', pass: vNone === null, value: vNone === null ? 'null' : 'BAD' });

  // ⑲ L-escape(렌즈 assert): 핵 장면(붕괴·융합 step-0032~)은 입자/에너지가 경계를 넘어 *세계를 떠난다* —
  //    sim.escaped({E,px,py,count})가 그 총합을 누적한다. 떠난 입자는 장면에 없어 화면에 완전히 안 보였다(미독 부채).
  //    렌더는 escaped 를 *읽어* HUD 게이지로(방향=net 운동량·개수·E). count=0 이면 게이지 0(author 0).
  //    운동 탈출(|p|>0, E≈0=질량 입자 방향성)과 복사 탈출(E>0, |p|≈0=등방)을 구분 — 둘 다 실측 읽기.
  const sceneEk = SC.SCENES['step-0034'];   // 운동 탈출(방향성 — |p|>0)
  const simEk = S.createSim(sceneEk.init(K.mulberry32(SEED >>> 0), K));
  S.run(simEk, sceneEk.ticks);
  const rEk = R3.escapeReadout(simEk.escaped);
  checks.push({ name: 'L-escape: 시뮬이 탈출 입자 누적 실음(시뮬 선행)', pass: !!rEk && rEk.count > 0, value: rEk ? `count ${rEk.count}` : 'null' });
  checks.push({ name: 'L-escape: 운동 탈출 → 방향 읽힘(|p|>0·atan2 유한)', pass: !!rEk && rEk.hasDir && Number.isFinite(rEk.angle), value: rEk && rEk.hasDir ? `θ=${rEk.angle.toFixed(2)}·|p|=${rEk.mag.toFixed(1)}` : 'no dir' });
  const sceneEr = SC.SCENES['step-0033'];   // 복사 탈출(등방 — E>0·|p|≈0)
  const simEr = S.createSim(sceneEr.init(K.mulberry32(SEED >>> 0), K));
  S.run(simEr, sceneEr.ticks);
  const rEr = R3.escapeReadout(simEr.escaped);
  checks.push({ name: 'L-escape: 복사 탈출 → E>0·방향 없음(등방, author 0)', pass: !!rEr && rEr.E > 0 && !rEr.hasDir, value: rEr ? `E ${rEr.E.toFixed(1)}·dir ${rEr.hasDir}` : 'null' });
  // author 0: 탈출 없는 장면(escaped 없음·count=0) → 게이지 0(null)
  const eNone = R3.escapeReadout(undefined), eZero = R3.escapeReadout({ E: 0, px: 0, py: 0, count: 0 });
  checks.push({ name: 'L-escape: 탈출 없음/count=0 → 게이지 0(author 0)', pass: eNone === null && eZero === null, value: eNone === null && eZero === null ? 'null' : 'BAD' });

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
