// ============================================================================
// 시각 검증 (feature-0010 step3 — 아바타 통합·제어 관찰성) — 헤드리스 크로미움으로 **제어**를 스크린샷으로 굳힌다.
//
// 제어 데모 서버(demo-control.mjs, scene 'control')를 띄우고 실제 뷰어(client/)를 연다. 카메라가 **내 생명체**를
// 태우고(아바타 통합), 욕구별 표적(오른쪽 결정=채집·왼쪽 재료=제조·아래 먹이=사냥)이 둘레에 있다. 세 시점을 캡처:
//   1) 채집 — 굵은 표적선(마칭앤츠)+욕구 오라를 두르고 결정으로 걸어간다("눌렀더니 저리로 간다").
//   2) 도달·수행 — 사거리에 닿아 오라가 번뜩이며 결정을 먹는다(잔고 차오름).
//   3) 사냥 전환 — 단축키 2 로 욕구를 바꾸면 표적선이 **먹이(아래)** 로 갈아탄다("다른 욕구=다른 표적·다른 행동").
// "각 욕구가 눈에 보이는 뚜렷한 현상을 만든다"가 상시 재현된다(불변 원칙 ①).
//
// 사용: npm run shot:control   (산출: tools/shots/control-*.png)
// 필요: playwright-core(devDependency) + 사전 설치 크로미움(클라우드). 결과는 언제든 재현.
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8098;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hits = globSync(join(base, 'chromium-*/chrome-linux/chrome'));
  if (!hits.length) throw new Error(`크로미움을 찾지 못했다: ${base}/chromium-*/chrome-linux/chrome`);
  return hits.sort().reverse()[0];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = startDemoServer({ port: PORT, scene: 'control' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 카메라가 생명체를 태우므로 표적(±450px)이 다 들어오게 줌아웃한다.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 260);

async function readout() {
  return page.evaluate(() => {
    const st = window.__hkt.state;
    let cre = null;
    for (const c of st.creatures.values()) if (c.owner === st.playerId) cre = c;
    return { bal: cre?.balance, desire: cre?.desire, size: cre?.size, total: st.worldTotal, sink: st.worldSink };
  });
}

// 1) 채집 이동
await sleep(900);
await page.screenshot({ path: join(OUT, 'control-1-forage-approach.png') });
console.log('📸 control-1-forage-approach.png — 채집 욕구: 굵은 표적선+오라를 두르고 결정으로 이동', await readout());

// 2) 도달·수행(먹기)
await sleep(3200);
await page.screenshot({ path: join(OUT, 'control-2-forage-eat.png') });
console.log('📸 control-2-forage-eat.png — 사거리 도달: 오라 번뜩이며 결정을 먹는다(잔고↑)', await readout());

// 3) 사냥으로 전환 — 단축키 2(main.js keydown → hunt). 표적선이 아래 먹이로 갈아탄다.
await canvas.click();          // 캔버스에 포커스(키 입력 수신)
await page.keyboard.press('Digit2');
await sleep(1500);
await page.screenshot({ path: join(OUT, 'control-3-hunt-switch.png') });
console.log('📸 control-3-hunt-switch.png — 사냥 전환: 표적선이 먹이로 갈아타고 다가간다', await readout());

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
