// HktInfra step-0220 — 헤드리스 검증 (로그인 큐 재접속 세션 재개·loginReconnect·균형 라운드 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `loginreconnect`.
//   더한 한 조각: loginReconnect{player} → 유효 admitted player 면 기존 티켓 재개(새 티켓 미발급·ticketSeq 불변·멱등). 만료/미발급이면 재개 불가(reconnectMisses·재큐 필요). 미주입 → 0219 비트 동일(reg). 2차 고도화 로그인 큐 #2.
//   검증: ⒜ `reg`(키트). ⒝ `loginreconnect`(가설) — p1 입장 → reconnect 재개(같은 티켓·새 티켓 0) / p2 미입장 → 재개 실패.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const ENQ = (at, player) => ({ at, op: { type: 'loginEnqueue', player } });
const DEQ = (at) => ({ at, op: { type: 'loginDequeue' } });
const RECONNECT = (at, player) => ({ at, op: { type: 'loginReconnect', player } });
// p1 입장(tkt-1) → reconnect p1 재개(같은 티켓·ticketSeq 불변) → reconnect p2(미입장) 재개 실패.
const OPS = [
  ENQ(2, 'p1'), DEQ(3),
  RECONNECT(5, 'p1'),
  RECONNECT(6, 'p2'),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginOps: OPS };

function loginreconnect(seeds) {
  console.log('== loginreconnect: 로그인 큐 재접속 세션 재개(loginReconnect) — 유효 admitted player 면 기존 티켓 재개(새 티켓 미발급·멱등 resume). 만료/미발급이면 재개 불가(재큐 필요). 끊겼다 금방 돌아온 세션이 줄을 다시 안 선다. 2차 고도화 로그인 큐 #2·균형 라운드 닫기. ==');
  console.log('seed   | p1 티켓 | ticketSeq | resumes | misses | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 8, ...BASE });
    const q = r.loginqueue;
    // p1 입장 tkt-1 → reconnect p1 재개(같은 tkt-1·ticketSeq 1 불변·resumes 1) → reconnect p2 미입장(reconnectMisses 1).
    const ok = check(q.ticketOf('p1') === 'tkt-1' && q.ticketSeq === 1 && q.resumes === 1 && q.reconnectMisses === 1 && q.reconnects === 2 && q.admittedCount() === 1,
      `seed ${seed}: 재접속 위반 (p1 ${q.ticketOf('p1')}·seq ${q.ticketSeq}·resumes ${q.resumes}·misses ${q.reconnectMisses})`);
    console.log(`${pad(seed, 6)} | ${pad(q.ticketOf('p1') || '-', 7)} | ${pad(q.ticketSeq, 9)} | ${pad(q.resumes, 7)} | ${pad(q.reconnectMisses, 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 유효 티켓 player(p1) 재접속은 기존 티켓을 그대로 재개(같은 tkt-1·ticketSeq 1 불변=새 티켓 0·줄 다시 안 섬), 미입장 player(p2) 는 재개 실패(reconnectMisses 1·재큐 필요). 끊김에 강한 세션 연속성(재접속 토대). 로그인 큐 2차 고도화 #2 — 5박스 2차 균형 라운드(0211~0220) 닫기.');
}

kit.MODES['loginreconnect'] = loginreconnect;
kit.ORDER.splice(1, 0, 'loginreconnect');

(async () => { process.exit(await kit.cli(process.argv)); })();
