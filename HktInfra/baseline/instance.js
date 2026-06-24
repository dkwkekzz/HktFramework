'use strict';
// step-0216 — 인스턴스 플레이어 라우팅(instanceRoute): player→instance 배정 SSOT(한 player 는 정확히 한 인스턴스·권위 단일 소유 척추③). 죽은 인스턴스로는 라우팅 거부(no-op). 다른 인스턴스로 옮기면 release+acquire 쌍(원자 재배정). instanceRoute 미수신이면 0215 비트 동일(reg 0). 2차 고도화(인스턴스 #2).
// step-0215 — 인스턴스 수요 spawn(instanceDemand): active(kind) < target 면 부족분만큼 자동 spawn(탄력 확장·수요 따라 던전 인스턴스를 채운다). 결정론 auto-id(kind-auto-N). 이미 target 도달이면 멱등 no-op. instanceDemand 미수신이면 0214 비트 동일(reg 0). 2차 고도화(인스턴스 #1).
// step-0202 — 인스턴스(던전) 서버: despawn 추가(instanceDespawn). spawn/despawn 수명주기 SSOT 완성(0201 spawn 의 짝). instanceService OFF 면 박스 0 = 0200 비트 동일(reg 0).
// dual-mode: Node require / 브라우저는 common.js 선행 로드(전역 __HktNetCommon).
const __c = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('./common.js') : globalThis.__HktNetCommon;
const { Net, LoginServer, SessionRegistry, mulberry32, fnv1a, DEFAULTS } = __c;

// ── [월드] InstanceServer — 던전/매치 *일회성* 시뮬 인스턴스의 spawn/despawn SSOT(SPINE 계층2 인스턴스). 존(오픈월드·영속)과 *수명주기 분리* — 수요 따라 떴다 사라진다. 존 tick 박자와 무관·*순수 반응형*(onTick 없음·권위=활성 인스턴스 집합). ──
//   왜 분리(SPINE §2 판정): 던전/매치는 존의 영속 tick 과 다른 수명(일회성·탄력적 spawn/despawn) → 존 밖 별 서버. 1차 너비는 *기본 통신*만: spawn 으로 인스턴스 1개를 띄우고 그게 SSOT 에 잡히는 것까지(despawn·라우팅은 후속 0202).
//   권위 단일 소유(척추 ③): "지금 어떤 던전 인스턴스가 살아있나"의 유일 SSOT = active 맵. spawn 멱등(같은 id 재-spawn = no-op).
class InstanceServer {
  constructor(opts = {}) {
    this.active = new Map();     // instanceId -> { kind } (활성 인스턴스 SSOT — 일회성·수요 탄력·권위 단일 소유).
    this.spawns = 0;             // 처리한 instanceSpawn 수(계측·no-op 멱등 포함).
    this.despawns = 0;           // 처리한 instanceDespawn 수(step-0202·계측·no-op 멱등 포함).
    this.retired = 0;            // 실제 종료된 인스턴스 누적 수(step-0202·despawn 으로 active 에서 제거된 것·일회성 수명 증거).
    this.demandSeq = 0;          // 수요 자동 spawn id 시퀀스(step-0215·단조·결정론 auto-id).
    this.demands = 0;            // 처리한 instanceDemand 수(step-0215·계측·no-op 멱등 포함).
    this.demandSpawns = 0;       // 수요로 자동 spawn 된 인스턴스 누적 수(step-0215·부족분 채움 증거).
    this.routes = new Map();     // player -> instanceId (배정 SSOT·step-0216·한 player 정확히 한 인스턴스).
    this.routed = 0;             // 신규 배정 누적 수(step-0216·계측).
    this.rerouted = 0;           // 재배정(다른 인스턴스로 이동) 누적 수(step-0216·release+acquire 쌍).
    this.routeRejects = 0;       // 죽은 인스턴스로의 라우팅 거부 누적 수(step-0216).
    this.net = null; this.addr = null;   // net.register 가 주입(send 경로).
  }
  // 플레이어 라우팅(step-0216·instanceRoute) — player 를 active 인스턴스에 배정(한 player=한 인스턴스·권위 단일 소유). 죽은 인스턴스면 거부(no-op). 같은 인스턴스 재배정은 멱등. 다른 인스턴스면 release(기존)+acquire(신규) 쌍 = 원자 재배정.
  _route(player, instanceId) {
    if (!this.active.has(instanceId)) { this.routeRejects++; return false; }   // 죽은 인스턴스 거부.
    const cur = this.routes.get(player);
    if (cur === instanceId) return true;                  // 멱등 no-op(같은 배정).
    if (cur !== undefined) this.rerouted++; else this.routed++;
    this.routes.set(player, instanceId);                  // release(cur)+acquire(new) — Map 단일 키라 원자 교체.
    return true;
  }
  // 종류별 활성 수(step-0215) — 수요 판정 기준("이 kind 던전이 지금 몇 개 도나").
  _countKind(kind) { let n = 0; for (const v of this.active.values()) if (v.kind === kind) n++; return n; }
  // 수요 spawn(step-0215·instanceDemand) — active(kind) 가 target 에 못 미치면 부족분만큼 자동 spawn(탄력 확장). 결정론 auto-id(kind-auto-N). 이미 충족이면 0개(멱등). 오케스트레이터가 부하/대기 수요로 발신.
  _demand(kind, target) {
    let made = 0;
    while (this._countKind(kind) < target) { this._spawn(kind + '-auto-' + (++this.demandSeq), kind); made++; }
    this.demandSpawns += made; return made;
  }
  // 인스턴스 spawn(step-0201·기본) — 던전/매치 인스턴스 1개를 띄운다(active 에 등록). 같은 id 재요청은 멱등 no-op(권위 단일 소유 보존). 오케스트레이터/게이트웨이가 수요 시 발신.
  _spawn(instanceId, kind) {
    if (this.active.has(instanceId)) return false;   // 이미 살아있음 → 멱등 no-op(중복 spawn 0).
    this.active.set(instanceId, { kind: kind || 'dungeon' });
    return true;
  }
  // 인스턴스 despawn(step-0202·기본) — 던전/매치 종료 시 인스턴스를 내린다(active 에서 제거·일회성 수명 완성). 없는 id 는 멱등 graceful no-op. 존(영속)과 달리 인스턴스는 떴다 사라진다(수요 탄력).
  _despawn(instanceId) {
    if (!this.active.has(instanceId)) return false;   // 이미 없음 → 멱등 no-op.
    this.active.delete(instanceId); this.retired++;
    return true;
  }
  onMsg(m) {
    const p = m.payload;
    // spawn 요청(instanceSpawn) — {instanceId, kind?} → 인스턴스 띄움. 미래엔 오케스트레이터가 부하/수요로 발신(0203~). 지금은 기본 통신만.
    if (p.type === 'instanceSpawn') { this._spawn(p.instanceId, p.kind); this.spawns++; return; }
    // despawn 요청(instanceDespawn·step-0202) — {instanceId} → 인스턴스 내림(active 제거). 던전 종료/매치 끝의 spawn 짝. 수명주기 SSOT 완성.
    if (p.type === 'instanceDespawn') { this._despawn(p.instanceId); this.despawns++; return; }
    // 수요 spawn 요청(step-0215·instanceDemand) — {kind, target} → active(kind)<target 면 부족분 자동 spawn(탄력 확장). 이미 충족이면 멱등 0개. instanceDemand 미수신이면 미발화 = 0214 비트 동일.
    if (p.type === 'instanceDemand') { this._demand(p.kind || 'dungeon', p.target | 0); this.demands++; return; }
    // 라우팅 요청(step-0216·instanceRoute) — {player, instanceId} → player 를 active 인스턴스에 배정(한 player=한 인스턴스). 죽은 인스턴스 거부. instanceRoute 미수신이면 미발화 = 0215 비트 동일.
    if (p.type === 'instanceRoute') { this._route(p.player, p.instanceId); return; }
  }
  // 질의 인터페이스 — "지금 몇 개 살아있나 / 이 인스턴스가 사나"(SSOT 읽기). 게이트웨이 라우팅(0202)·검증이 쓴다.
  activeCount() { return this.active.size; }
  isActive(instanceId) { return this.active.has(instanceId); }
  // 라우팅 질의(step-0216) — player 가 어느 인스턴스에 / 한 인스턴스에 몇 명(occupancy). 게이트웨이가 player 입장 라우팅에 쓴다.
  instanceOf(player) { return this.routes.get(player) || null; }
  occupancyOf(instanceId) { let n = 0; for (const v of this.routes.values()) if (v === instanceId) n++; return n; }
  routedCount() { return this.routes.size; }
}

const __part = { InstanceServer };
if (typeof module !== 'undefined' && module.exports) module.exports = __part;
if (typeof globalThis !== 'undefined') (globalThis.__HktNetParts = globalThis.__HktNetParts || {}).instance = __part;
