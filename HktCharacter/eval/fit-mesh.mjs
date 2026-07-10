// ===========================================================================
//  HktCharacter · fit-mesh — 정점 메시의 시트 잔차를 측정해 보정 데이터 생성
//
//  시트 측면 뷰와 정점 메시 렌더 측면 뷰의 행별 앞/뒤 경계를 비교해, 몸통 체인의
//  측면 프로파일 보정량(df/db, m)을 `src/meshfit.js` 에 굽는다. 투영(=SDF 어휘)
//  이 못 담는 시트 곡선(가슴 라인·등 곡률·두상 측면)을 정점 단계에서 직접 스냅.
//
//  실행:  node eval/fit-mesh.mjs          (측정 → 기존 보정과 합성 → 파일 갱신)
//  검증:  HKT_EVAL_MESH=1 npm run eval    (측면 지표 개선 확인)
//
//  대역 규칙 (fit-loft 과 같은 이유 — 시트의 팔·손 획이 몸 윤곽을 가린다):
//    · 앞(+z) 보정: f ≤ 0.40 (그 아래는 손이 허벅지 앞을 가림 — handBand)
//    · 뒤(−z) 보정: f ≤ 0.62 (등~둔부 — 후면 라인은 팔에 안 가린다)
//  보정은 ±2cm 클램프 + 이동평균 3 스무딩. 재실행하면 잔차가 기존 보정에
//  합성(compose)되어 수렴한다.
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

const F_STEP = 0.02, F_MIN = 0.03;
const DF_MAX_F = 0.40;  // 앞 보정 상한 f (handBand 시작)
const DB_MAX_F = 0.62;  // 뒤 보정 상한 f (몸통 체인 하한 근방)
const CLAMP = 0.02;     // 보정량 상한 (m)

// 기존 보정 로드 (compose 용) — 파일의 JSON 리터럴 추출
function loadExisting() {
  try {
    const m = readFileSync(OUTFILE, 'utf8').match(/export const MESH_FIT = ([\s\S]*?);\s*$/);
    return JSON.parse(m[1]);
  } catch { return { torso: { rows: [] } }; }
}
const interpRows = (rows, y) => {
  if (!rows.length || y >= rows[0].y || y <= rows[rows.length - 1].y) return { df: 0, db: 0 };
  let i = 0; while (i + 1 < rows.length && rows[i + 1].y > y) i++;
  const a = rows[i], b = rows[i + 1], t = (a.y - y) / Math.max(a.y - b.y, 1e-6);
  return { df: a.df + (b.df - a.df) * t, db: a.db + (b.db - a.db) * t };
};

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
    h.setFleshMode(true);
    h.st.pause = true;
  });

  // ---- 시트 측면 프로파일 ----------------------------------------------------
  const refB64 = readFileSync(FIXTURE).toString('base64');
  const refP = denseProfile(await analyze(page, refB64, 'image/jpeg', CROPS.side, 'stroke'));
  // 시트 측면은 왼쪽을 본다 → 이미지 왼쪽(L) = 앞(가슴), 오른쪽(R) = 뒤(등)
  const refRowAt = f => {
    let best = null, bd = 1e9;
    for (const r of refP.rows) { if (r.L == null) continue; const d = Math.abs(r.f - f); if (d < bd) { bd = d; best = r; } }
    return bd <= 0.01 ? best : null;
  };

  // ---- 렌더 측면 프레임 → 행 경계 --------------------------------------------
  await page.evaluate(() => new Promise(res => {
    const h = window.__hkt; h.st.az = Math.PI / 2; h.st.pause = false;
    requestAnimationFrame(() => requestAnimationFrame(() => { h.st.pause = true; res(); }));
  }));
  const canvas = await page.$('#app canvas');
  const renB64 = (await canvas.screenshot()).toString('base64');
  const renP = denseProfile(await analyze(page, renB64, 'image/png', null, 'skin'));
  const renRowAt = f => {
    let best = null, bd = 1e9;
    for (const r of renP.rows) { if (r.L == null) continue; const d = Math.abs(r.f - f); if (d < bd) { bd = d; best = r; } }
    return bd <= 0.01 ? best : null;
  };

  // ---- 픽셀 → 월드 (측면 az=π/2 → x=0 평면) ----------------------------------
  const toWorld = pts => page.evaluate(pts => pts.map(([x, y]) => window.__hkt.screenToWorld(x, y, 'x')), pts);
  // 렌더 이미지의 어느 쪽이 +z(정면)인지 판정
  const midRen = renRowAt(0.3);
  const [wl, wr] = await toWorld([[midRen.L, renP.top + 0.3 * (renP.bot - renP.top)], [midRen.R, renP.top + 0.3 * (renP.bot - renP.top)]]);
  const leftIsFront = wl[2] > wr[2]; // world z 비교
  // 신장 스케일: 시트 정규화 반폭(px/H) → 미터
  const [wTop, wBot] = await toWorld([[380, renP.top], [380, renP.bot]]);
  const H_WORLD = wTop[1] - wBot[1];
  console.log(`렌더 방향: 이미지 ${leftIsFront ? '왼쪽' : '오른쪽'}=앞(+z) · 신장 ${H_WORLD.toFixed(3)}m`);

  // ---- 몸 축 (신뢰 행 공통 집합 — evaluate 와 같은 정식) ----------------------
  const relF = refP.rows.filter(r => r.reliable && r.f > 0.1 && r.f < 0.9).map(r => r.f);
  const near = (f, set) => set.some(g => Math.abs(g - f) <= 0.01);
  const refAxisPx = (() => {
    const cs = refP.rows.filter(r => r.L != null && near(r.f, relF)).map(r => (r.L + r.R) / 2);
    return cs.reduce((s, v) => s + v, 0) / cs.length;
  })();
  const renAxisRows = renP.rows.filter(r => r.L != null && near(r.f, relF));
  const renAxisPts = await toWorld(renAxisRows.map(r => [(r.L + r.R) / 2, renP.top + r.f * (renP.bot - renP.top)]));
  const renAxisZ = renAxisPts.reduce((s, p) => s + p[2], 0) / renAxisPts.length;

  // ---- 행별 잔차 측정 ---------------------------------------------------------
  const raw = [];
  for (let f = F_MIN; f <= DB_MAX_F; f += F_STEP) {
    const rr = refRowAt(f), nr = renRowAt(f);
    if (!rr || !nr || !rr.reliable) continue;
    const ypx = renP.top + nr.f * (renP.bot - renP.top);
    const [wL, wR] = await toWorld([[nr.L, ypx], [nr.R, ypx]]);
    const renFront = (leftIsFront ? wL[2] : wR[2]) - renAxisZ;   // m
    const renBack = renAxisZ - (leftIsFront ? wR[2] : wL[2]);    // m (양수)
    const refFront = (refAxisPx - rr.L) / refP.H * H_WORLD;      // 시트: 왼쪽=앞
    const refBack = (rr.R - refAxisPx) / refP.H * H_WORLD;
    const clamp = v => Math.max(-CLAMP, Math.min(CLAMP, v));
    raw.push({
      f: +f.toFixed(3), y: wL[1],
      df: f <= DF_MAX_F ? clamp(refFront - renFront) : 0,
      db: clamp(refBack - renBack),
    });
  }
  // 스무딩: 이동평균 2회(≈삼각 창 5) + 행간 기울기 제한 — 보정이 행마다 급변하면
  // 정면 렌더에 가로 "선반" 밴드가 생긴다 (가슴 밑·턱 대역 교훈).
  const MAXG = 0.005; // 이웃 행(Δf=0.02)당 허용 변화량 (m)
  let sm = raw;
  for (let pass = 0; pass < 2; pass++) {
    sm = sm.map((r, i) => {
      const nb = [sm[i - 1], r, sm[i + 1]].filter(Boolean);
      const avg = k => nb.reduce((s, v) => s + v[k], 0) / nb.length;
      return { ...r, df: avg('df'), db: avg('db') };
    });
  }
  for (const k of ['df', 'db']) {
    for (let i = 1; i < sm.length; i++) sm[i][k] = Math.max(sm[i - 1][k] - MAXG, Math.min(sm[i - 1][k] + MAXG, sm[i][k]));
    for (let i = sm.length - 2; i >= 0; i--) sm[i][k] = Math.max(sm[i + 1][k] - MAXG, Math.min(sm[i + 1][k] + MAXG, sm[i][k]));
  }
  sm = sm.map(r => ({ ...r, df: +r.df.toFixed(4), db: +r.db.toFixed(4) }));

  // ---- 기존 보정과 합성 → 파일 갱신 (--reset: 기존 보정 무시하고 새로 시작) -----
  const old = process.argv.includes('--reset') ? { torso: { rows: [] } } : loadExisting();
  const rows = sm.map(r => {
    const o = interpRows(old.torso?.rows ?? [], r.y);
    return { y: +r.y.toFixed(4), df: +(r.df + o.df).toFixed(4), db: +(r.db + o.db).toFixed(4) };
  }).sort((a, b) => b.y - a.y); // y 내림차순 (fleshmesh interp 계약)
  const header = readFileSync(OUTFILE, 'utf8').match(/^([\s\S]*?)export const MESH_FIT/)[1];
  writeFileSync(OUTFILE, header + 'export const MESH_FIT = ' + JSON.stringify({ torso: { rows } }) + ';\n');

  const mae = k => sm.reduce((s, r) => s + Math.abs(r[k]), 0) / Math.max(sm.length, 1);
  console.log(`측정 행 ${sm.length}개 · 이번 잔차 |df| 평균 ${(mae('df') * 1000).toFixed(1)}mm · |db| 평균 ${(mae('db') * 1000).toFixed(1)}mm`);
  console.log(`갱신: ${OUTFILE} (rows ${rows.length}) — HKT_EVAL_MESH=1 npm run eval 로 검증할 것`);
} finally {
  await browser.close();
  server.proc?.kill();
}
