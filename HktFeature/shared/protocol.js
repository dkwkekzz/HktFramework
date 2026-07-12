// ============================================================================
// 프로토콜 — 메시지 종류 단일 출처 (최소 원장 코어)
//
// 프로토타입은 디버깅 편의를 위해 JSON 을 쓴다. 인코딩이 이 파일에
// 집중되어 있으므로, 이후 tx 스트림만 바이너리로 교체하면 된다(feature).
//
// 동기화되는 "상태" 는 오직 에너지 잔고뿐이다. 그 외 메시지는
//   - beacon: 저빈도 양자화 좌표 (relevancy + 예산 검증용, 권위 아님)
//   - enter/leave: 관심영역 출입 사실 (원장 미러의 시야 경계)
// ============================================================================

export const MSG = {
  // 클라 → 서버
  HELLO: 'hello',        // { name }
  BEACON: 'beacon',      // { x, y, z }  (정수 양자화 3D 좌표)
  RESYNC: 'resync',      // { regions: [key] } — 체크섬 불일치 지역의 스냅샷 요청
  DESIRE: 'desire',      // { desire } — 내가 제어하는 생명체에 욕망을 부여(채집·사냥·대기, 구 feature-0010(현 0018). 스택 교체)
  INJECT: 'inject',      // { desire, priority?, emotion? } — 욕구를 스택에 주입(중첩)한다(구 feature-0012(현 0018)). 감정으로 우선순위 증폭. 같은 욕구는 dedup(우선순위만 갱신)
  TARGET: 'target',      // { kind:'crystal'|'creature'|'none', seq } — 클릭/터치로 **지정한 표적**(구 feature-0010(현 0018) step4). 서버가 표적 종류로 욕구를 추론(결정=식사·더 작은 생명체=사냥)해 그 특정 표적으로 가서 상호작용. kind='none'=해제(대기→수동이동)

  // 서버 → 클라
  WELCOME: 'welcome',    // { playerId, name, seed, tick, total, src, x, y, z }
  OPS: 'ops',            // { tick, ops: [{ op:'tx', seq, from, to, amount, cause, at? }] }
  CHECKSUM: 'checksum',  // { tick, total, regions: { key: sum } }
  SNAPSHOT: 'snapshot',  // { regions: [key], pools: [{ id, balance, max, region }] }
  POS: 'pos',            // { moves: [[id, x, y, z]] } — 관심영역 내 좌표 비콘 릴레이 (권위 아님, 표시용)
  FIELD: 'field',        // { cells: [[cx, cy, cz, balance]] } — 국소장 복셀 그리드 스냅샷 (feature-0004 step2, 표시용·읽기전용)
  CRYSTAL: 'crystal',    // { cells: [[id, x, y, z, balance, species, raw, crafted, tier]] } — 개별 결정 스냅샷 (feature-0005 · raw=날것 f0011 · crafted=산물 f0010 s2 · tier=제조 단계 f0011 s2. 표시용·읽기전용)
  CREATURE: 'creature',  // { cells: [[seq, x, y, z, balance, size, desire, owner, desires, items, cmd]] } — 생명체 스냅샷 (feature-0006 size=스탯, 구 feature-0010(현 0018) desire=승자 욕망·owner=제어자·cmd=지정 표적 [kindCode,seq] 또는 0(step4), 구 feature-0012(현 0018) desires=중첩 스택. 표시용·읽기전용)
  FIREBALL: 'fireball',  // { cells: [[seq, x, y, z, balance, size]] } — 파이어볼(투사체) 스냅샷 (feature-0009 발산이 쏜 비행체, 매 틱 방송해 날아가는 걸 보인다. 착탄 시 사라지고 폭발=0013 규칙 D. 표시용·읽기전용)
  ENTER: 'enter',        // { entities: [{ id, kind, name, x, y, z, balance, max }] } — 시야 진입
  LEAVE: 'leave',        // { ids: [] } — 시야 이탈 (미러에서 잊기)
  TELEPORT: 'teleport',  // { x, y, z } — 비콘 예산 위반 시 위치 정정

  // 틱 플러시 순서 규약: LEAVE → OPS → ENTER → POS → CHECKSUM
  //   OPS 가 ENTER 앞이어야 "이번 틱 tx + 틱 종료 잔고 ENTER" 이중 적용이 없다.
};

export function encode(type, payload) {
  return JSON.stringify({ t: type, ...payload });
}

export function decode(raw) {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  // 브라우저 WebSocket 이 ArrayBuffer 로 줄 수 있어 방어적으로 문자열화 (JSON 프로토콜)
  if (raw instanceof ArrayBuffer) { try { return JSON.parse(new TextDecoder().decode(raw)); } catch { return null; } }
  if (raw instanceof Uint8Array) { try { return JSON.parse(new TextDecoder().decode(raw)); } catch { return null; } }
  return null;
}
