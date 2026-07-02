// ============================================================================
// 프로토콜 — 메시지 종류 단일 출처
//
// 프로토타입은 디버깅 편의를 위해 JSON 을 쓴다. 인코딩이 이 파일에
// 집중되어 있으므로, 이후 tx 스트림만 16B 바이너리로 교체하면 된다.
//
// 동기화되는 "상태" 는 오직 에너지 잔고뿐이다. 그 외 메시지는
//   - intent: 클라의 요청 (서버가 클램프·중재)
//   - beacon: 저빈도 양자화 좌표 (relevancy + 예산 검증용, 권위 아님)
//   - enter/leave: 관심영역 출입 사실 (원장 미러의 시야 경계)
// ============================================================================

export const MSG = {
  // 클라 → 서버
  HELLO: 'hello',        // { name }
  BEACON: 'beacon',      // { x, y }  (정수 양자화)
  INTENT: 'intent',      // { iid, kind, ... } kind: gather|attack|condense|craft|use|drop|pickup
  RESYNC: 'resync',      // { regions: [key] } — 체크섬 불일치 지역의 스냅샷 요청

  // 서버 → 클라
  WELCOME: 'welcome',    // { playerId, name, seed, tick, total, src, sink, x, y }
  OPS: 'ops',            // { tick, ops: [...] } — tx 와 사실 이벤트의 "인과 순서" 단일 스트림
                         //   { op:'tx', seq, from, to, amount, cause, at?, iid? }
                         //   { op:'event', kind: death|respawn|item-spawn|item-gone|pickup, ... }
  CHECKSUM: 'checksum',  // { tick, total, regions: { key: sum } }
  SNAPSHOT: 'snapshot',  // { regions: [key], pools: [{ id, balance, max, region }] } — 지역 단위 복구
  POS: 'pos',            // { moves: [[id, x, y]] } — 관심영역 내 좌표 비콘 릴레이 (권위 아님, 표시용)
  ENTER: 'enter',        // { entities: [{ id, kind, x, y, balance, max, ... }] } — 시야 진입 (틱 종료 잔고)
  LEAVE: 'leave',        // { ids: [] } — 시야 이탈 (미러에서 잊기)
  REJECT: 'reject',      // { iid, reason }
  TELEPORT: 'teleport',  // { x, y } — 비콘 예산 위반·리스폰 시 위치 정정

  // 틱 플러시 순서 규약: LEAVE → OPS → ENTER → POS → CHECKSUM
  //   OPS 가 ENTER 앞이어야 "이번 틱 tx + 틱 종료 잔고 ENTER" 이중 적용이 없다.
  //   (시야 밖 풀을 건드린 tx 는 클라가 skip, 직후 ENTER 가 정확한 잔고를 싣는다)
};

export const INTENT = {
  GATHER: 'gather',      // { nodeId }
  ATTACK: 'attack',      // { targetId }  (플레이어 또는 몬스터)
  CONDENSE: 'condense',  // {}            에너지 100 → 결정 아이템
  CRAFT: 'craft',        // {}            에너지 250 → 무기 아이템
  USE: 'use',            // { itemId }    결정 용해 → 에너지 회복
  DROP: 'drop',          // { itemId }
  PICKUP: 'pickup',      // { itemId }
};

export function encode(type, payload) {
  return JSON.stringify({ t: type, ...payload });
}

export function decode(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}
