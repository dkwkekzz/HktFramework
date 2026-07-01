// HktInfra step-0442 — 헤드리스 검증 (#4 실 net.step 배리어 치환 2: 실 sim seam fold — 수렴 다이제스트)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netsimfold`.
//   더한 한 조각: async-net.simFold — 배달 순서대로 동결 DummySimCore(engine sim seam)에 intent fold → 실 월드 serialize/digest.
//   totalOrder(0433) 정규화 fold 는 *도착 순열 불변*(수렴 다이제스트)·raw 도착 fold 는 갈릴 수 있음(substrate load-bearing).
//   async-net 은 run() 밖 substrate → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `netsimfold` — totalOrder fold K-순열 불변·결정론·raw 도착 갈림(diverge).
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

// step-0442 #4 배리어 치환 2 — netsimfold: totalOrder 정규화 fold 도착 순열 불변·raw 도착 fold 갈림(substrate 필요 증거).
function netsimfold(seeds) {
  console.log('== netsimfold (0442·#4 배리어 치환 2): 실 sim seam fold — totalOrder 도착 순열 불변(수렴)·raw 갈림. ==');
  console.log('seed   | 이벤트 | 순열불변 | 결정론 | raw갈림 | 판정');
  for (const seed of seeds) {
    const s = NET.worldIntentStream(seed, { clients: 4, avatars: 4, msgs: 40 });
    const canonical = NET.simFold(NET.totalOrder(s.events), seed, s.avatars).digest;
    let permInv = true, rawDiverge = false;
    const K = 6;
    for (let k = 0; k < K; k++) {
      const rnd = NET.mulberry32((seed ^ (0x9000 + k * 131)) >>> 0);
      const arr = shuffle(s.events, rnd);
      if (NET.simFold(NET.totalOrder(arr), seed, s.avatars).digest !== canonical) permInv = false;   // 정규화 → 불변
      if (NET.simFold(arr, seed, s.avatars).digest !== canonical) rawDiverge = true;                 // raw 도착 → 갈림 가능
    }
    const determ = NET.simFold(NET.totalOrder(s.events), seed, s.avatars).digest === canonical;
    const ok = check(permInv && determ, `seed ${seed}: permInv ${permInv}·determ ${determ}·rawDiverge ${rawDiverge}`);
    console.log(`${pad(seed, 6)} | ${pad(s.events.length, 6)} | ${pad(permInv ? 'Y' : 'N', 8)} | ${pad(determ ? 'Y' : 'N', 6)} | ${pad(rawDiverge ? 'Y' : 'N', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netsimfold'] = netsimfold;
kit.ORDER.splice(1, 0, 'netsimfold');

(async () => { process.exit(await kit.cli(process.argv)); })();
