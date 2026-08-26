// 보낸 것과 일어난 것 사이의 시간 (V-007) — UX 문서의 **응답 지연** 한 줄이 여기다.
//
//     1초 뒤 `처리 중`, 5초 뒤 재시도가 아닌 연결 상태 안내; 중복 요청 금지
//     (Design-View-Skill-UX-D1 §8 · Design-View-Inventory-Equipment-UX-D1 §7)
//
// ── 왜 곧바로 보이지 않는가 ──────────────────────────────────────────
//
// 세계는 보통 한 Tick 안에 답한다. 그때마다 `처리 중` 을 띄우면 그 글자는 읽히기 전에
// 사라지고, 남는 것은 칸이 한 번 깜빡였다는 인상뿐이다. 깜빡임은 정보가 아니다 —
// 겪는 사람은 자기가 무엇을 본 것인지 모른 채 **무언가 잘못됐다는 느낌**만 얻는다.
//
// 그래서 기다림은 **늦을 때만** 보인다. 늦지 않은 기다림은 결과로 바로 이어지고,
// 그 결과가 이미 답이다 (값이 옮겨 가고, 몸이 움직이고, 사유가 붙는다).
//
// ── 여기서 판정하지 않는 것 ──────────────────────────────────────────
//
// 되는지 안 되는지도, 왜 안 되는지도 여기서 정하지 않는다 (DC-WORLD-OWNS-THE-SURFACE-LIST).
// 여기 있는 것은 **관찰자 자신의 사실** 하나뿐이다 — 내가 보낸 지 얼마가 지났는가.
// 그것은 세계가 알지 못하는 값이며(세계는 누가 무엇을 걸었는지 기억하지 않는다)
// 그래서 화면이 쥔다.

/**
 * 기다림이 지금 어떻게 보이는가.
 *
 *     silent    아직 말하지 않는다 — 늦지 않은 기다림은 결과가 곧 답한다
 *     working   늦다 — `처리 중` 이 그 자리에 선다
 *     late      많이 늦다 — 다시 보내라고 하지 않는다. 이어짐을 보라고 한다
 */
export type WaitStage = 'silent' | 'working' | 'late';

/** 이만큼 지나야 기다림이 보인다 */
export const WORKING_AFTER_MS = 1000;
/** 이만큼 지나면 기다림이 아니라 **이어짐**을 의심할 때다 */
export const LATE_AFTER_MS = 5000;

/** 짧은 표기 — 칸·줄에 붙는다. 긴 문장은 이 자리에 오지 않는다 */
export const WAIT_TEXT: Readonly<Record<Exclude<WaitStage, 'silent'>, string>> = {
  working: '처리 중',
  // **재시도가 아니다.** 다시 보내는 것은 같은 요청을 두 번 보내는 일이고, 그때 볼 곳은
  // 늘 떠 있는 이어짐 패널이다 (C005 session.visibility: always)
  late: '이어짐 확인',
};

/** 보낸 지 얼마나 지났는가로 갈린다. 언제 보냈는지 모르면 아직 말하지 않는다 */
export function waitStage(since: number | undefined, now: number): WaitStage {
  if (since === undefined) return 'silent';
  const elapsed = now - since;
  if (elapsed >= LATE_AFTER_MS) return 'late';
  if (elapsed >= WORKING_AFTER_MS) return 'working';
  return 'silent';
}

/** 그 단계의 말 — `silent` 면 아무 말도 없다 */
export function waitText(stage: WaitStage): string | undefined {
  return stage === 'silent' ? undefined : WAIT_TEXT[stage];
}

// ── 언제 보냈는지를 모르는 자리 ──────────────────────────────────────
//
// 소지품 작업 공간은 자기가 보냈으므로 그 순간을 함께 적어 둔다 (정확한 값이다).
// 기술은 그렇지 않다 — 보내는 것은 조립 루트이고 화면에는 **결과만** 내려온다
// (`SkillAnswer`). 그래서 이쪽은 "기다리는 것을 처음 본 순간" 을 자기가 적는다.
//
// 한 프레임(≈16ms)만큼 늦게 잡히지만, 재는 자가 1초·5초이므로 그 차이는 화면에서
// 일어나지 않는다. 조립이 보낸 시각을 함께 실어 주게 되면 이 장부는 사라진다.

const firstSeen = new Map<string, number>();

/**
 * 이 id 가 기다리기 시작한 시각 — 기다리지 않으면 잊고 undefined 를 낸다.
 *
 * 프레임마다 불린다. 기다림이 끝난 자리를 잊는 것이 이 함수의 절반이다 —
 * 잊지 않으면 다음번 요청이 **지난번 기다림의 나이**를 물려받아, 누르자마자
 * `이어짐 확인` 이 뜨는 일이 생긴다.
 */
export function waitingSince(id: string, waiting: boolean, now: number): number | undefined {
  if (!waiting) {
    firstSeen.delete(id);
    return undefined;
  }
  const seen = firstSeen.get(id);
  if (seen !== undefined) return seen;
  firstSeen.set(id, now);
  return now;
}

/** 전부 잊는다 — 검사와 끊김이 쓴다 (오지 않을 대답의 나이를 세지 않는다) */
export function forgetWaits(): void {
  firstSeen.clear();
}
