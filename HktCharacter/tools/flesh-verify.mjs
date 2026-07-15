// ============================================================================
//  flesh-verify.mjs — 살 게놈 검증 하네스 (게놈 인코딩 4법칙 측정)
//
//  근거: genome-encoding-principles.md 부록 "검증 하네스" + §1 4법칙.
//  "눈으로 보고 판단하지 마라 — 넷 다 정량 측정 가능하다." 이 스크립트는 그 넷
//  (폐쇄성·지역성·조합성·다양성) + 형태→기능(§6) + 회귀/채널분리를 숫자로 재고,
//  한눈에 판정 가능한 SVG 카드(tools/flesh-audit.svg)로 남긴다.
//
//  fleshdna.js 는 three 비의존 순수 모듈이라 렌더러 없이 Node 로 돌아간다.
//    실행:  node tools/flesh-verify.mjs
// ============================================================================
import {
  GENE_SPEC, GENOME_LEN, GROUP_BOUNDARIES, defaultGenome, randomGenome,
  compileFlesh, isValidPhenotype, phenotypeFeatures, phenotypeDistance,
  crossoverGenome, deriveStats, mulberry32,
} from '../src/fleshdna.js';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const rng = mulberry32(0xC0FFEE);

// ── 통계 유틸 ───────────────────────────────────────────────────────────────
const l2 = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
function rankOf(arr) {
  const idx = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(arr.length);
  let i = 0;
  while (i < idx.length) {
    let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
    i = j + 1;
  }
  return r;
}
function pearson(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; } ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return num / Math.sqrt(da * db || 1e-12);
}
const spearman = (a, b) => pearson(rankOf(a), rankOf(b));

// 공용 랜덤 표본 — 특징 표준화(스케일 상이 보정)에 재사용. d_p 는 표준화 L2(마할라노비스
// 근사) — 원리 문서가 말한 "특징 벡터 거리"를 단위 상이(반지름 vs 색)로 왜곡되지 않게 잰다.
const SAMPLE = [];
for (let i = 0; i < 5000; i++) {
  const g = randomGenome(rng), c = compileFlesh(g);
  SAMPLE.push({ g, c, f: phenotypeFeatures(c) });
}
const NF = SAMPLE[0].f.length;
const FMEAN = new Array(NF).fill(0), FSTD = new Array(NF).fill(0);
for (const s of SAMPLE) for (let i = 0; i < NF; i++) FMEAN[i] += s.f[i];
for (let i = 0; i < NF; i++) FMEAN[i] /= SAMPLE.length;
for (const s of SAMPLE) for (let i = 0; i < NF; i++) { const d = s.f[i] - FMEAN[i]; FSTD[i] += d * d; }
for (let i = 0; i < NF; i++) FSTD[i] = Math.sqrt(FSTD[i] / SAMPLE.length) || 1e-9;
const stdDist = (fa, fb) => {
  let s = 0; for (let i = 0; i < NF; i++) { if (FSTD[i] < 1e-8) continue; const d = (fa[i] - fb[i]) / FSTD[i]; s += d * d; }
  return Math.sqrt(s);
};

// ============================================================================
//  1. 폐쇄성 (Closure) — 임의 수열도 항상 유효 (반드시 1.0)
// ============================================================================
function auditClosure(n = 10000) {
  let valid = 0;
  for (let i = 0; i < n; i++) if (isValidPhenotype(compileFlesh(randomGenome(rng)))) valid++;
  return valid / n;
}

// ============================================================================
//  2. 지역성 (Locality) — 게놈 거리 d_g vs 표현형 거리 d_p 의 순위 상관 (ρ>0.7)
// ============================================================================
function auditLocality(pairsN = 3000) {
  const dg = [], dp = [], scatter = [];
  for (let i = 0; i < pairsN; i++) {
    const a = SAMPLE[(rng() * SAMPLE.length) | 0], b = SAMPLE[(rng() * SAMPLE.length) | 0];
    const g = l2(a.g, b.g), p = stdDist(a.f, b.f);
    dg.push(g); dp.push(p);
    if (i < 500) scatter.push([g, p]);
  }
  return { rho: spearman(dg, dp), scatter };
}

// ============================================================================
//  3. 조합성 (Compositionality) — 그룹 경계 크로스오버 vs 무작위 지점.
//     품질 = 자손 세그먼트가 부모 한쪽의 특징을 온전히 물려받은 비율(신체 부위 보존).
//     경계에서 자르면 부위가 통째로 상속(=1.0), 유전자 그룹을 쪼개면 세그먼트가
//     양 부모 혼합이라 어느 쪽과도 안 맞는다. 비율(경계/무작위) > 1.5 목표.
// ============================================================================
function segmentInheritedFrac(childC, aC, bC) {
  // 실제로 그려지는 부위(rMax>0)만 — r=0 자리표시(손가락·리프)는 항상 일치하므로 제외.
  const drawn = childC.segments.map((s, i) => (s.rMax > 1e-5 ? i : -1)).filter(i => i >= 0);
  const feat = (c, i) => { let sum = 0; for (const v of c.segments[i].lut) sum += v; return [sum / c.segments[i].lut.length, c.segments[i].flatten ? c.segments[i].flatten.f : 1]; };
  const eq = (u, v) => Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6;
  let clean = 0;
  for (const i of drawn) if (eq(feat(childC, i), feat(aC, i)) || eq(feat(childC, i), feat(bC, i))) clean++;
  return clean / drawn.length;
}
function auditCompositionality(n = 2000) {
  let bSum = 0, uSum = 0;
  for (let i = 0; i < n; i++) {
    const a = randomGenome(rng), b = randomGenome(rng);
    const aC = compileFlesh(a), bC = compileFlesh(b);
    // 경계 크로스오버 vs 유전자별 무작위(부위를 산산조각내는 최대 교란 재조합)
    const bd = compileFlesh(crossoverGenome(a, b, rng, { mode: 'boundary' }));
    const ud = compileFlesh(crossoverGenome(a, b, rng, { mode: 'uniform' }));
    bSum += segmentInheritedFrac(bd, aC, bC);
    uSum += segmentInheritedFrac(ud, aC, bC);
  }
  const boundary = bSum / n, uniform = uSum / n;
  return { boundary, uniform, ratio: boundary / (uniform || 1e-6) };
}

// ============================================================================
//  4. 다양성 (Diversity) — 표현형 특징 공간의 유효 차원 (게놈 길이의 절반 이상).
//     참여비 PR = (Σλ)² / Σλ² = trace(C)² / Σ C_ij²  (고유분해 불필요).
// ============================================================================
function auditDiversity() {
  // 표준화 특징의 상관행렬 PR (단위 상이 보정 — 색·반지름이 공평히 기여).
  // 상수 특징(std≈0: 손가락 r=0 등)은 제외해 유효 차원만 센다.
  const cols = []; for (let i = 0; i < NF; i++) if (FSTD[i] > 1e-6) cols.push(i);
  const F = cols.length, N = SAMPLE.length;
  const cov = Array.from({ length: F }, () => new Array(F).fill(0));
  for (const s of SAMPLE) for (let i = 0; i < F; i++) {
    const di = (s.f[cols[i]] - FMEAN[cols[i]]) / FSTD[cols[i]];
    for (let j = i; j < F; j++) cov[i][j] += di * (s.f[cols[j]] - FMEAN[cols[j]]) / FSTD[cols[j]];
  }
  let diag = 0, fro = 0;
  for (let i = 0; i < F; i++) for (let j = i; j < F; j++) {
    cov[i][j] /= N; if (j > i) cov[j][i] = cov[i][j];
  }
  for (let i = 0; i < F; i++) { diag += cov[i][i]; for (let j = 0; j < F; j++) fro += cov[i][j] * cov[i][j]; }
  return { effRank: (diag * diag) / (fro || 1e-12), dims: F };
}

// ============================================================================
//  5. 형태 = 기능 (§6) — bulk 스윕에서 부피↑·체력↑·속도↓(트레이드오프)
// ============================================================================
function auditFormFunction(steps = 21) {
  const thickIdx = GENE_SPEC.map((g, i) => (g.key.endsWith('.thick') ? i : -1)).filter(i => i >= 0);
  const curve = [];
  for (let s = 0; s <= steps; s++) {
    const g = defaultGenome(); for (const i of thickIdx) g[i] = s / steps; // 전체 두께 동조 = "크기" 축
    const st = deriveStats(compileFlesh(g));
    curve.push({ bulk: s / steps, health: st.health, speed: st.speed, volume: st.volume });
  }
  const health = curve.map(c => c.health), speed = curve.map(c => c.speed), bulk = curve.map(c => c.bulk);
  return { curve, corrHealth: spearman(bulk, health), corrSpeed: spearman(bulk, speed) };
}

// ============================================================================
//  6. 회귀 / 채널 분리 — 한 부위 유전자는 그 부위 세그먼트만 바꾼다.
// ============================================================================
function auditChannelIsolation() {
  const base = compileFlesh(defaultGenome());
  const idx = GENE_SPEC.findIndex(g => g.key === 'arm.thick');
  const g = defaultGenome(); g[idx] = 1; // arm.thick 최대(1.6)
  const armC = compileFlesh(g);
  let armChanged = 0, otherChanged = 0;
  for (let i = 0; i < base.segments.length; i++) {
    const a = base.segments[i], b = armC.segments[i];
    let diff = 0; for (let k = 0; k < a.lut.length; k++) diff += Math.abs(a.lut[k] - b.lut[k]);
    if (a.group === 'arm') { if (diff > 1e-6) armChanged++; }
    else if (diff > 1e-6) otherChanged++;
  }
  return { armChanged, otherChanged };
}

// ── 실행 ────────────────────────────────────────────────────────────────────
console.log('살 게놈 검증 — 게놈 인코딩 4법칙 (genome-encoding-principles)\n');
console.log(`게놈 길이 ${GENOME_LEN}  · 그룹 경계 [${GROUP_BOUNDARIES.join(', ')}]\n`);

const closure = auditClosure();
const locality = auditLocality();
const comp = auditCompositionality();
const div = auditDiversity();
const ff = auditFormFunction();
const iso = auditChannelIsolation();

const pass = {
  closure: closure === 1.0,
  locality: locality.rho > 0.7,
  composability: comp.ratio > 1.5,
  diversity: div.effRank >= GENOME_LEN / 2,
  formFn: ff.corrHealth > 0.95 && ff.corrSpeed < -0.95,
  channel: iso.armChanged > 0 && iso.otherChanged === 0,
};
const P = ok => (ok ? '✅ PASS' : '❌ FAIL');
const T = [
  ['1. 폐쇄성 (closure=1.0)', closure.toFixed(4), pass.closure],
  ['2. 지역성 (ρ>0.7)', locality.rho.toFixed(3), pass.locality],
  ['3. 조합성 (경계/유전자무작위>1.5)', `${comp.ratio.toFixed(2)}  (경계 ${comp.boundary.toFixed(2)} / 무작위 ${comp.uniform.toFixed(2)})`, pass.composability],
  ['4. 다양성 (유효차원≥' + (GENOME_LEN / 2) + ')', `${div.effRank.toFixed(2)} / ${div.dims}차원`, pass.diversity],
  ['5. 형태→기능 (부피↑체력↑속도↓)', `체력ρ ${ff.corrHealth.toFixed(2)} · 속도ρ ${ff.corrSpeed.toFixed(2)}`, pass.formFn],
  ['6. 채널 분리 (팔 유전자→팔만)', `팔 ${iso.armChanged}개 변경 · 타부위 ${iso.otherChanged}개`, pass.channel],
];
for (const [name, val, ok] of T) console.log(`  ${P(ok)}  ${name.padEnd(30)} ${val}`);
const allPass = Object.values(pass).every(Boolean);
console.log(`\n종합: ${allPass ? '✅ 전 항목 합격 — 진화 가능한 표현' : '⚠️ 일부 항목 미달 (아래 SVG 참조)'}\n`);

// ── SVG 감사 카드 ───────────────────────────────────────────────────────────
function svgCard() {
  const W = 640, H = 860, pad = 28;
  const bg = '#14161a', fg = '#dfe3ea', muted = '#8b95a3', ok = '#4ade80', bad = '#f87171', accent = '#3b82f6';
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="system-ui,'Segoe UI',sans-serif">`;
  s += `<rect width="${W}" height="${H}" fill="${bg}"/>`;
  s += `<text x="${pad}" y="38" fill="${fg}" font-size="20" font-weight="700">살 게놈 감사 — 게놈 인코딩 4법칙</text>`;
  s += `<text x="${pad}" y="58" fill="${muted}" font-size="12">SDF 살 · 게놈 길이 ${GENOME_LEN} · 위상은 로드된 스켈레톤(게놈 밖 고정)</text>`;
  // 판정 표
  let y = 92;
  for (const [name, val, okp] of T) {
    s += `<rect x="${pad}" y="${y - 15}" width="${W - 2 * pad}" height="30" rx="5" fill="${okp ? '#16241a' : '#2a1618'}"/>`;
    s += `<text x="${pad + 10}" y="${y + 5}" fill="${okp ? ok : bad}" font-size="12" font-weight="700">${okp ? 'PASS' : 'FAIL'}</text>`;
    s += `<text x="${pad + 54}" y="${y + 5}" fill="${fg}" font-size="12">${name}</text>`;
    s += `<text x="${W - pad - 10}" y="${y + 5}" fill="${muted}" font-size="11" text-anchor="end">${val.replace(/</g, '&lt;')}</text>`;
    y += 36;
  }
  // 지역성 산점도
  const px = pad, py = y + 24, pw = W - 2 * pad, ph = 200;
  s += `<text x="${px}" y="${py - 8}" fill="${fg}" font-size="13" font-weight="600">② 지역성 — 게놈거리 d_g(→) vs 표현형거리 d_p(↑)</text>`;
  s += `<rect x="${px}" y="${py}" width="${pw}" height="${ph}" fill="#0d0f12" stroke="#2c333d"/>`;
  const gMax = Math.max(...locality.scatter.map(p => p[0])), pMax = Math.max(...locality.scatter.map(p => p[1]));
  for (const [g, p] of locality.scatter) {
    const cx = px + (g / gMax) * pw, cy = py + ph - (p / pMax) * ph;
    s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="1.6" fill="${accent}" opacity="0.5"/>`;
  }
  s += `<text x="${px + pw - 6}" y="${py + ph - 8}" fill="${muted}" font-size="10" text-anchor="end">ρ=${locality.rho.toFixed(3)} (단조↑ = 좋음)</text>`;
  // 형태→기능 곡선
  const fx = pad, fy = py + ph + 48, fw = W - 2 * pad, fh = 200;
  s += `<text x="${fx}" y="${fy - 8}" fill="${fg}" font-size="13" font-weight="600">⑤ 형태→기능 — 전체 벌크(→) 대비 체력·속도</text>`;
  s += `<rect x="${fx}" y="${fy}" width="${fw}" height="${fh}" fill="#0d0f12" stroke="#2c333d"/>`;
  const hMax = Math.max(...ff.curve.map(c => c.health)), spMax = Math.max(...ff.curve.map(c => c.speed));
  const line = (key, max, color) => {
    let d = '';
    ff.curve.forEach((c, i) => {
      const cx = fx + (i / (ff.curve.length - 1)) * fw;
      const cy = fy + fh - (c[key] / max) * (fh - 20) - 10;
      d += (i ? 'L' : 'M') + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ';
    });
    s += `<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`;
  };
  line('health', hMax, ok);
  line('speed', spMax, accent);
  s += `<text x="${fx + 8}" y="${fy + 16}" fill="${ok}" font-size="11">체력 ↑ (부피에서 읽음)</text>`;
  s += `<text x="${fx + 8}" y="${fy + 32}" fill="${accent}" font-size="11">속도 ↓ (무거우면 느림 — 트레이드오프)</text>`;
  s += `<text x="${fx + fw - 6}" y="${fy + fh - 8}" fill="${muted}" font-size="10" text-anchor="end">스탯은 게놈이 아니라 표현형(형태)의 함수</text>`;
  s += `</svg>`;
  return s;
}
const out = join(HERE, 'flesh-audit.svg');
writeFileSync(out, svgCard());
console.log(`감사 카드 → ${out}`);
process.exitCode = allPass ? 0 : 1;
