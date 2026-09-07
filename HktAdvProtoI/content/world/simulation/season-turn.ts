// RULE-SEASON-TURN-001 — Implements C016 spec R8 (ADDED · 세계 과정)
//                        · C017 spec R7 (CHANGED — 뒤척임이 **자국도** 묻는다)
// Scope          onTurn 을 밝힌 방
// Trigger        세계의 Tick
// Condition      지금까지 **시작된** 뒤척임의 수가 **적용한** 수보다 많다
// Transition     밝힌 방마다 onTurn 을 적용한다 —
//                  burySigns 면 그 방 원천의 phase · taken · progress · collapsedSites 를 **처음 상태**로
//                  그리고 그 방에 남은 **자국(tracks)도 한꺼번에** 없다 (C017 ADDED)
//                  migrateSources 의 원천은 **다음 마디**로 (C013 의 nextStandableSite 그대로)
//                그리고 World.turnsApplied 를 지금까지 시작된 수로 맞춘다
// Result         (없음 — 세계가 뒤척일 뿐이다. 무엇이 달라졌는지는 관찰 결과가 말한다)
//
// **세계가 뒤척인다.** 회복(C013)이 원천마다 제 길이로 옅어지게 하는 것과 달리 **한 번에**
// 일어난다 — 어제의 구덩이가 묻히고 노두가 다른 자리에 서 있다.
//
// **관찰자와 무관하다** (spec R8 경계 ③) — 그 방에 몸이 없어도, 세계 어디에도 관찰자가 없어도
// 뒤척인다. 미로의 재배열(RULE-MAZE-CONNECTION-001)과 되돌아옴(RULE-SOURCE-RECOVERY-001)이
// 세운 선례 그대로 세계 과정이다.
//
// **수로 세는 이유** (spec 기본형 ⑤ · 경계 ① ②) — 뒤척임은 시각이 아니라 **사건**이다.
// 지금까지 시작된 수(시각에서 유도된다 · semantic/clock.ts 의 turnsStartedAt)와 적용한 수
// (저장된다 · World.turnsApplied)를 견주므로
//   ① 그 60 초 안에 Tick 이 몇 번을 지나도 한 번만 적용되고,
//   ② 큰 걸음으로 뒤척임을 통째로 건너뛰어도 빠뜨리지 않으며 (지난 것은 지난 만큼 일어난다),
//   ③ 껐다 켠 세계가 다시 뒤척이지 않는다 (적용한 수가 스냅샷에 실려 온다).
//
// **밝힌 방만이다** (spec 기본형 ⑧) — 세계 전체를 한 번에 쓸면 밝히지 않은 방까지 철을 타게
// 되어 T3(달라지는 것은 데이터가 밝힌 것뿐)이 깨진다. 백왕령도 미로도 여기서 한 값도 바뀌지
// 않고, **미로의 압력과 패턴은 어느 방에서도 건드리지 않는다** (spec R8 경계 ④ · 기본형 ⑥) —
// 미로의 재배열은 그 방 자신의 규칙이 걷음으로 굴리는 것이다.
//
// **규칙은 철의 이름도 방의 이름도 원천의 이름도 알지 못한다** (T4) — 여기가 아는 것은
// "onTurn 을 밝힌 방" 과 시계가 낸 **수** 뿐이고, 어느 방이 무엇을 하는지는 데이터
// (content/regions 의 phases.onTurn)에만 있다.

import { REGION_SPECS } from '../../regions';
import { turnsStartedAt } from '../semantic/clock';
import { initialSourceState } from '../semantic/region-state';
import { nextStandableSite, sourcesInRegion } from '../semantic/resource';
import type { WorldState } from '../semantic/world-state';

export function ruleSeasonTurn(state: WorldState): void {
  const started = turnsStartedAt(state.time);
  if (started <= state.turnsApplied) return;

  // 건너뛴 뒤척임까지 **지난 만큼** 일어난다 (경계 ②) — 자리를 옮기는 원천은 두 번 뒤척이면
  // 두 마디를 간다 (SPEC-006 경계 ①). 보통은 한 바퀴다: Tick 하나에 두 뒤척임이 지나지 않는다.
  for (let turn = state.turnsApplied; turn < started; turn++) applyOneTurn(state);
  state.turnsApplied = started;
}

/** 뒤척임 한 번 — 밝힌 방마다 자국을 묻고 옮길 원천을 옮긴다 (REGION_SPECS 순서 · 결정론) */
function applyOneTurn(state: WorldState): void {
  for (const spec of REGION_SPECS) {
    const onTurn = spec.phases?.onTurn;
    if (!onTurn) continue;
    // C017 CHANGED — **원천이 없어도 묻을 것이 있다** (spec R7). 자국만 남은 방도 묻어야 하므로
    // 여기서 sources 를 보고 돌아서지 않는다: 방의 State 만 있으면 된다 (소란이 모든 방에
    // 서므로 State 는 언제나 있다 — 되살린 옛 세계나 데이터에 없는 방만 없다).
    const regionState = state.regionStates[spec.id];
    if (!regionState) continue;

    // ① 자국을 묻는다 — **없던 일로 한다**는 뜻이지 "다 채워 준다" 가 아니다 (spec 기본형 ⑦).
    // 처음 상태를 짓는 자리는 하나다 (semantic/region-state.ts 의 initialSourceState) — 흐름에
    // 매달린 원천은 **처음이 고갈**이므로 그대로 고갈로 돌아간다 (SPEC-005 경계 ②).
    // **자리(siteIndex)는 여기서 건드리지 않는다** — 옮기는 것은 아래 ② 의 일이고, 자국을
    // 묻는다고 서 있던 자리가 달라지지는 않는다.
    if (onTurn.burySigns) {
      const sources = regionState.sources;
      if (sources) {
        for (const source of sourcesInRegion(spec.id)) {
          const sourceState = sources[source.id];
          if (!sourceState) continue;
          const fresh = initialSourceState(source);
          sourceState.phase = fresh.phase;
          sourceState.taken = fresh.taken;
          sourceState.progress = fresh.progress;
          // 무너진 마디는 하나도 남지 않는다 — 처음 상태에는 자리 자체가 없다.
          delete sourceState.collapsedSites;
        }
      }

      // C017 ADDED (spec R7 · RULE-TRACK-001 의 자국) — **발자국도 한꺼번에 없다.**
      // 확정 8 이 묻을 것으로 든 셋(캔 자국 · 무너진 자리 · 지나간 자국)이 이로써 다 찬다.
      // 아직 나이가 안 된 자국도 함께 묻힌다 (spec SPEC-008 경계 ②) — 뒤척임은 나이를 묻지
      // 않는다. 밝히지 않은 방의 자국은 나이로만 사라진다 (경계 ① · RULE-TRACK-FADE-001).
      // 빈 배열을 남기지 않고 자리 자체를 지운다 — 없는 것은 자리가 없다.
      delete regionState.tracks;
    }

    // ② 자리를 옮기는 원천을 **다음 마디**로 — 캐지 않았어도 옮긴다 (SPEC-006).
    // 마디가 하나뿐인 원천도 · 무너지지 않은 마디가 하나도 없는 원천도 옮기지 않는다
    // (C013 의 nextStandableSite 그대로 — 지날 수 없는 자리에 세우지 않는다).
    // 모르는 원천 id 는 조용히 지나간다: 데이터가 없는 것을 세우지 않는다.
    const sources = regionState.sources;
    if (!sources) continue;
    for (const sourceId of onTurn.migrateSources ?? []) {
      const source = sourcesInRegion(spec.id).find((entry) => entry.id === sourceId);
      const sourceState = source ? sources[source.id] : undefined;
      if (!source || !sourceState) continue;
      const next = nextStandableSite(source, sourceState.siteIndex, sourceState.collapsedSites);
      if (next !== null) sourceState.siteIndex = next;
    }
  }
}
