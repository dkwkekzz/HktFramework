// ===========================================================================
//  HktCharacter · Evaluator 공용 로직 — evaluate.mjs(회귀 판정)와
//  optimize.mjs(프로파일 자동 최적화)가 공유한다.
// ===========================================================================
import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';

// 시트 내 각 그림의 크롭(원본 픽셀) — 좌측 텍스트/서명, 우하단 발 스케치 제외
export const CROPS = {
  front: { x0: 100, x1: 300, y0: 35, y1: 612 },
  side:  { x0: 305, x1: 470, y0: 35, y1: 612 },
  back:  { x0: 555, x1: 714, y0: 35, y1: 612 },
};
export const VIEWS = [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]];
export const MIN_REF_W = 0.03; // 시트 폭이 이보다 작은 행은 획이 끊긴 행

// ---- Chromium 실행 파일 탐색 ------------------------------------------------
export function findChromium() {
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
export async function ensureServer(root, port) {
  const probe = url => fetch(url).then(r => r.ok).catch(() => false);
  if (await probe(`http://localhost:${port}`)) return { url: `http://localhost:${port}`, proc: null };
  const proc = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore', detached: false });
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await probe(`http://localhost:${port}`)) return { url: `http://localhost:${port}`, proc };
  }
  proc.kill();
  throw new Error('vite dev 서버 기동 실패');
}

// ---- 이미지 → 행별 실루엣 [L,R] (페이지 컨텍스트의 2D 캔버스 사용) ----------
export const analyze = (page, b64, mime, crop, mode) => page.evaluate(async ({ b64, mime, crop, mode }) => {
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

// ---- 렌더 캔버스를 파일 우회 없이 직접 계측 (최적화 루프용 — 스크린샷보다 빠름) ----
// drawImage 는 rAF 콜백 안에서 실행 — 앱 루프의 rAF(먼저 등록)가 렌더한 직후,
// 같은 프레임(컴포지팅 전)에 WebGL 버퍼를 읽어야 preserveDrawingBuffer 없이 안전하다.
export const analyzeCanvas = page => page.evaluate(async () => {
  const src = document.querySelector('#app canvas');
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  await new Promise(res => requestAnimationFrame(() => { g.drawImage(src, 0, 0); res(); }));
  const d = g.getImageData(0, 0, c.width, c.height).data;
  const hit = (x, y) => { const i = (y * c.width + x) * 4; return d[i] > 130 && d[i] > d[i + 2] * 1.35; };
  const rows = []; let top = -1, bot = -1;
  for (let y = 0; y < c.height; y++) {
    let L = -1, R = -1, cnt = 0;
    for (let x = 0; x < c.width; x++) if (hit(x, y)) { if (L < 0) L = x; R = x; cnt++; }
    if (L >= 0 && cnt >= 2) { if (top < 0) top = y; bot = y; }
    rows.push({ y, L, R });
  }
  return { rows, top, bot };
});

// ---- dense 라인 프로파일: f(0~1) → {L,R} 정규화 경계 -------------------------
// 신뢰 행: 잉크가 있고, 폭이 최소치 이상이며, ±5행 중앙값 대비 급락하지 않은 행.
export function denseProfile(a) {
  const H = a.bot - a.top;
  const rows = a.rows.filter(r => r.y >= a.top && r.y <= a.bot);
  const width = r => (r.L >= 0 ? r.R - r.L + 1 : 0);
  const med = arr => { const s = [...arr].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };
  const out = []; // { f, lb, rb, reliable } — lb/rb 는 아래에서 cx 정해진 뒤 계산
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.L < 0) { out.push({ f: (r.y - a.top) / H, L: null, R: null, reliable: false }); continue; }
    const near = rows.slice(Math.max(0, i - 5), i + 6).map(width).filter(w => w > 0);
    const reliable = width(r) >= MIN_REF_W * H && width(r) >= 0.6 * med(near);
    out.push({ f: (r.y - a.top) / H, L: r.L, R: r.R, reliable });
  }
  return { H, top: a.top, bot: a.bot, rows: out };
}

// 몸 축: 신뢰 행(0.1<f<0.9) 중심 평균. refRel(f→reliable) 을 렌더에도 같은 f 집합으로.
export function denseAxis(p, isReliableF) {
  const cs = p.rows.filter(r => r.L != null && r.f > 0.1 && r.f < 0.9 && isReliableF(r.f)).map(r => (r.L + r.R) / 2);
  return cs.reduce((s, v) => s + v, 0) / Math.max(cs.length, 1);
}

// dense 라인 손실: 시트 신뢰 행마다 렌더의 같은 f 행을 찾아 좌/우 경계 오차(신장 대비)를
// 합산. 반환: { loss(평균), rows: [{f, lErr, rErr}] } — lErr/rErr 부호는 (렌더−시트).
export function denseLoss(refP, renP) {
  const relF = new Set(refP.rows.filter(r => r.reliable).map(r => Math.round(r.f * 1000)));
  const isRel = f => relF.has(Math.round(f * 1000));
  const refCx = denseAxis(refP, isRel);
  // 렌더 쪽은 f 격자가 다르므로 "가장 가까운 f 의 시트 행이 신뢰"면 축 표본에 포함
  const nearRel = f => { for (const df of [0, 1, -1, 2, -2]) if (relF.has(Math.round(f * 1000) + df)) return true; return false; };
  const renCx = denseAxis(renP, nearRel);
  const renByF = renP.rows.filter(r => r.L != null);
  const rowAt = f => { // 렌더에서 f 가 가장 가까운 행 (이진 탐색 불필요 — 행수 적음)
    let best = null, bd = 1e9;
    for (const r of renByF) { const d = Math.abs(r.f - f); if (d < bd) { bd = d; best = r; } }
    return bd <= 0.01 ? best : null;
  };
  const rows = []; let sum = 0, n = 0;
  for (const rr of refP.rows) {
    if (!rr.reliable) continue;
    const nr = rowAt(rr.f);
    if (!nr) continue;
    const lErr = ((refCx - rr.L) / refP.H - (renCx - nr.L) / renP.H) * -1; // + = 렌더가 더 왼쪽 확장
    const rErr = (nr.R - renCx) / renP.H - (rr.R - refCx) / refP.H;       // + = 렌더가 더 오른쪽 확장
    rows.push({ f: +rr.f.toFixed(3), lErr: +lErr.toFixed(4), rErr: +rErr.toFixed(4) });
    sum += Math.abs(lErr) + Math.abs(rErr); n++;
  }
  return { loss: n ? sum / (2 * n) : 1e9, rows };
}
