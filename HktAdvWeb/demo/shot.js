// =====================================================================
// 헤드리스 캡처 (step D2/D3 등록) — 브라우저 없으면 스킵+경고 (실패 아님)
// ---------------------------------------------------------------------
// (Design-StepPlan §10 — shot 부재가 npm test 를 깨지 않게 한다)
// =====================================================================

// 등록된 캡처 목록 (브라우저가 있을 때 각각 방사형/별자리 뷰를 캡처).
const SHOTS = [
  { id: 'radial', desc: 'D2 절편 그래프 방사형 뷰 — 발견 상태 4값(확인/추정/미발견/반증)' },
  { id: 'constellation', desc: 'D3 별자리 지도 — 2갈래 동시 파문 순간' },
];

async function main() {
  let playwright = null;
  try {
    playwright = await import('playwright');
  } catch {
    console.warn('[shot] 헤드리스 브라우저(playwright)가 없다 — 캡처를 스킵한다 (경고, 실패 아님).');
    for (const s of SHOTS) console.warn(`  · 미캡처: ${s.id} — ${s.desc}`);
    process.exit(0);
  }
  // 브라우저가 있으면 demo 서버를 띄우고 각 뷰를 캡처한다.
  const { startServer } = await import('./server.js');
  const srv = await startServer(0);
  try {
    const browser = await playwright.chromium.launch();
    const page = await browser.newPage({ viewport: { width: 720, height: 720 } });
    await page.goto(`${srv.url}/`, { waitUntil: 'networkidle' });
    for (const s of SHOTS) {
      const el = await page.$(`#canvas-${s.id}`);
      if (el) { await el.screenshot({ path: `shot-${s.id}.png` }); console.log(`[shot] 캡처: shot-${s.id}.png — ${s.desc}`); }
      else console.warn(`[shot] 캔버스 #canvas-${s.id} 없음 — 스킵`);
    }
    await browser.close();
  } finally {
    await srv.close();
  }
  process.exit(0);
}

main();
