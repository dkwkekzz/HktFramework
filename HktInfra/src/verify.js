// HktInfra step-0444 — 헤드리스 검증 (#4 실 net.step 배리어 치환 4: 실 actor.onMsg 디스패치)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netdispatch`.
//   더한 한 조각: async-net.makeZoneActor(실 Net onMsg → 동결 sim tick)·deliverToActor — 존 메일박스 holdback 방출을
//   실 수신 actor.onMsg 로 배달(net.step 전역 FIFO 큐 대신 substrate 재구성 전순서). actor 실 sim 상태 == canonical.
//   async-net 은 run() 밖 substrate → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `netdispatch` — actor.digest==canonical·applied==msgs·전 인터리빙 불변.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

function interleave(events, nsites, rnd) {
  const q = Array.from({ length: nsites }, () => []);
  for (const e of events) q[e.site].push(e);
  const out = []; let rem = events.length;
  while (rem > 0) { let s = rnd() % nsites; for (let k = 0; k < nsites && q[s].length === 0; k++) s = (s + 1) % nsites; out.push(q[s].shift()); rem--; }
  return out;
}

// step-0444 #4 배리어 치환 4 — netdispatch: 메일박스 방출 → 실 actor.onMsg 배달·상태==canonical·불변.
function netdispatch(seeds) {
  console.log('== netdispatch (0444·#4 배리어 치환 4): 실 actor.onMsg 디스패치 — actor sim==canonical·applied==msgs·불변. ==');
  console.log('seed   | 이벤트 | actor상태==canonical | applied==msgs | 인터리빙불변 | 판정');
  for (const seed of seeds) {
    const C = 4, MS = 40;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: MS });
    const canonical = NET.simFold(NET.totalOrder(s.events), seed, s.avatars).digest;
    let eqCanon = true, appliedOk = true, inv = true; let dig0 = null;
    const K = 6;
    for (let k = 0; k < K; k++) {
      const rnd = NET.mulberry32((seed ^ (0xB000 + k * 149)) >>> 0);
      const mbox = NET.makeZoneMailbox(C);
      for (const e of interleave(s.events, C, rnd)) mbox.receive(e);
      const actor = NET.makeZoneActor(seed, s.avatars);
      NET.deliverToActor(mbox.close(), actor);
      if (actor.digest() !== canonical) eqCanon = false;
      if (actor.appliedN() !== MS) appliedOk = false;
      if (dig0 === null) dig0 = actor.digest(); else if (actor.digest() !== dig0) inv = false;
    }
    const ok = check(eqCanon && appliedOk && inv, `seed ${seed}: eqCanon ${eqCanon}·applied ${appliedOk}·inv ${inv}`);
    console.log(`${pad(seed, 6)} | ${pad(s.events.length, 6)} | ${pad(eqCanon ? 'Y' : 'N', 20)} | ${pad(appliedOk ? 'Y' : 'N', 13)} | ${pad(inv ? 'Y' : 'N', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netdispatch'] = netdispatch;
kit.ORDER.splice(1, 0, 'netdispatch');

(async () => { process.exit(await kit.cli(process.argv)); })();
