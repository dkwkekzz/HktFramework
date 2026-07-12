// ============================================================================
// 시각 검증 (feature-0018 step1) — 동기(허기)만 주고 전략(사냥)은 안 준 생명체가 **스스로 사냥을 고르는** 것을
//   스크린샷으로 굳힌다(사냥 재분류 = 기회의 해소).
//
// 동기 씬(tools/demo-control.mjs, scene 'motive'): 굶주린 생명체 하나 곁에 밥(멀리)·먹이(가까이). HUNT 를 주입하지
//   않았는데도 같은 허기가 값어치 큰 가까운 기회(먹이)를 골라 → 먹이로 다가가 **강탈**한다. "사냥은 욕구가 아니라
//   허기를 채우는 전략"이 눈으로 확인된다. (밥이 더 가까웠다면 같은 허기가 채집을 골랐을 것 — 단위 테스트가 대칭·포만
//   잠듦까지 증명한다.)
//
// 사용: npm run shot:motive   (산출: tools/shots/motive-*.png)
// 필요: playwright-core(devDependency) + 사전 설치된 크로미움(클라우드 환경). 결과는 언제든 재현.
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

const server = startDemoServer({ port: PORT, scene: 'motive' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 밥·먹이·생명체가 스폰 중심 둘레에 모여 있어 조금만 줌아웃하면 셋 다 프레임에 든다.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 220);

const shots = [
  { t: 800,  name: 'motive-1-start',  note: '출발 — 동기(허기) 하나만 품는다. 곁에 밥(멀리)·먹이(가까이). 아직 어느 전략도 확정 전' },
  { t: 3000, name: 'motive-2-choose', note: '선택 — 같은 허기가 값어치 큰 가까운 기회(먹이)를 골라 사냥 전략으로 먹이에 다가간다(밥은 멀어 안 고른다)' },
  { t: 6000, name: 'motive-3-sated',  note: '해소 — 강탈로 편안(임계 1000)해지자 허기가 사라져 사냥을 멈춘다(전략 none). "결핍 없으면 동기 없음" — 사냥은 허기의 전략이라 함께 잔다' },
];
let prev = 0;
for (const s of shots) {
  await sleep(s.t - prev); prev = s.t;
  await page.screenshot({ path: join(OUT, `${s.name}.png`) });
  const info = await page.evaluate(() => {
    const st = window.__hkt.state;
    let cre = null;
    for (const c of st.creatures.values()) if (c.owner === st.playerId) cre = c;
    return { cre: cre ? { x: Math.round(cre.x), y: Math.round(cre.y), bal: cre.balance, desire: cre.desire } : null, total: st.worldTotal, sink: st.worldSink };
  });
  console.log(`📸 ${s.name}.png — ${s.note}`);
  console.log(`   내 생명체 (${info.cre?.x},${info.cre?.y}) 잔고 ${info.cre?.bal} 수행 전략 [${info.cre?.desire}] · 총합 ${info.total?.toLocaleString()} · 심우주 ${info.sink?.toLocaleString()}`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
