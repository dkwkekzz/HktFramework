// ===========================================================================
//  HktCharacter · fit-loft — 시트 → 원판 로프트(disk-loft) 스택 피팅 (LOFT-PLAN §5)
//
//  시트 3뷰의 dense 경계를 뼈 로컬 원판(t, rx, zf, zb[, xo])로 변환한다.
//  피팅은 오프라인 1회 — 결과는 proportions.js 의 loft 절로 붙여넣는다(진실=데이터).
//
//  실행 (하위 단계 분할 — 호출당 시간 제한이 있는 CI 를 위해. 순서대로):
//    node eval/fit-loft.mjs --stage front-torso   → eval/out/fit-view-front-torso.json
//    node eval/fit-loft.mjs --stage side-torso    → eval/out/fit-view-side-torso.json
//    node eval/fit-loft.mjs --stage build-torso   → eval/out/fit-torso.json (브라우저 불필요)
//    node eval/fit-loft.mjs --stage front-legs    → eval/out/fit-view-front-legs.json (+runs)
//    node eval/fit-loft.mjs --stage side-legs     → eval/out/fit-view-side-legs.json
//    node eval/fit-loft.mjs --stage build-legs    → eval/out/fit-legs.json (브라우저 불필요)
//    node eval/fit-loft.mjs --stage apply         → 병합 주입 → 3방향 dense 손실
//                                                   + eval/out/loft-fit.json (붙여넣기용)
//  시간 여유가 있는 환경에선 --stage all 로 한 번에.
//
//  핵심 규칙 (LOFT-PLAN §5):
//   · 시트를 믿는 행 = "그 행의 전체 실루엣 경계가 해당 부위"인 행 —
//     전체 렌더와 부위-만 렌더(setSegFilter)의 경계가 일치(≤2px)하는지로 판정.
//     아니면(팔이 몸통을 가리는 밴드 등) 부위-만 렌더의 현재 실루엣을 유지한다.
//   · 다리 정면은 행의 잉크 구간(runs)으로 좌/우 분리, 측면 깊이는 두 다리 공유.
//   · 접힌 extras(목덜미·아랫배·골반옆·종아리)는 부위-만 렌더에 포함시켜 loft 가
//     흡수하고, 유지 extras(가슴·승모근·둔부·뒤꿈치·손바닥)는 제외해 이중계상 방지.
// ===========================================================================
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CROPS, findChromium, ensureServer, analyze, analyzeCanvas, denseProfile, denseLoss } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out');
const FIXTURE = join(ROOT, 'eval', 'fixtures', 'reference-sheet.jpeg');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
mkdirSync(OUT, { recursive: true });

const STAGE = process.argv.includes('--stage') ? process.argv[process.argv.indexOf('--stage') + 1] : 'all';

// ---- 세그먼트 필터 (setSegFilter 는 "제외" 정규식) ---------------------------
// extras 인덱스 (loft 통합 후): 0가슴 1승모근 2둔부 3뒤꿈치 4손바닥 — 전부 "유지" extras
// (최초 피팅 때 loft 로 접힌 목덜미·아랫배·골반옆·종아리는 프로파일에서 이미 삭제됨.
//  재피팅 시 part 렌더 = 현재 loft 살이므로 유지 extras 만 빼면 이중계상이 없다.)
const EXCL_ARMS = 'Shoulder|Arm|Hand|Thumb|Index|Middle|Ring|Pinky';
const EXCL_TORSO_ONLY = `${EXCL_ARMS}|UpLeg|Leg|Foot|Toe|extra:`; // 남는 것: 척추·목·두상 loft
const EXCL_LEGS_ONLY = `${EXCL_ARMS}|UpLeg|Spine|Neck|Head|sub:|extra:(0|1|2|4):`; // 남는 것: Leg·Foot·Toe + 뒤꿈치(3)

// ---- 스택 정의 ---------------------------------------------------------------
// key = 자식 관절 simple name (좌우 접두어 제거 → 다리는 양쪽 미러).
// tMin<0 = 부모 관절 아래로 연장 (골반), tMax>1 = 자식 관절 위로 연장 (두정).
// ⚠ 인접 스택은 t=1/t=0 끝점을 모두 포함해 관절 원판을 공유한다 (같은 시트 행 → 같은 값
//   → 단차 없음). 끝점을 빼먹으면 관절마다 살 공백이 생긴다 (교훈 — dense 손실 급증).
const TORSO_STACKS = [
  { key: 'Spine',       group: 'waist', child: 'Spine',       tMin: -1.7, tMax: 1,   stepM: 0.02  }, // 골반(-t)~허리 (하단은 시트 범위로 자동 종료)
  { key: 'Spine1',      group: 'waist', child: 'Spine1',      tMin: 0,    tMax: 1,   stepM: 0.02  },
  { key: 'Spine2',      group: 'chest', child: 'Spine2',      tMin: 0,    tMax: 1,   stepM: 0.02  },
  // Neck 은 fold k 를 넓게 — 목·승모근·어깨 사이 smin 웹이 시트의 어깨 경사선을 만든다
  // (전역 k 0.05 시절의 목 둘레 표현 — loft 기본 k 0.008 로는 목이 앙상해져 폭 지표 FAIL)
  { key: 'Neck',        group: 'chest', child: 'Neck',        tMin: 0,    tMax: 1,   stepM: 0.022, kFold: 0.05 },
  { key: 'Head',        group: 'head',  child: 'Head',        tMin: 0,    tMax: 1,   stepM: 0.017, head: true, kFold: 0.025 }, // 턱~중안면 (턱밑-목 이음 부드럽게)
  { key: 'HeadTop_End', group: 'head',  child: 'HeadTop_End', tMin: 0,    tMax: 2.4, stepM: 0.015, head: true }, // 두개골 상부~두정 (상단은 시트 범위로 자동 종료)
];
const LEG_STACKS = [
  { key: 'Leg',  group: 'legs', child: 'LeftLeg',  tMin: -0.12, tMax: 1,    stepM: 0.03  }, // 허벅지 (부모 LeftUpLeg)
  { key: 'Foot', group: 'legs', child: 'LeftFoot', tMin: 0,     tMax: 0.97, stepM: 0.028 }, // 정강이 (부모 LeftLeg)
];

// ---- 순수 유틸 ----------------------------------------------------------------
const MARGIN = 0.015; // 시리즈 범위 밖 이만큼까지만 가장자리 값 허용 (그 밖은 null — 원판 생성 안 함)
function lerpAt(series, f) { // { f, v }[] (f 오름차순)
  if (!series.length) return null;
  if (f < series[0].f - MARGIN || f > series[series.length - 1].f + MARGIN) return null;
  if (f <= series[0].f) return series[0].v;
  if (f >= series[series.length - 1].f) return series[series.length - 1].v;
  let i = 1; while (series[i].f < f) i++;
  const a = series[i - 1], b = series[i];
  return a.v + (b.v - a.v) * ((f - a.f) / (b.f - a.f));
}
// 계측 행 {f, sheet, part, vis} → 합성 값 시리즈 {f, v}.
// 시트를 믿는 조건: 그 행에서 부위가 실루엣 경계(vis) + 시트-렌더 차 ≤ GUARD.
// (시트의 팔뚝·손·코 획이 렌더와 다른 위치에 있으면 가시성 검사가 뚫린다 — 가드가 잡는다)
const GUARD = 0.015;
const compose = rows => rows.map(r => ({ f: r.f, v: r.vis && Math.abs(r.sheet - r.part) <= GUARD ? r.sheet : r.part }));
// 두상용 비대칭 합성: "줄이기(살 빼기)는 시트대로 자유, 늘리기는 +GUARD 까지".
// 시트 머리엔 머리카락이 붙어 있다 — 살을 머리카락 폭으로 늘리면 갓머리가 되지만,
// 얼굴이 렌더보다 갸름한 건 그대로 믿어야 한다 (dir=+1: hi 경계, dir=-1: lo 경계).
const composeShrink = (rows, dir) => rows.map(r => ({
  f: r.f,
  v: !r.vis ? r.part : dir > 0 ? Math.min(r.sheet, r.part + GUARD) : Math.max(r.sheet, r.part - GUARD),
}));
// t 그리드: 끝점(관절 원판)을 반드시 포함 — 인접 스택이 관절 원판을 공유해야 단차가 없다.
function tGrid(tMin, tMax, dtWanted) {
  const n = Math.max(1, Math.round((tMax - tMin) / dtWanted));
  return Array.from({ length: n + 1 }, (_, i) => tMin + (tMax - tMin) * (i / n));
}
const movAvg3 = arr => arr.map((v, i) => {
  const w = [arr[i - 1], v, arr[i + 1]].filter(x => x != null);
  return w.reduce((s, x) => s + x, 0) / w.length;
});
const r4 = v => +v.toFixed(4);
const readJ = f => JSON.parse(readFileSync(join(OUT, f), 'utf8'));
const writeJ = (f, o) => writeFileSync(join(OUT, f), JSON.stringify(o, null, 1));
const axisAt = (joints, child, t) => { // 뼈(자식 관절 기준) 축 위 t 의 월드 좌표 (외삽 허용)
  const c = joints[child], p = joints[c.parent];
  return [0, 1, 2].map(i => p.pos[i] + (c.pos[i] - p.pos[i]) * t);
};

// ===========================================================================
//  계측 하위 단계 (브라우저 필요)
// ===========================================================================
async function withPage(fn) {
  const server = await ensureServer(ROOT, PORT);
  const browser = await chromium.launch({ executablePath: findChromium() });
  try {
    const vp = (process.env.HKT_FIT_VP ?? '300x520').split('x').map(Number);
    const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    await page.goto(server.url + '/?paused=1', { waitUntil: 'load' }); // 로드 직후 프레임 정지
    await page.waitForFunction(() => window.__hkt, null, { timeout: 120000 });
    await page.evaluate(() => {
      document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
      const h = window.__hkt;
      h.setPreset('reference');
      h.st.clip = 'apose'; h.st.speed = 0; h.st.dist = 3.4; h.st.el = 0.0; h.st.az = 0.0;
    });
    await fn(page);
  } finally {
    await browser.close();
    server.proc?.kill();
  }
}
const setFilter = (page, re) => page.evaluate(re => window.__hkt.setSegFilter(re), re);
const setAz = (page, az) => page.evaluate(az => { window.__hkt.st.az = az; }, az);
// 렌더 일시정지 — GL 프레임이 필요 없는 구간(시트 분석/좌표 변환)의 evaluate 지연 제거
const setPause = (page, on) => page.evaluate(on => { window.__hkt.st.pause = on; }, on);
const s2wBatch = (page, pts, plane) =>
  page.evaluate(({ pts, plane }) => pts.map(p => window.__hkt.screenToWorld(p[0], p[1], plane)), { pts, plane });

// 시트 행의 잉크 구간(runs) — 다리 좌/우 분리용 (선화라 구간=획).
const analyzeRuns = (page, b64, crop) => page.evaluate(async ({ b64, crop }) => {
  const img = new Image();
  await new Promise(res => { img.onload = res; img.src = 'data:image/jpeg;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const { x0, x1, y0, y1 } = crop;
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const ink = (x, y) => { const i = (y * c.width + x) * 4; return (d[i] + d[i + 1] + d[i + 2]) / 3 < 185; };
  const rows = [];
  for (let y = y0; y < y1; y++) {
    const runs = []; let s = -1;
    for (let x = x0; x <= x1; x++) {
      const on = x < x1 && ink(x, y);
      if (on && s < 0) s = x;
      else if (!on && s >= 0) {
        if (runs.length && s - runs[runs.length - 1][1] <= 3) runs[runs.length - 1][1] = x - 1; // 3px 이하 틈 병합
        else runs.push([s, x - 1]);
        s = -1;
      }
    }
    rows.push({ y, runs });
  }
  return rows;
}, { b64, crop });

// 한 뷰 계측 → 직렬화 가능한 데이터 (build 단계가 소비)
// plane: 'z'(정면) | 'x'(측면), coord: 월드 좌표 인덱스 (정면 x=0, 측면 z=2)
async function measureView(page, view, az, exclRe, plane, coord, wantRuns) {
  const refB64 = readFileSync(FIXTURE).toString('base64');
  await setAz(page, az);
  await setPause(page, true); // 시트 분석은 렌더 불필요 — GL 프레임 대기 제거
  const sheetA = await analyze(page, refB64, 'image/jpeg', CROPS[view], 'stroke');
  const sheetP = denseProfile(sheetA);
  await setFilter(page, null);
  await setPause(page, false);
  const fullA = await analyzeCanvas(page);   // 렌더 프레임 ① 전체
  await setFilter(page, exclRe);
  const partA = await analyzeCanvas(page);   // 렌더 프레임 ② 부위만
  await setFilter(page, null);
  await setPause(page, true); // 이후 좌표 변환·관절 덤프도 렌더 불필요

  // 월드 매핑 앵커: 정수리/발끝 y + 몸 축 좌표 + px 부호/스케일 (일괄 변환 1회)
  const fullRow = y => fullA.rows.find(r => r.y === y);
  const H = fullA.bot - fullA.top;
  const relF = sheetP.rows.filter(r => r.reliable).map(r => r.f);
  const axRows = relF.filter(f => f > 0.1 && f < 0.9)
    .map(f => fullRow(Math.round(fullA.top + f * H))).filter(r => r && r.L >= 0);
  const cxRenPx = axRows.reduce((s, r) => s + (r.L + r.R) / 2, 0) / axRows.length;
  const midY = (fullA.top + fullA.bot) / 2;
  const [crownW, toeW, axW, axW10] = await s2wBatch(page,
    [[cxRenPx, fullA.top], [cxRenPx, fullA.bot], [cxRenPx, midY], [cxRenPx + 10, midY]], plane);
  const crownY = crownW[1], toeY = toeW[1], axisWorld = axW[coord];
  const sgn = Math.sign(axW10[coord] - axW[coord]);
  const cs = sheetP.rows.filter(r => r.reliable && r.f > 0.1 && r.f < 0.9 && r.L != null);
  const cxSheet = cs.reduce((s, r) => s + (r.L + r.R) / 2, 0) / cs.length;
  const mPerPx = (crownY - toeY) / sheetP.H;
  const sheetToWorld = px => axisWorld + (px - cxSheet) * mPerPx * sgn;

  // 부위 경계 시리즈: 시트가 그 부위를 그대로 보여주는 행 → 시트, 아니면 부위-만 렌더.
  const partRow = y => partA.rows.find(r => r.y === y);
  const lo = [], hi = []; // 월드 좌표 (lo=작은 쪽 경계, hi=큰 쪽)
  const renPxPts = [], meta = [];
  for (const r of sheetP.rows) {
    if (!r.reliable || r.L == null) continue;
    const ry = Math.round(fullA.top + r.f * H);
    const fr = fullRow(ry), pr = partRow(ry);
    if (!pr || pr.L < 0) continue; // 부위가 그 높이에 없음
    const visL = fr && Math.abs(fr.L - pr.L) <= 2, visR = fr && Math.abs(fr.R - pr.R) <= 2;
    meta.push({ f: r.f, visL, visR, sL: sheetToWorld(r.L), sR: sheetToWorld(r.R), i0: renPxPts.length });
    renPxPts.push([pr.L, ry], [pr.R, ry]);
  }
  const renW = await s2wBatch(page, renPxPts, plane);
  for (const e of meta) {
    const c1 = renW[e.i0][coord], c2 = renW[e.i0 + 1][coord];
    const partLo = Math.min(c1, c2), partHi = Math.max(c1, c2);
    const sheetLo = Math.min(e.sL, e.sR), sheetHi = Math.max(e.sL, e.sR);
    const [visLo, visHi] = sgn > 0 ? [e.visL, e.visR] : [e.visR, e.visL]; // px→월드 방향 정렬
    // 시트/부위-렌더 값을 모두 저장 — 합성(가시성+가드)은 build 단계에서 (재계측 없이 튜닝)
    lo.push({ f: e.f, sheet: sheetLo, part: partLo, vis: visLo });
    hi.push({ f: e.f, sheet: sheetHi, part: partHi, vis: visHi });
  }
  const joints = await page.evaluate(() => window.__hkt.joints());
  const out = { view, plane, coord, crownY, toeY, axisWorld, sgn, mPerPx, cxSheet,
    sheetTop: sheetP.top, sheetH: sheetP.H, lo, hi, joints };
  if (wantRuns) out.runs = await analyzeRuns(page, refB64, CROPS[view]);
  await setPause(page, false);
  return out;
}

// ===========================================================================
//  빌드 하위 단계 (브라우저 불필요 — 저장된 계측 JSON 소비)
// ===========================================================================
function buildTorso() {
  const F = readJ('fit-view-front-torso.json'), S = readJ('fit-view-side-torso.json');
  const joints = F.joints;
  const Flo = compose(F.lo), Fhi = compose(F.hi), Slo = compose(S.lo), Shi = compose(S.hi);
  const FloH = composeShrink(F.lo, -1), FhiH = composeShrink(F.hi, +1);
  const SloH = composeShrink(S.lo, -1), ShiH = composeShrink(S.hi, +1);
  const fit = {};
  for (const st of TORSO_STACKS) {
    const child = joints[st.child], parent = joints[child.parent];
    const boneLen = Math.hypot(...[0, 1, 2].map(i => child.pos[i] - parent.pos[i]));
    const disks = [];
    for (const t of tGrid(st.tMin, st.tMax, st.stepM / Math.max(boneLen, 1e-4))) {
      const ax = axisAt(joints, st.child, t);
      const fF = (F.crownY - ax[1]) / (F.crownY - F.toeY);
      const fS = (S.crownY - ax[1]) / (S.crownY - S.toeY);
      if (fF < -0.01 || fF > 1.01) continue;
      const xl = lerpAt(st.head ? FloH : Flo, fF), xr = lerpAt(st.head ? FhiH : Fhi, fF);
      const zb = lerpAt(st.head ? SloH : Slo, fS), zf = lerpAt(st.head ? ShiH : Shi, fS);
      if (xl == null || zb == null) continue;
      const rx = Math.max((xr - xl) / 2, 0.008); // xo 는 중심 스택에선 0 (좌우 대칭 강제)
      disks.push({ t: r4(t), rx, zf: zf - ax[2], zb: zb - ax[2] });
    }
    if (disks.length < 2) { console.error(`⚠ ${st.key}: 유효 원판 ${disks.length}개 — 건너뜀`); continue; }
    for (const kk of ['rx', 'zf', 'zb']) {
      const sm = movAvg3(disks.map(d => d[kk]));
      disks.forEach((d, i) => { d[kk] = r4(sm[i]); });
    }
    // 두정 돔: round-cone 은 원판이 아니라 "구의 볼록 껍질" — 원판은 축 방향으로도
    // 반지름만큼 구를 뻗는다. 급한 테이퍼(정수리)에선 작은 끝 원판이 큰 원판의 구 안에
    // 파묻혀 두정이 반지름만큼 솟는다 (+6cm → 렌더 신장 왜곡 → f 정렬 전체 오염. 교훈).
    // → "구 꼭대기 == crown" 이 되는 첫 원판에서 스택을 자르고, 그 원판의 구형 돔이
    //   두정을 그리게 한다 (반지름은 crown 에 정확히 맞춰 스케일).
    if (st.key === 'HeadTop_End') {
      const crown = F.crownY;
      let cut = disks.length;
      for (let i = 0; i < disks.length; i++) {
        const y = axisAt(joints, st.child, disks[i].t)[1];
        const rEmit = Math.max(disks[i].rx, (disks[i].zf - disks[i].zb) / 2);
        if (y + rEmit >= crown) { cut = i + 1; break; }
      }
      disks.length = Math.max(cut, 2);
      const last = disks[disks.length - 1];
      const y = axisAt(joints, st.child, last.t)[1];
      const rEmit = Math.max(last.rx, (last.zf - last.zb) / 2);
      const sc = Math.max((crown - y) / rEmit, 0.05);
      last.rx = r4(last.rx * sc); last.zf = r4(last.zf * sc); last.zb = r4(last.zb * sc);
    }
    fit[st.key] = st.kFold ? { group: st.group, k: st.kFold, disks } : { group: st.group, disks };
  }
  // 골반 하단: 가랑이 바로 아래 쐐기 테이퍼 2장 (구형 캡이 가랑이를 메우지 않게 —
  // 마지막 원판에서 3.5cm/7cm 아래, 허벅지 사이에 숨는 크기로 수렴)
  if (fit.Spine) {
    const d0 = fit.Spine.disks[0]; // t 오름차순 — [0] = 최하단
    const boneLen = Math.abs(joints.Spine.pos[1] - joints.Hips.pos[1]) + 1e-4;
    const dtW = 0.035 / boneLen;
    fit.Spine.disks.unshift(
      { t: r4(d0.t - 2 * dtW), rx: r4(d0.rx * 0.15), zf: r4(d0.zf * 0.3), zb: r4(d0.zb * 0.3) },
      { t: r4(d0.t - dtW), rx: r4(d0.rx * 0.5), zf: r4(d0.zf * 0.65), zb: r4(d0.zb * 0.65) },
    );
    // 시트 모순 보정 (LOFT-PLAN §9): 후면 그림의 힙 최광부(f≈0.52)가 정면 그림보다
    // ~1cm 넓다 — 정면 상한(+0.06H)과 후면 하한(-0.06H)의 교집합으로 힙 크레스트만 +5mm.
    for (const d of fit.Spine.disks) {
      const y = axisAt(joints, 'Spine', d.t)[1];
      if (y > 0.77 && y < 0.82) d.rx = r4(d.rx + 0.005);
    }
  }
  writeJ('fit-torso.json', fit);
  console.log(`fit-torso.json — 스택 ${Object.keys(fit).length}개, 원판 ${Object.values(fit).reduce((s, v) => s + v.disks.length, 0)}장`);
}

function buildLegs() {
  const F = readJ('fit-view-front-legs.json'), S = readJ('fit-view-side-legs.json');
  const joints = F.joints;
  const Flo = compose(F.lo), Fhi = compose(F.hi), Slo = compose(S.lo), Shi = compose(S.hi);
  const sheetToWorld = px => F.axisWorld + (px - F.cxSheet) * F.mPerPx * F.sgn;
  // 다리 외곽은 이미 가시성+가드를 거친 F.lo/F.hi (두 다리 envelope) 를 쓰고,
  // runs 는 "안쪽 윤곽 분리"에만 쓴다 — envelope 밖 획(팔·손)은 무시된다.
  // 반환: +x(캐릭터 Left) 다리의 [outer(바깥), inner(안쪽)] 월드 x. 닿아 있으면 inner=중앙.
  const legRowAt = (f, wl, wr) => {
    const y = Math.round(F.sheetTop + f * F.sheetH);
    const row = F.runs.find(r => r.y === y);
    if (!row) return null;
    const mid = (wl + wr) / 2;
    // envelope 안쪽 획만 (양끝 1cm 여유) — 월드로 변환해 다룬다
    const rw = row.runs.map(([s, e]) => [sheetToWorld(s), sheetToWorld(e)].sort((a, b) => a - b))
      .filter(([s, e]) => e > wl - 0.01 && s < wr + 0.01);
    if (!rw.length) return null;
    // +x 쪽 다리: envelope 의 +x 절반에서 안쪽(중앙 방향) 경계를 찾는다
    const hi = Math.max(wl, wr); // +x 바깥 경계
    const straddle = rw.find(([s, e]) => s <= mid && e >= mid);
    const plusRuns = rw.filter(([s]) => s > mid);
    let inner;
    if (straddle) inner = mid; // 중앙 걸침 획 = 두 다리 닿음 → 분리 지점은 중앙
    else if (plusRuns.length >= 2) inner = plusRuns[0][1]; // 안쪽 윤곽 획의 끝
    else return null; // 획 부족 — 이 행은 신뢰 불가
    return { outer: hi, inner };
  };
  const fit = {};
  for (const st of LEG_STACKS) {
    const child = joints[st.child], parent = joints[child.parent];
    const boneLen = Math.hypot(...[0, 1, 2].map(i => child.pos[i] - parent.pos[i]));
    const disks = [];
    for (const t of tGrid(st.tMin, st.tMax, st.stepM / Math.max(boneLen, 1e-4))) {
      const ax = axisAt(joints, st.child, t); // Left 다리 축
      const fF = (F.crownY - ax[1]) / (F.crownY - F.toeY);
      const fS = (S.crownY - ax[1]) / (S.crownY - S.toeY);
      if (fF < -0.01 || fF > 1.005) continue;
      const wl = lerpAt(Flo, fF), wr = lerpAt(Fhi, fF);
      const zb = lerpAt(Slo, fS), zf = lerpAt(Shi, fS); // 측면 깊이는 두 다리 공유
      if (wl == null || zb == null) continue;
      const lr = legRowAt(fF, wl, wr);
      if (!lr) continue;
      const rx = Math.max((lr.outer - lr.inner) / 2, 0.008);
      const xo = (lr.outer + lr.inner) / 2 - ax[0];
      disks.push({ t: r4(t), rx, zf: zf - ax[2], zb: zb - ax[2], xo });
    }
    if (disks.length < 2) { console.error(`⚠ ${st.key}: 유효 원판 ${disks.length}개 — 건너뜀`); continue; }
    for (const kk of ['rx', 'zf', 'zb', 'xo']) {
      const sm = movAvg3(disks.map(d => d[kk]));
      disks.forEach((d, i) => { d[kk] = r4(sm[i]); });
    }
    fit[st.key] = { group: st.group, disks };
  }
  // 시트 모순 보정 (LOFT-PLAN §9): 후면 그림의 힙 최광부(f≈0.52)가 정면 그림보다 ~1cm
  // 넓다 — 그 행의 실루엣 경계는 허벅지 상단. 정면 상한과 후면 하한의 교집합으로 +1cm.
  if (fit.Leg) {
    for (const d of fit.Leg.disks) {
      const y = axisAt(joints, 'LeftLeg', d.t)[1];
      if (y > 0.75 && y < 0.83) { d.rx = r4(d.rx + 0.006); d.xo = r4(d.xo + 0.004); }
    }
  }
  fit.UpLeg = { group: 'legs', disks: [] }; // UpLeg 캡슐 억제 (골반+허벅지 loft 가 대체)
  writeJ('fit-legs.json', fit);
  console.log(`fit-legs.json — 스택 ${Object.keys(fit).length}개`);
}

// ===========================================================================
//  단계 실행
// ===========================================================================
const run = {
  'front-torso': () => withPage(async p => writeJ('fit-view-front-torso.json', await measureView(p, 'front', 0, EXCL_TORSO_ONLY, 'z', 0))),
  'side-torso':  () => withPage(async p => writeJ('fit-view-side-torso.json', await measureView(p, 'side', Math.PI / 2, EXCL_TORSO_ONLY, 'x', 2))),
  'build-torso': async () => buildTorso(),
  'front-legs':  () => withPage(async p => writeJ('fit-view-front-legs.json', await measureView(p, 'front', 0, EXCL_LEGS_ONLY, 'z', 0, true))),
  'side-legs':   () => withPage(async p => writeJ('fit-view-side-legs.json', await measureView(p, 'side', Math.PI / 2, EXCL_LEGS_ONLY, 'x', 2))),
  'build-legs':  async () => buildLegs(),
  'apply': () => withPage(async page => {
    const loft = { ...readJ('fit-torso.json'), ...readJ('fit-legs.json') };
    writeJ('loft-fit.json', loft);
    await page.evaluate(loft => {
      const prof = window.__hkt.PROFILES.reference;
      prof.loft = loft; // (접힌 extras·두상 subBones 는 loft 통합 때 프로파일에서 이미 제거됨)
      window.__hkt.setPreset('reference');
    }, loft);
    const refB64 = readFileSync(FIXTURE).toString('base64');
    // --view front|side|back — 한 뷰만 측정 (호출당 시간 제한 대응)
    const onlyV = process.argv.includes('--view') ? process.argv[process.argv.indexOf('--view') + 1] : null;
    let total = 0;
    for (const [view, az] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
      if (onlyV && view !== onlyV) continue;
      await setPause(page, true);
      const refP = denseProfile(await analyze(page, refB64, 'image/jpeg', CROPS[view], 'stroke'));
      await setAz(page, az);
      await setPause(page, false);
      const ren = denseProfile(await analyzeCanvas(page));
      const { loss, rows } = denseLoss(refP, ren);
      total += loss;
      writeJ(`apply-rows-${view}.json`, rows); // 행별 잔차 (디버그/부위 분해용)
      console.log(`${view}: dense 손실 ${loss.toFixed(5)}`);
    }
    console.log(`평균: ${(total / 3).toFixed(5)}  (loft-fit.json — proportions.js 에 반영)`);
  }),
  all: async () => {
    await run['front-torso'](); await run['side-torso'](); await run['build-torso']();
    await run['front-legs'](); await run['side-legs'](); await run['build-legs']();
    await run.apply();
  },
};
if (!run[STAGE]) { console.error(`알 수 없는 단계: ${STAGE}`); process.exit(2); }
await run[STAGE]();
