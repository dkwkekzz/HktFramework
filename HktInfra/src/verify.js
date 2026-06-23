// HktInfra step-0143 — 헤드리스 검증 (우편 수령·mailFetch — held→fetched 무손실 이동·회계 sent==held+fetched)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 0142 는 입금만이라 우편함이 무한히 쌓였다. 이 step 은 수신자가 *가져가는* 경로(mailFetch)를 더한다 — 보유(held)→수령(fetched) 무손실 이동(이중 수령 0·빈 우편함 재수령 0). 회계가 sent==held+fetched 로 닫힌다(우편 1통은 매 순간 보유/수령 정확히 한 상태).
//   검증: ⒜ `reg`(키트) — mail OFF = 0142 비트 동일. ⒝ `exmail`(가설) — 입금 후 수령하면 held 감소·fetched 증가·sent 불변·accountConsistent·재수령 0통·결정론.
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
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, mail: true, ...extra });

function exmail(seeds) {
  console.log('== exmail: 우편 수령(mailFetch) — 수신자가 우편함 pull → 보유(held)→수령(fetched) 무손실 이동(이중 수령 0·빈 재수령 0통). 회계 sent==held+fetched(우편 1통은 매 순간 보유/수령 정확히 한 상태). ==');
  console.log('seed   | sent | h1수령후held | h1fetched | totalHeld | totalFetched | 재수령0 | 회계정합 | 판정');
  let digest0 = null;
  for (const seed of seeds) {
    // h1←(m0,m1)·h3←(m3). h1 만 수령(@20)·재수령(@24·0통)·h3 미수령(held 잔존).
    const ops = [
      SEND(10, 'm0', 'hero0', 'hero1', 'a'),
      SEND(12, 'm1', 'hero2', 'hero1', 'b'),
      SEND(14, 'm3', 'hero0', 'hero3', 'c'),
      FETCH(20, 'hero1'),   // h1 의 2통 수령 → held 0·fetched 2
      FETCH(24, 'hero1'),   // 빈 우편함 재수령 → 0통(이중 0)
    ];
    const r = run({ ...base(seed, { mailOps: ops }) });
    const mail = r.mail;
    const h1held = mail.held('hero1');         // 수령 후 0
    const h1fetched = mail.fetchedOf('hero1'); // 2
    const total = mail.totalHeld();            // h3 의 1통만 잔존
    const totalF = mail.fetched;               // 2
    const reFetchOk = (h1fetched === 2);       // 재수령이 더 늘리지 않음(2 유지)
    const acct = mail.accountConsistent();     // sent(3)==held(1)+fetched(2)
    const dig = mail.digest();
    if (digest0 == null) digest0 = dig; const detOk = (dig === digest0);
    const ok =
      check(mail.sent === 3, `seed ${seed}: sent ${mail.sent}!=3`) &&
      check(h1held === 0 && h1fetched === 2, `seed ${seed}: h1 held=${h1held}(≠0) fetched=${h1fetched}(≠2)`) &&
      check(total === 1 && totalF === 2, `seed ${seed}: totalHeld=${total}(≠1) totalFetched=${totalF}(≠2)`) &&
      check(reFetchOk, `seed ${seed}: 빈 우편함 재수령이 fetched 증가(${h1fetched})`) &&
      check(acct, `seed ${seed}: 회계 불일치 sent ${mail.sent}!=held ${total}+fetched ${totalF}`) &&
      check(detOk, `seed ${seed}: digest 비결정론`);
    console.log(`${pad(seed, 6)} | ${pad(mail.sent, 4)} | ${pad(h1held, 12)} | ${pad(h1fetched, 9)} | ${pad(total, 9)} | ${pad(totalF, 12)} | ${pad(reFetchOk ? '예' : '아니오', 7)} | ${pad(acct ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 수령은 보유→수령 *무손실 이동*(box.clear 후 read 보관) — 빈 우편함 재수령은 0통(이중 수령 0). 회계 sent==held+fetched 가 매 시드 성립(우편 1통은 매 순간 정확히 한 상태). mail OFF = 0142 비트 동일(reg).');
  console.log('    다음(0144): 발행(mailSentPublish — svc.mail.sent) — 입금을 버스로 발행해 audit/읽기 모델이 관측(거래소 0108 의 우편 판).');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
