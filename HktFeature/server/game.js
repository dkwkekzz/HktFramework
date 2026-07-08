// ============================================================================
// GameServer — 원장 권위 (최소 원장 코어)
//
// 서버는 시뮬레이터가 아니라 회계사다. 하는 일의 전부:
//   ① 클램프  — 이체량을 잔고·수용량으로 제한 (보존 강제 지점)
//   ② 커밋    — 원장 갱신 + 지역 합계 O(1) 갱신 + tx 에 전역 seq 부여
//   ③ 방송    — relevancy 필터된 tx 스트림 + 시야 diff + 주기 체크섬
//
// 서버가 하지 않는 일: 이동 적분, 물리, 경로, 연출. 좌표는 클라 비콘을
// "에너지 예산 검증(스피드핵)" 에만 쓴다 — 서버가 물리를 몰라도 '불가능'은 안다.
//
// 게임플레이(채집·전투·성장·아이템…)는 여기 없다 — feature 로 인텐트·풀·규칙을
// 얹으며 확장한다. 이 파일은 그 확장이 딛고 설 보존·미러·relevancy 기반이다.
//
// 수송 계층과 분리되어 있다 — conn 은 { send(str) } 만 구현하면 된다 (테스트 용이).
// ============================================================================

import { EnergyLedger } from '../shared/ledger.js';
import { MSG, encode } from '../shared/protocol.js';
import {
  POOL, CAUSE, WORLD_SEED, WORLD_SIZE, WORLD_HEIGHT, SPAWN_POS, WORLD_SOURCE_INITIAL, dist3,
  PLAYER_MAX_ENERGY, SPAWN_GRANT,
  MAX_SPEED, BEACON_TOLERANCE, BEACON_SLACK_PX, moveCost,
  CHECKSUM_INTERVAL_TICKS, regionKey, regionNeighbors,
} from '../shared/constants.js';

export class GameServer {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.ledger = new EnergyLedger();

    // 접속·틱 관련 휘발 상태 (플레이어는 재시작 시 재접속으로만 복귀)
    this.players = new Map();      // id -> player
    this.pendingOps = [];          // 이번 틱 확정 tx (인과 순서 유지)
    this.pendingMoves = new Map(); // playerId -> [x, y, z] (좌표 비콘 릴레이)
    this.nextPlayerNo = 1;
    this.tickCount = 0;
    this.txSeq = 0;

    this.#genesis();
  }

  // 창세: 세계의 모든 에너지는 SOURCE 에서 출발한다.
  // 이후 전 풀 합계는 영원히 WORLD_SOURCE_INITIAL — 이것이 보존 불변식.
  #genesis() {
    this.ledger.createPool(POOL.SOURCE, WORLD_SOURCE_INITIAL, Number.MAX_SAFE_INTEGER, null);
  }

  // --- 원장 커밋 + tx 기록 (모든 에너지 변화는 이 함수를 지난다) ---
  #tx(from, to, want, cause, at = null) {
    const amount = this.ledger.transfer(from, to, want, cause);
    if (amount > 0) {
      const tx = { op: 'tx', seq: ++this.txSeq, from, to, amount, cause };
      if (at) tx.at = { x: at.x, y: at.y };
      this.pendingOps.push(tx);
    }
    return amount;
  }

  // ==========================================================================
  // 접속 수명
  // ==========================================================================

  addPlayer(conn, name = '모험가') {
    const id = `${POOL.PLAYER}${this.nextPlayerNo++}`;
    const player = {
      id, name: String(name).slice(0, 12) || '모험가', conn,
      x: SPAWN_POS.x, y: SPAWN_POS.y, z: SPAWN_POS.z,
      lastBeaconMs: this.now(), moveDebt: 0,
      regions: new Set(regionNeighbors(SPAWN_POS.x, SPAWN_POS.y)),
      visible: new Set(),
    };
    this.players.set(id, player);
    this.ledger.createPool(id, 0, PLAYER_MAX_ENERGY, null);

    // 미러 기준점: 잔고 0 시점의 스냅샷을 먼저 보내고, 스폰 인출은 tx 로 도달시킨다.
    conn.send(encode(MSG.WELCOME, {
      playerId: id, name: player.name, seed: WORLD_SEED, tick: this.tickCount,
      total: this.ledger.totalSum(), src: this.ledger.balance(POOL.SOURCE),
      x: player.x, y: player.y, z: player.z,
    }));
    this.#tx(POOL.SOURCE, id, SPAWN_GRANT, CAUSE.SPAWN, SPAWN_POS);
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    // 이탈 시 소지 에너지는 SOURCE 로 환원 — 보존 유지, 원장에서 소멸 없음
    this.#tx(id, POOL.SOURCE, this.ledger.balance(id), CAUSE.LEAVE, p);
    this.ledger.removePool(id);
    this.players.delete(id);
  }

  onMessage(playerId, msg) {
    const p = this.players.get(playerId);
    if (!p || !msg) return;
    switch (msg.t) {
      case MSG.BEACON: this.#onBeacon(p, msg); break;
      case MSG.RESYNC: this.#onResync(p, msg); break;
    }
  }

  // ==========================================================================
  // 비콘 — 좌표는 권위가 아니라 "개연성 증거". 검증은 속도 예산(스피드핵)뿐:
  //   초과하면 마지막 정합 위치로 TELEPORT 정정. 이동 지출은 player→SOURCE 이체.
  // ==========================================================================

  #onBeacon(p, msg) {
    const x = Math.max(0, Math.min(WORLD_SIZE, Math.round(msg.x ?? p.x)));
    const y = Math.max(0, Math.min(WORLD_SIZE, Math.round(msg.y ?? p.y)));
    const z = Math.max(0, Math.min(WORLD_HEIGHT, Math.round(msg.z ?? p.z)));
    const nowMs = this.now();
    const dt = Math.max(0.05, (nowMs - p.lastBeaconMs) / 1000);
    const d = dist3(p.x, p.y, p.z, x, y, z); // 속도 예산은 3D 이동거리로 검증

    if (d > MAX_SPEED * dt * BEACON_TOLERANCE + BEACON_SLACK_PX) {
      // 예산 초과 — 서버는 물리를 몰라도 '불가능' 은 안다. 마지막 정합 위치로 정정.
      p.conn.send(encode(MSG.TELEPORT, { x: p.x, y: p.y, z: p.z }));
      p.lastBeaconMs = nowMs;
      return;
    }

    const { cost, debt } = moveCost(p.moveDebt, d);
    p.moveDebt = debt;
    if (cost > 0) this.#tx(p.id, POOL.SOURCE, cost, CAUSE.MOVE, { x, y });
    p.x = x; p.y = y; p.z = z; p.lastBeaconMs = nowMs;
    p.regions = new Set(regionNeighbors(x, y)); // 파티션은 컬럼(x,y) — z 무관
    this.pendingMoves.set(p.id, [x, y, z]);
  }

  #onResync(p, msg) {
    const keys = (Array.isArray(msg.regions) ? msg.regions : []).filter(k => p.regions.has(k));
    if (keys.length === 0) return;
    const keySet = new Set(keys);
    const pools = [];
    for (const pool of this.ledger.pools.values()) {
      if (pool.region !== null && keySet.has(pool.region)) {
        pools.push({ id: pool.id, balance: pool.balance, max: pool.max, region: pool.region });
      }
    }
    p.conn.send(encode(MSG.SNAPSHOT, { regions: keys, pools }));
  }

  // ==========================================================================
  // 틱 — 서버가 깨어나는 유일한 주기. 원장 방송만 있고 시뮬레이션은 없다.
  // ==========================================================================

  tick() {
    this.#flush();
    this.pendingOps = [];
    this.pendingMoves.clear();
    this.tickCount++;
  }

  // --- 시야에 들어와야 하는 엔티티 집합 (지역 구독 기준) ---
  //   최소 코어에는 플레이어만 있다 — feature 가 노드·몬스터·아이템을 여기 더한다.
  #visibleFor(p) {
    const vis = new Map(); // id -> enter payload
    for (const q of this.players.values()) {
      if (q.id === p.id) continue;
      if (p.regions.has(regionKey(q.x, q.y))) {
        vis.set(q.id, {
          id: q.id, kind: 'player', name: q.name, x: q.x, y: q.y, z: q.z,
          balance: this.ledger.balance(q.id), max: PLAYER_MAX_ENERGY,
        });
      }
    }
    return vis;
  }

  #txRelevant(tx, p) {
    if (tx.from === p.id || tx.to === p.id) return true; // 내 풀은 어디서든 내 일
    return tx.at ? p.regions.has(regionKey(tx.at.x, tx.at.y)) : false;
  }

  // 플러시 순서 규약 (protocol.js 참조): LEAVE → OPS → ENTER → POS → CHECKSUM
  #flush() {
    const checksumDue = this.tickCount % CHECKSUM_INTERVAL_TICKS === 0;
    for (const p of this.players.values()) {
      // 시야 diff → ENTER / LEAVE (원장 미러의 관측 경계)
      const vis = this.#visibleFor(p);
      const enters = [];
      for (const [id, payload] of vis) if (!p.visible.has(id)) enters.push(payload);
      const leaves = [];
      for (const id of p.visible) if (!vis.has(id)) leaves.push(id);
      p.visible = new Set(vis.keys());

      if (leaves.length) p.conn.send(encode(MSG.LEAVE, { ids: leaves }));

      const ops = this.pendingOps
        .filter(op => this.#txRelevant(op, p))
        .map(({ at, ...op }) => op); // at 은 서버 relevancy 전용 — 방송에서 제외
      if (ops.length) p.conn.send(encode(MSG.OPS, { tick: this.tickCount, ops }));

      if (enters.length) p.conn.send(encode(MSG.ENTER, { entities: enters }));

      const moves = [];
      for (const [id, [x, y, z]] of this.pendingMoves) {
        if (id !== p.id && vis.has(id)) moves.push([id, x, y, z]);
      }
      if (moves.length) p.conn.send(encode(MSG.POS, { moves }));

      if (checksumDue) {
        const regions = {};
        for (const key of p.regions) regions[key] = this.ledger.regionSum(key);
        p.conn.send(encode(MSG.CHECKSUM, {
          tick: this.tickCount, total: this.ledger.totalSum(), regions,
        }));
      }
    }
  }
}
