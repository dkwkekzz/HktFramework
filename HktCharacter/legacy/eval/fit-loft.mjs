// ===========================================================================
//  HktCharacter · fit-loft — 시트 → 원판 로프트(disk-loft) 스택 피팅 (LOFT-PLAN §5)
//
//  시트 3뷰의 dense 경계를 뼈 로컬 원판(t, rx, zf, zb[, xo])로 변환한다.
//  피팅은 오프라인 1회 — 결과는 proportions.js 의 loft 절로 붙여넣는다(진실=데이터).
//
//  실행 (하위 단계 분할 — 호출당 시간 제한이 있는 CI 를 위해. 계측 전부 → 빌드 순서):
//    node eval/fit-loft.mjs --stage front-torso   → eval/out/fit-view-front-torso.json
//    node eval/fit-loft.mjs --stage side-torso    → eval/out/fit-view-side-torso.json
//    node eval/fit-loft.mjs --stage front-legs    → eval/out/fit-view-front-legs.json (+runs)
//    node eval/fit-loft.mjs --stage side-legs     → eval/out/fit-view-side-legs.json
//    node eval/fit-loft.mjs --stage back-legs     → eval/out/fit-view-back-legs.json (+runs)
//    node eval/fit-loft.mjs --stage build-torso   → eval/out/fit-torso.json (브라우저 불필요)
//    node eval/fit-loft.mjs --stage build-legs    → eval/out/fit-legs.json (브라우저 불필요)
//    node eval/fit-loft.mjs --stage apply         → 병합 주입 → 3방향 dense 손실
//                                                   + eval/out/loft-fit.json (붙여넣기용)
//  시간 여유가 있는 환경에선 --stage all 로 한 번에.
//
//  핵심 규칙 (LOFT-PLAN §5):
//   · 시트를 믿는 행 = "그 행의 전체 실루엣 경계가 해당 부위"인 행 —
//     전체 렌더와 부위-만 렌더(setSegFilter)의 경계가 일치(≤2px)하는지로 판정.
//     아니면(팔이 몸통을 가리는 밴드 등) 부위-만 렌더의 현재 실루엣을 유지한다.
//     단, 렌더가 시트보다 뚱뚱한 행은 시트로 수축(compose SHRINK) — 돔 재흡수 랫칫 차단.
//   · 정면 시트의 허리~골반 대역은 팔·손 획이 몸 윤곽을 가린다(envelope=팔) —
//     후면 뷰(팔이 몸에서 떨어져 간격 존재)의 윤곽 추적(traceContour)으로 대체한다.
//     이게 없으면 그 대역은 영원히 self-copy — 시트를 한 번도 보지 못한다 (교훈).
//   · 다리 정면은 행의 잉크 구간(runs)으로 좌/우 분리, 측면 깊이는 두 다리 공유.
//   · 골반 하단: round-cone 타원구는 축 방향으로 max(rx,rz) 만큼 뻗는다 — 가랑이 아래로
//     새는 돔은 원판별 "rEmit ≤ y-crotchY" 클램프로 자른다 (가랑이 V 는 허벅지가 그린다).
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
// 계측 행 {f, sheet, part, vis} → 합성 값 시리즈 {f, v}. dir: 바깥 방향 부호(hi=+1, lo=-1).
// 시트를 믿는 조건: 그 행에서 부위가 실루엣 경계(vis)여야 하고,
//  · 수축(렌더가 시트보다 뚱뚱)은 SHRINK 까지 허용 — round-cone 타원구 돔이 데이터보다
//    부풀어 렌더되고, 그 돔을 다음 피팅이 데이터로 재흡수하는 랫칫을 여기서 끊는다.
//  · 성장(시트가 렌더보다 밖)은 GUARD 이내만 — 시트의 팔뚝·손·코 획이 렌더의 다른 부위와
//    우연히 겹치면 가시성 검사가 뚫리므로, 큰 성장은 foreign 획으로 보고 무시한다.
const GUARD = 0.015;
const SHRINK = 0.03;
const compose = (rows, dir) => rows.map(r => {
  if (!r.vis) return { f: r.f, v: r.part };
  const shrink = (r.part - r.sheet) * dir; // + = 렌더가 시트보다 밖 (살 빼야 함)
  const v = shrink >= 0 ? (shrink <= SHRINK ? r.sheet : r.part - dir * SHRINK)
    : (-shrink <= GUARD ? r.sheet : r.part);
  return { f: r.f, v };
});
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
// median(3) — 한 행짜리 스파이크(팔·손 획이 가드를 뚫은 행) 제거. 이동 평균은 스파이크를
// 이웃으로 번지게 하므로 반드시 median 을 먼저 — 잔물결이 음영(법선)에 그대로 뜬다 (교훈).
const medFilt3 = arr => arr.map((v, i) => {
  const w = [arr[i - 1], v, arr[i + 1]].filter(x => x != null).sort((a, b) => a - b);
  return w[w.length >> 1];
});
const smoothSeries = arr => movAvg3(medFilt3(arr));
// 시트 윤곽 추적 — 깨끗한 앵커 행(fStart, 최외곽 획=몸 윤곽인 행)에서 시작해 행별로
// 이전 위치에 가장 가까운 획 가장자리를 따라간다. 팔·손이 envelope 을 오염시키는 대역에서
// "몸" 윤곽을 준다 (선화 윤곽은 행 간 연속 — 8mm 초과 점프는 오염 행으로 보고 건너뜀).
// dir=+1: +x 쪽 윤곽, -1: -x 쪽. 반환: {f, v}[] (f 오름차순, lerpAt 호환).
function traceContour(V, fStart, fEnd, dir) {
  const s2w = px => V.axisWorld + (px - V.cxSheet) * V.mPerPx * V.sgn;
  const stepF = Math.sign(fEnd - fStart) / V.sheetH;
  const out = [];
  let prev = null;
  for (let f = fStart; (fEnd - f) * Math.sign(stepF) > 0; f += stepF) {
    const y = Math.round(V.sheetTop + f * V.sheetH);
    const row = V.runs.find(r => r.y === y);
    if (!row || !row.runs.length) continue;
    const rw = row.runs.map(([s, e]) => [s2w(s), s2w(e)].sort((a, b) => a - b))
      .filter(([s, e]) => (dir > 0 ? e : -s) > 0.02) // 몸 중심 반대쪽 획 제외
      .sort((a, b) => a[0] - b[0]);
    if (!rw.length) continue;
    // 획의 "윤곽 위치": 안쪽 가장자리 + 획 굵기(≤5mm) — 손목 획이 윤곽에 합류해 한 덩어리가
    // 된 행(폭 2cm+)에서 바깥 가장자리를 쓰면 손 폭이 몸에 얹힌다
    const pos = ([s, e]) => (dir > 0 ? Math.min(e, s + 0.005) : Math.max(s, e - 0.005));
    let x;
    if (prev == null) {
      // 앵커: 최외곽 획 — 단 몸 윤곽일 수 없는 중앙 근처 획(안쪽 윤곽선)이면 보류
      x = pos(dir > 0 ? rw[rw.length - 1] : rw[0]);
      if (Math.abs(x) < 0.09) continue;
    } else {
      const cands = rw.filter(([s, e]) => Math.min(Math.abs(s - prev), Math.abs(e - prev)) <= 0.012);
      if (!cands.length) continue; // 점프 — 윤곽 끊김/오염 행 (원판은 보간)
      // 안쪽 후보 우선 — 팔·손 획은 항상 몸 윤곽보다 바깥에 있다
      x = pos(dir > 0 ? cands[0] : cands[cands.length - 1]);
    }
    prev = x;
    out.push({ f: +f.toFixed(4), v: x });
  }
  return out.sort((a, b) => a.f - b.f);
}
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
// =========================