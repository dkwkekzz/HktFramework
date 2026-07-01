// HktInfra step-0448 — 헤드리스 검증 (#4 실 net.step 배리어 치환 8: exactly-once 회계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netaccount`.
//   더한 한 조각: async-net.accountReplicas — M 복제가 순열+손실 재구성 후 async-core.accountDelivered 로 {complete,dups,missing}
//   대조 + 실 월드 digest. 배리어 없이도 발신 intent == 적용(exactly-once)·순열/손실 교란에도 digest 불변. run() 밖 → reg 0.
//   검증: ⒜ `reg`. ⒝ `netaccount` — 전 복제 complete·dups0·missing0·digest==canonical·손실 발생.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0448 #4 배리어 치환 8 — netaccount: 전 복제 exactly-once(complete·dups0·missing0)·digest==canonical.
function netaccount(seeds) {
  console.log('== netaccount (0448·#4 배리어 치환 8): exactly-once 회계 — 전 복제 complete·dups0·missing0·digest==canonical. ==');
  console.log('seed   | 이벤트 | 복제 | complete | dups | missing | ==canonical | 판정');
  for (const seed of seeds) {
    const C = 4, M = 4;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: 40 });
    const events = NET.withSseq(s.events);
    const canonical = NET.simFold(NET.totalOrder(events), seed, s.avatars).digest;
    const reps = NET.accountReplicas(events, M, seed, s.avatars, C);
    const allComplete = reps.every(r => r.complete);
    const dups = reps.reduce((a, r) => a + r.dups, 0);
    const missing = reps.reduce((a, r) => a + r.missing, 0);
    const eqCanon = reps.every(r => r.digest === canonical);
    const lossy = reps.some(r => r.resyncs > 0);
    const ok = check(allComplete && dups === 0 && missing === 0 && eqCanon && lossy, `seed ${seed}: complete ${allComplete}·dups ${dups}·missing ${missing}·eqCanon ${eqCanon}`);
    console.log(`${pad(seed, 6)} | ${pad(s.events.length, 6)} | ${pad(M, 4)} | ${pad(allComplete ? 'Y' : 'N', 8)} | ${pad(dups, 4)} | ${pad(missing, 7)} | ${pad(eqCanon ? 'Y' : 'N', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netaccount'] = netaccount;
kit.ORDER.splice(1, 0, 'netaccount');

(async () => { process.exit(await kit.cli(process.argv)); })();
