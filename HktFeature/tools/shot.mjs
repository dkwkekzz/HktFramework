// ============================================================================
// 시각 검증 (feature-0010) — 헤드리스 크로미움으로 제어 명제를 스크린샷으로 굳힌다.
//
// 제어 데모 서버(tools/demo-control.mjs)를 띄우고, 실제 브라우저 뷰어(client/)를 열어
// 세 시점을 캡처한다: ① 출발(생명체 서쪽, 결정 동쪽) ② 이동 중(표적선 따라 접근)
// ③ 도달·채집(결정 잔고 감소 + tx 피드 [채집]). "욕망→이동→에너지"가 눈으로 확인된다.
//
// 사용: npm run shot   (산출: tools/shots/control-*.png)
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

const server = startDemoServer({ port: PORT });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 무대를 기본 카메라 가로축에 맞춰 배치했으므로 회전은 불필요 — 전체 이동 경로가 들어오게 살짝 줌아웃만.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 260); // 줌아웃 — 출발점·결정 양끝이 프레임에 든다

const shots = [
  { t: 700, name: 'control-1-start', note: '출발 — 내 생명체(금색 고리)와 채집 표적(결정)' },
  { t: 1500, name: 'control-2-move', note: '이동 중 — 표적선 따라 결정으로 접근(이동=국소장 소산)' },
  { t: 4000, name: 'control-3-harvest', note: '도달·채집 — 결정 흡수로 잔고 상승, tx [채집]' },
];
let prev = 0;
for (const s of shots) {
  await sleep(s.t - prev); prev = s.t;
  const path = join(OUT, `${s.name}.png`);
  await page.screenshot({ path });
  // 관측값도 함께 찍어 캡션에 쓴다(권위 아님, 표시용 미러).
  const info = await page.evaluate(() => {
    const st = window.__hkt.state;
    let cre = null;
    for (const c of st.creatures.values()) if (c.owner === st.playerId) cre = c;
    const cry = [...st.crystals.values()].sort((a, b) => b.balance - a.balance)[0];
    return { cre, cry, total: st.worldTotal, sink: st.worldSink };
  });
  const d = info.cre && info.cry ? Math.round(Math.hypot(info.cre.x - info.cry.x, info.cre.y - info.cry.y, info.cre.z - info.cry.z)) : -1;
  console.log(`📸 ${s.name}.png — ${s.note}`);
  console.log(`   생명체=(${info.cre?.x},${info.cre?.y}) 잔고 ${info.cre?.balance} · 결정 잔고 ${info.cry?.balance} · →결정 ${d}px · 총합 ${info.total?.toLocaleString()} · 심우주 ${info.sink?.toLocaleString()}`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
