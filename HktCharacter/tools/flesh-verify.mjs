// ============================================================================
//  flesh-verify.mjs — 살 DNA/필드 Node 검증 (§10.1). 렌더러 없이 순수 함수만 임포트.
//
//    node tools/flesh-verify.mjs
//
//  샌드박스는 headless Chromium 이 막혀 있어 육안 대신 수치 검증을 남긴다.
//  판정 가능한 폭·합 지표를 찍고 PASS/FAIL 로 요약한다.
// ============================================================================
import { defaultDna, compileDna } from '../src/fleshdna.js';
import { fillField, BLEND, HALF } from '../src/mcflesh.js';

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
  // 실제 인접 세그먼트쌍(upleg r=0.075 → leg r=0.055): 구는 테이퍼, 새는 각자 상수.
  // 관절 겹침으로 폭차가 복셀 1칸 안이어야 회귀 없음.
  {
    const dna = compileDna(defaultDna());
    const rUp = dna.resolve('upleg').lut, rLeg = dna.resolve('leg').lut; // 상수 LUT
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
//  요약
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(56)}\n  ${pass} PASS · ${fail} FAIL\n${'='.repeat(56)}`);
process.exit(fail ? 1 : 0);
