// HktInfra step-0450 — 헤드리스 검증 (#4 실 net.step 배리어 치환 10·grand capstone: in-proc 등가 E2E)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `nete2ecap`.
//   더한 한 조각: 검증 전용 grand capstone — 실 Net-형 다중 client intent → M 복제 존 순열+손실+독립 페이스 재구성 →
//   ⒜ 실 engine Net 배리어 == 배리어-free substrate == canonical ⒝ 전 복제 실 월드 desync 0 ⒞ exactly-once ⒟ 전순서 sound(인과 존중)
//   ⒠ 배리어-free(skew>0) ⒡ 손실 발생. #4 실 net.step 배리어 치환 in-proc 등가 sub-arc(0441~0450) 닫기. async-net run() 밖 → reg 0.
//   검증: ⒜ `reg`. ⒝ `nete2ecap` — 배리어등가·전복제 desync0·exactly-once·sound·skew>0·lossy.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0450 #4 10·grand capstone — nete2ecap: 배리어==배리어-free==canonical·전복제 desync0·exactly-once·sound·skew>0·lossy. 0441~0450 닫기.
function nete2ecap(seeds) {
  console.log('== nete2ecap (0450·#4 grand capstone): 실 배리어==substrate==canonical·전복제 desync0·exactly-once·sound·배리어-free·lossy. 0441~0450 닫기. ==');
  console.log('seed   | 이벤트 | 배리어등가 | 전복제desync0 | exactly-once | sound | skew | lossy | 판정');
  for (const seed of seeds) {
    const C = 4, M = 3, MS = 40;
    const s = NET.worldIntentStream(seed, { clients: C, avatars: 4, msgs: MS });
    const events = NET.withSseq(s.events);
    const canonical = NET.simFold(NET.totalOrder(events), seed, s.avatars).digest;
    const sound = NET.totalOrderSound(events, s.edges);                       // 엄격 + 인과 존중
    const L = NET.runLockstepEngine(s.events, seed, s.avatars, C);            // 실 engine Net 배리어
    const barrierEq = L.totalDigest === canonical && L.delivered === MS;
    const cap = NET.capstoneReplicas(events, M, seed, s.avatars, C);          // 배리어-free 순열+손실+페이스
    const allConv = cap.reps.every(r => r.digest === canonical);
    const allComplete = cap.reps.every(r => r.complete);
    const lossy = cap.reps.some(r => r.resyncs > 0);
    const skew = cap.skew;
    const ok = check(barrierEq && allConv && allComplete && sound.strict && sound.causal && skew > 0 && lossy,
      `seed ${seed}: barrier ${barrierEq}·conv ${allConv}·once ${allComplete}·sound ${sound.strict && sound.causal}·skew ${skew}·lossy ${lossy}`);
    console.log(`${pad(seed, 6)} | ${pad(MS, 6)} | ${pad(barrierEq ? 'Y' : 'N', 10)} | ${pad(allConv ? 'Y' : 'N', 13)} | ${pad(allComplete ? 'Y' : 'N', 12)} | ${pad(sound.causal ? 'Y' : 'N', 5)} | ${pad(skew, 4)} | ${pad(lossy ? 'Y' : 'N', 5)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['nete2ecap'] = nete2ecap;
kit.ORDER.splice(1, 0, 'nete2ecap');

(async () => { process.exit(await kit.cli(process.argv)); })();
