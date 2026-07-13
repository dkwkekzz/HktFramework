// ============================================================================
//  flesh-verify.mjs — 살 DNA/필드 Node 검증 (§10.1). 렌더러 없이 순수 함수만 임포트.
//
//    node tools/flesh-verify.mjs
//
//  샌드박스는 headless Chromium 이 막혀 있어 육안 대신 수치 검증을 남긴다.
//  판정 가능한 폭·합 지표를 찍고 PASS/FAIL 로 요약한다.
// ============================================================================
import * as THREE from 'three';
import { defaultDna, compileDna, samplePchip } from '../src/fleshdna.js';
import { fillField, BLEND, HALF } from '../src/mcflesh.js';
import { bakeFleshMesh } from '../src/fleshbake.js';

let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => {
  (cond ? pass++ : fail++);
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  return cond;
};
const H = s => console.log(`\n## ${s}`);

// ---------------------------------------------------------------------------
//  합성 필드 헬퍼 — 한 세그먼트를 그리드에 채우고 수직 레이의 iso 교차 폭을 잰다.
// ---------------------------------------------------------------------------
const RES = 64;
const ISO = (1 - 1 / (BLEND * BLEND)) ** 3;
const dims = { size: RES, yd: RES, zd: RES * RES };
const gs = (RES / 2) / HALF; // McFlesh 와 동일 배율 (half = size/2)

// 세그먼트를 그리드 y축(수직)으로 세운다: 부모 a=(0, y0, 0), 자식 b=(0, y1, 0) — 미터.
// lut(미터) 를 직접 넘겨 상수/곡선 프로파일 모두 시험.
function makeSeg(lut, { y0 = -0.3, y1 = 0.3, blend = 1, flatten = null } = {}) {
  const toG = (x, y, z) => [((x) / HALF + 1) * (RES / 2), ((y) / HALF + 1) * (RES / 2), ((z) / HALF + 1) * (RES / 2)];
  const [ax, ay, az] = toG(0, y0, 0);
  const [bx, by, bz] = toG(0, y1, 0);
  const rscale = BLEND * blend * gs;
  let rMax = 0; for (const r of lut) if (r > rMax) rMax = r;
  return { ax, ay, az, bx, by, bz, lut, rscale, rMax: rMax * rscale, flatten };
}

// 그리드 점 (wx,wy,wz 미터) → 필드 인덱스
const gidx = (wx, wy, wz) => {
  const gx = Math.round(((wx) / HALF + 1) * (RES / 2));
  const gy = Math.round(((wy) / HALF + 1) * (RES / 2));
  const gz = Math.round(((wz) / HALF + 1) * (RES / 2));
  return gz * dims.zd + gy * dims.yd + gx;
};

// 주어진 높이 wy 에서 축(dir='x'|'z')을 따라 iso 교차 반폭(미터)을 이분 탐색.
function isoHalfWidth(field, wy, dir = 'x') {
  const sample = d => {
    const gx = ((dir === 'x' ? d : 0) / HALF + 1) * (RES / 2);
    const gy = ((wy) / HALF + 1) * (RES / 2);
    const gz = ((dir === 'z' ? d : 0) / HALF + 1) * (RES / 2);
    // 삼선형 보간
    const x0 = Math.floor(gx), y0 = Math.floor(gy), z0 = Math.floor(gz);
    const fx = gx - x0, fy = gy - y0, fz = gz - z0;
    const at = (x, y, z) => field[z * dims.zd + y * dims.yd + x] || 0;
    const c00 = at(x0, y0, z0) * (1 - fx) + at(x0 + 1, y0, z0) * fx;
    const c10 = at(x0, y0 + 1, z0) * (1 - fx) + at(x0 + 1, y0 + 1, z0) * fx;
    const c01 = at(x0, y0, z0 + 1) * (1 - fx) + at(x0 + 1, y0, z0 + 1) * fx;
    const c11 = at(x0, y0 + 1, z0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1, z0 + 1) * fx;
    const c0 = c00 * (1 - fy) + c10 * fy, c1 = c01 * (1 - fy) + c11 * fy;
    return c0 * (1 - fz) + c1 * fz;
  };
  if (sample(0) < ISO) return 0;
  let lo = 0, hi = HALF * 0.9;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (sample(m) >= ISO) lo = m; else hi = m; }
  return lo;
}

const voxel = HALF / (RES / 2); // 복셀 크기(미터) ≈ 0.036

// ---------------------------------------------------------------------------
//  #1 (F1) — 기본 DNA vs 구 RADII+테이퍼: 합성 2-뼈 리그 iso 폭 비교
// ---------------------------------------------------------------------------
H('#1  F1: 기본 DNA(LUT) vs 구 RADII 테이퍼 — iso 폭 회귀');
{
  // 구 알고리즘(테이퍼 Ra→Rb) 참조 구현
  function fillOld(field, aG, bG, RaM, RbM, blend = 1) {
    const Ra = RaM * BLEND * blend * gs, Rb = RbM * BLEND * blend * gs;
    const Rmax = Math.max(Ra, Rb);
    const [ax, ay, az] = aG, [bx, by, bz] = bG;
    const dx = bx - ax, dy = by - ay, dz = bz - az, len2 = dx * dx + dy * dy + dz * dz;
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
        if (d2 >= R2) continue; const g = 1 - d2 / R2; field[idx] += g * g * g;
      }
    }
  }
  const toG = (x, y, z) => [((x) / HALF + 1) * (RES / 2), ((y) / HALF + 1) * (RES / 2), ((z) / HALF + 1) * (RES / 2)];
  // 등반지름(테이퍼 없음) 세그먼트: 새/구 알고리즘이 정확히 일치해야 한다 (LUT 기계 정합).
  {
    const r = 0.075;
    const lut = new Float32Array(33).fill(r);
    const fNew = new Float32Array(RES ** 3); fillField(fNew, dims, [makeSeg(lut, { y0: -0.25, y1: 0.25 })], []);
    const fOld = new Float32Array(RES ** 3); fillOld(fOld, toG(0, -0.25, 0), toG(0, 0.25, 0), r, r);
    let maxDiff = 0;
    for (let wy = -0.15; wy <= 0.15; wy += 0.02)
      maxDiff = Math.max(maxDiff, Math.abs(isoHalfWidth(fNew, wy) - isoHalfWidth(fOld, wy)));
    ok('등반지름 세그먼트 LUT==테이퍼', maxDiff <= voxel * 0.25, `최대 폭차 ${(maxDiff * 100).toFixed(2)}cm (복셀 ${(voxel * 100).toFixed(1)}cm)`);
  }
  // 인접 세그먼트쌍 회귀 — **F1 상수 프로파일**(구 RADII 자식값: upleg 0.075, leg 0.055)
  // vs 구 테이퍼 알고리즘. F2 의 곡선 defaultDna 와 무관한 LUT 기계 회귀 가드다.
  {
    const rUp = new Float32Array(33).fill(0.075), rLeg = new Float32Array(33).fill(0.055);
    const fNew = new Float32Array(RES ** 3);
    fillField(fNew, dims, [
      makeSeg(rUp, { y0: 0.0, y1: 0.4 }),   // upleg 위→아래
      makeSeg(rLeg, { y0: -0.4, y1: 0.0 }), // leg (무릎→발목)
    ], []);
    const fOld = new Float32Array(RES ** 3);
    fillOld(fOld, toG(0, 0.4, 0), toG(0, 0.0, 0), 0.105 /*hips 부모 근사*/, 0.075); // upleg 테이퍼 부모≈hips
    fillOld(fOld, toG(0, 0.0, 0), toG(0, -0.4, 0), 0.075, 0.055);                    // leg 테이퍼 upleg→leg
    let maxDiff = 0, worst = 0;
    for (let wy = -0.35; wy <= 0.35; wy += 0.02) {
      const d = Math.abs(isoHalfWidth(fNew, wy) - isoHalfWidth(fOld, wy));
      if (d > maxDiff) { maxDiff = d; worst = wy; }
    }
    ok('인접 세그먼트쌍 폭차 ≤ 복셀 1칸', maxDiff <= voxel, `최대 ${(maxDiff * 100).toFixed(2)}cm @y=${worst.toFixed(2)} (복셀 ${(voxel * 100).toFixed(1)}cm)`);
  }
}

// ---------------------------------------------------------------------------
//  #2 (F1) — groups.arm=1.3 → arm 세그먼트 LUT ×1.3, 타 그룹 불변
// ---------------------------------------------------------------------------
H('#2  F1: groups 두께 배율 — arm=1.3 이 arm 세그먼트에만 정확히 적용');
{
  const dna = defaultDna();
  const c0 = compileDna(dna);
  const armBase = c0.resolve('forearm').lut[0];
  const legBase = c0.resolve('leg').lut[0];
  dna.groups.arm = 1.3;
  c0.invalidate();
  const armNew = c0.resolve('forearm').lut[0];
  const legNew = c0.resolve('leg').lut[0];
  ok('arm 세그먼트 ×1.3', Math.abs(armNew - armBase * 1.3) < 1e-6, `${armBase.toFixed(4)}→${armNew.toFixed(4)}`);
  ok('leg 세그먼트 불변', Math.abs(legNew - legBase) < 1e-6, `${legBase.toFixed(4)}→${legNew.toFixed(4)}`);
}

// ---------------------------------------------------------------------------
//  #3 (F2) — PCHIP: 제어점 통과 + 오버슈트 0 (구간 내 값이 제어점 범위 안)
// ---------------------------------------------------------------------------
H('#3  F2: PCHIP — 제어점 통과 · 오버슈트 없음');
{
  const pts = [[0, 0.055], [0.35, 0.09], [0.8, 0.088], [1, 0.06]]; // head 프로파일
  const lut = samplePchip(pts);
  // 제어점 통과: 각 제어점 t 에 해당하는 LUT 지점(정수 인덱스에 안 떨어지면 근사)
  let maxCpErr = 0;
  for (const [t, r] of pts) {
    const s = t * 32, i = Math.round(s);
    maxCpErr = Math.max(maxCpErr, Math.abs(lut[i] - r));
  }
  ok('제어점 통과', maxCpErr < 1e-3, `최대 오차 ${(maxCpErr * 1000).toFixed(2)}mm`);
  // 오버슈트 없음: LUT 전체 min/max 가 제어점 r 범위 안
  let lo = Infinity, hi = -Infinity;
  for (const v of lut) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const rlo = Math.min(...pts.map(p => p[1])), rhi = Math.max(...pts.map(p => p[1]));
  ok('오버슈트 0 (범위 내)', lo >= rlo - 1e-6 && hi <= rhi + 1e-6,
    `LUT[${(lo * 1000).toFixed(1)},${(hi * 1000).toFixed(1)}]mm ⊂ 제어[${(rlo * 1000).toFixed(1)},${(rhi * 1000).toFixed(1)}]mm`);
  // 급감 프로파일도 음수/융기 없음 (round-cone 볼록 껍질 방지)
  const lut2 = samplePchip([[0, 0.1], [0.5, 0.02], [1, 0.08]]);
  let mono = true; for (const v of lut2) if (v < 0.02 - 1e-6 || v > 0.1 + 1e-6) mono = false;
  ok('급감 프로파일 융기 없음', mono);
}

// ---------------------------------------------------------------------------
//  #4 (F2) — 종아리 프로파일: t=0.35 수직 레이 iso 폭 ≈ 2×0.062
// ---------------------------------------------------------------------------
H('#4  F2: 종아리 leg 프로파일 — t=0.35 iso 폭 ≈ 2×0.062');
{
  const leg = compileDna(defaultDna()).resolve('leg').lut; // [[0,.055],[.35,.062],[1,.035]]
  const y0 = -0.3, y1 = 0.3;
  const field = new Float32Array(RES ** 3);
  fillField(field, dims, [makeSeg(leg, { y0, y1 })], []);
  const wy = y0 + 0.35 * (y1 - y0); // t=0.35 지점 높이
  const half = isoHalfWidth(field, wy, 'x');
  ok('t=0.35 iso 반폭 ≈ 0.062', Math.abs(half - 0.062) <= voxel,
    `측정 ${(half * 100).toFixed(2)}cm vs 기대 6.20cm (±복셀 ${(voxel * 100).toFixed(1)}cm)`);
}

// ---------------------------------------------------------------------------
//  #5 (F2) — flatten: u 방향 폭 / v 방향 폭 ≈ f
// ---------------------------------------------------------------------------
H('#5  F2: flatten 타원 단면 — u/v 폭비 ≈ f');
{
  const f = 0.6;
  const r = 0.08;
  const lut = new Float32Array(33).fill(r);
  // 수직(y축) 세그먼트에 z 방향(u) flatten. u=(0,0,1) 은 축 y 와 직교.
  const flatten = { ux: 0, uy: 0, uz: 1, finv2m1: 1 / (f * f) - 1 };
  const field = new Float32Array(RES ** 3);
  fillField(field, dims, [makeSeg(lut, { y0: -0.25, y1: 0.25, flatten })], []);
  const wU = isoHalfWidth(field, 0, 'z'); // u 방향(납작해야)
  const wV = isoHalfWidth(field, 0, 'x'); // v 방향(원본)
  const ratio = wU / wV;
  ok('u/v 폭비 ≈ f', Math.abs(ratio - f) <= 0.1,
    `u=${(wU * 100).toFixed(2)}cm v=${(wV * 100).toFixed(2)}cm 비=${ratio.toFixed(3)} vs f=${f}`);
}

// ---------------------------------------------------------------------------
//  #6 (F2) — cut: 컷 중심 필드값 감소, 원거리 불변
// ---------------------------------------------------------------------------
H('#6  F2: cut 구 감산 — 중심 감소 · 원거리 불변');
{
  const r = 0.09;
  const lut = new Float32Array(33).fill(r);
  const seg = makeSeg(lut, { y0: -0.3, y1: 0.3 });
  const base = new Float32Array(RES ** 3);
  fillField(base, dims, [seg], []);
  // 컷: 세그먼트 표면 근처(옆) 중심의 구
  const cutCenter = [0.05, 0.0, 0.0]; // 미터
  const toGi = (wx, wy, wz) => ({
    cx: ((wx) / HALF + 1) * (RES / 2), cy: ((wy) / HALF + 1) * (RES / 2), cz: ((wz) / HALF + 1) * (RES / 2),
  });
  const cg = toGi(...cutCenter);
  const cut = { ...cg, Rc: BLEND * 0.05 * ((RES / 2) / HALF), strength: 0.6 };
  const withCut = new Float32Array(RES ** 3);
  fillField(withCut, dims, [seg], [cut]);
  const iC = gidx(...cutCenter);
  const iFar = gidx(0.0, -0.25, 0.0); // 컷에서 먼 지점
  const dropped = withCut[iC] < base[iC] - 1e-4;
  const farSame = Math.abs(withCut[iFar] - base[iFar]) < 1e-6;
  ok('컷 중심 필드 감소', dropped, `${base[iC].toFixed(3)}→${withCut[iC].toFixed(3)}`);
  ok('원거리 불변', farSame, `Δ=${Math.abs(withCut[iFar] - base[iFar]).toExponential(1)}`);
}

// ---------------------------------------------------------------------------
//  F3 공용 — 합성 팔 리그(spine1→arm→forearm→hand→handend) 를 만들어 bake.
//  three 코어(Bone/Skeleton/MarchingCubes)는 WebGL 없이 순수 계산이라 Node 가능.
// ---------------------------------------------------------------------------
function buildArmCh() {
  const root = new THREE.Object3D();
  const simple = n => n.toLowerCase();
  const mk = (name, x) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, 0, 0); return b; };
  const spine1 = new THREE.Bone(); spine1.name = 'spine1'; spine1.position.set(0, 1.4, 0);
  const arm = mk('arm', 0.12), forearm = mk('forearm', 0.28), hand = mk('hand', 0.25), handend = mk('handend', 0.09);
  root.add(spine1); spine1.add(arm); arm.add(forearm); forearm.add(hand); hand.add(handend);
  root.updateMatrixWorld(true);
  const bones = [spine1, arm, forearm, hand, handend];
  const ch = {
    root, bones, allBones: bones, slotX: 0,
    dna: defaultDna(), dnaCompiled: null,
    bindLocalQ: new Map(), bindLocalP: new Map(), bindWorldQ: new Map(),
  };
  ch.dnaCompiled = compileDna(ch.dna);
  const q = new THREE.Quaternion();
  for (const b of bones) {
    ch.bindLocalQ.set(b, b.quaternion.clone());
    ch.bindLocalP.set(b, b.position.clone());
    ch.bindWorldQ.set(b, b.getWorldQuaternion(q).clone());
  }
  return { ch, simple, bones, forearm };
}

// ---------------------------------------------------------------------------
//  #7 (F3) — 용접 후 중복 정점 0 · skinWeight 행 합 1±1e-3 · Taubin bbox 변화 ≤1%
// ---------------------------------------------------------------------------
H('#7  F3: bake — 용접·skinWeight 합·Taubin bbox');
{
  const { ch, simple } = buildArmCh();
  const { mesh, stats } = bakeFleshMesh(ch, simple, { res: 128 });
  const pos = mesh.geometry.getAttribute('position');
  // 중복 정점 0 — 최종 유니크 정점끼리 0.5mm 격자 키가 겹치지 않아야 함
  const keys = new Set();
  let dup = 0;
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
    if (keys.has(k)) dup++; else keys.add(k);
  }
  ok('용접 후 중복 정점 0', dup === 0, `유니크 ${pos.count} · 용접 ${stats.welded} · 중복잔여 ${dup}`);
  // skinWeight 행 합 ≈1
  const sw = mesh.geometry.getAttribute('skinWeight');
  let maxErr = 0;
  for (let i = 0; i < sw.count; i++) {
    const s = sw.getX(i) + sw.getY(i) + sw.getZ(i) + sw.getW(i);
    maxErr = Math.max(maxErr, Math.abs(s - 1));
  }
  ok('skinWeight 행 합 1±1e-3', maxErr <= 1e-3, `최대 편차 ${maxErr.toExponential(2)}`);
  // Taubin bbox 변화 ≤1%
  ok('Taubin bbox 변화 ≤1%', stats.bboxDrift <= 0.01, `${(stats.bboxDrift * 100).toFixed(3)}%`);
  ok('폴리곤 한도 미초과', !stats.overflow, `삼각형 ${stats.triangles | 0}`);
}

// ---------------------------------------------------------------------------
//  #8 (F3) — 전완 90° 회전 CPU 스키닝: 전완 귀속 정점이 강체 추종 (거리 보존)
// ---------------------------------------------------------------------------
H('#8  F3: 전완 90° 회전 — 전완 귀속 정점 강체 추종');
{
  const { ch, simple, bones, forearm } = buildArmCh();
  const { mesh } = bakeFleshMesh(ch, simple, { res: 128 });
  const geo = mesh.geometry;
  const pos = geo.getAttribute('position'), si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
  const skel = mesh.skeleton;
  const fIdx = bones.indexOf(forearm);
  // 전완 지배(weight>0.95) 정점 수집 — 원본 월드 위치
  const sel = [];
  for (let i = 0; i < pos.count; i++) {
    let w = 0;
    for (const [ix, wt] of [[si.getX(i), sw.getX(i)], [si.getY(i), sw.getY(i)], [si.getZ(i), sw.getZ(i)], [si.getW(i), sw.getW(i)]])
      if (ix === fIdx) w += wt;
    if (w > 0.999) sel.push([pos.getX(i), pos.getY(i), pos.getZ(i), i]); // 순수 전완 정점
  }
  // 전완 90° 회전(+z축) 후 스켈레톤 갱신
  forearm.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  ch.root.updateMatrixWorld(true);
  skel.update();
  // CPU 스키닝: boneMatrices[i] = bone.matrixWorld × boneInverse[i]. bindMatrix=identity.
  const T = bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, skel.boneInverses[i]));
  const skinned = sel.map(([x, y, z, i]) => {
    const out = new THREE.Vector3();
    for (const [ix, wt] of [[si.getX(i), sw.getX(i)], [si.getY(i), sw.getY(i)], [si.getZ(i), sw.getZ(i)], [si.getW(i), sw.getW(i)]]) {
      if (wt === 0) continue;
      out.add(new THREE.Vector3(x, y, z).applyMatrix4(T[ix]).multiplyScalar(wt));
    }
    return out;
  });
  // 강체성: 원본 쌍거리 == 스킨 후 쌍거리 (회전·평행이동은 거리 보존). 첫 정점 기준.
  let maxDev = 0;
  const o0 = new THREE.Vector3(...sel[0].slice(0, 3)), s0 = skinned[0];
  for (let k = 1; k < sel.length; k++) {
    const od = o0.distanceTo(new THREE.Vector3(...sel[k].slice(0, 3)));
    const sd = s0.distanceTo(skinned[k]);
    maxDev = Math.max(maxDev, Math.abs(od - sd));
  }
  // 회전이 실제로 정점을 움직였는지(비-자명성) 확인
  const moved = o0.distanceTo(s0);
  ok('전완 귀속 정점 존재', sel.length >= 20, `${sel.length}개`);
  ok('회전이 정점을 이동시킴(비자명)', moved > 0.05, `이동 ${(moved * 100).toFixed(1)}cm`);
  ok('강체 추종 — 쌍거리 편차 ≤1mm', maxDev <= 0.001, `최대 ${(maxDev * 1000).toFixed(3)}mm`);
}

// ---------------------------------------------------------------------------
//  요약
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(56)}\n  ${pass} PASS · ${fail} FAIL\n${'='.repeat(56)}`);
process.exit(fail ? 1 : 0);
