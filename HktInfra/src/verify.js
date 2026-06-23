// HktInfra step-0147 — 헤드리스 검증 (우편 읽음 확인 발행·mailReadPublish — svc.mail.read·audit 무수정 관측)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 0144 는 입금만 발행 — 수령(읽음)은 관측 불가였다. 이 step 은 mailFetch 수령 시 통마다 svc.mail.read 발행 → audit 가 읽음 관측(수명주기 발행 확장). 우편함 권위 불변(발행=파생 스트림).
//   검증: ⒜ `reg`(키트) — mailReadPublish OFF·mail OFF = 0146 비트 동일. ⒝ `exmail`(가설) — ON: readPublished==fetched==audit.seen(svc.mail.read)·발행이 우편함 불변·OFF: 발행 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const SEND = (at, id, from, to, body) => ({ at, op: { type: 'mailSend', id, from, to, body } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, audit: true, mail: true, ...extra });
// h1←3통·h3←1통. h1 수령(3통)·h3 미수령 → fetched 3.
const OPS = [
  SEND(10, 'm0', 'h0', 'h1', 'a'), SEND(11, 'm1', 'h2', 'h1', 'b'), SEND(12, 'm2', 'h0', 'h1', 'c'),
  SEND(13, 'm3', 'h0', 'h3', 'd'), FETCH(20, 'h1'),
];

function exmail(seeds) {
  console.log('== exmail: 우편 읽음 확인 발행(mailReadPublish·svc.mail.read) — 수령 통마다 발행, audit(무수정 소비자)가 읽음 관측. ON: readPublished==fetched==audit.seen·발행이 우편함 불변. OFF: 발행 0. ==');
  console.log('seed   | fetched | readPublished | audit(svc.mail.read) | totalHeld | OFF발행0 | 발행불변 | 판정');
  for (const seed of seeds) {
    const on = run({ ...base(seed, { mailOps: OPS, mailReadPublish: true }) });
    const off = run({ ...base(seed, { mailOps: OPS, mailReadPublish: false }) });
    const mOn = on.mail, mOff = off.mail;
    const fetched = mOn.fetched;                              // 3
    const pub = mOn.readPublished;                            // 3
    const seen = on.audit.seen.get('svc.mail.read') || 0;     // 3
    const offPub = mOff.readPublished;                        // 0
    const heldSame = (mOn.totalHeld() === mOff.totalHeld() && mOn.fetched === mOff.fetched);   // 발행 ON/OFF 우편함·수령 동일(비-침습)
    const ok =
      check(fetched === 3 && pub === 3, `seed ${seed}: fetched ${fetched}·published ${pub}(≠3)`) &&
      check(seen === 3, `seed ${seed}: audit svc.mail.read ${seen}(≠3)`) &&
      check(offPub === 0, `seed ${seed}: OFF 발행 ${offPub}(≠0)`) &&
      check(heldSame, `seed ${seed}: 발행이 상태 변경(held/fetched ON≠OFF)`);
    console.log(`${pad(seed, 6)} | ${pad(fetched, 7)} | ${pad(pub, 13)} | ${pad(seen, 20)} | ${pad(mOn.totalHeld(), 9)} | ${pad(offPub === 0 ? '예' : '아니오', 8)} | ${pad(heldSame ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 읽음 발행은 수명주기 발행 확장(입금 svc.mail.sent 0144 의 짝): 수령 통마다 svc.mail.read 발행, audit 는 구독 행 추가만으로 관측(발행자 무수정). 발행은 우편함 권위 불변(비-침습·readPublished==fetched==audit.seen). OFF·bus 부재면 발행 0 = 0146 비트 동일(reg).');
  console.log('    다음(0148): 만료 TTL(mailTtl — now−sentAt≥ttl 자동 회수) — 미수령 우편을 시간 트리거로 만료(거래소 0114 의 우편 판·회계 sent==held+fetched+expired).');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
