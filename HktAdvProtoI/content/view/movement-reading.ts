// Movement Reading — 나아가지 못하는 몸이 **왜** 서 있는가 (RoomBecomesLand 실주행 판정 Q6 ADDED).
//
// place-reading · being-reading 의 형제다. 세계에 아무것도 묻지 않는다 (패킷도 왕복도 0):
// 여기 읽는 것은 전부 **이미 봉투에 실려 온** 것이다 — 내 몸의 자리 · 같은 방 몸들의 자리와
// 반경(body) · 내 발밑의 땅(내 Description). 그리고 조립이 쥔 값 하나 — "지금 걸으려 하는가".
//
// 왜 필요한가 — 세계의 거절은 전부 문구로 뜨고 기록에 남는다 (C028). 그런데 거절이 아니라
// **진행이 멎는** 경우가 있다: 요청은 받아들여졌는데 몸이 나아가지 않는다. 몸 충돌(RULE-BODY-PUSH-001)
// 은 아무 말도 하지 않고, 이동 진행은 발밑의 땅을 읽지 않으므로(RULE-MOVE-PROGRESS-001) 밀려서
// 막힌 땅 위에 선 몸도 아무 말을 듣지 못한다. Human 은 그것을 "이유 없이 못 움직인다" 로 겪었다.
// 이 파일은 그 침묵을 **관찰자 쪽에서** 깬다 — 세계는 한 줄도 바뀌지 않는다.
//
// **없는 것은 지어내지 않는다.** 막는 몸이 없고 발밑도 막히지 않았으면 "무언가에 막혀 있다" 까지만
// 말한다 — 세계가 말하지 않은 원인을 화면이 짓지 않는다.

import type { GameViewSnapshot as CoreGameViewSnapshot } from '../../engine/protocol-core/gameview';
import type { GameViewSnapshot } from '../protocol/gameview';
import { codeText } from './code-text';
import { readPlace } from './place-reading';

/**
 * 걸으려 하는데 이만큼의 시간 동안 이만큼도 못 나아갔으면 **멎었다**고 본다.
 *
 * 0.6 초 · 0.25 — 관찰 결과가 세계 Tick(1/30 초)마다 오고 걷는 빠르기가 6 이므로, 나아가고
 * 있는 몸은 0.6 초에 3 남짓 옮겨진다. 0.25 는 그 십분의 일이고 밀리는 몸이 제자리에서 떠는
 * 폭(관성의 정지 속도 0.02 × 마찰)보다는 넉넉히 크다. 값은 전부 표현의 것이다 — 세계의
 * 결정론에 닿지 않는다.
 */
export const STALL_SECONDS = 0.6;
export const STALL_DISTANCE = 0.25;

/**
 * 몸 둘의 중심 거리가 반경의 합에 이만큼을 더한 것보다 가까우면 **닿아 있다**고 본다.
 * 밀어내기(RULE-BODY-PUSH-001)는 겹침이 0 이 되는 자리에서 멎으므로, 밀려 선 몸은 정확히
 * 반경의 합만큼 떨어져 있다 — 그 자리를 놓치지 않으려는 여유다.
 */
export const CONTACT_SLACK = 0.2;

/** 조립이 프레임 사이에 쥐는 값 — 어디서부터 재기 시작했고, 얼마나 멎어 있었고, 이미 말했는가 */
export interface StallWatch {
  anchor?: { x: number; z: number };
  held: number;
  announced: boolean;
}

export function createStallWatch(): StallWatch {
  return { held: 0, announced: false };
}

/**
 * RULE-STALL-NOTICE-001 — 걸으려 하는데 나아가지 못하면 **한 번** 이유를 말한다.
 *
 * 걷기를 그만두거나 다시 나아가면 재는 것을 처음부터 다시 한다 — 그래서 같은 자리에 다시
 * 막히면 다시 말하고, 막힌 채로 서 있는 동안에는 되풀이하지 않는다 (판의 기록이 같은 말로
 * 차는 것을 막는다 · C028 SPEC-005 의 뜻).
 *
 * 돌려주는 것은 **말이 있을 때만** 있다 — 없으면 undefined 이고 조립은 아무 일도 하지 않는다
 * (regionNotice 와 같은 어법).
 */
export function watchStall(
  watch: StallWatch,
  observed: CoreGameViewSnapshot,
  moving: boolean,
  dt: number,
): string | undefined {
  // 봉투 형으로 도착한 것을 팩 형으로 좁힌다 (regionNotice 와 같은 자리 · 같은 어법)
  const snapshot = observed as GameViewSnapshot;
  const self = snapshot.entities.find((e) => e.id === snapshot.observer.characterId);
  if (!moving || !self) {
    watch.anchor = undefined;
    watch.held = 0;
    watch.announced = false;
    return undefined;
  }
  const here = self.position;
  const anchor = watch.anchor;
  if (!anchor || Math.hypot(here.x - anchor.x, here.z - anchor.z) >= STALL_DISTANCE) {
    // 나아갔다 — 여기서부터 다시 잰다. 한 번 말한 뒤 다시 나아갔으면 다음 멈춤에 다시 말한다
    watch.anchor = { x: here.x, z: here.z };
    watch.held = 0;
    watch.announced = false;
    return undefined;
  }
  watch.held += dt;
  if (watch.announced || watch.held < STALL_SECONDS) return undefined;
  watch.announced = true;
  return stallNotice(snapshot);
}

/**
 * 나아가지 못하는 이유 — 막는 몸이 있으면 그 이름들, 없으면 발밑의 땅, 그것도 아니면
 * 막혀 있다는 것까지만.
 */
export function stallNotice(snapshot: GameViewSnapshot): string {
  const bodies = blockingBodies(snapshot);
  if (bodies.length > 0) return codeText('move.blocked-by-body', bodies.join(' · '));
  const self = snapshot.entities.find((e) => e.id === snapshot.observer.characterId);
  const reason = self ? readPlace(snapshot, self.position).ground?.blockedReason : undefined;
  if (reason !== undefined) return codeText('move.stalled-on', codeText(reason));
  return codeText('move.stalled');
}

/**
 * 내 몸에 **닿아 있는** 다른 몸들의 이름 — 봉투의 차례 그대로다.
 *
 * 이름은 존재의 것이고(name), 없으면 종류의 문구, 그것도 없으면 id 다 — 판이 존재를 부르는
 * 그 차례 그대로다 (target-frame-presentation 의 beingTitle). 몸(body)이 실리지 않은 것은
 * 닿을 수 없으므로 세지 않는다 (원천 · 출구 표식).
 */
export function blockingBodies(snapshot: GameViewSnapshot): string[] {
  const self = snapshot.entities.find((e) => e.id === snapshot.observer.characterId);
  if (!self?.body) return [];
  const names: string[] = [];
  for (const other of snapshot.entities) {
    if (other.id === self.id || !other.body) continue;
    const distance = Math.hypot(other.position.x - self.position.x, other.position.z - self.position.z);
    if (distance > self.body.radius + other.body.radius + CONTACT_SLACK) continue;
    names.push(other.name ?? (other.kind !== undefined ? codeText(other.kind) : other.id));
  }
  return names;
}

/**
 * 자판 걸음이 요청하는 **앞 지점까지의 거리** — 빠르기를 따른다.
 *
 * 관찰 결과는 세계보다 한 걸음 늦게 온다 (Tick 1/30 초 + 이어짐). 늦은 자리에서 고정 거리
 * 앞을 요청하면 달리는 몸(6 × 1.8 = 10.8/초)은 요청한 자리에 이미 닿아 있거나 지나쳐 있어
 * 한 요청마다 서고 되돌아본다 — 걷는 것이 끊긴다. 그래서 빠를수록 더 앞을 본다: 0.25 초
 * 몫이다 (걷기 1.5 → 아래 최소 1.6 · 달리기 2.7). 최소 1.6 은 지금까지의 한 걸음이고
 * (강 폭 8 · 미로 통로 폭 8 이 이 값의 다섯 배로 잡혀 있다), 달리기의 2.7 도 그 셋 아래다.
 *
 * 빠르기를 모르는 봉투(몸의 속성이 실리지 않음)에서는 지금까지의 한 걸음 그대로다.
 */
export const KEY_LOOKAHEAD_MIN = 1.6;
export const KEY_LOOKAHEAD_SECONDS = 0.25;

export function keyLookahead(observed: CoreGameViewSnapshot): number {
  const snapshot = observed as GameViewSnapshot;
  const self = snapshot.entities.find((e) => e.id === snapshot.observer.characterId);
  const attributes = self?.attributes;
  if (!attributes) return KEY_LOOKAHEAD_MIN;
  const run = attributes.moveMode === 'run' ? attributes.tempoStats.runSpeedMultiplier : 1;
  const speed = attributes.tempoStats.moveSpeed * attributes.modifiers.moveSpeed * run;
  return Math.max(KEY_LOOKAHEAD_MIN, speed * KEY_LOOKAHEAD_SECONDS);
}
