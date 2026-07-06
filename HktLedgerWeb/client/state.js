// ============================================================================
// ClientState — 미러 원장 + 시야 모델 (설계 문서 §3)
//
// 클라이언트가 아는 "권위 상태" 는 서버가 확정한 tx 스트림뿐이다.
// 월드 배치는 시드에서 유도하고, 시야(ENTER/LEAVE) 경계 안의 풀만 미러링하며,
// 지역 체크섬으로 미러의 정합을 검증한다. 불일치 = 그 지역만 재동기화.
// ============================================================================

import { EnergyLedger } from '../shared/ledger.js';
import { generateWorld } from '../shared/worldgen.js';
import {
  POOL, PLAYER_MAX_ENERGY, CRYSTAL_COST, WEAPON_COST, regionKey,
} from '../shared/constants.js';

export class ClientState {
  constructor() {
    this.playerId = null;
    this.myName = '';
    this.ledger = new EnergyLedger();
    this.entities = new Map();  // id -> { id, kind, x, y, tx, ty, name?, itemType? } (표시용)
    this.inventory = new Map(); // id -> { itemType }
    this.pending = new Map();   // iid -> { delta } 낙관 예측 (서버 tx/reject 로 해소)
    this.nodesById = new Map();
    this.mobsById = new Map();
    this.txFeed = [];           // 최근 tx 표시용
    this.worldTotal = 0;        // 서버가 선언한 전 풀 합계 — 보존 불변식의 전시
    this.checksumStatus = 'WAIT';
    this.dead = false;
    this.onResync = null;       // (regionKeys) => void
    this.onTeleport = null;     // ({x,y}) => void
  }

  // 표시용 에너지 = 미러 잔고 + 미확정 예측 (서버 확정 시 자연 수렴)
  displayEnergy() {
    let e = this.ledger.balance(this.playerId);
    for (const p of this.pending.values()) e += p.delta;
    return Math.max(0, Math.min(PLAYER_MAX_ENERGY, e));
  }

  predict(iid, delta) {
    this.pending.set(iid, { delta, at: performance.now() });
    // 서버 응답 유실 대비 — 2초 지나면 예측 파기 (권위는 어차피 원장)
    setTimeout(() => this.pending.delete(iid), 2000);
  }

  handle(msg) {
    switch (msg.t) {
      case 'welcome': return this.#onWelcome(msg);
      case 'enter': return this.#onEnter(msg);
      case 'leave': return this.#onLeave(msg);
      case 'ops': return this.#onOps(msg);
      case 'pos': return this.#onPos(msg);
      case 'checksum': return this.#onChecksum(msg);
      case 'snapshot': return this.#onSnapshot(msg);
      case 'teleport': return this.onTeleport?.(msg);
      case 'reject': return this.pending.delete(msg.iid);
    }
  }

  #onWelcome(msg) {
    this.playerId = msg.playerId;
    this.myName = msg.name;
    this.worldTotal = msg.total;
    // 잔고 0 기준점 — 스폰 인출은 곧 도착할 tx 가 채운다
    this.ledger.mirrorSet(this.playerId, 0, PLAYER_MAX_ENERGY, null);
    this.ledger.mirrorSet(POOL.SOURCE, msg.src, Number.MAX_SAFE_INTEGER, null);
    this.ledger.mirrorSet(POOL.SINK, msg.sink, Number.MAX_SAFE_INTEGER, null);
    const world = generateWorld(msg.seed);
    for (const n of world.nodes) this.nodesById.set(n.id, n);
    for (const m of world.mobs) this.mobsById.set(m.id, m);
    this.onTeleport?.(msg);
  }

  #onEnter(msg) {
    for (const e of msg.entities) {
      let x = e.x, y = e.y, z = e.z, max = e.max;
      if (e.kind === 'node') ({ x, y, z, max } = this.nodesById.get(e.id)); // 배치는 시드 유도
      if (e.kind === 'mob') ({ x, y, z, max } = this.mobsById.get(e.id));
      const region = e.kind === 'player' ? null : regionKey(x, y); // 파티션은 컬럼(x,y)
      this.ledger.mirrorSet(e.id, e.balance, max, region);
      this.entities.set(e.id, {
        id: e.id, kind: e.kind, x, y, z, tx: x, ty: y, tz: z,
        name: e.name, itemType: e.itemType, max,
      });
      // 내 인벤토리 아이템이 땅에 나타났다 = 드랍(사망 포함)된 것
      if (this.inventory.has(e.id)) this.inventory.delete(e.id);
    }
  }

  #onLeave(msg) {
    for (const id of msg.ids) {
      this.entities.delete(id);
      this.ledger.forget(id); // 관측 중단이지 소멸이 아니다 — 재진입 시 ENTER 가 복원
    }
  }

  // tx 와 사실 이벤트를 서버가 커밋한 인과 순서 그대로 재생한다
  #onOps(msg) {
    for (const op of msg.ops) {
      if (op.op === 'tx') this.#applyTx(op);
      else this.#applyEvent(op);
    }
    if (this.txFeed.length > 8) this.txFeed.splice(0, this.txFeed.length - 8);
  }

  #applyTx(tx) {
    if (tx.iid) this.pending.delete(tx.iid); // 예측 → 확정 치환
    // 시야 밖 액터의 무지역 풀(플레이어·타인 인벤토리)은 잔고 0 으로 물질화한다.
    // 무지역 풀은 체크섬 대상이 아니라 오차가 무해하고(ENTER 가 오면 정정),
    // 덕분에 시야 "안" 의 지역 풀(노드·몬스터) 쪽 절반이 유실되지 않는다 —
    // 예: 내 시야 경계 밖 플레이어가 시야 안 노드를 채집하는 경우.
    for (const id of [tx.from, tx.to]) {
      if (this.ledger.get(id)) continue;
      if (id.startsWith(POOL.PLAYER) || id.startsWith(POOL.ITEM)) {
        this.ledger.mirrorSet(id, 0, Number.MAX_SAFE_INTEGER, null);
      } else if (id.startsWith(POOL.CELL)) {
        // 필드 셀은 서버 내부 저수지(SOURCE/SINK 급) — 클라는 잔고를 추적하지 않는다.
        // 무한 저수지로 물질화해 셀→노드 재충전 tx 재생 시 노드가 전액을 받게 한다
        // (region=null → 체크섬 무관, 셀 쪽 잔고 오차는 무해).
        this.ledger.mirrorSet(id, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, null);
      }
    }
    this.ledger.applyTx(tx); // 지역 풀 끝단이 시야 밖인 tx 는 skip — 체크섬이 잡는다
    this.txFeed.push(tx);
  }

  #applyEvent(ev) {
    switch (ev.kind) {
      case 'item-spawn': {
        const max = ev.itemType === 'weapon' ? WEAPON_COST : CRYSTAL_COST;
        this.ledger.mirrorSet(ev.id, 0, max, null);
        this.inventory.set(ev.id, { itemType: ev.itemType });
        break;
      }
      case 'pickup':
        this.ledger.mirrorSet(ev.id, ev.balance, ev.max, null);
        this.inventory.set(ev.id, { itemType: ev.itemType });
        this.entities.delete(ev.id);
        break;
      case 'item-gone':
        this.inventory.delete(ev.id);
        this.ledger.forget(ev.id);
        break;
      case 'death':
        if (ev.id === this.playerId) this.dead = true;
        break;
      case 'respawn':
        if (ev.id === this.playerId) this.dead = false;
        break;
    }
  }

  #onPos(msg) {
    for (const [id, x, y, z] of msg.moves) {
      const e = this.entities.get(id);
      if (e) { e.tx = x; e.ty = y; e.tz = z; }
    }
  }

  #onChecksum(msg) {
    this.worldTotal = msg.total;
    const bad = [];
    for (const [key, sum] of Object.entries(msg.regions)) {
      if (this.ledger.regionSum(key) !== sum) bad.push(key);
    }
    if (bad.length > 0) {
      this.checksumStatus = `RESYNC ${bad.length}`;
      this.onResync?.(bad);
    } else {
      this.checksumStatus = 'OK';
    }
  }

  #onSnapshot(msg) {
    // 요청 지역의 미러를 통째로 재구축 — 유령 풀 제거 후 서버 값 주입
    const keys = new Set(msg.regions);
    for (const pool of [...this.ledger.pools.values()]) {
      if (pool.region !== null && keys.has(pool.region)) this.ledger.forget(pool.id);
    }
    for (const pool of msg.pools) {
      this.ledger.mirrorSet(pool.id, pool.balance, pool.max, pool.region);
    }
  }
}
