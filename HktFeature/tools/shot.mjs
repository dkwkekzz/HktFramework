// ============================================================================
// 시각 검증 (feature-0010 step2) — 헤드리스 크로미움으로 제조(craft)를 스크린샷으로 굳힌다.
//
// 제조 데모 서버(tools/demo-control.mjs, scene 'craft')를 띄우고 실제 브라우저 뷰어(client/)를 열어 세
// 시점을 캡처한다: 제조 욕구를 가진 생명체가 붙어 놓인 **두 재료(raw, 회색 점선 옥타)**로 다가가 하나의
// **산물(✦제조, 선명·굵은 외곽)**으로 조합한다(tx [제조] 생명체→심우주·국소장). "새 욕구(제조)를 얹으면
// 엔진 무수정으로 실행된다 — 재료를 조합해 산출한다"가 눈으로 확인된다(욕망은 확장의 근간).
//
// 사용: npm run shot   (산출: tools/shots/craft-*.png)
// 필요: playwright-core(devDependency) + 사전 설치된 크로미움(클라우드 환경). 결과는 언제든 재현.
// ============================================================================

import { chromium } from 'playwright-core';
import { globSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { startDemoServer } from './demo-control.mjs';

const PORT = 8099;
const OUT = fileURLToPath(new URL('./shots/', import.meta.url));
mkdirSync(OUT, { recursive: true });

// 사전 설치된 크로미움 실행 파일을 찾는다(playwright 관리 경로). 버전 폴더는 글롭으로.
function chromePath() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  const hits = globSync(join(base, 'chromium-*/chrome-linux/chrome'));
  if (!hits.length) throw new Error(`크로미움을 찾지 못했다: ${base}/chromium-*/chrome-linux/chrome`);
  return hits.sort().reverse()[0];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = startDemoServer({ port: PORT, scene: 'craft' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 무대가 화면 가로축(y=1250)에 넓게 벌어져 있어(밥 x600 ~ 먹이 x1900) 양끝이 다 들어오게 줌아웃한다.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 300); // 줌아웃 — 생명체 출발점과 재료(조합 지점)가 프레임에 든다

const shots = [
  { t: 800,  name: 'craft-1-materials', note: '재료 — 붙어 놓인 두 재료(회색 점선 옥타 ⋯날것)와 내 생명체(금색 고리, ▸제조). 재료는 반응에 면역이라 흩어지지 않는다' },
  { t: 2400, name: 'craft-2-approach',  note: '수행 — 제조 욕구가 재료(조합 지점)로 표적선을 그리며 다가간다(이동=국소장 소산)' },
  { t: 4500, name: 'craft-3-product',   note: '산출 — 두 재료가 하나의 산물(✦제조, 선명·굵은 외곽)로 조합됐다(tx [제조] 생명체→심우주·국소장). 개수 2→1' },
];
let prev = 0;
for (const s of shots) {
  await sleep(s.t - prev); prev = s.t;
  const path = join(OUT, `${s.name}.png`);
  await page.screenshot({ path });
  // 관측값도 함께 찍어 캡션에 쓴다(권위 아님, 표시용 미러). 결정 개수·산물(crafted) 여부를 본다.
  const info = await page.evaluate(() => {
    const st = window.__hkt.state;
    let cre = null;
    for (const c of st.creatures.values()) if (c.owner === st.playerId) cre = c;
    const crys = [...st.crystals.values()];
    const product = crys.find(c => c.crafted);
    return {
      cre: cre ? { bal: cre.balance, desire: cre.desire, x: cre.x, y: cre.y } : null,
      nCrystals: crys.length, nRaw: crys.filter(c => c.raw).length, nCrafted: crys.filter(c => c.crafted).length,
      productSpecies: product?.species, total: st.worldTotal, sink: st.worldSink,
    };
  });
  console.log(`📸 ${s.name}.png — ${s.note}`);
  console.log(`   생명체=(${info.cre?.x},${info.cre?.y}) 잔고 ${info.cre?.bal} 욕구 ${info.cre?.desire} · 결정 ${info.nCrystals}(날것 ${info.nRaw}·산물 ${info.nCrafted}) · 총합 ${info.total?.toLocaleString()} · 심우주 ${info.sink?.toLocaleString()}`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
