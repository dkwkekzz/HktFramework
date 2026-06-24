// HktInfra step-0210 — 헤드리스 검증 (로그인 티켓 만료·loginExpire·TTL)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `loginexpire`.
//   더한 한 조각: loginExpire{ttl} → issuedAt+ttl≤now 인 발급 티켓 회수(admitted 제거). 들고만 있고 안 쓰는 티켓 무효화(엣지 자원 보호). loginExpire 미주입 → 0209 비트 동일(reg). = 너비 1차 마지막 박스(로그인 큐) 기본 통신 완비.
//   검증: ⒜ `reg`(키트). ⒝ `loginexpire`(가설) — p1(issuedAt4)·p2(issuedAt6) 입장 → expire(ttl2)@7 → p1 만료(4+2≤7)·p2 생존(6+2>7).
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
const EXPIRE = (at, ttl) => ({ at, op: { type: 'loginExpire', ttl } });
// 시나리오: p1 입장(issuedAt 4)·p2 입장(issuedAt 6) → ttl2 만료 스윕@7: p1(4+2≤7) 만료·p2(6+2>7) 생존.
const OPS = [
  ENQ(2, 'p1'), ENQ(3, 'p2'),
  DEQ(4), DEQ(6),
  EXPIRE(7, 2),
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, loginQueue: true, loginOps: OPS };

function loginexpire(seeds) {
  console.log('== loginexpire: 로그인 티켓 만료(TTL) — issuedAt+ttl≤now 인 발급 티켓 회수(들고만 있고 안 쓰는 티켓 무효화·엣지 자원 보호). 로그인 큐 박스 기본 통신 완비(= 너비 1차 마지막 박스). ==');
  console.log('seed   | admitted | p1 ticket | p2 ticket | expired | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 9, ...BASE });
    const q = r.loginqueue;
    // p1(issuedAt 4)+ttl2=6≤7 → 만료(ticket null). p2(issuedAt 6)+ttl2=8>7 → 생존.
    const ok = check(q.admittedCount() === 1 && q.ticketOf('p1') === null && q.ticketOf('p2') === 'tkt-2' && q.expired === 1 && q.expires === 1,
      `seed ${seed}: 만료 위반 (admit ${q.admittedCount()}·p1 ${q.ticketOf('p1')}·p2 ${q.ticketOf('p2')}·expired ${q.expired})`);
    console.log(`${pad(seed, 6)} | ${pad(q.admittedCount(), 8)} | ${pad(q.ticketOf('p1') || '(만료)', 9)} | ${pad(q.ticketOf('p2') || '-', 9)} | ${pad(q.expired, 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → loginExpire 가 issuedAt+ttl≤now 인 티켓을 회수(p1 issuedAt4+ttl2=6≤7 만료, p2 issuedAt6+ttl2=8>7 생존) → admitted 1·expired 1. 들고만 있고 안 쓰는 티켓이 엣지 자원을 영영 안 묶는다(재접속/만료 토대). 로그인 큐 박스 기본 통신 완비 — **너비 1차 5박스(인스턴스·오케 배치·캐시·월드영속·로그인큐) 전부 기본 통신 도달**.');
}

kit.MODES['loginexpire'] = loginexpire;
kit.ORDER.splice(1, 0, 'loginexpire');

(async () => { process.exit(await kit.cli(process.argv)); })();
