// ============================================================================
// 시각 검증 (feature-0019 step2·3 이펙트 채널) — 헤드리스 크로미움으로 **에너지 흐름 이펙트가 실제로 그려지는 것**을
// 스크린샷으로 굳힌다. blast 씬(야생 캐스터)이 파이어볼을 쏘면(발산) 표적으로 날아가 착탄점에서 터진다(폭발).
//
// 이펙트는 순간(0.3~0.6초)이라 고정 시각 캡처로는 놓치기 쉽다 — 그래서 **렌더러의 살아있는 이펙트 목록**
// (`window.__hkt.render.fx`, feature-0019 step2·3)을 폴링해 그 순간에 캡처한다:
//   ① 발산(emission) muzzle 섬광이 뜬 순간, ② 폭발(explosion) 충격파가 뜬 순간.
// "권위 tx(발산·폭발)에서 파생한 Scene.effects 가 공간 VFX 로 그려진다"가 눈으로 확인된다.
//
// 사용: npm run shot:effects   (산출: tools/shots/effects-*.png)
// 필요: playwright-core(devDependency) + 사전 설치된 크로미움. 결과는 언제든 재현.
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8094;
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
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 220); // 줌아웃 — 캐스터·표적·착탄점이 프레임에 든다

// 렌더러의 살아있는 이펙트 목록에 특정 타입이 뜰 때까지 폴링하다 그 순간 캡처한다.
async function captureWhen(type, name, note, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const active = await page.evaluate((t) => {
      const fx = window.__hkt?.render?.fx ?? [];
      return fx.some((f) => f.type === t);
    }, type);
    if (active) {
      await page.screenshot({ path: join(OUT, `${name}.png`) });
      console.log(`📸 ${name}.png — ${note}`);
      return true;
    }
    await sleep(40);
  }
  console.log(`⚠ ${name} — ${timeoutMs}ms 안에 ${type} 이펙트를 못 잡음(재시도 권장)`);
  return false;
}

// 발산(캐스터가 파이어볼을 낳는 순간) → 폭발(착탄) 순서로 잡는다.
await captureWhen('emission', 'effects-1-emission', '발산 muzzle 섬광 — 생명체가 파이어볼(B:)을 낳는 순간(권위 tx [발산] 에서 파생)');
await captureWhen('explosion', 'effects-2-explosion', '폭발 충격파 — 파이어볼이 착탄점에서 터지는 순간(권위 tx [폭발] 에서 파생, 팽창 링+백열 플래시)');

await browser.close();
server.close();
console.log(`완료 → ${OUT}`);
