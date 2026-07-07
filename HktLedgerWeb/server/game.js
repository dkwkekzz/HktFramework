// ============================================================================
// GameServer — 원장 권위 (설계 문서 §2.3)
//
// 서버는 시뮬레이터가 아니라 회계사다. 하는 일의 전부:
//   ① 클램프  — 이체량을 잔고·수용량으로 제한 (보존 강제 지점)
//   ② 순서    — 인텐트를 도착 순 FIFO 로 중재, tx 에 전역 seq 부여
//   ③ 커밋    — 원장 갱신 + 지역 합계 O(1) 갱신
//   ④ 방송    — relevancy 필터된 tx 스트림 + 주기 체크섬
//
// 서버가 하지 않는 일: 이동 적분, 물리, 경로, 연출. 좌표는 클라 비콘을
// "에너지 예산 검증(스피드핵)과 개연성 검증(사거리)" 에만 쓴다.
//
// 수송 계층과 분리되어 있다 — conn 은 { send(str) } 만 구현하면 된다 (테스트 용이).
// ============================================================================

import { EnergyLedger } from '../shared/ledger.js';
import { generateWorld } from '../shared/worldgen.js';
import { createField, diffuseTick, fieldCellId, fieldCellOf } from '../shared/field.js';
import { canonicalDamage } from '../shared/audit.js';
import { attackBonus, upkeepFor, skillDamage, weaponBonus, gatherBonus } from '../shared/growth.js';
import { mulberry32 } from '../shared/rng.js';
import { MSG, INTENT, encode, encodeOps } from '../shared/protocol.js';
import {
  POOL, CAUSE, WORLD_SEED, WORLD_SIZE, WORLD_HEIGHT, SPAWN_POS, WORLD_SOURCE_INITIAL, dist3,
  RECYCLE_INTERVAL_TICKS, UPKEEP_INTERVAL_TICKS,
  PLAYER_MAX_ENERGY, SPAWN_GRANT, RESPAWN_DELAY_MS,
  MAX_SPEED, BEACON_TOLERANCE, BEACON_SLACK_PX, moveCost,
  GATHER_RANGE, GATHER_AMOUNT, NODE_REGEN_AMOUNT, REGEN_INTERVAL_TICKS,
  FIELD_GRID, FIELD_CELL_SIZE, FIELD_CELL_SEED, FIELD_INJECT_AMOUNT, FIELD_CELL_MAX,
  ATTACK_RANGE, ATTACK_COST, WEAPON_WEAR,
  LEECH_PERCENT, ATTACK_COOLDOWN_MS, MOB_RESPAWN_MS,
  CRYSTAL_COST, WEAPON_COST, PICKUP_RANGE, STRUCT_MAX, GROW_AMOUNT, SKILLS,
  AUDIT_SEED, AUDIT_SAMPLE_NUM, AUDIT_SAMPLE_DEN,
  CHECKSUM_INTERVAL_TICKS, regionKey, regionNeighbors,
} from '../shared/constants.js';

const RANGE_SLACK = 10; // 비콘 양자화·지연 흡수용 사거리 여유 (3D 사거리 = shared dist3)

export class GameServer {
  constructor({ now = () => Date.now(), auditSeed = AUDIT_SEED, snapshot = null, binaryOps = true } = {}) {
    this.now = now;
    this.auditSeed = auditSeed >>> 0;
    this.binaryOps = binaryOps; // A4: false 면 OPS 를 JSON 으로 (대역폭 A/B 계측용)
    // A2 감사 집계 — sampled: 감사한 위임 판정 수, caught: 조작 적발 수, cheaters: 적발자별 횟수
    this.audit = { delegated: 0, sampled: 0, caught: 0, cheaters: new Map() };
    this.ledger = new EnergyLedger();

    // 접속·틱 관련 휘발 상태 (플레이어는 재시작 시 재접속으로만 복귀)
    this.players = new Map(); // id -> player
    this.intents = [];        // 도착 순 큐 — 순서 중재의 실체
    this.pendingOps = [];     // 이번 틱 확정 tx + 사실 이벤트 (인과 순서 유지)
    this.pendingMoves = new Map(); // playerId -> [x, y, z] (3D 비콘 릴레이)
    this.nextPlayerNo = 1;

    // A3: 스냅샷이 있으면 원장 잔고 복원, 없으면 창세. 세계 = 원장 잔고뿐이라 이 둘로 충분.
    if (snapshot) this.#restore(snapshot);
    else this.#genesis();
  }

  // 창세: 세계의 모든 에너지는 SOURCE 에서 출발한다.
  // 이후 전 풀 합계는 영원히 WORLD_SOURCE_INITIAL — 이것이 보존 불변식.
  #genesis() {
    this.ledger.createPool(POOL.SOURCE, WORLD_SOURCE_INITIAL, Number.MAX_SAFE_INTEGER, null);
    this.ledger.createPool(POOL.SINK, 0, Number.MAX_SAFE_INTEGER, null);

    // 필드 셀 격자 — SOURCE/SINK 처럼 region=null 서버 내부 저수지 (방송·체크섬 대상 아님).
    // A1: 노드 재충전이 이 필드에서 확산으로 흐른다. 창세 적립도 SOURCE 인출이라 보존 유지.
    createField(this.ledger);
    for (let cy = 0; cy < FIELD_GRID; cy++)
      for (let cx = 0; cx < FIELD_GRID; cx++)
        this.ledger.transfer(POOL.SOURCE, fieldCellId(cx, cy), FIELD_CELL_SEED, CAUSE.SPAWN);

    const world = generateWorld(WORLD_SEED);
    this.nodes = new Map(); // id -> { id, x, y, max, cell }
    for (const n of world.nodes) {
      const cell = fieldCellOf(n.x, n.y, FIELD_CELL_SIZE);
      this.nodes.set(n.id, { ...n, cell: fieldCellId(cell.cx, cell.cy) });
      this.ledger.createPool(n.id, 0, n.max, regionKey(n.x, n.y));
      this.ledger.transfer(POOL.SOURCE, n.id, n.max, CAUSE.SPAWN); // 창세 이체 (방송 대상 없음)
    }
    this.mobs = new Map(); // id -> { id, x, y, max, dead, respawnAt }
    for (const m of world.mobs) {
      this.mobs.set(m.id, { ...m, dead: false, respawnAt: 0 });
      this.ledger.createPool(m.id, 0, m.max, regionKey(m.x, m.y));
      this.ledger.transfer(POOL.SOURCE, m.id, m.max, CAUSE.SPAWN);
    }

    this.items = new Map();   // id -> { id, itemType, owner, x, y }
    this.tickCount = 0;
    this.txSeq = 0;
    this.nextItemNo = 1;
  }

  // A3: 원장 잔고 저장 — 세계 상태의 전부. 배치·max 는 시드 유도라 담지 않는다.
  snapshot() {
    return {
      v: 1,
      tickCount: this.tickCount,
      txSeq: this.txSeq,
      nextItemNo: this.nextItemNo,
      pools: this.ledger.serialize(),
      items: [...this.items.values()].map(i => [i.id, i.itemType, i.owner, i.x, i.y, i.z]),
      mobs: [...this.mobs.values()].map(m => [m.id, m.dead, m.respawnAt]),
    };
  }

  // A3: 스냅샷에서 세계 복원. 원장 잔고는 그대로 로드, 배치·max·cell 은 시드에서 재유도.
  #restore(snap) {
    this.ledger.load(snap.pools);
    this.tickCount = snap.tickCount;
    this.txSeq = snap.txSeq;
    this.nextItemNo = snap.nextItemNo;

    const world = generateWorld(WORLD_SEED);
    this.nodes = new Map();
    for (const n of world.nodes) {
      const cell = fieldCellOf(n.x, n.y, FIELD_CELL_SIZE);
      this.nodes.set(n.id, { ...n, cell: fieldCellId(cell.cx, cell.cy) });
    }
    const mobMeta = new Map(snap.mobs.map(([id, dead, respawnAt]) => [id, { dead, respawnAt }]));
    this.mobs = new Map();
    for (const m of world.mobs) {
      const meta = mobMeta.get(m.id) ?? { dead: false, respawnAt: 0 };
      this.mobs.set(m.id, { ...m, dead: meta.dead, respawnAt: meta.respawnAt });
    }
    this.items = new Map();
    for (const [id, itemType, owner, x, y, z] of snap.items) {
      this.items.set(id, { id, itemType, owner, x, y, z });
    }
  }

  // --- 원장 커밋 + tx 기록 (모든 에너지 변화는 이 함수를 지난다) ---
  #tx(from, to, want, cause, at = null, iid = null) {
    const amount = this.ledger.transfer(from, to, want, cause);
    if (amount > 0) {
      const tx = { op: 'tx', seq: ++this.txSeq, from, to, amount, cause };
      if (at) tx.at = { x: at.x, y: at.y };
      if (iid) tx.iid = iid;
      this.pendingOps.push(tx);
    }
    return amount;
  }

  // 사실 이벤트 — tx 와 같은 스트림에 인과 순서로 끼워 넣는다
  // (아이템 생성은 응축 tx 앞, 아이템 소멸은 용해 tx 뒤에 와야 미러가 성립)
  #event(data, { at = null, only = null } = {}) {
    this.pendingOps.push({ op: 'event', ...data, _at: at, _only: only });
  }

  // ==========================================================================
  // 접속 수명
  // ==========================================================================

  #structId(playerId) { return POOL.STRUCT + playerId; } // 플레이어당 구조 풀 (A6-2)

  addPlayer(conn, name = '모험가') {
    const id = `${POOL.PLAYER}${this.nextPlayerNo++}`;
    const player = {
      id, name: String(name).slice(0, 12) || '모험가', conn,
      x: SPAWN_POS.x, y: SPAWN_POS.y, z: SPAWN_POS.z,
      lastBeaconMs: this.now(), moveDebt: 0,
      cooldownUntil: 0, skillCd: {}, dead: false, respawnAt: 0, atkSeq: 0,
      regions: new Set(regionNeighbors(SPAWN_POS.x, SPAWN_POS.y)),
      visible: new Set(),
    };
    this.players.set(id, player);
    this.ledger.createPool(id, 0, PLAYER_MAX_ENERGY, null);
    this.ledger.createPool(this.#structId(id), 0, STRUCT_MAX, null); // A6-2 구조 풀 (성장 저장소)

    // 미러 기준점: 잔고 0 시점의 스냅샷을 먼저 보내고, 스폰 인출은 tx 로 도달시킨다.
    conn.send(encode(MSG.WELCOME, {
      playerId: id, name: player.name, seed: WORLD_SEED, tick: this.tickCount,
      total: this.ledger.totalSum(),
      src: this.ledger.balance(POOL.SOURCE), sink: this.ledger.balance(POOL.SINK),
      x: player.x, y: player.y, z: player.z,
    }));
    this.#tx(POOL.SOURCE, id, SPAWN_GRANT, CAUSE.SPAWN, SPAWN_POS);
    return player;
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    // 이탈 시 소지 에너지·아이템은 SINK 로 환원 — 보존 유지, 원장에서 소멸 없음
    for (const item of this.#ownedItems(id)) {
      this.#tx(item.id, POOL.SINK, this.ledger.balance(item.id), CAUSE.DEATH_DROP, p);
      this.ledger.removePool(item.id);
      this.items.delete(item.id);
    }
    this.#tx(id, POOL.SINK, this.ledger.balance(id), CAUSE.DEATH_DROP, p);
    this.ledger.removePool(id);
    // A6-2: 구조(잠긴 질서)도 이탈 시 SINK 로 환원 — 원장에서 소멸 없음(보존)
    const structId = this.#structId(id);
    this.#tx(structId, POOL.SINK, this.ledger.balance(structId), CAUSE.DEATH_DROP, p);
    this.ledger.removePool(structId);
    this.players.delete(id);
  }

  onMessage(playerId, msg) {
    const p = this.players.get(playerId);
    if (!p || !msg) return;
    switch (msg.t) {
      case MSG.BEACON: this.#onBeacon(p, msg); break;
      case MSG.INTENT: this.intents.push({ playerId, msg }); break;
      case MSG.RESYNC: this.#onResync(p, msg); break;
    }
  }

  // ==========================================================================
  // 비콘 — 좌표는 권위가 아니라 "개연성 증거". 검증은 두 가지뿐:
  //   속도 예산 (스피드핵), 이동 에너지 지출 (설계 §2.2 이동 = 이체)
  // ==========================================================================

  #onBeacon(p, msg) {
    if (p.dead) return;
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
    if (cost > 0) this.#tx(p.id, POOL.SINK, cost, CAUSE.MOVE, { x, y });
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
  // 인텐트 처리 — 클램프와 중재의 전부. FIFO 순서가 곧 동시성 판정.
  // ==========================================================================

  #reject(p, iid, reason) {
    p.conn.send(encode(MSG.REJECT, { iid, reason }));
  }

  // A2: 이 (공격자, seq) 판정을 감사할지 — 서버 비밀 시드 기반이라 클라가 예측할 수 없다.
  #shouldAudit(attackerId, seq) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < attackerId.length; i++) h = Math.imul(h ^ attackerId.charCodeAt(i), 16777619);
    const s = (h ^ Math.imul((seq + 1) >>> 0, 40503) ^ this.auditSeed) >>> 0;
    return mulberry32(s)() * AUDIT_SAMPLE_DEN < AUDIT_SAMPLE_NUM;
  }

  #ownedItems(playerId) {
    return [...this.items.values()].filter(i => i.owner === playerId);
  }

  #targetInfo(id) {
    if (id.startsWith(POOL.PLAYER)) {
      const t = this.players.get(id);
      return t && !t.dead ? { x: t.x, y: t.y, z: t.z, isPlayer: true } : null;
    }
    if (id.startsWith(POOL.MOB)) {
      const m = this.mobs.get(id);
      return m && !m.dead ? { x: m.x, y: m.y, z: m.z, isPlayer: false } : null;
    }
    return null;
  }

  #processIntent(playerId, msg) {
    const p = this.players.get(playerId);
    if (!p) return;
    const iid = msg.iid;
    if (p.dead) return this.#reject(p, iid, 'dead');

    switch (msg.kind) {
      case INTENT.GATHER: {
        const node = this.nodes.get(msg.nodeId);
        if (!node) return this.#reject(p, iid, 'no-target');
        if (dist3(p.x, p.y, p.z, node.x, node.y, node.z) > GATHER_RANGE + RANGE_SLACK)
          return this.#reject(p, iid, 'out-of-range');
        // A6-5: 결정 소지 시 채집 증폭(획득) = 결정 잔고의 함수(민팅 아님 — 노드가 제공, Got<Want 클램프).
        const crystal = this.#ownedItems(p.id).find(i => i.itemType === 'crystal');
        const want = GATHER_AMOUNT + (crystal ? gatherBonus(this.ledger.balance(crystal.id)) : 0);
        // Got < Want 는 게임플레이(고갈/가방 가득) — 0 일 때만 기각
        const got = this.#tx(node.id, p.id, want, CAUSE.GATHER, node, iid);
        if (got === 0) return this.#reject(p, iid, 'depleted-or-full');
        break;
      }

      case INTENT.ATTACK: {
        const nowMs = this.now();
        if (nowMs < p.cooldownUntil) return this.#reject(p, iid, 'cooldown');
        const target = this.#targetInfo(msg.targetId ?? '');
        if (!target || msg.targetId === p.id) return this.#reject(p, iid, 'no-target');
        if (dist3(p.x, p.y, p.z, target.x, target.y, target.z) > ATTACK_RANGE + RANGE_SLACK)
          return this.#reject(p, iid, 'out-of-range');
        if (this.ledger.balance(p.id) < ATTACK_COST) return this.#reject(p, iid, 'no-energy');

        // A2: 공격 시퀀스 — 클라가 제공하면 anti-replay(단조 증가) 검증, 없으면 서버 채번.
        const seq = Number.isInteger(msg.seq) ? msg.seq : p.atkSeq + 1;
        if (seq <= p.atkSeq) return this.#reject(p, iid, 'stale-seq');
        p.atkSeq = seq;
        const canonical = canonicalDamage(WORLD_SEED, p.id, seq);

        // 기본 데미지 판정: 클라가 dmg 를 선언하면 위임(응답성), 아니면 서버가 canonical 계산.
        // 위임 판정은 표본을 뽑아 재시뮬 — 불일치 = 조작, 정정 후 적발 집계.
        let base;
        if (Number.isInteger(msg.dmg)) {
          base = Math.max(0, msg.dmg);
          this.audit.delegated++;
          if (this.#shouldAudit(p.id, seq)) {
            this.audit.sampled++;
            if (base !== canonical) {
              this.audit.caught++;
              this.audit.cheaters.set(p.id, (this.audit.cheaters.get(p.id) ?? 0) + 1);
              base = canonical;                       // 판정 정정 — 조작분 무효
              this.#reject(p, iid, 'audit-fail');
            }
          }
        } else {
          base = canonical;                           // 위임 안 함 — 서버 권위 계산
        }

        this.#tx(p.id, POOL.SINK, ATTACK_COST, CAUSE.ATTACK_COST, p, iid);
        p.cooldownUntil = nowMs + ATTACK_COOLDOWN_MS;

        // 무기 = 응축 에너지. 내구도 소모도 그저 이체다.
        // A6-3: 구조 예치가 공격력을 키운다(흐름 계수) — 데미지는 여전히 피격자 풀로 클램프.
        const weapon = this.#ownedItems(p.id).find(i => i.itemType === 'weapon');
        let damage = base + attackBonus(this.ledger.balance(this.#structId(p.id)));
        if (weapon) {
          // A6-5: 무기 증폭 = 현재 잔고의 함수(민팅 아님). 마모 전 잔고로 계산한 뒤 마모.
          damage += weaponBonus(this.ledger.balance(weapon.id));
          this.#tx(weapon.id, POOL.SINK, WEAPON_WEAR, CAUSE.WEAPON_WEAR, p);
          if (this.ledger.balance(weapon.id) === 0) this.#destroyItem(weapon, p);
        }

        // 데미지 = 피격자 풀에서의 인출. 흡수분은 공격자에게, 잔여는 SINK 로.
        // 공격자가 가득 차도 총 데미지는 보장된다 (잔여 전액 burn).
        const total = Math.min(damage, this.ledger.balance(msg.targetId));
        const leechWant = Math.floor(total * LEECH_PERCENT / 100);
        const leechGot = this.#tx(msg.targetId, p.id, leechWant, CAUSE.DAMAGE_LEECH, target, iid);
        this.#tx(msg.targetId, POOL.SINK, total - leechGot, CAUSE.DAMAGE_BURN, target);

        if (this.ledger.balance(msg.targetId) === 0) this.#kill(msg.targetId, target);
        break;
      }

      case INTENT.CONDENSE:
      case INTENT.CRAFT: {
        const isWeapon = msg.kind === INTENT.CRAFT;
        const cost = isWeapon ? WEAPON_COST : CRYSTAL_COST;
        if (this.ledger.balance(p.id) < cost) return this.#reject(p, iid, 'no-energy');
        const item = {
          id: `${POOL.ITEM}${this.nextItemNo++}`,
          itemType: isWeapon ? 'weapon' : 'crystal',
          owner: p.id, x: 0, y: 0, z: 0,
        };
        this.items.set(item.id, item);
        this.ledger.createPool(item.id, 0, cost, null);
        this.#event({ kind: 'item-spawn', id: item.id, itemType: item.itemType }, { only: p.id });
        this.#tx(p.id, item.id, cost, CAUSE.CONDENSE, p, iid);
        break;
      }

      case INTENT.USE: {
        const item = this.items.get(msg.itemId ?? '');
        if (!item || item.owner !== p.id) return this.#reject(p, iid, 'no-item');
        // 용해 — 수용량 클램프로 남으면 잔여가 아이템에 남는다 (보존)
        const got = this.#tx(item.id, p.id, this.ledger.balance(item.id), CAUSE.DISSOLVE, p, iid);
        if (got === 0) return this.#reject(p, iid, 'full');
        if (this.ledger.balance(item.id) === 0) this.#destroyItem(item, p);
        break;
      }

      case INTENT.DROP: {
        const item = this.items.get(msg.itemId ?? '');
        if (!item || item.owner !== p.id) return this.#reject(p, iid, 'no-item');
        this.#dropToGround(item, p.x, p.y, p.z);
        break;
      }

      case INTENT.SKILL: {
        // A6-4 스킬 = 발산 패턴: 비용 있는 증폭 이체. 스킬마다 흡수/소각 형태가 다르다.
        const skill = SKILLS[msg.skillId];
        if (!skill) return this.#reject(p, iid, 'no-skill');
        const nowMs = this.now();
        if (nowMs < (p.skillCd[msg.skillId] ?? 0)) return this.#reject(p, iid, 'cooldown');
        const target = this.#targetInfo(msg.targetId ?? '');
        if (!target || msg.targetId === p.id) return this.#reject(p, iid, 'no-target');
        if (dist3(p.x, p.y, p.z, target.x, target.y, target.z) > ATTACK_RANGE + RANGE_SLACK)
          return this.#reject(p, iid, 'out-of-range');
        if (this.ledger.balance(p.id) < skill.cost) return this.#reject(p, iid, 'no-energy');

        // 시전 비용 = 대사 스파이크(player→SINK). 쿨다운은 스킬별.
        this.#tx(p.id, POOL.SINK, skill.cost, CAUSE.ATTACK_COST, p, iid);
        p.skillCd[msg.skillId] = nowMs + skill.cooldownMs;

        // 위력 = 구조의 함수(A6-3 동형). 데미지 = 피격자 풀 인출, leechPct 로 흡수/소각 분배.
        const struct = this.ledger.balance(this.#structId(p.id));
        const total = Math.min(skillDamage(skill, struct), this.ledger.balance(msg.targetId));
        const leechGot = this.#tx(msg.targetId, p.id, Math.floor(total * skill.leechPct / 100), CAUSE.DAMAGE_LEECH, target, iid);
        this.#tx(msg.targetId, POOL.SINK, total - leechGot, CAUSE.DAMAGE_BURN, target);
        if (this.ledger.balance(msg.targetId) === 0) this.#kill(msg.targetId, target);
        break;
      }

      case INTENT.GROW: {
        // A6-2 성장: 자유 에너지를 구조 풀로 예치 (창조 아님 — 자유→잠긴 질서 재분배).
        // Got<Want 는 게임플레이(자유 고갈/구조 포화) — 0 일 때만 기각. 스탯 이득은 A6-3.
        const want = Number.isInteger(msg.amount) && msg.amount > 0 ? msg.amount : GROW_AMOUNT;
        const got = this.#tx(p.id, this.#structId(p.id), want, CAUSE.GROW, null, iid);
        if (got === 0) return this.#reject(p, iid, 'no-energy-or-full');
        break;
      }

      case INTENT.PICKUP: {
        const item = this.items.get(msg.itemId ?? '');
        // 소유권 선점 = 순서 중재 그 자체. 먼저 처리된 인텐트가 이긴다.
        if (!item || item.owner !== null) return this.#reject(p, iid, 'gone');
        if (dist3(p.x, p.y, p.z, item.x, item.y, item.z) > PICKUP_RANGE + RANGE_SLACK)
          return this.#reject(p, iid, 'out-of-range');
        item.owner = p.id;
        this.ledger.setRegion(item.id, null);
        this.#event({
          kind: 'pickup', id: item.id, itemType: item.itemType,
          balance: this.ledger.balance(item.id), max: this.ledger.get(item.id).max,
        }, { only: p.id });
        break;
      }

      default: this.#reject(p, iid, 'unknown');
    }
  }

  #destroyItem(item, at) {
    this.ledger.removePool(item.id); // 잔고 0 보장 하에서만 소멸 가능
    this.items.delete(item.id);
    if (item.owner) this.#event({ kind: 'item-gone', id: item.id }, { only: item.owner });
  }

  #dropToGround(item, x, y, z) {
    item.owner = null;
    item.x = x; item.y = y; item.z = z;
    this.ledger.setRegion(item.id, regionKey(x, y)); // 파티션은 컬럼(x,y)
    // 시야 진입(ENTER)이 각 클라에 전달 — 별도 이벤트 불필요
  }

  #kill(targetId, pos) {
    if (targetId.startsWith(POOL.MOB)) {
      const m = this.mobs.get(targetId);
      m.dead = true;
      m.respawnAt = this.now() + MOB_RESPAWN_MS;
      this.#event({ kind: 'death', id: targetId }, { at: pos });
      return;
    }
    const t = this.players.get(targetId);
    t.dead = true;
    t.respawnAt = this.now() + RESPAWN_DELAY_MS;
    for (const item of this.#ownedItems(targetId)) this.#dropToGround(item, t.x, t.y, t.z); // 전리품
    this.#event({ kind: 'death', id: targetId }, { at: pos });
  }

  // ==========================================================================
  // 틱 — 서버가 깨어나는 유일한 주기. 원장 연산만 있고 시뮬레이션은 없다.
  // ==========================================================================

  tick() {
    const nowMs = this.now();

    // 1) 리스폰 — SOURCE 인출 tx (비보존 게임플레이의 감사 추적)
    for (const m of this.mobs.values()) {
      if (m.dead && nowMs >= m.respawnAt) {
        m.dead = false;
        this.#tx(POOL.SOURCE, m.id, m.max, CAUSE.SPAWN, m);
        this.#event({ kind: 'respawn', id: m.id }, { at: m });
      }
    }
    for (const p of this.players.values()) {
      if (p.dead && nowMs >= p.respawnAt) {
        p.dead = false;
        p.x = SPAWN_POS.x; p.y = SPAWN_POS.y; p.z = SPAWN_POS.z; p.moveDebt = 0;
        p.lastBeaconMs = nowMs;
        p.regions = new Set(regionNeighbors(p.x, p.y));
        this.#tx(POOL.SOURCE, p.id, SPAWN_GRANT, CAUSE.SPAWN, SPAWN_POS);
        this.#event({ kind: 'respawn', id: p.id, x: p.x, y: p.y, z: p.z }, { at: SPAWN_POS });
        p.conn.send(encode(MSG.TELEPORT, { x: p.x, y: p.y, z: p.z }));
      }
    }

    // 2) 인텐트 FIFO — 도착 순서가 곧 판정 순서 (동시 채집·선점의 승자 결정)
    const batch = this.intents;
    this.intents = [];
    for (const { playerId, msg } of batch) this.#processIntent(playerId, msg);

    // 2b) 대사 (A6-1) — 생명은 매 주기 upkeep 를 SINK 로 지불한다. 소모·갈구·유지의 압력:
    //   upkeep tx 는 비공간이라 소유자에게만 방송(무지역 player 풀 — 체크섬 무관).
    //   소산분은 태양 순환(A6-0)이 되돌린다.
    //   A6-6 항상성(구조 이화): 자유 에너지로 대사를 못 덮으면 곧바로 죽지 않는다 — 몸(구조)을
    //   태워(구조→플레이어) 자유로 전환해 연명한다. 성장이 비상 연료가 되는 가역적 성장:
    //   굶주릴수록 구조가 줄고, 구조가 줄면 스탯도 준다(attackBonus·upkeep = f(구조)).
    //   자유·구조가 함께 마르면 그때가 진짜 아사(태울 몸조차 없음). 이화도 이체 — 보존 유지.
    if (this.tickCount % UPKEEP_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      for (const p of this.players.values()) {
        if (p.dead) continue;
        const structId = this.#structId(p.id);
        // A6-3: 대사 비용 = 구조의 함수 (큰 질서일수록 더 갈구)
        const upkeep = upkeepFor(this.ledger.balance(structId));
        const deficit = upkeep - this.ledger.balance(p.id);
        if (deficit > 0) this.#tx(structId, p.id, deficit, CAUSE.CATABOLISM); // 이화: 구조→자유
        this.#tx(p.id, POOL.SINK, upkeep, CAUSE.UPKEEP);
        if (this.ledger.balance(p.id) === 0 && this.ledger.balance(structId) === 0)
          this.#kill(p.id, { x: p.x, y: p.y, z: p.z });
      }
    }

    // 3) 필드 확산 — 매 틱 이웃 셀 간 zero-sum 정수 이체 (서버 내부: region=null,
    //    ledger.transfer 직결이라 방송·pendingOps 에 남지 않는다). A1: 노드 재충전이
    //    세계→노드 주입이 아니라 이 필드를 통해 흐른다.
    diffuseTick(this.ledger);

    // 3b) 태양 순환 (A6-0) — 소산 에너지(SINK)를 주기적으로 SOURCE 로 되돌려 열역학 루프를 닫는다.
    //   서버는 유일한 에너지 원점(태양)이되 생성기가 아니라 순환의 원점: SOURCE→생명→SINK→SOURCE.
    //   닫힌 루프라 총합은 여전히 WORLD_SOURCE_INITIAL 불변. 이 순환이 없으면 이동·전투·(향후)대사가
    //   세계를 SINK 로 말려 영속이 깨진다. region=null 저수지 간 이체 → 방송·체크섬 무관(무음 transfer).
    //   재충전(아래)보다 먼저 실행해 SOURCE 를 채운 뒤 세계로 흘려보낸다.
    if (this.tickCount % RECYCLE_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      const dissipated = this.ledger.balance(POOL.SINK);
      if (dissipated > 0) this.ledger.transfer(POOL.SINK, POOL.SOURCE, dissipated, CAUSE.RECYCLE);
    }

    // 재충전 주기: SOURCE→셀 보충(씨앗값까지 top-up, 필드 지속) + 셀→노드 인출(고갈→회복).
    // 둘 다 보존. 셀→노드 만 #tx 로 방송 — 클라 미러는 셀을 저수지로 물질화해 재생한다.
    if (this.tickCount % REGEN_INTERVAL_TICKS === 0 && this.tickCount > 0) {
      for (let cy = 0; cy < FIELD_GRID; cy++) {
        for (let cx = 0; cx < FIELD_GRID; cx++) {
          const id = fieldCellId(cx, cy);
          const deficit = FIELD_CELL_SEED - this.ledger.balance(id);
          if (deficit > 0)
            this.ledger.transfer(POOL.SOURCE, id, Math.min(FIELD_INJECT_AMOUNT, deficit), CAUSE.REGEN);
        }
      }
      for (const n of this.nodes.values()) {
        if (this.ledger.balance(n.id) < n.max) {
          this.#tx(n.cell, n.id, NODE_REGEN_AMOUNT, CAUSE.REGEN, n);
        }
      }
    }

    // 4) 방송 — relevancy 필터 + 시야 diff + 주기 체크섬
    this.#flush();

    this.pendingOps = [];
    this.pendingMoves.clear();
    this.tickCount++;
  }

  // --- 시야에 들어와야 하는 엔티티 집합 (지역 구독 기준) ---
  #visibleFor(p) {
    const vis = new Map(); // id -> enter payload
    for (const q of this.players.values()) {
      if (q.id === p.id || q.dead) continue;
      if (p.regions.has(regionKey(q.x, q.y))) {
        vis.set(q.id, {
          id: q.id, kind: 'player', name: q.name, x: q.x, y: q.y, z: q.z,
          balance: this.ledger.balance(q.id), max: PLAYER_MAX_ENERGY,
        });
      }
    }
    for (const n of this.nodes.values()) {
      if (p.regions.has(regionKey(n.x, n.y)))
        vis.set(n.id, { id: n.id, kind: 'node', balance: this.ledger.balance(n.id) });
    }
    for (const m of this.mobs.values()) {
      if (!m.dead && p.regions.has(regionKey(m.x, m.y)))
        vis.set(m.id, { id: m.id, kind: 'mob', balance: this.ledger.balance(m.id) });
    }
    for (const i of this.items.values()) {
      if (i.owner === null && p.regions.has(regionKey(i.x, i.y))) {
        vis.set(i.id, {
          id: i.id, kind: 'item', itemType: i.itemType, x: i.x, y: i.y, z: i.z,
          balance: this.ledger.balance(i.id), max: this.ledger.get(i.id).max,
        });
      }
    }
    return vis;
  }

  #txRelevant(tx, p) {
    if (tx.from === p.id || tx.to === p.id) return true; // 내 풀은 어디서든 내 일
    const fromItem = this.items.get(tx.from), toItem = this.items.get(tx.to);
    if (fromItem?.owner === p.id || toItem?.owner === p.id) return true;
    return tx.at ? p.regions.has(regionKey(tx.at.x, tx.at.y)) : false;
  }

  #opRelevant(op, p) {
    if (op.op === 'event') {
      if (op._only) return op._only === p.id;
      return op._at ? p.regions.has(regionKey(op._at.x, op._at.y)) : true;
    }
    return this.#txRelevant(op, p);
  }

  // 플러시 순서 규약 (protocol.js 참조): LEAVE → OPS → ENTER → POS → CHECKSUM
  // OPS 가 ENTER 앞이어야 "이번 틱 tx + 틱 종료 잔고 ENTER" 의 이중 적용이 없다.
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
        .filter(op => this.#opRelevant(op, p))
        .map(({ _at, _only, ...op }) => op);
      // A4: tx-only(숫자/무 iid) 프레임은 16B 바이너리, 이벤트/문자열 iid 는 JSON 폴백
      if (ops.length)
        p.conn.send(this.binaryOps ? encodeOps(this.tickCount, ops) : encode(MSG.OPS, { tick: this.tickCount, ops }));

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
