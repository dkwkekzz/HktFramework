// HktInfra step-0439 — 헤드리스 검증 (#4 진짜 비동기 9: 인과 회계·exactly-once)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `asyncaccount`.
//   더한 한 조각: async-core.js — accountDelivered(배달열 vs 전체 집합 대조→emitted/applied/dups/missing/complete).
//   순열+손실 교란 R회 시행 전부 정확히-한-번(applied==emitted·dups0·missing0)·다이제스트 불변(==정전). run() 미호출 → reg 0.
//   검증: ⒜ `reg`. ⒝ `asyncaccount` — R 시행 전부 complete·손실 발생(resyncs>0)·digest 전부 정전 일치.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

const siteOf = e => (typeof e.site === 'number' ? e.site : parseInt(String(e.site).replace(/^s/, ''), 10));

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
function arrivalFor(events, nsites, rnd) {
  const queues = Array.from({ length: nsites }, () => []);
  for (const e of events) queues[siteOf(e)].push(e);
  const out = []; let rem = events.length;
  while (rem > 0) {
    let s = rnd() % nsites;
    for (let k = 0; k < nsites && queues[s].length === 0; k++) s = (s + 1) % nsites;
    out.push(queues[s].shift()); rem--;
  }
  return out;
}
// 한 시행: 순열 도착 + ~20% 손실 + 재전송 → { delivered, resyncs }.
function trial(events, N, rnd) {
  const site = NET.makeResyncSite(N);
  const arrival = arrivalFor(events, N, rnd);
  const dropped = [];
  for (const e of arrival) { if (rnd() % 5 === 0) dropped.push(e); else site.receive(e); }
  for (const e of shuffle(dropped, rnd)) site.resync(e);
  const delivered = site.finish();
  return { delivered, resyncs: site.resyncs(), digest: NET.applyDigest(delivered) };
}

// step-0439 #4 진짜 비동기 9 — asyncaccount: 인과 회계. 순열+손실 R 시행 전부 정확히-한-번(complete)·손실 발생·다이제스트 불변.
function asyncaccount(seeds) {
  console.log('== asyncaccount (0439·#4): 인과 회계 — 순열+손실 R 시행 전부 exactly-once(complete)·다이제스트 불변(정전) ==');
  console.log('seed   | 이벤트 | 시행 | complete | dups | missing | 손실발생 | digest불변 | 판정');
  for (const seed of seeds) {
    const N = 4, R = 5;
    const events = NET.withSseq(NET.lamportExchange(seed, { sites: N, rounds: 52 }).events);
    const canonical = NET.applyDigest(NET.totalOrder(events));
    let allComplete = true, dupSum = 0, missSum = 0, lossy = true, digInv = true;
    for (let t = 0; t < R; t++) {
      const r = trial(events, N, NET.mulberry32((seed ^ (0x7000 + t * 31)) >>> 0));
      const acc = NET.accountDelivered(r.delivered, events);
      allComplete = allComplete && acc.complete;
      dupSum += acc.dups; missSum += acc.missing;
      if (r.resyncs === 0) lossy = false;
      if (r.digest !== canonical) digInv = false;
    }
    const ok = check(allComplete && dupSum === 0 && missSum === 0 && lossy && digInv,
      `seed ${seed}: complete ${allComplete}·dups ${dupSum}·miss ${missSum}·lossy ${lossy}·digInv ${digInv}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(R, 4)} | ${pad(allComplete ? 'Y' : 'N', 8)} | ${pad(dupSum, 4)} | ${pad(missSum, 7)} | ${pad(lossy ? 'Y' : 'N', 8)} | ${pad(digInv ? 'Y' : 'N', 10)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['asyncaccount'] = asyncaccount;
kit.ORDER.splice(1, 0, 'asyncaccount');

(async () => { process.exit(await kit.cli(process.argv)); })();
