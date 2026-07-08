// ============================================================================
// ClientState — 미러 원장 + 시야 모델 (최소 원장 코어)
//
// 클라이언트가 아는 "권위 상태" 는 서버가 확정한 tx 스트림뿐이다.
// 시야(ENTER/LEAVE) 경계 안의 풀만 미러링하며, 지역 체크섬으로 미러의
// 정합을 검증한다. 불일치 = 그 지역만 재동기화(RESYNC).
//
// 게임플레이(인벤토리·예측·이벤트)는 여기 없다 — feature 로 얹는다.
// ============================================================================

import { EnergyLedger } from '../shared/ledger.js';
import { POOL, PLAYER_MAX_ENERGY, regionKey } from '../shared/constants.js';

export class ClientState {
  constructor() {
    this.playerId = null;
    this.myName = '';
    this.ledger = new EnergyLedger();
    this.entities = new Map();  // id -> { id, kind, x, y, z, tx, ty, tz, name, max } (표시용)
    this.txFeed = [];           // 최근 tx 표시용
    this.worldTotal = 0;        // 서버가 선언한 전 풀 합계 — 보존 불변식의 전시
    this.worldSrc = 0;          // SOURCE(태양) 잔고 — 저엔트로피 원천 (feature-0004)
    this.worldSink = 0;         // SINK(심우주) 잔고 — 복사로 새어나간 손실, 단조 증가
    this.worldMaterial = 0;     // 국소장 총량 — 흩어진 중등급 에너지 (feature-0004)
    this.field = new Map();     // "cx_cy" -> 국소장 잔고 (그리드 스냅샷, 확산 시각화 — 읽기 전용)
    this.checksumStatus = 'WAIT';
    this.onResync = null;       // (regionKeys) => void
    this.onTeleport = null;     // ({x,y,z}) => void
  }

  handle(msg) {
    switch (msg.t) {
      case 'welcome': return this.#onWelcome(msg);
      case 'enter': return this.#onEnter(msg);
      case 'leave': return this.#onLeave(msg);
      case 'ops': return this.#onOps(msg);
      case 'pos': return this.#onPos(msg);
      case 'field': return this.#onField(msg);
      case 'checksum': return this.#onChecksum(msg);
      case 'snapshot': return this.#onSnapshot(msg);
      case 'teleport': return this.onTeleport?.(msg);
    }
  }

  #onWelcome(msg) {
    this.playerId = msg.playerId;
    this.myName = msg.name;
    this.worldTotal = msg.total;
    this.worldSrc = msg.src;
    this.worldSink = msg.sink ?? 0;
    this.worldMaterial = msg.mat ?? 0;
    // 잔고 0 기준점 — 스폰 인출은 곧 도착할 tx 가 채운다
    this.ledger.mirrorSet(this.playerId, 0, PLAYER_MAX_ENERGY, null);
    // SOURCE/SINK 는 서버 내부 저수지 — 무한 저수지로 물질화해 관련 tx 재생이 정확하게 한다
    // (region=null → 체크섬 무관, 잔고 오차 무해). 전시값은 worldSrc/worldSink 를 쓴다.
    //   SOURCE 는 내주는 쪽 → 잔고 가득(줄 수 있게) · SINK 는 받는 쪽 → 잔고 0·무한 수용(받을 수 있게).
    this.ledger.mirrorSet(POOL.SOURCE, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, null);
    this.ledger.mirrorSet(POOL.SINK, 0, Number.MAX_SAFE_INTEGER, null);
    this.onTeleport?.(msg);
  }

  #onEnter(msg) {
    for (const e of msg.entities) {
      this.ledger.mirrorSet(e.id, e.balance, e.max, null); // 플레이어 풀은 region=null
      this.entities.set(e.id, {
        id: e.id, kind: e.kind, x: e.x, y: e.y, z: e.z, tx: e.x, ty: e.y, tz: e.z,
        name: e.name, max: e.max,
      });
    }
  }

  #onLeave(msg) {
    for (const id of msg.ids) {
      this.entities.delete(id);
      this.ledger.forget(id); // 관측 중단이지 소멸이 아니다 — 재진입 시 ENTER 가 복원
    }
  }

  // tx 를 서버가 커밋한 인과 순서 그대로 재생한다
  #onOps(msg) {
    for (const op of msg.ops) if (op.op === 'tx') this.#applyTx(op);
    if (this.txFeed.length > 8) this.txFeed.splice(0, this.txFeed.length - 8);
  }

  #applyTx(tx) {
    // 시야 밖 액터의 무지역 풀(플레이어·SOURCE)은 잔고 0 으로 물질화한다.
    // 무지역 풀은 체크섬 대상이 아니라 오차가 무해하고(ENTER 가 오면 정정),
    // 관련 tx 재생만 정확하면 내 풀 쪽 절반이 유실되지 않는다.
    for (const id of [tx.from, tx.to]) {
      if (this.ledger.get(id)) continue;
      if (id === POOL.SOURCE) this.ledger.mirrorSet(id, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, null);
      // SINK·플레이어·국소장(M:) 은 받는 쪽/무지역 → 잔고 0·무한 수용으로 물질화(오차 무해).
      else if (id === POOL.SINK || id.startsWith(POOL.PLAYER) || id.startsWith(POOL.MATERIAL))
        this.ledger.mirrorSet(id, 0, Number.MAX_SAFE_INTEGER, null);
    }
    this.ledger.applyTx(tx);
    this.txFeed.push(tx);
  }

  #onPos(msg) {
    for (const [id, x, y, z] of msg.moves) {
      const e = this.entities.get(id);
      if (e) { e.tx = x; e.ty = y; e.tz = z; }
    }
  }

  // 국소장 그리드 스냅샷 — 렌더가 지면 히트맵으로 읽는다(권위 아님, 표시용).
  #onField(msg) {
    for (const [cx, cy, balance] of msg.cells) this.field.set(`${cx}_${cy}`, balance);
  }

  #onChecksum(msg) {
    this.worldTotal = msg.total;
    if (msg.src !== undefined) this.worldSrc = msg.src;
    if (msg.sink !== undefined) this.worldSink = msg.sink;
    if (msg.mat !== undefined) this.worldMaterial = msg.mat;
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
