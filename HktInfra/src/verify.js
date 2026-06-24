// HktInfra step-0217 — 헤드리스 검증 (오케스트레이터 부하 배치·placeAuto·부하 분산)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placeload`.
//   더한 한 조각: placeAuto{zoneId,hosts} → 후보 host 중 최소 부하(배치된 존 수 최소) 선택 배치(부하 분산). 동률은 후보 순서 tie-break. 미주입 → 0216 비트 동일(reg). 2차 고도화 오케 #1.
//   검증: ⒜ `reg`(키트). ⒝ `placeload`(가설) — z1~z4 placeAuto(hosts A/B/C) → A·B·C·A 라운드로빈 균형(부하 2/1/1).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const HOSTS = ['hostA', 'hostB', 'hostC'];
const AUTO = (at, zoneId) => ({ at, op: { type: 'placeAuto', zoneId, hosts: HOSTS } });
// z1~z4 자동 배치 → 최소 부하 라운드로빈: A(0→1)·B(0→1)·C(0→1)·A(동률 tie→첫째). 부하 A2·B1·C1.
const OPS = [AUTO(2, 'z1'), AUTO(3, 'z2'), AUTO(4, 'z3'), AUTO(5, 'z4')];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placementOps: OPS };

function placeload(seeds) {
  console.log('== placeload: 오케스트레이터 부하 배치(placeAuto) — 후보 host 중 최소 부하 선택 배치(부하 분산·정적 배치 한계 제거). 동률은 후보 순서 결정론 tie-break. 2차 고도화 오케스트레이터 #1. ==');
  console.log('seed   | z1/z2/z3/z4 | 부하 A/B/C | autoPlace | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const z = ['z1', 'z2', 'z3', 'z4'].map(zz => o.placementOf(zz));
    const la = o.hostLoad('hostA'), lb = o.hostLoad('hostB'), lc = o.hostLoad('hostC');
    // 라운드로빈 균형: z1→A·z2→B·z3→C·z4→A(동률 첫째). 부하 2/1/1·autoPlacements 4.
    const ok = check(z[0] === 'hostA' && z[1] === 'hostB' && z[2] === 'hostC' && z[3] === 'hostA' && la === 2 && lb === 1 && lc === 1 && o.autoPlacements === 4,
      `seed ${seed}: 배치 위반 (z ${z.join(',')}·부하 ${la}/${lb}/${lc}·auto ${o.autoPlacements})`);
    console.log(`${pad(seed, 6)} | ${pad(z.map(x => x.replace('host', '')).join('/'), 11)} | ${pad(la + '/' + lb + '/' + lc, 9)} | ${pad(o.autoPlacements, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → placeAuto 가 매번 최소 부하 host 를 골라(A·B·C·A) 부하를 균형 분산(2/1/1·동률은 결정론 tie-break). 어떤 단일 host 도 영구 중심이 아니다(정적 배치 한계 제거·부하 배치 토대). 오케스트레이터 2차 고도화 #1.');
}

kit.MODES['placeload'] = placeload;
kit.ORDER.splice(1, 0, 'placeload');

(async () => { process.exit(await kit.cli(process.argv)); })();
