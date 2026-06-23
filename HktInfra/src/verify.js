// HktInfra step-0171 — 헤드리스 검증 (정리: svc-mail-core 영속·failover 부품 분할 → svc-mail-persist.js)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `mailsplit`.
//   더한 한 조각: svc-mail-core.js(34.7KB>30KB·비대화 트리거)에서 영속·failover 메서드(_snapState/_restore/_journal/crash/reconstruct)를 svc-mail-persist.js 로 추출(Object.assign 프로토타입 증강·기능 0·바이트 동일·reg 0). 가방 svc-inventory-persist(0053)·우편 txn(0165) 와 동일 패턴.
//   검증: ⒜ `reg`(키트) — 전 시스템 0170 비트 동일(분할은 내부 파일 구조만). ⒝ `mailsplit`(가설) — 분할된 persist 부품으로 crash→reconstruct 가 죽기 전과 비트 동일(영속·압축 동작 보존·무압축/스냅샷 양 체제).
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
// 영속 시나리오(아이템 우편·수령·만료 혼합). snap: snapInterval(0=무압축·N=스냅샷 압축) — 분할된 _snapState/_restore 도 함께 자극.
const base = (seed, snap) => ({
  seed, ticks: 50, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true,
  inventory: true, mail: true, mailPersist: true, mailSnapshot: snap, mailItem: true, mailInv: true, mailSaga: true, sagaDedup: true, mailTtl: 10,
  invOps: [PICK(2, 'x'), PICK(3, 'x'), PICK(4, 'x')],
  mailOps: [SEND(5, 'a', 'x', 'h1', '1', 'item0'), SEND(6, 'b', 'x', 'h2', '2', 'item1'), SEND(28, 'c', 'x', 'h4', '3', 'item2'), FETCH(15, 'h1'), SWEEP(30)],
});

function mailsplit(seeds) {
  console.log('== mailsplit: *정리* — svc-mail-core 영속·failover 부품(_snapState/_restore/_journal/crash/reconstruct)을 svc-mail-persist.js 로 추출. 분할이 동작을 보존하는가? crash→reconstruct 가 죽기 전과 비트 동일(무압축·스냅샷 압축 양 체제). 가방 svc-inventory-persist(0053) 의 우편 판. ==');
  console.log('seed   | 무압축 pre==post | 스냅샷 pre==post | tail<full | 판정');
  for (const seed of seeds) {
    // 무압축(저널 전체 replay)
    const r0 = run(base(seed, 0));
    const pre0 = r0.mail.digest(); const full = r0.mail.journal.length;
    r0.mail.crash(); r0.mail.reconstruct();
    const ok0 = r0.mail.digest() === pre0;
    // 스냅샷 압축(스냅샷+tail replay) — 분할된 _snapState/_restore 경로
    const rs = run(base(seed, 2));
    const pres = rs.mail.digest(); const tail = rs.mail.journal.length;
    rs.mail.crash(); rs.mail.reconstruct();
    const oks = rs.mail.digest() === pres;
    const tailOk = tail < full;   // 스냅샷이 저널을 가지치기(압축 — tail 만 보관)
    const ok =
      check(ok0, `seed ${seed}: 무압축 reconstruct 비트 불일치`) &&
      check(oks, `seed ${seed}: 스냅샷 reconstruct 비트 불일치`) &&
      check(tailOk, `seed ${seed}: 스냅샷 압축 안 됨(tail ${tail} >= full ${full})`);
    console.log(`${pad(seed, 6)} | ${pad(ok0 ? '예' : '아니오', 16)} | ${pad(oks ? '예' : '아니오', 16)} | ${pad(tail + '<' + full, 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 영속·failover 메서드를 별 부품 파일로 떼냈지만, crash(projection 소실)→reconstruct(저널 replay)가 여전히 죽기 전과 비트 동일하다 — 분할은 내부 파일 구조만 바꾸고 동작은 불변(Object.assign 프로토타입 증강). 무압축(전체 replay)·스냅샷 압축(_snapState/_restore→tail replay) 양 경로 모두 보존. reg(전 시스템 0170 비트 동일)와 함께 정리 step 의 회귀 0 을 닫는다.');
}

kit.MODES['mailsplit'] = mailsplit;
kit.ORDER.splice(1, 0, 'mailsplit');

(async () => { process.exit(await kit.cli(process.argv)); })();
