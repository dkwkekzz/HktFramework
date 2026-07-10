// ===========================================================================
//  HktCharacter · 프로파일 자동 최적화 (Evaluator 를 목적함수로 파라미터 탐색)
//
//  reference 프로파일의 수치(뼈 치수/반지름/flatten/subBones/extras/포즈)를
//  브라우저 상주 상태에서 실시간 변경하며, 시트 3방향 dense 라인 손실
//  (모든 신뢰 행의 좌/우 경계 오차 평균, lib.denseLoss)을 좌표 하강으로 줄인다.
//
//  실행:  node eval/optimize.mjs [--sweeps N] [--baseline]
//  출력:  eval/out/optimize-best.json (최적 파라미터 + 손실 이력)
//         --baseline 은 현재 수치의 손실/부위별 분해만 출력하고 종료.
//
//  ⚠ 결과 수치는 proportions.js 에 손으로 반영한다 (데이터 파일이 진실의 원천).
// ===========================================================================
import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CROPS, VIEWS, findChromium, ensureServer, analyze, analyzeCanvas, denseProfile, denseLoss } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out');
const FIXTURE = join(ROOT, 'eval', 'fixtures', 'reference-sheet.jpeg');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const SWEEPS = args.includes('--sweeps') ? +args[args.indexOf('--sweeps') + 1] : 2;
const BASELINE_ONLY = args.includes('--baseline');

// ---- 파라미터 스펙 ----------------------------------------------------------
// paths: 프로파일 루트 기준 경로 목록 (여러 개면 같은 값으로 동기 — flatten 평면 공유 등).
// 'rules[X].' 접두어는 match===X 인 규칙을 가리킨다.
const P = (name, paths, min, max, step) => ({ name, paths: Array.isArray(paths) ? paths : [paths], min, max, step });
const PARAMS = [
  // 골격 — 전후(z) 배치와 비례 길이
  P('spineZ0', 'skeleton.spineZ.0', -0.010, 0.045, 0.006),
  P('spineZ1', 'skeleton.spineZ.1', -0.010, 0.030, 0.006),
  P('spineZ2', 'skeleton.spineZ.2', -0.015, 0.030, 0.006),
  P('neckZ', 'skeleton.neckZ', 0.000, 0.040, 0.006),
  P('headZ', 'skeleton.headZ', -0.030, 0.020, 0.006),
  P('hipsY', 'skeleton.hipsY', 0.840, 0.920, 0.010),
  P('thighLen', 'skeleton.thighLen', 0.320, 0.400, 0.010),
  P('shinLen', 'skeleton.shinLen', 0.330, 0.400, 0.010),
  P('upperArmLen', 'skeleton.upperArmLen', 0.220, 0.280, 0.008),
  P('foreArmLen', 'skeleton.foreArmLen', 0.210, 0.270, 0.008),
  P('shoulderX', 'skeleton.shoulderX', 0.020, 0.070, 0.006),
  P('shoulderY', 'skeleton.shoulderY', 0.050, 0.100, 0.006),
  P('armX', 'skeleton.armX', 0.060, 0.120, 0.008),
  P('upLegX', 'skeleton.upLegX', 0.060, 0.100, 0.006),
  P('kneeX', 'skeleton.kneeX', 0.035, 0.070, 0.005),
  P('ankleX', 'skeleton.ankleX', 0.030, 0.060, 0.005),
  P('upLegZ', 'skeleton.upLegZ', 0.000, 0.060, 0.008),
  P('kneeZ', 'skeleton.kneeZ', 0.000, 0.060, 0.008),
  P('ankleZ', 'skeleton.ankleZ', -0.010, 0.030, 0.006),
  P('toeZ', 'skeleton.toeZ', 0.060, 0.120, 0.008),
  // 살 반지름 — loft 전환 후 남은 캡슐 경로(팔·어깨)만. 몸통·다리·두상 반지름은
  // loft 데이터(fit-loft.mjs 재피팅)가 진실의 원천이라 여기서 만지지 않는다.
  // TODO(LOFT-PLAN §8-5): 원판 반경 스케일 계수(스택별 loft.*.disks[*].rx 일괄 배율)를
  // 파라미터로 노출하려면 런타임에 스택 스케일 지원이 먼저 필요하다.
  P('r.Shoulder', 'rules[Shoulder].r', 0.020, 0.048, 0.004),
  P('r.Arm', 'rules[Arm].r', 0.020, 0.036, 0.003),
  P('r.ForeArm', 'rules[ForeArm].r', 0.016, 0.030, 0.003),
  // extras — 볼륨 헬퍼 (loft 전환 후 인덱스: 0 가슴 · 1 승모근 · 2 둔부 · 3 뒤꿈치 · 4 손바닥)
  P('breastZ', 'extras.0.b.2', 0.080, 0.115, 0.006),
  P('breastR', 'extras.0.rb', 0.045, 0.062, 0.004),
  P('buttZ', 'extras.2.b.2', -0.030, 0.000, 0.005),
  P('buttR', 'extras.2.rb', 0.050, 0.066, 0.004),
  // 포즈 (시트 A-포즈 정합)
  P('armDown', 'pose.armDown', 1.450, 1.620, 0.030),
  P('foreArmOut', 'pose.foreArmOut', 0.040, 0.300, 0.040),
  P('armFwd', 'pose.armFwd', 0.000, 0.250, 0.040),
  P('foreArmFwd', 'pose.foreArmFwd', 0.000, 0.350, 0.050),
  P('footSplay', 'pose.footSplay', 0.040, 0.300, 0.040),
];

// ---- 페이지 측 적용/조회 -----------------------------------------------------
const getValues = page => page.evaluate(paths => {
  const prof = window.__hkt.PROFILES.reference;
  const resolve = path => {
    let obj = prof, m;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if ((m = p.match(/^rules\[(.+)\]$/))) obj = prof.rules.find(r => r.match === m[1]);
      else obj = obj[p];
    }
    return [obj, parts[parts.length - 1]];
  };
  return paths.map(path => { const [o, k] = resolve(path); return o[k]; });
}, PARAMS.map(p => p.paths[0]));

const applyValues = (page, entries) => page.evaluate(entries => {
  const prof = window.__hkt.PROFILES.reference;
  const resolve = path => {
    let obj = prof, m;
    const parts = path.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if ((m = p.match(/^rules\[(.+)\]$/))) obj = prof.rules.find(r => r.match === m[1]);
      else obj = obj[p];
    }
    return [obj, parts[parts.length - 1]];
  };
  for (const { paths, value } of entries) for (const path of paths) { const [o, k] = resolve(path); o[k] = value; }
  window.__hkt.setPreset('reference'); // 골격 치수 반영 (리그 재생성)
}, entries);

// ---- 목적함수: 3방향 dense 라인 손실 -----------------------------------------
async function evalLoss(page, refProfiles) {
  let total = 0; const perView = {};
  for (const [view, az] of VIEWS) {
    // 캡처할 때만 1 프레임 렌더 (st.pause) — 소프트웨어 GL 프레임 비용 절약.
    // 별도 프레임 대기 불필요 — analyzeCanvas 가 rAF 안에서 캡처한다:
    // 앱 루프 rAF(먼저 등록)가 새 az/파라미터로 렌더한 직후, 같은 프레임에 drawImage.
    await page.evaluate(az => { const h = window.__hkt; h.st.az = az; h.st.pause = false; }, az);
    const ren = denseProfile(await analyzeCanvas(page));
    await page.evaluate(() => { window.__hkt.st.pause = true; });
    const { loss } = denseLoss(refProfiles[view], ren);
    perView[view] = +loss.toFixed(5); total += loss;
  }
  return { loss: +(total / VIEWS.length).toFixed(5), perView };
}

// ---- 본체 ---------------------------------------------------------------
const server = await ensureServer(ROOT, PORT);
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  // 작은 뷰포트 — 소프트웨어 GL 의 레이마칭 비용은 픽셀 수에 비례. 경계 양자화(±1px
  // ≈ ±0.003H)는 수백 행 평균으로 상쇄된다. 최종 판정은 evaluate.mjs(원래 해상도)로.
  const page = await browser.newPage({ viewport: { width: 240, height: 340 } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(server.url + '/?paused=1', { waitUntil: 'load' }); // 캡처 시만 렌더
  await page.waitForFunction(() => window.__hkt, null, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
    const h = window.__hkt;
    h.setPreset('reference');
    h.st.clip = 'apose'; h.st.speed = 0; h.st.dist = 3.4; h.st.el = 0.0; h.st.az = 0.0;
  });

  // 시트 기준 프로파일 (1회)
  const refB64 = readFileSync(FIXTURE).toString('base64');
  const refProfiles = {};
  for (const [view] of VIEWS) refProfiles[view] = denseProfile(await analyze(page, refB64, 'image/jpeg', CROPS[view], 'stroke'));

  const t0 = Date.now();
  let values = await getValues(page);
  let best = await evalLoss(page, refProfiles);
  console.log(`기준 손실: ${best.loss}  ${JSON.stringify(best.perView)}  (1회 계측 ${((Date.now() - t0) / 1000).toFixed(1)}s)`);

  if (BASELINE_ONLY) {
    // 부위별 분해 (side 뷰) — 어디가 어긋나는지 지도
    const ren = {}; // eslint 무마용 아님 — view 별 rows 재계측
    for (const [view, az] of VIEWS) {
      await page.evaluate(az => { const h = window.__hkt; h.st.az = az; h.st.pause = false; }, az);
      const { rows } = denseLoss(refProfiles[view], denseProfile(await analyzeCanvas(page)));
      await page.evaluate(() => { window.__hkt.st.pause = true; });
      const reg = {};
      for (const r of rows) {
        const key = r.f <= 0.20 ? '머리' : r.f <= 0.32 ? '가슴/어깨' : r.f <= 0.52 ? '허리/힙' : r.f <= 0.75 ? '허벅지/무릎' : '정강이/발';
        (reg[key] ??= []).push(Math.abs(r.lErr) + Math.abs(r.rErr));
      }
      console.log(view, Object.fromEntries(Object.entries(reg).map(([k, v]) => [k, +(v.reduce((s, x) => s + x, 0) / (2 * v.length)).toFixed(4)])));
      ren[view] = rows;
    }
    writeFileSync(join(OUT, 'optimize-baseline.json'), JSON.stringify(ren, null, 1));
    process.exit(0);
  }

  // 좌표 하강 — 파라미터마다 ±step 시도, 개선되면 같은 방향으로 연장 (최대 3보)
  const history = [{ loss: best.loss, at: 'baseline' }];
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    const scale = sweep === 0 ? 1 : 0.5;
    for (let pi = 0; pi < PARAMS.length; pi++) {
      const spec = PARAMS[pi];
      const step = spec.step * scale;
      let cur = values[pi], improved = false;
      for (const dir of [+1, -1]) {
        if (improved) break;
        for (let ext = 1; ext <= 3; ext++) {
          const cand = +Math.min(spec.max, Math.max(spec.min, cur + dir * step * ext)).toFixed(4);
          if (cand === values[pi]) break;
          await applyValues(page, [{ paths: spec.paths, value: cand }]);
          const res = await evalLoss(page, refProfiles);
          if (res.loss < best.loss - 1e-5) {
            best = res; values[pi] = cand; improved = true;
            console.log(`  ↓ ${spec.name} = ${cand}  →  ${best.loss}`);
          } else { break; }
        }
      }
      if (!improved) await applyValues(page, [{ paths: spec.paths, value: values[pi] }]); // 원복
    }
    history.push({ loss: best.loss, at: `sweep${sweep + 1}` });
    console.log(`sweep ${sweep + 1} 완료 — 손실 ${best.loss}  ${JSON.stringify(best.perView)}  (${((Date.now() - t0) / 60000).toFixed(1)}분)`);
  }

  const out = { loss: best.loss, perView: best.perView, history, params: Object.fromEntries(PARAMS.map((p, i) => [p.name, { paths: p.paths, value: values[i] }])) };
  writeFileSync(join(OUT, 'optimize-best.json'), JSON.stringify(out, null, 2));
  console.log(`최적 파라미터 저장: eval/out/optimize-best.json (손실 ${best.loss})`);
} finally {
  await browser.close();
  server.proc?.kill();
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          