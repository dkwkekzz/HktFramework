// R6 — 행동 의도 생성. 계획(P)을 실제 세계 행동으로 제출하되, 주체가 아는 것만 통과시킨다.
//
// P 는 세계의 실제 압력에서 계획을 세운다. 그러나 주체가 그 계획을 실행하려면
// 두 관문을 지나야 한다:
//   ① 아는가   — 그 행동이 향하는 곳을 자기 믿음으로 알고 있는가.
//                모르는 곳으로는 가지 않는다 (전지 금지)
//   ② 겁나는가 — 그 곳에 대한 위협 기억이 남아 있으면 조심스러워진다.
//                기억이 이득을 넘으면 물러선다 (R5 → 회피)
//
// 나오는 것은 사건이 아니라 **의도**다. 의도를 사건으로 확정하는 것은
// 권위(N)와 충돌 해결(E3)의 몫이다 — 여기서 세계를 바꾸지 않는다.
import { stableSort, stateHash } from '../../verification/src/deterministic.js';

/** 위협 기억이 이만큼 쌓이면 물러선다 (이득 대비) */
export const CAUTION_THRESHOLD = 1;

/**
 * 계획 하나를 의도로 옮긴다. 막히면 왜 막혔는지 남긴다 —
 * "안 했다"가 아니라 "몰라서 못 했다 / 무서워서 안 했다"가 세계의 이야기가 된다.
 */
export function intentFrom({ plan, subject, beliefs, tick = 0, placeOf }) {
  const base = {
    subject: plan.subject, archetype: plan.archetype, tick,
    goal: plan.goal.kind, strategy: plan.chosen?.id ?? null,
  };
  if (!plan.goal.kind) return { ...base, submitted: false, reason: '결핍 없음 — 나설 이유가 없다' };
  if (!plan.chosen) return { ...base, submitted: false, reason: plan.reason };

  const at = placeOf(plan.chosen) ?? subject.at ?? null;
  const here = at === subject.at;

  // ① 아는가 — 자기 자리가 아닌 곳으로 움직이려면 그 곳에 대한 믿음이 있어야 한다
  if (!here) {
    const known = beliefs.of(subject.id).beliefs.some((b) => b.at === at);
    if (!known)
      return { ...base, at, submitted: false, reason: `${at} 을(를) 모른다 — 알지 못하는 곳으로는 가지 않는다` };
  }

  // ② 겁나는가 — 그 곳의 위협 기억이 이 행동의 이득을 넘으면 물러선다
  const fear = beliefs.weight(subject.id, at, 'threat', tick);
  const gain = plan.chosen.gain ?? 0;
  if (fear > 0 && fear >= gain + CAUTION_THRESHOLD)
    return {
      ...base, at, submitted: false, fear, gain,
      reason: `${at} 의 위협 기억 ${fear} 이(가) 이득 ${gain} 을(를) 넘는다 — 물러선다`,
    };

  return {
    ...base, at, submitted: true, fear, gain,
    behaviors: plan.chosen.atoms,
    caution: fear > 0 ? Number((fear / (gain + 1)).toFixed(3)) : 0,
    reason: fear > 0
      ? `${plan.chosen.id} 실행 — 다만 ${at} 의 위협 기억 ${fear} 만큼 조심한다`
      : `${plan.chosen.id} 실행`,
  };
}

/**
 * R6 — 배역 전체의 의도. 계획은 P 가, 앎과 두려움은 R 이 정한다.
 * placeOf: 전략이 향하는 장소를 알려주는 함수 (Q 의 요구 매핑에서 온다 — 여기서 짓지 않는다)
 */
export function formIntents({ plans, subjects, beliefs, tick = 0, placeOf }) {
  const intents = plans
    .filter((p) => subjects[p.subject])
    .map((plan) => intentFrom({ plan, subject: subjects[plan.subject], beliefs, tick, placeOf }));
  const sorted = stableSort(intents, (a, b) => a.subject.localeCompare(b.subject));
  return {
    intents: sorted,
    submitted: sorted.filter((i) => i.submitted),
    hash: stateHash(sorted.map((i) => ({ s: i.subject, g: i.goal, st: i.strategy, ok: i.submitted, at: i.at }))),
  };
}
