// HktInfra step-0431 — 헤드리스 검증 (#4 진짜 비동기 1: Lamport 논리 클럭 원시)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `lcstamp`.
//   더한 한 조각: 신규 박스 async-core.js — Lamport 논리 클럭(makeLamportClock). K 로컬 이벤트 스탬프가 1..K 단조 증가.
//   run() 경로 미호출(검증 전용 substrate) → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `lcstamp` — K 로컬 이벤트 스탬프 1..K 단조·최종 클럭==K.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0431 #4 진짜 비동기 1 — lcstamp: Lamport 논리 클럭 원시. K(시드 의존 5..10) 로컬 이벤트 → 스탬프 1..K 단조 증가·최종 클럭==K.
function lcstamp(seeds) {
  console.log('== lcstamp (0431·#4): Lamport 논리 클럭 원시 — K 로컬 이벤트 스탬프 1..K 단조 증가 ==');
  console.log('seed   | K  | 단조 | 최종 | 판정');
  for (const seed of seeds) {
    const rnd = NET.mulberry32(seed);
    const K = 5 + (rnd() % 6);   // 5..10 (시드 의존·uint32 PRNG)
    const lc = NET.makeLamportClock('s0');
    const stamps = [];
    for (let i = 0; i < K; i++) stamps.push(lc.local());
    let mono = true;
    for (let i = 0; i < stamps.length; i++) if (stamps[i] !== i + 1) mono = false;
    const ok = check(mono && lc.now() === K, `seed ${seed}: 스탬프 비단조/최종불일치 [${stamps}] now=${lc.now()}`);
    console.log(`${pad(seed, 6)} | ${pad(K, 2)} | ${pad(mono ? 'Y' : 'N', 4)} | ${pad(lc.now(), 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['lcstamp'] = lcstamp;
kit.ORDER.splice(1, 0, 'lcstamp');

(async () => { process.exit(await kit.cli(process.argv)); })();
