// ============================================================================
// 시각 검증 (feature-0020 — 동면 생명체 저해상도 갱신) — "관측 밖에도 시간이 흐른다"를 스크린샷으로 굳힌다.
//
// 동면 데모 서버(demo-control.mjs, scene 'dormant', 관측 게이트 ON)를 띄우고 실제 뷰어(client/)를 연다.
// 같은 잔고(900)로 시작한 두 야생 생명체 — '머문 자'(시야 안, 매 틱 대사)와 '다녀온 자'(시야 밖, 동면 +
// 군집 저해상도 대사). 두 시점을 캡처:
//   1) 관전 시작 — 머문 자만 보인다(다녀온 자는 시야 밖 = relevancy, 0016). 잔고 ~900.
//   2) 귀환(4패스 뒤) — 다녀온 자가 시야로 돌아오면 **두 잔고 막대가 거의 같다**(±수 틱 양자).
//      구 0016 의 완전 정지였다면 다녀온 자만 900 그대로 = 눈에 띄게 더 길었을 것.
// "아무도 안 볼 때도 세계는 같은 속도로 흐른다(시간 등가 D-1)"가 상시 재현된다(불변 원칙 ①).
//
// 사용: npm run shot:dormant   (산출: tools/shots/dormant-*.png)
// 필요: playwright-core(devDependency) + 사전 설치 크로미움(클라우드). 결과는 언제든 재현.
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8099;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hits = globSync(join(base, 'chromium-*/chrome-linux/chrome'));
  if (!hits.length) throw new Error(`크로미움을 찾지 못했다: ${base}/chromium-*/chrome-linux/chrome`);
  return hits.sort().reverse()[0];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = startDemoServer({ port: PORT, scene: 'dormant' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=관전자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 머문 자(x=700)와 귀환 자리(x=1300)가 다 들어오게 줌아웃한다.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 260);

// 뷰어 미러에서 야생 생명체들의 잔고를 seq 순으로 읽는다 — [머문 자, 다녀온 자].
async function readout() {
  return page.evaluate(() => {
    const st = window.__hkt.state;
    const wild = [...st.creatures.values()].filter((c) => !c.owner).sort((a, b) => a.seq - b.seq);
    return { creatures: wild.map((c) => ({ seq: c.seq, bal: c.balance })), total: st.worldTotal };
  });
}

// 1) 관전 시작 — 머문 자만 보인다(다녀온 자는 시야 밖 = 스냅샷에 없음). 잔고 ~900.
await sleep(1200);
await page.screenshot({ path: join(OUT, 'dormant-1-before.png') });
console.log('📸 dormant-1-before.png — 머문 자만 보인다(다녀온 자는 관측 밖에서 동면 중)', await readout());

// 2) 귀환 — returnTick(130틱=13초, 저해상도 패스 4회) 뒤 다녀온 자가 시야로 돌아온다.
//    두 잔고 막대가 거의 같다: 머문 자 ~900−3×틱, 다녀온 자 ~900−96×패스 — 시간 등가.
await sleep(14000);
await page.screenshot({ path: join(OUT, 'dormant-2-return.png') });
const after = await readout();
console.log('📸 dormant-2-return.png — 귀환: 두 잔고가 거의 같다(관측 밖에도 같은 시간이 흘렀다)', after);
if (after.creatures.length >= 2) {
  const [stay, back] = after.creatures;
  const gap = Math.abs(stay.bal - back.bal);
  console.log(`   머문 자=${stay.bal} · 다녀온 자=${back.bal} · 차이=${gap} (완전 정지였다면 다녀온 자는 900 그대로 — 차이 ~${900 - stay.bal})`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
