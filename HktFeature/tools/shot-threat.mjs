// ============================================================================
// 시각 검증 (feature-0012 step3) — 헤드리스 크로미움으로 **위협→회피**를 스크린샷으로 굳힌다.
//
// 위협 데모(tools/demo-control.mjs, scene 'threat')를 띄운다: 내 생명체(금색 고리) 곁에 큰 포식자(위협)가 있으면
// 회피 감정을 스스로 만들어 **도망친다**. 시간이 지나면 위협에서 멀어진 걸 캡처한다 — "상황(위협)이 감정을
// 만들고 감정이 행동(회피)을 정한다"가 눈으로 보인다(외부 주입 없이).
//
// 사용: npm run shot:threat   (산출: tools/shots/threat-*.png)
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8095;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hits = globSync(join(base, 'chromium-*/chrome-linux/chrome'));
  if (!hits.length) throw new Error(`크로미움을 찾지 못했다: ${base}/chromium-*/chrome-linux/chrome`);
  return hits.sort().reverse()[0];
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = startDemoServer({ port: PORT, scene: 'threat' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 240);

// 내 생명체와 포식자의 거리를 시작/종료로 잰다 — 회피로 멀어진다.
const gap = () => page.evaluate(() => {
  const st = window.__hkt.state;
  let mine = null, pred = null;
  for (const c of st.creatures.values()) { if (c.owner === st.playerId) mine = c; else if (c.size >= 4) pred = c; }
  if (!mine || !pred) return null;
  return Math.round(Math.hypot(mine.x - pred.x, mine.y - pred.y));
});
let d0 = null;
for (let i = 0; i < 40 && d0 === null; i++) { d0 = await gap(); if (d0 === null) await sleep(50); } // 첫 스냅샷 도착까지(측정 준비)
await sleep(2600); // 회피가 여러 걸음 도망칠 시간
const d1 = await gap();
const path = join(OUT, 'threat-1-flee.png');
await page.screenshot({ path });
console.log(`📸 threat-1-flee.png — 위협→회피: 포식자와의 거리 ${d0} → ${d1} (감정이 스스로 생겨 도망쳤다)`);

await browser.close();
server.close();
console.log(`완료 → ${OUT}`);
