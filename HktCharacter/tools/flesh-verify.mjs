// ============================================================================
//  flesh-verify.mjs — 살 시스템 Node 검증 (headless Chromium 불가 대체)
//
//  fillField·fleshdna 가 순수 함수라 DOM/WebGL 없이 임포트 가능(three 는 수학용만).
//  각 검사는 수치 판정 + 필요 시 ASCII 단면 캡처(한눈에 판정)를 남긴다.
//  실행:  node tools/flesh-verify.mjs   (실패 시 exit 1)
//  docs/FLESH-PLAN.md §10.1 표의 검사 번호와 대응한다.
// ============================================================================
import { fillField, BLEND, HALF, RES, ISO } from '../src/mcflesh.js';
import { compileDna, defaultDna, bakeLut, LUT_N } from '../src/fleshdna.js';

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

console.log(`\n${failures ? '\x1b[31m' : '\x1b[32m'}${failures ? failures + ' FAIL' : 'ALL PASS'}\x1b[0m\n`);
process.exit(failures ? 1 : 0);
