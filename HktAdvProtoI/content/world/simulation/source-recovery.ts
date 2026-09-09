// RULE-SOURCE-RECOVERY-001 · RULE-RECOVERY-SPEED-001 —
//   Implements C013 spec R1 (ADDED · 세계 과정) · C014 spec R2 (CHANGED) · C020 spec R3 (ADDED)
// Scope          모든 방의, phase 가 available 이 아닌 원천 전부
// Trigger        세계의 Tick (dt)
// Condition      그 원천에 **진행을 멎게 하는 조건**이 걸려 있지 않다 —
//                매달린 원천이 available 이 아니거나(recovery-stalled) ·
//                유입 흐름이 지금 실어 오지 않거나(condition-unmet) ·
//                지금이 그 원천의 철이 아니면(not-this-season · C016) 멎는다
// Transition     progress += dt × 철의 배속 × **개체군의 배속** (RULE-RECOVERY-SPEED-001 —
//                밝히지 않은 원천·철·개체군은 1. 배속이 0 이면 한 톨도 오르지 않는다 · C024).
//                progress ≥ recoverySeconds × RECOVERY_VISIBLE_FRACTION 이고 depleted 면
//                    phase = recovering · 자리를 옮기는 원천이면 siteIndex = 무너지지 않은 다음 마디
//                progress ≥ recoverySeconds 면 phase = available · taken = 0 · progress = 0
// Result         (없음 — 세계가 되돌릴 뿐이다. 무엇이 달라졌는지는 관찰 결과가 말한다)
//
// **관찰자와 무관하다** (spec R1 경계 ①). 그 방에 몸이 없어도, 세계 어디에도 관찰자가 없어도
// 돈다 — 미로의 재배열(RULE-MAZE-CONNECTION-001)이 세운 선례 그대로 세계 과정이다.
//
// **규칙은 방의 이름도 재료의 이름도 알지 못한다** (spec R13 · L2-World-Region R13). 여기가
// 아는 것은 "State 를 가진 원천" 뿐이고, 그것이 노두인지 허물인지 · 얼마나 걸리는지 · 무엇에
// 매달렸는지는 전부 데이터(content/regions)와 세계 사실(semantic/resource.ts)에서 온다.
//
// 걸린 조건은 여기서 다시 판정하지 않는다 — RULE-SOURCE-CONDITION-001(sourceConditions)이
// 답하는 그것을 그대로 읽는다. 그래서 관찰 결과에 실리는 `recovery-stalled` · `condition-unmet` 과
// 실제로 멎는 것이 **같은 판정**이다 (spec R2 — 표시가 아니라 원인이다).
//
// C016 CHANGED (spec R7) — **철도 그 판정에 든다.** 이 규칙은 어느 원천이 철을 타는지 묻지
// 않는다: 조건 코드가 이미 그것을 말하므로 여기서 아는 것은 "멎게 하는 코드가 걸렸는가"
// 하나뿐이고, 어느 철에 무엇이 나는지는 데이터와 세계 시각의 것이다. **한 줄도 바뀌지 않은
// 것** — 되돌아옴의 문턱도 자리 옮김도 그대로다 (spec R9).
//
// C014 CHANGED — 흐름의 주기도 그 판정에 든다. 이 규칙은 **어느 원천이 흐름을 가졌는지 묻지
// 않는다**: 조건 코드가 이미 그것을 말하므로 여기서 아는 것은 "멎게 하는 코드가 걸렸는가"
// 하나뿐이고, 주기도 흐름의 출발도 데이터와 세계 시각의 것이다.
//
// C018 CHANGED (C018 spec R7) — **지나가는 것도 그 판정에 든다.** 누군가 남기는 원천은 그것이
// 지나고 있지 않은 동안 `condition-unmet` 을 지므로 여기서 저절로 멎는다 — 이 파일은 **한
// 줄도 바뀌지 않았다**: 조건 코드가 이미 그것을 말하고, 무엇이 무엇을 남기는지는 여전히
// 데이터의 것이다. 넘기는 값 하나(지나감들의 지금)가 늘었을 뿐이다.

// C020 CHANGED (C020 spec R3) — **철이 되돌아옴의 속도를 바꾼다.** 원천이 지금 철의 배속을
// 밝혔으면 그만큼의 세계 시간이 그 배로 진행에 실린다. **되돌아옴의 길이(recoverySeconds)는
// 바뀌지 않는다** — 얼마나 남았는가가 빨리 줄 뿐이고, 두 문턱도 그 값 그대로다 (경계).
// 밝히지 않은 원천 · 밝히지 않은 철은 한 값도 다르지 않다 (숲의 원천 열이 그렇다).
//
// **규칙은 철의 이름을 알지 못한다** (Time T4 · C016 R1 이 세운 그 규율) — 데이터의 열쇠와
// 시계가 낸 지금 철을 맞춰 볼 뿐이고, 어느 원천이 어느 철에 빨라지는지는 데이터에만 있다.

// C024 CHANGED (C024 spec R1) — **살아 있는 것이 되돌아옴의 속도를 좌우한다.** 값마다의
// 배속과 그 개체군을 밝힌 원천은 그 값에 따라 빨라지고 느려지며, 값이 0 이면 **아주 멎는다**
// (기다린다고 오지 않는다 — 벗을 것이 있어야 허물이 쌓인다). 되돌아옴의 **길이도 두 문턱도**
// 한 값 바뀌지 않는 것은 철의 배속과 같다.
//
// **규칙은 어떤 생명도 이름으로 알지 못한다** (Life F13 · R13) — 곱하는 수 하나를 받을 뿐이고,
// 어느 원천이 무엇에 매였는지 · 어느 값에서 얼마나 빨라지는지는 전부 데이터에만 있다.

import { CONDITION_UNMET, RECOVERY_STALLED } from '../../regions';
import { seasonAt } from '../semantic/clock';
import { NOT_THIS_HOUR, NOT_THIS_SEASON } from '../semantic/region-phase';
import { standSourceState } from '../semantic/region-state';
import {
  nextStandableSite,
  recoveryLifeSpeed,
  sourceConditions,
  sourcesInRegion,
} from '../semantic/resource';
import { RECOVERY_VISIBLE_FRACTION, type WorldState } from '../semantic/world-state';

export function ruleSourceRecovery(state: WorldState, dt: number): void {
  // 방의 State 를 훑는다 — 원천 State 가 없는 방은 되돌릴 것도 없다 (백왕령 · 미로).
  // Object.entries 의 순서는 삽입 순서이고 State 는 REGION_SPECS 순서로 세워졌다 (결정론).
  for (const [regionId, regionState] of Object.entries(state.regionStates)) {
    if (!regionState.sources) continue;
    // 데이터의 원천 순서로 돈다 — State 의 키 순서에 기대지 않는다 (결정론).
    for (const source of sourcesInRegion(regionId)) {
      const sourceState = regionState.sources[source.id];
      if (!sourceState) continue;
      // 되돌아올 것이 없는 원천은 지나간다 — 되돌아옴은 **고갈된 것의 일**이다 (SPEC-010 경계).
      if (sourceState.phase === 'available') continue;
      // 걸린 조건 가운데 **진행을 멎게 하는 것**이 있으면 오르지 않는다 (C013 spec R1 ELSE · R2 ·
      // C014 spec R2 · C016 spec R7). 코드 넷 중 셋이 그것이다 — 매달린 것이 available 이
      // 아니거나(recovery-stalled) · 유입 흐름이 지금 실어 오지 않거나(condition-unmet) ·
      // 지금이 그 원천의 철이 아니면(not-this-season) 멎는다.
      // 남은 하나 flow-arrived 는 **실려 오는 중**이라는 뜻이므로 진행을 허락한다.
      const conditions = sourceConditions(
        state.regionStates,
        source,
        state.time,
        state.presences,
      );
      if (
        conditions.includes(RECOVERY_STALLED) ||
        conditions.includes(CONDITION_UNMET) ||
        conditions.includes(NOT_THIS_SEASON) ||
        // 낮밤을 타는 원천도 그 때가 아니면 멎는다 (RoomBearsMaterial 실주행 판정 — 철과 같은 규율)
        conditions.includes(NOT_THIS_HOUR)
      ) {
        continue;
      }

      // RULE-RECOVERY-SPEED-001 (C020 ADDED · C024 CHANGED · spec R1) — 지금 철의 배속에
      // **그 개체군의 배속**이 곱해진다. 둘 다 밝히지 않은 원천은 1 × 1 이므로 한 값도
      // 다르지 않다 (숲의 원천 열 가운데 여덟이 그렇다).
      // **길이를 바꾸지 않고 진행에 실는다** — 아래 두 문턱은 데이터의 초 그대로다 (경계).
      //
      // 개체군의 값이 0 이고 데이터가 첫 자리를 0 으로 두었으면 배속이 0 이라 **진행이 한
      // 톨도 오르지 않는다** — Respawn Timer 가 세계 안의 원인으로 갈아 끼워지는 자리다.
      // 위의 조건 코드 목록을 여기서 다시 보지 않는 이유가 그것이다: 멎게 하는 것은 코드가
      // 아니라 배속 0 이고, 관찰에 실리는 멎음 코드(`no-molter` …)는 **같은 하나**를 읽어
      // 걸린다 (semantic/resource.ts 의 recoveryLifeSpeed · spec R2). 그래서 규칙이 데이터의
      // 글자를 알아야 할 자리가 생기지 않는다 (R13).
      const seasonSpeed = source.recoverySpeed?.[seasonAt(state.time)] ?? 1;
      sourceState.progress += dt * seasonSpeed * recoveryLifeSpeed(state.regionStates, source);

      // 눈에 보이기 시작하는 문턱 — 그림이 갈리고 흙이 다시 짙어지며, 자리를 옮기는 원천은
      // **여기서** 옮겨 선다. 예보가 서려면 자리가 먼저 서야 하기 때문이다 (spec 기본형 ②).
      if (
        sourceState.phase === 'depleted' &&
        sourceState.progress >= source.recoverySeconds * RECOVERY_VISIBLE_FRACTION
      ) {
        sourceState.phase = 'recovering';
        // 마디가 하나뿐인 원천도 · 무너지지 않은 마디가 하나도 없는 원천도 옮기지 않는다
        // (spec R1 경계 ③ — 지날 수 없는 자리에 세우지 않는다).
        const next = nextStandableSite(source, sourceState.siteIndex, sourceState.collapsedSites);
        if (next !== null) sourceState.siteIndex = next;
      }

      // 다 돌아온 문턱 — 다시 캘 수 있다. 캔 횟수가 0 으로 돌아가지 않으면 돌아온 것이
      // 아니다 (spec 기본형 ⑥). 한 Tick 에 두 문턱을 함께 넘어도 자리 이동은 위에서 한 번뿐이다
      // (경계 ②) — 두 if 가 같은 Tick 에 차례로 성립할 뿐이다.
      // C023 CHANGED — **그 전이를 내는 자리가 하나가 되었다** (semantic/region-state.ts 의
      // standSourceState). 태어남도 원천을 세우는데(RULE-LIFE-BIRTH-001 ③), 시간이 세운 것과
      // 탄생이 세운 것의 State 가 같아야 하기 때문이다 — 여기서 하던 세 줄이 한 값도
      // 달라지지 않고 그리로 갔다.
      if (sourceState.progress >= source.recoverySeconds) {
        standSourceState(sourceState);
      }
    }
  }
}
