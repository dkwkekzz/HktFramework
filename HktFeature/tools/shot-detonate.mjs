// ============================================================================
// 시각 검증 (feature-0013 규칙 D 자폭) — 헤드리스 크로미움으로 **생명 없이 물질이 터지는 것**을 스크린샷으로 굳힌다.
//
// 자폭 데모(tools/demo-control.mjs, scene 'detonate')를 띄운다: 관전자 곁에 이따금 **과충전 결정**(임계 초과)이
// 나타나 **스스로 폭발**하며(캐스터 없음), blind AoE 로 곁의 생명을 친다. 폭발은 순간이라(1틱) 결정 자체보다
// tx 피드의 `[폭발] I:… → 심우주/국소장`(결정이 터져 방출)과 곁 생명이 얻어맞는 흐름으로 확인된다.
// "폭발의 주인은 물질이다 — 파이어볼(생명이 쏜 폭탄)만이 아니라 과충전 결정도 터진다"가 눈으로 보인다.
//
// 사용: npm run shot:detonate   (산출: tools/shots/detonate-*.png)
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8096;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hits = globSync(join(base, 'chromium-*/chrome-linux/chrome'));
  if (!hits.length) throw new Error(`크로미움을 찾지 못했다: ${base}/chromium-*/chrome-linux/chrome`);
  return hits.sort().reverse()[0];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = startDemoServer({ port: PORT, scene: 'detonate' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=관전자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 200);

// 몇 차례 자폭이 일어나 tx 피드가 [폭발] 로 차오를 때까지 기다린 뒤 캡처한다.
await sleep(2600);
const path = join(OUT, 'detonate-1-selfblast.png');
await page.screenshot({ path });
const info = await page.evaluate(() => {
  const st = window.__hkt.state;
  return { total: st.worldTotal, sink: st.worldSink, creatures: st.creatures.size };
});
console.log(`📸 detonate-1-selfblast.png — 과충전 결정이 생명 없이 자폭(tx 피드 [폭발] I:→심우주/국소장) · 생명 ${info.creatures}기 · 총합 ${info.total?.toLocaleString?.() ?? info.total}`);

await browser.close();
server.close();
console.log(`완료 → ${OUT}`);
