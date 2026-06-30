// HktInfra step-0438 — 헤드리스 검증 (#4 진짜 비동기 8: 손실 하 gap-resync 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `asynclossy`.
//   더한 한 조각: async-core.js — withSseq(per-source 연속 시퀀스)·makeResyncSite(연속분만 holdback 에 넘김·hole 감지·재전송 채움).
//   도착 중 ~20% 손실→갭 검출(gaps≥1)→재전송 resync(resyncs≥1)→홀 채워 전부 배달·desync 0(digest==정전). run() 미호출 → reg 0.
//   검증: ⒜ `reg`. ⒝ `asynclossy` — gaps≥1·resyncs≥1·전부 배달·정전 일치(손실 하 수렴).
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
// 사이트별 FIFO·교차 site 임의 인터리빙 도착열.
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

// step-0438 #4 진짜 비동기 8 — asynclossy: 손실 하 gap-resync. ~20% 손실→gaps≥1·resyncs≥1→재전송 채움→전부 배달·desync 0.
function asynclossy(seeds) {
  console.log('== asynclossy (0438·#4): 손실 하 gap-resync — ~20% 손실→갭 검출·재전송→전부 배달·desync 0(정전 일치) ==');
  console.log('seed   | 이벤트 | 손실 | gaps | resyncs | 배달 | 정전 | 판정');
  for (const seed of seeds) {
    const N = 4;
    const base = NET.lamportExchange(seed, { sites: N, rounds: 50 });
    const events = NET.withSseq(base.events);
    const canonical = NET.applyDigest(NET.totalOrder(events));
    const rnd = NET.mulberry32((seed ^ 0x1055) >>> 0);
    const arrival = arrivalFor(events, N, rnd);
    const site = NET.makeResyncSite(N);
    const dropped = [];
    for (const e of arrival) { if (rnd() % 5 === 0) { dropped.push(e); } else { site.receive(e); } }   // ~20% 손실
    for (const e of shuffle(dropped, rnd)) site.resync(e);                                              // 재전송(임의 순서)
    site.finish();
    const delivered = site.deliveredN() === events.length;
    const conv = site.digest() === canonical;
    const ok = check(dropped.length >= 1 && site.gaps() >= 1 && site.resyncs() >= 1 && delivered && conv,
      `seed ${seed}: drop ${dropped.length}·gaps ${site.gaps()}·resync ${site.resyncs()}·deliv ${site.deliveredN()}/${events.length}·conv ${conv}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(dropped.length, 4)} | ${pad(site.gaps(), 4)} | ${pad(site.resyncs(), 7)} | ${pad(delivered ? 'Y' : 'N', 4)} | ${pad(conv ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['asynclossy'] = asynclossy;
kit.ORDER.splice(1, 0, 'asynclossy');

(async () => { process.exit(await kit.cli(process.argv)); })();
