// ============================================================================
// 시각 검증 (feature-0011 step2) — 헤드리스 크로미움으로 **다단계 제조**를 스크린샷으로 굳힌다.
//
// 다단계 제조 데모 서버(tools/demo-control.mjs, scene 'craftchain')를 띄우고 실제 브라우저 뷰어(client/)를
// 열어 세 시점을 캡처한다: 제조 욕구를 가진 생명체가 붙어 놓인 **재료 넷(⋯재료)**을 둘씩 합쳐 **중간물(✦중간)**
// 둘을, 다시 그 둘을 합쳐 **완성물(✦✦완성)** 하나로 만든다(tier 0→1→2, 개수 4→2→1). "제조 절차가 다단계로
// 깊어진다 — 재료→중간물→완성물"이 눈으로 확인된다(feature-0011 절차 깊이 확장).
//
// 사용: npm run shot   (산출: tools/shots/craftchain-*.png)
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

const server = startDemoServer({ port: PORT, scene: 'craftchain' });
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
  { t: 900,  name: 'craftchain-1-materials', note: '재료 넷 — 붙어 놓인 네 재료(⋯재료, tier0)와 내 생명체(금색 고리, ▸제조). 재료는 반응에 면역이라 흩어지지 않는다' },
  { t: 3000, name: 'craftchain-2-combine', note: '조합 — 재료를 둘씩 합쳐 단계를 올린다(재료→중간물→완성물, 아래 readout 의 [재료·중간·완성] 개수로 단계 확인)' },
  { t: 6000, name: 'craftchain-3-finished', note: '완성 — 중간물 둘을 합쳐 완성물(✦✦완성, tier2) 하나로(개수 4→2→1). tx [제조] 생명체→심우주·국소장 + 결정→결정' },
];
let prev = 0;
for (const s of shots) {
  await sleep(s.t - prev); prev = s.t;
  const path = join(OUT, `${s.name}.png`);
  await page.screenshot({ path });
  // 관측값도 함께 찍어 캡션에 쓴다(권위 아님, 표시용 미러). 결정을 단계(tier)별로 세어 다단계 진행을 본다.
  const info = await page.evaluate(() => {
    const st = window.__hkt.state;
    let cre = null;
    for (const c of st.creatures.values()) if (c.owner === st.playerId) cre = c;
    const crys = [...st.crystals.values()];
    const byTier = [0, 1, 2].map(t => crys.filter(c => (c.tier ?? 0) === t).length);
    return { cre: cre ? { bal: cre.balance, desire: cre.desire } : null, n: crys.length, byTier, total: st.worldTotal, sink: st.worldSink };
  });
  console.log(`📸 ${s.name}.png — ${s.note}`);
  console.log(`   생명체 잔고 ${info.cre?.bal} 욕구 ${info.cre?.desire} · 결정 ${info.n} [재료 ${info.byTier[0]}·중간 ${info.byTier[1]}·완성 ${info.byTier[2]}] · 총합 ${info.total?.toLocaleString()} · 심우주 ${info.sink?.toLocaleString()}`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
