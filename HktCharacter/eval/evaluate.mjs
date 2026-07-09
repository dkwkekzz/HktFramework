// ===========================================================================
//  HktCharacter · Evaluator — 레퍼런스 시트 대비 실루엣 자동 검증
//
//  캐릭터 시트(eval/fixtures/reference-sheet.jpeg)의 정면/측면/후면 그림에서
//  실루엣 폭 프로파일(신장 대비 폭, 정수리=0 → 발끝=1)을 추출하고,
//  reference 프리셋 렌더(정적 A-포즈, 같은 3방향)를 같은 방식으로 계측해
//  행별 오차를 판정한다. 오버레이 PNG(eval/out/)도 함께 생성 — 눈 검증용.
//
//  실행:  npm run eval   (dev 서버가 없으면 전용 포트로 vite 를 직접 띄운다)
//  판정:  신뢰 행(시트 획이 뚜렷한 행) 기준 MAE ≤ 0.025 · 최대 오차 ≤ 0.06
//  브라우저: playwright-core 가 Chromium 을 못 찾으면 HKT_EVAL_BROWSER 로 지정.
//
//  ⓘ harness 매핑에서 이 파일이 Evaluator — 프로파일(genome+grammar) 변경이
//    스타일(=시트 비율)을 깨뜨렸는지 정량 회귀로 잡는다.
// ===========================================================================
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out');
const FIXTURE = join(ROOT, 'eval', 'fixtures', 'reference-sheet.jpeg');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
mkdirSync(OUT, { recursive: true });

// 시트 내 각 그림의 크롭(원본 픽셀) — 좌측 텍스트/서명, 우하단 발 스케치 제외
const CROPS = {
  front: { x0: 100, x1: 300, y0: 35, y1: 612 },
  side:  { x0: 305, x1: 470, y0: 35, y1: 612 },
  back:  { x0: 555, x1: 714, y0: 35, y1: 612 },
};
const VIEWS = [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]];
// 계측 높이(정수리=0 → 발끝=1)와 판정 임계값
const FRACS = []; for (let f = 0.04; f <= 0.985; f += 0.03) FRACS.push(+f.toFixed(3));
const MIN_REF_W = 0.03;   // 시트 폭이 이보다 작은 행은 획이 끊긴 행 → 판정 제외
const MAE_MAX = 0.025;    // 신뢰 행 평균 절대 오차 한도 (신장 대비)
const ERR_MAX = 0.06;     // 신뢰 행 단일 최대 오차 한도

// ---- Chromium 실행 파일 탐색 ------------------------------------------------
function findChromium() {
  if (process.env.HKT_EVAL_BROWSER) return process.env.HKT_EVAL_BROWSER;
  try { const p = chromium.executablePath(); if (p && existsSync(p)) return p; } catch { /* 아래 폴백 */ }
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const d of readdirSync(root)) {
      for (const rel of [join('chrome-linux', 'headless_shell'), join('chrome-linux', 'chrome'), 'chromium']) {
        const p = join(root, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  throw new Error('Chromium 실행 파일을 찾지 못했습니다 — 환경변수 HKT_EVAL_BROWSER 로 지정하세요.');
}

// ---- dev 서버 확보 (없으면 전용 포트로 vite 기동) ---------------------------
async function ensureServer() {
  const probe = url => fetch(url).then(r => r.ok).catch(() => false);
  if (await probe(`http://localhost:${PORT}`)) return { url: `http://localhost:${PORT}`, proc: null };
  const proc = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore', detached: false });
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await probe(`http://localhost:${PORT}`)) return { url: `http://localhost:${PORT}`, proc };
  }
  proc.kill();
  throw new Error('vite dev 서버 기동 실패');
}

// ---- 이미지 → 행별 실루엣 [L,R] (페이지 컨텍스트의 2D 캔버스 사용) ----------
const analyze = (page, b64, mime, crop, mode) => page.evaluate(async ({ b64, mime, crop, mode }) => {
  const img = new Image();
  await new Promise(res => { img.onload = res; img.src = `data:${mime};base64,` + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const { x0, x1, y0, y1 } = crop ?? { x0: 0, x1: img.width, y0: 0, y1: img.height };
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const hit = (x, y) => {
    const i = (y * c.width + x) * 4;
    if (mode === 'stroke') return (d[i] + d[i + 1] + d[i + 2]) / 3 < 185; // 시트: 진한 선화 픽셀
    return d[i] > 130 && d[i] > d[i + 2] * 1.35;                          // 렌더: 스킨 픽셀
  };
  const rows = []; let top = -1, bot = -1;
  for (let y = y0; y < y1; y++) {
    let L = -1, R = -1, cnt = 0;
    for (let x = x0; x < x1; x++) if (hit(x, y)) { if (L < 0) L = x; R = x; cnt++; }
    if (L >= 0 && cnt >= 2) { if (top < 0) top = y; bot = y; }
    rows.push({ y, L, R });
  }
  return { rows, top, bot };
}, { b64, mime, crop, mode });

// f 위치의 폭/신장 비 + 수평 중심(오버레이 정렬용)
function profile(a) {
  const H = a.bot - a.top, prof = {}, centers = [];
  for (const f of FRACS) {
    const y = Math.round(a.top + f * H);
    const r = a.rows.find(r => r.y === y);
    prof[f] = r && r.L >= 0 ? +((r.R - r.L + 1) / H).toFixed(3) : null;
    if (r && r.L >= 0 && f > 0.1 && f < 0.9) centers.push((r.L + r.R) / 2);
  }
  return { H, prof, cx: centers.reduce((s, v) => s + v, 0) / centers.length, top: a.top, bot: a.bot };
}

// ---- 오버레이 PNG (시트 선화 위에 렌더 실루엣 반투명 적색) -------------------
const overlay = (page, refB64, renB64, ref, ren) => page.evaluate(async ({ refB64, renB64, ref, ren }) => {
  const load = (b64, mime) => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = `data:${mime};base64,` + b64; });
  const ri = await load(refB64, 'image/jpeg'), ni = await load(renB64, 'image/png');
  const H = 640, W = 420;
  const rs = H / (ref.bot - ref.top), ns = H / (ren.bot - ren.top);
  const c = document.createElement('canvas'); c.width = W; c.height = H + 40;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.save(); g.translate(W / 2 - ref.cx * rs, 20 - ref.top * rs); g.scale(rs, rs); g.drawImage(ri, 0, 0); g.restore();
  const cc = document.createElement('canvas'); cc.width = ni.width; cc.height = ni.height;
  const gg = cc.getContext('2d'); gg.drawImage(ni, 0, 0);
  const id = gg.getImageData(0, 0, cc.width, cc.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) {
    const skin = d[i] > 130 && d[i] > d[i + 2] * 1.35;
    d[i] = 235; d[i + 1] = 60; d[i + 2] = 60; d[i + 3] = skin ? 110 : 0;
  }
  gg.putImageData(id, 0, 0);
  g.save(); g.translate(W / 2 - ren.cx * ns, 20 - ren.top * ns); g.scale(ns, ns); g.drawImage(cc, 0, 0); g.restore();
  return c.toDataURL('image/png').split(',')[1];
}, { refB64, renB64, ref, ren });

// ---- 본체 ------------------------------------------------------------------
const server = await ensureServer();
const browser = await chromium.launch({ executablePath: findChromium() });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: 760, height: 1080 } });
  page.on('pageerror', e => { console.error('[pageerror]', e.message); failed = true; });
  await page.goto(server.url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hkt, null, { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
    const h = window.__hkt;
    h.setPreset('reference');
    // 'apose' 는 미정의 클립 → 회전 없이 pose 파라미터만 적용된 정적 A-포즈 (계측 결정론)
    h.st.clip = 'apose'; h.st.speed = 0; h.st.dist = 3.4; h.st.el = 0.0; h.st.az = 0.0;
  });
  await page.waitForTimeout(500);

  const refB64 = readFileSync(FIXTURE).toString('base64');
  const report = {};
  for (const [view, az] of VIEWS) {
    const refP = profile(await analyze(page, refB64, 'image/jpeg', CROPS[view], 'stroke'));
    await page.evaluate(az => { window.__hkt.st.az = az; }, az);
    await page.waitForTimeout(350);
    const shot = join(OUT, `render-${view}.png`);
    // 소프트웨어 GL 환경(CI 등)은 프레임이 수 초 걸린다 — 타임아웃 넉넉히
    await page.screenshot({ path: shot, timeout: 180000 });
    const renB64 = readFileSync(shot).toString('base64');
    const renP = profile(await analyze(page, renB64, 'image/png', null, 'skin'));

    const rows = [];
    let sum = 0, n = 0, worst = 0;
    for (let i = 0; i < FRACS.length; i++) {
      const f = FRACS[i];
      const a = refP.prof[f], b = renP.prof[f];
      if (a == null || b == null) continue;
      // 신뢰도: 절대 폭이 있고, 이웃 행 대비 급락하지 않은 행 (급락 = 시트 획 끊김)
      const near = [refP.prof[FRACS[i - 1]], refP.prof[FRACS[i + 1]]].filter(v => v != null);
      const dropout = near.length > 0 && a < 0.65 * Math.max(...near);
      const reliable = a >= MIN_REF_W && !dropout;
      const err = +(b - a).toFixed(3);
      rows.push({ f, ref: a, render: b, err, reliable });
      if (reliable) { sum += Math.abs(err); n++; worst = Math.max(worst, Math.abs(err)); }
    }
    const mae = +(sum / n).toFixed(4);
    const pass = mae <= MAE_MAX && worst <= ERR_MAX;
    if (!pass) failed = true;
    report[view] = { mae, worst, reliableRows: n, pass, rows };
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${view.padEnd(5)}  MAE=${mae} (≤${MAE_MAX})  max=${worst} (≤${ERR_MAX})  신뢰행 ${n}개`);

    writeFileSync(join(OUT, `overlay-${view}.png`),
      Buffer.from(await overlay(page, refB64, renB64, refP, renP), 'base64'));
  }
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n오버레이/리포트: ${OUT}`);
} finally {
  await browser.close();
  server.proc?.kill();
}
process.exit(failed ? 1 : 0);
