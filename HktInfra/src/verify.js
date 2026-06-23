// HktInfra step-0165 — 헤드리스 검증 (아이템 우편 give 결과 비동기 수신·mailSaga — replyTo+gid·pending drain)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlsaga`.
//   더한 한 조각: mailSaga ON 이면 _custody 가 give 에 replyTo+gid 를 실어 가방 회신을 받고 acked(ok/fail) 집계·미해결(pending) 추적(거래소 0121 exchSaga 의 우편 판).
//   검증: ⒜ `reg`(키트) — mailSaga OFF = 0164 비트 동일(가방 회신 0). ⒝ `exmlsaga`(가설) — 무손실서 acked==gives·ackedOk==gives·pending 0 drain.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const base = (seed, mailOps, invOps, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, inventory: true, mail: true, mailItem: true, mailInv: true, mailSaga: true, mailPersist: true, mailOps, invOps, ...extra });

function exmlsaga(seeds) {
  console.log('== exmlsaga: 아이템 우편 give 결과 비동기 수신(mailSaga·replyTo+gid). 가방 회신으로 acked 집계·미해결 pending 추적(거래소 0121 의 우편 판). 무손실서 pending 0 drain. ==');
  console.log('seed   | gives | acked | ackedOk | pending | gives==acked·pending0 | 판정');
  for (const seed of seeds) {
    // x 가 item0·item1 pickup → h1 로 둘 발신(2 give)·h1 수령(2 give·둘 다 입금) = 4 give 전부 성공 회신.
    const invOps = [PICK(3, 'x'), PICK(4, 'x')];
    const mailOps = [SEND(8, 'a', 'x', 'h1', '1', 'item0'), SEND(9, 'b', 'x', 'h1', '2', 'item1'), FETCH(20, 'h1')];
    const r = run(base(seed, mailOps, invOps));
    const mail = r.mail;
    const drained = mail.acked === mail.gives && mail.ackedOk === mail.gives && mail.pending.size === 0;
    const ok =
      check(mail.gives === 4, `seed ${seed}: gives ${mail.gives}≠4(발신2+수령2)`) &&
      check(drained, `seed ${seed}: saga 미drain(acked ${mail.acked}·ackedOk ${mail.ackedOk}·pending ${mail.pending.size})`);
    console.log(`${pad(seed, 6)} | ${pad(mail.gives, 5)} | ${pad(mail.acked, 5)} | ${pad(mail.ackedOk, 7)} | ${pad(mail.pending.size, 7)} | ${pad(drained ? '예' : '아니오', 21)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편이 가방 give 결과를 *비동기로 받는다*: replyTo+gid 로 item_result 회신→acked(ok/fail) 집계·미해결 pending 추적(거래소 0121 의 우편 판). 무손실서 모든 give 가 acked·pending 0 으로 drain(닫힌 고리 liveness). 실패 보상(0166)·회신 손실 재전송(0167) 후속. mailSaga OFF=0164 비트 동일(reg).');
}

kit.MODES['exmlsaga'] = exmlsaga;
kit.ORDER.splice(1, 0, 'exmlsaga');

(async () => { process.exit(await kit.cli(process.argv)); })();
