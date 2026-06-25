// HktInfra step-0269 — 헤드리스 검증 (정리 #49 인접·선제: svc-mailbox seen/epoch dedup 헬퍼 믹스인 분리·svc-mailbox-dedup.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mboxsplit`.
//   더한 한 조각: Mailbox 의 seen/epoch dedup 헬퍼(_pruneEpoch·epochKeyCount·_seenHas·_seenAdd·seenSize·_ack)를 svc-mailbox-dedup.js 믹스인으로 분리(Object.assign prototype). 정의 위치만 이동·기능 0 → 0268 비트 동일(reg). svc-mailbox.js 24.7KB→22.2KB.
//   검증: ⒜ `reg`(키트·비트 동일·투명 분할 증명). ⒝ `mboxsplit`(가설) — 중복 seq 전달이 멱등 dedup(received 유일·duplicates 1·seenSize 유계)·ack 재회신.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;
const { Mailbox } = NET;

// step-0269 정리 분할(#49 인접) 검증 — 수신함 dedup 헬퍼를 svc-mailbox-dedup 믹스인으로 위임한 뒤,
//   중복 seq 전달이 여전히 멱등 dedup(received 유일·duplicates 집계·seenSize 유계 흡수)되고 ack 가 재회신되는지 본다(투명 분할).
function mboxsplit(seeds) {
  console.log('== mboxsplit (0269 분할·#49 인접): 수신함 seen/epoch dedup 헬퍼를 svc-mailbox-dedup 믹스인으로 위임 — 중복 seq 전달 멱등 dedup(received 유일·duplicates 1·seenSize 0 유계 흡수)·ack 재회신·투명 분할(reg 0 가 비트 동일 증명). ==');
  console.log('seed   | received | dups | seenSize | acks | 판정');
  for (const seed of seeds) {
    const acks = [];
    const mb = new Mailbox({ dedupBound: true, addr: 'mbox' });
    mb.net = { send: (f, t, msg) => acks.push(msg) };   // 스텁 net(ack 수집)
    const deliver = (seq) => mb.onMsg({ from: 'r', payload: { type: 'whisperDeliver', from: 'r', body: 'b', seq, ackTo: 'router' } });
    deliver(1); deliver(2); deliver(1); deliver(3);   // seq1 중복
    const ok = check(mb.received === 3 && mb.duplicates === 1 && mb.seenSize() === 0 && acks.length === 4 && mb.epochKeyCount() === 1,
      `seed ${seed}: dedup 위반 (recv ${mb.received}·dups ${mb.duplicates}·seenSize ${mb.seenSize()}·acks ${acks.length})`);
    console.log(`${pad(seed, 6)} | ${pad(mb.received, 8)} | ${pad(mb.duplicates, 4)} | ${pad(mb.seenSize(), 8)} | ${pad(acks.length, 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
}

kit.MODES['mboxsplit'] = mboxsplit;
kit.ORDER.splice(1, 0, 'mboxsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
