// engine/world-authoring — **성질은 물음의 답이다** (Property · 합성기).
//
// 어떤 것의 성질을 저장된 필드로 들지 않고 **이름 하나로 묻는** 기구다. 세계가 성질 이름을
// 건네면 그 이름에 답하는 Source 들을 모으고, 각자의 몫(상한 · 더함 · 참거짓)을 합쳐 답 하나를
// 낸다. 여기에는 게임 명사가 없다 — 어떤 몸도 어떤 성질 이름도 여기서 알지 못하고, 이름 하나로
// 몫 셋을 합치는 산수만 있다. 어느 이름이 무슨 뜻인지 · 누가 그 Source 를 거는지는 전부
// 컨텐츠의 것이다 (조건의 `ConditionRead` 와 같은 어법 — 기반은 컨텐츠를 부르지 않는다).
//
// 지키는 것 셋.
//   ① **아무것도 저장하지 않는다** — Source 목록은 호출자가 든다 (유도). 같은 이름 · 같은 목록
//      이면 언제나 같은 답이다 (결정론).
//   ② **없는 것과 모르는 것이 다르다** — 그 이름에 답할 Source 가 하나도 없으면 답은
//      **없음**(`undefined`)이다. 「0」도 「거짓」도 아니다.
//   ③ **몫은 셋뿐이다** — 상한(cap) · 더함(add) · 참거짓(flag). 곱은 두지 않는다.
//      상한은 작은 쪽이 이기고, 더함은 합이고, 참거짓은 하나라도 참이면 참이다.

/** Source 하나의 몫 셋 — 상한 · 더함 · 참거짓 (곱은 두지 않는다) */
export type PropertyShare =
  | { kind: 'cap'; value: number }
  | { kind: 'add'; value: number }
  | { kind: 'flag'; value: boolean };

/** 몫의 갈래 셋 — 적힌 차례 그대로 (검사와 표가 읽는다) */
export const PROPERTY_SHARE_KINDS: readonly PropertyShare['kind'][] = ['cap', 'add', 'flag'];

/** 누가 · 어느 성질에 · 어떤 몫 */
export interface PropertySource {
  /** 누가 걸었는가 — 기계가 읽는 코드. 기반은 그 뜻을 모른다 */
  origin: string;
  /** 어느 성질에 — 이름의 뜻은 컨텐츠의 것이다 */
  property: string;
  share: PropertyShare;
}

/** 성질의 답 — 수이거나 참거짓이다 */
export type PropertyAnswer = number | boolean;

/** 그 성질에 답하는 Source 들 (적힌 차례 그대로) */
export function propertySourcesOf(
  property: string,
  sources: readonly PropertySource[],
): PropertySource[] {
  return sources.filter((source) => source.property === property);
}

/**
 * 그 성질의 답 — 게임 명사 0 · 저장 0.
 *
 * 합성의 규율.
 *   ① 답할 Source 가 하나도 없으면 **없음**(`undefined`) — 「0」도 「거짓」도 아니다.
 *      없는 것과 모르는 것이 다르다.
 *   ② 수의 몫(cap · add)이 하나라도 있으면 답은 **수**다 — `add` 들의 합(하나도 없으면
 *      무제한 `+Infinity`)에 `cap` 들 가운데 **가장 작은 것**을 씌운다(min). 상한은 작은 쪽이
 *      이긴다. 그래서 cap 만 있으면 답은 그 cap 이고, cap 이 `+Infinity` 하나뿐이면 무제한이다.
 *   ③ 수의 몫이 하나도 없고 `flag` 만 있으면 답은 **참거짓**이다 — 하나라도 참이면 참,
 *      전부 거짓이면 거짓.
 *   ④ 수와 참거짓이 **한 이름에 섞이면 수가 이긴다** — 그때 flag 는 그 성질에 답하지 않는다.
 *      (한 이름은 한 형을 가진다 — 형이 갈리는 데이터를 만들지 않는 것은 컨텐츠의 몫이다)
 *
 * 유한하지 않은 값(NaN)은 여기서 짓지 않는다 — 섞인 NaN 은 없는 것처럼 읽지 않고 그대로 답에
 * 흐른다. 그런 데이터를 만들지 않는 것은 컨텐츠의 몫이다.
 */
export function resolveProperty(
  property: string,
  sources: readonly PropertySource[],
): PropertyAnswer | undefined {
  const answering = propertySourcesOf(property, sources);
  if (answering.length === 0) return undefined; // ①

  // ② 수의 몫 — add 는 합, cap 은 가장 작은 것
  let sum = 0;
  let hasAdd = false;
  let cap = Number.POSITIVE_INFINITY;
  let hasCap = false;
  for (const { share } of answering) {
    if (share.kind === 'add') {
      sum += share.value;
      hasAdd = true;
    } else if (share.kind === 'cap') {
      cap = Math.min(cap, share.value);
      hasCap = true;
    }
  }
  if (hasAdd || hasCap) {
    // ④ 수가 이긴다 — flag 는 여기에 답하지 않는다
    return Math.min(hasAdd ? sum : Number.POSITIVE_INFINITY, cap);
  }

  // ③ 참거짓만 — 하나라도 참이면 참
  return answering.some((source) => source.share.kind === 'flag' && source.share.value === true);
}
