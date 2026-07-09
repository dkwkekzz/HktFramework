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
import { DESIRE_PROCEDURES } from '../shared/desires.js';
import { mulberry32 } from '../shared/rng.js';
import {
  POOL, CAUSE, WORLD_SEED, WORLD_SIZE, WORLD_HEIGHT, REGION_SIZE, SPAWN_POS, WORLD_SOURCE_INITIAL, dist3,
  PLAYER_MAX_ENERGY, SPAWN_GRANT,
  MATERIAL_DIFFUSE_INTERVAL_TICKS, MATERIAL_DIFFUSE_QUANTUM_DIVISOR, MATERIAL_RADIATE_DIVISOR,
  CRYSTAL_SATURATION, CRYSTAL_PRECIPITATE_DIVISOR, CRYSTAL_PRECIPITATE_MAX, CRYSTAL_INTERVAL_TICKS,
  DEATH_CRYSTAL_FRACTION, pickSpecies,
  CRYSTAL_REACT_INTERVAL_TICKS, CRYSTAL_REACT_RADIUS, CRYSTAL_REACT_RELEASE_DIVISOR, reactSpecies,
  LIQUID_CONDENSE, LIQUID_CAPACITY, LIQUID_SETTLE_MAX, LIQUID_RADIATE_DIVISOR, LIQUID_COHESION,
  FIELD_Z_LAYERS,
  CREATURE_MAX_ENERGY, CREATURE_SPAWN_GRANT, CREATURE_BASAL_COST, CREATURE_FORAGE_RATE,
  CREATURE_DEATH_THRESHOLD, CREATURE_METABOLISM_INTERVAL_TICKS,
  CREATURE_SIZE_MAX, CREATURE_GROWTH_FULL_FRACTION, CREATURE_GROWTH_HUNGRY_FRACTION, CREATURE_GROWTH_THRESHOLD,
  CREATURE_HARVEST_RADIUS, CREATURE_HARVEST_RATE, crystalYield,
  CREATURE_ATTACK_INTERVAL_TICKS, CREATURE_ATTACK_RADIUS, CREATURE_ATTACK_POWER,
  CREATURE_ATTACK_COST, CREATURE_ATTACK_CAPTURE_PCT,
  DISCHARGE_INTERVAL_TICKS, DISCHARGE_RADIUS, DISCHARGE_POWER, DISCHARGE_COST, DISCHARGE_BURN_PCT,
  DESIRE, CREATURE_PURSUE_INTERVAL_TICKS, CREATURE_STRIDE, CREATURE_SEEK_RADIUS, CREATURE_LEASH_STOP,
  DESIRE_BASE_PRIORITY, DESIRE_EMOTION_MAX, desireWeight,
  COOK_COST, COOK_BURN_PCT, cookedSpecies,
  CRAFT_COST, CRAFT_BURN_PCT, CRAFT_REACH, CRAFT_PAIR_RADIUS, craftedSpecies,
  MAX_SPEED, BEACON_TOLERANCE, BEACON_SLACK_PX, moveCost, materialKey, entropicOutProb,
  CHECKSUM_INTERVAL_TICKS, FIELD_INTERVAL_TICKS, regionKey, regionNeighbors,
} from '../shared/constants.js';

export class GameServer {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.ledger = new EnergyLedger();
    // 엔트로픽 확산의 "동전" — 결정론 PRNG. 서버 전용(클라는 결과 tx만 받는다)이라
    // 미러 정합과 무관하고, 같은 이벤트열이면 같은 흐름을 재현한다(테스트 재현성의 근거).
    this.rng = mulberry32(WORLD_SEED);
    // 결정 종(species) 추첨용 별도 스트림 — 확산 rng 를 건드리지 않게 분리(결정론 유지). (feature-0005 step2)
    this.crystalRng = mulberry32(WORLD_SEED ^ 0x9e3779b1);

    // 접속·틱 관련 휘발 상태 (플레이어는 재시작 시 재접속으로만 복귀)
    this.players = new Map();      // id -> player
    this.pendingOps = [];          // 이번 틱 확정 tx (인과 순서 유지)
    this.pendingMoves = new Map(); // playerId -> [x, y, z] (좌표 비콘 릴레이)
    this.nextPlayerNo = 1;
    this.tickCount = 0;
    this.txSeq = 0;

    this.materialKeys = [];        // 국소장 풀 id 목록 (확산 순회용)
    this.materialCells = [];       // [cx, cy, cz, id] — 국소장 그리드 방송용 (좌표 동반)
    this.materialNeighbors = new Map(); // 국소장 id -> 이웃 국소장 id 목록 (엔트로픽 확산 인접)
    // 결정은 개별 discrete 객체다 (feature-0005 step2) — 확산·복사 순회 밖(=면역).
    this.crystals = new Map();     // cryId -> { id, seq, x, y, z, species } (잔고는 원장 풀에)
    this.voxelResident = new Map();// voxelKey -> cryId — 과포화 석출이 키우는 그 복셀의 "거주" 결정
    this.crystalSeq = 0;
    // 생명체(feature-0006) — 능동적 저엔트로피 섬. 개별 discrete 객체이며 매 대사 틱마다 갈구·소모·생사판정을
    // 스스로 돌린다(확산·복사 순회 밖). 잔고는 원장 풀에, 상태는 CREATURE 스냅샷으로 방송(읽기 전용).
    this.creatures = new Map();    // creId -> { id, seq, x, y, z }
    this.creatureSeq = 0;
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
    this.cols = cols; // 액체 침강 컬럼 순회용 (feature-0005 step4)
    const id = (cx, cy, cz) => `${POOL.MATERIAL}${cx}_${cy}_${cz}`;
    for (let cz = 0; cz < FIELD_Z_LAYERS; cz++)
      for (let cy = 0; cy < cols; cy++)
        for (let cx = 0; cx < cols; cx++) {
          this.ledger.createPool(id(cx, cy, cz), 0, Number.MAX_SAFE_INTEGER, null);
          this.materialKeys.push(id(cx, cy, cz));
          this.materialCells.push([cx, cy, cz, id(cx, cy, cz)]);
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

  // 결정 총량 (전시용 — feature-0005). 국소장에서 응결돼 동결된 정적 에너지의 합.
  #crystalTotal() {
    let sum = 0;
    for (const cryId of this.crystals.keys()) sum += this.ledger.balance(cryId);
    return sum;
  }

  // 생명체 총량 (전시용 — feature-0006). 능동적으로 질서를 유지하는 살아있는 에너지의 합.
  #creatureTotal() {
    let sum = 0;
    for (const creId of this.creatures.keys()) sum += this.ledger.balance(creId);
    return sum;
  }

  // 생명체 하나를 스폰한다 (feature-0006) — 위치를 가진 discrete 저엔트로피 섬. SOURCE 에서 저엔트로피를
  //   주입받아(feature-0003: 유일한 원점) 태어난다. 이후 스스로 대사·갈구로 질서를 유지한다.
  //   확산·복사 순회 밖(materialKeys/crystals 와 별개)이라 오직 #metabolizeCreatures 만이 잔고를 움직인다.
  spawnCreature(x, y, z) {
    const seq = ++this.creatureSeq;
    const creId = `${POOL.CREATURE}${seq}`;
    this.ledger.createPool(creId, 0, CREATURE_MAX_ENERGY, null);
    // owner=제어자(플레이어 id, null=야생), desires=욕구 스택(feature-0012 중첩), moveDebt=이동 비용 누적(잔여 거리).
    //   feature-0012: 욕구는 하나가 아니라 여럿 중첩된다 → name→{priority,emotion} 맵으로 품는다(같은 욕구는 dedup).
    //   창세/생태 생명체는 owner=null·빈 스택(=대기) → 추적하지 않는다(정지성 = 기존 feature 불변).
    const cre = { id: creId, seq, x, y, z, size: 1, growth: 0, owner: null, desires: new Map(), moveDebt: 0 };
    // desire = 스택의 **승자(유효 우선순위 최대)** 를 읽는 접근자 — feature-0006~0011 코드/테스트/방송이 그대로 쓴다(하위 호환).
    //   setter 는 스택을 그 욕구 하나로 교체(단일 욕구 부여 = 기존 setDesire·직접 대입 의미 보존). 빈 스택 → NONE.
    Object.defineProperty(cre, 'desire', {
      enumerable: true,
      get() {
        let best = DESIRE.NONE, bestW = -Infinity;
        for (const [name, d] of cre.desires) { // 동률은 삽입(주입) 순서 유지 → 결정론
          const w = desireWeight(d.priority, d.emotion, d.feeling);
          if (w > bestW) { bestW = w; best = name; }
        }
        return best;
      },
      set(v) { cre.desires.clear(); if (v && v !== DESIRE.NONE) cre.desires.set(v, { priority: DESIRE_BASE_PRIORITY, emotion: 0, feeling: 0 }); },
    });
    this.creatures.set(creId, cre);
    this.ledger.transfer(POOL.SOURCE, creId, CREATURE_SPAWN_GRANT, CAUSE.SPAWN); // 저엔트로피 주입(무음 내부 이체)
    return cre;
  }

  // 제어 결선 (feature-0010) — 한 플레이어가 하나의 생명체를 제어한다. 생명체를 스폰해 owner 를 걸면
  //   그 생명체는 주인의 욕망(desire)에 따라 움직이고, 욕망이 없으면 주인 곁을 따른다(수동 이동). 라이브
  //   진입점(index.js)에서 접속 시 부른다 — 테스트가 쓰는 GameServer 구성자·addPlayer 는 건드리지 않는다.
  possessCreature(playerId, x, y, z) {
    const cre = this.spawnCreature(x, y, z);
    cre.owner = playerId;
    cre.desire = DESIRE.NONE;
    return cre;
  }

  // 욕망 부여 (feature-0010·0011) — 내가 제어하는 생명체(들)의 desire 를 바꾼다. **등록된 욕구(레지스트리에
  //   절차가 있는 것)만** 받는다 — 새 욕구를 registerDesire 로 얹으면 인텐트도 자동으로 그 욕구를 받아들인다(개방).
  setDesire(playerId, desire) {
    const d = DESIRE_PROCEDURES[desire] ? desire : DESIRE.NONE;
    for (const cre of this.creatures.values()) if (cre.owner === playerId) cre.desire = d;
    return d;
  }

  // 욕구 주입 (feature-0012) — 내가 제어하는 생명체(들)의 욕구 **스택에 하나를 얹는다**(중첩). 기존 setDesire(스택
  //   교체)와 달리 다른 욕구를 지우지 않는다 — 여러 욕구가 동시에 쌓인다. 같은 욕구를 또 주입해도 중첩되지 않고
  //   우선순위만 갱신된다(idempotent·dedup, 감정은 보존) — "같은 욕구를 또 주입할 필요는 없다". 등록된 욕구만
  //   받는다(개방). NONE 주입 = 스택 비우기(대기로 복귀). priority=우선순위(중요도, 감정 얹기 전 기준).
  injectDesire(playerId, name, priority = DESIRE_BASE_PRIORITY) {
    if (name === DESIRE.NONE) { for (const cre of this.creatures.values()) if (cre.owner === playerId) cre.desires.clear(); return; }
    if (!DESIRE_PROCEDURES[name]) return; // 미등록 욕구는 무시(개방 레지스트리 기반)
    for (const cre of this.creatures.values()) if (cre.owner === playerId) {
      const prev = cre.desires.get(name);
      cre.desires.set(name, { priority, emotion: prev ? prev.emotion : 0, feeling: prev ? prev.feeling : 0 }); // dedup — 우선순위 갱신, 감정·자율감정 보존
    }
  }

  // 감정 증폭 (feature-0012) — 욕구의 **중요도(우선순위)를 감정으로 키운다**("감정은 중요도다"). 유효 우선순위 =
  //   priority + emotion 이므로, 감정을 실으면 낮은 기본 우선순위의 욕구도 다른 욕구를 이겨 **행동이 바뀐다**.
  //   아직 스택에 없던 욕구면 기본 우선순위로 만들어 얹는다(감정이 곧 그 욕구를 부른다). 감정은 [0,MAX] 정수로 클램프.
  emote(playerId, name, emotion) {
    if (name === DESIRE.NONE || !DESIRE_PROCEDURES[name]) return;
    const e = Math.max(0, Math.min(DESIRE_EMOTION_MAX, emotion | 0));
    for (const cre of this.creatures.values()) if (cre.owner === playerId) {
      const prev = cre.desires.get(name);
      cre.desires.set(name, { priority: prev ? prev.priority : DESIRE_BASE_PRIORITY, emotion: e, feeling: prev ? prev.feeling : 0 });
    }
  }

  // 욕구 거둠 (feature-0012) — 상황이 해소된 욕구를 스택에서 뺀다. 그다음 우선순위의 욕구가 행동을 잇는다.
  withdrawDesire(playerId, name) {
    for (const cre of this.creatures.values()) if (cre.owner === playerId) cre.desires.delete(name);
  }

  // 개별 결정 하나를 연다 (feature-0005 step2) — 위치·종을 가진 discrete 객체. 잔고는 이후 이체로 채운다.
  //   확산·복사 순회(materialKeys) 밖이라 태생적으로 면역(정적)이다. region=null → 읽기 전용 스냅샷 방송.
  //   feature-0011: raw=날것 여부. 기본은 false(먹을 수 있음) — 석출·죽음의 결정은 모두 먹을 수 있다(기존 불변).
  #spawnCrystal(x, y, z, species, raw = false) {
    const seq = ++this.crystalSeq;
    const cryId = `${POOL.CRYSTAL}${seq}`;
    this.ledger.createPool(cryId, 0, Number.MAX_SAFE_INTEGER, null);
    // crafted=제조 산물 표식(feature-0010 step2) — 기본 false. 제조로 조합된 결정만 true(재료로 재선택 안 됨·뷰어 구분).
    this.crystals.set(cryId, { id: cryId, seq, x, y, z, species, raw, crafted: false });
    return cryId;
  }

  // 날것(raw) 결정 하나를 만든다 (feature-0011) — 바로 못 먹는 '재료(밥)'. 요리(cook)로 변형해야 먹을 수 있다.
  //   식사(EAT) 절차를 재현할 때 테스트·라이브 진입점이 쓴다. SOURCE→결정 인출도 원장 이체(보존).
  spawnRawFood(x, y, z, species = 0, amount = 0) {
    const cryId = this.#spawnCrystal(x, y, z, species, true);
    if (amount > 0) this.ledger.transfer(POOL.SOURCE, cryId, amount, CAUSE.SPAWN);
    return this.crystals.get(cryId);
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
      cre: this.#creatureTotal(),
      x: player.x, y: player.y, z: player.z,
    }));
    this.#tx(POOL.SOURCE, id, SPAWN_GRANT, CAUSE.SPAWN, SPAWN_POS);
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    // 제어자가 떠나면 그가 몰던 생명체는 야생으로 돌아간다(feature-0010) — 에너지는 그대로(보존),
    //   다만 주인이 없어 추적을 멈춘다(owner·desire 해제 → 정지). 소멸이 아니라 통제만 놓는다.
    for (const cre of this.creatures.values()) if (cre.owner === id) { cre.owner = null; cre.desire = DESIRE.NONE; }
    this.#decompose(id, p.x, p.y, p.z); // 이탈 = 응집 소멸 → 결정(잔해)+국소장(거름)으로 분해
    this.ledger.removePool(id);
    this.players.delete(id);
  }

  // 죽음의 분해 (feature-0005 step2) — 살아있는 풀(플레이어·생명체)이 파괴되면 그 에너지는 두 갈래로 흩어진다:
  //   (1) 단단한 잔해 → 그 자리에 결정으로 응결(discrete, 종을 가짐 = 다양한 드랍/채집물의 씨앗)
  //   (2) 무른 조직 → 국소장 복셀로 흩어진다(거름, feature-0004 의 열린 흐름 유지)
  //   플레이어 이탈·생명체 아사가 공유한다 — "생명체가 파괴되면 결정체가 나타나고 주변 에너지와 섞인다".
  //   분해 tx 는 at(좌표)을 실어 근처 플레이어 시야에 방송된다(누가 죽어 무엇을 남겼는지 보인다).
  #decompose(fromId, x, y, z) {
    const energy = this.ledger.balance(fromId);
    const cryAmt = Math.floor(energy * DEATH_CRYSTAL_FRACTION);
    if (cryAmt > 0) {
      const cryId = this.#spawnCrystal(x, y, z, pickSpecies(this.crystalRng));
      this.#tx(fromId, cryId, cryAmt, CAUSE.CRYSTALLIZE, { x, y }); // 죽음의 결정화
    }
    const rest = this.ledger.balance(fromId); // 남은 무른 조직 전부
    if (rest > 0) this.#tx(fromId, materialKey(x, y, z), rest, CAUSE.DEATH, { x, y });
  }

  onMessage(playerId, msg) {
    const p = this.players.get(playerId);
    if (!p || !msg) return;
    switch (msg.t) {
      case MSG.BEACON: this.#onBeacon(p, msg); break;
      case MSG.RESYNC: this.#onResync(p, msg); break;
      case MSG.DESIRE: this.setDesire(p.id, msg.desire); break; // feature-0010 — 내 생명체에 욕망 부여(스택 교체)
      case MSG.INJECT: // feature-0012 — 욕구를 스택에 주입(중첩) + 감정으로 우선순위 증폭
        this.injectDesire(p.id, msg.desire, Number.isFinite(msg.priority) ? (msg.priority | 0) : DESIRE_BASE_PRIORITY);
        if (Number.isFinite(msg.emotion)) this.emote(p.id, msg.desire, msg.emotion);
        break;
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
      this.#settleLiquid();   // 액체 중력 침강(feature-0005 step4) — 확산 뒤 중밀도가 아래로 흐른다
      this.#radiateMaterial();
    }
    // feature-0005 결정화 — 과포화된 국소장 복셀은 초과분의 일부를 결정으로 석출한다.
    //   확산·복사 뒤에 돌린다(먼저 흩어질 만큼 흩어진 뒤 남아 몰린 것만 동결). 결정은 면역이라
    //   이후 확산·복사에 흔들리지 않는다 — 조류에 맞선 정적 저엔트로피 섬.
    if (this.tickCount % CRYSTAL_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#crystallize();
    }
    // feature-0005 step3 반응 — 반경 안의 두 결정이 종에 따라 융합/화합하고 반응열을 국소장으로 방출한다.
    //   쌓인 결정을 소비해 개수를 묶으며(무한 누적 방지), 종 분포를 계속 뒤섞는다(창발).
    if (this.tickCount % CRYSTAL_REACT_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#react();
    }
    // feature-0010·0011 제어·욕구 절차 — 제어되는 생명체가 제 욕구의 **절차**를 한 단계 수행한다:
    //   찾아가고(이동→국소장 소산)·요리하고(날것 변형=열+연기)·먹고(채집)·타격한다(발산). 욕구마다 절차와
    //   방출 형태가 다르다(shared/desires.js 레지스트리 = 개방). 각 단계 = 에너지 방출. 야생(NONE·주인 없음)은
    //   자율 본능(아래 combat·harvest)으로 돌고, 욕구를 가진 개체는 오직 이 절차로 행동한다(중복 없음).
    if (this.tickCount % CREATURE_PURSUE_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#performDesire();
    }
    // feature-0008 발산·전투(포식) — 큰 생명체가 사거리 안 더 작은 생명체를 공격해 그 질서를 무너뜨리고
    //   풀려난 에너지를 손실적으로 회수한다(강탈). 대사 앞에 돌린다 — 이번 틱에 뺏긴 먹이는 곧이어 대사
    //   순환에서 예비 아래로 떨어지면 죽어 분해된다(전투사 → 결정, 생태 루프). 순수 클램프(결정론 불변).
    if (this.tickCount % CREATURE_ATTACK_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#combat();
    }
    // feature-0009 발산·파괴(방출) — 사거리 안 크기 무관 표적에 발산해 그 질서를 파괴한다(회수 없음 = 캐스터로
    //   안 돌아옴, 표적 에너지는 심우주 열·국소장 연기로 흩어짐). 전투(강탈) 뒤에 돌린다 — 먹지 못한 상대를
    //   원거리에서 태워 없애는 다른 원리. 세게 맞으면 완전 연소(잔해 없이 전소). 순수 클램프(결정론 불변).
    if (this.tickCount % DISCHARGE_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#discharge();
    }
    // feature-0006 생명체 대사 — 각 생명체가 스스로 국소장을 갈구해 질서를 보충하고(field→생명체),
    //   살아있음의 비용을 심우주로 방출하며(생명체→SINK), 그래도 최소 예비 아래로 떨어지면 죽는다(분해).
    //   확산·석출 뒤에 돌린다 — 세계의 에너지가 흩어져 자리 잡은 뒤 그 자리에서 갈구한다.
    if (this.tickCount % CREATURE_METABOLISM_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      this.#metabolizeCreatures();
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
        let quantum = Math.max(1, Math.floor((a + b) / MATERIAL_DIFFUSE_QUANTUM_DIVISOR));
        // feature-0005 step4 — 액체(중밀도)는 응집해 등방 확산이 약하다(1/COHESION). 그래서 기체처럼
        //   퍼지지 않고 뭉쳐 중력(#settleLiquid)으로 아래로 흐른다. 기체·고밀도는 그대로.
        const hi = Math.max(a, b);
        if (hi >= LIQUID_CONDENSE && hi < CRYSTAL_SATURATION) quantum = Math.max(1, Math.floor(quantum / LIQUID_COHESION));
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
      // 상태별 증발 — 액체(중밀도)는 응집해 덜 샌다(divisor 큼 = 손실↓). 기체·고밀도는 기본율.
      const divisor = (bal >= LIQUID_CONDENSE && bal < CRYSTAL_SATURATION) ? LIQUID_RADIATE_DIVISOR : MATERIAL_RADIATE_DIVISOR;
      let rad = Math.floor(bal / divisor);
      const frac = bal % divisor;
      if (frac > 0 && this.rng() * divisor < frac) rad += 1;
      if (rad > 0) this.ledger.transfer(id, POOL.SINK, rad, CAUSE.RADIATE);
    }
  }

  // 액체 중력 침강 — feature-0005 step4. 중밀도(액체) 국소장은 중력에 따라 아래 복셀로 흐른다.
  //   아래가 용량(LIQUID_CAPACITY)까지 차면 넘쳐 위에 남는다 → 바닥부터 고여 수평 수면을 이룬다.
  //   기체(저밀도)와 고밀도(과포화·석출)는 침강하지 않는다(액체 밴드에서만 중력) — 그래서 저밀도는 등방으로
  //   퍼지고(feature-0004 불변) 중밀도만 가라앉는다. 침강은 국소장→국소장 무음 이체(보존·정수).
  #settleLiquid() {
    const M = POOL.MATERIAL;
    for (let cy = 0; cy < this.cols; cy++)
      for (let cx = 0; cx < this.cols; cx++)
        for (let cz = 1; cz < FIELD_Z_LAYERS; cz++) { // 아래 쌍부터 처리 → 바닥이 먼저 찬다
          const V = `${M}${cx}_${cy}_${cz}`, W = `${M}${cx}_${cy}_${cz - 1}`;
          const bv = this.ledger.balance(V);
          if (bv < LIQUID_CONDENSE || bv >= CRYSTAL_SATURATION) continue; // 액체 밴드만 침강
          const room = LIQUID_CAPACITY - this.ledger.balance(W);
          if (room <= 0) continue; // 아래가 찼다 → 여기 고인다(수면)
          const q = Math.min(bv, room, LIQUID_SETTLE_MAX);
          if (q > 0) this.ledger.transfer(V, W, q, CAUSE.SETTLE);
        }
  }

  // 결정화(석출) — feature-0005. 국소장 복셀 농도가 포화 임계를 넘으면(과포화) 초과분의 일부가
  //   같은 자리 결정 풀로 옮겨져 동결한다. 석출량 = floor((농도−포화)/DIVISOR) — 자기 제한이다:
  //   장을 포화까지 끌어내리면 초과가 0 이 되어 멈춘다(현실의 침전 평형). 결정론(rng 미사용) —
  //   "저엔트로피 요동(국소에 에너지가 쌓인 드문 사건) 자체가 희귀도"다. 결정은 확산·복사 순회
  //   대상이 아니므로(materialKeys 밖) 한 번 동결되면 가만두는 한 잔고가 불변이다(정적성).
  #crystallize() {
    const LS = WORLD_HEIGHT / FIELD_Z_LAYERS;
    for (const [cx, cy, cz, matId] of this.materialCells) {
      const bal = this.ledger.balance(matId);
      if (bal <= CRYSTAL_SATURATION) continue; // 과포화가 아니면 석출 없음
      // 그 복셀의 "거주 결정"을 얻거나(없으면 hotspot 중심에 새로 핵생성) 키운다 — 개별 결정으로 자란다.
      let cryId = this.voxelResident.get(matId);
      if (cryId === undefined) {
        cryId = this.#spawnCrystal((cx + 0.5) * REGION_SIZE, (cy + 0.5) * REGION_SIZE, (cz + 0.5) * LS, pickSpecies(this.crystalRng));
        this.voxelResident.set(matId, cryId);
      }
      // 과포화도(초과분)에 비례해 석출하되 상한으로 묶는다 — 몰릴수록 잘 맺히되 확산을 이기지 않는다.
      const quantum = Math.min(CRYSTAL_PRECIPITATE_MAX, Math.max(1, Math.floor((bal - CRYSTAL_SATURATION) / CRYSTAL_PRECIPITATE_DIVISOR)));
      this.ledger.transfer(matId, cryId, quantum, CAUSE.CRYSTALLIZE); // 확산처럼 무음 내부 이체(상태는 CRYSTAL 스냅샷으로 방송)
    }
  }

  // 반응(화학) — feature-0005 step3. 반경 안의 두 결정이 종에 따라 반응한다.
  //   결정론: seq 오름차순으로 훑어, 각 결정 A 는 반경 안에서 seq 가 더 큰 가장 이른 상대 B 와 1회 반응한다
  //   (한 틱에 각 결정 최대 1회 = 점진적). 같은 종 → 융합(반응열 없음), 다른 종 → 화합(반응열 방출).
  #react() {
    const crys = [...this.crystals.values()]
      .filter(c => this.ledger.balance(c.id) > 0 && !c.raw) // 재료(raw, 미가공)는 반응에 면역 — 제조(feature-0010 step2)까지 안정 유지
      .sort((a, b) => a.seq - b.seq);
    const reacted = new Set();
    for (const A of crys) {
      if (reacted.has(A.id)) continue;
      let B = null;
      for (const C of crys) {
        if (C.seq <= A.seq || reacted.has(C.id)) continue;
        if (dist3(A.x, A.y, A.z, C.x, C.y, C.z) <= CRYSTAL_REACT_RADIUS) { B = C; break; }
      }
      if (!B) continue;
      this.#reactPair(A, B);
      reacted.add(A.id);
      reacted.add(B.id);
    }
  }

  // 두 결정을 반응시킨다 — B 를 A 로 합치고(전량 이체), 산물 종을 정하고, 다른 종이면 반응열을 방출한다.
  #reactPair(A, B) {
    const balB = this.ledger.balance(B.id);
    const sum = this.ledger.balance(A.id) + balB;
    this.ledger.transfer(B.id, A.id, balB, CAUSE.REACT); // B → A 전량 (B 잔고 0)
    if (A.species === B.species) {
      // 같은 종 → 순수 융합(응집). 반응열 없음, 종 그대로.
    } else {
      A.species = reactSpecies(A.species, B.species); // 다른 종 → 새 화합물
      const release = Math.floor(sum / CRYSTAL_REACT_RELEASE_DIVISOR); // 발열 → 그 자리 국소장
      if (release > 0) this.ledger.transfer(A.id, materialKey(A.x, A.y, A.z), release, CAUSE.REACT);
    }
    this.#removeCrystal(B.id); // 소진된 B 소멸(잔고 0)
  }

  // 결정 하나 제거 — 레지스트리·거주 인덱스·원장 풀에서 모두 지운다(잔고 0 전제).
  #removeCrystal(id) {
    this.crystals.delete(id);
    for (const [k, v] of this.voxelResident) if (v === id) this.voxelResident.delete(k);
    this.ledger.removePool(id);
  }

  // 발산·전투 = 포식 — feature-0008. forage(국소장)·harvest(결정)가 수동적 저장고를 긁는 것이라면, 강탈은
  //   능동적으로 질서를 유지하는 다른 생명체에서 뜯어내는 세 번째 free energy 수입이다. 상대가 저항하므로
  //   (1) 먼저 일을 들여 그 질서를 무너뜨려야 하고(발산 비용 → 열/SINK), (2) 붕괴로 풀려난 에너지도 전부는
  //   못 붙잡는다(효율<1, 나머지는 국소장으로 흩어짐) — 그래서 얻는 것 < 뺏는 것(2법칙·생태학 ~10% 법칙).
  //   포식 규칙: 각 생명체는 사거리 안에서 **자기보다 작은(size<)** 가장 가까운 먹이 하나를 친다(강자→약자).
  //   결정론: seq 오름차순으로 훑고 순수 클램프(rng 미사용) — 확산·성장 결정론 불변. 전부 ledger.transfer → 보존.
  #combat() {
    const list = [...this.creatures.values()].sort((a, b) => a.seq - b.seq); // 결정론 순서
    for (const A of list) {
      if (!this.creatures.has(A.id)) continue;                 // 이번 패스 중 정리됐을 수도(방어)
      if (A.desire !== DESIRE.NONE) continue;                  // 욕구를 가진 개체는 절차(사냥)로 친다 — 자율 본능은 야생만
      // 발산할 예비가 없으면 공격하지 않는다(예비 가드는 #strike 안) — 사거리 안 나보다 작은 가장 가까운 먹이
      let prey = null, bestD = Infinity;
      for (const V of this.creatures.values()) {
        if (V.id === A.id || V.size >= A.size) continue;        // 포식 = 더 작은 것만(강자→약자)
        if (this.ledger.balance(V.id) <= 0) continue;
        const d = dist3(A.x, A.y, A.z, V.x, V.y, V.z);
        if (d <= CREATURE_ATTACK_RADIUS && d < bestD) { prey = V; bestD = d; }
      }
      if (prey) this.#strike(A, prey);
    }
  }

  // 타격(강탈) — feature-0008 의 세 갈래 회계를 한 곳으로 뽑았다(자율 #combat + 절차 hunt 공용). 저항하는 먹이
  //   에서 뜯어내는 손실적 수입: ① 발산 비용 A→SINK(질서 깨는 열) ② 붕괴 damage ③ 회수 CAPTURE_PCT 만 A 로,
  //   나머지는 국소장으로 흩어진다(효율<1 = 얻는 것 < 뺏는 것). 예비 없으면 못 친다. 전부 ledger.transfer → 보존.
  #strike(A, prey) {
    const cost = CREATURE_ATTACK_COST * A.size;
    if (this.ledger.balance(A.id) < cost + CREATURE_DEATH_THRESHOLD * A.size) return 0; // 굶주리면 사냥할 여력 없음
    this.#tx(A.id, POOL.SINK, cost, CAUSE.BURST, { x: A.x, y: A.y });                   // ① 발산 비용 → 열
    const damage = Math.min(CREATURE_ATTACK_POWER * A.size, this.ledger.balance(prey.id));
    if (damage <= 0) return 0;                                                          // ② 붕괴
    const capture = Math.floor(damage * CREATURE_ATTACK_CAPTURE_PCT / 100);
    const got = capture > 0 ? this.#tx(prey.id, A.id, capture, CAUSE.ATTACK, { x: prey.x, y: prey.y }) : 0; // ③ 강탈
    const scatter = damage - got;                                                       // 못 붙잡은 몫 = 세계로
    if (scatter > 0) this.#tx(prey.id, materialKey(prey.x, prey.y, prey.z), scatter, CAUSE.ATTACK, { x: prey.x, y: prey.y });
    return got;
  }

  // 발산·파괴 = 방출 — feature-0009. 강탈(포식)이 표적 에너지를 커플링해 일부 포획하는 것이라면, 방출은
  //   표적의 질서를 *파괴만* 한다 — 붕괴 에너지가 캐스터가 아니라 세계(심우주 열 + 국소장 연기)로 흩어진다.
  //   그래서 캐스터는 순수 지출(먹지 않음). 표적 규칙: 사거리(길다) 안 **먹을 수 없는 상대**(size ≥ 자신) —
  //   강탈(먹이=size<)과 겹치지 않게 갈랐다. 못 먹는 강자·동급이 방출 대상. 결정론: seq 오름차순 + 순수 클램프.
  #discharge() {
    const list = [...this.creatures.values()].sort((a, b) => a.seq - b.seq); // 결정론 순서
    for (const A of list) {
      if (!this.creatures.has(A.id)) continue;                 // 이번 패스 중 전소됐을 수도(방어)
      if (A.desire !== DESIRE.NONE) continue;                  // 방출도 야생 본능만 — 욕구를 가진 개체는 절차로 행동
      const cost = DISCHARGE_COST * A.size;
      // 발산할 예비가 없으면(비용+최소 예비 미만) 쏘지 않는다 — 회수 없는 순수 지출이라 남발하면 제 에너지가 마른다.
      if (this.ledger.balance(A.id) < cost + CREATURE_DEATH_THRESHOLD * A.size) continue;
      // 사거리 안, **강탈로 먹을 수 없는 상대**(size ≥ 자신)의 가장 가까운 하나 — 못 먹으니 태운다.
      //   강탈(강자→약자, size<)과 방출(약자·동급→상대, size≥)이 크기로 깔끔히 갈린다(겹침 없음): 먹을 수
      //   있으면 강탈해 먹고, 못 먹으면 방출로 부순다. 그래서 약자·동급이 강자를 어쩌는 유일한 수단이 방출이다.
      let target = null, bestD = Infinity;
      for (const V of this.creatures.values()) {
        if (V.id === A.id || V.size < A.size) continue; // 더 작은 것(=먹이)은 강탈 몫 — 방출 대상 아님
        if (this.ledger.balance(V.id) <= 0) continue;
        const d = dist3(A.x, A.y, A.z, V.x, V.y, V.z);
        if (d <= DISCHARGE_RADIUS && d < bestD) { target = V; bestD = d; }
      }
      if (!target) continue;
      // ① 발산 비용 — 투사체를 만드는 폭발적 소모. 되돌아오지 않는 열로 심우주에 지불.
      this.#tx(A.id, POOL.SINK, cost, CAUSE.BURST, { x: A.x, y: A.y });
      // ② 파괴 damage — 표적 질서가 무너진다(표적 잔고로 클램프).
      const damage = Math.min(DISCHARGE_POWER * A.size, this.ledger.balance(target.id));
      if (damage <= 0) continue;
      // ③ 회수 없는 분산 — 붕괴 에너지를 심우주(열)+국소장(연기)로 흩는다. 어느 것도 캐스터로 안 간다(강탈과의 대비).
      this.#dissipate(target, damage);
      // ④ 완전 연소 — 예비 아래로 떨어졌으면 그 자리서 전소(남은 전부 열+연기로, 잔해 결정 없음 = #decompose 안 씀).
      if (this.ledger.balance(target.id) < CREATURE_DEATH_THRESHOLD * target.size) this.#incinerate(target);
    }
  }

  // 붕괴 에너지를 세계로 흩는다(회수 없음) — feature-0009. BURN_PCT 는 심우주(열)로 태우고, 나머지는 그 자리
  //   국소장(연기)으로. 캐스터로는 한 푼도 가지 않는다 — 이것이 파괴(방출)와 포획(강탈)을 가르는 지점이다.
  #dissipate(V, amount) {
    const burn = Math.floor(amount * DISCHARGE_BURN_PCT / 100);
    if (burn > 0) this.#tx(V.id, POOL.SINK, burn, CAUSE.DISCHARGE, { x: V.x, y: V.y });        // 열 → 심우주
    const smoke = amount - burn;
    if (smoke > 0) this.#tx(V.id, materialKey(V.x, V.y, V.z), smoke, CAUSE.DISCHARGE, { x: V.x, y: V.y }); // 연기 → 국소장
  }

  // 완전 연소 — feature-0009. 방출로 예비가 무너진 표적을 그 자리서 전소시킨다: 남은 에너지까지 열+연기로 흩고
  //   레지스트리·원장에서 제거한다. 잔해 결정을 남기지 않는다(#decompose 와 다른 죽음 — 굶주림/포식=결정, 전소=무).
  #incinerate(V) {
    const rest = this.ledger.balance(V.id);
    if (rest > 0) this.#dissipate(V, rest); // 남은 전부를 열+연기로 — 흔적 없이 사라진다
    this.ledger.removePool(V.id);
    this.creatures.delete(V.id);
  }

  // 욕구 절차 실행 — feature-0011. 제어되는 각 생명체가 제 욕구의 **절차**(shared/desires.js)를 한 단계 수행한다.
  //   엔진은 절차의 단계를 순서대로 훑어 **첫 번째로 적용 가능한 단계**를 실행한다 — 상황에 따라 찾아가고·요리하고·
  //   먹고·타격한다. 단계는 오직 ctx(아래 #desireCtx)만 쓰므로 엔진은 욕구 종류를 모른다 — 새 욕구를 레지스트리에
  //   얹기만 하면 이 엔진이 그대로 실행한다(개방성). 각 단계의 행동은 에너지를 방출/이동한다(전부 ledger.transfer).
  //   결정론: seq 오름차순 순회 + 순수 클램프(rng 미사용) → 확산·성장·전투 결정론 불변.
  #performDesire() {
    this.#appraise(); // feature-0012 step2 — 먼저 상황(차이)이 자율 감정(feeling)을 갱신 → 우선순위 재정렬
    for (const cre of [...this.creatures.values()].sort((a, b) => a.seq - b.seq)) {
      if (!this.creatures.has(cre.id)) continue;
      const ctx = this.#desireCtx(cre);
      // feature-0012: 중첩된 욕구를 **유효 우선순위 내림차순**으로 훑어, **지금 수행 가능한 첫 욕구**의 첫 적용
      //   단계를 실행한다. 최우선 욕구가 상황상 수행 불가(표적 없음 등)면 다음 우선순위로 내려간다 → "상황에 따라
      //   행동이 달라진다". 감정으로 우선순위를 키우면 이 순서가 바뀌어 행동이 바뀐다(감정=중요도).
      for (const name of this.#rankedDesires(cre)) {
        const proc = DESIRE_PROCEDURES[name];
        if (!proc) continue;
        let acted = false;
        for (const step of proc.steps) {
          if (step.applicable(ctx)) { step.act(ctx); acted = true; break; } // 그 욕구의 첫 적용 단계(우선순위 절차, feature-0011)
        }
        if (acted) break; // 가장 높은 우선순위의 수행 가능한 욕구가 이번 틱을 차지한다
      }
    }
  }

  // 욕구 스택을 유효 우선순위(priority+emotion+feeling) 내림차순으로 정렬한 이름 목록 (feature-0012). 동률은 주입
  //   (삽입) 순서를 유지한다(결정론). 스택이 비면 대기(NONE) 하나 — 소유 생명체는 주인 곁을 따르고, 야생은 정지.
  #rankedDesires(cre) {
    if (cre.desires.size === 0) return [DESIRE.NONE];
    return [...cre.desires.entries()]
      .map(([name, d], i) => ({ name, w: desireWeight(d.priority, d.emotion, d.feeling), i }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .map(x => x.name);
  }

  // 자율 감정 평가 (feature-0012 step2) — "차이는 신호". 각 생명체의 각 욕구에 대해, 그 욕구 절차가 appraise(ctx)
  //   로 지금 상황(차이)이 얼마나 그 욕구를 중요하게 느끼는지(feeling)를 스스로 계산해 갱신한다. 굶주릴수록 식사의
  //   feeling 이 치솟고, 배부르면 0 으로 감쇠(포만)한다 → 우선순위가 상황에 따라 스스로 재정렬된다(외부 주입 없이).
  //   appraise 없는 욕구(예: 사냥)의 중요도는 외생(priority+emotion)만으로 정해진다. 순수 계산(rng 미사용) → 결정론.
  #appraise() {
    for (const cre of this.creatures.values()) {
      if (cre.desires.size === 0) continue;
      let ctx = null;
      for (const [name, d] of cre.desires) {
        const proc = DESIRE_PROCEDURES[name];
        if (!proc || typeof proc.appraise !== 'function') { d.feeling = 0; continue; }
        if (!ctx) ctx = this.#desireCtx(cre);
        d.feeling = Math.max(0, Math.min(DESIRE_EMOTION_MAX, proc.appraise(ctx) | 0));
      }
    }
  }

  // 방송용 욕구 스택 — [[name, priority, emotion, feeling], ...] 유효 우선순위 내림차순 (feature-0012). 뷰어가 중첩·
  //   승자·감정(외생+자율)을 그린다. feeling=상황이 스스로 만든 감정(굶주림 등, step2).
  #desireStack(cre) {
    return [...cre.desires.entries()]
      .map(([name, d], i) => ({ name, d, w: desireWeight(d.priority, d.emotion, d.feeling), i }))
      .sort((a, b) => b.w - a.w || a.i - b.i)
      .map(x => [x.name, x.d.priority, x.d.emotion, x.d.feeling ?? 0]);
  }

  // 절차 단계에 넘기는 ctx — 지각·행동 API. 단계는 이것만 쓰고 게임 내부는 모른다(개방성의 경계). (feature-0011)
  #desireCtx(cre) {
    const self = this;
    return {
      EAT_REACH: CREATURE_HARVEST_RADIUS, STRIKE_REACH: CREATURE_ATTACK_RADIUS, LEASH_STOP: CREATURE_LEASH_STOP,
      CRAFT_REACH: CRAFT_REACH,
      cre,
      nearestCrystal: (opts) => self.#nearestCrystalFor(cre, opts),
      nearestPrey: () => self.#nearestPrey(cre),
      craftPair: () => self.#craftPairFor(cre),                 // feature-0010 step2 — 조합 가능한 재료 쌍
      craft: (a, b) => self.#craft(cre, a, b),                  // feature-0010 step2 — 두 재료를 산물로 조합(방출)
      ownerPos: () => { if (!cre.owner) return null; const p = self.players.get(cre.owner); return p ? { x: p.x, y: p.y, z: p.z } : null; },
      inReach: (t, r) => dist3(cre.x, cre.y, cre.z, t.x, t.y, t.z) <= r,
      edible: (c) => !c.raw,
      capacity: () => { const pool = self.ledger.get(cre.id); return pool ? pool.max : CREATURE_MAX_ENERGY * cre.size; }, // 자기 용량(feature-0012 appraise)
      balance: () => self.ledger.balance(cre.id),                                                                        // 자기 잔고(feature-0012 appraise)
      moveToward: (t, stop) => self.#stepToward(cre, t, stop),
      eat: (c) => self.#eatCrystal(cre, c),
      cook: (c) => self.#cookCrystal(cre, c),
      strike: (p) => self.#strike(cre, p),
      dissipate: (amount, cause) => self.#tx(cre.id, POOL.SINK, amount, cause, { x: cre.x, y: cre.y }), // 개방용 일반 방출 primitive
    };
  }

  // 한 걸음 이동(방출) — feature-0010. 표적으로 최대 STRIDE 나아가고, 나아간 거리/50 을 그 자리 국소장으로
  //   소산한다(생명체→국소장, MOVE = 플레이어 이동과 동일 회계). 사거리 안이면 안 움직이고, 예비 없으면 못 쫓는다.
  #stepToward(cre, target, stop) {
    const d = dist3(cre.x, cre.y, cre.z, target.x, target.y, target.z);
    if (d <= stop) return false;                                       // 이미 도달
    if (this.ledger.balance(cre.id) <= CREATURE_DEATH_THRESHOLD * cre.size) return false; // 굶주리면 못 쫓는다
    const step = Math.min(CREATURE_STRIDE, d - stop);
    cre.x = Math.round(cre.x + (target.x - cre.x) / d * step);
    cre.y = Math.round(cre.y + (target.y - cre.y) / d * step);
    cre.z = Math.round(cre.z + (target.z - cre.z) / d * step);
    const { cost, debt } = moveCost(cre.moveDebt, step);
    cre.moveDebt = debt;
    if (cost > 0) this.#tx(cre.id, materialKey(cre.x, cre.y, cre.z), cost, CAUSE.MOVE, { x: cre.x, y: cre.y });
    return true;
  }

  // 먹기(채집) — feature-0007. 결정의 농축 에너지를 흡수한다(결정→생명체, 종별 배율). 다 먹힌 결정은 소멸.
  #eatCrystal(cre, c) {
    const want = CREATURE_HARVEST_RATE * cre.size * crystalYield(c.species);
    const got = this.#tx(c.id, cre.id, want, CAUSE.HARVEST, { x: cre.x, y: cre.y });
    if (got > 0 && this.ledger.balance(c.id) === 0) this.#removeCrystal(c.id);
    return got;
  }

  // 요리(변형) — feature-0011. 날것 결정을 먹을 수 있게 바꾼다. 그 일은 에너지를 방출한다: COOK_COST×size 를
  //   심우주(열, BURN_PCT)+국소장(연기)로 흩는다 — 순수 지출(회수 없음). 예비 없으면 못 한다(굶주리면 요리 불가).
  //   결정은 raw=false 로 바뀌고 종이 변형된다(cookedSpecies) — 이제 먹을 수 있다. 다음 틱 eat 단계가 먹는다.
  #cookCrystal(cre, c) {
    if (this.ledger.balance(cre.id) <= CREATURE_DEATH_THRESHOLD * cre.size) return 0;
    const cost = COOK_COST * cre.size;
    const burn = Math.floor(cost * COOK_BURN_PCT / 100);
    const paid = this.#tx(cre.id, POOL.SINK, burn, CAUSE.COOK, { x: cre.x, y: cre.y })          // 열 → 심우주
               + this.#tx(cre.id, materialKey(cre.x, cre.y, cre.z), cost - burn, CAUSE.COOK, { x: cre.x, y: cre.y }); // 연기 → 국소장
    c.species = cookedSpecies(c.species);
    c.raw = false;                                                     // 요리됨 = 이제 먹을 수 있다
    return paid;
  }

  // 조합 가능한 재료 쌍 — feature-0010 step2. 감지 반경(SEEK) 안, 서로 CRAFT_PAIR_RADIUS 안에 **붙어 있는** 두
  //   **재료(raw, 미가공)** 결정(아직 산물이 아님=crafted 아님). 재료는 수동 반응(#react)에 면역이라(inert) 쌍이
  //   안정적으로 유지된다 — 생명체가 와서 조합할 때까지 흩어지지 않는다. 생명체에서 가까운 순으로 훑어 첫 쌍을
  //   고른다(결정론: 거리→seq 정렬). 산물(crafted)은 재료로 다시 쓰지 않아 무한 재조합을 막는다.
  #craftPairFor(cre) {
    const mats = [...this.crystals.values()]
      .filter(c => this.ledger.balance(c.id) > 0 && c.raw && !c.crafted && dist3(cre.x, cre.y, cre.z, c.x, c.y, c.z) <= CREATURE_SEEK_RADIUS)
      .sort((a, b) => (dist3(cre.x, cre.y, cre.z, a.x, a.y, a.z) - dist3(cre.x, cre.y, cre.z, b.x, b.y, b.z)) || (a.seq - b.seq));
    for (const a of mats) {
      for (const b of mats) {
        if (b.id === a.id) continue;
        if (dist3(a.x, a.y, a.z, b.x, b.y, b.z) <= CRAFT_PAIR_RADIUS) return { a, b };
      }
    }
    return null;
  }

  // 제조(조합) — feature-0010 step2. 가까운 두 재료 결정을 하나의 **산물**로 합친다. **만드는 일**은 에너지를
  //   방출한다: CRAFT_COST×size 를 열(심우주, BURN_PCT)+연기(국소장)로 흩는다(순수 지출, 회수 없음 = 요리·방출과
  //   같은 결). b 를 a 로 전량 합치고(조합), a 를 산물로 변형한다: 종=craftedSpecies(재료와 다름), crafted=true(표식),
  //   raw=false(사용 가능). 예비 없으면 못 만든다(굶주리면 제조 불가). 전부 ledger.transfer → 보존, rng 미사용 → 결정론.
  #craft(cre, a, b) {
    if (this.ledger.balance(cre.id) <= CREATURE_DEATH_THRESHOLD * cre.size) return 0; // 굶주리면 제조 불가
    const cost = CRAFT_COST * cre.size;
    const burn = Math.floor(cost * CRAFT_BURN_PCT / 100);
    const paid = this.#tx(cre.id, POOL.SINK, burn, CAUSE.CRAFT, { x: cre.x, y: cre.y })                        // 열 → 심우주
               + this.#tx(cre.id, materialKey(cre.x, cre.y, cre.z), cost - burn, CAUSE.CRAFT, { x: cre.x, y: cre.y }); // 연기 → 국소장
    const balB = this.ledger.balance(b.id);
    if (balB > 0) this.#tx(b.id, a.id, balB, CAUSE.CRAFT, { x: a.x, y: a.y }); // 재료 b → 산물 a (조합, 보존)
    a.species = craftedSpecies(a.species, b.species);
    a.crafted = true; a.raw = false;                                          // 산물 = 재료와 다른 종·사용 가능
    this.#removeCrystal(b.id);                                                // 소진된 재료 소멸(잔고 0)
    return paid;
  }

  // 감지 반경(SEEK) 안 잔고 있는 가장 가까운 결정 — 욕구 절차의 표적. edibleOnly 면 날것(raw)은 건너뛴다. (feature-0010·0011)
  #nearestCrystalFor(cre, opts = {}) {
    let best = null, bestD = CREATURE_SEEK_RADIUS;
    for (const c of this.crystals.values()) {
      if (this.ledger.balance(c.id) <= 0) continue;
      if (opts.edibleOnly && c.raw) continue;
      const d = dist3(cre.x, cre.y, cre.z, c.x, c.y, c.z);
      if (d <= bestD) { best = c; bestD = d; }
    }
    return best;
  }

  // 감지 반경(SEEK) 안에서 잔고 있는 가장 가까운 **더 작은** 생명체 — 사냥 욕망의 표적(포식=강자→약자). (feature-0010)
  #nearestPrey(cre) {
    let best = null, bestD = CREATURE_SEEK_RADIUS;
    for (const v of this.creatures.values()) {
      if (v.id === cre.id || v.size >= cre.size) continue;
      if (this.ledger.balance(v.id) <= 0) continue;
      const d = dist3(cre.x, cre.y, cre.z, v.x, v.y, v.z);
      if (d <= bestD) { best = v; bestD = d; }
    }
    return best;
  }

  // 생명체 대사 — feature-0006. 각 생명체가 한 대사 틱에 스스로 도는 항상성 순환:
  //   ① 갈구(forage): 그 자리 국소장에서 최대 FORAGE_RATE 를 흡수한다(field→생명체, 용량·잔고로 클램프).
  //      세계에 에너지가 있으면 채워지고, 없으면 못 채운다 — "세계로부터 에너지를 갈구한다".
  //   ② 생사판정: 갈구 후에도 최소 예비(DEATH_THRESHOLD) 아래면 질서가 붕괴한다 → 죽음(분해). 갈구가
  //      먼저라 굶주리다가도 마침 에너지를 만나면 되살 수 있다(때맞춘 섭취). 못 만나면 결국 죽는다.
  //   ③ 물질대사(metabolize): 살아있음의 비용 BASAL 을 심우주로 방출한다(생명체→SINK, 되돌아오지 않는 손실).
  //      대사는 항상 예비 위에서 지불되므로 온전히 나간다 — 갈구가 대사를 못 따라가면 예비가 마르고 죽는다.
  //   전부 순수 클램프 이체(rng 미사용)라 확산 결정론에 영향 없고, 갈구·대사는 무음 내부 이체(상태는 CREATURE 방송).
  //   feature-0006 step2 — 용량·갈구·대사·예비가 스탯(size)에 비례한다. 대사 뒤 잔고가 용량 근처면 흑자로
  //   성장점을 쌓아 성장하고(size↑), 굶주리면 진척이 깎인다 — 큰 몸은 세계가 못 받치면 몰락한다(#growCreature).
  #metabolizeCreatures() {
    for (const cre of [...this.creatures.values()]) {
      const matId = materialKey(cre.x, cre.y, cre.z);
      if (cre.desire === DESIRE.NONE) this.#harvestNearbyCrystal(cre);       // ⓪ 채집 본능(feature-0007) — 야생/대기만. 욕구를 가진 개체는 절차로 먹는다
      this.ledger.transfer(matId, cre.id, CREATURE_FORAGE_RATE * cre.size, CAUSE.FORAGE); // ① 갈구(size 비례) — 모든 생명체의 생명유지
      const bal = this.ledger.balance(cre.id);
      if (bal < CREATURE_DEATH_THRESHOLD * cre.size) { this.#killCreature(cre); continue; }  // ② 붕괴(예비도 size 비례)
      this.ledger.transfer(cre.id, POOL.SINK, CREATURE_BASAL_COST * cre.size, CAUSE.METABOLIZE); // ③ 대사(size 비례)
      this.#growCreature(cre); // ④ 성장 판정(에너지 이력 → 스탯)
    }
  }

  // 채집 — feature-0007. 반경 안 가장 가까운 결정 하나에서 농축 에너지를 흡수한다(결정 → 생명체). 결정은 원래
  //   정적·면역(feature-0005)이지만 생명이 가까이 오면 그 정적 질서가 풀린다 — feature-0005 step5(상호작용)를
  //   생명 쪽에서 구현한 것. 흡수량은 size 비례·용량으로 클램프(배부르면 못 먹는다). 다 먹힌 결정은 소멸한다.
  //   확산 갈구(옅은 에너지)와 달리 결정은 뭉친 에너지라 크게 들이켠다 = 증폭. tx 에 at 을 실어 근처 시야에 방송.
  //   feature-0007 step2 — 종별 효과: 흡수 배율이 결정 종(species)에 따라 다르다(crystalYield). 같은 잔고라도
  //   고효율 종은 더 크게 들이켜(빠른 성장), 저효율 종은 천천히 — "아이템이 나의 에너지에 영향을 준다".
  #harvestNearbyCrystal(cre) {
    let best = null, bestD = Infinity;
    for (const c of this.crystals.values()) {
      if (this.ledger.balance(c.id) <= 0 || c.raw) continue; // 날것(raw)은 본능으로 못 먹는다 — 요리(식사 절차)가 필요(feature-0011)
      const d = dist3(cre.x, cre.y, cre.z, c.x, c.y, c.z);
      if (d <= CREATURE_HARVEST_RADIUS && d < bestD) { best = c; bestD = d; }
    }
    if (!best) return;
    this.#eatCrystal(cre, best); // feature-0007 흡수(종별 배율)·소멸은 #eatCrystal 공용
  }

  // 성장 — feature-0006 step2. 대사 뒤 잔고가 용량 근처(흑자)면 성장점을 쌓고, 굶주림(적자)이면 깎는다(성장은
  //   hard-won — 한 번 굶으면 진척이 되돌아간다). 성장점이 문턱에 닿으면 성장(size↑)한다. size 는 순수 상태
  //   변수(에너지 풀 아님)라 보존과 무관하다 — 용량(max)만 커지고 에너지는 그대로다. 큰 몸은 대사도 size 비례로
  //   커지므로(#metabolizeCreatures) 세계가 그만큼 받쳐주지 못하면 곧 굶어 죽는다 — 세계 풍요도가 크기 상한을 정한다.
  #growCreature(cre) {
    if (cre.size >= CREATURE_SIZE_MAX) return; // 스탯 상한
    const cap = CREATURE_MAX_ENERGY * cre.size;
    const bal = this.ledger.balance(cre.id);
    if (bal >= CREATURE_GROWTH_FULL_FRACTION * cap) cre.growth += 1;                       // 흑자 — 여유가 쌓인다
    else if (bal < CREATURE_GROWTH_HUNGRY_FRACTION * cap) cre.growth = Math.max(0, cre.growth - 2); // 적자 — 진척이 깎인다
    if (cre.growth >= CREATURE_GROWTH_THRESHOLD) {
      cre.size += 1; cre.growth = 0;
      const pool = this.ledger.get(cre.id);
      if (pool) pool.max = CREATURE_MAX_ENERGY * cre.size; // 성장 = 용량 확장(에너지 이동 없음 → 보존 무관)
    }
  }

  // 생명체 죽음 — 질서 유지에 실패한(굶주린) 생명체가 붕괴한다. 남은 에너지는 결정(잔해)+국소장(거름)으로
  //   분해되고(feature-0005 죽음 경로 공유 — 근처 플레이어 시야에 방송), 레지스트리·원장 풀에서 지운다.
  #killCreature(cre) {
    this.#decompose(cre.id, cre.x, cre.y, cre.z);
    this.ledger.removePool(cre.id);
    this.creatures.delete(cre.id);
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
    // 결정 스냅샷 — 개별 결정 [id, x, y, z, balance, species] (잔고>0). FIELD 와 같은 읽기 전용 표시값.
    const crystalCells = broadcastField
      ? [...this.crystals.values()].reduce((acc, c) => {
          const b = this.ledger.balance(c.id);
          if (b > 0) acc.push([c.seq, c.x, c.y, c.z, b, c.species, c.raw ? 1 : 0, c.crafted ? 1 : 0]); // raw=날것(feature-0011)·crafted=제조 산물(feature-0010 step2)
          return acc;
        }, [])
      : null;
    // 생명체 스냅샷 — 살아있는 생명체 [seq, x, y, z, balance, size, desire, owner, desires] (feature-0006·0010·0012).
    //   desire=승자 욕망(뷰어가 라벨·표적선), owner=제어자(강조), desires=중첩 스택(뷰어가 우선순위·감정 배지). CRYSTAL 과 같은 읽기 전용 표시값.
    const creatureCells = broadcastField
      ? [...this.creatures.values()].reduce((acc, c) => {
          const b = this.ledger.balance(c.id);
          if (b > 0) acc.push([c.seq, c.x, c.y, c.z, b, c.size, c.desire, c.owner, this.#desireStack(c)]); // feature-0012: desires=중첩 스택
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
      if (creatureCells) p.conn.send(encode(MSG.CREATURE, { cells: creatureCells }));

      if (checksumDue) {
        const regions = {};
        for (const key of p.regions) regions[key] = this.ledger.regionSum(key);
        p.conn.send(encode(MSG.CHECKSUM, {
          tick: this.tickCount, total: this.ledger.totalSum(), regions,
          src: this.ledger.balance(POOL.SOURCE), sink: this.ledger.balance(POOL.SINK),
          mat: this.#materialTotal(), cry: this.#crystalTotal(), cre: this.#creatureTotal(),
        }));
      }
    }
  }
}
