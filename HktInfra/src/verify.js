// HktInfra step-0437 — 헤드리스 검증 (#4 진짜 비동기 7: 배리어-free 진행)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `asyncprogress`.
//   더한 한 조각: async-core.js — makeAsyncSite(receive 도착/tick 진행 분리). M 복제 site 가 *서로 다른 속도*로 불균등 전진
//   (진행 skew>0=비-lockstep)해도 최종 다이제스트는 페이스 무관·전부 수렴(==정전). run() 미호출 → reg 0.
//   검증: ⒜ `reg`. ⒝ `asyncprogress` — 불균등 스케줄 중 skew>0·최종 전부 같은 다이제스트==정전.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

const siteOf = e => (typeof e.site === 'number' ? e.site : parseInt(String(e.site).replace(/^s/, ''), 10));

// 한 복제의 도착열(사이트별 FIFO·교차 site 임의 인터리빙).
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

// step-0437 #4 진짜 비동기 7 — asyncprogress: 배리어-free. M 복제가 불균등 속도(진행 skew>0=비-lockstep)로 굴러도 최종 desync 0·정전 일치.
function asyncprogress(seeds) {
  console.log('== asyncprogress (0437·#4): 배리어-free 진행 — M 복제 불균등 속도(skew>0=비-lockstep)·최종 desync 0·정전 일치 ==');
  console.log('seed   | 이벤트 | 진행skew | 전부수렴 | 정전일치 | 판정');
  for (const seed of seeds) {
    const N = 4, M = 3;
    const { events } = NET.lamportExchange(seed, { sites: N, rounds: 48 });
    const canonical = NET.applyDigest(NET.totalOrder(events));
    const sched = NET.mulberry32((seed ^ 0x5EED) >>> 0);
    const sites = [], arrivals = [], cursor = new Array(M).fill(0);
    for (let m = 0; m < M; m++) { sites.push(NET.makeAsyncSite(N)); arrivals.push(arrivalFor(events, N, NET.mulberry32((seed ^ (0x100 + m)) >>> 0))); }
    // 불균등 스케줄: 매 라운드 임의 복제를 골라 1..4 보 전진(receive+tick) — round-robin lockstep 아님.
    let maxSkew = 0, alive = true;
    while (alive) {
      const m = sched() % M;
      const burst = 1 + (sched() % 4);
      for (let b = 0; b < burst; b++) {
        if (cursor[m] < arrivals[m].length) { sites[m].receive(arrivals[m][cursor[m]++]); }
        sites[m].tick();
      }
      const applied = sites.map(s => s.appliedN());
      maxSkew = Math.max(maxSkew, Math.max(...applied) - Math.min(...applied));
      alive = sites.some((s, i) => cursor[i] < arrivals[i].length || s.pending() > 0);
    }
    const digs = sites.map(s => (s.finish(), s.digest()));
    const allConv = digs.every(d => d === digs[0]);
    const canon = digs[0] === canonical;
    const ok = check(allConv && canon && maxSkew > 0, `seed ${seed}: conv ${allConv}·canon ${canon}·skew ${maxSkew}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(maxSkew, 8)} | ${pad(allConv ? 'Y' : 'N', 8)} | ${pad(canon ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['asyncprogress'] = asyncprogress;
kit.ORDER.splice(1, 0, 'asyncprogress');

(async () => { process.exit(await kit.cli(process.argv)); })();
