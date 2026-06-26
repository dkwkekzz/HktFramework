// HktInfra step-0349 — 헤드리스 검증 (#9 후속: 다운스트림 운영 대시보드 — 전파 평면 한눈 요약)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `dcreport`.
//   더한 한 조각: 게이트웨이 downstreamReport(){rx,routed,dropped,gaps,resyncs,cleaned,sessions,isolated} — 0331~0348 다운스트림 지표 단일 집계(운영 관측·전파 건강 한눈). 읽기 전용.
//   검증: ⒜ `reg`(키트·읽기 전용·비트 동일). ⒝ `dcreport` — 손실+이동+leave 혼합 후 report 가 일관: routed==rx(전부 라우팅)·dropped 0(미바인딩 0)·resyncs>0(손실 복구 발화)·isolated.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0349 #9 후속 — 다운스트림 운영 대시보드. a1@dc0·a2@dc1·이동·s:a1#2 손실 → report 집계.
//   손실 하: rx>routed(재전송 중복·미래 gap frame 도 rx 집계되나 인오더만 routed)·dropped 0(전부 바인딩)·gaps>0(손실 감지)·resyncs>0(복구)·isolated·sessions 2·둘 다 수렴.
function dcreport(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar, from) => ({ at, from, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy, from) => ({ at, from, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(2, 'z1', 'a1', 'dc0'), ENTER(3, 'z1', 'a2', 'dc1'), MOVE(5, 'z1', 'a1', 1, 1, 'dc0'), MOVE(6, 'z1', 'a1', 1, 0, 'dc0'), MOVE(7, 'z1', 'a1', 0, 1, 'dc0')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true, zoneEgress: true, downClients: 2, egressDrop: ['s:a1#2'], egressTimeout: 4 };
  console.log('== dcreport (0349·#9 후속): 다운스트림 운영 대시보드. 손실 하 routed≤rx·dropped0·gaps>0·resyncs>0·iso·수렴. ==');
  console.log('seed   | rx | routed | drop | gaps | resync | iso | conv | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 22, ...BASE, placementOps: OPS, entityOps: ENT });
    const rep = r.gateway.downstreamReport();
    const o = r.orch;
    const conv = r.downclients[0].convergedTo(o.zoneAuthSig('z1', 'a1')) && r.downclients[1].convergedTo(o.zoneAuthSig('z1', 'a2'));
    const ok = check(rep.routed > 0 && rep.routed <= rep.rx && rep.dropped === 0 && rep.gaps > 0 && rep.resyncs > 0 && rep.isolated && rep.sessions === 2 && conv,
      `seed ${seed}: ${JSON.stringify(rep)} conv ${conv}`);
    console.log(`${pad(seed, 6)} | ${pad(rep.rx, 2)} | ${pad(rep.routed, 6)} | ${pad(rep.dropped, 4)} | ${pad(rep.gaps, 4)} | ${pad(rep.resyncs, 6)} | ${pad(rep.isolated ? 'Y' : 'N', 3)} | ${pad(conv ? 'Y' : 'N', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['dcreport'] = dcreport;
kit.ORDER.splice(1, 0, 'dcreport');

(async () => { process.exit(await kit.cli(process.argv)); })();
