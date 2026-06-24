// HktInfra step-0250 — 헤드리스 검증 (배치 SSOT 실배선 #51 — placeQuery executed host)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `placequeryexec`.
//   더한 한 조각: placeQuery 회신에 실 가동 host(running) 추가 — 게이트웨이가 존이 *실제로 도는 곳*으로 라우팅(0204 는 결정만 회신했음). reply 에 running 필드 추가(읽기 전용). 미주입/OFF → 0249 비트 동일(reg). #51 실배선 10(읽기 경로·decade 닫기).
//   검증: ⒜ `reg`(키트). ⒝ `placequeryexec`(가설) — z1@A 가동→C 이주 후 query → reply host==hostC·running==hostC(결정==집행 실 위치).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
const MIGRATE = (at, zoneId, toHost) => ({ at, op: { type: 'placeMigrate', zoneId, toHost } });
const QUERY = (at, zoneId) => ({ at, from: 'gateway', op: { type: 'placeQuery', zoneId } });
// z1@hostA 가동 → hostC 이주 → 게이트웨이가 z1 실 위치 질의.
const OPS = [PLACE(1, 'z1', 'hostA'), MIGRATE(2, 'z1', 'hostC'), QUERY(3, 'z1')];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, placementOps: OPS };

function placequeryexec(seeds) {
  console.log('== placequeryexec (0250·#51 실배선): placeQuery executed host — 배치 질의 회신에 실 가동 host(running) 추가 → 게이트웨이가 존이 *실제로 도는 곳*으로 라우팅(0204 는 결정만 회신). z1@A→C 이주 후 query → reply host==hostC·running==hostC(결정==집행 실 위치). 읽기 경로 완성. ==');
  console.log('seed   | reply host | reply running | rx | sent | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const o = r.orch;
    const rep = o._lastPlaceReply || {};
    // 회신: 결정 host hostC·실 가동 running hostC(이주 반영)·질의 1·회신 1.
    const ok = check(rep.host === 'hostC' && rep.running === 'hostC' && rep.zoneId === 'z1' && o.placeQueriesRx === 1 && o.placeRepliesSent === 1,
      `seed ${seed}: 질의 위반 (host ${rep.host}·running ${rep.running}·rx ${o.placeQueriesRx}·sent ${o.placeRepliesSent})`);
    console.log(`${pad(seed, 6)} | ${pad(rep.host || '-', 10)} | ${pad(rep.running || '-', 13)} | ${pad(o.placeQueriesRx, 2)} | ${pad(o.placeRepliesSent, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['placequeryexec'] = placequeryexec;
kit.ORDER.splice(1, 0, 'placequeryexec');

(async () => { process.exit(await kit.cli(process.argv)); })();
