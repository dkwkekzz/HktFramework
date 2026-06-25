// HktInfra step-0270 — 헤드리스 검증 (정리 #49 인접·선제: gateway 메시지 라우팅 핸들러 믹스인 분리·gateway-msg.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `gwsplit`.
//   더한 한 조각: Gateway 의 메시지 라우팅 핸들러(onMsg: 클라 move/item/chat 업스트림 라우팅 + 존/서비스/버스 다운스트림 중계 + 세션 bind/unbind)를 gateway-msg.js 믹스인으로 분리(Object.assign prototype). 정의 위치만 이동·기능 0 → 0269 비트 동일(reg). gateway.js 22.8KB→16.0KB.
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `gwsplit`(가설) — 클라 move 가 게이트웨이 onMsg 로 존에 라우팅·결정론 월드 수렴(worldDigest 재현·live 엔티티>0).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad, worldDigest } = kit.helpers;
const { run } = NET;

// step-0270 정리 분할(#49 인접) 검증 — 게이트웨이 라우팅 핸들러를 gateway-msg 믹스인으로 위임한 뒤,
//   클라 move 가 여전히 onMsg 로 존에 라우팅되어 결정론 월드로 수렴하는지 본다(두 동일 run 의 worldDigest 일치·live 엔티티>0).
function gwsplit(seeds) {
  const BASE = { ticks: 40, clients: 6, moves: 30, radius: 4, grid: 16, zones: 2, incremental: true, recovery: true };
  console.log('== gwsplit (0270 분할·#49 인접): 게이트웨이 메시지 라우팅 핸들러(onMsg)를 gateway-msg 믹스인으로 위임 — 클라 move 가 onMsg 로 존 라우팅·결정론 월드 수렴(worldDigest 재현·live 엔티티>0)·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | worldDigest | 재현 | live | 판정');
  for (const seed of seeds) {
    const a = run({ seed, ...BASE });
    const b = run({ seed, ...BASE });
    const da = worldDigest(a), db = worldDigest(b);
    const lastLive = a.trace[a.trace.length - 1].liveN;
    const ok = check(da === db && !!a.gateway && lastLive > 0, `seed ${seed}: 라우팅/결정론 위반 (digest ${da}/${db}·live ${lastLive})`);
    console.log(`${pad(seed, 6)} | ${pad(da, 11)} | ${pad(da === db ? 'OK' : 'X', 4)} | ${pad(lastLive, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['gwsplit'] = gwsplit;
kit.ORDER.splice(1, 0, 'gwsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
