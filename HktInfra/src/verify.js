// HktInfra step-0435 — 헤드리스 검증 (#4 진짜 비동기 5: 인과 의존 배달)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `lccausal`.
//   더한 한 조각: async-core.js — causalDeliver(events,edges,arrival): deps(=happens-before 선행) 충족 시에만 방출 →
//   FIFO 없이 어떤 적대적 도착(역순/셔플)에도 원인→결과 보존(causalViolations 0)·전부 배달(stuck 0). run() 미호출 → reg 0.
//   검증: ⒜ `reg`. ⒝ `lccausal` — 역순+셔플 6 도착 전부 violations 0·stuck 0·전부 배달.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

function shuffle(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rnd() % (i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

// step-0435 #4 진짜 비동기 5 — lccausal: 인과 의존 배달. 적대적 도착(역순·역전순서·셔플) 전부 인과 위반 0·stuck 0·전부 배달.
function lccausal(seeds) {
  console.log('== lccausal (0435·#4): 인과 의존 배달 — 적대적 도착(역순/셔플)에도 원인→결과 보존(위반 0)·전부 배달 ==');
  console.log('seed   | 이벤트 | 도착패턴 | 위반합 | 미배달 | 판정');
  for (const seed of seeds) {
    const { events, edges } = NET.lamportExchange(seed, { sites: 4, rounds: 44 });
    const rnd = NET.mulberry32((seed ^ 0xDEAD) >>> 0);
    const arrivals = [
      events.slice().reverse(),                          // 발신 역순(적대적)
      NET.totalOrder(events).reverse(),                  // 전순서 역전(적대적)
      shuffle(events, rnd), shuffle(events, rnd), shuffle(events, rnd), shuffle(events, rnd),
    ];
    let violSum = 0, stuckSum = 0;
    for (const arr of arrivals) {
      const r = NET.causalDeliver(events, edges, arr);
      violSum += NET.causalViolations(r.order, edges);
      stuckSum += r.stuck + (r.deliveredN !== events.length ? 1 : 0);
    }
    const ok = check(violSum === 0 && stuckSum === 0, `seed ${seed}: viol ${violSum}·stuck ${stuckSum}`);
    console.log(`${pad(seed, 6)} | ${pad(events.length, 6)} | ${pad(arrivals.length, 8)} | ${pad(violSum, 6)} | ${pad(stuckSum, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['lccausal'] = lccausal;
kit.ORDER.splice(1, 0, 'lccausal');

(async () => { process.exit(await kit.cli(process.argv)); })();
