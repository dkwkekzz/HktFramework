// ===========================================================================
//  HktCharacter · Evaluator — 레퍼런스 시트 대비 실루엣 자동 검증
//
//  캐릭터 시트(eval/fixtures/reference-sheet.jpeg)의 정면/측면/후면 그림에서
//  실루엣 폭 프로파일(신장 대비 폭, 정수리=0 → 발끝=1)을 추출하고,
//  reference 프리셋 렌더(정적 A-포즈, 같은 3방향)를 같은 방식으로 계측해
//  행별 오차를 판정한다. 오버레이 PNG(eval/out/)도 함께 생성 — 눈 검증용.
//
//  실행:  npm run eval   (dev 서버가 없으면 전용 포트로 vite 를 직접 띄운다)
//  판정 지표 (신뢰 행 = 시트 획이 뚜렷한 행 기준):
//    · 폭      : 행별 실루엣 폭(R-L)/H — MAE ≤ 0.025 · 최대 ≤ 0.06
//    · 중심선  : 행별 centroid 의 몸 축 대비 오프셋 — MAE ≤ 0.015 · 최대 ≤ 0.045
//                (폭만 보면 자세가 안 잡힌다 — 머리 전방 이동/굽은 등이 여기서 걸린다)
//    · 머리 경계: 상단 f ≤ 0.20 행의 좌/우 경계를 "각각" 비교 — 최대 ≤ 0.05
//                (폭이 같아도 뒤통수 부재·턱선 방향 차이는 좌우 비대칭으로 나타난다)
//  브라우저: playwright-core 가 Chromium 을 못 찾으면 HKT_EVAL_BROWSER 로 지정.
//
//  ⓘ harness 매핑에서 이 파일이 Evaluator — 프로파일(genome+grammar) 변경이
//    스타일(=시트 비율)을 깨뜨렸는지 정량 회귀로 잡는다.
// ===========================================================================
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CROPS, VIEWS, MIN_REF_W, findChromium, ensureServer, analyze } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out');
const FIXTURE = join(ROOT, 'eval', 'fixtures', 'reference-sheet.jpeg');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
mkdirSync(OUT, { recursive: true });

// 계측 높이(정수리=0 → 발끝=1)와 판정 임계값 — 공용 크롭/분석은 lib.mjs
const FRACS = []; for (let f = 0.04; f <= 0.985; f += 0.03) FRACS.push(+f.toFixed(3));
const MAE_MAX = 0.025;    // [폭] 신뢰 행 평균 절대 오차 한도 (신장 대비)
const ERR_MAX = 0.06;     // [폭] 신뢰 행 단일 최대 오차 한도
const C_MAE_MAX = 0.015;  // [중심선] 행 centroid 오프셋 평균 오차 한도 — 자세(굽은 등) 회귀
const C_ERR_MAX = 0.045;  // [중심선] 단일 최대 오차 한도
const HEAD_F_MAX = 0.20;  // [머리 경계] 이 높이(정수리 기준)까지를 머리 구간으로 본다
const HEAD_ERR_MAX = 0.05;// [머리 경계] 좌/우 경계 각각의 단일 최대 오차 한도 — 뒤통수/턱선 회귀
// [목 폭] 목 대역은 이웃 어깨 행 대비 폭 급감으로 reliableSet 의 dropout 규칙에 걸려
// 일반 지표가 영원히 안 본다 — 목이 사라져도 PASS 하는 회귀 구멍(교훈). 전용 검사로 막는다.
// 정면/후면만 (측면 목은 턱·뒤통수와 겹쳐 행 폭이 목이 아니다). f 0.18+ 는 어깨 전이라 제외.
// ⚠ 판정 게이트는 정점 메시 모드(HKT_EVAL_MESH)에서만 — SDF 경로는 목·승모근 웹이 어깨
// 경사선을 만드는 알려진 타협(레거시)이라 보고만 한다.
const NECK_F = [0.145, 0.175];
const NECK_ERR_MAX = 0.04; // 목 폭 단일 최대 오차 한도

// f 위치의 행 측정값(픽셀) — 폭/중심/경계. 몸 축(cx)은 여기서 정하지 않는다:
// 시트의 획 끊긴 행이 중심을 오염시키므로, 비교 단계에서 "신뢰 행" 기준으로
// 양 이미지에 같은 행 집합을 써서 산출한다 (그래야 중심선 오프셋이 공정하다).
function profile(a) {
  const H = a.bot - a.top, rowAt = {};
  for (const f of FRACS) {
    const y = Math.round(a.top + f * H);
    const r = a.rows.find(r => r.y === y);
    rowAt[f] = r && r.L >= 0 ? r : null;
  }
  const prof = {}, cpx = {}, Lpx = {}, Rpx = {};
  for (const f of FRACS) {
    const r = rowAt[f];
    prof[f] = r ? +((r.R - r.L + 1) / H).toFixed(3) : null; // 폭/신장
    cpx[f] = r ? (r.L + r.R) / 2 : null;                    // 행 중심 (px)
    Lpx[f] = r ? r.L : null; Rpx[f] = r ? r.R : null;
  }
  return { H, prof, cpx, Lpx, Rpx, cx: NaN, top: a.top, bot: a.bot };
}

// 신뢰 행 판정 (시트 폭 기준 — 렌더와 무관하게 시트만 본다)
function reliableSet(refP) {
  const set = new Set();
  for (let i = 0; i < FRACS.length; i++) {
    const f = FRACS[i], a = refP.prof[f];
    if (a == null) continue;
    const near = [refP.prof[FRACS[i - 1]], refP.prof[FRACS[i + 1]]].filter(v => v != null);
    const dropout = near.length > 0 && a < 0.65 * Math.max(...near);
    if (a >= MIN_REF_W && !dropout) set.add(f);
  }
  return set;
}

// 몸 축: 신뢰 행(0.1<f<0.9) 의 행 중심 평균 — 양 이미지에 "같은 행 집합" 적용
function bodyAxis(p, reliable) {
  const cs = FRACS.filter(f => reliable.has(f) && f > 0.1 && f < 0.9 && p.cpx[f] != null).map(f => p.cpx[f]);
  return cs.reduce((s, v) => s + v, 0) / cs.length;
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
const server = await ensureServer(ROOT, PORT);
const browser = await chromium.launch({ executablePath: findChromium() });
let failed = false;
try {
  // HKT_EVAL_VP=WxH — 소프트웨어 GL 환경용 축소 뷰포트 (레이마칭 비용 ∝ 픽셀 수).
  // 경계 양자화 ±1px ≈ ±0.003H 노이즈가 생기니 최종 판정은 기본 해상도로.
  const vp = (process.env.HKT_EVAL_VP ?? '760x1080').split('x').map(Number);
  const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
  page.on('pageerror', e => { console.error('[pageerror]', e.message); failed = true; });
  await page.goto(server.url + '/?paused=1', { waitUntil: 'load' }); // 로드 직후 프레임 정지 (뷰 캡처 시만 렌더)
  await page.waitForFunction(() => window.__hkt, null, { timeout: 60000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
    const h = window.__hkt;
    h.setPreset('reference');
    // 'apose' 는 미정의 클립 → 회전 없이 pose 파라미터만 적용된 정적 A-포즈 (계측 결정론)
    h.st.clip = 'apose'; h.st.speed = 0; h.st.dist = 3.4; h.st.el = 0.0; h.st.az = 0.0;
    h.st.pause = true; // 뷰 캡처 직전에만 프레임을 렌더 (소프트웨어 GL 비용 절약)
  });
  // HKT_EVAL_MESH=1 — 정점 메시 살 층으로 계측 (빌드는 동기 — 반환 시 완료)
  if (process.env.HKT_EVAL_MESH) await page.evaluate(() => window.__hkt.setFleshMode(true));

  const refB64 = readFileSync(FIXTURE).toString('base64');
  // HKT_EVAL_VIEWS=front,side — 뷰 분할 실행 (호출당 시간 제한이 있는 CI 용).
  // report.json 은 부분 실행 시 기존 내용에 병합한다.
  const only = process.env.HKT_EVAL_VIEWS ? process.env.HKT_EVAL_VIEWS.split(',') : null;
  let report = {};
  try { if (only) report = JSON.parse(readFileSync(join(OUT, 'report.json'), 'utf8')); } catch { /* 새로 시작 */ }
  for (const [view, az] of VIEWS) {
    if (only && !only.includes(view)) continue;
    await page.evaluate(() => { window.__hkt.st.pause = true; }); // 시트 분석은 렌더 불필요
    const refP = profile(await analyze(page, refB64, 'image/jpeg', CROPS[view], 'stroke'));
    // az 반영 프레임을 정확히 1장만 렌더하고 다시 멈춘다 — 소프트웨어 GL 프레임 비용 절약
    await page.evaluate(az => new Promise(res => {
      const h = window.__hkt; h.st.az = az; h.st.pause = false;
      requestAnimationFrame(() => requestAnimationFrame(() => { h.st.pause = true; res(); }));
    }), az);
    const shot = join(OUT, `render-${view}.png`);
    // 소프트웨어 GL 환경(CI 등)은 프레임이 수 초 걸린다 — 타임아웃 넉넉히
    await page.screenshot({ path: shot, timeout: 180000 });
    const renB64 = readFileSync(shot).toString('base64');
    const renP = profile(await analyze(page, renB64, 'image/png', null, 'skin'));

    // 몸 축을 "신뢰 행" 기준으로 양 이미지에 동일 산출 — 획 끊긴 행이 축을 오염 못 하게
    const reliable = reliableSet(refP);
    refP.cx = bodyAxis(refP, reliable);
    renP.cx = bodyAxis(renP, reliable);
    const rows = [];
    let sum = 0, n = 0, worst = 0;          // 폭
    let cSum = 0, cWorst = 0;               // 중심선 오프셋
    let hWorst = 0, hN = 0;                 // 머리 좌/우 경계
    let nWorst = 0, nN = 0;                 // 목 폭 (dropout �