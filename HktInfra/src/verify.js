// HktInfra step-0262 — 헤드리스 검증 (정리 #49 wiring: topo-run 복구 주입 분리·topo-failover.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `fosplit`.
//   더한 한 조각: run() 의 crash/failover 복구 주입(persistRestart·invRestart·clientResync·rankRestart·spawnReconstruct·chatRestart·busReSub·busRestart 재협상)을 topo-failover.js(applyFailover)로 verbatim 분리. ctx 핸들+quorumMergeJournals 만 주입·기능 0 → 0261 비트 동일(reg). topo-run.js 22.7KB→13.1KB.
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `fosplit`(가설) — 가방 invRestart(crash+replay) 복구가 원장에 투명(복구판 ledger size == 무crash 판).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, ledgerSize } = kit.helpers;
const { run } = NET;

// step-0262 정리 분할(#49 wiring) 검증 — run() 의 복구 주입을 topo-failover.applyFailover 로 위임한 뒤,
//   *옮긴 복구 경로*(가방 invRestart=crash 후 PersistStore 저널 replay)가 여전히 원장을 투명 복구하는지 본다.
//   base(무crash) vs recov(crash+replay) 의 inventory.ledger.size 가 같으면 복구 무손실 = applyFailover 위임 무결(reg 0 가 비트 동일을 별도 증명).
function fosplit(seeds) {
  const BASE = { ticks: 70, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true, inventory: true, itemOps: 10, chat: true, chatOps: 12, regions: 2, bus: true, audit: true, ranking: true, persist: true, snapshot: SNAP_N };
  console.log('== fosplit (0262 분할·#49): crash/failover 복구 주입을 topo-failover.applyFailover 로 위임 — 가방 invRestart(crash+replay) 복구가 원장에 투명(복구판 ledger==무crash판)·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | recov size | base size | 판정');
  for (const seed of seeds) {
    const base = run({ seed, ...BASE });
    const recov = run({ seed, ...BASE, invRestart: { at: RESTART_AT } });
    const bs = ledgerSize(base), rs = ledgerSize(recov);
    const ok = check(bs > 0 && rs === bs, `seed ${seed}: 복구 비투명 (base ${bs}·recov ${rs})`);
    console.log(`${pad(seed, 6)} | ${pad(rs, 10)} | ${pad(bs, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['fosplit'] = fosplit;
kit.ORDER.splice(1, 0, 'fosplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
