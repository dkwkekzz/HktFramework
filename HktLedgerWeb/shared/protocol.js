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

import { POOL, CAUSE, FIELD_GRID } from './constants.js';

export const MSG = {
  // 클라 → 서버
  HELLO: 'hello',        // { name }
  BEACON: 'beacon',      // { x, y, z }  (정수 양자화 3D 좌표)
  INTENT: 'intent',      // { iid, kind, ... } kind: gather|attack|condense|craft|use|drop|pickup
  RESYNC: 'resync',      // { regions: [key] } — 체크섬 불일치 지역의 스냅샷 요청

  // 서버 → 클라
  WELCOME: 'welcome',    // { playerId, name, seed, tick, total, src, sink, x, y, z }
  OPS: 'ops',            // { tick, ops: [...] } — tx 와 사실 이벤트의 "인과 순서" 단일 스트림
                         //   { op:'tx', seq, from, to, amount, cause, at?, iid? }
                         //   { op:'event', kind: death|respawn|item-spawn|item-gone|pickup, ... }
  CHECKSUM: 'checksum',  // { tick, total, regions: { key: sum } }
  SNAPSHOT: 'snapshot',  // { regions: [key], pools: [{ id, balance, max, region }] } — 지역 단위 복구
  POS: 'pos',            // { moves: [[id, x, y, z]] } — 관심영역 내 3D 좌표 비콘 릴레이 (권위 아님, 표시용)
  ENTER: 'enter',        // { entities: [{ id, kind, x, y, z, balance, max, ... }] } — 시야 진입 (틱 종료 잔고)
  LEAVE: 'leave',        // { ids: [] } — 시야 이탈 (미러에서 잊기)
  REJECT: 'reject',      // { iid, reason }
  TELEPORT: 'teleport',  // { x, y, z } — 비콘 예산 위반·리스폰 시 위치 정정

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
  GROW: 'grow',          // { amount? }   A6-2 성장: 자유 에너지 → 구조 풀 예치
  SKILL: 'skill',        // { skillId, targetId }  A6-4 스킬: 비용 있는 증폭 이체 패턴
};

export function encode(type, payload) {
  return JSON.stringify({ t: type, ...payload });
}

export function decode(raw) {
  if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return null; } }
  // 바이너리 프레임 (Node Buffer 는 Uint8Array 서브클래스, 브라우저는 ArrayBuffer)
  let bytes = null;
  if (raw instanceof Uint8Array) bytes = raw;
  else if (raw instanceof ArrayBuffer) bytes = new Uint8Array(raw);
  if (!bytes || bytes.length === 0) return null;
  if (bytes[0] === OPS_MAGIC) return decodeOpsFrame(bytes);
  return null;
}

// ============================================================================
// A4 — tx 스트림 16B 바이너리 인코딩 (대역폭 절감, 인코딩은 이 파일 한 곳)
//
// OPS 메시지가 "tx 만" + "iid 가 숫자/없음" 일 때 고정폭 프레임으로 보낸다.
// 이벤트가 섞이거나 문자열 iid 면 JSON 으로 폴백 → 인과 순서·하위호환 유지.
// 클라가 안 쓰는 seq·at 는 담지 않는다 (그 자체가 절감).
//
// DataView/ArrayBuffer 는 ES 표준(Node/브라우저 공통) — shared 순수성 유지.
// ============================================================================

const OPS_MAGIC = 0xB1;         // 바이너리 OPS 프레임 식별 (JSON '{' = 0x7B 와 구분)
const TX_RECORD_BYTES = 16;
const OPS_HEADER_BYTES = 8;

// 원인 태그 ↔ 코드 (순서 고정 — 클라·서버 공용 안정 코드)
const CAUSE_LIST = [
  CAUSE.SPAWN, CAUSE.MOVE, CAUSE.GATHER, CAUSE.REGEN, CAUSE.ATTACK_COST,
  CAUSE.DAMAGE_LEECH, CAUSE.DAMAGE_BURN, CAUSE.WEAPON_WEAR, CAUSE.CONDENSE,
  CAUSE.DISSOLVE, CAUSE.DEATH_DROP, CAUSE.DIFFUSE, CAUSE.UPKEEP,
];
const CAUSE_CODE = new Map(CAUSE_LIST.map((c, i) => [c, i]));
const PT = { [POOL.PLAYER[0]]: 0, [POOL.NODE[0]]: 1, [POOL.MOB[0]]: 2, [POOL.ITEM[0]]: 3, [POOL.CELL[0]]: 4 };

// 풀 id → u32 (type<<24 | index). 인코딩 불가면 -1.
function encodePoolId(id) {
  if (id === POOL.SOURCE) return 5 << 24;
  if (id === POOL.SINK) return 6 << 24;
  const code = PT[id[0]];
  if (code === undefined) return -1;
  const rest = id.slice(2);
  let index;
  if (code === 4) { // 셀 "F:cx_cy"
    const us = rest.indexOf('_');
    const cx = Number(rest.slice(0, us)), cy = Number(rest.slice(us + 1));
    index = cx * FIELD_GRID + cy;
  } else index = Number(rest);
  if (!Number.isInteger(index) || index < 0 || index > 0xFFFFFF) return -1;
  return ((code << 24) | index) >>> 0;
}

function decodePoolId(u32) {
  const code = u32 >>> 24, index = u32 & 0xFFFFFF;
  switch (code) {
    case 0: return `${POOL.PLAYER}${index}`;
    case 1: return `${POOL.NODE}${index}`;
    case 2: return `${POOL.MOB}${index}`;
    case 3: return `${POOL.ITEM}${index}`;
    case 4: return `${POOL.CELL}${Math.floor(index / FIELD_GRID)}_${index % FIELD_GRID}`;
    case 5: return POOL.SOURCE;
    case 6: return POOL.SINK;
  }
  return null;
}

function txEncodable(op) {
  if (op.op !== 'tx') return false;
  if (encodePoolId(op.from) < 0 || encodePoolId(op.to) < 0) return false;
  if (!CAUSE_CODE.has(op.cause)) return false;
  if (!(Number.isInteger(op.amount) && op.amount >= 0 && op.amount <= 0xFFFFFFFF)) return false;
  const iid = op.iid;
  if (iid != null && !(Number.isInteger(iid) && iid > 0 && iid <= 0xFFFF)) return false;
  return true;
}

// OPS 를 바이너리(Uint8Array) 또는 JSON(string) 으로 인코딩 — game.js #flush 가 호출.
export function encodeOps(tick, ops) {
  if (ops.length === 0 || !ops.every(txEncodable)) return encode(MSG.OPS, { tick, ops });
  const buf = new ArrayBuffer(OPS_HEADER_BYTES + ops.length * TX_RECORD_BYTES);
  const dv = new DataView(buf);
  dv.setUint8(0, OPS_MAGIC);
  dv.setUint8(1, 1); // 버전
  dv.setUint32(2, tick >>> 0, true);
  dv.setUint16(6, ops.length, true);
  let o = OPS_HEADER_BYTES;
  for (const op of ops) {
    dv.setUint32(o, encodePoolId(op.from), true);
    dv.setUint32(o + 4, encodePoolId(op.to), true);
    dv.setUint32(o + 8, op.amount >>> 0, true);
    dv.setUint8(o + 12, CAUSE_CODE.get(op.cause));
    dv.setUint16(o + 13, op.iid ?? 0, true);
    dv.setUint8(o + 15, 0);
    o += TX_RECORD_BYTES;
  }
  return new Uint8Array(buf);
}

function decodeOpsFrame(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tick = dv.getUint32(2, true);
  const count = dv.getUint16(6, true);
  const ops = [];
  let o = OPS_HEADER_BYTES;
  for (let i = 0; i < count; i++) {
    const op = {
      op: 'tx',
      from: decodePoolId(dv.getUint32(o, true)),
      to: decodePoolId(dv.getUint32(o + 4, true)),
      amount: dv.getUint32(o + 8, true),
      cause: CAUSE_LIST[dv.getUint8(o + 12)],
    };
    const iid = dv.getUint16(o + 13, true);
    if (iid) op.iid = iid;
    ops.push(op);
    o += TX_RECORD_BYTES;
  }
  return { t: MSG.OPS, tick, ops };
}
