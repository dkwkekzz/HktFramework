// HktInfra step-0175 — 헤드리스 검증 (정리: svc-mail-core 누적 step-주석 헤더 압축)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailhdr`.
//   더한 한 조각: svc-mail-core.js(34KB>30KB·헤더 17KB=파일 절반)에서 중복 step-역사 주석(0142~0174·각 step-NNNN.md 가 SSOT)을 *구조+최근 delta* 압축 인덱스로 갈음(코드·동작 불변·reg 0·34→18.6KB). 영속 부품 분할(0171)에 이은 헤더 압축 — STATE §1~6 압축의 소스 판.
//   검증: ⒜ `reg`(키트) — 주석만 변경 = 0174 비트 동일(전 시스템). ⒝ `mailhdr`(가설) — saga 시나리오서 src(압축) vs baseline(0174) 우편 digest + saga 회계 비트 동일(주석 압축이 동작 0 변경).
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
// 아이템 우편·수령·만료·saga(포기 발행) 혼합 — 우편 박스의 거의 모든 경로를 자극.
const base = (seed) => ({
  seed, ticks: 70, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true,
  inventory: true, mail: true, mailPersist: true, mailSnapshot: 4, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true,
  mailTtl: 10, mailAutoRetry: true, mailMaxRetries: 2, mailAbandonPublish: true,
  invOps: [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SEND(28, 'c', 'x', 'h4', '3', 'item2'), FETCH(15, 'h1'), SWEEP(30), SWEEP(40), SWEEP(50)],
});

function mailhdr(seeds) {
  console.log('== mailhdr: *정리* — svc-mail-core 누적 step-주석 헤더 압축(34→18.6KB·헤더 17KB=중복 역사→각 step-NNNN.md 가 SSOT). 코드·동작 불변? src(압축) vs baseline(0174) 우편 digest + saga 회계 비트 동일. ==');
  console.log('seed   | src mail digest | prev mail digest | gives/abandoned | 동일 | 판정');
  for (const seed of seeds) {
    const cur = NET.run(base(seed));
    const prev = NETPREV.run(base(seed));
    const dCur = cur.mail.digest(), dPrev = prev.mail.digest();
    const acctSame = cur.mail.gives === prev.mail.gives && cur.mail.giveAbandoned === prev.mail.giveAbandoned && cur.mail.sagaConsistent() === prev.mail.sagaConsistent();
    const same = dCur === dPrev && acctSame;
    const ok = check(same, `seed ${seed}: 압축 후 동작 변경(digest ${dCur.toString(16)} vs ${dPrev.toString(16)}·acct ${acctSame})`);
    console.log(`${pad(seed, 6)} | ${pad('0x' + dCur.toString(16), 15)} | ${pad('0x' + dPrev.toString(16), 16)} | ${pad(cur.mail.gives + '/' + cur.mail.giveAbandoned, 15)} | ${pad(same ? '예' : '아니오', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 중복된 per-step 역사 주석(0142~0174·step-NNNN.md 가 역사의 SSOT)을 구조+최근 delta 압축 인덱스로 갈음했다. 코드는 한 줄도 안 바뀌어 src(압축) 우편 digest·saga 회계가 baseline(0174)과 비트 동일 — 박스 크기를 유계로 묶되(34→18.6KB) 동작은 0 변경. STATE §1~6 압축의 소스 코드 판·영속 분할(0171)에 이은 두 번째 우편 정리. reg(전 시스템)와 함께 회귀 0.');
}

kit.MODES['mailhdr'] = mailhdr;
kit.ORDER.splice(1, 0, 'mailhdr');

(async () => { process.exit(await kit.cli(process.argv)); })();
