// HktInfra step-0016 — 헤드리스 검증 (이벤트 버스 서비스 층 — 게임 서비스 발행/구독 의미·직접 결합 제거)
// 사용: node step-0016/verify.js <mode> [seed]
//   mode: reg | e2e | sacred | decouple | degrade | inject | isolate | hide | repro | all
//     reg        — 회귀 0: 인프로세스 모드(버스 OFF) → step-0015 와 *비트 동일*(net.log + 상태).
//                  zones 1·2 · recovery off/on · failover off/on(+death) · *서비스 ON(가방+채팅)·버스 OFF*.
//                  버스 박스·_svcSend 분기·inject seam 도입이 전부 *비-침습*임을 증명.
//     e2e        — E2E 동치: 멀티프로세스(버스+감사 ON·무열화) = 인프로세스 *비트 동일*(log+world+inv+chat+bus+audit)
//                  + 누설 0·phantom 0·chatDesync 0·원장 보존/정합. basic-bus·failover-bus.
//     sacred     — *신성한 tick*: 버스+감사 ON vs 전부 OFF → 월드 상태(존 ents+AOI 뷰) *비트 동일*(버스가 시뮬에
//                  비-침습) · 버스는 실제 일함(publishes/fanout>0) · 존 도달 svc 메시지 0 · bus/audit onTick 0.
//     decouple   — *이 step 의 가설*: ① gateway↔service 직접 메시지 = 0(버스 ON — N×N 직접 결합 제거, OFF 대조 >0)
//                  ② gateway spec 에 서비스 주소 없음(주소 무지) ③ *발행자 무수정 소비자 추가* — audit ON/OFF 에
//                  gateway/inventory/chat 의 spec(JSON)·발신 스트림(senderDigest)·world/inv/chat 다이제스트 *비트 동일*
//                  ④ 새 소비자 실수신 — audit.seen[t] == 토픽별 발행 수(전수).
//     degrade    — 버스 홉(svcbus) loss 0.2+redundancy 3 열화: *라우팅 정확성*(누설/phantom 0)·*원장 보존/정합*은
//                  loss-무관 보존, 완전성(itemDesync/chatDesync)만 graceful 열화(0015 best-effort 의미 보존).
//     inject     — 시나리오 inject write-seam(TESTBED §10-4, 이번 복사 전진에서 심음): 주입 실효(월드 변화)·
//                  결정론(2회 동일)·멀티프로세스 비트 동일. 미제공이면 no-op(reg 가 증명).
//     isolate    — 프로세스 분리: bus·audit = 각자 OS pid(broker·타 호스트와 다름) · 통신=버스 프레임뿐.
//     hide       — 은닉: 버스 ON 에도 클라 접점 = 공개 주소(login·gateway)뿐 · 토픽/pub/ev/audit/구독 테이블 누설 0.
//     repro      — 재현: 같은 시드 멀티프로세스 2회 → 같은 bus/audit/inv/chat 다이제스트 + 인프로세스와도 동일(결정론).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, buildTopology, PUBLIC_ADDRS,
        chatDesync, chatPhantom, chatLeak, chatWhisperPrivate, chatClientNoLeak, chatDigest,
        itemConserved, ledgerConsistent, maxItemBeliefOwners, itemDesync, invDigest,
        busDigest, auditDigest, directSvcMsgs, senderDigest, topicPublishCount } = NET;
const NET15 = require('../step-0015/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;       // 권위 존 사망 tick(failover)
const LEASE = 3;        // lease 결손 임계
const TOPICS = ['svc.item', 'svc.item.out', 'svc.chat', 'svc.chat.out'];
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// worldDigest — *월드 상태만*(존 ents + 클라 AOI). 버스/감사 on/off 에 *불변*이어야 함(신성한 tick = 버스 비-침습).
function worldDigest(r) {
  const ents = [];
  for (const z of r.zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
// 존에 도달한 서비스/버스 메시지 수(=0 이어야 함 — 서비스·버스는 존을 우회 = 신성한 tick).
function svcMsgsToZones(r) {
  return r.net.log.filter(m => /^zone/.test(m.to) && m.payload && /^(chat|item|pub|sub|ev)/.test(m.payload.type || '')).length;
}

// ── 검증 시나리오 ──
const BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const SVC = (seed) => ({ ...BASE(seed), inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2 });   // 0015 의미(직접 라우팅) — decouple 대조
const BUS = (seed) => ({ ...SVC(seed), bus: true });                  // 버스 의미(주소 무지·토픽만)
const BUSA = (seed) => ({ ...BUS(seed), audit: true });               // + 새 소비자(발행자 무수정)
const FAILS_BUSA = (seed) => ({ ...BUSA(seed), ticks: 80, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화 — 버스 출입 홉(svcbus) 전체에 redundancy/loss(라우팅 정확성·원장 보존의 loss-무관 검증).
const DEGRADE = (seed) => ({ ...BUSA(seed), transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.svcbus } });

// ── reg: 인프로세스 0016(버스 OFF) → 0015 비트 동일(버스 박스·inject seam 도입 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(버스 OFF) → step-0015 와 비트 동일(net.log + 상태). 버스 박스·inject seam 도입 = 비-침습 ==');
  console.log('seed   | 구성                | 0015 logHash | 0016(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      ['zones1            ', { zones: 1, recovery: false, failover: false }],
      ['zones2            ', { zones: 2, recovery: false, failover: false }],
      ['zones2+rec        ', { zones: 2, recovery: true, failover: false }],
      ['zones2+rec+fo     ', { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE }],
      ['svc(inv+chat)·bus0', { zones: 2, recovery: true, failover: false, inventory: true, itemOps: 8, chat: true, chatOps: 10, regions: 2 }],
    ];
    for (const [name, c] of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r15 = NET15.run(p);
      const r16 = run({ ...p });
      const okL = logDigest(r15) === logDigest(r16), okS = worldDigest(r15) === worldDigest(r16);
      check(okL, `seed ${seed} ${name.trim()}: net.log 다름`);
      check(okS, `seed ${seed} ${name.trim()}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${name} | ${hex(logDigest(r15))}   | ${hex(logDigest(r16))}   | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
  console.log('  → 버스 OFF 면 토폴로지에 bus/audit 이 *없고*, gateway/서비스의 버스 분기·inject seam 은 휴면 — 0015 와 비트 동일(서비스 ON 구성 포함).');
}

// ── e2e: 멀티프로세스(버스+감사 ON·무열화) = 인프로세스 비트 동일 ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(버스+감사 ON·무열화) = 인프로세스 *비트 동일*(log+world+inv+chat+bus+audit)·누설 0·원장 보존 ==');
  console.log('seed   | 시나리오     | 프로세스 | log동일 | world | inv | chat | bus | audit | 누설 | phantom | 보존/정합 | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic-bus', BUSA(seed)], ['failover-bus', FAILS_BUSA(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okW = worldDigest(a) === worldDigest(b);
      const okI = invDigest(a) === invDigest(b);
      const okC = chatDigest(a) === chatDigest(b);
      const okB = busDigest(a) === busDigest(b);
      const okA = auditDigest(a) === auditDigest(b);
      const leak = chatLeak(b), ph = chatPhantom(b), dC = chatDesync(b);
      const cons = itemConserved(b) && ledgerConsistent(b);
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름`) &&
        check(okW, `seed ${seed} ${name}: 월드 상태 다름`) &&
        check(okI, `seed ${seed} ${name}: 원장 다름`) &&
        check(okC, `seed ${seed} ${name}: deliveries 다름`) &&
        check(okB, `seed ${seed} ${name}: 버스 라우팅/회계 다름`) &&
        check(okA, `seed ${seed} ${name}: audit 관찰 스트림 다름`) &&
        check(leak === 0, `seed ${seed} ${name}: 누설 ${leak}`) &&
        check(ph === 0, `seed ${seed} ${name}: phantom ${ph}`) &&
        check(dC === 0, `seed ${seed} ${name}: chatDesync ${dC}`) &&
        check(cons, `seed ${seed} ${name}: 원장 보존/정합 깨짐`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(12)} | ${pad(b.cluster.pids.length, 8)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okW ? '예' : '아니')} | ${(okI ? '예' : '아니')} | ${(okC ? '예' : '아니')}  | ${(okB ? '예' : '아니')} | ${(okA ? '예' : '아니')}   | ${pad(leak, 4)} | ${pad(ph, 7)} | ${(cons ? '예' : '아니오').padEnd(8)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── sacred: 신성한 tick — 버스가 시뮬에 비-침습(월드 비트 동일)이면서 실제 일한다 ──
function sacred(seeds) {
  console.log('== sacred: *신성한 tick* — 버스+감사 ON vs 전부 OFF 월드 상태 *비트 동일*(시뮬 비-침습) · 버스는 실제 일함 · 존 도달 svc 0 ==');
  console.log('seed   | world동일(on=off) | pub | 팬아웃 | unrouted | 존도달svc | bus onTick | audit onTick | busHash(on)  | 판정');
  for (const seed of seeds) {
    const off = run(BASE(seed));            // 서비스·버스 전부 없음(0013 토폴로지)
    const on = run(BUSA(seed));             // 가방+채팅+버스+감사
    const okW = worldDigest(off) === worldDigest(on);   // 버스/서비스가 월드 시뮬에 비-침습
    const worked = on.bus && on.bus.publishes > 0 && on.bus.deliveries > 0 && on.chat.says > 0 && on.inventory.minted > 0;
    const toZones = svcMsgsToZones(on);
    const busHasTick = typeof (on.bus && on.bus.onTick) === 'function';       // 신성한 tick = bus onTick 0
    const auditHasTick = typeof (on.audit && on.audit.onTick) === 'function';
    const ok =
      check(okW, `seed ${seed}: 월드 상태가 버스 도입으로 변함(시뮬 침습)`) &&
      check(worked, `seed ${seed}: 버스 미작동(pub ${on.bus ? on.bus.publishes : 0}·팬아웃 ${on.bus ? on.bus.deliveries : 0})`) &&
      check(toZones === 0, `seed ${seed}: svc/pub/ev 메시지가 존에 ${toZones}건 도달(신성한 tick 침습)`) &&
      check(!busHasTick && !auditHasTick, `seed ${seed}: bus/audit 이 onTick 보유(tick 동기 — 신성한 tick 밖 아님)`);
    console.log(`${pad(seed, 6)} | ${(okW ? '예' : '아니오').padEnd(16)} | ${pad(on.bus.publishes, 3)} | ${pad(on.bus.deliveries, 6)} | ${pad(on.bus.unrouted, 8)} | ${pad(toZones, 8)} | ${(busHasTick ? '있음' : '없음').padEnd(10)} | ${(auditHasTick ? '있음' : '없음').padEnd(12)} | ${hex(busDigest(on))}   | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → pub/sub 라우팅은 존을 *우회*해 bus 박스로(존 net.log·상태 불변) — 시뮬 tick 엔 시뮬만. 버스·감사는 tick 무관 순수 반응형.');
}

// ── decouple: 이 step 의 가설 — 직접 결합 제거 + 발행자 무수정 소비자 추가 ──
function decouple(seeds) {
  console.log('== decouple: *가설* — ① gateway↔service 직접 메시지 0(버스 ON) ② 주소 무지 ③ 발행자 무수정 소비자 추가 ④ 소비자 전수 수신 ==');
  console.log('seed   | 직접(busOFF) | 직접(busON) | gw주소무지 | spec동일(gw/inv/chat) | 발신동일(gw/inv/chat) | w/i/c동일 | audit수신==발행 | 판정');
  for (const seed of seeds) {
    const direct = run(SVC(seed));          // 0015 의미(직접 라우팅) — 대조군
    const b = run(BUS(seed));               // 버스 의미·audit OFF
    const a = run(BUSA(seed));              // 버스 의미 + audit(새 소비자)
    // ① 직접 결합 제거 — 버스 ON 이면 gateway↔inventory/chat 직접 메시지가 net.log 에 0(OFF 대조 >0).
    const dOff = directSvcMsgs(direct), dOn = directSvcMsgs(b), dOnA = directSvcMsgs(a);
    // ② 주소 무지 — gateway spec 에 서비스 주소 없음(inventoryAddr/chatAddr = null).
    const gwSpec = buildTopology(BUS(seed)).specs.find(s => s.addr === 'gateway');
    const blind = gwSpec.opts.inventoryAddr === null && gwSpec.opts.chatAddr === null && gwSpec.opts.busAddr === 'bus';
    // ③ 발행자 무수정 — audit ON/OFF 에 발행자들의 spec(JSON)과 발신 스트림(내용+순서)이 비트 동일.
    const tb = buildTopology(BUS(seed)), ta = buildTopology(BUSA(seed));
    const specOf = (t, addr) => JSON.stringify(t.specs.find(s => s.addr === addr));
    const specSame = ['gateway', 'inventory', 'chat'].every(x => specOf(tb, x) === specOf(ta, x));
    const sendSame = ['gateway', 'inventory', 'chat'].every(x => senderDigest(b, x) === senderDigest(a, x));
    const outSame = worldDigest(b) === worldDigest(a) && invDigest(b) === invDigest(a) && chatDigest(b) === chatDigest(a);
    // ④ 새 소비자 실수신 — audit 이 4개 토픽 발행 *전수*를 받았다(audit.seen[t] == net.log 의 토픽별 pub 수).
    let evTotal = 0;
    const consumed = TOPICS.every(t => {
      const pubs = topicPublishCount(a, t);
      evTotal += pubs;
      return (a.audit.seen.get(t) || 0) === pubs;
    });
    const ok =
      check(dOff > 0, `seed ${seed}: 대조군(busOFF) 직접 메시지 ${dOff}(>0 이어야 — 대조 실패)`) &&
      check(dOn === 0 && dOnA === 0, `seed ${seed}: 버스 ON 인데 직접 메시지 ${dOn}/${dOnA}(직접 결합 잔존)`) &&
      check(blind, `seed ${seed}: gateway spec 이 서비스 주소를 앎(주소 무지 실패)`) &&
      check(specSame, `seed ${seed}: audit 추가가 발행자 spec 을 바꿈`) &&
      check(sendSame, `seed ${seed}: audit 추가가 발행자 발신 스트림을 바꿈`) &&
      check(outSame, `seed ${seed}: audit 추가가 world/inv/chat 결과를 바꿈`) &&
      check(consumed && evTotal > 0, `seed ${seed}: audit 수신(${[...a.audit.seen.values()].join(',')}) != 토픽별 발행 수(전수 ${evTotal})`);
    console.log(`${pad(seed, 6)} | ${pad(dOff, 12)} | ${pad(dOn + '/' + dOnA, 11)} | ${(blind ? '예' : '아니오').padEnd(9)} | ${(specSame ? '예' : '아니오').padEnd(20)} | ${(sendSame ? '예' : '아니오').padEnd(20)} | ${(outSame ? '예' : '아니오').padEnd(8)} | ${pad(evTotal + '/' + evTotal, 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 발행자(gateway·서비스)는 *토픽만* 알고 소비자 주소·존재를 모른다(구독자 0 = 폐기). 새 소비자(audit) 추가 = 버스 구독 테이블 행 추가뿐');
  console.log('    — 발행자 spec·발신 스트림·서비스 결과가 전부 비트 동일(N×N 직접 결합 제거의 약속: "새 소비자 추가가 발행자 무수정").');
}

// ── degrade: 버스 홉 열화 — 라우팅 정확성·원장 보존은 loss-무관, 완전성만 graceful ──
function degrade(seeds) {
  console.log('== degrade: 버스 홉(svcbus) loss 0.2·redundancy 3 — 누설/phantom 0·원장 보존/정합·소유 belief ≤1 은 loss-무관 보존, 완전성만 graceful ==');
  console.log('seed   | 누설 | phantom | 보존 | 정합 | belief소유≤1 | 직접0 | (참고)itemDesync | (참고)chatDesync | 판정');
  for (const seed of seeds) {
    const d = run(DEGRADE(seed));
    const leak = chatLeak(d), ph = chatPhantom(d);
    const cons = itemConserved(d), consist = ledgerConsistent(d);
    const own = maxItemBeliefOwners(d) <= 1;
    const dz = directSvcMsgs(d) === 0;
    const ok =
      check(leak === 0, `seed ${seed}: 열화 아래 누설 ${leak}`) &&
      check(ph === 0, `seed ${seed}: 열화 아래 phantom ${ph}`) &&
      check(cons, `seed ${seed}: 열화 아래 원장 보존 깨짐`) &&
      check(consist, `seed ${seed}: 열화 아래 원장 정합 깨짐`) &&
      check(own, `seed ${seed}: 열화 아래 belief 소유자 >1(split-brain)`) &&
      check(dz, `seed ${seed}: 열화 아래 직접 메시지 발생`);
    console.log(`${pad(seed, 6)} | ${pad(leak, 4)} | ${pad(ph, 7)} | ${(cons ? '예' : '아니')} | ${(consist ? '예' : '아니')} | ${(own ? '예' : '아니오').padEnd(11)} | ${(dz ? '예' : '아니')}   | ${pad(itemDesync(d), 16)} | ${pad(chatDesync(d), 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → pub/ev 프레임이 유실돼도 *라우팅 정확성*(구독 테이블 순회)·*원장 불변*(서비스 내부 SSOT)은 loss-무관 — 잃는 건 *완전성*(belief 수렴)뿐(0014·0015 의 신뢰성 의미가 버스 경유 후에도 보존).');
}

// ── inject: 시나리오 inject write-seam(TESTBED §10-4 — 이번 복사 전진에서 심음) ──
async function inject(seeds) {
  console.log('== inject: 시나리오 inject write-seam — 주입 실효(월드 변화)·결정론(2회 동일)·멀티프로세스 비트 동일(미제공=no-op 은 reg 가 증명) ==');
  console.log('seed   | 실효(월드변화) | 결정론(2회) | 멀티 비트 동일 | 판정');
  const I = [{ tick: 20, client: 0, move: [3, 0] }, { tick: 25, client: 2, move: [0, 2] }];
  for (const seed of seeds) {
    const r0 = run(BASE(seed));
    const r1 = run({ ...BASE(seed), inject: I });
    const r2 = run({ ...BASE(seed), inject: I });
    const m = await runMulti({ ...BASE(seed), inject: I });
    const eff = worldDigest(r1) !== worldDigest(r0);
    const det = logDigest(r1) === logDigest(r2);
    const multi = logDigest(m) === logDigest(r1) && worldDigest(m) === worldDigest(r1);
    const ok =
      check(eff, `seed ${seed}: 주입이 월드에 무효과(seam 미작동)`) &&
      check(det, `seed ${seed}: 주입 결정론 깨짐(2회 다름)`) &&
      check(multi, `seed ${seed}: 멀티프로세스 inject 가 인프로세스와 다름`);
    console.log(`${pad(seed, 6)} | ${(eff ? '예' : '아니오').padEnd(13)} | ${(det ? '예' : '아니오').padEnd(10)} | ${(multi ? '예' : '아니오').padEnd(13)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → run.js 의 scenario `inject` 명령이 이 seam 을 자동 소비(레코더·verify 같은 입력 — TESTBED §5-3 고리 완성).');
}

// ── isolate: bus·audit = 각자 OS 프로세스·broker/타 호스트와 다름·통신은 버스 프레임뿐 ──
async function isolate(seeds) {
  console.log('== isolate: bus·audit = *구분되는 OS 프로세스*(pid)·broker/타 호스트와 다름 · 라우팅 테이블 비어있지 않음 · 통신=버스 프레임뿐 ==');
  const seed = seeds[0];
  const b = await runMulti(BUSA(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const hostPid = new Map(C.pidByHost);
  const busPid = hostPid.get('bus'), auditPid = hostPid.get('audit');
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(busPid != null && busPid !== C.parentPid, `bus pid(${busPid}) 가 broker(${C.parentPid})와 같음/부재`) &&
    check(auditPid != null && auditPid !== C.parentPid && auditPid !== busPid, `audit pid(${auditPid}) 가 broker/bus 와 같음/부재`) &&
    check(C.placement.some(([a]) => a === 'bus') && C.placement.some(([a]) => a === 'audit'), `bus/audit 이 배치에 없음`) &&
    check(b.bus && b.bus.topics.size === TOPICS.length && b.bus.publishes > 0, `버스 라우팅 테이블/발행 비어있음(버스 미작동)`) &&
    check(b.audit && b.audit.records.length > 0, `audit 관찰 스트림 비어있음(소비자 미작동)`) &&
    check(C.frames > 0 && C.framesIn > 0, `버스 프레임 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · bus pid ${busPid} · audit pid ${auditPid} · 토픽 ${b.bus.topics.size}개(svc.*) · pub ${b.bus.publishes}·팬아웃 ${b.bus.deliveries} · audit 수신 ${b.audit.records.length} · 버스 out ${C.frames}/${C.socketBytes}B`);
  console.log('  배치(addr → host → pid):');
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(10)} → ${host.padEnd(10)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 버스 ON 에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 버스+감사 ON 에도 클라 접점 = 공개 주소(login·gateway)뿐 · 토픽/pub/ev/audit/구독 테이블/내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 서비스 쓴 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...BUSA(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe) ||
          /inventory/i.test(probe) || /item_req/i.test(probe) || /ledger/i.test(probe) || /byOwner/i.test(probe) || /reqAvatar/i.test(probe) ||
          /chat_req/i.test(probe) || /deliveries/i.test(probe) || /fanout/i.test(probe) || /channels/i.test(probe) ||
          /"pub"/.test(probe) || /"sub"/.test(probe) || /"ev"/.test(probe) || /topic/i.test(probe) || /svc\./.test(probe) || /audit/i.test(probe) || /"bus"/.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const used = r.clients.filter(c => (c.chatRecv && c.chatRecv.size > 0) || (c.items && c.items.size > 0)).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${pad(used + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 클라 와이어 계약은 0015 그대로(item_*·chat_*) — 토픽·pub/ev 봉투·구독 테이블·audit 은 전부 *서버간* 경계(비가시).');
}

// ── repro: 같은 시드 멀티프로세스 2회 → 같은 bus/audit/inv/chat + 인프로세스와도 동일 ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스(버스+감사) 2회 → 같은 ev 스트림+월드 + 인프로세스와도 동일(결정론) ==');
  console.log('seed   | audit 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | world 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const inp = run(BUSA(seed));
    const m1 = await runMulti(BUSA(seed));
    const m2 = await runMulti(BUSA(seed));
    const sig = (r) => auditDigest(r) + '/' + busDigest(r) + '/' + invDigest(r) + '/' + chatDigest(r);
    const s1 = sig(m1), s2 = sig(m2), si = sig(inp);
    const w = worldDigest(m1) === worldDigest(inp) && worldDigest(m1) === worldDigest(m2);
    digests.add(auditDigest(m1));
    const ok =
      check(s1 === s2, `seed ${seed}: 멀티 2회 다름 (${s1} != ${s2})`) &&
      check(s1 === si, `seed ${seed}: 멀티 != 인프로세스 (${s1} != ${si})`) &&
      check(w, `seed ${seed}: world 다름`);
    console.log(`${pad(seed, 6)} | ${hex(auditDigest(m1))}       | ${(s1 === s2 ? 'OK' : 'FAIL').padEnd(12)} | ${(s1 === si ? 'OK' : 'FAIL').padEnd(14)} | ${(w ? 'OK' : 'FAIL').padEnd(10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 ev 스트림 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 이벤트 버스 서비스 층 — 발행/구독 의미·직접 결합 0·발행자 무수정 소비자 추가 · E2E 비트 동일 ==');
  for (const seed of seeds) {
    const a = run(BUSA(seed));
    const b = await runMulti(BUSA(seed));
    const C = b.cluster;
    const ok = logDigest(a) === logDigest(b) && worldDigest(a) === worldDigest(b) && busDigest(a) === busDigest(b) && auditDigest(a) === auditDigest(b)
      && directSvcMsgs(b) === 0 && chatLeak(b) === 0 && chatPhantom(b) === 0 && itemConserved(b) && ledgerConsistent(b) && svcMsgsToZones(b) === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · TCP :${C.port} · 토픽 ${b.bus.topics.size}개(pub ${b.bus.publishes}·팬아웃 ${b.bus.deliveries}·unrouted ${b.bus.unrouted}) · audit 수신 ${b.audit.records.length} · 직접결합 ${directSvcMsgs(b)} · 존도달svc ${svcMsgsToZones(b)} · log동일 ${logDigest(a) === logDigest(b)} · bus동일 ${busDigest(a) === busDigest(b)} | ${hex(busDigest(b))}`);
  }
  console.log('서비스 경로가 발행/구독 의미로 — 발행자는 토픽만(주소 무지) · 새 소비자 추가 = 구독 테이블 행뿐(발행자 무수정) · 버스 OFF 면 0015 비트 동일');
}

// ── CLI ──
// MODES — run.js 의 modesOf 정적 스캔이 모드 토큰을 추출(spine 회귀 사슬이 reg 자동 선택). await 는 동기 함수에도 무해.
const MODES = { reg, e2e, sacred, decouple, degrade, inject, isolate, hide, repro };
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  if (MODES[mode]) await MODES[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    sacred(seedArg); console.log('');
    decouple(seedArg); console.log('');
    degrade(seedArg); console.log('');
    await inject(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | sacred | decouple | degrade | inject | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
