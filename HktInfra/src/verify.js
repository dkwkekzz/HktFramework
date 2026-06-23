// HktInfra step-0148 — 헤드리스 검증 (우편 만료 TTL·mailTtl — now−sentAt≥ttl 자동 회수·회계 sent==held+fetched+expired)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 미수령 우편이 영영 쌓일 수 있다(0143 한계). 이 step 은 mailSweep(now) 가 now−sentAt≥ttl 미수령 우편을 시간 트리거로 회수(보유→만료·거래소 0114 의 우편 판). 회계가 sent==held+fetched+expired 로 완비.
//   검증: ⒜ `reg`(키트) — ttl 0·mail OFF = 0147 비트 동일. ⒝ `exmail`(가설) — 오래된 미수령 우편 만료·신선/수령 우편 불변·sent==held+fetched+expired·만료 저널 reconstruct 정합·ttl 0 만료 0(대조군).
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad, hex } = kit.helpers;

const SEND = (at, id, from, to, body) => ({ at, op: { type: 'mailSend', id, from, to, body } });
const FETCH = (at, to) => ({ at, op: { type: 'mailFetch', to } });
const SWEEP = (at) => ({ at, op: { type: 'mailSweep' } });   // now = 주입 tick
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, mail: true, ...extra });
// m0/m1→h1(수령)·m2→h3(오래됨·만료)·m3→h5(신선·생존). sweep@35·ttl 10.
const OPS = [
  SEND(5, 'm0', 'h0', 'h1', 'a'), SEND(8, 'm1', 'h2', 'h1', 'b'), SEND(12, 'm2', 'h0', 'h3', 'c'),
  FETCH(20, 'h1'), SEND(30, 'm3', 'h0', 'h5', 'd'), SWEEP(35),
];
const TTL = 10;

function exmail(seeds) {
  console.log('== exmail: 우편 만료 TTL(mailTtl·now−sentAt≥ttl) — mailSweep 가 오래된 미수령 우편을 시간 트리거로 회수(보유→만료). 신선/수령 우편 불변·회계 sent==held+fetched+expired·만료 저널 reconstruct 정합·ttl 0 만료 0. ==');
  console.log('seed   | sent | fetched | expired | held | 회계정합 | reconstruct==live | ttl0만료0 | 판정');
  for (const seed of seeds) {
    const on = run({ ...base(seed, { mailOps: OPS, mailTtl: TTL, mailPersist: true }) });
    const mail = on.mail;
    const live = mail.digest();
    // 만료 후 회계: sent 4·fetched 2(m0,m1)·expired 1(m2·35-12=23≥10)·held 1(m3·35-30=5<10 생존)
    const acct = mail.accountConsistent();
    mail.crash(); mail.reconstruct(); const recon = mail.digest();
    const reconOk = (recon === live);
    // 대조군: ttl 0 → sweep no-op → 만료 0(미수령 m2 잔존)
    const off = run({ ...base(seed, { mailOps: OPS, mailTtl: 0, mailPersist: true }) });
    const ttl0NoExp = (off.mail.expired === 0);
    const ok =
      check(mail.sent === 4 && mail.fetched === 2 && mail.expired === 1 && mail.totalHeld() === 1,
        `seed ${seed}: sent ${mail.sent}/fetched ${mail.fetched}/expired ${mail.expired}/held ${mail.totalHeld()} (기대 4/2/1/1)`) &&
      check(acct, `seed ${seed}: 회계 불일치 sent ${mail.sent}!=held+fetched+expired`) &&
      check(reconOk, `seed ${seed}: reconstruct≠live(${hex(recon)}≠${hex(live)})`) &&
      check(ttl0NoExp, `seed ${seed}: ttl 0 인데 만료 ${off.mail.expired}(≠0)`);
    console.log(`${pad(seed, 6)} | ${pad(mail.sent, 4)} | ${pad(mail.fetched, 7)} | ${pad(mail.expired, 7)} | ${pad(mail.totalHeld(), 4)} | ${pad(acct ? '예' : '아니오', 8)} | ${pad(reconOk ? '예' : '아니오', 17)} | ${pad(ttl0NoExp ? '예' : '아니오', 9)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 만료는 *시간 트리거*(now−sentAt≥ttl): mailSweep 가 오래된 미수령 우편만 회수(수령된 m0/m1·신선한 m3 불변). 회계 sent==held+fetched+expired 로 완비 — 우편 1통은 매 순간 보유/수령/만료 정확히 한 상태. 만료도 durable op 라 reconstruct 정합. ttl 0·mail OFF = 0147 비트 동일(reg).');
  console.log('    다음(0149): 만료 발행(mailExpirePublish — svc.mail.expired) — 만료를 발행해 발신자/운영 관측(수명주기 발행 3종 완비·거래소 류).');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
