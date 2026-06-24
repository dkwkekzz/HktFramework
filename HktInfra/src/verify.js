// HktInfra step-0204 — 헤드리스 검증 (오케스트레이터 존 배치 질의·placeQuery→placeReply)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `zonequery`.
//   더한 한 조각: placeQuery{zoneId} → placeReply{zoneId,host}(request/reply over net·순수 읽기). 배치 SSOT(0203)를 원격에서 읽는 경로. placeQuery 미주입 → 0203 비트 동일(reg).
//   검증: ⒜ `reg`(키트). ⒝ `zonequery`(가설) — place 2 + query(zone1·미배치 zone9) → reply host=hostA·null·repliesSent 2.
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
const QUERY = (at, zoneId) => ({ at, from: 'gateway', op: { type: 'placeQuery', zoneId } });
// 시나리오: zone1@hostA·zone2@hostB → query zone1(배치됨)·query zone9(미배치).
const OPS = [
  PLACE(2, 'zone1', 'hostA'), PLACE(3, 'zone2', 'hostB'),
  QUERY(4, 'zone1'), QUERY(5, 'zone9'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, failover: true, bus: true, placementOps: OPS };

function zonequery(seeds) {
  console.log('== zonequery: 오케스트레이터 존 배치 질의 — placeQuery→placeReply(request/reply over net). 배치 SSOT(0203)를 게이트웨이가 원격에서 읽는다("이 존 어디 사나"). 순수 읽기. 미배치 존은 host=null. ==');
  console.log('seed   | queriesRx | repliesSent | lastReply(zone9) | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const rx = r.orch.placeQueriesRx, sent = r.orch.placeRepliesSent, last = r.orch._lastPlaceReply;
    // 마지막 질의는 zone9(미배치) → host null.
    const ok = check(rx === 2 && sent === 2 && last && last.zoneId === 'zone9' && last.host === null,
      `seed ${seed}: 질의 위반 (rx ${rx}·sent ${sent}·last ${JSON.stringify(last)})`);
    console.log(`${pad(seed, 6)} | ${pad(rx, 9)} | ${pad(sent, 11)} | ${pad(last ? last.zoneId + '=' + last.host : '-', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → placeQuery 가 배치 SSOT 를 원격 request/reply 로 읽는다(1:1 회신·순수 읽기·배치 무변경). zone1=hostA·미배치 zone9=null. 프레즌스 0069/우편 0156 질의의 배치 판 — 게이트웨이가 존 위치를 물어 라우팅. 오케스트레이터 배치 박스 기본 통신 완비(place+query·0203~0204).');
}

kit.MODES['zonequery'] = zonequery;
kit.ORDER.splice(1, 0, 'zonequery');

(async () => { process.exit(await kit.cli(process.argv)); })();
