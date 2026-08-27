// Growth Presentation — 자란 것과 방금 쌓인 일들의 표시를 결정한다 (결정 Layer).
// C-GROWTH-001 · 04-gameview.spec.yaml 의 `growth` · `growthEvents` · `hud.self.growth.*`.
//
// GROWTH 트랙이 자기 결정 파일을 세운다 (guides/works.md 병렬 규칙) —
// terrain-presentation · allocation-presentation 이 각자 그렇게 선 것과 같은 자리다.
//
// ── 이 파일이 하지 않는 일 ────────────────────────────────────────────
//
// **단계를 계산하지 않는다.** 쌓인 값을 문턱으로 나누지 않고, 다음 문턱까지 얼마인지
// 빼지 않으며, 어느 단계가 어느 값을 얼마나 올리는지 곱하지 않는다. 그 넷은 전부
// 세계가 세어서 보낸다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
//
// 그래서 이 파일에 산술이 하나도 없다 — 있는 것은 **어느 값을 어떤 말과 함께 어느
// 순서로 세울 것인가**뿐이다.

import type { GameViewSnapshot, GrowthEventView, GrowthView } from '../protocol/gameview';

/**
 * 자란 것 — self 패널의 줄로 낸다.
 *
 * **늘 보인다.** 아직 아무것도 쌓지 않았어도 보인다 — 0 이라는 사실과 자리가 없다는
 * 사실은 다르며, 그 구분이 없으면 "무엇을 하면 는다" 를 사람이 알 수 없다.
 * 온기(C-TERRAIN-001)가 자리 밖에서도 늘 보이는 것과 같은 판단이다.
 *
 * 줄은 둘이다.
 *
 *     자란 것   지금 단계 · 쌓인 양 · 다음 문턱까지
 *     단계 몫   지금 그 단계가 어느 값에 얼마를 보태고 있는가
 *
 * 둘째 줄이 있어야 첫째 줄의 숫자가 **무엇을 위한 것인지** 읽힌다. 단계만 보이면
 * "3 단계" 가 무슨 뜻인지 알 길이 없고, 그러면 자라는 일이 화면에서 사라진다.
 */
export function growthLines(snapshot: GameViewSnapshot, text: (code: string) => string): string[] {
  const growth = snapshot.growth;
  if (!growth) return [];
  return [levelLine(growth), contributionLine(growth, text)];
}

function levelLine(growth: GrowthView): string {
  // 최대 단계면 남은 양이 오지 않는다 — 없음이 곧 "더 오를 곳이 없다" 이므로
  // 0 을 지어내지 않고 그 사실을 말한다.
  const toNext =
    growth.deedsToNext === undefined
      ? '더 오를 곳이 없다'
      : `다음까지 ${growth.deedsToNext} (${growth.nextThreshold})`;
  return `자란 것 ${growth.level}/${growth.maxLevel} · 쌓인 것 ${growth.deeds} · ${toNext}`;
}

function contributionLine(growth: GrowthView, text: (code: string) => string): string {
  // **0 도 쓴다.** 아직 아무것도 보태고 있지 않다는 사실이 보여야, 한 단계를 올린 뒤
  // 같은 자리의 숫자가 움직이는 것이 읽힌다 (C013 이 관통 0 을, C015 가 가능성 0 을
  // 쓰기로 한 판단 그대로).
  // 세계가 보낸 차례 그대로 세운다 — 화면은 정렬하지 않는다.
  const parts = growth.contributions.map((c) => `${text(c.stat)} +${c.amount}`);
  return `단계 몫 ${parts.join(' · ')}`;
}

/**
 * 방금 무엇을 해서 얼마가 쌓였는가 — self 패널의 줄로 낸다.
 *
 * **스스로 사라진다.** 세계가 이 목록을 타격·접촉·캔슬과 같은 수명으로 지우므로
 * (STRIKE_EVENT_TTL), 화면이 언제 지울지를 따로 정하지 않는다. 방금 일어난 일만
 * 잠깐 서 있다가 없어진다.
 *
 * **오른 줄은 다르게 쓴다.** levelBefore 와 levelAfter 가 갈리면 그것이 "올랐다" 는
 * 사실이며, 그것이 이 Cycle 에서 사람이 기다리는 한 순간이다. 화면이 이전 값을
 * 기억해 두었다가 견주지 않는다 — 세계가 둘을 함께 보낸다.
 */
export function growthEventLines(
  snapshot: GameViewSnapshot,
  text: (code: string) => string,
): string[] {
  return (snapshot.growthEvents ?? []).map((event) => growthEventLine(event, text));
}

function growthEventLine(event: GrowthEventView, text: (code: string) => string): string {
  // 원천은 의미 코드다. 표에 없는 코드가 와도 코드 그대로 나온다 — 세계가 원천을
  // 하나 더 지어도 화면이 멈추지 않는다 (C020 이 세운 규칙 그대로).
  const what = text(`deed.${event.source}`);
  const gained = `${what} +${event.amount} (${event.deedsAfter})`;
  return event.levelAfter > event.levelBefore
    ? `${gained} → 자란 것 ${event.levelBefore} ▸ ${event.levelAfter}`
    : gained;
}

/**
 * 방금 단계가 올랐는가 — 켜 둘 만한 한 순간인지 묻는다.
 *
 * 이펙트나 연출을 여기서 만들지 않는다. 이 함수가 답하는 것은 **사실 하나**이며,
 * 그것으로 무엇을 할지는 부르는 쪽이 정한다.
 */
export function justLeveled(snapshot: GameViewSnapshot): boolean {
  return (snapshot.growthEvents ?? []).some((e) => e.levelAfter > e.levelBefore);
}
