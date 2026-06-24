// HktInfra step-0229 — 헤드리스 검증 (로그인 계정 검증·loginAuth)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `loginauth`.
//   더한 한 조각: loginAuth{player} → validAccounts 면 enqueue, 미인증이면 거부(authRejects·줄 이전 차단). validAccounts 빈 채/loginAuth 미수신이면 0228 비트 동일(reg). 3차 고도화 로그인 #1.
//   검증: ⒜ `reg`(키트). ⒝ `loginauth`(가설) — p1·p2 유효 → enqueue, pX 미인증 → 거부.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const AUTH = (at, player) => ({ at, op: { type: 'loginAuth', player } });
// validAccounts=[p1,p2] → loginAuth p1·p2 통과(줄 세움)·pX 미인증(거부·줄 이전 차단).
const OPS = [
  AUTH(2, 'p1'), AUTH(3, 'p2'), AUTH(4, 'pX'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginAccounts: ['p1', 'p2'], loginOps: OPS };

function loginauth(seeds) {
  console.log('== loginauth: 로그인 계정 검증(loginAuth) — 유효 계정(validAccounts)만 대기열에 넣는다(검증 통과→enqueue·미인증→거부·줄 이전 차단). 0001 LoginServer 계정 검증을 엣지 큐에 실체화 — 불량 접속이 대기열·월드에 안 닿는다. 3차 고도화 로그인 #1. ==');
  console.log('seed   | 큐 | authed | rejects | pX pos | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const q = r.loginqueue;
    // p1·p2 통과(큐 2·authed 2)·pX 거부(authRejects 1·줄에 없음 pos -1).
    const ok = check(q.queueLength() === 2 && q.authed === 2 && q.authRejects === 1 && q.positionOf('p1') === 0 && q.positionOf('pX') === -1,
      `seed ${seed}: 계정검증 위반 (큐 ${q.queueLength()}·authed ${q.authed}·rejects ${q.authRejects})`);
    console.log(`${pad(seed, 6)} | ${pad(q.queueLength(), 2)} | ${pad(q.authed, 6)} | ${pad(q.authRejects, 7)} | ${pad(q.positionOf('pX'), 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 유효 계정 p1·p2 만 줄에 서고(큐 2·authed 2) 미인증 pX 는 거부된다(authRejects 1·positionOf -1=줄에 없음). 계정 검증을 *대기열 이전*(엣지)에 두어 불량 접속이 대기열·월드를 아예 못 건드린다(0001 LoginServer 검증의 큐 실체화). 로그인 3차 고도화 #1.');
}

kit.MODES['loginauth'] = loginauth;
kit.ORDER.splice(1, 0, 'loginauth');

(async () => { process.exit(await kit.cli(process.argv)); })();
