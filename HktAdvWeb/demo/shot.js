// =====================================================================
// 헤드리스 캡처 (step A1 자리 — 본격 캡처는 D2 부터 등록)
// ---------------------------------------------------------------------
// 환경에 헤드리스 브라우저가 없으면 스킵하고 경고한다. 실패로 처리하지 않는다.
// (Design-StepPlan §10 — shot 부재가 npm test 를 깨지 않게 한다)
// =====================================================================

async function main() {
  let playwright = null;
  try {
    playwright = await import('playwright');
  } catch {
    console.warn('[shot] 헤드리스 브라우저(playwright)가 없다 — 캡처를 스킵한다 (경고, 실패 아님).');
    process.exit(0);
  }
  // Phase A 에는 아직 등록된 캡처가 없다 (첫 캡처는 D2 방사형 뷰).
  console.warn('[shot] 등록된 캡처 없음 — Phase D 에서 방사형/별자리 뷰 캡처가 추가된다.');
  void playwright;
  process.exit(0);
}

main();
