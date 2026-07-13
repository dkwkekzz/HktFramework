// ============================================================================
//  flesh-verify.mjs — 살 시스템 Node 검증 (FLESH-PLAN §10.1)
//
//  샌드박스는 headless Chromium 이 막혀 육안 검증을 Node 로 대체한다. fleshdna·fillField
//  는 순수 함수라 DOM/WebGL 없이 임포트 가능하고, 워프는 실제 FBX 지오메트리(X·Y Bot)를
//  파싱해 makeCh 핵심을 재현한 뒤 검산한다. `npm run verify` 또는 `node tools/flesh-verify.mjs`.
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  defaultDna, presetDna, compileDna, sampleProfileLut, lutAt, LUT_N,
  lerpDna, mutateDna, serializeDna, parseDna,
} from '../src/fleshdna.js';
import { fillField, BLEND, ISO } from '../src/mcflesh.js';
import { FleshWarp } from '../src/fleshwarp.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const simpleName = n => n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();

let pass = 0, fail = 0;
const results = [];
function check(name, cond, detail) {
  (cond ? (pass++) : (fail++));
  results.push(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
}
function section(t) { results.push('\n▶ ' + t); }

// ---------------------------------------------------------------------------
//  합성 필드 그리드 (fillField 단위검증용) — 1m 큐브를 N³ 로. idx=z*zd+y*yd+x.
// ---------------------------------------------------------------------------
const GN = 128, GSCALE = GN / 1.0; // 복셀 ≈ 0.78cm
function makeGrid() { return { field: new Float32Array(GN * GN * GN), dims: { size: GN, yd: GN, zd: GN * GN } }; }
const w2g = (x, y, z) => [(x + 0.5) * GSCALE, (y + 0.5) * GSCALE, (z + 0.5) * GSCALE];

// spec(resolve 결과) + 월드 끝점 → grid 세그먼트
function gridSeg(spec, a, b, frameU = null) {
  const [ax, ay, az] = w2g(...a), [bx, by, bz] = w2g(...b);
  const rScale = BLEND * spec.blend * GSCALE;
  const seg = { ax, ay, az, bx, by, bz, lut: spec.lut, rScale, rMaxGrid: spec.rMax * rScale };
  if (spec.flatten && frameU) { seg.ux = frameU[0]; seg.uy = frameU[1]; seg.uz = frameU[2]; seg.f = spec.flatten.f; }
  return seg;
}
// field 샘플 (선형보간 없이 최근접)
function sampleField(field, x, y, z) {
  const [gx, gy, gz] = w2g(x, y, z);
  const xi = Math.round(gx), yi = Math.round(gy), zi = Math.round(gz);
  if (xi < 0 || xi >= GN || yi < 0 || yi >= GN || zi < 0 || zi >= GN) return 0;
  return field[zi * GN * GN + yi * GN + xi];
}
// 한 축을 따라 iso 교차 폭 측정 (중심에서 양방향)
function isoWidth(field, cx, cy, cz, axis) {
  const step = 1 / GSCALE; // 1 복셀
  let lo = 0, hi = 0;
  for (let d = 0; d < 0.5; d += step) {
    const p = k => axis === 'x' ? [cx + k, cy, cz] : axis === 'y' ? [cx, cy + k, cz] : [cx, cy, cz + k];
    if (sampleField(field, ...p(d)) >= ISO) hi = d; else if (d > 0 && hi > 0 && sampleField(field, ...p(d)) < ISO) break;
  }
  for (let d = 0; d > -0.5; d -= step) {
    const p = k => axis === 'x' ? [cx + k, cy, cz] : axis === 'y' ? [cx, cy + k, cz] : [cx, cy, cz + k];
    if (sampleField(field, ...p(d)) >= ISO) lo = d; else if (d < 0 && lo < 0 && sampleField(field, ...p(d)) < ISO) break;
  }
  return hi - lo;
}

// ---------------------------------------------------------------------------
//  §10.1 #3 — PCHIP 오버슈트 0
// ---------------------------------------------------------------------------
section('DNA / PCHIP');
{
  const profs = [
    [[0, 0.09], [0.5, 0.06], [1, 0.085]],   // 허리 저점
    [[0, 0.048], [0.45, 0.052], [1, 0.04]], // 이두 볼록
    [[0, 0.09], [0.35, 0.078], [1, 0.05]],  // 허벅지
  ];
  let ok = true, worst = 0;
  for (const p of profs) {
    const lut = sampleProfileLut(p);
    const rs = p.map(x => x[1]); const mn = Math.min(...rs), mx = Math.max(...rs);
    for (let i = 0; i < LUT_N; i++) { if (lut[i] < mn - 1e-6 || lut[i] > mx + 1e-6) ok = false; worst = Math.max(worst, Math.max(mn - lut[i], lut[i] - mx)); }
    // 제어점 통과
    for (const [t, r] of p) if (Math.abs(lutAt(lut, t) - r) > 1e-3) ok = false;
  }
  check('#3 PCHIP 제어점 통과 + 오버슈트 0', ok, `최대 이탈 ${(worst * 1000).toFixed(3)}mm`);
}

// ---------------------------------------------------------------------------
//  §10.1 #2 — 그룹 배율
// ---------------------------------------------------------------------------
section('DNA / 그룹 배율');
{
  const dna = defaultDna();
  const c = compileDna(dna);
  const armBase = c.resolve('leftarm', 'leftforearm').lut[0];
  const legBase = c.resolve('leftleg', 'leftfoot').lut[0];
  dna.groups.arm = 1.3; c.invalidate();
  const arm2 = c.resolve('leftarm', 'leftforearm').lut[0];
  const leg2 = c.resolve('leftleg', 'leftfoot').lut[0];
  check('#2 arm ×1.3 정확', Math.abs(arm2 / armBase - 1.3) < 1e-4, `ratio ${(arm2 / armBase).toFixed(4)}`);
  check('#2 leg 그룹 불변', Math.abs(leg2 / legBase - 1) < 1e-4, `ratio ${(leg2 / legBase).toFixed(4)}`);
}

// ---------------------------------------------------------------------------
//  §10.1 #4 — 종아리 프로파일 iso 폭 ≈ 2×r
// ---------------------------------------------------------------------------
section('fillField / 프로파일 폭');
{
  const c = compileDna(defaultDna());
  const spec = c.resolve('leftleg', 'leftfoot'); // 종아리, 세로 0.4m 세그먼트
  const g = makeGrid();
  fillField(g.field, g.dims, [gridSeg(spec, [0, -0.2, 0], [0, 0.2, 0])], []);
  // t=0.35 → y = -0.2 + 0.7×0.4 ... 세그먼트 t=0.35 지점 y = -0.2 + 0.35*0.4 = -0.06
  const tY = -0.2 + 0.35 * 0.4;
  const r = lutAt(spec.lut, 0.35);
  const width = isoWidth(g.field, 0, tY, 0, 'x');
  const expect = 2 * r;
  check('#4 종아리 t=0.35 iso 폭 ≈ 2r', Math.abs(width - expect) < 0.016, `측정 ${(width * 100).toFixed(1)}cm vs 기대 ${(expect * 100).toFixed(1)}cm`);
}

// ---------------------------------------------------------------------------
//  §10.1 #5 — flatten: u 폭 / v 폭 ≈ f
// ---------------------------------------------------------------------------
section('fillField / flatten 타원 단면');
{
  const c = compileDna(defaultDna());
  const spec = c.resolve('spine1', 'spine2'); // 허리 flatten f=0.72, dir +z(→ u=+z)
  const g = makeGrid();
  // 세로 세그먼트, u=+z(전후), v=+x(좌우). flatten 은 u(z) 방향을 f 배 좁힘.
  fillField(g.field, g.dims, [gridSeg(spec, [0, -0.1, 0], [0, 0.1, 0], [0, 0, 1])], []);
  const uW = isoWidth(g.field, 0, 0, 0, 'z'); // 눌린 방향
  const vW = isoWidth(g.field, 0, 0, 0, 'x'); // 안 눌린 방향
  const ratio = uW / vW;
  check('#5 flatten u/v ≈ f', Math.abs(ratio - spec.flatten.f) < 0.1, `측정 ${ratio.toFixed(3)} vs f ${spec.flatten.f}`);
}

// ---------------------------------------------------------------------------
//  §10.1 #6 — bump/cut: 구 중심 증가/감소, 원거리 불변, mirror 대칭
// ---------------------------------------------------------------------------
section('fillField / bump·cut');
{
  const dna = defaultDna();
  dna.bumps = [{ match: 'leg', t: 0.5, offset: [0, 0.08, 0], r: 0.05, strength: 0.9, mirror: true }];
  const c = compileDna(dna);
  const spec = c.resolve('leftleg', 'leftfoot');
  // 세그먼트 축 +y, u = +z 폴백(무 flatten → 월드 +z 투영), v = axis×u = y×z = +x
  // offset=[0(u), 0.08(v=+x), 0] → 중심 x=+0.08, mirror → x=-0.08
  const gA = makeGrid(); fillField(gA.field, gA.dims, [gridSeg(spec, [0, -0.2, 0], [0, 0.2, 0])], []);
  const spGrid = spec.spheres; // compileDna 가 이미 mirror 전개
  const spheresGrid = spGrid.map(sp => {
    // 세그먼트 로컬 프레임 재현: axis=+y, u=+z, v=+x
    const t = sp.t, cxAxis = -0.2 + t * 0.4;
    const [cx, cy, cz] = w2g(sp.offset[1] /*v=x*/, cxAxis + sp.offset[2] /*axis=y*/, sp.offset[0] /*u=z*/);
    return { cx, cy, cz, Rc: BLEND * sp.r * GSCALE, strength: sp.strength };
  });
  const gB = makeGrid(); fillField(gB.field, gB.dims, [gridSeg(spec, [0, -0.2, 0], [0, 0.2, 0])], spheresGrid);
  const at = (f, x, y, z) => sampleField(f, x, y, z);
  const cGain = at(gB.field, 0.08, 0, 0) - at(gA.field, 0.08, 0, 0);
  const cGainMirror = at(gB.field, -0.08, 0, 0) - at(gA.field, -0.08, 0, 0);
  const far = Math.abs(at(gB.field, 0, 0, 0.35) - at(gA.field, 0, 0, 0.35));
  check('#6 bump 중심 증가', cGain > 0.1, `Δ ${cGain.toFixed(3)}`);
  check('#6 mirror 좌우 대칭', Math.abs(cGain - cGainMirror) < 1e-3, `Δ ${cGain.toFixed(3)} vs ${cGainMirror.toFixed(3)}`);
  check('#6 원거리 불변', far < 1e-4, `Δ ${far.toFixed(5)}`);
}

// ---------------------------------------------------------------------------
//  DNA F4 — 직렬화·보간·변이 왕복
// ---------------------------------------------------------------------------
section('DNA / F4 직렬화·보간·변이');
{
  const d = presetDna('stylized-f');
  const round = parseDna(serializeDna(d));
  check('F4 직렬화 왕복 동일', JSON.stringify(round) === JSON.stringify(d));
  const a = defaultDna(), b = presetDna('bulk');
  const mid = lerpDna(a, b, 0.5);
  const c0 = compileDna(a), c1 = compileDna(b), cm = compileDna(mid);
  const arm = k => k.resolve('leftarm', 'leftforearm').lut[0];
  const between = arm(cm) > Math.min(arm(c0), arm(c1)) - 1e-6 && arm(cm) < Math.max(arm(c0), arm(c1)) + 1e-6;
  check('F4 lerp 중간값 사이', between, `${arm(c0).toFixed(3)} < ${arm(cm).toFixed(3)} < ${arm(c1).toFixed(3)}`);
  const mut = mutateDna(a, 42, 0.12);
  const cmu = compileDna(mut);
  // 변이는 r 을 [0.5,1.8]× 클램프 안에서만 흔든다
  let inRange = true;
  for (const key of [['leftarm', 'leftforearm'], ['leftleg', 'leftfoot'], ['leftupleg', 'leftleg']]) {
    const o = arm(c0), r = cmu.resolve(...key).lut[0], base = c0.resolve(...key).lut[0];
    if (r < base * 0.5 - 1e-6 || r > base * 1.8 + 1e-6) inRange = false;
  }
  check('F4 mutate r 클램프 [0.5,1.8]×', inRange);
  // 재현성
  const mut2 = mutateDna(a, 42, 0.12);
  check('F4 mutate 시드 재현', JSON.stringify(mut) === JSON.stringify(mut2));
}

// ---------------------------------------------------------------------------
//  워프 — 실제 FBX 지오메트리로 (§10.1 #9~#13)
// ---------------------------------------------------------------------------
function boneBoxHeight(bones) {
  const box = new THREE.Box3(), p = new THREE.Vector3();
  for (const b of bones) box.expandByPoint(b.getWorldPosition(p));
  const s = new THREE.Vector3(); box.getSize(s); return s.y;
}

// makeCh 핵심 재현 — 구동 뼈(DFS-첫)·boneMap·baseScale(월드=미터)·dna.
function loadCh(file) {
  const buf = readFileSync(join(ROOT, file));
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const obj = new FBXLoader().parse(ab, '');
  const meshes = [], bones = [];
  obj.traverse(o => { if (o.isSkinnedMesh || o.isMesh) meshes.push(o); if (o.isBone) bones.push(o); });
  const boneMap = new Map(); const drivers = []; let dup = 0;
  for (const b of bones) { const sn = simpleName(b.name); if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); } else b.name = `${b.name}__dup${dup++}`; }
  const ch = { root: obj, meshes, bones: drivers, boneMap, allBones: bones, slotX: 0, dna: defaultDna() };
  // baseScale — 월드를 미터로 (bump 미터↔로컬 환산 정합)
  for (const b of bones) b.scale.setScalar(1);
  obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const h = boneBoxHeight(drivers);
  ch.baseScale = 1.7 / Math.max(h, 1e-3);
  obj.scale.setScalar(ch.baseScale);
  obj.updateMatrixWorld(true);
  ch.dnaCompiled = compileDna(ch.dna);
  return ch;
}

for (const [label, file] of [['X Bot', 'public/assets/character/X Bot.fbx'], ['Y Bot', 'public/assets/character/Y Bot.fbx']]) {
  section(`워프 / ${label}`);
  let ch;
  try { ch = loadCh(file); } catch (e) { check(`${label} 로드`, false, e.message); continue; }
  const warp = new FleshWarp(ch, simpleName);
  const entry = warp.meshEntries[0];
  const nV = entry.mesh.geometry.attributes.position.count;
  const uv = entry.mesh.geometry.attributes.uv;
  const uvCopy = uv ? new Float32Array(uv.array) : null;
  const idx = entry.mesh.geometry.index ? new Uint32Array(entry.mesh.geometry.index.array) : null;

  // #9 항등: 기본 DNA·α=1 → 원본 완전 일치
  warp.apply(1);
  let maxDev = 0;
  { const a = entry.mesh.geometry.attributes.position.array, o = entry.orig; for (let i = 0; i < a.length; i++) maxDev = Math.max(maxDev, Math.abs(a[i] - o[i])); }
  check('#9 항등 (기본 DNA·α=1)', maxDev < 1e-6, `최대편차 ${maxDev.toExponential(2)}`);
  // #9b α=0 도 항등 (임의 DNA)
  ch.dna = presetDna('stylized-f'); ch.dnaCompiled = compileDna(ch.dna);
  warp.apply(0);
  { const a = entry.mesh.geometry.attributes.position.array, o = entry.orig; maxDev = 0; for (let i = 0; i < a.length; i++) maxDev = Math.max(maxDev, Math.abs(a[i] - o[i])); }
  check('#9b α=0 항등 (임의 DNA)', maxDev < 1e-6, `최대편차 ${maxDev.toExponential(2)}`);

  // #10 배율: groups.leg=1.3 → 종아리 귀속 정점 반경 중앙값 ×1.3
  ch.dna = defaultDna(); ch.dna.groups.leg = 1.3; ch.dnaCompiled = compileDna(ch.dna);
  // 종아리 세그먼트 인덱스 (leftleg>leftfoot)
  const legSegIdx = entry.segList.findIndex(s => s.key.includes('leftleg>') && s.key.includes('foot'));
  const origR = [], warpR = [];
  const collect = (arr) => {
    const pos = entry.mesh.geometry.attributes.position.array;
    for (let i = 0; i < nV; i++) {
      const infl = entry.influences[i]; if (!infl.length) continue;
      const pr = infl[0]; if (pr.segIdx !== legSegIdx) continue;
      const seg = entry.segList[legSegIdx];
      const rx = pos[i * 3] - seg.A.x, ry = pos[i * 3 + 1] - seg.A.y, rz = pos[i * 3 + 2] - seg.A.z;
      const tp = (rx * seg.dirAxis.x + ry * seg.dirAxis.y + rz * seg.dirAxis.z);
      const qx = rx - seg.dirAxis.x * tp, qy = ry - seg.dirAxis.y * tp, qz = rz - seg.dirAxis.z * tp;
      arr.push(Math.hypot(qx, qy, qz));
    }
  };
  warp.apply(0); collect(origR);   // α=0 = 원본
  warp.apply(1); collect(warpR);
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s[s.length >> 1] || 0; };
  const ratio = median(warpR) / (median(origR) || 1);
  check('#10 groups.leg=1.3 → 종아리 반경 ×1.3', legSegIdx >= 0 && Math.abs(ratio - 1.3) < 0.06, `중앙값 비 ${ratio.toFixed(3)} (표본 ${warpR.length})`);

  // #13 UV·index·정점수 불변
  const uvSame = uvCopy ? uvCopy.every((v, i) => v === uv.array[i]) : true;
  const idxSame = idx ? idx.every((v, i) => v === entry.mesh.geometry.index.array[i]) : true;
  const countSame = entry.mesh.geometry.attributes.position.count === nV;
  check('#13 UV·index·정점수 불변', uvSame && idxSame && countSame, `uv ${uvSame} idx ${idxSame} count ${countSame}`);

  // #12 bump: stylized-f 가슴 bump → 세그먼트 근방 정점 이동, 대다수 유한 (월드 미터)
  const S = ch.baseScale; // 로컬(네이티브) → 월드 미터 (균등 스케일)
  ch.dna = presetDna('stylized-f'); ch.dnaCompiled = compileDna(ch.dna);
  warp.apply(0); const base0 = new Float32Array(entry.mesh.geometry.attributes.position.array);
  warp.apply(1); const posSF = entry.mesh.geometry.attributes.position.array;
  let moved = 0, maxMove = 0;
  for (let i = 0; i < nV; i++) {
    const dx = posSF[i * 3] - base0[i * 3], dy = posSF[i * 3 + 1] - base0[i * 3 + 1], dz = posSF[i * 3 + 2] - base0[i * 3 + 2];
    const d = Math.hypot(dx, dy, dz) * S; if (d > 1e-5) moved++; maxMove = Math.max(maxMove, d);
  }
  check('#12 stylized-f 정점 변형 발생·유한', moved > nV * 0.2 && maxMove < 0.15, `이동 정점 ${(100 * moved / nV).toFixed(0)}% 최대 ${(maxMove * 100).toFixed(1)}cm`);

  // #11 연속성: 무릎 경계(upleg↔leg) t-빈 평균 변위 불연속 없음
  ch.dna = defaultDna(); ch.dna.groups.leg = 1.4; ch.dnaCompiled = compileDna(ch.dna);
  warp.apply(0); const b0 = new Float32Array(entry.mesh.geometry.attributes.position.array);
  warp.apply(1); const p1 = entry.mesh.geometry.attributes.position.array;
  // upleg 끝(t≈1) 과 leg 시작(t≈0) 정점의 평균 변위 차 — 큰 점프면 불연속
  const uplegIdx = entry.segList.findIndex(s => s.key.includes('leftupleg>'));
  const legIdx = legSegIdx;
  const binDisp = (segIdx, tlo, thi) => {
    let sum = 0, n = 0;
    for (let i = 0; i < nV; i++) { const pr = entry.influences[i][0]; if (!pr || pr.segIdx !== segIdx) continue; if (pr.t < tlo || pr.t > thi) continue; sum += Math.hypot(p1[i * 3] - b0[i * 3], p1[i * 3 + 1] - b0[i * 3 + 1], p1[i * 3 + 2] - b0[i * 3 + 2]); n++; }
    return n ? sum / n : 0;
  };
  const uplegEnd = binDisp(uplegIdx, 0.85, 1) * S;   // 무릎 위 (월드 미터)
  const legStart = binDisp(legIdx, 0, 0.15) * S;     // 무릎 아래
  const jump = Math.abs(uplegEnd - legStart);
  check('#11 무릎 경계 변위 연속 (점프 작음)', jump < 0.01, `위 ${(uplegEnd * 100).toFixed(2)}cm 아래 ${(legStart * 100).toFixed(2)}cm 차 ${(jump * 100).toFixed(2)}cm`);

  warp.restore();
}

// ---------------------------------------------------------------------------
console.log(results.join('\n'));
console.log(`\n${'='.repeat(60)}\n  ${pass} PASS / ${fail} FAIL\n${'='.repeat(60)}`);
process.exit(fail ? 1 : 0);
