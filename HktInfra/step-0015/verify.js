// HktInfra step-0015 — 헤드리스 검증 (채팅 서비스 분리 — 채널 팬아웃을 존 tick 밖 비동기 서비스로)
// 사용: node step-0015/verify.js <mode> [seed]
//   mode: reg | e2e | sacred | fanout | isolate | hide | repro | all
//     reg        — 회귀 0: 인프로세스 모드(채팅 OFF) → step-0014 와 *비트 동일*(net.log + 상태).
//                  zones 1·2 · recovery off/on · failover off/on(+death). 채팅 박스 도입이 *비-침습*임을 증명.
//     e2e        — E2E 동치: 멀티프로세스(채팅 ON·토픽 버스·무열화) = 인프로세스 *비트 동일*(logDigest+worldDigest+chatDigest)
//                  + 누설 0·phantom 0·완전성 수렴(chatDesync 0). basic-chat·failover-chat.
//     sacred     — *신성한 tick*(이 step 의 한 조각): 채팅 ON vs OFF → 월드 상태(존 ents+AOI 뷰) *비트 동일*(채팅이 시뮬에
//                  비-침습) · 한편 채팅은 실제 일함(says>0·fanout>0) · 존에 도달한 chat 메시지 0 · chat onTick 0.
//     fanout     — 팬아웃 라우팅 정확성(이 step 의 가설): 누설 0(비-구독자 도달·지역 격리 위반) · phantom 0(서버 안 보낸 belief) ·
//                  완전성(chatDesync 0, happy) · whisper 프라이버시(타깃 1명·제3자 0) · 클라 측 누설 0 ·
//                  전송 열화(loss+redundancy)에도 *누설 0·지역 격리 보존*(best-effort 완전성만 graceful 열화).
//     isolate    — 프로세스 분리: chat = 자기 OS pid(broker·타 호스트와 다름) · 구독 테이블 비어있지 않음 · 통신=버스 프레임뿐.
//     hide       — 은닉: 채팅 ON 에도 클라 접점 = 공개 주소(login·gateway)뿐 · chat/chat_req/구독 테이블/타 내부 누설 0.
//     repro      — 재현: 같은 시드 멀티프로세스(채팅) 2회 → 같은 deliveries+월드 + 인프로세스와도 동일(결정론).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, globalAoiTruth, PUBLIC_ADDRS,
        chatDesync, chatPhantom, chatLeak, chatWhisperPrivate, chatClientNoLeak, chatDigest } = NET;
const NET14 = require('../step-0014/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40;       // 권위 존 사망 tick(failover)
const LEASE = 3;        // lease 결손 임계
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
// worldDigest — *월드 상태만*(존 ents + 클라 AOI). 채팅 on/off 에 *불변*이어야 함(신성한 tick = 채팅 비-침습).
function worldDigest(r) {
  const ents = [];
  for (const z of r.zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
// 존에 도달한 chat 메시지 수(=0 이어야 함 — 채팅은 존을 우회 = 신성한 tick).
function chatMsgsToZones(r) {
  return r.net.log.filter(m => /^zone/.test(m.to) && m.payload && /^chat/.test(m.payload.type || '')).length;
}

// ── 검증 시나리오 ──
const BASE = (seed) => ({ seed, ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const CHAT = (seed) => ({ ...BASE(seed), chat: true, chatOps: 12, regions: 2 });
const FAILS_CHAT = (seed) => ({ ...CHAT(seed), ticks: 80, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화 — 채팅 서버-측 홉(gateway↔chat)만 redundancy/loss(best-effort 팬아웃·누설 0·지역 격리 보존 검증).
const DEGRADE = (seed) => ({ ...CHAT(seed), chatOps: 14, transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.chat } });

// ── reg: 인프로세스 0015(채팅 OFF) → 0014 비트 동일(채팅 박스 도입 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(채팅 OFF) → step-0014 와 비트 동일(net.log + 상태). 채팅 박스 도입 = 비-침습 ==');
  console.log('seed   | zones | rec | fo  | 0014 logHash | 0015(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      { zones: 1, recovery: false, failover: false },
      { zones: 2, recovery: false, failover: false },
      { zones: 2, recovery: true, failover: false },
      { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE },
    ];
    for (const c of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r14 = NET14.run(p);
      const r15 = run({ ...p });
      const okL = logDigest(r14) === logDigest(r15), okS = worldDigest(r14) === worldDigest(r15);
      check(okL, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: net.log 다름`);
      check(okS, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${pad(c.zones, 5)} | ${(c.recovery ? 'on ' : 'off')} | ${(c.failover ? 'on ' : 'off')} | ${hex(logDigest(r14))}   | ${hex(logDigest(r15))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── e2e: 멀티프로세스(채팅 ON·무열화) = 인프로세스 비트 동일 ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(채팅 ON·토픽 버스·무열화) = 인프로세스 *비트 동일*(log+world+chat)·누설 0·phantom 0·chatDesync 0 ==');
  console.log('seed   | 시나리오     | 프로세스 | log동일 | world동일 | chat동일 | says/fanout | 누설 | phantom | chatDesync | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic-chat', CHAT(seed)], ['failover-chat', FAILS_CHAT(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okW = worldDigest(a) === worldDigest(b);
      const okC = chatDigest(a) === chatDigest(b);
      const leak = chatLeak(b), ph = chatPhantom(b), dC = chatDesync(b);
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름`) &&
        check(okW, `seed ${seed} ${name}: 월드 상태 다름`) &&
        check(okC, `seed ${seed} ${name}: deliveries 다름`) &&
        check(leak === 0, `seed ${seed} ${name}: 누설 ${leak}`) &&
        check(ph === 0, `seed ${seed} ${name}: phantom ${ph}`) &&
        check(dC === 0, `seed ${seed} ${name}: chatDesync ${dC}`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(12)} | ${pad(b.cluster.pids.length, 8)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okW ? '예' : '아니오').padEnd(8)} | ${(okC ? '예' : '아니오').padEnd(6)} | ${pad(b.chat.says + '/' + b.chat.fanout, 11)} | ${pad(leak, 4)} | ${pad(ph, 7)} | ${pad(dC, 10)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── sacred: 신성한 tick — 채팅이 시뮬에 비-침습(월드 비트 동일)이면서 실제 일한다(이 step 의 한 조각) ──
function sacred(seeds) {
  console.log('== sacred: *신성한 tick* — 채팅 ON vs OFF 월드 상태 *비트 동일*(시뮬 비-침습) · 채팅은 실제 일함 · 존 도달 chat 0 ==');
  console.log('seed   | world동일(on=off) | says | whisper | fanout | 존도달chat | chat onTick | chatHash(on) | 판정');
  for (const seed of seeds) {
    const off = run(BASE(seed));            // 채팅 없음(0014 토폴로지)
    const on = run(CHAT(seed));             // 채팅 분리(별도 chatRng·별도 채널)
    const okW = worldDigest(off) === worldDigest(on);   // 채팅이 월드 시뮬에 비-침습
    const worked = on.chat && on.chat.says > 0 && on.chat.fanout > 0;
    const toZones = chatMsgsToZones(on);
    const chatHasTick = typeof (on.chat && on.chat.onTick) === 'function';   // 신성한 tick = 채팅 onTick 0
    const ok =
      check(okW, `seed ${seed}: 월드 상태가 채팅 도입으로 변함(시뮬 침습)`) &&
      check(worked, `seed ${seed}: 채팅 미작동(says ${on.chat ? on.chat.says : 0}·fanout ${on.chat ? on.chat.fanout : 0})`) &&
      check(toZones === 0, `seed ${seed}: chat 메시지가 존에 ${toZones}건 도달(신성한 tick 침습)`) &&
      check(!chatHasTick, `seed ${seed}: chat 이 onTick 보유(tick 동기 — 신성한 tick 밖 아님)`);
    console.log(`${pad(seed, 6)} | ${(okW ? '예' : '아니오').padEnd(16)} | ${pad(on.chat.says, 4)} | ${pad(on.chat.whispers, 7)} | ${pad(on.chat.fanout, 6)} | ${pad(toZones, 9)} | ${(chatHasTick ? '있음' : '없음').padEnd(11)} | ${hex(chatDigest(on))}  | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 채널 팬아웃은 존을 *우회*해 chat 서비스로(존 net.log·상태 불변) — 시뮬 tick 엔 시뮬만. 채팅은 tick 무관 순수 반응형.');
}

// ── fanout: 팬아웃 라우팅 정확성(이 step 의 한 조각) — 누설 0·phantom 0·완전성·whisper 프라이버시·열화 내성 ──
function fanout(seeds) {
  console.log('== fanout: 팬아웃 라우팅 = 누설 0(비-구독자·지역격리) · phantom 0 · chatDesync 0(완전성) · whisper 프라이버시 · 열화 보존 ==');
  console.log('  대비: 전송 열화에서 *완전성*([열화]완전성 chatDesync>0 = best-effort graceful 열화)은 깨지나 *라우팅 정확성*([열화]누설/phantom 0)은 loss-무관 보존.');
  console.log('seed   | 누설 | phantom | chatDesync | whisper전용 | 클라누설0 | [열화]누설 | [열화]phantom | [열화]완전성 | whisperFail | 판정');
  for (const seed of seeds) {
    const r = run(CHAT(seed));              // 행복 경로
    const d = run(DEGRADE(seed));           // 채팅 홉 열화(redundancy+loss)
    const leak = chatLeak(r), ph = chatPhantom(r), dC = chatDesync(r);
    const wp = chatWhisperPrivate(r), cl = chatClientNoLeak(r);
    const dLeak = chatLeak(d), dPh = chatPhantom(d), dDesync = chatDesync(d);   // 열화: 누설/phantom 0 보존(정확성 loss-무관), 완전성(dDesync)은 graceful 열화
    const ok =
      check(leak === 0, `seed ${seed}: 누설 ${leak}(비-구독자 도달/지역격리 위반)`) &&
      check(ph === 0, `seed ${seed}: phantom ${ph}(서버 안 보낸 belief)`) &&
      check(dC === 0, `seed ${seed}: chatDesync ${dC}(belief 미수렴·happy)`) &&
      check(wp, `seed ${seed}: whisper 프라이버시 깨짐(타깃≠1)`) &&
      check(cl, `seed ${seed}: 클라 측 누설(구독 안 한 채널 수신)`) &&
      check(dLeak === 0, `seed ${seed}: 열화 아래 누설 ${dLeak}`) &&
      check(dPh === 0, `seed ${seed}: 열화 아래 phantom ${dPh}`);
    console.log(`${pad(seed, 6)} | ${pad(leak, 4)} | ${pad(ph, 7)} | ${pad(dC, 10)} | ${(wp ? '예' : '아니오').padEnd(11)} | ${(cl ? '예' : '아니오').padEnd(9)} | ${pad(dLeak, 10)} | ${pad(dPh, 13)} | ${pad(dDesync, 12)} | ${pad(r.chat.whisperFails, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → say = 구독자 Set 순회 팬아웃(비-구독자 도달 구조적 0) · region:X 는 X 멤버만(지역 격리) · whisper = 타깃 1명 직접.');
  console.log('  → 전송 열화(loss)면 채팅은 best-effort: [열화]완전성(chatDesync)>0 = 손실 발화 미복원(graceful)·한편 [열화]누설/phantom 0 = 라우팅 정확성 loss-무관 보존(가방 idempotent transfer 와 대비되는 정직한 한계).');
  // 채팅 + disconnect(leave) 건전성 — 떠난 클라가 byAvatar 에서 pruned 돼도 누설/phantom/클라누설 검사가 *위양성 없이* 0 유지.
  //   (완전성 chatDesync 는 떠난 클라로 향한 in-flight 배달 미수신이라 ≥0 정상 — best-effort.) 라우팅 정확성은 disconnect 무관.
  console.log('  ── chat+leave(disconnect) 건전성: 떠난 클라가 byAvatar pruned 돼도 누설/phantom 위양성 0 ──');
  console.log('seed   | 누설 | phantom | 클라누설0 | (참고)chatDesync | 판정');
  for (const seed of seeds) {
    const r = run({ ...CHAT(seed), leave: { 1: 40, 4: 45 } });   // client1·client4 가 도중 disconnect(서로 다른 region)
    const leak = chatLeak(r), ph = chatPhantom(r), cl = chatClientNoLeak(r);
    const ok =
      check(leak === 0, `seed ${seed} (leave): 누설 위양성 ${leak}(disconnect 수신자 byAvatar pruned)`) &&
      check(ph === 0, `seed ${seed} (leave): phantom ${ph}`) &&
      check(cl, `seed ${seed} (leave): 클라 측 누설 위양성(disconnect)`);
    console.log(`${pad(seed, 6)} | ${pad(leak, 4)} | ${pad(ph, 7)} | ${(cl ? '예' : '아니오').padEnd(9)} | ${pad(chatDesync(r), 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── isolate: chat = 자기 OS 프로세스·broker/타 호스트와 다름·통신은 버스 프레임뿐 ──
async function isolate(seeds) {
  console.log('== isolate: chat = *구분되는 OS 프로세스*(pid)·broker/타 호스트와 다름 · 구독 테이블 비어있지 않음 · 통신=버스 프레임뿐 ==');
  const seed = seeds[0];
  const b = await runMulti(CHAT(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const hostPid = new Map(C.pidByHost);
  const chatPid = hostPid.get('chat');
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(chatPid != null && chatPid !== C.parentPid, `chat pid(${chatPid}) 가 broker(${C.parentPid})와 같음/부재`) &&
    check(C.placement.some(([a]) => a === 'chat'), `chat 이 배치에 없음`) &&
    check(b.chat && b.chat.channels.size > 0, `구독 테이블 비어있음(채팅 미작동)`) &&
    check(C.frames > 0 && C.framesIn > 0, `버스 프레임 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · chat pid ${chatPid} · 채널 ${b.chat.channels.size}개(global+region) · 가입 ${b.chat.joins} · 팬아웃 ${b.chat.fanout} · 토픽 ${C.topics.length}개 · 버스 out ${C.frames}/${C.socketBytes}B`);
  console.log('  배치(addr → host → pid):');
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(10)} → ${host.padEnd(10)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 채팅 ON 에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 채팅 ON 에도 클라 접점 = 공개 주소(login·gateway)뿐 · chat/chat_req/구독 테이블/내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 채팅 쓴 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...CHAT(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe) ||
          /inventory/i.test(probe) || /item_req/i.test(probe) || /ledger/i.test(probe) || /byOwner/i.test(probe) || /reqAvatar/i.test(probe) ||
          /chat_req/i.test(probe) || /deliveries/i.test(probe) || /fanout/i.test(probe) || /channels/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const usedChat = r.clients.filter(c => c.chatRecv && c.chatRecv.size > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${pad(usedChat + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 클라는 chat_say/chat_whisper(scope·seq·to) 만 게이트웨이로 — chat 주소·chat_req·구독 테이블은 *서버간* 경계(비가시).');
}

// ── repro: 같은 시드 멀티프로세스(채팅) 2회 → 같은 deliveries+월드 + 인프로세스와도 동일 ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스(채팅) 2회 → 같은 deliveries+월드 + 인프로세스와도 동일(결정론) ==');
  console.log('seed   | chat 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | world 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const inp = run(CHAT(seed));
    const m1 = await runMulti(CHAT(seed));
    const m2 = await runMulti(CHAT(seed));
    const d1 = chatDigest(m1), d2 = chatDigest(m2), di = chatDigest(inp);
    const w = worldDigest(m1) === worldDigest(inp) && worldDigest(m1) === worldDigest(m2);
    digests.add(d1);
    const ok =
      check(d1 === d2, `seed ${seed}: 멀티 2회 deliveries 다름 (${hex(d1)} != ${hex(d2)})`) &&
      check(d1 === di, `seed ${seed}: 멀티 != 인프로세스 (${hex(d1)} != ${hex(di)})`) &&
      check(w, `seed ${seed}: world 다름`);
    console.log(`${pad(seed, 6)} | ${hex(d1)}     | ${(d1 === d2 ? 'OK' : 'FAIL').padEnd(12)} | ${(d1 === di ? 'OK' : 'FAIL').padEnd(14)} | ${(w ? 'OK' : 'FAIL').padEnd(10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 deliveries 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 채팅 서비스 분리 — 채널 팬아웃이 존 tick 밖 비동기 서비스로(신성한 tick) · 누설 0 · E2E 비트 동일 ==');
  for (const seed of seeds) {
    const a = run(CHAT(seed));
    const b = await runMulti(CHAT(seed));
    const C = b.cluster;
    const ok = logDigest(a) === logDigest(b) && worldDigest(a) === worldDigest(b) && chatDigest(a) === chatDigest(b)
      && chatLeak(b) === 0 && chatPhantom(b) === 0 && chatDesync(b) === 0 && chatMsgsToZones(b) === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${C.pids.length}개 · TCP :${C.port} · 채널 ${b.chat.channels.size}개(가입 ${b.chat.joins}·say ${b.chat.says}·whisper ${b.chat.whispers}·fanout ${b.chat.fanout}) · 존도달chat ${chatMsgsToZones(b)} · 누설 ${chatLeak(b)} · phantom ${chatPhantom(b)} · chatDesync ${chatDesync(b)} · log동일 ${logDigest(a) === logDigest(b)} · chat동일 ${chatDigest(a) === chatDigest(b)} | ${hex(chatDigest(b))}`);
  }
  console.log('채팅 = 별 프로세스·tick 무관 순수 반응형 서비스 · 채널 팬아웃(전체/지역/귓속말) · 비-구독자 누설 0 · 존 우회(신성한 tick) · 채팅 OFF 면 0014 비트 동일');
}

// ── CLI ──
// MODES — run.js 의 modesOf 정적 스캔이 모드 토큰을 추출(spine 회귀 사슬이 reg 자동 선택). await 는 동기 함수에도 무해.
const MODES = { reg, e2e, sacred, fanout, isolate, hide, repro };
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  if (MODES[mode]) await MODES[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    sacred(seedArg); console.log('');
    fanout(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | sacred | fanout | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
