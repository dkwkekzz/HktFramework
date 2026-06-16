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
