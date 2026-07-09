// ============================================================================
// 시각 검증 (feature-0012 step2) — 헤드리스 크로미움으로 욕구의 자율 감정을 스크린샷으로 굳힌다.
//
// 자율 감정 데모 서버(tools/demo-control.mjs, scene 'appraise')를 띄우고 실제 브라우저 뷰어(client/)를
// 열어 세 시점을 캡처한다: **감정을 밖에서 싣지 않았는데도**, 굶주린 생명체가 식사·사냥을 품되(배지
// ▸식사♥ · ·사냥) 굶주림(차이)이 스스로 만든 식사 감정으로 **왼쪽 밥**으로 가 먹고, 배부르면 그 감정이
// 감쇠해 **사냥**으로 넘어간다 — "차이는 신호다: 상황이 감정을 만들고 감정이 행동을 정한다"가 눈으로 확인된다.
//
// 사용: npm run shot   (산출: tools/shots/appraise-*.png)
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

const server = startDemoServer({ port: PORT, scene: 'appraise' });
await new Promise((r) => server.httpServer.listen(PORT, r));

const browser = await chromium.launch({ executablePath: chromePath() });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`http://localhost:${PORT}/?name=조종자`);
await page.waitForFunction(() => window.__hkt?.state?.playerId, null, { timeout: 8000 });

// 무대가 화면 가로축(y=1250)에 넓게 벌어져 있어(밥 x600 ~ 먹이 x1900) 양끝이 다 들어오게 줌아웃한다.
const canvas = page.locator('#game');
await canvas.hover();
await page.mouse.wheel(0, 520); // 줌아웃 — 밥(왼쪽 끝)·먹이(오른쪽 끝)·두 생명체가 모두 프레임에 든다

const shots = [
  { t: 900,  name: 'appraise-1-split',  note: '나란히 — 같은 스택(식사1·사냥2)을 품은 두 생명체가 상황만 다르다. 굶주린 쪽 ▸식사♥(승자=식사), 포만한 쪽 ▸사냥(승자=사냥)' },
  { t: 2400, name: 'appraise-2-diverge',note: '자율 분기 — 감정을 밖에서 안 실었는데도 굶주린 개체는 왼쪽 밥으로, 포만한 개체는 오른쪽 먹이로 스스로 갈라져 간다(차이가 방향을 정한다)' },
  { t: 4600, name: 'appraise-3-sated',   note: '포만 감쇠 — 밥을 다 먹어 배부른 개체는 식사 감정이 0 으로 감쇠, 저도 사냥(▸사냥)으로 넘어간다(다음 욕구). 상황이 바뀌자 행동이 바뀐다' },
];
let prev = 0;
for (const s of shots) {
  await sleep(s.t - prev); prev = s.t;
  const path = join(OUT, `${s.name}.png`);
  await page.screenshot({ path });
  // 관측값도 함께 찍어 캡션에 쓴다(권위 아님, 표시용 미러). 두 생명체(굶주림·포만)를 잔고로 갈라 본다.
  const info = await page.evaluate(() => {
    const st = window.__hkt.state;
    const mine = [...st.creatures.values()].filter(c => c.owner === st.playerId).sort((a, b) => a.balance - b.balance);
    const brief = (c) => c ? { bal: c.balance, desire: c.desire, x: c.x, feel: (c.desires?.find(d => d[0] === 'eat')?.[3]) ?? 0 } : null;
    return { hungry: brief(mine[0]), full: brief(mine[mine.length - 1]), total: st.worldTotal, sink: st.worldSink };
  });
  console.log(`📸 ${s.name}.png — ${s.note}`);
  console.log(`   굶주림: 잔고 ${info.hungry?.bal} 욕구 ${info.hungry?.desire} 식사감정 ${info.hungry?.feel} x=${info.hungry?.x} · 포만: 잔고 ${info.full?.bal} 욕구 ${info.full?.desire} 식사감정 ${info.full?.feel} x=${info.full?.x} · 총합 ${info.total?.toLocaleString()}`);
}

await browser.close();
server.close();
console.log(`\n완료 → ${OUT}`);
