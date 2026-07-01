// HktInfra step-0446 — 헤드리스 검증 (#4 실 net.step 배리어 치환 6: M 복제 존 수렴 desync 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netconverge`.
//   더한 한 조각: async-net.convergeReplicas — M 복제 존이 각자 다른 순열+손실 도착을 makeZoneResync 재구성·동결 sim fold →
//   배리어 없이도 전 복제 digest 서로 같고(desync 0) == canonical(totalOrder). async-net 은 run() 밖 → reg 0.
//   검증: ⒜ `reg`. ⒝ `netconverge` — 전 복제 desync 0·== canonical.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0446 #4 배리어 치환 6 — netconverge: M 복제 존 상이 도착 → 전 복제 desync 0·==canonical.
function netconverge(seeds) {
  console.log('== netconverge (0446·#4 배리어 치환 6): M 복제 존 상이 순열+손실 → 배리어 없이 전 복제 desync 0·==canonical. ==');
  console.log('seed   | 이벤트 | 복제 | 전복제일치 | ==canonical | desync | 판정');
  for (const seed of seeds) {
    const C = 4, M = 4;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: 40 });
    const events = NET.withSseq(s.events);
    const canonical = NET.simFold(NET.totalOrder(events), seed, s.avatars).digest;
    const digests = NET.convergeReplicas(events, M, seed, s.avatars, C, { lossy: true });
    const allEq = digests.every(d => d === digests[0]);
    const eqCanon = digests[0] === canonical;
    const desync = (allEq && eqCanon) ? 0 : 1;
    const ok = check(allEq && eqCanon, `seed ${seed}: allEq ${allEq}·eqCanon ${eqCanon}`);
    console.log(`${pad(seed, 6)} | ${pad(s.events.length, 6)} | ${pad(M, 4)} | ${pad(allEq ? 'Y' : 'N', 10)} | ${pad(eqCanon ? 'Y' : 'N', 11)} | ${pad(desync, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netconverge'] = netconverge;
kit.ORDER.splice(1, 0, 'netconverge');

(async () => { process.exit(await kit.cli(process.argv)); })();
