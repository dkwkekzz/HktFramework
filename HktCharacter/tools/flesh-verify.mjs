// ============================================================================
//  flesh-verify.mjs — 살 시스템 Node 검증 (headless Chromium 불가 대체)
//
//  fillField·fleshdna 가 순수 함수라 DOM/WebGL 없이 임포트 가능(three 는 수학용만).
//  각 검사는 수치 판정 + 필요 시 ASCII 단면 캡처(한눈에 판정)를 남긴다.
//  실행:  node tools/flesh-verify.mjs   (실패 시 exit 1)
//  docs/FLESH-PLAN.md §10.1 표의 검사 번호와 대응한다.
// ============================================================================
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { readFileSync } from 'fs';
import { fillField, BLEND, HALF, RES, ISO } from '../src/mcflesh.js';
import { compileDna, defaultDna, bakeLut, LUT_N } from '../src/fleshdna.js';
import { bakeFleshMesh } from '../src/fleshbake.js';

// 실물 FBX 골격을 로드해 최소 ch 를 구성(makeCh 핵심만 재현) — #7·#8 은 실제
// 골격 치수로 판정(§1.1: 임의 치수 발명 금지, X Bot·Y Bot 양쪽 회귀쌍).
const simpleName = n => n.split(':').pop().replace(/^mixamorig\d*/i, '').toLowerCase();
function loadCh(file) {
  const buf = readFileSync(file);
  const obj = new FBXLoader().parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const bones = []; obj.traverse(o => { if (o.isBone) bones.push(o); });
  const boneMap = new Map(); const drivers = []; let dup = 0;
  for (const b of bones) { const sn = simpleName(b.name); if (!boneMap.has(sn)) { boneMap.set(sn, b); drivers.push(b); } else b.name = `${b.name}__dup${dup++}`; }
  const p = new THREE.Vector3(), q = new THREE.Quaternion();
  // 키 1.7m 정규화 + 발 접지 (computeBaseScale·replant 의 핵심만)
  obj.scale.setScalar(1); obj.position.set(0, 0, 0); obj.updateMatrixWorld(true);
  const box = new THREE.Box3(); for (const b of drivers) box.expandByPoint(b.getWorldPosition(p));
  const size = new THREE.Vector3(); box.getSize(size);
  obj.scale.setScalar(1.7 / Math.max(size.y, 1e-3)); obj.updateMatrixWorld(true);
  const box2 = new THREE.Box3(); for (const b of drivers) box2.expandByPoint(b.getWorldPosition(p));
  const c = new THREE.Vector3(); box2.getCenter(c);
  obj.position.set(-c.x, -box2.min.y, -c.z); obj.updateMatrixWorld(true);
  const bindLocalQ = new Map(), bindLocalP = new Map(), bindWorldQ = new Map();
  for (const b of bones) { bindLocalQ.set(b, b.quaternion.clone()); bindLocalP.set(b, b.position.clone()); }
  for (const b of bones) bindWorldQ.set(b, b.getWorldQuaternion(q).clone());
  const ch = { root: obj, bones: drivers, allBones: bones, boneMap, bindLocalQ, bindLocalP, bindWorldQ, slotX: 0, dna: defaultDna() };
  ch.dnaCompiled = compileDna(ch.dna);
  return ch;
}

const half = RES / 2;
const gs = half / HALF;                 // 월드 m → 그리드
const CELL_M = HALF / half;             // 그리드 셀 1칸 = 미터
const dims = { size: RES, yd: RES, zd: RES * RES };
const newField = () => new Float32Array(RES * RES * RES);

let failures = 0;
const pass = (n, msg) => console.log(`  \x1b[32m✓\x1b[0m #${n} ${msg}`);
const fail = (n, msg) => { failures++; console.log(`  \x1b[31m✗\x1b[0m #${n} ${msg}`); };
const check = (n, cond, msg) => (cond ? pass : fail)(n, msg);

// 세로 캡슐 세그먼트(월드 원점 중심, 높이축) 를 그리드 공간 seg 로.
function verticalSeg(rMeters, blend = 1, h = 0.15, lut = null, flatten = null) {
  const gy0 = (-h / HALF + 1) * half, gy1 = (h / HALF + 1) * half;
  const fr = BLEND * blend * gs;
  const L = lut || Float32Array.from({ length: LUT_N }, () => rMeters);
  let rMax = 0; for (const v of L) if (v > rMax) rMax = v;
  return { ax: half, ay: gy0, az: half, bx: half, by: gy1, bz: half, lut: L, fr, rmaxGrid: rMax * fr, flatten };
}

// x 축을 따라 필드를 스캔해 ISO 교차 반폭(m) 을 선형보간으로 측정 (세그먼트 중앙 y).
function isoHalfWidthX(field, gy) {
  const z = Math.round(half), y = Math.round(gy);
  const at = x => field[z * dims.zd + y * dims.yd + x];
  let cross = null;
  for (let x = Math.round(half); x < RES - 1; x++) {
    const a = at(x), b = at(x + 1);
    if (a >= ISO && b < ISO) { cross = x + (a - ISO) / (a - b); break; }
  }
  return cross === null ? 0 : (cross - half) * CELL_M;
}

// z 축(전후)을 따라 ISO 교차 반폭(m) — flatten 검증용 (v 방향).
function isoHalfWidthZ(field, gy) {
  const x = Math.round(half), y = Math.round(gy);
  const at = z => field[z * dims.zd + y * dims.yd + x];
  let cross = null;
  for (let z = Math.round(half); z < RES - 1; z++) {
    const a = at(z), b = at(z + 1);
    if (a >= ISO && b < ISO) { cross = z + (a - ISO) / (a - b); break; }
  }
  return cross === null ? 0 : (cross - half) * CELL_M;
}

// t=[0,1] → 세그먼트 중앙축의 그리드 y (verticalSeg 의 gy0..gy1 매핑과 일치)
const segGy = (t, h = 0.15) => ((-h / HALF + 1) * half) + t * (((h / HALF + 1) * half) - ((-h / HALF + 1) * half));

// v4.2 원본 update() 의 복셀 루프 재현 (테이퍼 R=Ra+(Rb-Ra)t) — 회귀 기준.
function fillV42(field, seg, Ra, Rb) {
  const { ax, ay, az, bx, by, bz } = seg;
  const dx = bx - ax, dy = by - ay, dz = bz - az, len2 = dx * dx + dy * dy + dz * dz;
  const Rmax = Math.max(Ra, Rb);
  const x0 = Math.max(1, Math.floor(Math.min(ax, bx) - Rmax)), x1 = Math.min(RES - 2, Math.ceil(Math.max(ax, bx) + Rmax));
  const y0 = Math.max(1, Math.floor(Math.min(ay, by) - Rmax)), y1 = Math.min(RES - 2, Math.ceil(Math.max(ay, by) + Rmax));
  const z0 = Math.max(1, Math.floor(Math.min(az, bz) - Rmax)), z1 = Math.min(RES - 2, Math.ceil(Math.max(az, bz) + Rmax));
  for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) {
    let idx = z * dims.zd + y * dims.yd + x0;
    for (let x = x0; x <= x1; x++, idx++) {
      const px = x - ax, py = y - ay, pz = z - az;
      let t = len2 > 1e-10 ? (px * dx + py * dy + pz * dz) / len2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = px - t * dx, qy = py - t * dy, qz = pz - t * dz, d2 = qx * qx + qy * qy + qz * qz;
      const R = Ra + (Rb - Ra) * t, R2 = R * R;
      if (d2 >= R2) continue;
      const g = 1 - d2 / R2; field[idx] += g * g * g;
    }
  }
}

// ASCII 단면 (z=중앙 평면, x-y) — iso 안쪽 '#'
function sliceCapture(field, label) {
  const z = Math.round(half);
  const rows = [];
  for (let y = RES - 1; y >= 0; y -= 2) {
    let line = '';
    for (let x = 0; x < RES; x += 1) line += field[z * dims.zd + y * dims.yd + x] >= ISO ? '#' : ' ';
    if (line.trim()) rows.push(line.replace(/\s+$/, ''));
  }
  console.log(`    ── ${label} (z=mid, x→) ──`);
  for (const r of rows) console.log('    ' + r);
}

// ASCII 수평 단면 (y=중앙, x-z 평면 = 위에서 본 단면) — 원/타원 판정용
function sliceCaptureXZ(field, gy, label) {
  const y = Math.round(gy);
  const rows = [];
  for (let z = RES - 1; z >= 0; z -= 1) {
    let line = '';
    for (let x = 0; x < RES; x += 1) line += field[z * dims.zd + y * dims.yd + x] >= ISO ? '#' : ' ';
    if (line.trim()) rows.push(line.replace(/\s+$/, ''));
  }
  console.log(`    ── ${label} (y=mid, x→ 가로 / z↕ 세로) ──`);
  for (const r of rows) console.log('    ' + r);
}

console.log('\n[F1] DNA 채널 + 두께 슬라이더\n');

// #1 — 기본 DNA(상수 profile) vs v4.2 테이퍼(Ra=Rb): 필드 비트 동일 + iso 폭 ≈ 2r
{
  const r = 0.08;
  const seg = verticalSeg(r);
  const fNew = newField(); fillField(fNew, dims, [seg], []);
  const fOld = newField(); fillV42(fOld, seg, r * BLEND * gs, r * BLEND * gs);
  let maxDiff = 0; for (let i = 0; i < fNew.length; i++) maxDiff = Math.max(maxDiff, Math.abs(fNew[i] - fOld[i]));
  // 유일한 차이는 LUT 의 float32 저장 반올림(≈6e-8) — 수치적으로 동일.
  check(1, maxDiff < 1e-6, `기본 DNA 필드 ≈ v4.2 테이퍼(Ra=Rb) 필드 (maxΔ=${maxDiff.toExponential(1)}, float32 반올림)`);
  const hw = isoHalfWidthX(fNew, half);
  check(1, Math.abs(hw - r) <= CELL_M, `iso 반폭 ${hw.toFixed(4)}m ≈ r ${r}m (복셀 ${CELL_M.toFixed(4)}m 이내)`);
  sliceCapture(fNew, `r=${r}m 세로 캡슐`);
}

// #2 — groups.arm=1.3 → arm 세그먼트 LUT ×1.3, 타 그룹 불변
{
  const base = defaultDna();
  const c0 = compileDna(base);
  const bumped = defaultDna(); bumped.groups.arm = 1.3;
  const c1 = compileDna(bumped);
  const armKeys = ['leftforearm', 'rightarm'], otherKeys = ['leftleg', 'head', 'spine1'];
  let armOk = true, otherOk = true;
  for (const k of armKeys) {
    const a = c0.resolve(k).lut, b = c1.resolve(k).lut;
    for (let i = 0; i < LUT_N; i++) if (a[i] > 1e-9 && Math.abs(b[i] / a[i] - 1.3) > 1e-4) armOk = false;
  }
  for (const k of otherKeys) {
    const a = c0.resolve(k).lut, b = c1.resolve(k).lut;
    for (let i = 0; i < LUT_N; i++) if (Math.abs(a[i] - b[i]) > 1e-9) otherOk = false;
  }
  check(2, armOk, 'arm 세그먼트 LUT 정확히 ×1.3');
  check(2, otherOk, '다리·머리·몸통 그룹 불변');
}

console.log('\n[F2] 형태 어휘 — 프로파일 곡선 · flatten · bump/cut\n');

// #3 — PCHIP: 제어점 통과 + 구간 내 오버슈트 0 (min/max 가 제어점 범위 안)
{
  const prof = [[0, 0.05], [0.5, 0.1], [1, 0.04]];
  const lut = bakeLut(prof);
  const rs = prof.map(p => p[1]), lo = Math.min(...rs), hi = Math.max(...rs);
  let hits = Math.abs(lut[0] - 0.05) < 1e-4 && Math.abs(lut[16] - 0.1) < 1e-4 && Math.abs(lut[32] - 0.04) < 1e-4;
  let noOver = true; for (const v of lut) if (v < lo - 1e-6 || v > hi + 1e-6) noOver = false;
  check(3, hits, `제어점 통과 (t=0→${lut[0].toFixed(3)}, .5→${lut[16].toFixed(3)}, 1→${lut[32].toFixed(3)})`);
  check(3, noOver, `오버슈트 0 (전 구간 [${lo}, ${hi}] 안, 실측 [${Math.min(...lut).toFixed(4)}, ${Math.max(...lut).toFixed(4)}])`);
}

// #4 — 종아리 프로파일: t=0.35 수직 레이 iso 폭 ≈ 2×0.062
{
  const c = compileDna(defaultDna());
  const leg = c.resolve('leftleg');
  const seg = verticalSeg(0, leg.blend, 0.15, leg.lut);
  const f = newField(); fillField(f, dims, [seg], []);
  const hw = isoHalfWidthX(f, segGy(0.35));
  check(4, Math.abs(hw - 0.062) <= CELL_M, `종아리 t=0.35 iso 반폭 ${hw.toFixed(4)}m ≈ 0.062m (복셀 ${CELL_M.toFixed(4)}m 이내)`);
}

// #5 — flatten: u 방향 폭 / v 방향 폭 ≈ f
{
  const fval = 0.7, r = 0.09;
  const seg = verticalSeg(r, 1, 0.15, null, { ux: 1, uy: 0, uz: 0, invf2: 1 / (fval * fval) }); // u = 월드 x
  const f = newField(); fillField(f, dims, [seg], []);
  const wu = isoHalfWidthX(f, half), wv = isoHalfWidthZ(f, half);
  const ratio = wu / wv;
  check(5, Math.abs(ratio - fval) <= 0.1, `u/v 폭비 ${ratio.toFixed(3)} ≈ f ${fval} (±10%; u=${wu.toFixed(4)} v=${wv.toFixed(4)})`);
  sliceCaptureXZ(f, half, `flatten f=${fval} 타원 단면 (x=u 납작, z=v)`);
}

// #6 — bump/cut: 구 중심 필드 증가/감소, 원거리 불변, mirror 쌍 대칭
{
  const r = 0.06, seg = verticalSeg(r);
  const base = newField(); fillField(base, dims, [seg], []);
  // bump 구를 세그먼트 옆(그리드 +x)으로 배치
  const cx = half + 0.05 * gs, cy = half, cz = half, rGrid = BLEND * 0.04 * gs;
  const withBump = newField(); fillField(withBump, dims, [seg], [{ cx, cy, cz, rGrid, strength: +1 }]);
  const withCut = newField(); fillField(withCut, dims, [seg], [{ cx, cy, cz, rGrid, strength: -1 }]);
  const ci = Math.round(cz) * dims.zd + Math.round(cy) * dims.yd + Math.round(cx);
  const fi = 1 * dims.zd + 1 * dims.yd + 1; // 원거리(볼륨 구석)
  const bumpUp = withBump[ci] > base[ci] + 1e-6, cutDown = withCut[ci] < base[ci] - 1e-6;
  const farSame = Math.abs(withBump[fi] - base[fi]) < 1e-9;
  check(6, bumpUp && cutDown, `구 중심 bump↑(${base[ci].toFixed(3)}→${withBump[ci].toFixed(3)}) cut↓(→${withCut[ci].toFixed(3)})`);
  check(6, farSame, '원거리 필드 불변');
  // mirror: compileDna 가 offset[1] 부호 반전 쌍둥이 자동 생성
  const dna = defaultDna();
  dna.bumps = [{ match: 'spine2', t: 0.5, offset: [0.05, 0.04, 0], r: 0.04, strength: 0.9, mirror: true }];
  const sp = compileDna(dna).resolve('spine2').spheres;
  const mirrorOk = sp.length === 2 && sp[0].offset[1] === -sp[1].offset[1] && sp[0].offset[0] === sp[1].offset[0];
  check(6, mirrorOk, `mirror 쌍 대칭 (offset[1]: ${sp[0]?.offset[1]} ↔ ${sp[1]?.offset[1]})`);
}

console.log('\n[F3] bake & 자동 스키닝 (실물 골격: X Bot · Y Bot)\n');

for (const file of ['public/assets/character/X Bot.fbx', 'public/assets/character/Y Bot.fbx']) {
  const name = file.match(/([XY] Bot)/)[1];
  let ch, baked;
  try { ch = loadCh(file); baked = bakeFleshMesh(ch, simpleName, { res: 128 }); }
  catch (e) { fail(7, `${name}: bake 실패 — ${e.message}`); continue; }
  const geo = baked.mesh.geometry, s = baked.stats;
  const posAttr = geo.attributes.position, wAttr = geo.attributes.skinWeight, iAttr = geo.attributes.skinIndex;
  const vN = posAttr.count;

  // #7a — 용접 후 중복 정점 0 (0.5mm 격자 재해시 == 고유 정점 수)
  const keys = new Set();
  for (let v = 0; v < vN; v++) keys.add(Math.round(posAttr.getX(v) * 2000) + '_' + Math.round(posAttr.getY(v) * 2000) + '_' + Math.round(posAttr.getZ(v) * 2000));
  const dupFree = keys.size >= vN * 0.999;
  check(7, dupFree && s.rawVerts > vN, `${name}: 용접 중복 0 (raw ${s.rawVerts}→ uniq ${vN}, 재해시 ${keys.size})`);

  // #7b — skinWeight 행 합 ≈ 1 (±1e-3)
  let maxErr = 0; for (let v = 0; v < vN; v++) { const sum = wAttr.getX(v) + wAttr.getY(v) + wAttr.getZ(v) + wAttr.getW(v); maxErr = Math.max(maxErr, Math.abs(sum - 1)); }
  check(7, maxErr <= 1e-3, `${name}: skinWeight 행 합 1±1e-3 (최대오차 ${maxErr.toExponential(1)})`);

  // #7c — Taubin 후 bbox 변화 ≤ 1%
  check(7, s.bboxGrow <= 0.01, `${name}: Taubin bbox 변화 ${(s.bboxGrow * 100).toFixed(2)}% ≤ 1%`);

  // #8 — 전완 90° 회전 CPU 스키닝: 전완 귀속 정점 강체 추종 (오차 ≤ 1mm)
  const skel = baked.mesh.skeleton;
  const foreBone = ch.boneMap.get('leftforearm') || ch.boneMap.get('rightforearm');
  const foreIdx = skel.bones.indexOf(foreBone);
  if (!foreBone || foreIdx < 0) { fail(8, `${name}: 전완 뼈 없음`); continue; }
  // 전완 순수 지배(가중치≈1) 정점 수집 — 강체 추종은 blend 없는 정점으로 판정
  // (0.99 정점은 관절 blend 라 LBS≠강체 가 정상; §6.1-6 이중 바인딩과 구분).
  const foreVerts = [];
  for (let v = 0; v < vN && foreVerts.length < 40; v++) {
    for (let j = 0; j < 4; j++) if (iAttr.getComponent(v, j) === foreIdx && wAttr.getComponent(v, j) > 0.999) {
      foreVerts.push([posAttr.getX(v), posAttr.getY(v), posAttr.getZ(v), v]); break;
    }
  }
  if (!foreVerts.length) { fail(8, `${name}: 전완 지배 정점 없음`); continue; }
  // bind 강체 행렬 M_i = boneMatrix_i · boneInverse_i (회전 전 = identity 근사)
  const bindMat = new THREE.Matrix4().multiplyMatrices(foreBone.matrixWorld, skel.boneInverses[foreIdx]);
  const vb = new THREE.Vector3(), vpre = new THREE.Vector3();
  let preErr = 0;
  for (const [x, y, z] of foreVerts) { vpre.set(x, y, z).applyMatrix4(bindMat); preErr = Math.max(preErr, vpre.distanceTo(vb.set(x, y, z))); }
  // 전완 90° 회전 → 강체 추종 검산
  foreBone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  ch.root.updateMatrixWorld(true);
  const M = new THREE.Matrix4().multiplyMatrices(foreBone.matrixWorld, skel.boneInverses[foreIdx]);
  // 전 정점: LBS(4-영향) 스키닝 == 전완 강체 변환(가중치≈1) 이어야 함
  const Ms = skel.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, skel.boneInverses[i]));
  const acc = new THREE.Matrix4(), tmp = new THREE.Vector3(), rigid = new THREE.Vector3(), lbs = new THREE.Vector3();
  let maxFollow = 0, moved = 0;
  for (const [x, y, z, v] of foreVerts) {
    rigid.set(x, y, z).applyMatrix4(M);
    // LBS: Σ w_i M_i p
    lbs.set(0, 0, 0);
    for (let j = 0; j < 4; j++) { const w = wAttr.getComponent(v, j); if (w <= 0) continue; tmp.set(x, y, z).applyMatrix4(Ms[iAttr.getComponent(v, j)]); lbs.addScaledVector(tmp, w); }
    maxFollow = Math.max(maxFollow, lbs.distanceTo(rigid));
    moved = Math.max(moved, rigid.distanceTo(vb.set(x, y, z)));
  }
  check(8, preErr <= 0.001, `${name}: 회전 전 skinned==bind (오차 ${(preErr * 1000).toFixed(3)}mm)`);
  check(8, maxFollow <= 0.001 && moved > 0.05, `${name}: 전완 90° 후 강체 추종 (LBS-강체 ${(maxFollow * 1000).toFixed(3)}mm, 이동 ${(moved * 100).toFixed(1)}cm)`);

  if (name === 'X Bot') { // 정면(x-y) 실루엣 캡처 — 구운 메시가 사람으로 읽히는지 한눈에
    // 회전 원복 후 캡처
    foreBone.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    ch.root.updateMatrixWorld(true);
    const W = 40, H = 30, grid = Array.from({ length: H }, () => new Array(W).fill(' '));
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (let v = 0; v < vN; v++) { const x = posAttr.getX(v), y = posAttr.getY(v); if (x < mnx) mnx = x; if (x > mxx) mxx = x; if (y < mny) mny = y; if (y > mxy) mxy = y; }
    for (let v = 0; v < vN; v++) {
      const gx = Math.round((posAttr.getX(v) - mnx) / (mxx - mnx) * (W - 1));
      const gy = Math.round((mxy - posAttr.getY(v)) / (mxy - mny) * (H - 1));
      grid[gy][gx] = '#';
    }
    console.log('    ── X Bot baked 정면 실루엣 (x→ 가로 / y↕) ──');
    for (const row of grid) console.log('    ' + row.join('').replace(/\s+$/, ''));
  }
}

console.log(`\n${failures ? '\x1b[31m' : '\x1b[32m'}${failures ? failures + ' FAIL' : 'ALL PASS'}\x1b[0m\n`);
process.exit(failures ? 1 : 0);
