// RULE-TRACK-001 — Implements C017 spec R5 (ADDED)
// Scope          모든 방 · 모든 몸 (관찰자 · 자율 존재 구분 없음 — 미로의 압력의 선례)
// Trigger        이동으로 몸의 자리가 바뀐다 (RULE-MOVE-PROGRESS-001 이 적은 movedThisTick)
// Condition      마지막 자국 뒤로 걸은 거리가 표본 간격(TRACK_STEP_DISTANCE)에 닿았다
// Transition     그 몸이 선 방의 tracks 에 자국 하나 (자리 · 그 몸이 향한 쪽 · 지금 시각) ·
//                Actor.distanceSinceTrack = 0 ·
//                상한(TRACK_LIMIT_PER_REGION)을 넘으면 가장 오래된 것부터 없다
// Result         (없음 — 땅이 잠깐 기억할 뿐이다. 누가 지나갔는지는 관찰 결과가 말하지 않는다)
//
// RULE-TRACK-FADE-001 — Implements C017 spec R6 (ADDED · 세계 과정)
// Scope          모든 방
// Trigger        세계의 Tick
// Condition      자국의 나이가 TRACK_LIFETIME_SECONDS 를 넘었다
// Transition     그 자국은 없다. 한 방의 자국이 하나도 남지 않으면 그 자리 자체가 없다
// Result         (없음 — 관찰자와 무관하다. 아무도 없어도 옅어진다)
//
// **누구인지는 남지 않는다** (Play 확정 11 · spec R5 경계 ①) — 관찰자의 이름도 몸의 id 도
// 자국에 실리지 않는다. 그래서 **자율 존재의 걸음도 똑같이 자국을 남긴다** (기본형 ⑪):
// 누가 남겼는지 말하지 않는 자국이 몸을 가려 받으면 그 자체가 이름을 절반 싣는 것이 된다.
//
// **거리가 자국을 낳는다** (spec SPEC-007 경계 ③) — 서 있기만 하면 아무리 오래여도 늘지 않는다.
// 걸은 거리는 몸의 것이므로 **방을 건너도 이어지고**(경계 ②), 자국은 그때 **선 방**에 난다.
//
// **규칙은 방의 이름도 몸의 이름도 알지 못한다** — 아는 것은 "움직인 몸" 과 "그 몸이 선 방" 뿐이다.

import type { WorldState } from '../semantic/world-state';
import { regionStateOf, type Track } from '../semantic/region-state';
import {
  TRACK_LIFETIME_SECONDS,
  TRACK_LIMIT_PER_REGION,
  TRACK_STEP_DISTANCE,
} from '../semantic/world-state';

/**
 * RULE-TRACK-001 (C017 ADDED · spec R5) — **몸이 지나가면 자국이 남는다.**
 *
 * 걸음 바로 뒤에 선다 (미로의 압력 곁 · spec R10) — 같은 tick 의 movedThisTick 을 읽어야
 * 하고, 다른 무엇이 자리를 건드리기 전이어야 자국이 **지나온 자리**에 난다.
 *
 * 한 tick 에 표본 간격을 여러 번 넘겨도 자국은 하나다 — 걸음(0.1 남짓)이 간격(4.0)보다
 * 훨씬 작으므로 그 일은 큰 걸음에서만 생기고, 그때도 자국이 뭉치는 것보다 성긴 편이 낫다.
 * 남은 거리를 0 으로 되돌리는 것은 그 뜻이다 (넘친 만큼을 이어 세면 다음 자국이 곧바로 난다).
 *
 * 몸 순회 순서는 state.actors 순서다 (결정론 — 미로의 압력이 그러는 그대로).
 */
export function ruleTrackLay(state: WorldState): void {
  for (const actor of state.actors) {
    if (!(actor.movedThisTick > 0)) continue;
    actor.distanceSinceTrack += actor.movedThisTick;
    if (actor.distanceSinceTrack < TRACK_STEP_DISTANCE) continue;
    actor.distanceSinceTrack = 0;

    // 소란이 모든 방에 서므로 방의 State 는 언제나 있다 — 없으면 여기서 세운다
    // (짓는 자리는 semantic/region-state.ts 하나다).
    const regionState = regionStateOf(state.regionStates, actor.regionId);
    const tracks = (regionState.tracks ??= []);
    const track: Track = {
      position: { x: actor.position.x, z: actor.position.z },
      // 방향은 그 몸이 향한 쪽이다 — 걸음이 방금 갱신한 값이다 (RULE-BODY-FACING-001).
      heading: { x: actor.facing.x, z: actor.facing.z },
      at: state.time,
    };
    tracks.push(track);

    // 상한을 넘으면 **가장 오래된 것부터** 없다 (spec R5 경계 ③ · SPEC-008 경계 ③).
    // 저장되는 값이므로 상한이 없으면 여럿이 오래 머문 방의 스냅샷이 끝없이 커진다.
    if (tracks.length > TRACK_LIMIT_PER_REGION) {
      tracks.splice(0, tracks.length - TRACK_LIMIT_PER_REGION);
    }
  }
}

/**
 * RULE-TRACK-FADE-001 (C017 ADDED · spec R6) — **자국이 나이로 사라진다.**
 *
 * 뒤척임 뒤에 선다 (spec R10) — 뒤척인 뒤의 값은 그 Tick 부터 새로 굴러간다.
 * 뒤척임이 묻은 방에는 여기서 볼 자국이 이미 없다 (RULE-SEASON-TURN-001).
 *
 * 하나도 남지 않으면 **자리 자체를 지운다** — 빈 배열로 남기지 않는다 (없는 것은 자리가 없다).
 * 난 순서가 곧 오래된 순서이므로 앞에서부터 자르면 된다.
 */
export function ruleTrackFade(state: WorldState): void {
  for (const regionState of Object.values(state.regionStates)) {
    const tracks = regionState.tracks;
    if (!tracks) continue;
    const kept = tracks.filter((track) => state.time - track.at <= TRACK_LIFETIME_SECONDS);
    if (kept.length === 0) delete regionState.tracks;
    else if (kept.length !== tracks.length) regionState.tracks = kept;
  }
}
