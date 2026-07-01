// HktInfra step-0454 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 4: move 손실+resync 복원)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barlossy`.
//   더한 한 조각: 배리어가 *move* 만 확률 손실(enter/leave 무손실)·resync 로 resyncDelay tick 뒤 재enqueue. move 는 위치 가산(가환)이라
//   늦게 적용돼도 최종 월드 동일 → 복원만 하면 run({asyncBarrier:{loss,resync}}) world==lockstep. resyncs>0(손실 실발생).
//   검증: ⒜ `reg`(asyncBarrier 미설정→net.step 비트 동일). ⒝ `barlossy` — world==lockstep·resyncs>0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0454 #4 실 치환 4 — barlossy: move 손실+resync→world==lockstep·resyncs>0.
function barlossy(seeds) {
  console.log('== barlossy (0454·#4 실 치환 4): move 손실+resync 복원 — run({asyncBarrier:loss,resync}) world==lockstep·resyncs>0. ==');
  console.log('seed   | world== | resyncs | lost | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };  // 단일 존(핸드오프/이주 없음) — 지연 move 가 이주 경계를 못 넘어 손실되는 경우 배제(이주 하 resync 지연 유계는 후속 한계)
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: { loss: 0.2, seed, resync: true, resyncDelay: 2, ticks: 48 } });
    const wEq = worldDigest(off) === worldDigest(on);
    const st = on.asyncBarrier || { resyncs: 0, lost: 0 };
    const ok = check(wEq && st.resyncs > 0 && st.lost === 0, `seed ${seed}: world ${wEq}·resyncs ${st.resyncs}·lost ${st.lost}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(st.resyncs, 7)} | ${pad(st.lost, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barlossy'] = barlossy;
kit.ORDER.splice(1, 0, 'barlossy');

(async () => { process.exit(await kit.cli(process.argv)); })();
