// HktInfra step-0441 — 헤드리스 검증 (#4 실 net.step 배리어 치환 1: 실 Net 메시지 intent 스트림 + Lamport 스탬프)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `netintent`.
//   더한 한 조각: 신규 박스 async-net.js — 다중 client(발신 site)가 각자 Lamport 클럭으로 실 Net-형 intent 메시지 발신
//   (from:'client'+s → to:'zone1' payload:{type:'intent',avatar,dx,dy}) + program-order 간선. async-core substrate 를
//   *실 전송 메시지*에 잇는 첫 조각. async-net 은 run() 밖 substrate → reg 구조적 0.
//   검증: ⒜ `reg`. ⒝ `netintent` — 결정론(같은 seed 동일 streamSig)·per-client lc 단조·clock condition(program 간선) 위반 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

// step-0441 #4 실 net.step 배리어 치환 1 — netintent: 실 Net-형 intent 스트림 결정론·per-client lc 단조·clock condition 0.
function netintent(seeds) {
  console.log('== netintent (0441·#4 배리어 치환 1): 실 Net-형 intent 스트림 + Lamport 스탬프 — 결정론·lc 단조·clock condition 0. ==');
  console.log('seed   | 이벤트 | client | lc단조 | clock위반 | 재현(streamSig) | 판정');
  for (const seed of seeds) {
    const opts = { clients: 4, avatars: 4, msgs: 40 };
    const a = NET.worldIntentStream(seed, opts);
    const b = NET.worldIntentStream(seed, opts);   // 재현 — 같은 seed 동일 스트림
    // per-client lc 단조: 같은 site 연속 이벤트의 lc 가 엄격 증가.
    const lastLc = {}; let monotone = true;
    for (const e of a.events) { if (lastLc[e.site] != null && !(e.lc > lastLc[e.site])) monotone = false; lastLc[e.site] = e.lc; }
    const clockViol = NET.clockConditionViolations(a.events, a.edges);   // program 간선 a→b ⇒ lc(a)<lc(b)
    const repro = NET.streamSig(a.events) === NET.streamSig(b.events);
    const ok = check(monotone && clockViol === 0 && repro && a.events.length === opts.msgs,
      `seed ${seed}: monotone ${monotone}·clock ${clockViol}·repro ${repro}`);
    console.log(`${pad(seed, 6)} | ${pad(a.events.length, 6)} | ${pad(opts.clients, 6)} | ${pad(monotone ? 'Y' : 'N', 6)} | ${pad(clockViol, 9)} | ${pad(repro ? 'Y' : 'N', 15)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['netintent'] = netintent;
kit.ORDER.splice(1, 0, 'netintent');

(async () => { process.exit(await kit.cli(process.argv)); })();
