// ============================================================================
// 시각 검증 (feature-0018 step2) — 동기(질서)만 주고 전략(제조)은 안 준 배부른 생명체가 **스스로 제조하는** 것을
//   스크린샷으로 굳힌다(잉여 → 질서).
//
// 질서 씬(tools/demo-control.mjs, scene 'order'): 배부른 생명체 곁에 붙어 놓인 두 재료(raw). CRAFT 를 주입하지
//   않았는데도 잉여(잔고>편안 임계)가 질서 동기를 깨워 → 재료로 다가가 하나의 산물로 **조합**한다. "제조는 욕구가
//   아니라 잉여를 질서로 바꾸는 전략"이 눈으로 확인된다. (굶주리면 잉여 0 으로 질서가 잠들고 허기가 깨어 먹으러 간다 —
//   역전은 단위 테스트가 증명. 'play' 씬에서는 밥과 함께 그 순환을 직접 조작해 볼 수 있다.)
//
// 사용: npm run shot:order   (산출: tools/shots/order-*.png)
// 필요: playwright-core(devDependency) + 사전 설치된 크로미움(클라우드 환경). 결과는 언제든 재현.
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

const server = startDemoServer({ port: PORT, scene: 'order' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 220);

const shots = [
  { t: 300,  name: 'order-1-full',    note: '출발 — 배부른 생명체(잉여). 곁에 재료 쌍 무리(raw). 질서 동기(잉여) 하나만 품는다 — CRAFT 는 주입 안 함' },
  { t: 700,  name: 'order-2-craft',   note: '제조 — 질서 동기가 제조 전략을 골라 재료를 조합한다(재료↓ 산물↑). tx [제조] 생명체→심우주·국소장' },
  { t: 6000, name: 'order-3-product', note: '산물 — 잉여로 여러 산물을 빚었다. "제조는 욕구가 아니라 잉여를 질서로 바꾸는 전략"' },
];
let prev = 0;
for (const s of shots) {
  await sleep(s.t - prev); prev = s.t;
  await page.screenshot({ path: join(OUT, `${s.name}.png`) });
  const info = await page.evaluate(() => {
    const st = window.__hkt.state;
    let cre = null;
    for (const c of st.creatures.values()) if (c.owner === st.playerId) cre = c;
    const raws = [...st.crystals.values()].filter(c => c.raw && c.balance > 0).length;
    const crafted = [...st.crystals.values()].filter(c => c.crafted && c.balance > 0).length;
    return { cre: cre ? { bal: cre.balance, desire: cre.desire } : null, raws, crafted, total: st.worldTotal, sink: st.worldSink };
  });
  console.log(`📸 ${s.name}.png — ${s.note}`);
  console.log(`   생명체 잔고 ${info.cre?.bal} 수행 전략 [${info.cre?.desire}] · 재료 ${info.raws}·산물 ${info.crafted} · 총합 ${info.total?.toLocaleString()} · 심우주 ${info.sink?.toLocaleString()}`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
