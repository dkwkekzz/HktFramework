// HktInfra step-0005 — 클라 예측 뷰 + 사후 조정 (GGPO 일반화)
// step-0004(현실 전송 + 논리-tick 입력 스케줄링)를 잇고 *한 조각*만 더한다:
//   step-0004 는 전송 열화를 *복제 팬아웃*(게이트웨이→존)에만 입혔다 — 뷰 경로·클라는 행복 유지.
//   이제 그 동결된 분리(타이밍↔내용) 위에서, **뷰 경로(존→클라)에 지연**을 더하고 —
//   클라가 ⒜ *잠정 예측*(공유 결정론 코어로 현재 권위 상태를 로컬 재현 → 뷰 RTT 를 은닉)으로 응답성을 유지하고
//          ⒝ 권위 뷰 도착 시 *사후 조정*(확정 레이어가 권위와 비트 일치 검증 → desync 0 수렴)함을 증명한다.
//
// 핵심 메커니즘 — 클라 측 예측/조정 (이 step 의 진짜 산출물, 0004 권위-측 정렬의 *클라 거울*):
//   클라는 **공유 결정론 코어**(같은 makeSim·같은 seed — 롤백 netcode 의 전제: 조인 시 결정론 시드 공유)로
//   자기 입력 스케줄을 *스스로 관찰*해 재구성한다(at 도장은 happy 업스트림 1-홉에서 도출):
//     enterAt = (connect_ok 수신 tick) - 1     ·  intent_i at = (sendTick_i) + 1   ·  leaveAt = (disconnect tick) + 1
//     applyTick = at + INPUT_DELAY              (INPUT_DELAY = 공유 설정 — 권위와 같은 입력 지연을 안다)
//   두 레이어를 굴린다:
//     · **확정(confirmed) 레이어** — 참 입력지연(INPUT_DELAY)로 전진. 권위 뷰가 *검증*한다(확정 = 권위 재현, desync 0).
//         뷰는 *워터마크+검증*일 뿐: 확정 레이어는 클라의 독립 결정론 복제이므로 뷰 손실에도 스스로 전진한다.
//     · **예측(display) 레이어** — predictDelay 로 전진(=INPUT_DELAY: 정확 / <: eager). 플레이어가 *지금* 보는 화면.
//   사후 조정: 뷰 도착 시 예측[t] vs 권위[t] 비교 → 불일치면 *오예측(snap)* → 확정값으로 리베이스+꼬리 재시뮬.
//
//   단일 클라 정직: 자기 입력을 완전히 알고 코어/시드/설정을 공유하므로 *정확 모델*의 예측은 절대 틀리지 않는다
//   (오예측 0·롤백 미발화) — 단일 클라 GGPO 의 진실. 화면이 틀리는 *진짜* 오예측은 클라가 모르는 정보
//   = **원격 플레이어 입력** 이 있어야 발생(다중 클라 = 후속, 0004 §8.5). 롤백/조정 경로를 이 step 에서 자극하려
//   *합성 오예측*(eager: 틀린 입력지연 모델)을 쓴다 — 화면은 snap 하나 *확정 레이어는 여전히 권위로 수렴*(안전망).
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 예측·롤백·재시뮬은 전부 *클라 측*(권위 Sim.tick 밖). 권위 존은 0004 무수정.
//   - 결정론 코어: 세계 쓰기 경로는 여전히 intent→권위 Sim 하나. 클라 예측은 *읽기 모델 재유도*(쓰기 아님).
//   - 권위 단일 소유: 클라는 권위를 *주장하지 않는다* — 읽기 모델을 예측하고 권위 뷰에 양보(claims 0).
//   - 은닉·단일 연결: 클라는 게이트웨이만. 뷰 경로도 게이트웨이 경유. avatar 핸들은 클라 자기 것(누설 아님).
//
// 회귀 0(불변): 예측·뷰 지연 노브=0 → 세계 사슬 = 0004 전송 골든(INPUT_DELAY=8)·INPUT_DELAY=1 이면 0001/0003 골든.
//   예측은 *순수 클라 측* — 켜든 끄든 권위/추종자 사슬 불변(예측이 세계 사슬을 절대 건드리지 않는다).
'use strict';
// engine 로드 — Node 면 require, 브라우저면 먼저 로드된 전역(HktEngine).
const __engine = (typeof module !== 'undefined' && module.exports && typeof require !== 'undefined')
  ? require('../engine/index.js')
  : globalThis.HktEngine;
const {
  Net, LoginServer, SessionRegistry,
  DummySimCore, ArraySimCore, SIM_FACTORIES, DEFAULT_MAKE_SIM,
  SIM_CONTRACT_VERSION, CONCRETE_SIM_NAMES, mulberry32, fnv1a,
} = __engine;

// ── [엣지] 게이트웨이 — 0004 그대로 + 한 곳: connect_ok 에 클라 자기 avatar 핸들 동봉 ──
// 클라 예측은 자기 avatar id 를 즉시 알아야 한다(프록시 spawn 대상). avatar 는 클라 자기 핸들 — 내부 토폴로지 아님.
// 도장(at)·팬아웃은 0004 무수정 — 게이트웨이는 여전히 구체 시뮬도 전송 모델도 모른다.
class Gateway {
  constructor() {
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
    this.replicas = [];
  }
  fanout(zone, payload) {
    const stamped = Object.assign({ at: this.net.tick }, payload);  // 논리-tick 도장(at) — 0004 그대로
    this.net.send(this.addr, zone, stamped);
    for (const r of this.replicas) this.net.send(this.addr, r, stamped);
  }
  onMsg(m) {
    const p = m.payload;
    if (m.from === 'registry') {
      if (p.type === 'validate_ok') {
        const bind = { client: p.ref, sessionId: p.sessionId, zone: p.zone, avatar: p.avatar };
        this.byClient.set(p.ref, bind);
        this.bySession.set(p.sessionId, bind);
        this.fanout(p.zone, { type: 'enter', sessionId: p.sessionId, avatar: p.avatar });
        // 0005: 클라에 자기 avatar 핸들 전달(예측 프록시 spawn 대상). 세계 사슬 무관(클라 측 정보).
        this.net.send(this.addr, p.ref, { type: 'connect_ok', avatar: p.avatar });
      } else if (p.type === 'validate_fail') {
        this.rejected++;
        this.net.send(this.addr, p.ref, { type: 'connect_fail' });
      }
      return;
    }
    if (m.from.startsWith('zone')) {
      if (p.type === 'view') {
        const bind = this.bySession.get(p.sessionId);
        if (bind) this.net.send(this.addr, bind.client, { type: 'view', t: p.t, view: p.view });
      }
      return;
    }
    if (p.type === 'connect') {
      if (this.byClient.has(m.from)) {
        this.rejected++;
        this.net.send(this.addr, m.from, { type: 'connect_fail' });
        return;
      }
      this.net.send(this.addr, 'registry', { type: 'validate', ticket: p.ticket, ref: m.from });
    } else if (p.type === 'intent') {
      const bind = this.byClient.get(m.from);
      if (bind) {
        this.fanout(bind.zone, { type: 'intent', sessionId: bind.sessionId, avatar: bind.avatar, intent: p.intent });
      } else this.dropped++;
    } else if (p.type === 'disconnect') {
      const bind = this.byClient.get(m.from);
      if (!bind) return;
      this.fanout(bind.zone, { type: 'leave', sessionId: bind.sessionId, avatar: bind.avatar });
      this.net.send(this.addr, 'registry', { type: 'session_closed', sessionId: bind.sessionId });
      this.net.send(this.addr, m.from, { type: 'disconnect_ok' });
      this.byClient.delete(m.from);
      this.bySession.delete(bind.sessionId);
    }
  }
}

// ── [월드] 존 호스트 (인프라) — 0004 무수정 (논리-tick 입력 스케줄링). 상세 계약은 step-0004.md §2 ──
class ZoneHost {
  constructor(seed, makeSim, opts = {}) {
    this.sim = makeSim(seed);
    this.sessions = new Map();
    this.owners = new Map();
    this.pendingIntents = [];
    this.inbox = [];
    this.enterCount = 0;
    this.applied = 0;
    this.ownerViolations = 0;
    this.lateMissed = 0;
    this.hashes = [];
    this.role = opts.role || 'authority';
    this.authorityAddr = opts.authorityAddr;
    this.authClaims = 0;
    this.inputDelay = opts.inputDelay !== undefined ? opts.inputDelay : 1;
    this.schedule = opts.schedule !== undefined ? opts.schedule : true;
  }
  ownerFor() { return this.role === 'follower' ? this.authorityAddr : this.addr; }
  _apply(from, p) {
    if (p.type === 'enter') {
      this.enterCount++;
      this.sessions.set(p.sessionId, { gateway: from, avatar: p.avatar });
      this.sim.spawn(p.avatar);
      this.owners.set(p.avatar, this.ownerFor());
    } else if (p.type === 'intent') {
      if (this.sessions.has(p.sessionId)) this.pendingIntents.push(p);
    } else if (p.type === 'leave') {
      this.sessions.delete(p.sessionId);
      this.sim.despawn(p.avatar);
      this.owners.delete(p.avatar);
    }
  }
  onMsg(m) {
    const p = m.payload;
    if (p.type !== 'enter' && p.type !== 'intent' && p.type !== 'leave') return;
    if (this.schedule) {
      this.inbox.push({ applyTick: (p.at | 0) + this.inputDelay, at: p.at | 0, seq: m.seq, from: m.from, p });
    } else {
      this._apply(m.from, p);
    }
  }
  onTick(S) {
    if (this.schedule) {
      const due = [];
      const keep = [];
      for (const it of this.inbox) (it.applyTick <= S ? due : keep).push(it);
      this.inbox = keep;
      due.sort((a, b) => (a.applyTick - b.applyTick) || (a.at - b.at) || (a.seq - b.seq));
      for (const it of due) {
        if (it.applyTick < S) this.lateMissed++;
        this._apply(it.from, it.p);
      }
    }
    this.applied += this.sim.tick(this.pendingIntents);
    this.pendingIntents = [];
    const ents = this.sim.liveIds();
    const expect = this.ownerFor();
    const ok = ents.length === this.owners.size && ents.every(a => this.owners.get(a) === expect);
    if (!ok) this.ownerViolations++;
    this.authClaims = ents.filter(a => this.owners.get(a) === this.addr).length;
    this.hashes.push(this.hash());
    if (this.role !== 'follower') {
      for (const [sessionId, s] of this.sessions) {
        this.net.send(this.addr, s.gateway, { type: 'view', sessionId, t: this.hashes.length, view: this.serialize() });
      }
    }
  }
  serialize() { return this.sim.serialize(); }
  hash() { return fnv1a(this.serialize()); }
  chain() { return fnv1a(this.hashes.join(',')); }
}

// ════════════════════════════════════════════════════════════════════════
//  ProxySimulator — 클라 측 예측/조정 (씨앗: HktProxySimulatorComponent). 이 step 의 핵심.
// ════════════════════════════════════════════════════════════════════════
//  공유 결정론 코어(makeSim·seed) 위에 자기 입력 스케줄을 재구성해 두 레이어를 굴린다:
//    · confirmed: 참 INPUT_DELAY 로 전진 — 권위 뷰가 검증(확정 = 권위 재현, desync 0). 뷰 손실에도 스스로 전진.
//    · predicted: predictDelay 로 전진 — 플레이어가 보는 화면. 권위 뷰와 비교해 오예측(snap) 계측.
//  v1 계약엔 deserialize/clone 이 없으므로(동결) 재시뮬은 tick 0 부터 재계산 — 결정론이라 결과 동일.
//    *재시뮬 깊이*(투기 윈도우 = 현재 권위tick - 확정tick = 뷰 RTT)를 계측해 GGPO 롤백 비용으로 보고.
class ProxySimulator {
  constructor(seed, makeSim, inputDelay, predictDelay) {
    this.seed = seed;
    this.makeSim = makeSim;
    this.inputDelay = inputDelay;                                   // 참 입력지연(공유 설정)
    this.predictDelay = predictDelay !== undefined ? predictDelay : inputDelay; // 화면 모델(=참: 정확 / <: eager)
    this.avatar = null;
    this.events = [];               // {kind, applyTrue, applyPred, intent, seq}
    // 확정 레이어 (전진 전용 — 롤백 없음, clone 불요)
    this.confirmed = makeSim(seed);
    this.confirmedTick = 0;
    this.confirmedHashes = [];
    // 계측
    this.confDesync = 0;            // 클라 확정 재현 ≠ 권위 (0 이어야 — 결정론 전파/수렴)
    this.mispredict = 0;           // 예측(화면)[t] ≠ 권위[t] — snap. 정확 모델 0 / eager >0
    this.reconciliations = 0;       // snap → 리베이스 횟수
    this.viewsValidated = 0;
    this.confMatch = [];           // tick t -> 확정 재현==권위? (관찰 셸용 per-tick)
    this.predMatch = [];           // tick t -> 예측(화면)==권위?  (관찰 셸용 per-tick)
    this.specWindowSum = 0;
    this.specWindowMax = 0;
    this.predictHead = 0;          // 현재 로컬 tick(화면이 보는 가장 앞 tick)
    this._predCache = null;
    this._predCacheLen = -1;
  }
  setAvatar(a) { this.avatar = a; }
  addEvent(kind, at, intent, seq) {
    this.events.push({ kind, applyTrue: at + this.inputDelay, applyPred: at + this.predictDelay, intent, seq: seq | 0 });
    this._predCache = null; // 이벤트 추가 → 예측 캐시 무효화
  }
  onLocalTick(localTick) { this.predictHead = localTick; }

  // 확정 레이어를 참 스케줄로 t 까지 전진(전진 전용, 결정론).
  _advanceConfirmedTo(t) {
    while (this.confirmedTick < t) {
      this.confirmedTick++;
      const pend = [];
      const due = this.events.filter(e => e.applyTrue === this.confirmedTick)
        .sort((a, b) => a.seq - b.seq);
      for (const e of due) {
        if (e.kind === 'enter') this.confirmed.spawn(this.avatar);
        else if (e.kind === 'intent') pend.push({ avatar: this.avatar, intent: e.intent });
        else if (e.kind === 'leave') this.confirmed.despawn(this.avatar);
      }
      this.confirmed.tick(pend);
      this.confirmedHashes[this.confirmedTick - 1] = fnv1a(this.confirmed.serialize());
    }
  }
  // 예측(화면) 타임라인을 predictDelay 스케줄로 재계산(캐시). 결정론이라 언제 계산해도 동일.
  _predictedHashes(upto) {
    if (this._predCache && this._predCacheLen >= upto) return this._predCache;
    const sim = this.makeSim(this.seed);
    let pend = [];
    const out = [];
    for (let k = 1; k <= upto; k++) {
      const due = this.events.filter(e => e.applyPred === k).sort((a, b) => a.seq - b.seq);
      for (const e of due) {
        if (e.kind === 'enter') sim.spawn(this.avatar);
        else if (e.kind === 'intent') pend.push({ avatar: this.avatar, intent: e.intent });
        else if (e.kind === 'leave') sim.despawn(this.avatar);
      }
      sim.tick(pend); pend = [];
      out.push(fnv1a(sim.serialize()));
    }
    this._predCache = out; this._predCacheLen = upto;
    return out;
  }

  // 권위 뷰 도착(논리 tick t, 권위 해시 authHash) — 현재 권위는 curTick(=로컬 tick).
  onView(t, authHash, curTick) {
    this.viewsValidated++;
    // ① 확정 레이어 검증: 클라 독립 재현 == 권위? (결정론 전파/수렴 — desync 0 이어야)
    this._advanceConfirmedTo(t);
    const confOk = this.confirmedHashes[t - 1] === authHash;
    if (!confOk) this.confDesync++;
    this.confMatch[t - 1] = confOk;
    // ② 화면 모델 정확도: 클라가 *그 tick 에 보여준* 예측[t] vs 권위[t].
    const pred = this._predictedHashes(Math.max(t, this.predictHead));
    const predOk = pred[t - 1] === authHash;
    this.predMatch[t - 1] = predOk;
    if (!predOk) { this.mispredict++; this.reconciliations++; } // snap + 리베이스
    // ③ 투기 윈도우(롤백 깊이) = 뷰 RTT = 화면이 확정보다 얼마나 앞서 달렸나 = 예측이 은닉한 지연.
    const win = curTick - t;
    this.specWindowSum += win;
    if (win > this.specWindowMax) this.specWindowMax = win;
  }
  // 예측이 은닉한 평균 지연(뷰 RTT) — 응답성 이득의 핵심 수치.
  avgHidden() { return this.viewsValidated ? this.specWindowSum / this.viewsValidated : 0; }
}

// ── 클라이언트 (스크립트 구동) — 0004 + 클라 예측 프록시. 아는 주소는 'login'·'gateway' 뿐 ──
class Client {
  constructor(script) {
    this.script = script;
    this.phase = 'idle';
    this.ticket = null;
    this.views = 0;
    this.events = [];
    this.sent = 0;
    this.strayDone = false;
    this.rngIntent = null;
    // 0005 예측
    this.predict = !!script.predict;
    this.proxy = null;
    this.connectOkTick = null;
    this.lastConfirmed = 0;
  }
  onTick(S) {
    if (this.phase === 'idle') {
      if (this.script.badTicket) {
        this.ticket = 'TKFORGED';
        this.phase = 'connecting';
        this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.ticket });
      } else {
        this.phase = 'authing';
        this.net.send(this.addr, 'login', { type: 'auth', account: this.script.account });
      }
    } else if (this.phase === 'playing') {
      if (this.sent < this.script.intents) {
        const dx = (this.rngIntent() % 3) - 1;
        const dy = (this.rngIntent() % 3) - 1;
        this.net.send(this.addr, 'gateway', { type: 'intent', intent: { dx, dy } });
        // 관찰: at = sendTick + 1 (happy 업스트림 1-홉). 예측 프록시에 등록.
        if (this.proxy) this.proxy.addEvent('intent', S + 1, { dx, dy }, this.sent);
        this.sent++;
      } else {
        this.phase = 'disconnecting';
        this.net.send(this.addr, 'gateway', { type: 'disconnect' });
        if (this.proxy) this.proxy.addEvent('leave', S + 1, null, 9999); // leaveAt = disconnect tick + 1
      }
    } else if (this.phase === 'done' && this.script.postLogoutIntent && !this.strayDone) {
      this.strayDone = true;
      this.net.send(this.addr, 'gateway', { type: 'intent', intent: { dx: 1, dy: 1 } });
    }
    if (this.proxy) this.proxy.onLocalTick(S); // 화면 = 현재 로컬 tick(예측이 앞서 달린다)
  }
  onMsg(m) {
    const p = m.payload;
    this.events.push(p.type);
    if (p.type === 'auth_ok') {
      this.ticket = p.ticket;
      this.phase = 'connecting';
      this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.ticket });
    } else if (p.type === 'connect_ok') {
      this.phase = 'playing';
      this.rngIntent = mulberry32((this.script.seed ^ 0xC11E) >>> 0);
      this.connectOkTick = this.net.tick;
      if (this.predict) {
        this.proxy = new ProxySimulator(this.script.seed, this.script.makeSim, this.script.inputDelay, this.script.predictDelay);
        this.proxy.setAvatar(p.avatar);                       // 클라 자기 avatar 핸들
        this.proxy.addEvent('enter', this.net.tick - 1, null, -1); // enterAt = connect_ok 수신 tick - 1
      }
    } else if (p.type === 'connect_fail') {
      this.phase = 'rejected';
    } else if (p.type === 'view') {
      this.views++;
      if (this.proxy) { this.proxy.onView(p.t, fnv1a(p.view), this.net.tick); this.lastConfirmed = p.t; }
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
}

// ── 침입자 — 0004 그대로 ──────────────────────────────────────────────────
class Intruder {
  constructor(victim) { this.victim = victim; this.sentSteal = false; this.events = []; }
  onTick() {
    if (!this.sentSteal && this.victim.phase === 'playing' && this.victim.ticket) {
      this.sentSteal = true;
      this.net.send(this.addr, 'gateway', { type: 'connect', ticket: this.victim.ticket });
    }
  }
  onMsg(m) { this.events.push(m.payload.type); }
}

// ── 하니스 — 한 번의 세계 실행 ──────────────────────────────────────────
// opts.transport: 입력 경로(게이트웨이→존) 전송 모델(0004). step-0005 는 *입력 경로를 행복 유지*(실험을 뷰 경로에 격리).
// opts.viewDelay: 뷰 경로(게이트웨이→클라) 지연 — 0005 의 한 조각. 0 이면 0004 와 동일(뷰 행복).
// opts.viewJitter: true 면 0..viewDelay 가변 지연(재정렬) / false(기본) 면 고정 viewDelay(깔끔한 곡선).
// opts.viewLoss: 뷰 경로 손실 확률(확정 레이어가 뷰 손실에도 스스로 전진함을 자극).
// opts.predict: 클라 예측 프록시 on/off. off = 0004 클라(뷰 카운트만) → 회귀 0.
// opts.predictDelay: 화면 모델 입력지연(=inputDelay: 정확 / <: eager 합성 오예측). 기본 = inputDelay.
function run(opts) {
  const {
    seed, ticks = 60, scenario = {}, replicate = false, makeSim = DEFAULT_MAKE_SIM,
    transport = null, inputDelay = 1, schedule = true,
    viewDelay = 0, viewJitter = false, viewLoss = 0, viewSeed = 1,
    predict = false, predictDelay = undefined,
  } = opts;

  // 뷰 경로 전송 — routeFilter 로 게이트웨이→클라 view 홉만 지연(엔진 무수정). 입력 경로는 transport(별도) 또는 행복.
  let netTransport = transport;
  if (viewDelay > 0 || viewLoss > 0) {
    netTransport = {
      delayMin: viewJitter ? 0 : viewDelay, delayMax: viewDelay,
      loss: viewLoss, redundancy: 1, seed: viewSeed,
      routeFilter: (m) => m.from === 'gateway' && String(m.to).startsWith('client') && m.payload.type === 'view',
    };
  }

  const net = new Net({ transport: netTransport, seed });
  const login = new LoginServer(['hero'], seed);
  const registry = new SessionRegistry();
  const gateway = new Gateway();
  const zoneOpts = { inputDelay, schedule };
  const zone = new ZoneHost(seed, makeSim, zoneOpts);
  const client = new Client({
    account: 'hero', seed,
    intents: scenario.intents !== undefined ? scenario.intents : 20,
    badTicket: !!scenario.badTicket,
    postLogoutIntent: !!scenario.postLogoutIntent,
    predict, predictDelay, inputDelay, makeSim,
  });
  net.register('login', login);
  net.register('registry', registry);
  net.register('gateway', gateway);
  net.register('zone1', zone);
  net.register('client', client);
  let intruder = null;
  if (scenario.reuseTicket) {
    intruder = new Intruder(client);
    net.register('client2', intruder);
  }
  let follower = null;
  if (replicate) {
    follower = new ZoneHost(seed, makeSim, Object.assign({ role: 'follower', authorityAddr: 'zone1' }, zoneOpts));
    net.register('zone1f', follower);
    gateway.replicas.push('zone1f');
  }
  for (let i = 0; i < ticks; i++) net.step();
  const px = client.proxy;
  return {
    net, login, registry, gateway, zone, follower, client, intruder,
    simId: zone.sim.constructor.simId,
    hash: zone.hash(),
    chain: zone.chain(),
    state: zone.serialize(),
    fhash: follower ? follower.hash() : null,
    fchain: follower ? follower.chain() : null,
    fstate: follower ? follower.serialize() : null,
    stats: net.stats,
    lateMissed: zone.lateMissed + (follower ? follower.lateMissed : 0),
    // 0005 클라 예측/조정 결과
    proxy: px,
    confDesync: px ? px.confDesync : null,
    mispredict: px ? px.mispredict : null,
    reconciliations: px ? px.reconciliations : null,
    avgHidden: px ? px.avgHidden() : null,
    specWindowMax: px ? px.specWindowMax : null,
    viewsValidated: px ? px.viewsValidated : null,
    clientAuthClaims: 0, // 클라는 권위를 주장하지 않는다(읽기 모델만) — 구조적 0
  };
}

const PUBLIC_ADDRS = ['login', 'gateway'];
const INFRA_CLASSES = { Net, LoginServer, SessionRegistry, Gateway, ZoneHost, Client, Intruder, ProxySimulator };

// ── 모듈 노출 (dual-mode: Node require + 브라우저 <script> 전역) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway,
  DummySimCore, ArraySimCore, ZoneHost, Client, Intruder, ProxySimulator,
  SIM_FACTORIES, DEFAULT_MAKE_SIM, SIM_CONTRACT_VERSION,
  INFRA_CLASSES, CONCRETE_SIM_NAMES, run, PUBLIC_ADDRS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;  // Node
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;             // 브라우저: window.HktNet
