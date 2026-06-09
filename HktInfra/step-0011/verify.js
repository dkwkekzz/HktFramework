// HktInfra step-0011 — 헤드리스 검증 (실 TCP 소켓 전송 현실화·원격 멀티프로세스 E2E)
// 사용: node step-0011/verify.js <mode> [seed]
//   mode: reg | e2e | wire | isolate | hide | repro | all
//     reg     — 회귀 0: 인프로세스 모드(와이어 교체 OFF) → step-0010 와 *비트 동일*(net.log + 상태).
//               zones 1·2 · recovery off/on · failover off/on(+death). 와이어 현실화가 *비-침습*임을 증명.
//     e2e     — E2E 동치: 멀티프로세스(각 서버 별 OS 프로세스·실 TCP 소켓) 실행이 인프로세스와 *비트 동일*
//               (logDigest + fullDigest) + 승격 수 일치 + 최종 desync 0. 실 소켓이 *의미를 보존*함(가설 핵심).
//     wire    — 실 와이어: 전송이 *실 TCP 소켓*(net.connect/createServer)·*길이-프리픽스 프레이밍*이고,
//               fork IPC 채널 0(spawn). + 프레이밍 재조립 단위 검증(청크 분할/병합/부분 헤더 — 스트림 복원).
//     isolate — 프로세스 분리: 각 서버가 *구분되는 OS 프로세스*(pid)·broker 와도 다름 · 통신=실 TCP 소켓 프레임뿐.
//               배치표(addr→host→pid) + broker TCP 포트 출력.
//     hide    — 은닉: 멀티프로세스(서버간 소켓) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 누설 0.
//     repro   — 재현: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(소켓이 결정론을 안 깸).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, ownerOf, globalAoiTruth, PUBLIC_ADDRS } = NET;
const { frameOf, Framer } = require('./cluster.js');
const NET10 = require('../step-0010/net-core.js');   // reg 대조용(직전 step)

const SEEDS = [42, 7, 1234, 99, 2026];
const SC = 80;          // 승격 수렴 여유(꼬리)
const DEATH = 40;       // 권위 존 사망 tick
const LEASE = 3;        // lease 결손 임계(감지 창)
let FAILED = false;

function check(cond, label) { if (!cond) { FAILED = true; console.log('  FAIL: ' + label); } return cond; }
function pad(v, w) { return String(v).padStart(w); }
function hex(v) { return '0x' + (v >>> 0).toString(16).padStart(8, '0'); }

function logDigest(r) {
  return fnv1a(r.net.log.map(m => m.from + '>' + m.to + ':' + JSON.stringify(m.payload)).join('\n'));
}
function stateDigest(r) {
  const ents = [];
  for (const z of r.zones) for (const [id, e] of z.ents) ents.push(id + ':' + e.x + ',' + e.y);
  ents.sort();
  const seen = r.clients.map(c => c.avatar + '=' + c.seenIds().join(',')).sort().join(';');
  return fnv1a(ents.join('|') + '#' + seen);
}
function fullDigest(r) {
  const owns = r.clients.map(c => c.avatar + '@' + (ownerOf(r, c.avatar) || '-')).sort().join(';');
  const sig = r.clients.map(c => c.avatar + ':' + c.seenSig()).sort().join('|');
  return fnv1a(owns + '#' + sig + '#' + r.totals.promotions);
}
function finalLiveDesync(r) {
  let d = 0;
  for (const c of r.clients) {
    if (!c.avatar) continue;
    const truth = globalAoiTruth(r, c.avatar);
    if (truth === null) continue;
    if (JSON.stringify(c.seenIds()) !== JSON.stringify(truth)) d++;
  }
  return d;
}

// 검증 시나리오(공통)
const BASIC = (seed) => ({ seed, ticks: 48, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true });
const FAILS = (seed) => ({ seed, ticks: SC, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE });
// 전송 열화(손실·지연·재정렬·중복) ON — transport 모델은 broker substrate(engine Net)에 사니(routeFilter=broker-local 함수),
// 멀티프로세스도 *같은 손실 패턴*(같은 transport 시드)을 겪어 인프로세스와 비트 동일해야(와이어 일관). 실 소켓은 신뢰 전송이라
// broker↔host 왕복은 무손실 — 게임-층 손실은 broker 의 engine Net 이 결정론적으로 주입(전송 모델 ≠ 소켓 와이어).
const TRANS = (seed) => ({ ...BASIC(seed), ticks: 60, transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.both } });

// ── reg: 인프로세스 0011 → 0010 비트 동일(와이어 교체 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(와이어 OFF) → step-0010 와 비트 동일(net.log + 상태). 와이어 현실화 = 비-침습 ==');
  console.log('seed   | zones | rec | fo  | 0010 logHash | 0011(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      { zones: 1, recovery: false, failover: false },
      { zones: 2, recovery: false, failover: false },
      { zones: 2, recovery: true, failover: false },
      { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE },
    ];
    for (const c of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r10 = NET10.run(p);
      const r11 = run({ ...p });
      const okL = logDigest(r10) === logDigest(r11), okS = stateDigest(r10) === stateDigest(r11);
      check(okL, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: net.log 다름`);
      check(okS, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${pad(c.zones, 5)} | ${(c.recovery ? 'on ' : 'off')} | ${(c.failover ? 'on ' : 'off')} | ${hex(logDigest(r10))}   | ${hex(logDigest(r11))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── e2e: 멀티프로세스(실 소켓) = 인프로세스 비트 동일(실 소켓이 의미 보존) ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(각 서버 별 OS 프로세스·실 TCP 소켓) = 인프로세스 *비트 동일*(logDigest+fullDigest)·승격 일치·desync 0 ==');
  console.log('seed   | 시나리오 | 프로세스 | 와이어 | log동일 | full동일 | 승격(in/멀티) | 멀티 desync | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic', BASIC(seed)], ['transport', TRANS(seed)], ['failover', FAILS(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okF = fullDigest(a) === fullDigest(b);
      const okP = a.totals.promotions === b.totals.promotions;
      const dB = finalLiveDesync(b);
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름(실 소켓 의미 깨짐)`) &&
        check(okF, `seed ${seed} ${name}: full 상태 다름`) &&
        check(okP, `seed ${seed} ${name}: 승격 수 다름(${a.totals.promotions} vs ${b.totals.promotions})`) &&
        check(dB === 0, `seed ${seed} ${name}: 멀티프로세스 최종 desync ${dB}(수렴 깨짐)`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(8)} | ${pad(b.cluster.pids.length, 8)} | ${(b.cluster.wire || '?').padEnd(6)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(a.totals.promotions + '/' + b.totals.promotions, 12)} | ${pad(dB, 11)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── wire: 전송이 실 TCP 소켓·길이-프리픽스 프레이밍이고 fork IPC 0 + 프레이밍 재조립 단위 검증 ──
async function wire(seeds) {
  console.log('== wire: 전송 = 실 TCP 소켓(net) · 길이-프리픽스 프레이밍 · fork IPC 채널 0(spawn) ==');
  // (1) 멀티프로세스 런이 실 소켓 와이어임을 메타로 확인 + 포트·프레임·바이트 계측.
  const seed = seeds[0];
  const b = await runMulti(FAILS(seed));
  const C = b.cluster;
  check(C.wire === 'tcp-socket', `wire 메타가 tcp-socket 아님(${C.wire})`);
  check(typeof C.port === 'number' && C.port > 0, `broker TCP 포트 비정상(${C.port})`);
  check(C.frames > 0 && C.framesIn > 0, `소켓 프레임 0(out ${C.frames}/in ${C.framesIn})`);
  check(C.socketBytes > 0 && C.socketBytesIn > 0, `소켓 바이트 0`);
  check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터 존재`);
  console.log(`  broker TCP :${C.port} · 와이어 ${C.wire} · 프레임 out ${C.frames}/${C.socketBytes}B · in ${C.framesIn}/${C.socketBytesIn}B · 양방향 직렬화 ${C.allSerializable}`);

  // (2) 프레이밍 재조립 단위 검증 — TCP 스트림은 임의 분할되므로 *바이트 단위 분할*에도 메시지 경계가 복원돼야.
  //     fork IPC 는 메시지 경계 내장이라 이 문제를 우회했다(0010). 실 소켓의 첫 현실 문제를 직접 자극.
  const msgs = [
    { hello: true, pid: 123, hostId: 'zone1' },
    { reqId: 0, cmd: 'deliver', items: [{ gi: 0, m: { from: 'gateway', to: 'zone1', payload: { type: 'move', d: { dx: 1, dy: -1 } } } }] },
    { reqId: 1, results: [{ gi: 5, sends: [{ from: 'zone1', to: 'gateway', payload: { type: 'view_delta', enter: [{ id: 'av1', x: 3, y: 9 }], exit: [], update: [] } }] }] },
    { reqId: 2, snap: { zone1: { kind: 'zone', ents: [['av1', { x: 1, y: 2 }], ['av2', { x: 7, y: 8 }]] } } },
  ];
  // 모든 프레임을 한 버퍼로 이어붙인 뒤, *1바이트씩* 흘려 넣어 재조립(가장 가혹한 분할 — 부분 헤더 포함).
  const big = Buffer.concat(msgs.map(m => frameOf(m).buf));
  const got = [];
  const framer = new Framer((o) => got.push(o));
  for (let i = 0; i < big.length; i++) framer.push(big.subarray(i, i + 1));
  const okReassembleByte = JSON.stringify(got) === JSON.stringify(msgs);
  check(okReassembleByte, `1바이트 분할 재조립 불일치(${got.length}/${msgs.length} 프레임)`);
  // 여러 프레임이 한 청크에 뭉쳐 와도(병합) 정확히 분해돼야.
  const got2 = [];
  const framer2 = new Framer((o) => got2.push(o));
  framer2.push(big);  // 전체를 한 번에
  const okMerged = JSON.stringify(got2) === JSON.stringify(msgs);
  check(okMerged, `병합 청크 분해 불일치(${got2.length}/${msgs.length})`);
  // 임의 경계(헤더 중간·페이로드 중간)에서 끊어도 복원돼야.
  const got3 = [];
  const framer3 = new Framer((o) => got3.push(o));
  const cuts = [2, 7, 13, 30, 31, 100, 250];
  let prev = 0;
  for (const c of cuts) { if (c < big.length) { framer3.push(big.subarray(prev, c)); prev = c; } }
  framer3.push(big.subarray(prev));
  const okArb = JSON.stringify(got3) === JSON.stringify(msgs);
  check(okArb, `임의 경계 분할 재조립 불일치(${got3.length}/${msgs.length})`);
  console.log(`  프레이밍 재조립: 1바이트분할 ${okReassembleByte ? 'OK' : 'FAIL'} · 병합 ${okMerged ? 'OK' : 'FAIL'} · 임의경계 ${okArb ? 'OK' : 'FAIL'} (${msgs.length} 프레임)`);
  console.log('  → fork 의 메시지-프레임 IPC 가 아니라 *실 TCP 바이트 스트림 + 직접 프레이밍*임을 증명.');
}

// ── isolate: 프로세스 분리 — 각 서버 별 pid·broker 와 다름·통신은 실 TCP 소켓 프레임뿐 ──
async function isolate(seeds) {
  console.log('== isolate: 각 서버 박스가 *구분되는 OS 프로세스*(pid)·broker 와도 다름 · 통신=실 TCP 소켓 프레임뿐(공유 메모리 0) ==');
  const seed = seeds[0];
  const b = await runMulti(FAILS(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(C.pids.every(p => p !== C.parentPid), `자식 pid 가 broker(${C.parentPid})와 같음 — 분리 위반`) &&
    check(C.frames > 0 && C.framesIn > 0, `소켓 프레임 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터(함수·순환·공유 참조) 존재`);
  console.log(`  broker pid ${C.parentPid}(TCP :${C.port}) · 호스트 ${C.hostIds.length}개 · 구분 pid ${pidSet.size}개 · 소켓 out ${C.frames}프레임/${C.socketBytes}B · in ${C.framesIn}프레임/${C.socketBytesIn}B · 양방향 직렬화 ${C.allSerializable}`);
  console.log('  배치(addr → host → pid):');
  const hostPid = new Map(C.hostIds.map((h, i) => [h, C.pids[i]]));
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(9)} → ${host.padEnd(9)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 멀티프로세스(서버간 소켓) 후에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 멀티프로세스(서버간 소켓) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...FAILS(seed), clients: 4 });
    const clientMsgs = r.net.log.filter(m => m.from.startsWith('client') || m.to.startsWith('client'));
    let badAddr = 0, leaks = 0;
    for (const m of clientMsgs) {
      const peer = m.from.startsWith('client') ? m.to : m.from;
      if (!PUBLIC_ADDRS.includes(peer) && !peer.startsWith('client')) badAddr++;
      const probe = JSON.stringify(m.payload);
      if (/zone/i.test(probe) || /registry/i.test(probe) || /orch/i.test(probe) || /sessionId/.test(probe) || /"S\d+"/.test(probe) ||
          /handoff/i.test(probe) || /ghost/i.test(probe) || /lease/i.test(probe) || /promote/i.test(probe) || /relink/i.test(probe)) leaks++;
    }
    const viewed = r.clients.filter(c => c.views > 0).length;
    const ok =
      check(badAddr === 0, `seed ${seed}: 비공개 주소 직접 통신 ${badAddr}건`) &&
      check(leaks === 0, `seed ${seed}: 내부 토폴로지 누설 ${leaks}건`) &&
      check(viewed === r.clients.length, `seed ${seed}: 뷰 받은 클라 ${viewed}/${r.clients.length}`);
    console.log(`${pad(seed, 6)} | ${pad(clientMsgs.length, 8)} | ${pad(badAddr, 10)} | ${pad(leaks, 4)} | ${pad(viewed + '/' + r.clients.length, 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

// ── repro: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(소켓이 결정론을 안 깸) ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(실 소켓이 결정론을 안 깸) ==');
  console.log('seed   | full 다이제스트 | 멀티 2회 동일 | 인프로세스 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const cfg = FAILS(seed);
    const inp = run(cfg);
    const m1 = await runMulti(cfg);
    const m2 = await runMulti(cfg);
    const d1 = fullDigest(m1), d2 = fullDigest(m2), di = fullDigest(inp);
    digests.add(d1);
    const ok =
      check(d1 === d2, `seed ${seed}: 멀티 2회 상태 다름 (${hex(d1)} != ${hex(d2)})`) &&
      check(d1 === di, `seed ${seed}: 멀티 != 인프로세스 (${hex(d1)} != ${hex(di)})`);
    console.log(`${pad(seed, 6)} | ${hex(d1)}      | ${(d1 === d2 ? 'OK' : 'FAIL').padEnd(12)} | ${(d1 === di ? 'OK' : 'FAIL').padEnd(14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 실 TCP 소켓 전송 — 각 서버 별 OS 프로세스·길이-프리픽스 프레임 소켓으로 통신, 인프로세스와 비트 동일(E2E 동치) ==');
  for (const seed of seeds) {
    const a = run(FAILS(seed));
    const b = await runMulti(FAILS(seed));
    const ok = logDigest(a) === logDigest(b) && fullDigest(a) === fullDigest(b) && finalLiveDesync(b) === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${b.cluster.pids.length}개 · TCP :${b.cluster.port} · 프레임 ${b.cluster.frames} · log동일 ${logDigest(a) === logDigest(b)} · full동일 ${fullDigest(a) === fullDigest(b)} · 승격 ${b.totals.promotions} · desync ${finalLiveDesync(b)} | ${hex(fullDigest(b))}`);
  }
  console.log('와이어 = child_process.spawn(IPC 0) + 실 TCP 소켓 + 길이-프리픽스 프레이밍 · 인프로세스 모드면 0010 비트 동일');
}

// ── CLI ──
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  const ASYNC = { e2e, wire, isolate, hide, repro };
  if (mode === 'reg') reg(seedArg);
  else if (ASYNC[mode]) await ASYNC[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    await wire(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | wire | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
