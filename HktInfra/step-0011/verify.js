// HktInfra step-0011 — 헤드리스 검증 (실 네트워크 소켓 전송 현실화 · 와이어만 교체)
// 사용: node step-0011/verify.js <mode> [seed]
//   mode: reg | sock | isolate | hide | repro | all
//     reg     — 회귀 0: 인프로세스 모드(와이어 OFF) → step-0010 와 *비트 동일*(net.log + 상태).
//               zones 1·2 · recovery off/on · failover off/on(+death). 채널 추상화·와이어 교체가 *비-침습*임을 증명.
//     sock    — 실 전송 동치: 멀티프로세스가 *실 TCP 소켓*(net.connect·길이-프리픽스 프레이밍)으로 통신해도
//               인프로세스와 *비트 동일*(logDigest + fullDigest) — IPC 와이어(0010)·TCP 와이어(0011) 둘 다 == 인프로세스.
//               승격 일치 + 최종 desync 0. 실 소켓 전송이 *의미를 보존*함을 증명(가설 핵심).
//     isolate — 프로세스 분리(소켓): 각 서버가 구분 pid·broker 와 다름 · 통신은 *실 TCP 소켓*(broker listen 포트 +
//               호스트별 구분 remote 포트) · 길이-프리픽스 프레임으로 바이트 스트림 재조립 · 전 메시지 직렬화 가능.
//     hide    — 은닉: 실 소켓 전송(서버간) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 누설 0.
//     repro   — 재현: 같은 시드 TCP 소켓 2회 → 같은 상태 + 인프로세스와도 동일(와이어 갈려도 결정론).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, ownerOf, globalAoiTruth, PUBLIC_ADDRS } = NET;
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
// 전송 열화(손실·지연·재정렬·중복) ON — transport 모델은 broker substrate 에 사니(routeFilter=broker-local 함수),
// TCP 소켓 위에서도 *같은 손실 패턴*(같은 transport 시드)을 겪어 인프로세스와 비트 동일해야(와이어 교체가 의미 보존).
const TRANS = (seed) => ({ ...BASIC(seed), ticks: 60, transport: { seed: (seed ^ 0xABCD) >>> 0, delayMin: 0, delayMax: 2, loss: 0.2, redundancy: 3, routeFilter: NET.routeFilters.both } });

// ── reg: 인프로세스 0011 → 0010 비트 동일(채널 추상화·와이어 교체 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(와이어 OFF) → step-0010 와 비트 동일(net.log + 상태). 채널 추상화·와이어 교체 = 비-침습 ==');
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

// ── sock: 멀티프로세스(IPC 와이어·TCP 소켓 와이어) = 인프로세스 비트 동일(실 전송이 의미 보존) ──
async function sock(seeds) {
  console.log('== sock: 멀티프로세스가 *실 TCP 소켓*(길이-프리픽스 프레이밍)으로 통신해도 인프로세스와 *비트 동일* ==');
  console.log('   (대조: IPC 와이어=0010 · TCP 와이어=0011 둘 다 == 인프로세스. logDigest+fullDigest·승격·desync 0)');
  console.log('seed   | 시나리오 | proc | port  | ipc==in | tcp==in | full==in | 승격(in/tcp) | tcp desync | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic', BASIC(seed)], ['transport', TRANS(seed)], ['failover', FAILS(seed)]]) {
      const a = run(cfg);
      const i = await runMulti({ ...cfg, channel: 'ipc' });
      const t = await runMulti({ ...cfg, channel: 'tcp' });
      const okI = logDigest(a) === logDigest(i);
      const okT = logDigest(a) === logDigest(t);
      const okF = fullDigest(a) === fullDigest(t) && fullDigest(a) === fullDigest(i);
      const okP = a.totals.promotions === t.totals.promotions && a.totals.promotions === i.totals.promotions;
      const dT = finalLiveDesync(t);
      const ok =
        check(okI, `seed ${seed} ${name}: IPC 와이어 net.log 다름(0010 회귀)`) &&
        check(okT, `seed ${seed} ${name}: TCP 소켓 net.log 다름(실 전송 의미 깨짐)`) &&
        check(okF, `seed ${seed} ${name}: full 상태 다름`) &&
        check(okP, `seed ${seed} ${name}: 승격 수 다름`) &&
        check(dT === 0, `seed ${seed} ${name}: TCP 소켓 최종 desync ${dT}(수렴 깨짐)`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(8)} | ${pad(t.cluster.pids.length, 4)} | ${pad(t.cluster.port, 5)} | ${(okI ? '예' : '아니오').padEnd(6)} | ${(okT ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(a.totals.promotions + '/' + t.totals.promotions, 12)} | ${pad(dT, 10)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── isolate: 프로세스 분리 — 각 서버 별 pid·broker 와 다름·통신은 실 TCP 소켓(프레이밍)뿐 ──
async function isolate(seeds) {
  console.log('== isolate: 각 서버 = 구분 OS 프로세스(pid)·broker 와 다름 · 통신=*실 TCP 소켓*(broker 포트 + 호스트별 구분 remote 포트·길이-프리픽스 프레임) ==');
  const seed = seeds[0];
  const b = await runMulti({ ...FAILS(seed), channel: 'tcp' });
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const remoteSet = new Set(C.remotePorts);
  const ok =
    check(C.channel === 'tcp', `채널이 tcp 아님(${C.channel})`) &&
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(C.pids.every(p => p !== C.parentPid), `자식 pid 가 broker(${C.parentPid})와 같음 — 분리 위반`) &&
    check(C.port > 0, `broker listen 포트 없음 — 실 소켓 아님`) &&
    check(remoteSet.size === C.hostIds.length, `호스트별 구분 소켓(remote 포트) 아님(${remoteSet.size}/${C.hostIds.length})`) &&
    check(C.ipcMsgs > 0 && C.ipcMsgsIn > 0, `소켓 메시지 0 — 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지(양방향)에 비직렬화 데이터(함수·순환·공유 참조) 존재`);
  console.log(`  broker pid ${C.parentPid} · listen 127.0.0.1:${C.port} · 호스트 ${C.hostIds.length}개 · 구분 pid ${pidSet.size}개 · 구분 소켓(remote 포트) ${remoteSet.size}개`);
  console.log(`  소켓 와이어: out ${C.ipcMsgs}프레임/${C.ipcBytes}B · in ${C.ipcMsgsIn}프레임/${C.ipcBytesIn}B(실제 바이트=헤더4+본문) · 양방향 직렬화 가능 ${C.allSerializable}`);
  console.log('  배치(addr → host → pid):');
  const hostPid = new Map(C.hostIds.map((h, i) => [h, C.pids[i]]));
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(9)} → ${host.padEnd(9)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 실 소켓 전송(서버간) 후에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 실 TCP 소켓 전송(서버간) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
  console.log('seed   | 클라접점 | 비공개주소 | 누설 | 뷰 받은 클라 | 판정');
  for (const seed of seeds) {
    const r = await runMulti({ ...FAILS(seed), clients: 4, channel: 'tcp' });
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

// ── repro: 같은 시드 TCP 소켓 2회 → 같은 상태 + 인프로세스와도 동일(와이어 갈려도 결정론) ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 TCP 소켓 2회 → 같은 상태 + 인프로세스와도 동일(와이어 교체가 결정론을 깨지 않음) ==');
  console.log('seed   | full 다이제스트 | TCP 2회 동일 | 인프로세스 동일 | 판정');
  const digests = new Set();
  for (const seed of seeds) {
    const cfg = FAILS(seed);
    const inp = run(cfg);
    const m1 = await runMulti({ ...cfg, channel: 'tcp' });
    const m2 = await runMulti({ ...cfg, channel: 'tcp' });
    const d1 = fullDigest(m1), d2 = fullDigest(m2), di = fullDigest(inp);
    digests.add(d1);
    const ok =
      check(d1 === d2, `seed ${seed}: TCP 2회 상태 다름 (${hex(d1)} != ${hex(d2)})`) &&
      check(d1 === di, `seed ${seed}: TCP != 인프로세스 (${hex(d1)} != ${hex(di)})`);
    console.log(`${pad(seed, 6)} | ${hex(d1)}      | ${(d1 === d2 ? 'OK' : 'FAIL').padEnd(12)} | ${(d1 === di ? 'OK' : 'FAIL').padEnd(14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  check(digests.size === seeds.length, `시드별 상태 충돌(서로 달라야): ${digests.size}/${seeds.length}`);
}

// ── summary ──
async function summary(seeds) {
  console.log('== summary: 실 네트워크 소켓 전송 현실화 — broker↔host 가 TCP 소켓으로 통신, 인프로세스와 비트 동일(실 전송 동치) ==');
  for (const seed of seeds) {
    const a = run(FAILS(seed));
    const b = await runMulti({ ...FAILS(seed), channel: 'tcp' });
    const ok = logDigest(a) === logDigest(b) && fullDigest(a) === fullDigest(b) && finalLiveDesync(b) === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${b.cluster.pids.length}개 · TCP 127.0.0.1:${b.cluster.port} · 소켓 ${b.cluster.ipcMsgs}프레임 · log동일 ${logDigest(a) === logDigest(b)} · full동일 ${fullDigest(a) === fullDigest(b)} · 승격 ${b.totals.promotions} · desync ${finalLiveDesync(b)} | ${hex(fullDigest(b))}`);
  }
  console.log('와이어 = broker↔host 를 child_process IPC 파이프 → 실 TCP 소켓(길이-프리픽스 프레이밍)으로 현실화 · 인프로세스 모드면 0010 비트 동일');
}

// ── CLI ──
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  const ASYNC = { sock, isolate, hide, repro };
  if (mode === 'reg') reg(seedArg);
  else if (ASYNC[mode]) await ASYNC[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await sock(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | sock | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
