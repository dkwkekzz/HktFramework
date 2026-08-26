// 새로 온 것 (V-010) — UX 문서 §3 의 `NEW` 표식.
//
//     `NEW` 는 플레이어가 상세를 보거나 세션에서 명시적으로 확인하면 사라지는 View 상태다
//
// **세계의 상태가 아니다.** 세계는 누가 무엇을 이미 봤는지 기억하지 않는다. 이것은
// 겪는 사람 쪽의 사실이며 화면이 쥔다 (`selectedKind` · 찾는 말과 같은 자리다).
//
// ── 처음 본 것과 새로 온 것은 다르다 ────────────────────────────────
//
// 세계에 이어 붙는 순간 가방에는 이미 무언가 들어 있다. 그것을 전부 `NEW` 로 세우면
// 표식은 "방금 얻었다" 가 아니라 "가방에 무언가 있다" 가 되고, 그러면 아무 말도 하지
// 않는 것과 같다. 그래서 **첫 관찰은 기준선이다** — 그때 있던 것은 새 것이 아니다.
// 획득 토스트가 처음 본 값에 뜨지 않는 것과 같은 규칙이다 (기반의 celebrationText).

/** 이미 알고 있는 종류들 — 첫 관찰에서 채워지고, 상세를 본 것이 여기 더해진다 */
const known = new Set<string>();
/** 지금 표식이 붙어 있는 종류들 */
const fresh = new Set<string>();
/** 아직 한 번도 관찰을 보지 못했는가 — 첫 관찰이 기준선이 되는 자리 */
let baseline = true;

/**
 * 이번 관찰에 무엇이 있었는지 알린다 — 프레임마다 불린다.
 *
 * 처음 보는 종류가 표식을 얻는다. 사라진 종류는 잊는다 — 다시 얻으면 그때는 정말로
 * 새로 온 것이고, 잊지 않으면 두 번째 획득에 표식이 붙지 않는다.
 */
export function noteObserved(kinds: readonly string[]): void {
  const here = new Set(kinds);

  if (baseline) {
    // 첫 관찰 — 있던 것은 새 것이 아니다
    baseline = false;
    for (const kind of here) known.add(kind);
    return;
  }

  for (const kind of here) {
    if (known.has(kind)) continue;
    known.add(kind);
    fresh.add(kind);
  }
  // 가방을 떠난 것은 알던 것에서도 지운다 — 다시 오면 그때가 새로 온 때다
  for (const kind of [...known]) {
    if (!here.has(kind)) {
      known.delete(kind);
      fresh.delete(kind);
    }
  }
}

/** 이 종류에 표식이 붙어 있는가 */
export function isFresh(kind: string): boolean {
  return fresh.has(kind);
}

/**
 * 상세를 봤다 — 표식이 사라진다.
 *
 * 무엇이 "상세를 본 것" 인가는 이 파일이 정하지 않는다. 부르는 쪽이 정한다
 * (지금은 작업 공간에서 **고른 것**이 그것이다 — 고르면 그 물건의 행동 줄이 선다).
 */
export function markSeen(kind: string): void {
  fresh.delete(kind);
}

/** 검증용 — 지금 표식이 붙은 것들 */
export function freshKinds(): string[] {
  return [...fresh];
}

/** 전부 잊는다 — 검사와 새 세션이 쓴다 (다음 관찰이 다시 기준선이 된다) */
export function resetFresh(): void {
  known.clear();
  fresh.clear();
  baseline = true;
}
