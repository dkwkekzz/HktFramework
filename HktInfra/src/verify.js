// HktInfra step-0434 — 헤드리스 검증 (#4 진짜 비동기 4: holdback 재정렬 버퍼)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `lcreorder`.
//   더한 한 조각: async-core.js — makeHoldback(nsites): 교차-site 재정렬 도착(사이트별 FIFO)에서 low-water-mark 안정성으로
//   전순서 점진 방출. 어떤 인터리빙이든 방출열 == totalOrder(전체)·일부는 close 이전 방출(진짜 holdback). run() 미호출 → reg 0.
//   검증: ⒜ `reg`. ⒝ `lcreorder` — P 인터리빙 전부 같은 방출 sig == 정전 전순서·close 이전 방출>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

const siteOf = e => (typeof e.site === 'number' ? e.site : parseInt(String(e.site).replace(/^s/, ''), 10));

// 이벤트를 site 별 발신순(FIFO) 큐로 나눈 뒤, 시드 PRNG 로 site 를 골라 한 발씩 offer — 사이트별 FIFO 보존·교차 site 임의 인터리빙.
function interleaveFIFO(events, nsites, rnd, hb) {
  const queues = Array.from({ length: nsites }, () => []);
  for (const e of events) queues[siteOf(e)].push(e);   // events 는 발신순 → 큐도 발신순
  let remaining = events.length;
  while (remaining > 0) {
    let s = rnd() % nsites;
    for (let k = 0; k < nsites && queues[s].length === 0; k++) s = (s + 1) % nsites;
    hb.offer(queues[s].shift());
    remaining--;
  }
  return hb.close();
}

// step-0434 #4 진짜 비동기 4 — lcreorder: holdback 재정렬. 6 인터리빙 전부 같은 방출 sig==정전 전순서·close 이전 방출>0.
function lcreorder(seeds) {
  console.log('== lcreorder (0434·#4): holdback 재정렬 — P 인터리빙 전부 같은 방출열 == 전순서·일부 close 이전 방출 ==');
  console.log('seed   | 이벤트 | 인터리빙 | 동일==전순서 | close前방출 | 판정');
  for (const seed of seeds) {
    const N = 4;
    const { events } = NET.lamportExchange(seed, { sites: N, rounds: 40 });
    const canonical = NET.orderSig(NET.totalOrder(events));
    const rnd = NET.mulberry32((seed ^ 0xC0FFEE) >>> 0);
    const P = 6;
    let same = true, minBefore = Infinity;
    for (let p = 0; p < P; p++) {
      const hb = NET.makeHoldback(N);
      interleaveFIFO(events, N, rnd, hb);
      if (hb.sig() !== canonical) same = false;
      minBefore = Math.min(minBefore, hb.beforeCloseCount());
    }
    const ok = check(same && minBefore > 0, `seed ${seed}: same ${same}·minBefore ${minBefore}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(P, 8)} | ${pad(same ? 'Y' : 'N', 12)} | ${pad(minBefore, 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['lcreorder'] = lcreorder;
kit.ORDER.splice(1, 0, 'lcreorder');

(async () => { process.exit(await kit.cli(process.argv)); })();
