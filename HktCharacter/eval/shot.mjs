// ===========================================================================
//  HktCharacter · shot — 눈 검증용 렌더 스크린샷 CLI
//
//  Evaluator 는 실루엣만 본다 — 음영(표면 곡률) 아티팩트는 렌더를 눈으로 봐야
//  잡힌다 (CLAUDE.md 교훈). 이 도구는 임의 카메라(방위/고도/거리/주시 높이)로
//  reference 프리셋 A-포즈를 찍어 eval/out/ 에 저장한다.
//
//  실행 예:
//    node eval/shot.mjs --az 0 --dist 3.4 --out front.png            # 정면 전신
//    node eval/shot.mjs --az 0.6 --el -0.15 --dist 1.6 --ty 0.75 --out hip.png   # 힙 클로즈업
//    여러 샷 한 번에: --shots '[{"az":0,"out":"a.png"},{"az":1.57,"out":"b.png"}]'
//  옵션: --az(rad) --el(rad) --dist(m) --ty(주시 y, 기본 1.0) --vp WxH(기본 300x520)
// ===========================================================================
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findChromium, ensureServer } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'eval', 'out');
const PORT = process.env.HKT_EVAL_PORT ?? 5187;
mkdirSync(OUT, { recursive: true });

const arg = (name, dflt) => {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const shots = arg('shots')
  ? JSON.parse(arg('shots'))
  : [{ az: +arg('az', 0), el: +arg('el', 0), dist: +arg('dist', 3.4), ty: +arg('ty', 1.0), out: arg('out', 'shot.png') }];

const vp = (arg('vp', '300x520')).split('x').map(Number);
const server = await ensureServer(ROOT, PORT);
const browser = await chromium.launch({ executablePath: findChromium() });
try {
  const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto(server.url + '/?paused=1', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__hkt, null, { timeout: 120000 });
  await page.evaluate(() => {
    document.querySelectorAll('.panel,.hud,.foot').forEach(el => el.style.display = 'none');
    const h = window.__hkt;
    h.setPreset('reference');
    h.st.clip = 'apose'; h.st.speed = 0;
  });
  // --mesh 1 — 정점 메시 살 층으로 촬영 · --stage rough — "찍기만 한" 단계 시각화
  if (arg('mesh')) await page.evaluate(stage => {
    window.__hkt.setFleshMode(true);
    if (stage) window.__hkt.setMeshStage(stage);
  }, arg('stage', ''));
  for (const s of shots) {
    await page.evaluate(s => {
      const h = window.__hkt;
      h.st.az = s.az ?? 0; h.st.el = s.el ?? 0; h.st.dist = s.dist ?? 3.4;
      h.target.y = s.ty ?? 1.0;
      h.st.pause = false;
    }, s);
    // 소프트웨어 GL — 설정 반영 프레임이 끝날 때까지 rAF 2회 대기
    await page.evaluate(() => new Promise(res =>
      requestAnimationFrame(() => requestAnimationFrame(res))));
    await page.evaluate(() => { window.__hkt.st.pause = true; });
    const canvas = await page.$('#app canvas');
    await canvas.screenshot({ path: join(OUT, s.out) });
    console.log('저장:', join('eval/out', s.out));
  }
} finally {
  await browser.close();
  server.proc?.kill();
}
