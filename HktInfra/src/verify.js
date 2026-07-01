// HktInfra step-0459 — 헤드리스 검증 (#4 실 net.step 배리어 실제 치환 9: 다운스트림 뷰 수렴)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `barview`.
//   더한 한 조각: 배리어 손실+resync(업스트림 월드 입력)이 *다운스트림 뷰*에도 정합함을 단언 — 클라 AOI 뷰(seenSig)·마지막 seenTrace 가
//   lockstep 과 수렴(desync 0). 상류 손실을 배리어가 복원하므로 하류 뷰 스트림도 최종 일치. 코드 무변경 → reg 0.
//   검증: ⒜ `reg`. ⒝ `barview` — 최종 클라 seenSig==lockstep·마지막 seenTrace==lockstep·world==lockstep.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;

// step-0459 #4 실 치환 9 — barview: 상류 손실+resync 하 다운스트림 클라 뷰 수렴(desync 0)·world==lockstep.
function barview(seeds) {
  console.log('== barview (0459·#4 실 치환 9): 다운스트림 뷰 수렴 — 상류 손실+resync 하 클라 AOI 뷰·seenTrace==lockstep·desync 0. ==');
  console.log('seed   | world== | seenSig== | seenTrace== | desync | 판정');
  for (const seed of seeds) {
    const base = { seed, ticks: 48, clients: 4, moves: 30, radius: 4, grid: 16, incremental: true, zones: 1 };
    const off = NET.run({ ...base });
    const on = NET.run({ ...base, asyncBarrier: { loss: 0.2, seed, resync: true, resyncDelay: 2, ticks: 48 } });
    const sig = r => r.clients.map(c => c.seenSig()).join('|');
    const lastTrace = r => JSON.stringify(r.seenTrace[r.seenTrace.length - 1]);
    const wEq = worldDigest(off) === worldDigest(on);
    const sEq = sig(off) === sig(on);
    const tEq = lastTrace(off) === lastTrace(on);
    const desync = (sEq && tEq) ? 0 : 1;
    const ok = check(wEq && sEq && tEq, `seed ${seed}: world ${wEq}·seenSig ${sEq}·seenTrace ${tEq}`);
    console.log(`${pad(seed, 6)} | ${pad(wEq ? 'Y' : 'N', 7)} | ${pad(sEq ? 'Y' : 'N', 9)} | ${pad(tEq ? 'Y' : 'N', 11)} | ${pad(desync, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['barview'] = barview;
kit.ORDER.splice(1, 0, 'barview');

(async () => { process.exit(await kit.cli(process.argv)); })();
