// HktInfra step-0328 — 헤드리스 검증 (#9 후속: 다운스트림 세션 무굶김 — 모두 keyframe 수신)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzonekeyed`.
//   더한 한 조각: 술어 zoneViewAllKeyed(존의 모든 활성 세션이 초기 reset keyframe 을 받았나). 접속한 플레이어는 누구나 자기 세계를 받는다(no-starvation·다운스트림 무손실 토대·읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzonekeyed`(가설) — z1 에 a1·a2·a3 enter → 세 세션 모두 reset 1+·zoneViewAllKeyed true·세션 3.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0328 #9 후속 검증 — 다운스트림 세션 무굶김(zoneViewAllKeyed). z1 에 a1·a2·a3 enter → 각 세션이 적어도 한 번 reset keyframe(초기 전체 뷰)을 받는다.
//   한 세션도 굶기지 않는다(접속한 플레이어는 누구나 자기 세계를 받음) — 다운스트림 데이터 평면 무손실의 토대. zoneViewSessions 3·각 세션 resets ≥ 1·zoneViewAllKeyed true.
function hostzonekeyed(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), ENTER(4, 'z1', 'a2'), ENTER(5, 'z1', 'a3')];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzonekeyed (0328·#9 후속): 다운스트림 세션 무굶김. a1·a2·a3 enter → 세 세션 모두 초기 reset keyframe 수신·zoneViewAllKeyed true. ==');
  console.log('seed   | sessions | allKeyed | r1 | r2 | r3 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const sess = o.zoneViewSessions('z1').length;
    const r1 = o.zoneViewStats('z1', 's:a1').resets, r2 = o.zoneViewStats('z1', 's:a2').resets, r3 = o.zoneViewStats('z1', 's:a3').resets;
    const allKeyed = o.zoneViewAllKeyed('z1');
    const ok = check(sess === 3 && allKeyed === true && r1 >= 1 && r2 >= 1 && r3 >= 1,
      `seed ${seed}: 세션 무굶김 위반 (sessions ${sess}·allKeyed ${allKeyed}·resets ${r1}/${r2}/${r3})`);
    console.log(`${pad(seed, 6)} | ${pad(sess, 8)} | ${pad(allKeyed ? 'Y' : 'N', 8)} | ${pad(r1, 2)} | ${pad(r2, 2)} | ${pad(r3, 2)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzonekeyed'] = hostzonekeyed;
kit.ORDER.splice(1, 0, 'hostzonekeyed');

(async () => { process.exit(await kit.cli(process.argv)); })();
