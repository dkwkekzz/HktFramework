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
    this.worldCrystal = 0;      // 결정 총량 — 국소장에서 석출돼 동결된 정적 에너지 (feature-0005)
    this.worldCreature = 0;     // 생명체 총량 — 대사로 질서를 유지하는 살아있는 에너지 (feature-0006)
    this.field = new Map();     // "cx_cy_cz" -> 국소장 복셀 잔고 (3D 그리드 스냅샷, 확산 시각화 — 읽기 전용)
    this.crystals = new Map();  // seq -> { x, y, z, balance, species, raw, crafted } (개별 결정 스냅샷 — 읽기 전용, feature-0005·0011·0010 step2 crafted=제조 산물)
    this.creatures = new Map();  // seq -> { x, y, z, balance, size, desire, owner, desires } (생명체 스냅샷, 마커 — 읽기 전용, feature-0006·0010·0012 desires=중첩 스택)
    this.fireballs = new Map();  // seq -> { x, y, z, balance, size } (파이어볼 비행체 스냅샷 — 읽기 전용, feature-0009. 착탄하면 방송이 끊겨 짧은 TTL 로 지운다)
    this.fireballsAt = 0;        // 마지막 파이어볼 방송 시각(ms) — 이후 방송이 없으면(착탄) 렌더가 TTL 로 비운다
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
      case 'crystal': return this.#onCrystal(msg);
      case 'creature': return this.#onCreature(msg);
      case 'fireball': return this.#onFireball(msg);
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
    this.worldCrystal = msg.cry ?? 0;
    this.worldCreature = msg.cre ?? 0;
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
      // SINK·플레이어·국소장(M:)·결정(I:) 은 받는 쪽/무지역 → 잔고 0·무한 수용으로 물질화(오차 무해).
      else if (id === POOL.SINK || id.startsWith(POOL.PLAYER) || id.startsWith(POOL.MATERIAL) || id.startsWith(POOL.CRYSTAL) || id.startsWith(POOL.CREATURE))
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

  // 국소장 3D 복셀 스냅샷 — 렌더가 볼류메트릭 글로우로 읽는다(권위 아님, 표시용).
  #onField(msg) {
    for (const [cx, cy, cz, balance] of msg.cells) this.field.set(`${cx}_${cy}_${cz}`, balance);
  }

  // 개별 결정 스냅샷 — 잔고>0 인 결정만 실려온다. 렌더가 종별 색 마커로 읽는다(권위 아님, 표시용).
  //   방송에 없는(=사라진) 결정은 미러에서 지운다 — 반응·채집으로 소멸한 결정이 유령으로 남지 않게(후속 step 대비).
  #onCrystal(msg) {
    const seen = new Set();
    for (const [seq, x, y, z, balance, species, raw, crafted, tier, burning, hot] of msg.cells) {
      this.crystals.set(seq, { x, y, z, balance, species, raw: !!raw, crafted: !!crafted, tier: tier ?? 0, burning: !!burning, hot: hot ?? 0 }); // feature-0013 burning=연소·hot=가열비율 // raw=날것·crafted=산물·tier=제조 단계(feature-0011 step2)
      seen.add(seq);
    }
    for (const key of this.crystals.keys()) if (!seen.has(key)) this.crystals.delete(key);
  }

  // 생명체 스냅샷 — 잔고>0 인 생명체만 실려온다. 렌더가 살아있는 마커로 읽는다(권위 아님, 표시용).
  //   방송에 없는(=죽은) 생명체는 미러에서 지운다 — 아사·소멸한 생명체가 유령으로 남지 않게(CRYSTAL 과 같은 처리).
  #onCreature(msg) {
    const seen = new Set();
    for (const [seq, x, y, z, balance, size, desire, owner, desires] of msg.cells) {
      this.creatures.set(seq, { x, y, z, balance, size: size ?? 1, desire: desire ?? 'none', owner: owner ?? null, desires: desires ?? [] });
      seen.add(seq);
    }
    for (const key of this.creatures.keys()) if (!seen.has(key)) this.creatures.delete(key);
  }

  // 파이어볼 스냅샷 — feature-0009. 비행 중일 때만 매 틱 실려온다. 통째로 교체하고(현재 나는 것만), 방송이 끊기면
  //   (착탄=폭발) 렌더가 TTL(#pruneFireballs)로 지운다. 렌더는 이 위치를 밝은 투사체로 그린다(권위 아님, 표시용).
  #onFireball(msg) {
    this.fireballs.clear();
    for (const [seq, x, y, z, balance, size] of msg.cells) this.fireballs.set(seq, { x, y, z, balance, size: size ?? 1 });
    this.fireballsAt = Date.now();
  }

  // 착탄 후 방송이 끊긴 파이어볼을 지운다 — 렌더 루프가 매 프레임 부른다(마지막 방송 후 TTL 지나면 비운다).
  pruneFireballs(ttlMs = 220) {
    if (this.fireballs.size && Date.now() - this.fireballsAt > ttlMs) this.fireballs.clear();
  }

  #onChecksum(msg) {
    this.worldTotal = msg.total;
    if (msg.src !== undefined) this.worldSrc = msg.src;
    if (msg.sink !== undefined) this.worldSink = msg.sink;
    if (msg.mat !== undefined) this.worldMaterial = msg.mat;
    if (msg.cry !== undefined) this.worldCrystal = msg.cry;
    if (msg.cre !== undefined) this.worldCreature = msg.cre;
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
