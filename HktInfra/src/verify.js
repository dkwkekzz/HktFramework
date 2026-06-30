// HktInfra step-0436 — 헤드리스 검증 (#4 진짜 비동기 6: async 수렴 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `asyncconv`.
//   더한 한 조각: async-core.js — applyDigest(배달열 순차 fold→상태 다이제스트). 두 site 가 *서로 다른 물리 도착 순열*을
//   각자 makeHoldback 으로 재구성·적용 → 같은 다이제스트(== 정전 전순서 다이제스트) = desync 0(lockstep 없이 수렴). run() 미호출 → reg 0.
//   검증: ⒜ `reg`. ⒝ `asyncconv` — siteA·siteB 다이제스트 일치·정전 일치·도착 순열은 실제로 상이.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

const siteOf = e => (typeof e.site === 'number' ? e.site : parseInt(String(e.site).replace(/^s/, ''), 10));

// site 별 발신순(FIFO) 보존·교차 site 임의 인터리빙으로 holdback 에 먹여 배달열 반환.
function deliverVia(events, nsites, rnd) {
  const queues = Array.from({ length: nsites }, () => []);
  for (const e of events) queues[siteOf(e)].push(e);
  const hb = NET.makeHoldback(nsites);
  let remaining = events.length;
  const arrivalIds = [];
  while (remaining > 0) {
    let s = rnd() % nsites;
    for (let k = 0; k < nsites && queues[s].length === 0; k++) s = (s + 1) % nsites;
    const e = queues[s].shift(); arrivalIds.push(e.id); hb.offer(e); remaining--;
  }
  return { delivered: hb.close(), arrivalSig: NET._h(arrivalIds.join(',')) };
}

// step-0436 #4 진짜 비동기 6 — asyncconv: 두 site 서로 다른 도착 순열→각자 holdback 재구성→같은 다이제스트(desync 0)·정전 일치.
function asyncconv(seeds) {
  console.log('== asyncconv (0436·#4): async 수렴 — 두 site 상이 도착 순열→각자 holdback→같은 상태 다이제스트(desync 0) ==');
  console.log('seed   | 이벤트 | 도착상이 | digestA==B | 정전일치 | desync | 판정');
  for (const seed of seeds) {
    const N = 4;
    const { events } = NET.lamportExchange(seed, { sites: N, rounds: 42 });
    const canonical = NET.applyDigest(NET.totalOrder(events));
    const rndA = NET.mulberry32((seed ^ 0xA1) >>> 0), rndB = NET.mulberry32((seed ^ 0xB2) >>> 0);
    const a = deliverVia(events, N, rndA), b = deliverVia(events, N, rndB);
    const dA = NET.applyDigest(a.delivered), dB = NET.applyDigest(b.delivered);
    const distinctArrival = a.arrivalSig !== b.arrivalSig;
    const converged = dA === dB && dA === canonical;
    const ok = check(converged && distinctArrival, `seed ${seed}: dA ${dA.toString(16)}·dB ${dB.toString(16)}·canon ${canonical.toString(16)}·distinct ${distinctArrival}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(distinctArrival ? 'Y' : 'N', 8)} | ${pad(dA === dB ? 'Y' : 'N', 10)} | ${pad(dA === canonical ? 'Y' : 'N', 8)} | ${pad(dA === dB ? 0 : 1, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['asyncconv'] = asyncconv;
kit.ORDER.splice(1, 0, 'asyncconv');

(async () => { process.exit(await kit.cli(process.argv)); })();
