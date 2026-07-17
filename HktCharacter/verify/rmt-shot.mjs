// ===========================================================================
//  HktCharacter · rmt-shot — 환경 스캐터 육안 검증 캡처 (Chromium 필요)
//
//  실행: npm run verify:rmt:shot   (vite dev 서버를 전용 포트로 직접 띄운다)
//  산출: verify/out/shot-{rmt,uniform}-{view,top}.png
//   · view — 기본 카메라 (캐릭터 + 환경)
//   · top  — 조감(버드아이) — 배치 패턴(반발 vs 뭉침)이 한눈에 보인다
//  Chromium 경로는 HKT_VERIFY_BROWSER 로 재지정 가능 (기본 /opt/pw-browsers/chromium/*).
// ===========================================================================
import { chromium } from 'playwright-core';
import { createServer } from 'vite';
import { mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'verify', 'out');
mkdirSync(OUT, { recursive: true });

function findChromium() {
  if (process.env.HKT_VERIFY_BROWSER) return process.env.HKT_VERIFY_BROWSER;
  const base = '/opt/pw-browsers';
  for (const d of readdirSync(base)) {
    if (!d.startsWith('chromium')) continue;
    for (const cand of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome']) {
      try {
        const p = join(base, d, cand);
        readdirSync(dirname(p)); // 존재 확인
        if (readdirSync(dirname(p)).includes(cand.split('/').pop())) return p;
      } catch { /* 다음 후보 */ }
    }
  }
  throw new Error('Chromium 을 찾지 못했습니다 — HKT_VERIFY_BROWSER 로 지정하세요');
}

const server = await createServer({ root: ROOT, server: { port: 5199, strictPort: true } });
await server.listen();

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--use-angle=swiftshader', '--no-sandbox'], // SW WebGL — GPU 없는 컨테이너용
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', e => console.error('페이지 오류:', e.message));
await page.goto('http://localhost:5199/');
// 캐릭터 로드 + 대기 재생까지 (status 문자열로 판정)
await page.waitForFunction(() => /준비됨/.test(document.getElementById('status').textContent), null, { timeout: 60000 });
await page.waitForTimeout(600); // 몇 프레임 렌더

async function shots(tag) {
  // 기본 뷰
  await page.screenshot({ path: join(OUT, `shot-${tag}-view.png`) });
  // 조감 뷰 — 배치 패턴 확인용 (안개는 잠시 끈다 — 워시아웃 방지)
  await page.evaluate(() => {
    const { cam, scene } = window.__hkt;
    scene.userData.__fog = scene.fog; scene.fog = null;
    cam.position.set(0, 22, 0.01);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(OUT, `shot-${tag}-top.png`) });
  // 카메라·안개 복원
  await page.evaluate(() => {
    const { cam, scene } = window.__hkt;
    scene.fog = scene.userData.__fog;
    cam.position.set(0.4, 1.5, 4.4);
  });
  await page.waitForTimeout(150);
}

await shots('rmt'); // 기본 모드 = RMT
await page.evaluate(() => document.getElementById('btnEnvRand').click());
await page.waitForTimeout(400);
await shots('uniform');

await browser.close();
await server.close();
console.log('📷 캡처 4장 저장:', OUT);
