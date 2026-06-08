// HktInfra step-0004 — 전송 모델(지연·손실·재정렬) + 논리-tick 입력 스케줄링
// step-0003(동결 ISimCore + 더미·array 2구현 + 단일 교체 seam)을 잇고 *한 조각*만 더한다:
//   행복 전송(무손실·즉시·순서보장)을 *현실 전송*(지연·손실·재정렬)으로 바꾸고,
//   "타이밍은 토폴로지의 함수, 내용만 시드의 함수"가 깨지는 첫 지점을 자극한 뒤 — 그 분리를 *복원*한다.
//
// 핵심 메커니즘 — 논리-tick 입력 스케줄링 (이 step 의 진짜 산출물):
//   게이트웨이가 존(들)로 *팬아웃*하는 모든 월드 입력(enter/intent/leave)에 **논리 적용-tick** 도장을 찍는다:
//     at = 게이트웨이가 포워딩한 net.tick      (제어 평면이 정한 값 — 전송 타이밍과 무관)
//     applyTick = at + INPUT_DELAY             (입력 지연 버퍼 — 전송 지터를 흡수할 예산)
//   권위 존과 추종자 존은 도착 *타이밍*과 무관하게 둘 다 applyTick 에 적용한다.
//     → 월드 사슬 = f(seed, 입력로그, INPUT_DELAY)  — 전송 타이밍의 함수가 *아니다*(타이밍 불변).
//     → 같은 도장을 받은 권위/추종자가 같은 논리-tick 에 적용 → 사슬 정렬(0002 §7①)이 지연·재정렬 아래서도 유지.
//
//   대조군(naive, schedule=false): 도착 즉시 적용(0003 방식). 전송 켜면 도착 tick 이 흔들려
//     권위·추종자가 *다른* tick 에 같은 입력을 적용 → 사슬 갈림·desync>0. ← 깨지는 첫 지점.
//
//   신뢰성(손실 복원): 전송 모델의 redundancy 중복-송신이 손실을 *선제* 복구 — 예산(INPUT_DELAY) 안에
//     사본 하나만 도착하면 정시 적용. 예산 초과(지연·손실 과다) = 마감 미스 → 갈림(전송 열화 곡선의 절벽).
//
// 척추(SPINE.md) 준수:
//   - 신성한 tick: 스케줄링·버퍼·소유자 장부는 전부 *호스트*(인프라). Sim.tick 안엔 시뮬만(0003 그대로).
//   - 결정론 코어: 세계 쓰기 경로는 여전히 intent→Sim 하나. 타이밍 비결정 ↔ 상태 결정론을 *분리*해 증명.
//   - 권위 단일 소유: 소유자 장부는 호스트. 추종자 자기권위 0(0002 유지).
//   - 은닉·단일 연결: 전송은 *내부* 팬아웃(게이트웨이→존)에만. 클라는 게이트웨이만(은닉 0002 유지).
//
// 회귀 0(불변): transport=null + INPUT_DELAY=1 → applyTick = at+1 = 0003 의 자연 도착 tick →
//             스케줄 경로가 0003 과 비트 동일. naive 경로도 transport=null 이면 0003 과 동일.
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

// ── [엣지] 게이트웨이 — 클라의 유일한 게임 연결점. 내부 토폴로지 은닉(0002 그대로) + 월드 입력 도장 ──
// step-0004 변경 한 곳: 존(들)로 포워딩하는 월드 입력(enter/intent/leave)에 at=net.tick 도장을 찍는다.
//   권위행과 추종자행(mirror)은 *같은* at 을 받는다 — 같은 논리-tick 정렬의 필요조건.
// ※ 게이트웨이는 구체 시뮬 구현도, 전송 모델도 모른다 — 존 주소로만 말하고 도장만 찍는다.
class Gateway {
  constructor() {
    this.byClient = new Map();
    this.bySession = new Map();
    this.dropped = 0;
    this.rejected = 0;
    this.replicas = [];   // 추종자 존 주소들 — 입력 스트림 미러 대상 (off = [])
  }
  // 월드 입력을 권위 존 + 추종자(들)에 *같은 도장*으로 팬아웃.
  fanout(zone, payload) {
    const stamped = Object.assign({ at: this.net.tick }, payload);  // 논리-tick 도장(at)
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
        this.net.send(this.addr, p.ref, { type: 'connect_ok' });
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

// ── [월드] 존 호스트 (인프라) — 시뮬을 *계약으로만* 안다(0003) + 논리-tick 입력 스케줄링(0004) ──
// opts.schedule=true(기본): 월드 입력을 applyTick=at+INPUT_DELAY 버퍼에 넣고 onTick(applyTick)에 적용.
//                           → 권위·추종자가 도착 타이밍과 무관하게 같은 논리-tick 에 적용(타이밍↔내용 분리).
// opts.schedule=false(naive): 0003 방식 — 도착 즉시 적용(enter/leave 즉시, intent 다음 tick). 전송 켜면 갈림.
class ZoneHost {
  constructor(seed, makeSim, opts = {}) {
    this.sim = makeSim(seed);        // 유일한 시뮬 결합점은 주입된 팩토리(0003) — 구체 타입을 모른다.
    this.sessions = new Map();
    this.owners = new Map();          // avatar -> 권위 소유자 주소 (인프라 — 시뮬 밖)
    this.pendingIntents = [];
    this.inbox = [];                  // 스케줄된 월드 입력 {applyTick, at, seq, from, p}
    this.enterCount = 0;
    this.applied = 0;
    this.ownerViolations = 0;
    this.lateMissed = 0;              // 마감(applyTick) 지나 도착해 늦게 적용된 입력 수(전송 예산 초과 신호)
    this.hashes = [];
    this.role = opts.role || 'authority';
    this.authorityAddr = opts.authorityAddr;
    this.authClaims = 0;
    this.inputDelay = opts.inputDelay !== undefined ? opts.inputDelay : 1;
    this.schedule = opts.schedule !== undefined ? opts.schedule : true;
  }
  ownerFor() { return this.role === 'follower' ? this.authorityAddr : this.addr; }

  // 입력 1건을 시뮬·장부에 반영 (스케줄/즉시 공통 경로).
  _apply(from, p) {
    if (p.type === 'enter') {
      this.enterCount++;
      this.sessions.set(p.sessionId, { gateway: from, avatar: p.avatar });
      this.sim.spawn(p.avatar);                    // 수명주기 → 계약
      this.owners.set(p.avatar, this.ownerFor());  // 권위 장부 → 인프라
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
      // 논리-tick 스케줄: 도착 타이밍을 버리고 at(도장) 기준 applyTick 에 큐잉.
      this.inbox.push({ applyTick: (p.at | 0) + this.inputDelay, at: p.at | 0, seq: m.seq, from: m.from, p });
    } else {
      this._apply(m.from, p);                       // naive: 도착 즉시(0003) — 타이밍이 내용으로 샌다.
    }
  }

  onTick(S) {
    if (this.schedule) {
      // applyTick<=S 인 입력을 결정론적 순서로 적용 — 순서 키 (applyTick, at, seq): 도착 순서 *무관*.
      const due = [];
      const keep = [];
      for (const it of this.inbox) (it.applyTick <= S ? due : keep).push(it);
      this.inbox = keep;
      due.sort((a, b) => (a.applyTick - b.applyTick) || (a.at - b.at) || (a.seq - b.seq));
      for (const it of due) {
        if (it.applyTick < S) this.lateMissed++;     // 마감 지나 도착 → 예산 초과(곡선의 절벽 신호)
        this._apply(it.from, it.p);
      }
    }
    // ① intent 적용 + VM 전진 — 전부 계약 뒤(0003). 호스트는 적용 수만 받는다.
    this.applied += this.sim.tick(this.pendingIntents);
    this.pendingIntents = [];
    // ② 권위 장부 검사 (인프라) — 살아있는 엔티티 소유자 = ownerFor(), 정확히 1. 추종자 자기권위 = 0.
    const ents = this.sim.liveIds();
    const expect = this.ownerFor();
    const ok = ents.length === this.owners.size && ents.every(a => this.owners.get(a) === expect);
    if (!ok) this.ownerViolations++;
    this.authClaims = ents.filter(a => this.owners.get(a) === this.addr).length;
    // ③ 해시 (+ 뷰 발행 — 권위만. 추종자는 읽기 전용 재현)
    this.hashes.push(this.hash());
    if (this.role !== 'follower') {
      for (const [sessionId, s] of this.sessions) {
        this.net.send(this.addr, s.gateway, { type: 'view', sessionId, t: this.hashes.length, view: this.serialize() });
      }
    }
  }
  serialize() { return this.sim.serialize(); }   // 계약 경유 — 호스트는 표현을 모른다(0003)
  hash() { return fnv1a(this.serialize()); }
  chain() { return fnv1a(this.hashes.join(',')); }
}

// ── 클라이언트 (스크립트 구동) — 아는 주소는 'login'·'gateway' 뿐 (0003 그대로) ──
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
  }
  onTick() {
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
        this.sent++;
      } else {
        this.phase = 'disconnecting';
        this.net.send(this.addr, 'gateway', { type: 'disconnect' });
      }
    } else if (this.phase === 'done' && this.script.postLogoutIntent && !this.strayDone) {
      this.strayDone = true;
      this.net.send(this.addr, 'gateway', { type: 'intent', intent: { dx: 1, dy: 1 } });
    }
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
    } else if (p.type === 'connect_fail') {
      this.phase = 'rejected';
    } else if (p.type === 'view') {
      this.views++;
    } else if (p.type === 'disconnect_ok') {
      this.phase = 'done';
    }
  }
}

// ── 침입자 — 본 클라의 티켓을 훔쳐 재사용 시도 (0003 그대로) ──────────────
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
// opts.transport: null=행복(무손실·즉시) | {delayMin,delayMax,loss,redundancy,seed} = 전송 모델(게이트웨이→존 팬아웃).
// opts.inputDelay: 논리-tick 버퍼 깊이(applyTick=at+inputDelay). 기본 1(=0003 자연 도착, 회귀 0 앵커).
// opts.schedule: true=논리-tick 스케줄(타이밍↔내용 분리) | false=naive 도착-즉시(0003, 전송 켜면 갈림).
function run(opts) {
  const {
    seed, ticks = 60, scenario = {}, replicate = false, makeSim = DEFAULT_MAKE_SIM,
    transport = null, inputDelay = 1, schedule = true,
  } = opts;
  const net = new Net({ transport, seed });
  const login = new LoginServer(['hero'], seed);
  const registry = new SessionRegistry();
  const gateway = new Gateway();
  const zoneOpts = { inputDelay, schedule };
  const zone = new ZoneHost(seed, makeSim, zoneOpts); // 권위
  const client = new Client({
    account: 'hero', seed,
    intents: scenario.intents !== undefined ? scenario.intents : 20,
    badTicket: !!scenario.badTicket,
    postLogoutIntent: !!scenario.postLogoutIntent,
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
    net.register('zone1f', follower);          // 내부 주소 — 클라는 모른다(은닉)
    gateway.replicas.push('zone1f');           // 게이트웨이가 입력열을 같은 도장으로 미러
  }
  for (let i = 0; i < ticks; i++) net.step();
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
  };
}

const PUBLIC_ADDRS = ['login', 'gateway'];
// 인프라 클래스 — verify 의 `swap` 모드가 "이 중 누구도 구체 시뮬 클래스를 이름으로 모름"을 구조적으로 검사.
// (Net/Login/Registry 는 engine 에 산다 — 거기서도 구체 시뮬 참조 0건이어야 하므로 함께 스캔.)
const INFRA_CLASSES = { Net, LoginServer, SessionRegistry, Gateway, ZoneHost, Client, Intruder };

// ── 모듈 노출 (dual-mode: Node require + 브라우저 <script> 전역) ───────────
const __hktNet = {
  mulberry32, fnv1a, Net, LoginServer, SessionRegistry, Gateway,
  DummySimCore, ArraySimCore, ZoneHost, Client, Intruder,
  SIM_FACTORIES, DEFAULT_MAKE_SIM, SIM_CONTRACT_VERSION,
  INFRA_CLASSES, CONCRETE_SIM_NAMES, run, PUBLIC_ADDRS,
};
if (typeof module !== 'undefined' && module.exports) module.exports = __hktNet;  // Node
if (typeof globalThis !== 'undefined') globalThis.HktNet = __hktNet;             // 브라우저: window.HktNet
