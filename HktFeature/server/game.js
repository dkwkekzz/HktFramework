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
import { mulberry32 } from '../shared/rng.js';
import {
  POOL, CAUSE, WORLD_SEED, WORLD_SIZE, WORLD_HEIGHT, REGION_SIZE, SPAWN_POS, WORLD_SOURCE_INITIAL, dist3,
  PLAYER_MAX_ENERGY, SPAWN_GRANT,
  MATERIAL_DIFFUSE_INTERVAL_TICKS, MATERIAL_DIFFUSE_QUANTUM_DIVISOR, MATERIAL_RADIATE_DIVISOR,
  CRYSTAL_SATURATION, CRYSTAL_PRECIPITATE_DIVISOR, CRYSTAL_PRECIPITATE_MAX, CRYSTAL_INTERVAL_TICKS,
  FIELD_Z_LAYERS,
  MAX_SPEED, BEACON_TOLERANCE, BEACON_SLACK_PX, moveCost, materialKey, crystalKey, entropicOutProb,
  CHECKSUM_INTERVAL_TICKS, FIELD_INTERVAL_TICKS, regionKey, regionNeighbors,
} from '../shared/constants.js';

export class GameServer {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.ledger = new EnergyLedger();
    // 엔트로픽 확산의 "동전" — 결정론 PRNG. 서버 전용(클라는 결과 tx만 받는다)이라
    // 미러 정합과 무관하고, 같은 이벤트열이면 같은 흐름을 재현한다(테스트 재현성의 근거).
    this.rng = mulberry32(WORLD_SEED);

    // 접속·틱 관련 휘발 상태 (플레이어는 재시작 시 재접속으로만 복귀)
    this.players = new Map();      // id -> player
    this.pendingOps = [];          // 이번 틱 확정 tx (인과 순서 유지)
    this.pendingMoves = new Map(); // playerId -> [x, y, z] (좌표 비콘 릴레이)
    this.nextPlayerNo = 1;
    this.tickCount = 0;
    this.txSeq = 0;

    this.materialKeys = [];        // 국소장 풀 id 목록 (확산 순회용)
    this.materialCells = [];       // [cx, cy, id] — 국소장 그리드 방송용 (좌표 동반)
    this.materialNeighbors = new Map(); // 국소장 id -> 이웃 국소장 id 목록 (엔트로픽 확산 인접)
    this.crystalCells = [];        // [cx, cy, cz, matId, cryId] — 복셀별 국소장↔결정 쌍 (석출·방송용, feature-0005)
    this.#genesis();
  }

  // 창세: 세계의 모든 에너지는 SOURCE 에서 출발한다.
  // 이후 전 풀 합계는 영원히 WORLD_SOURCE_INITIAL — 이것이 보존 불변식.
  // feature-0004: SINK(심우주 손실)와 국소장 M:<region>(중등급, 확산장)을 함께 연다.
  //   국소장은 지역 컬럼마다 하나씩 0 으로 열린다. region=null 로 두어(step 1) 체크섬·방송
  //   경로를 건드리지 않는다 — 확산은 서버 내부의 무음 이체다(공간 네트워킹은 step 2).
  #genesis() {
    this.ledger.createPool(POOL.SOURCE, WORLD_SOURCE_INITIAL, Number.MAX_SAFE_INTEGER, null);
    this.ledger.createPool(POOL.SINK, 0, Number.MAX_SAFE_INTEGER, null);

    // 국소장은 3D 복셀 격자 — 수평 cols×cols 컬럼 × 수직 FIELD_Z_LAYERS 층.
    const cols = Math.ceil(WORLD_SIZE / REGION_SIZE); // 4x4 컬럼
    const id = (cx, cy, cz) => `${POOL.MATERIAL}${cx}_${cy}_${cz}`;
    // feature-0005: 복셀마다 결정 풀(I:<voxel>)도 0 으로 함께 연다. 국소장(M:)과 같은 자리의 "고체상".
    //   결정은 materialKeys(확산·복사 순회)에 넣지 않는다 — 순회 대상이 아닌 것이 곧 면역이다(정적).
    for (let cz = 0; cz < FIELD_Z_LAYERS; cz++)
      for (let cy = 0; cy < cols; cy++)
        for (let cx = 0; cx < cols; cx++) {
          const matId = id(cx, cy, cz), cryId = crystalKey(cx, cy, cz);
          this.ledger.createPool(matId, 0, Number.MAX_SAFE_INTEGER, null);
          this.ledger.createPool(cryId, 0, Number.MAX_SAFE_INTEGER, null);
          this.materialKeys.push(matId);
          this.materialCells.push([cx, cy, cz, matId]);
          this.crystalCells.push([cx, cy, cz, matId, cryId]);
        }
    // 6방향 인접(±x,±y,±z) — 엔트로픽 확산은 이웃 복셀 사이에서만, 수직으로도 일어난다.
    for (let cz = 0; cz < FIELD_Z_LAYERS; cz++)
      for (let cy = 0; cy < cols; cy++)
        for (let cx = 0; cx < cols; cx++) {
          const nb = [];
          for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
            const nx = cx + dx, ny = cy + dy, nz = cz + dz;
            if (nx >= 0 && nx < cols && ny >= 0 && ny < cols && nz >= 0 && nz < FIELD_Z_LAYERS)
              nb.push(id(nx, ny, nz));
          }
          this.materialNeighbors.set(id(cx, cy, cz), nb);
        }
  }

  // 국소장 총량 (전시용 — SOURCE·SINK 처럼 aggregate 로 뷰어에 싣는다)
  #materialTotal() {
    let sum = 0;
    for (const id of this.materialKeys) sum += this.ledger.balance(id);
    return sum;
  }

  // 결정 총량 (전시용 — feature-0005). 국소장에서 석출돼 동결된 정적 에너지의 합.
  #crystalTotal() {
    let sum = 0;
    for (const [, , , , cryId] of this.crystalCells) sum += this.ledger.balance(cryId);
    return sum;
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
      sink: this.ledger.balance(POOL.SINK), mat: this.#materialTotal(), cry: this.#crystalTotal(),
      x: player.x, y: player.y, z: player.z,
    }));
    this.#tx(POOL.SOURCE, id, SPAWN_GRANT, CAUSE.SPAWN, SPAWN_POS);
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    // 이탈 = 응집 소멸. 소지 에너지는 그 자리 국소장 복셀로 흩어진다(거름).
    this.#tx(id, materialKey(p.x, p.y, p.z), this.ledger.balance(id), CAUSE.DEATH, p);
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
  //   초과하면 마지막 정합 위치로 TELEPORT 정정. 이동 지출은 player→국소장 소산 이체(feature-0004).
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
    // 이동은 활동 에너지를 그 자리 국소장 복셀로 흩는다(소산). 국소장에 쌓인 에너지는
    // 이웃으로 엔트로픽 확산하고 일부는 심우주로 복사돼 사라진다.
    if (cost > 0) this.#tx(p.id, materialKey(x, y, z), cost, CAUSE.MOVE, { x, y });
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
    // feature-0004 엔트로픽 장 갱신 — 국소장의 에너지가 (a) 이웃 복셀로 높은 확률로 흩어지고
    //   (b) 일부가 심우주로 복사돼 영영 사라진다. 둘 다 region=null 풀 간 무음 이체(방송·체크섬
    //   무관)라 서버 내부에서만 돈다. 소산은 태양으로 되돌아가지 않고 SINK 는 단조 증가한다(엔트로피의 화살).
    if (this.tickCount % MATERIAL_DIFFUSE_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#diffuseMaterial();
      this.#radiateMaterial();
    }
    // feature-0005 결정화 — 과포화된 국소장 복셀은 초과분의 일부를 결정으로 석출한다.
    //   확산·복사 뒤에 돌린다(먼저 흩어질 만큼 흩어진 뒤 남아 몰린 것만 동결). 결정은 면역이라
    //   이후 확산·복사에 흔들리지 않는다 — 조류에 맞선 정적 저엔트로피 섬.
    if (this.tickCount % CRYSTAL_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#crystallize();
    }
    this.#flush();
    this.pendingOps = [];
    this.pendingMoves.clear();
    this.tickCount++;
  }

  // 엔트로픽 확산 — 이웃한 두 국소장 사이에서 한 양자가 "높은 확률로" 고농도→저농도로 이동한다.
  //   방향은 시드 동전(entropicOutProb)이 정하고, 양자는 정수. 앙상블은 압도적으로 down-gradient
  //   → 장은 균일(평형, 최대 엔트로피)로 수렴한다. 농도가 같으면 1/2 확률 → 순 흐름 0.
  #diffuseMaterial() {
    for (const id of this.materialKeys) {
      for (const nb of this.materialNeighbors.get(id)) {
        if (id >= nb) continue; // 각 무방향 이웃쌍을 한 번만 처리(중복 방지)
        const a = this.ledger.balance(id), b = this.ledger.balance(nb);
        if (a + b === 0) continue;
        const quantum = Math.max(1, Math.floor((a + b) / MATERIAL_DIFFUSE_QUANTUM_DIVISOR));
        // 높은 확률로 고농도 쪽에서 저농도 쪽으로 — "엔트로픽 법칙에 따라 높은 확률로 이동할 뿐"
        if (this.rng() < entropicOutProb(a, b)) this.ledger.transfer(id, nb, quantum, CAUSE.DIFFUSE);
        else this.ledger.transfer(nb, id, quantum, CAUSE.DIFFUSE);
      }
    }
  }

  // 심우주 복사 — 국소장의 아주 작은 일부가 SINK 로 새어나간다(되돌아오지 않는 엔트로피 세금).
  //   SINK 는 오직 받기만 하므로 단조 증가한다 — 태양이 이를 되돌리지 않는 한 세계는 서서히 식는다.
  //   기대 복사량 = 잔고/RADIATE_DIVISOR. 정수 유지를 위해 나머지는 확률 반올림(stochastic rounding)
  //   — 잔고가 작아도 기대율대로 이따금 1 을 복사한다(정수·결정론·기대값 정확).
  #radiateMaterial() {
    for (const id of this.materialKeys) {
      const bal = this.ledger.balance(id);
      if (bal <= 0) continue;
      let rad = Math.floor(bal / MATERIAL_RADIATE_DIVISOR);
      const frac = bal % MATERIAL_RADIATE_DIVISOR;
      if (frac > 0 && this.rng() * MATERIAL_RADIATE_DIVISOR < frac) rad += 1;
      if (rad > 0) this.ledger.transfer(id, POOL.SINK, rad, CAUSE.RADIATE);
    }
  }

  // 결정화(석출) — feature-0005. 국소장 복셀 농도가 포화 임계를 넘으면(과포화) 초과분의 일부가
  //   같은 자리 결정 풀로 옮겨져 동결한다. 석출량 = floor((농도−포화)/DIVISOR) — 자기 제한이다:
  //   장을 포화까지 끌어내리면 초과가 0 이 되어 멈춘다(현실의 침전 평형). 결정론(rng 미사용) —
  //   "저엔트로피 요동(국소에 에너지가 쌓인 드문 사건) 자체가 희귀도"다. 결정은 확산·복사 순회
  //   대상이 아니므로(materialKeys 밖) 한 번 동결되면 가만두는 한 잔고가 불변이다(정적성).
  #crystallize() {
    for (const [, , , matId, cryId] of this.crystalCells) {
      const bal = this.ledger.balance(matId);
      if (bal <= CRYSTAL_SATURATION) continue; // 과포화가 아니면 석출 없음
      // 과포화도(초과분)에 비례해 석출하되 상한으로 묶는다 — 몰릴수록 잘 맺히되 확산을 이기지 않는다.
      const quantum = Math.min(CRYSTAL_PRECIPITATE_MAX, Math.max(1, Math.floor((bal - CRYSTAL_SATURATION) / CRYSTAL_PRECIPITATE_DIVISOR)));
      this.ledger.transfer(matId, cryId, quantum, CAUSE.CRYSTALLIZE); // 확산처럼 무음 내부 이체(상태는 CRYSTAL 스냅샷으로 방송)
    }
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
    // 국소장 그리드 스냅샷 — 세계 수준 표시 데이터(보존 readout 처럼 전역). 4x4 라 방송 비용이 미미하고,
    //   관전자도 세계 전역의 확산을 지도에서 본다. 원장 tx 가 아니라 읽기 전용 관측값이다(POS 와 같은 성격).
    const broadcastField = this.tickCount % FIELD_INTERVAL_TICKS === 0;
    const fieldCells = broadcastField
      ? this.materialCells.map(([cx, cy, cz, id]) => [cx, cy, cz, this.ledger.balance(id)])
      : null;
    // 결정 스냅샷 — 잔고>0 인 결정만(이산·희소하므로 전 복셀을 실을 필요 없다). FIELD 와 같은 읽기 전용 표시값.
    const crystalCells = broadcastField
      ? this.crystalCells.reduce((acc, [cx, cy, cz, , cryId]) => {
          const b = this.ledger.balance(cryId);
          if (b > 0) acc.push([cx, cy, cz, b]);
          return acc;
        }, [])
      : null;
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

      if (fieldCells) p.conn.send(encode(MSG.FIELD, { cells: fieldCells }));
      if (crystalCells) p.conn.send(encode(MSG.CRYSTAL, { cells: crystalCells }));

      if (checksumDue) {
        const regions = {};
        for (const key of p.regions) regions[key] = this.ledger.regionSum(key);
        p.conn.send(encode(MSG.CHECKSUM, {
          tick: this.tickCount, total: this.ledger.totalSum(), regions,
          src: this.ledger.balance(POOL.SOURCE), sink: this.ledger.balance(POOL.SINK),
          mat: this.#materialTotal(), cry: this.#crystalTotal(),
        }));
      }
    }
  }
}
