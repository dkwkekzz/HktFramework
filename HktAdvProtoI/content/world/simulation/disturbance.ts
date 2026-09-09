// RULE-DISTURBANCE-DECAY-001 — Implements C017 spec R2 (ADDED · 세계 과정)
// Scope          모든 방
// Trigger        세계의 Tick
// Condition      지금 철이 **가라앉는 철**이다 (데이터가 밝힌 그 철 — 코드에 이름이 없다)
// Transition     모든 방의 소란 = max(0, 소란 − DISTURBANCE_DECAY_PER_SECOND × dt)
// Result         (없음 — 세계가 잊을 뿐이다. 얼마나 남았는지는 관찰 결과가 말한다)
//
// RULE-DISTURBANCE-PHASE-001 — Implements C017 spec R3 (ADDED · 세계 과정)
//                              · C034 spec R4 (CHANGED — 깨어나는 전이를 그 방이 **센다**)
// Scope          모든 방
// Trigger        세계의 Tick
// Condition      잠든 방의 소란이 임계에 닿았다 · 깨어난 방의 소란이 0 에 닿았다
// Transition     앞이면 위상 = 깨어남 **그리고** 그 방의 history.awakenings 가 하나 오르고
//                지금 세계 시각이 적힌다 (C034 ADDED · RULE-REGION-MEMORY-001) ·
//                뒤면 위상 = 잠듦 (세지 않는다)
// Result         (없음 — 방이 달라졌다는 것은 관찰 결과의 깊이와 위험이 말한다)
//
// **관찰자와 무관하다** (spec R2 경계 ①) — 그 방에 몸이 없어도, 세계 어디에도 관찰자가 없어도
// 가라앉고 깨어나고 잠든다. 되돌아옴(C013) · 뒤척임(C016)이 세운 선례 그대로 세계 과정이다.
//
// **규칙은 철의 이름을 알지 못한다** (T4 · spec R2 IF) — 여기가 하는 일은 데이터가 밝힌
// 가라앉는 철 목록(content/regions/phases.ts 의 DISTURBANCE_DECAY_SEASONS)과 시계가 낸 지금
// 철을 맞춰 보는 것뿐이다. 맞춰 보는 함수도 C016 이 세운 그것(isSeasonListed) 하나를 그대로
// 쓴다 — 문의 활성도 원천의 출현도 같은 물음을 그 함수 하나에 묻는다.
//
// **위상 판정은 여기 한 자리에서만 난다** (spec R3 경계 ②). 올리는 자리(RULE-DISTURBANCE-001)도
// 가라앉는 자리(위)도 값만 만지고 위상은 건드리지 않는다 — 두 벌로 만들면 방이 두 말을 한다.
//
// **넘은 것과 비운 것이 다르다** (spec 기본형 ② · SPEC-006 경계 ①) — 깨어난 방은 값이 임계
// 아래로 내려간 것만으로는 잠들지 않고 **0 에 닿아야** 잠든다. 임계에서 잠들면 그 언저리에서
// 진동하고, 그러면 "여럿이 비워 두어야 한다" 가 "잠깐 쉬면 된다" 가 된다.

import { DISTURBANCE_DECAY_SEASONS } from '../../regions';
import { isSeasonListed } from '../semantic/region-phase';
import { remember } from '../semantic/region-state';
import {
  DISTURBANCE_DECAY_PER_SECOND,
  DISTURBANCE_THRESHOLD,
  type WorldState,
} from '../semantic/world-state';

/**
 * RULE-DISTURBANCE-DECAY-001 (C017 ADDED · spec R2) — **고요에만 가라앉는다.**
 *
 * 다른 철에는 한 값도 줄지 않는다 — 미지가 가까운 철에는 세계가 흔들린 것을 잊지 않는다.
 * 0 에서 멈춘다 (SPEC-002 경계 ①). 뒤척임은 소란을 건드리지 않는다 (경계 ③) — 뒤척임이
 * 가라앉는 철 목록에 없다는 것이 그 말이고, 그것도 데이터가 정한다.
 *
 * 그리고 **위상을 먼저 본다** — 세계가 이 Tick 에 판정하는 값은 Tick 이 시작할 때의 값이고,
 * 잊는 것은 그 판정 **뒤**의 일이기 때문이다. 순서를 뒤집으면 가라앉는 철에서는 임계에 닿은
 * 값이 판정 전에 이미 조금 줄어 **어느 방도 깨어나지 못한다** — 여럿이 함께 넘긴 임계가
 * 고요라는 이유만으로 없던 일이 된다. 잠드는 쪽도 같은 한 Tick 을 기다린다 (대칭이다).
 */
export function ruleDisturbanceDecay(state: WorldState, dt: number): void {
  ruleDisturbancePhase(state);

  if (isSeasonListedForDecay(state.time)) {
    const step = DISTURBANCE_DECAY_PER_SECOND * dt;
    // 방 순회 순서는 regionStates 의 삽입 순서(REGION_SPECS 순서)다 — 결정론.
    for (const regionState of Object.values(state.regionStates)) {
      const disturbance = regionState.disturbance;
      if (disturbance.value <= 0) continue;
      disturbance.value = Math.max(0, disturbance.value - step);
    }
  }
}

/**
 * 지금이 가라앉는 철인가 — 데이터 목록과 시계를 맞춰 보는 **한 줄**이다.
 *
 * `isSeasonListed` 는 밝히지 않은 것(undefined)을 언제나 참으로 보므로 여기서는 목록을
 * 언제나 넘긴다 — 빈 목록이면 어느 철에도 가라앉지 않는다는 뜻이고, 그것도 데이터의 답이다.
 */
function isSeasonListedForDecay(time: number): boolean {
  return isSeasonListed(DISTURBANCE_DECAY_SEASONS, time);
}

/**
 * RULE-DISTURBANCE-PHASE-001 (C017 ADDED · spec R3) — **임계에서 깨어나고 비면 잠든다.**
 *
 * 위상이 갈리는 **유일한 자리**다 (경계 ②). 값은 여기서 한 값도 만지지 않는다 —
 * 임계에서 멈추는 것은 올리는 쪽의 일이고(addDisturbance), 여기가 하는 것은 읽고 가르는 것뿐이다.
 *
 * 위상은 방마다 따로다 (SPEC-003 경계 ③) — 한 방이 깨어나도 다른 방은 잠듦 그대로다.
 * 무엇이 그 방을 깨웠는지 규칙은 알지 못한다 (SPEC-005 경계 ④).
 *
 * C034 CHANGED (spec R4) — **깨어나는 그 전이를 그 방이 센다** (RULE-REGION-MEMORY-001).
 * 판정은 한 줄도 바뀌지 않았다: 셈 하나가 그 전이 곁에 늘 뿐이다. 방 id 가 필요해
 * `Object.values` 가 `Object.entries` 가 된 것이 이 파일에서 달라진 전부다.
 */
export function ruleDisturbancePhase(state: WorldState): void {
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    const disturbance = regionState.disturbance;
    if (disturbance.phase === 'dormant') {
      if (disturbance.value >= DISTURBANCE_THRESHOLD) {
        disturbance.phase = 'awake';
        // **전이만 센다** (spec R4 경계 ①) — 깨어 있는 동안 값이 오르내려도 한 번이다.
        // 0 에 닿아 잠들고 다시 넘어야 두 번이고, 깨어남 → 잠듦은 세지 않는다 (경계 ②).
        // 이 판정 자리가 위상이 갈리는 유일한 자리이므로 셈도 여기 하나다.
        remember(state.regionStates, regionId, state.time, { kind: 'awakening' });
      }
    } else if (disturbance.value <= 0) {
      disturbance.phase = 'dormant';
    }
  }
}
