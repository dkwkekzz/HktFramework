// HktInfra step-0166 — 헤드리스 검증 (아이템 우편 saga 회신 비동기 수신·mailSaga·ackedGives)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmlsaga`.
//   더한 한 조각: mailSaga ON 이면 _custody 가 give 에 replyTo+cause 를 실어 가방이 item_result 를 우편으로 echo → ackedGives/giveOks/giveFails 집계(거래소 0121 의 우편 판).
//   검증: ⒜ `reg`(키트) — mailSaga OFF·replyTo 부재 = 0165 비트 동일. ⒝ `exmlsaga`(가설) — ON: 무손실서 gives==ackedGives==giveOks(닫힌 고리 liveness)·OFF: ackedGives 0(fire-and-forget).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const PICK = (at, avatar) => ({ at, op: { type: 'item_req', op: 'pickup', avatar } });
const SEND = (at, id, from, to, body, item) => ({ at, op: { type: 'mailSend', id, from, to, body, item } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });
// 3 레그 전부 자극(발신·수령·만료) — give 4건(발신2+수령1+만료1) 모두 회신 받아야.
const base = (seed, saga) => ({
  seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailItem: true, mailInv: true, mailSaga: saga, mailTtl: 10,
  invOps: [PICK(2, 'x'), PICK(3, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), FETCH(15, 'h1'), SWEEP(30)],
});

function exmlsaga(seeds) {
  console.log('== exmlsaga: 아이템 우편 saga 회신 비동기 수신(mailSaga·ackedGives). 가방 give 가 fire-and-forget(0161~0164)에서 *회신 받는 닫힌 고리*로 — 무손실서 gives==ackedGives==giveOks(거래소 0121 의 우편 판). ==');
  console.log('seed   | ON gives/acked/oks/fails | OFF acked | 닫힌 고리(gives==acked) | 판정');
  for (const seed of seeds) {
    const on = run(base(seed, true));
    const off = run(base(seed, false));
    const onOk = (on.mail.gives === 4 && on.mail.ackedGives === 4 && on.mail.giveOks === 4 && on.mail.giveFails === 0);
    const offOk = (off.mail.ackedGives === 0 && off.mail.giveOks === 0);
    const ok =
      check(onOk, `seed ${seed}: ON 닫힌 고리 어긋남(gives ${on.mail.gives}·acked ${on.mail.ackedGives}·oks ${on.mail.giveOks}·fails ${on.mail.giveFails})`) &&
      check(offOk, `seed ${seed}: OFF 회신 누설(acked ${off.mail.ackedGives})`);
    console.log(`${pad(seed, 6)} | ${pad(on.mail.gives + '/' + on.mail.ackedGives + '/' + on.mail.giveOks + '/' + on.mail.giveFails, 24)} | ${pad(off.mail.ackedGives, 9)} | ${pad(on.mail.gives === on.mail.ackedGives ? '예' : '아니오', 22)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → mailSaga ON: 우편이 보낸 모든 give(발신 인출2+수령 입금1+만료 반환1=4)가 가방 item_result 회신을 받아 ackedGives 4·giveOks 4(정상 소유라 실패 0). 무손실서 gives==ackedGives = 닫힌 고리 liveness(어느 give 도 응답 미수신으로 새지 않음). OFF: 회신 채널 휴면(fire-and-forget·ackedGives 0).');
  console.log('    회신 손실 감지(미해결 추적·재전송)는 후속(0167~·거래소 0125~0126 류) — 지금은 무손실 가정. give↔가방 transfers capstone(giveOks==escrowXfers 0170) 후속.');
}

kit.MODES['exmlsaga'] = exmlsaga;
kit.ORDER.splice(1, 0, 'exmlsaga');

(async () => { process.exit(await kit.cli(process.argv)); })();
