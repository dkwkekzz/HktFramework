// ============================================================================
//  flesh-verify.mjs — 살 시스템 Node 검증 (headless Chromium 불가 대체)
//
//  fillField·fleshdna 가 순수 함수라 DOM/WebGL 없이 임포트 가능(three 는 수학용만).
//  각 검사는 수치 판정 + 필요 시 ASCII 단면 캡처(한눈에 판정)를 남긴다.
//  실행:  node tools/flesh-verify.mjs   (실패 시 exit 1)
//  docs/FLESH-PLAN.md §10.1 표의 검사 번호와 대응한다.
// ============================================================================
import { fillField, BLEND, HALF, RES, ISO } from '../src/mcflesh.js';
import { compileDna, defaultDna, LUT_N } from '../src/fleshdna.js';

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
function verticalSeg(rMeters, blend = 1, h = 0.15, lut = null) {
  const gy0 = (-h / HALF + 1) * half, gy1 = (h / HALF + 1) * half;
  const fr = BLEND * blend * gs;
  const L = lut || Float32Array.from({ length: LUT_N }, () => rMeters);
  let rMax = 0; for (const v of L) if (v > rMax) rMax = v;
  return { ax: half, ay: gy0, az: half, bx: half, by: gy1, bz: half, lut: L, fr, rmaxGrid: rMax * fr, flatten: null };
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

console.log(`\n${failures ? '\x1b[31m' : '\x1b[32m'}${failures ? failures + ' FAIL' : 'ALL PASS'}\x1b[0m\n`);
process.exit(failures ? 1 : 0);
