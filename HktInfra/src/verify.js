// HktInfra step-0433 — 헤드리스 검증 (#4 진짜 비동기 3: 결정론 전순서·인과 존중)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `lcorder`.
//   더한 한 조각: async-core.js — totalOrder(키 (lc, siteIndex))·orderSig·totalOrderSound. Lamport 전순서는 *내용의 함수* →
//   같은 이벤트의 어떤 물리 순열이든 같은 전순서·엄격(동률 0)·인과 존중(간선 a→b 위치 보존). run() 미호출 → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `lcorder` — P 순열 전부 같은 orderSig·strict·causal.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// seed PRNG 로 Fisher-Yates 셔플(물리 도착 순열 모사). 원본 불변.
function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// step-0433 #4 진짜 비동기 3 — lcorder: 결정론 전순서. 8 순열 셔플 전부 같은 전순서(orderSig)·엄격·인과 존중.
function lcorder(seeds) {
  console.log('== lcorder (0433·#4): 결정론 전순서 — 같은 이벤트의 P 물리 순열 전부 같은 전순서·엄격·인과 존중 ==');
  console.log('seed   | 이벤트 | 순열 | 동일순서 | 엄격 | 인과 | 판정');
  for (const seed of seeds) {
    const { events, edges } = NET.lamportExchange(seed, { sites: 4, rounds: 40 });
    const sound = NET.totalOrderSound(events, edges);
    const rnd = NET.mulberry32((seed ^ 0xB0B) >>> 0);
    const P = 8;
    let sameOrder = true;
    for (let p = 0; p < P; p++) {
      const perm = shuffle(events, rnd);
      if (NET.orderSig(NET.totalOrder(perm)) !== sound.sig) sameOrder = false;
    }
    const ok = check(sameOrder && sound.strict && sound.causal,
      `seed ${seed}: same ${sameOrder}·strict ${sound.strict}·causal ${sound.causal}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(P, 4)} | ${pad(sameOrder ? 'Y' : 'N', 8)} | ${pad(sound.strict ? 'Y' : 'N', 4)} | ${pad(sound.causal ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['lcorder'] = lcorder;
kit.ORDER.splice(1, 0, 'lcorder');

(async () => { process.exit(await kit.cli(process.argv)); })();
