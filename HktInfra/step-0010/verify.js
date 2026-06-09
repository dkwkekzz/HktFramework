// HktInfra step-0010 — 헤드리스 검증 (프로세스 경계 현실화·원격 멀티프로세스 E2E)
// 사용: node step-0010/verify.js <mode> [seed]
//   mode: reg | e2e | isolate | hide | repro | all
//     reg     — 회귀 0: 인프로세스 모드(전송 seam 교체 OFF) → step-0009 와 *비트 동일*(net.log + 상태).
//               zones 1·2 · recovery off/on · failover off/on(+death). 전송 seam 현실화가 *비-침습*임을 증명.
//     e2e     — E2E 동치: 멀티프로세스(각 서버 별 OS 프로세스·IPC) 실행이 인프로세스와 *비트 동일*(logDigest +
//               fullDigest) + 승격 수 일치 + 최종 desync 0. 전송 seam(IPC)이 *의미를 보존*함을 증명(가설 핵심).
//     isolate — 프로세스 분리: 각 서버가 *구분되는 OS 프로세스*(pid)에 살고 broker 와도 다른 프로세스 ·
//               통신은 *직렬화 IPC 메시지뿐*(공유 메모리 0·전 메시지 직렬화 가능). 배치표(addr→host→pid) 출력.
//     hide    — 은닉: 멀티프로세스(서버간 IPC) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 누설 0.
//     repro   — 재현: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(프로세스 갈려도 결정론).
// 모든 수치는 시드 [42, 7, 1234, 99, 2026]. 문서의 수치 = 이 출력.
'use strict';
const NET = require('./net-core.js');
const { run, runMulti, fnv1a, ownerOf, globalAoiTruth, PUBLIC_ADDRS } = NET;
const NET9 = require('../step-0009/net-core.js');   // reg 대조용(직전 step)

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

// ── reg: 인프로세스 0010 → 0009 비트 동일(전송 seam 교체 비-침습) ──
function reg(seeds) {
  console.log('== reg: 인프로세스 모드(전송 seam OFF) → step-0009 와 비트 동일(net.log + 상태). 전송 seam 현실화 = 비-침습 ==');
  console.log('seed   | zones | rec | fo  | 0009 logHash | 0010(inproc) | log동일 | 상태동일 | 판정');
  for (const seed of seeds) {
    const cfgs = [
      { zones: 1, recovery: false, failover: false },
      { zones: 2, recovery: false, failover: false },
      { zones: 2, recovery: true, failover: false },
      { zones: 2, recovery: true, failover: true, deathTick: DEATH, leaseTimeout: LEASE },
    ];
    for (const c of cfgs) {
      const p = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, ...c };
      const r9 = NET9.run(p);
      const r10 = run({ ...p });
      const okL = logDigest(r9) === logDigest(r10), okS = stateDigest(r9) === stateDigest(r10);
      check(okL, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: net.log 다름`);
      check(okS, `seed ${seed} zones${c.zones} rec${c.recovery} fo${!!c.failover}: 상태 다름`);
      console.log(`${pad(seed, 6)} | ${pad(c.zones, 5)} | ${(c.recovery ? 'on ' : 'off')} | ${(c.failover ? 'on ' : 'off')} | ${hex(logDigest(r9))}   | ${hex(logDigest(r10))}    | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okS ? '예' : '아니오').padEnd(8)} | ${okL && okS ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── e2e: 멀티프로세스 = 인프로세스 비트 동일(전송 seam 이 의미 보존) ──
async function e2e(seeds) {
  console.log('== e2e: 멀티프로세스(각 서버 별 OS 프로세스·IPC) = 인프로세스 *비트 동일*(logDigest+fullDigest)·승격 일치·desync 0 ==');
  console.log('seed   | 시나리오 | 프로세스 | log동일 | full동일 | 승격(in/멀티) | 멀티 desync | 판정');
  for (const seed of seeds) {
    for (const [name, cfg] of [['basic', BASIC(seed)], ['failover', FAILS(seed)]]) {
      const a = run(cfg);
      const b = await runMulti(cfg);
      const okL = logDigest(a) === logDigest(b);
      const okF = fullDigest(a) === fullDigest(b);
      const okP = a.totals.promotions === b.totals.promotions;
      const dB = finalLiveDesync(b);
      const ok =
        check(okL, `seed ${seed} ${name}: net.log 다름(전송 seam 의미 깨짐)`) &&
        check(okF, `seed ${seed} ${name}: full 상태 다름`) &&
        check(okP, `seed ${seed} ${name}: 승격 수 다름(${a.totals.promotions} vs ${b.totals.promotions})`) &&
        check(dB === 0, `seed ${seed} ${name}: 멀티프로세스 최종 desync ${dB}(수렴 깨짐)`);
      console.log(`${pad(seed, 6)} | ${name.padEnd(8)} | ${pad(b.cluster.pids.length, 8)} | ${(okL ? '예' : '아니오').padEnd(6)} | ${(okF ? '예' : '아니오').padEnd(7)} | ${pad(a.totals.promotions + '/' + b.totals.promotions, 12)} | ${pad(dB, 11)} | ${ok ? 'OK' : 'FAIL'}`);
    }
  }
}

// ── isolate: 프로세스 분리 — 각 서버 별 pid·broker 와 다름·통신은 직렬화 IPC 뿐(공유 메모리 0) ──
async function isolate(seeds) {
  console.log('== isolate: 각 서버 박스가 *구분되는 OS 프로세스*(pid)·broker 와도 다름 · 통신=직렬화 IPC 메시지뿐(공유 메모리 0) ==');
  const seed = seeds[0];
  const b = await runMulti(FAILS(seed));
  const C = b.cluster;
  const pidSet = new Set(C.pids);
  const ok =
    check(pidSet.size === C.hostIds.length, `호스트 수(${C.hostIds.length}) != 구분 pid 수(${pidSet.size}) — 프로세스 미분리`) &&
    check(C.pids.every(p => p !== C.parentPid), `자식 pid 가 broker(${C.parentPid})와 같음 — 분리 위반`) &&
    check(C.ipcMsgs > 0, `IPC 메시지 0 — 직렬화 통신 안 함`) &&
    check(C.allSerializable, `경계 넘는 메시지에 비직렬화 데이터(함수·순환·공유 참조) 존재`);
  console.log(`  broker pid ${C.parentPid} · 호스트 ${C.hostIds.length}개 · 구분 pid ${pidSet.size}개 · IPC 메시지 ${C.ipcMsgs}건 / ${C.ipcBytes} bytes · 전부 직렬화 가능 ${C.allSerializable}`);
  console.log('  배치(addr → host → pid):');
  const hostPid = new Map(C.hostIds.map((h, i) => [h, C.pids[i]]));
  for (const [addr, host] of C.placement) console.log(`    ${addr.padEnd(9)} → ${host.padEnd(9)} → pid ${hostPid.get(host)}`);
  check(ok, 'isolate');
}

// ── hide: 멀티프로세스(서버간 IPC) 후에도 클라는 게이트웨이만·내부 누설 0 ──
async function hide(seeds) {
  console.log('== hide: 멀티프로세스(서버간 IPC) 후에도 클라 접점 = 공개 주소(login·gateway)뿐 · 내부 토폴로지 누설 0 ==');
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

// ── repro: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(프로세스 갈려도 결정론) ──
async function repro(seeds) {
  console.log('== repro: 같은 시드 멀티프로세스 2회 → 같은 상태 + 인프로세스와도 동일(프로세스 분리가 결정론을 깨지 않음) ==');
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
  console.log('== summary: 프로세스 경계 현실화 — 각 서버 별 OS 프로세스·IPC 로 통신, 인프로세스와 비트 동일(E2E 동치) ==');
  for (const seed of seeds) {
    const a = run(FAILS(seed));
    const b = await runMulti(FAILS(seed));
    const ok = logDigest(a) === logDigest(b) && fullDigest(a) === fullDigest(b) && finalLiveDesync(b) === 0;
    if (!ok) FAILED = true;
    console.log(`  seed ${pad(seed, 4)}: 프로세스 ${b.cluster.pids.length}개 · IPC ${b.cluster.ipcMsgs}건 · log동일 ${logDigest(a) === logDigest(b)} · full동일 ${fullDigest(a) === fullDigest(b)} · 승격 ${b.totals.promotions} · desync ${finalLiveDesync(b)} | ${hex(fullDigest(b))}`);
  }
  console.log('프로세스 경계 = host 태그를 child_process IPC(직렬화 메시지·공유 메모리 0)로 현실화 · 인프로세스 모드면 0009 비트 동일');
}

// ── CLI ──
(async () => {
  const mode = process.argv[2] || 'all';
  const seedArg = process.argv[3] ? [parseInt(process.argv[3], 10)] : SEEDS;
  const ASYNC = { e2e, isolate, hide, repro };
  if (mode === 'reg') reg(seedArg);
  else if (ASYNC[mode]) await ASYNC[mode](seedArg);
  else if (mode === 'all') {
    reg(seedArg); console.log('');
    await e2e(seedArg); console.log('');
    await isolate(seedArg); console.log('');
    await hide(seedArg); console.log('');
    await repro(seedArg); console.log('');
    await summary(seedArg);
  } else { console.log('mode: reg | e2e | isolate | hide | repro | all'); process.exit(2); }

  console.log('');
  console.log(FAILED ? '결과: FAIL' : '결과: ALL OK');
  process.exit(FAILED ? 1 : 0);
})();
