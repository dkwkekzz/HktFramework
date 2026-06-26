// HktInfra step-0321 — 헤드리스 검증 (#9 후속: host 산출 뷰의 증분 델타 정확성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `hostzonedelta`.
//   더한 한 조각: 질의 zoneViewStats(세션 view_delta 분포 {resets,updates,enters,total}). 초기 keyframe 1 + 이동마다 update — 매 tick 전체 전송 아닌 변경분만(대역 절감)인지 검증(읽기 전용).
//   검증: ⒜ `reg`(키트·OFF 비트 동일). ⒝ `hostzonedelta`(가설) — a1 3회 이동 → reset 1·update 3·total 4 ≪ 14 tick(증분 전파·update 에 a1).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { run } = NET;

// step-0321 #9 후속 검증 — host 산출 뷰의 증분 델타 정확성(zoneViewStats). a1 enter 후 3회 이동(tick 6·7·8): host 가 산출하는 뷰는 초기 keyframe(reset) 1 + 이동마다 update 1 = 4 frame.
//   14 tick 동안 *매 tick 전체 뷰가 아니라* 변경분만(reset 1·update 3·정지 tick 0) — 증분 전파의 대역 절감 핵심. update frame 은 자기(a1) 이동을 담는다.
function hostzonedelta(seeds) {
  const PLACE = (at, zoneId, host) => ({ at, op: { type: 'placeZone', zoneId, host } });
  const ENTER = (at, zoneId, avatar) => ({ at, op: { type: 'zoneEnter', zoneId, avatar } });
  const MOVE = (at, zoneId, avatar, dx, dy) => ({ at, op: { type: 'zoneMove', zoneId, avatar, dx, dy } });
  const OPS = [PLACE(1, 'z1', 'hostA')];
  const ENT = [ENTER(3, 'z1', 'a1'), MOVE(6, 'z1', 'a1', 1, 1), MOVE(7, 'z1', 'a1', 1, 1), MOVE(8, 'z1', 'a1', 1, 1)];
  const BASE = { clients: 6, moves: 24, radius: 4, grid: 16, zones: 2, bus: true, failover: true, placeExecute: true, zoneBridge: true, zoneEntityFlow: true, zoneHostHandle: true, zoneHostMailbox: true, gatewayZoneDir: true, gatewayDirectZone: true, zoneHostProc: true };
  console.log('== hostzonedelta (0321·#9 후속): host 산출 뷰의 증분 델타. a1 3회 이동 → reset 1·update 3·total 4 ≪ 14 tick(매 tick 전체 아닌 변경분만)·update 에 a1. ==');
  console.log('seed   | reset | update | total | <ticks | updHasA1 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 14, ...BASE, placementOps: OPS, entityOps: ENT });
    const o = r.orch;
    const st = o.zoneViewStats('z1', 's:a1');
    const updHasA1 = o.zoneViewBuf('z1').filter(s => s.payload.sessionId === 's:a1' && s.payload.update.length).every(s => s.payload.update.some(e => e.id === 'a1'));
    const ok = check(st.resets === 1 && st.updates === 3 && st.total === 4 && st.total < 14 && updHasA1,
      `seed ${seed}: 증분 델타 위반 (reset ${st.resets}·update ${st.updates}·total ${st.total}·updHasA1 ${updHasA1})`);
    console.log(`${pad(seed, 6)} | ${pad(st.resets, 5)} | ${pad(st.updates, 6)} | ${pad(st.total, 5)} | ${pad(st.total < 14 ? 'Y' : 'N', 6)} | ${pad(updHasA1 ? 'Y' : 'N', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['hostzonedelta'] = hostzonedelta;
kit.ORDER.splice(1, 0, 'hostzonedelta');

(async () => { process.exit(await kit.cli(process.argv)); })();
