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
import { POOL, PLAYER_MAX_ENERGY, regionKey, TICK_RATE, FIELD_INTERVAL_TICKS } from '../shared/constants.js';

// 스냅샷 주기(초) — 표시 보간의 등속 기준. 한 스냅샷 간 이동을 정확히 다음 스냅샷 도착까지 펼쳐 그린다.
const SNAP_SEC = FIELD_INTERVAL_TICKS / TICK_RATE; // 생명체·결정 스냅샷 (0.5s)
const FB_SNAP_SEC = 1 / TICK_RATE;                 // 파이어볼 (매 틱)

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
    this.field = new Map();     // "cx_cy_cz" -> 국소장 복셀 잔고 **표시값** (Sim 이 매 프레임 fieldTarget 으로 보간 — 렌더는 이걸 읽는다)
    this.fieldTarget = new Map();// "cx_cy_cz" -> 국소장 복셀 잔고 스냅샷 목표 (0.5s 주기 수신 원본)
    this.crystals = new Map();  // seq -> { x, y, z, balance, species, raw, crafted } (개별 결정 스냅샷 — 읽기 전용, feature-0005·0011·0010 step2 crafted=제조 산물)
    this.creatures = new Map();  // seq -> { x, y, z, tx, ty, tz, balance, size, desire, owner, desires } (생명체 스냅샷, 마커 — 읽기 전용, feature-0006·0010·0012 desires=중첩 스택. tx,ty,tz=최신 스냅샷 목표, x,y,z=표시 좌표(Sim 이 매 프레임 보간))
    this.fireballs = new Map();  // seq -> { x, y, z, tx, ty, tz, balance, size } (파이어볼 비행체 스냅샷 — 읽기 전용, feature-0009. 착탄하면 방송이 끊겨 짧은 TTL 로 지운다)
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
    for (const [cx, cy, cz, balance] of msg.cells) {
      const key = `${cx}_${cy}_${cz}`;
      this.fieldTarget.set(key, balance);
      if (!this.field.has(key)) this.field.set(key, balance); // 첫 수신은 즉시 표시(이후엔 Sim 이 보간)
    }
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
  //   **표시 보간**: 스냅샷은 FIELD 주기(0.5초)로만 오므로 그대로 그리면 0.5초 계단으로 뚝뚝 끊긴다(카메라가
  //   내 생명체를 타므로 화면 전체가 순간이동). 스냅샷 좌표는 목표(tx,ty,tz)로만 받고, 표시 좌표(x,y,z)는
  //   Sim.update 가 매 프레임 등속으로 쫓는다 — 플레이어 점(POS 비콘)과 동일한 방식(권위 아님, 순수 표시 계층).
  #onCreature(msg) {
    const seen = new Set();
    for (const [seq, x, y, z, balance, size, desire, owner, desires, items, cmd] of msg.cells) {
      const prev = this.creatures.get(seq);
      if (prev && Math.hypot(x - prev.x, y - prev.y, z - prev.z) < 200) {
        // 기존 개체 — 표시 좌표는 두고 목표만 갱신. 이번 구간 등속(segSpeed) = 이동 거리 / 스냅샷 간격:
        //   다음 스냅샷이 올 때 정확히 도착하는 속도라, 실제 서버 속도가 얼마든(걷기·먹으며 한 걸음) 그대로
        //   화면에서 연속 이동으로 펼쳐진다(빨리 가서 기다리는 계단 없음). 200px 이상 점프는 순간이동이라 스냅(else).
        const segSpeed = Math.hypot(x - prev.x, y - prev.y, z - prev.z) / SNAP_SEC;
        Object.assign(prev, { tx: x, ty: y, tz: z, segSpeed, balance, size: size ?? 1, desire: desire ?? 'none', owner: owner ?? null, desires: desires ?? [], cmd: cmd || null });
      } else {
        this.creatures.set(seq, { seq, x, y, z, tx: x, ty: y, tz: z, segSpeed: 0, balance, size: size ?? 1, desire: desire ?? 'none', owner: owner ?? null, desires: desires ?? [], cmd: cmd || null }); // cmd=지정 표적 [kindCode,seq] 또는 null (feature-0010 step4)
      }
      seen.add(seq);
    }
    for (const key of this.creatures.keys()) if (!seen.has(key)) this.creatures.delete(key);
  }

  // 파이어볼 스냅샷 — feature-0009. 비행 중일 때만 매 틱 실려온다. 방송에 없는(=착탄한) 것은 지우고, 방송이 아예
  //   끊기면 렌더가 TTL(#pruneFireballs)로 비운다. 좌표는 목표(tx,ty,tz)로 받아 Sim 이 보간(10Hz 틱 계단 완화).
  #onFireball(msg) {
    const seen = new Set();
    for (const [seq, x, y, z, balance, size] of msg.cells) {
      const prev = this.fireballs.get(seq);
      if (prev) Object.assign(prev, { tx: x, ty: y, tz: z, segSpeed: Math.hypot(x - prev.x, y - prev.y, z - prev.z) / FB_SNAP_SEC, balance, size: size ?? 1 }); // 표시 좌표 유지 → 등속 보간
      else this.fireballs.set(seq, { x, y, z, tx: x, ty: y, tz: z, segSpeed: 0, balance, size: size ?? 1 });
      seen.add(seq);
    }
    for (const key of this.fireballs.keys()) if (!seen.has(key)) this.fireballs.delete(key);
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
