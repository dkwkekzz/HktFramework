// HktInfra step-0165 — 헤드리스 검증 (정리: svc-mail.js 박스-부품 분할 core/txn/entry — 기능 0·바이트 동일·reg 0)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 모드 = `mailsplit`(분할 동작 보존 단언).
//   더한 한 조각: 없음(정리) — svc-mail.js(>30KB 비대화 트리거)를 svc-mail-core.js(원장 코어)·svc-mail-txn.js(onMsg 핸들러)·svc-mail.js(진입점)로 재분할. 거래소 0124·가방 0053 패턴.
//   검증: ⒜ `reg`(키트) — 분할 후 src 가 baseline(0164) 과 비트 동일. ⒝ `mailsplit`(가설) — 우편 시나리오를 NET(분할)·NETPREV(0164 동결)서 돌려 mail digest 비트 동일(래퍼만 바뀜).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { check, pad } = kit.helpers;

const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
// 우편 전 기능 자극 — 발신/수령/만료/아이템 첨부/가방 custody 3 레그.
const base = (seed) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailTtl: 10,
  invOps: [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SEND(28, 'c', 'x', 'h4', '3', 'item2'), FETCH(15, 'h1'), SWEEP(30)],
});

function mailsplit(seeds) {
  console.log('== mailsplit: 정리 분할 동작 보존 — svc-mail.js(>30KB) → core/txn/entry 3 부품. 우편 전 기능(발신·수령·만료·아이템 custody 3 레그)을 NET(분할)·NETPREV(0164 동결)서 돌려 mail digest 비트 동일(래퍼만 바뀜·기능 0). ==');
  console.log('seed   | NET mail digest | NETPREV(0164) | escrowIds | 비트 동일 | 판정');
  for (const seed of seeds) {
    const a = NET.run(base(seed));
    const b = NETPREV.run(base(seed));
    const da = a.mail.digest(); const db = b.mail.digest();
    const same = (da === db && a.mail.gives === b.mail.gives && a.inventory.escrowXfers === b.inventory.escrowXfers);
    const ok = check(same, `seed ${seed}: 분할 후 mail digest 불일치(NET 0x${da.toString(16)} != NETPREV 0x${db.toString(16)})`);
    console.log(`${pad(seed, 6)} | ${pad('0x' + da.toString(16), 15)} | ${pad('0x' + db.toString(16), 13)} | ${pad(a.mail.escrowItemIds().join(','), 9)} | ${pad(same ? '예' : '아니오', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → svc-mail.js 가 30KB 를 넘어(박스 1개=파일 1개 유계·비대화 트리거) core(원장·헬퍼·accessor)·txn(onMsg 핸들러)·entry(묶음)로 재분할 — export 집합·동작 불변. 거래소 0124·가방 0053·whisper 0094 의 우편 판. 다음 기능 step(아이템 우편 saga)을 위한 헤드룸 확보.');
}

kit.MODES['mailsplit'] = mailsplit;
kit.ORDER.splice(1, 0, 'mailsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
