// ===========================================================================
//  HktCharacter · fit-mesh — 정점 메시의 시트 잔차를 측정해 보정 데이터 생성 (v3)
//
//  시트와 정점 메시 렌더의 행별 경계를 비교해 보정량(m)을 `src/meshfit.js` 에
//  굽는다. ⚠ 렌더 측 계측은 반드시 **픽셀**(eval 과 같은 스킨 검출) — 메시 기하
//  extents 를 직접 쓰면 어두운 면(등쪽 림라이트)의 검출 편차(~1cm)가 잔차로
//  둔갑한다 (교훈 — 기하 기반 v2 는 전 지표를 후퇴시켰다). 시트·렌더를 같은
//  방식으로 재면 검출 편향이 차분에서 상쇄된다.
//
//  보정 커버리지 (시트의 팔·손 가림 대역 규칙 — fit-loft 와 같은 이유):
//    · torso df/db : 측면 앞(f≤0.40 — handBand 위)/뒤(f≤0.62) 프로파일
//    · torso dx    : 정면 머리 폭 (f≤0.14 — 어깨 전이 행 아래로 내려가면
//                    목 링을 어깨 폭으로 오인해 붕괴한다)
//    · leg df/db   : 측면 다리 프로파일 (f 0.60~0.96 — 손 대역 아래)
//    · leg dxo/dxi : 정면 다리 바깥/안쪽 경계 — 시트·렌더 양쪽 행 잉크/스킨
//                    구간(runs)으로 로브 분리, 양 다리 평균. Left(+x) 기준 부호.
//
//  실행:  node eval/fit-mesh.mjs   (측정 → 기존 보정과 합성 → 파일 갱신)
//  초기화: src/meshfit.js 의 rows 를 [] 로 되돌린 뒤 2회 실행 (compose 수렴)
//  검증:  HKT_EVAL_MESH=1 npm run eval
//
//  보정은 ±2cm 클램프 + 이동평균 2회 + 행간 5mm 기울기 제한 — 행마다 급변하면
//  정면 렌더에 가로 "선반" 밴드가 생긴다 (교훈).
// ===========================================================================
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CROPS, findChromium, ensureServer, analyze, denseProfile } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FIXTURE = join(ROOT, 'eval', 'fixtures', 'reference-sheet.jpeg');
const OUTFILE = join(ROOT, 'src', 'meshfit.js');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;

const F_STEP = 0.02, CLAMP = 0.02, MAXG = 0.005;
// 머리 폭 dx 는 목 대역(f≤0.18)까지 — flood 차단 후 목 링이 실제 목이 되어 시트 목 폭과
// 비교가 성립한다 (침수 시절엔 어깨 웹 링이라 f 0.14 에서 잘랐다). 어깨 전이(f 0.19+)는 금지.
const TORSO_F = [0.03, 0.62], DF_MAX_F = 0.40, HEAD_DX_F = 0.18;
const LEG_F = [0.60, 0.96];

// ---- 파일 IO / 시리즈 유틸 ---------------------------------------------------
function loadExisting() {
  try {
    const m = readFileSync(OUTFILE, 'utf8').match(/export const MESH_FIT = ([\s\S]*?);\s*$/);
    const o = JSON.parse(m[1]);
    return { torso: o.torso ?? { rows: [] }, leg: o.leg ?? { rows: [] } };
  } catch { return { torso: { rows: [] }, leg: { rows: [] } }; }
}
const interpRow = (rows, y, keys) => {
  const z = Object.fromEntries(keys.map(k => [k, 0]));
  if (!rows.length || y >= rows[0].y || y <= rows[rows.length - 1].y) return z;
  let i = 0; while (i + 1 < rows.length && rows[i + 1].y > y) i++;
  const a = rows[i], b = rows[i + 1], t = (a.y - y) / Math.max(a.y - b.y, 1e-6);
  for (const k of keys) z[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t;
  return z;
};
// 스무딩(이동평균 2회) + 행간 기울기 제한 + 클램프 — 키별 독립
function refine(rows, keys) {
  let sm = rows;
  for (let p = 0; p < 2; p++) {
    sm = sm.map((r, i) => {
      const nb = [sm[i - 1], r, sm[i + 1]].filter(Boolean);
      const o = { ...r };
      for (const k of keys) o[k] = nb.reduce((s, v) => s + v[k], 0) / nb.length;
      return o;
    });
  }
  for (const k of keys) {
    for (let i = 1; i < sm.length; i++) sm[i][k] = Math.max(sm[i - 1][k] - MAXG, Math.min(sm[i - 1][k] + MAXG, sm[i][k]));
    for (let i = sm.length - 2; i >= 0; i--) sm[i][k] = Math.max(sm[i + 1][k] - MAXG, Math.min(sm[i + 1][k] + MAXG, sm[i][k]));
    for (const r of sm) r[k] = +Math.max(-CLAMP, Math.min(CLAMP, r[k])).toFixed(4);
  }
  return sm;
}

// ---- 행 구간(runs) 분석 — 시트(선화 stroke)·렌더(스킨) 공용, 다리 로브 분리용 --
const analyzeRuns = (page, b64, mime, crop, mode) => page.evaluate(async ({ b64, mime, crop, mode }) => {
  const img = new Image();
  await new Promise(res => { img.onload = res; img.src = `data:${mime};base64,` + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const { x0, x1, y0, y1 } = crop ?? { x0: 0, x1: img.width, y0: 0, y1: img.height };
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const hit = (x, y) => {
    const i = (y * c.width + x) * 4;
    if (mode === 'stroke') return (d[i] + d[i + 1] + d[i + 2]) / 3 < 185;
    return d[i] > 130 && d[i] > d[i + 2] * 1.35;
  };
  const rows = [];
  for (let y = y0; y < y1; y++) {
    const runs = []; let s = -1;
    for (let x = x0; x <= x1; x++) {
      const on = x < x1 && hit(x, y);
      if (on && s < 0) s = x;
      else if (!on && s >= 0) {
        if (runs.length && s - runs[runs.length - 1][1] <= 3) runs[runs.length - 1][1] = x - 1;
        else runs.push([s, x - 1]);
        s = -1;
      }
    }
    rows.push({ y, runs });
  }
  return rows;
}, { b64, mime, crop, mode });

// ---- 본체 ---------------------------------------------------------------------
const server = await ensureServer(ROOT, PORT);
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 1080 } });
  page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exitCode = 1; });
  await page.goto(server.url + '/?paused=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hkt, null, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
    const h = window.__hkt;
    h.setPreset('reference');
    h.st.clip = 'apose'; h.st.speed = 0; h.st.dist = 3.4; h.st.el = 0.0;
    h.st.pause = true;
    h.setFleshMode(true);
  });
  const refB64 = readFileSync(FIXTURE).toString('base64');
  const toWorld = (pts, plane) => page.evaluate(({ pts, plane }) => pts.map(([x, y]) => window.__hkt.screenToWorld(x, y, plane)), { pts, plane });
  const rowAt = (p, f) => {
    let best = null, bd = 1e9;
    for (const r of p.rows) { if (r.L == null) continue; const d = Math.abs(r.f - f); if (d < bd) { bd = d; best = r; } }
    return bd <= 0.01 ? best : null;
  };
  const sheetCx = p => {
    const rel = p.rows.filter(r => r.reliable && r.f > 0.1 && r.f < 0.9 && r.L != null);
    return rel.reduce((s, r) => s + (r.L + r.R) / 2, 0) / rel.length;
  };
  // 뷰 캡처: az 반영 프레임 1장 → 렌더 dense + (선택) runs + 픽셀 축·앵커 월드 변환
  const capture = async (az, plane, coord, wantRuns) => {
    await page.evaluate(az => new Promise(res => {
      const h = window.__hkt; h.st.az = az; h.st.pause = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { h.st.pause = true; res(); }));
    }), az);
    const canvas = await page.$('#app canvas');
    const b64 = (await canvas.screenshot()).toString('base64');
    const p = denseProfile(await analyze(page, b64, 'image/png', null, 'skin'));
    const v = { p, ypx: f => p.top + f * (p.bot - p.top) };
    if (wantRuns) v.runs = await analyzeRuns(page, b64, 'image/png', null, 'skin');
    return v;
  };

  // ---- 측면: torso df/db + leg df/db ------------------------------------------
  // (시트 측면은 왼쪽을 본다 → 이미지 L=앞, R=뒤. 렌더 방향은 월드 z 로 판정.)
  const refSide = denseProfile(await analyze(page, refB64, 'image/jpeg', CROPS.side, 'stroke'));
  const cxSide = sheetCx(refSide);
  const REN_S = await capture(Math.PI / 2, 'x', 2);
  const midR = rowAt(REN_S.p, 0.3);
  const [wl0, wr0, wTop, wBot] = await toWorld([
    [midR.L, REN_S.ypx(0.3)], [midR.R, REN_S.ypx(0.3)], [380, REN_S.p.top], [380, REN_S.p.bot]], 'x');
  const leftIsFront = wl0[2] > wr0[2];
  const crownY = wTop[1], toeY = wBot[1], H_WORLD = crownY - toeY;
  const mPerPxS = H_WORLD / refSide.H;
  const yOf = f => crownY - f * H_WORLD;
  console.log(`신장 ${H_WORLD.toFixed(3)}m · 렌더 측면: 이미지 ${leftIsFront ? '왼쪽' : '오른쪽'}=앞`);
  // 렌더 픽셀 축 (시트 신뢰 행과 같은 f 집합 — 검출 편향까지 포함된 실루엣 중심)
  const relFSide = refSide.rows.filter(r => r.reliable && r.f > 0.1 && r.f < 0.9).map(r => r.f);
  const near = (f, set) => set.some(g => Math.abs(g - f) <= 0.01);
  const axRowsS = REN_S.p.rows.filter(r => r.L != null && near(r.f, relFSide));
  const axPtsS = await toWorld(axRowsS.map(r => [(r.L + r.R) / 2, REN_S.ypx(r.f)]), 'x');
  const renAxisZ = axPtsS.reduce((s, p) => s + p[2], 0) / axPtsS.length;
  // 측면 행 잔차 — torso/leg 대역 공용. ⚠ screenToWorld 는 "현재 카메라"를 쓴다 —
  // 정면 캡처로 az 를 바꾸기 전, 측면 캡처 직후 여기서 전부 선계산한다 (교훈:
  // 뷰 전환 후 변환하면 잔차가 미터 단위 쓰레기가 된다).
  const sideRes = new Map();
  {
    const fs = [];
    for (let f = TORSO_F[0]; f <= TORSO_F[1] + 1e-9; f += F_STEP) fs.push(+f.toFixed(3));
    for (let f = LEG_F[0]; f <= LEG_F[1] + 1e-9; f += F_STEP) fs.push(+f.toFixed(3));
    for (const f of fs) {
      const rr = rowAt(refSide, f), nr = rowAt(REN_S.p, f);
      if (!rr?.reliable || !nr) continue;
      const [wL, wR] = await toWorld([[nr.L, REN_S.ypx(nr.f)], [nr.R, REN_S.ypx(nr.f)]], 'x');
      const renF = (leftIsFront ? wL[2] : wR[2]) - renAxisZ;
      const renB = renAxisZ - (leftIsFront ? wR[2] : wL[2]);
      sideRes.set(f, {
        df: (cxSide - rr.L) * mPerPxS - renF,
        db: (rr.R - cxSide) * mPerPxS - renB,
      });
    }
  }
  const sideResidual = f => sideRes.get(+f.toFixed(3)) ?? null;

  // ---- 정면: torso 머리 dx + leg dxo/dxi ---------------------------------------
  const refFront = denseProfile(await analyze(page, refB64, 'image/jpeg', CROPS.front, 'stroke'));
  const refRunsF = await analyzeRuns(page, refB64, 'image/jpeg', CROPS.front, 'stroke');
  const cxFront = sheetCx(refFront);
  const mPerPxF = H_WORLD / refFront.H;
  const REN_F = await capture(0, 'z', 0, true);
  const axRowsF = REN_F.p.rows.filter(r => {
    const f = r.f; return r.L != null && f > 0.1 && f < 0.9;
  });
  const axPtsF = await toWorld(axRowsF.map(r => [(r.L + r.R) / 2, REN_F.ypx(r.f)]), 'z');
  const renAxisX = axPtsF.reduce((s, p) => s + p[0], 0) / axPtsF.length;
  // 시트 다리 로브: envelope(dense) + 잉크 구간 → { outerDist, innerDist } (양 다리 평균)
  const sheetLobesAt = f => {
    const dr = rowAt(refFront, f);
    const row = refRunsF.find(r => r.y === Math.round(refFront.top + f * refFront.H));
    if (!dr?.reliable || !row) return null;
    const s2w = px => (px - cxFront) * mPerPxF;
    const rw = row.runs.map(([s, e]) => [s2w(s), s2w(e)].sort((a, b) => a - b));
    const sides = [];
    for (const sg of [+1, -1]) {
      const outer = sg > 0 ? s2w(dr.R) : -s2w(dr.L);
      const straddle = rw.find(([s, e]) => s <= 0 && e >= 0);
      const own = rw.filter(([s, e]) => (sg > 0 ? s : -e) > 0.005).sort((a, b) => sg * (a[0] - b[0]));
      let inner;
      if (straddle) inner = 0;
      else if (own.length >= 2) inner = sg > 0 ? own[0][1] : -own[0][0];
      else return null;
      if (outer <= inner + 0.01) return null;
      sides.push({ outer, inner: Math.max(inner, 0) });
    }
    return { outer: (sides[0].outer + sides[1].outer) / 2, inner: (sides[0].inner + sides[1].inner) / 2 };
  };
  // 렌더 다리 로브: 스킨 구간 — 다리 대역은 구간 1(붙음)~2개(로브)
  const renLobesAt = async f => {
    const row = REN_F.runs.find(r => r.y === Math.round(REN_F.ypx(f)));
    if (!row || !row.runs.length || row.runs.length > 2) return null;
    const pts = row.runs.flatMap(([s, e]) => [[s, row.y], [e, row.y]]);
    const w = (await toWorld(pts, 'z')).map(p => p[0] - renAxisX);
    if (row.runs.length === 1) {
      const [a, b] = [Math.min(w[0], w[1]), Math.max(w[0], w[1])];
      return { outer: (b - a) / 2 + Math.abs((a + b) / 2), inner: 0 }; // 붙은 두 다리 → inner 0
    }
    const iv = [[w[0], w[1]].sort((a, b) => a - b), [w[2], w[3]].sort((a, b) => a - b)];
    const plus = iv.find(([s]) => s > -0.02), minus = iv.find(([, e]) => e < 0.02);
    if (!plus || !minus) return null;
    return { outer: (plus[1] + -minus[0]) / 2, inner: (Math.max(plus[0], 0) + Math.max(-minus[1], 0)) / 2 };
  };

  // ---- torso 잔차 -------------------------------------------------------------
  const torsoRaw = [];
  for (let f = TORSO_F[0]; f <= TORSO_F[1] + 1e-9; f += F_STEP) {
    const row = { y: +yOf(f).toFixed(4), df: 0, db: 0, dx: 0 };
    const sr = sideResidual(f);
    if (sr) { if (f <= DF_MAX_F) row.df = sr.df; row.db = sr.db; }
    if (f <= HEAD_DX_F) { // 머리 폭 — 대칭 절반 (민머리 소체라 머리카락 오염 없음)
      const rr = rowAt(refFront, f), nr = rowAt(REN_F.p, f);
      if (rr?.reliable && nr) {
        const [wL, wR] = await toWorld([[nr.L, REN_F.ypx(nr.f)], [nr.R, REN_F.ypx(nr.f)]], 'z');
        row.dx = ((rr.R - rr.L) / 2) * mPerPxF - Math.abs(wR[0] - wL[0]) / 2;
      }
    }
    torsoRaw.push(row);
  }

  // ---- leg 잔차 (양 다리 평균 — Left(+x) 기준 부호) -----------------------------
  const legRaw = [];
  for (let f = LEG_F[0]; f <= LEG_F[1] + 1e-9; f += F_STEP) {
    const row = { y: +yOf(f).toFixed(4), df: 0, db: 0, dxo: 0, dxi: 0 };
    const sr = sideResidual(f);
    if (sr) { row.df = sr.df; row.db = sr.db; }
    const sl = sheetLobesAt(f), rl = await renLobesAt(f);
    if (sl && rl) {
      row.dxo = sl.outer - rl.outer;
      row.dxi = sl.inner - rl.inner;
    }
    legRaw.push(row);
  }

  // ---- 스무딩·클램프 → 기존 보정과 합성 → 파일 갱신 ----------------------------
  const old = loadExisting();
  const finish = (raw, keys, oldRows) => refine(raw, keys).map(r => {
    const o = interpRow(oldRows, r.y, keys);
    const out = { y: r.y };
    for (const k of keys) out[k] = +(r[k] + o[k]).toFixed(4);
    return out;
  }).sort((a, b) => b.y - a.y);
  const data = {
    torso: { rows: finish(torsoRaw, ['df', 'db', 'dx'], old.torso.rows) },
    leg: { rows: finish(legRaw, ['df', 'db', 'dxo', 'dxi'], old.leg.rows) },
  };
  const header = readFileSync(OUTFILE, 'utf8').match(/^([\s\S]*?)export const MESH_FIT/)[1];
  writeFileSync(OUTFILE, header + 'export const MESH_FIT = ' + JSON.stringify(data) + ';\n');

  const mae = (raw, k) => (raw.reduce((s, r) => s + Math.abs(r[k]), 0) / Math.max(raw.length, 1) * 1000).toFixed(1);
  console.log(`torso ${torsoRaw.length}행 — 잔차 |df| ${mae(torsoRaw, 'df')} |db| ${mae(torsoRaw, 'db')} |dx| ${mae(torsoRaw, 'dx')} mm`);
  console.log(`leg   ${legRaw.length}행 — 잔차 |df| ${mae(legRaw, 'df')} |db| ${mae(legRaw, 'db')} |dxo| ${mae(legRaw, 'dxo')} |dxi| ${mae(legRaw, 'dxi')} mm`);
  console.log(`갱신: ${OUTFILE} — HKT_EVAL_MESH=1 npm run eval 로 검증할 것`);
} finally {
  await browser.close();
  server.proc?.kill();
}
