// ============================================================================
// ViewModel — 세계 속성 → Scene (렌더 무관 데이터). 불변 원칙 ③.
//
// 세계(미러 원장 + 스냅샷 + 로컬 sim)를 읽어, 매 프레임 **순수 데이터** Scene 을 만든다.
// Scene 은 월드 좌표 + 정규화된 의미 속성 + 타입 있는 이펙트 서술자만 담는다 —
// 캔버스 색·모양·아이콘·라벨(표현)은 담지 않는다(그건 렌더러 몫).
//
// 렌더러는 이 Scene 만 소비하고 세계 규칙을 재유도하지 않는다. 표적·acting·활력 등
// "표시용 세계 규칙 해석"은 전부 여기 소속이다(구 render.js #desireTargetPos·#desireActing 이관).
//
// 에너지 흐름 이펙트(발산·폭발·연소·열의 흐름)는 권위 tx({from,to,amount,cause})에서
// 파생한 타입 있는 서술자로 노출한다 — 지금은 대충 그려도, 이후 같은 서술자로 풍성하게.
// ============================================================================

import {
  CREATURE_MAX_ENERGY, CREATURE_DEATH_THRESHOLD, CREATURE_SEEK_RADIUS,
  CREATURE_HARVEST_RADIUS, CREATURE_ATTACK_RADIUS, CRAFT_REACH,
  PLAYER_MAX_ENERGY, POOL, dist3, fieldPhase,
} from '../shared/constants.js';

// 이펙트 세기 정규화 기준(px 무관, 튜닝용) — magnitude = clamp01(amount/이 값). 표현용일 뿐, 결정론 무관.
const EFFECT_MAG_REF = 1000;

// cause → 이펙트 타입. 에너지 흐름의 물리 사건을 분류한다(발산·폭발·물질 상태전이·열의 흐름·포식 흐름).
//   여기 없는 cause 는 이펙트로 만들지 않는다(spawn·move 등 위치 이펙트가 무의미한 것).
const EFFECT_TYPE = {
  emit: 'emission',       // 발산 — 생명체가 파이어볼을 낳는다 (feature-0009)
  detonate: 'explosion',  // 폭발 — 투사체·물질이 다채널로 터진다 (feature-0013 규칙 D)
  combust: 'combustion',  // 연소 (feature-0013 규칙 A)
  melt: 'melt',           // 용해 (규칙 B)
  shatter: 'shatter',     // 파괴 (규칙 C)
  heat: 'flow',           // 열의 흐름(자극 — 열원→결정)
  react: 'flow',          // 결정 반응(반응열)
  harvest: 'transfer',    // 채집 흐름
  attack: 'transfer',     // 강탈 흐름
  forage: 'transfer',     // 갈구 흐름
};
// 이펙트 앵커(위치)를 어느 끝에서 잡을지 — 발산은 산물(파이어볼) 자리, 그 외는 사건의 근원(from) 자리.
const EFFECT_ANCHOR_TO = new Set(['emit']);

// pool id → 종류(kind). 접두로 참여자 종류를 가른다(라벨·이펙트 해석 공용).
function poolKind(state, id) {
  if (id === state.playerId) return 'self';
  if (id === POOL.SOURCE) return 'source';
  if (id === POOL.SINK) return 'sink';
  if (id.startsWith(POOL.MATERIAL)) return 'material';
  if (id.startsWith(POOL.CRYSTAL)) return 'crystal';
  if (id.startsWith(POOL.HEAT)) return 'heat';        // H:<seq> 는 그 결정의 열 — 위치는 결정 자리, 라벨은 원 id
  if (id.startsWith(POOL.CREATURE)) return 'creature';
  if (id.startsWith(POOL.FIREBALL)) return 'fireball';
  if (id.startsWith(POOL.PLAYER)) return 'player';
  return 'other';
}

// pool id 에서 seq(개체 번호)를 뽑는다 — "접두:seq" 또는 "접두:seq_..." 형태. 숫자로.
function poolSeq(id) {
  const i = id.indexOf(':');
  if (i < 0) return null;
  const rest = id.slice(i + 1);
  const n = parseInt(rest, 10);
  return Number.isNaN(n) ? null : n;
}

export class ViewModel {
  constructor(state, sim, net) {
    this.state = state;
    this.sim = sim;
    this.net = net;
    // pool id → 마지막 알려진 위치. 스냅샷에서 빠진 개체(착탄한 파이어볼 등)의 이펙트 위치를 해석한다.
    this.lastPos = new Map();
  }

  // 내가 제어하는 생명체(소유·생존) — 카메라·HUD·강조가 공유. 없으면 null.
  #myCreature() {
    const { state } = this;
    if (!state.playerId) return null;
    for (const c of state.creatures.values())
      if (c.owner && c.owner === state.playerId && c.balance > 0) return c;
    return null;
  }

  // 욕망 표적 위치 유도(표시 전용) — 구 render.js #desireTargetPos 이관. 지정 표적(클릭)이 있으면 그것을
  //   우선, 아니면 감지 반경 안 가장 가까운 대상(채집=먹을 결정·식사=아무 결정·제조=재료·사냥=더 작은 생명체).
  #desireTargetPos(cre) {
    const { state } = this;
    if (cre.cmd) {
      const [kindCode, seq] = cre.cmd;
      const t = kindCode === 2 ? state.creatures.get(seq) : state.crystals.get(seq);
      if (t && t.balance > 0) return { x: t.x, y: t.y, z: t.z };
    }
    let best = null, bestD = CREATURE_SEEK_RADIUS;
    if (cre.desire === 'forage' || cre.desire === 'eat' || cre.desire === 'craft') {
      for (const c of state.crystals.values()) {
        if (c.balance <= 0 || (cre.desire === 'forage' && c.raw) || (cre.desire === 'craft' && (!c.raw || c.crafted))) continue;
        const d = dist3(cre.x, cre.y, cre.z, c.x, c.y, c.z);
        if (d <= bestD) { best = c; bestD = d; }
      }
    } else if (cre.desire === 'hunt') {
      for (const v of state.creatures.values()) {
        if (v === cre || (v.size ?? 1) >= (cre.size ?? 1) || v.balance <= 0) continue;
        const d = dist3(cre.x, cre.y, cre.z, v.x, v.y, v.z);
        if (d <= bestD) { best = v; bestD = d; }
      }
    }
    return best ? { x: best.x, y: best.y, z: best.z } : null;
  }

  // 지금 행동 중인가 — 표적이 그 욕구의 사거리 안이면 true(접근 끝·수행 단계). 구 #desireActing 이관.
  #desireActing(cre, targetPos) {
    if (cre.desire === 'none' || !targetPos) return false;
    const reach = cre.desire === 'hunt' ? CREATURE_ATTACK_RADIUS : cre.desire === 'craft' ? CRAFT_REACH : CREATURE_HARVEST_RADIUS;
    return dist3(cre.x, cre.y, cre.z, targetPos.x, targetPos.y, targetPos.z) <= reach;
  }

  // 한 생명체 → ViewCreature(정규화된 의미 속성). hue·오라 색 같은 표현은 렌더러가 이 값으로 만든다.
  #creatureView(c) {
    const { state } = this;
    const size = c.size ?? 1;
    const cap = CREATURE_MAX_ENERGY * size;
    const vitality = Math.max(0, Math.min(1, c.balance / cap));
    const starveBand = CREATURE_DEATH_THRESHOLD * size * 3;
    const starving = c.balance < starveBand;
    const desire = c.desire ?? 'none';
    const targetPos = (desire === 'forage' || desire === 'hunt' || desire === 'eat' || desire === 'craft')
      ? this.#desireTargetPos(c) : null;
    return {
      id: c.seq,
      pos: { x: c.x, y: c.y, z: c.z },
      energy: c.balance,
      capacity: cap,
      vitality,
      size,
      starving,
      starveT: Math.max(0, Math.min(1, c.balance / starveBand)), // 굶주림 경고 밴드 내 위치(0..1, starving 일 때만 의미)
      faction: (c.owner && c.owner === state.playerId) ? 'mine' : 'other',
      motive: {
        name: desire,
        acting: this.#desireActing(c, targetPos),
        stack: (c.desires && c.desires.length) ? c.desires : (desire !== 'none' ? [[desire, 1, 0]] : []),
      },
      target: targetPos ? { pos: targetPos } : null,
    };
  }

  // 이번 프레임 이펙트 tx 를 드레인해 타입 있는 서술자로 파생. 공간은 pool→pos(스냅샷+lastPos 캐시)로 해석.
  #buildEffects() {
    const txs = this.state.drainEffectTx ? this.state.drainEffectTx() : [];
    const effects = [];
    for (const tx of txs) {
      const type = EFFECT_TYPE[tx.cause];
      if (!type) continue;
      const fromPos = this.#resolvePos(tx.from);
      const toPos = this.#resolvePos(tx.to);
      const anchor = EFFECT_ANCHOR_TO.has(tx.cause) ? (toPos ?? fromPos) : (fromPos ?? toPos);
      if (!anchor) continue; // 위치를 못 잡으면 공간 이펙트로 못 그린다(스킵)
      effects.push({
        type,
        cause: tx.cause,
        pos: anchor,
        from: fromPos ?? null,
        to: toPos ?? null,
        amount: tx.amount,
        magnitude: Math.max(0, Math.min(1, tx.amount / EFFECT_MAG_REF)),
      });
    }
    return effects;
  }

  // pool id → 위치. 현재 스냅샷에 있으면 그 좌표, 없으면 마지막 알려진 위치(lastPos). 국소장·태양·심우주는 위치 없음.
  #resolvePos(id) {
    if (!id) return null;
    const { state } = this;
    const kind = poolKind(state, id);
    const seq = poolSeq(id);
    let ent = null;
    if (kind === 'creature') ent = state.creatures.get(seq);
    else if (kind === 'crystal' || kind === 'heat') ent = state.crystals.get(seq);
    else if (kind === 'fireball') ent = state.fireballs.get(seq);
    if (ent) return { x: ent.x, y: ent.y, z: ent.z };
    return this.lastPos.get(id) ?? null; // 스냅샷에서 빠진(착탄·소멸) 개체는 마지막 위치로
  }

  // 스냅샷 개체들의 현 위치를 lastPos 에 갱신 — 다음 프레임 이펙트가 "직전 위치"를 잡게 한다.
  #cachePositions() {
    const { state } = this;
    for (const [seq, c] of state.creatures) { this.lastPos.set(`${POOL.CREATURE}${seq}`, { x: c.x, y: c.y, z: c.z }); }
    for (const [seq, c] of state.crystals) {
      const p = { x: c.x, y: c.y, z: c.z };
      this.lastPos.set(`${POOL.CRYSTAL}${seq}`, p);
      this.lastPos.set(`${POOL.HEAT}${seq}`, p); // 결정 열은 그 결정 자리
    }
    for (const [seq, f] of state.fireballs) { this.lastPos.set(`${POOL.FIREBALL}${seq}`, { x: f.x, y: f.y, z: f.z }); }
    // 캐시 무한 성장 방지 — 살아있는 개체 수 대비 크게 넘으면 오래된 것부터 버린다(대략).
    if (this.lastPos.size > 4096) {
      const keep = state.creatures.size + state.crystals.size * 2 + state.fireballs.size + 64;
      let drop = this.lastPos.size - keep;
      for (const k of this.lastPos.keys()) { if (drop-- <= 0) break; this.lastPos.delete(k); }
    }
  }

  // 매 프레임 Scene 을 만든다(순수 데이터). t = 애니메이션 위상(초).
  build(t = 0) {
    const { state, sim, net } = this;
    state.pruneFireballs?.(); // 착탄 후 방송 끊긴 파이어볼 정리(표시 정합)

    // --- 지속 개체 ---
    const creatures = [];
    for (const c of state.creatures.values()) if (c.balance > 0) creatures.push(this.#creatureView(c));

    let crystalMax = 1;
    for (const c of state.crystals.values()) if (c.balance > crystalMax) crystalMax = c.balance;
    const crystals = [];
    for (const [seq, c] of state.crystals) {
      if (c.balance <= 0) continue;
      crystals.push({
        id: seq,
        pos: { x: c.x, y: c.y, z: c.z },
        energy: c.balance,
        magnitude: c.balance / crystalMax,
        species: c.species,
        raw: c.raw, crafted: c.crafted, tier: c.tier ?? 0,
        burning: c.burning, heat: c.hot ?? 0,
      });
    }

    let fieldMax = 1;
    for (const v of state.field.values()) if (v > fieldMax) fieldMax = v;
    const field = [];
    for (const [key, bal] of state.field) {
      const magnitude = bal / fieldMax;
      if (magnitude < 0.05) continue; // 거의 빈 복셀 생략(현행 #fieldVolume 과 동일)
      const [cx, cy, cz] = key.split('_').map(Number);
      field.push({ cell: { cx, cy, cz }, magnitude, phase: fieldPhase(bal) });
    }

    const fireballs = [];
    for (const [seq, f] of state.fireballs) {
      fireballs.push({ id: seq, pos: { x: f.x, y: f.y, z: f.z }, energy: f.balance, size: f.size || 1 });
    }

    const players = [];
    for (const e of state.entities.values()) {
      players.push({
        id: e.id, pos: { x: e.x, y: e.y, z: e.z }, name: e.name ?? '',
        energy: state.ledger.balance(e.id), capacity: e.max ?? PLAYER_MAX_ENERGY, isSelf: false,
      });
    }

    // --- 이펙트(에너지 흐름) 파생 후 위치 캐시 갱신 ---
    const effects = this.#buildEffects();
    this.#cachePositions();

    // --- 자아(로컬 sim) + 내 생명체 뷰 ---
    const mineRaw = this.#myCreature();
    const mineView = mineRaw ? creatures.find(v => v.id === mineRaw.seq) ?? this.#creatureView(mineRaw) : null;
    const self = {
      id: state.playerId,
      pos: { x: sim.x, y: sim.y, z: sim.z },
      altitude: Math.round(sim.z),
      name: state.myName,
      energy: state.ledger.balance(state.playerId),
      capacity: PLAYER_MAX_ENERGY,
      hasCreature: !!mineRaw,
      creature: mineView,
      desire: mineRaw?.desire ?? state.myDesire ?? 'none',
    };

    // --- tx 텍스트 로그(표현은 렌더러) — 종류·방향만 데이터로 준다 ---
    const txFeed = state.txFeed.map(tx => ({
      cause: tx.cause, amount: tx.amount,
      from: { kind: poolKind(state, tx.from), id: tx.from, name: state.entities.get(tx.from)?.name },
      to: { kind: poolKind(state, tx.to), id: tx.to, name: state.entities.get(tx.to)?.name },
      dir: tx.to === state.playerId ? 'in' : tx.from === state.playerId ? 'out' : 'other',
    }));

    return {
      t,
      self, players, creatures, crystals, field, fireballs, effects,
      world: {
        total: state.worldTotal, src: state.worldSrc, sink: state.worldSink,
        material: state.worldMaterial, crystal: state.worldCrystal, creature: state.worldCreature,
        checksum: state.checksumStatus, bytesPerSec: net?.bytesPerSec ?? 0,
      },
      txFeed,
    };
  }
}
