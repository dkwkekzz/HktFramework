// ============================================================================
// 시각 검증 (feature-0009) — 헤드리스 크로미움으로 **발산·비행·폭발**을 스크린샷으로 굳힌다.
//
// 폭발 데모(tools/demo-control.mjs, scene 'blast')를 띄우고 실제 브라우저 뷰어(client/)를 열어, 야생 캐스터가
// 쏜 **파이어볼(불덩이)이 표적으로 날아가는 순간**을 잡는다: 뷰어 상태의 fireballs 가 비어있지 않을 때(=비행 중)
// 즉시 캡처한다(투사체는 빠르므로 폴링으로 포착). "발산이 만든 투사체가 즉발이 아니라 날아가 착탄해 터진다"가
// 눈으로 확인된다(feature-0009 비행 = 생명의 행위 / 폭발 = 물질의 사건, 0013 규칙 D).
//
// 사용: npm run shot:blast   (산출: tools/shots/blast-*.png)
// 필요: playwright-core(devDependency) + 사전 설치된 크로미움. 결과는 언제든 재현.
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8097;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hits = globSync(join(base, 'chromium-*/chrome-linux/chrome'));
  if (!hits.length) throw new Error(`크로미움을 찾지 못했다: ${base}/chromium-*/chrome-linux/chrome`);
  return hits.sort().reverse()[0];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = startDemoServer({ port: PORT, scene: 'blast' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=관전자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 캐스터(800,1250)~표적(1250,1250)이 다 들어오게 줌아웃.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 260);
await sleep(600);

// 비행 중인 파이어볼을 잡는다 — 뷰어 상태 fireballs 가 비어있지 않은 순간을 폴링으로 포착(투사체는 빠르다).
let captured = 0;
for (let attempt = 0; attempt < 400 && captured < 2; attempt++) {
  const flying = await page.evaluate(() => (window.__hkt?.state?.fireballs?.size || 0) > 0);
  if (flying) {
    captured++;
    const path = join(OUT, `blast-${captured}-flight.png`);
    await page.screenshot({ path });
    const info = await page.evaluate(() => {
      const st = window.__hkt.state;
      const fb = [...st.fireballs.values()][0];
      return { n: st.fireballs.size, x: fb?.x, y: fb?.y, total: st.worldTotal, sink: st.worldSink };
    });
    console.log(`📸 blast-${captured}-flight.png — 파이어볼 비행 중: ${info.n}개, 선두 위치 (${info.x}, ${info.y}) · 총합 ${info.total?.toLocaleString?.() ?? info.total}`);
    await sleep(500); // 다음 발사까지 텀
  } else {
    await sleep(25);
  }
}
if (!captured) console.log('⚠ 비행 중 파이어볼을 포착하지 못했다(타이밍) — 재시도 권장');

await browser.close();
server.close();
console.log(`완료 → ${OUT}`);
