// HktInfra step-0440 — 헤드리스 검증 (#4 진짜 비동기 10·grand capstone: async substrate E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `asynce2ecap`.
//   더한 한 조각: 검증 전용 grand capstone — M 복제 site 가 *서로 다른 순열+손실* 도착을 각자 resync+holdback 으로 재구성·배리어-free
//   진행 → ⒜ clock condition 위반 0 ⒝ 전 복제 desync 0(==정전 전순서) ⒞ 인과 존중(전순서 sound) ⒟ exactly-once(complete) ⒠ 손실 발생.
//   #4 substrate sub-arc(0431~0440) 닫기. async-core 는 run() 밖 substrate → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `asynce2ecap` — clock0·전복제수렴·sound·complete·lossy.
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
  while (rem > 0) { let s = rnd() % nsites; for (let k = 0; k < nsites && queues[s].length === 0; k++) s = (s + 1) % nsites; out.push(queues[s].shift()); rem--; }
  return out;
}
// 한 복제: 순열 도착 + ~20% 손실 + 재전송(임의 순서) + 배리어-free 진행(receive 뒤 즉시 처리는 resync site 내부). → {delivered, resyncs}.
function replica(events, N, rnd) {
  const site = NET.makeResyncSite(N);
  const dropped = [];
  for (const e of arrivalFor(events, N, rnd)) { if (rnd() % 5 === 0) dropped.push(e); else site.receive(e); }
  for (const e of shuffle(dropped, rnd)) site.resync(e);
  return { delivered: site.finish(), resyncs: site.resyncs() };
}

// step-0440 #4 10·grand capstone — asynce2ecap: M 복제·순열+손실·인과 정렬→전 복제 desync 0·exactly-once·clock0·sound·lossy. 0431~0440 닫기.
function asynce2ecap(seeds) {
  console.log('== asynce2ecap (0440·#4 grand capstone): M 복제 순열+손실→전 복제 desync 0·exactly-once·clock0·인과 존중. 0431~0440 닫기. ==');
  console.log('seed   | 이벤트 | clock위반 | 전복제수렴 | 인과존중 | exactly-once | 손실 | 판정');
  for (const seed of seeds) {
    const N = 4, M = 3;
    const base = NET.lamportExchange(seed, { sites: N, rounds: 56 });
    const events = NET.withSseq(base.events);
    const canonical = NET.applyDigest(NET.totalOrder(events));
    const clockViol = NET.clockConditionViolations(base.events, base.edges);
    const sound = NET.totalOrderSound(events, base.edges);   // 엄격 + 인과 존중
    let allConv = true, allComplete = true, lossy = true;
    for (let m = 0; m < M; m++) {
      const r = replica(events, N, NET.mulberry32((seed ^ (0x4000 + m * 97)) >>> 0));
      if (NET.applyDigest(r.delivered) !== canonical) allConv = false;
      if (!NET.accountDelivered(r.delivered, events).complete) allComplete = false;
      if (r.resyncs === 0) lossy = false;
    }
    const ok = check(clockViol === 0 && allConv && sound.strict && sound.causal && allComplete && lossy,
      `seed ${seed}: clock ${clockViol}·conv ${allConv}·sound ${sound.strict && sound.causal}·complete ${allComplete}·lossy ${lossy}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(clockViol, 9)} | ${pad(allConv ? 'Y' : 'N', 10)} | ${pad(sound.causal ? 'Y' : 'N', 8)} | ${pad(allComplete ? 'Y' : 'N', 12)} | ${pad(lossy ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['asynce2ecap'] = asynce2ecap;
kit.ORDER.splice(1, 0, 'asynce2ecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
