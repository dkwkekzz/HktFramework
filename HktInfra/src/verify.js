// HktInfra step-0145 — 헤드리스 검증 (우편 영속·failover·mailPersist — op 저널 replay → crash 후 우편함 비트 동일 재구성)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 0142~0144 우편함은 자기 영속 0 — crash 시 보유·수령이 전부 휘발. 이 step 은 send/fetch op 를 durable 저널에 기록하고, crash(projection 소실) 후 replay 해 우편함+읽음+회계를 *죽기 전과 비트 동일*하게 재구성(가방 0017·거래소 0109 의 우편 판·event sourcing).
//   검증: ⒜ `reg`(키트) — mailPersist OFF·mail OFF = 0144 비트 동일. ⒝ `exmail`(가설) — ① crash 후 reconstruct == 무crash *digest 비트 동일* ② persist OFF → reconstruct 빈 투영(소실·대조군) ③ 회계 정합 보존.
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
const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, mail: true, ...extra });
// 입금 5통(h1←3·h3←1·h5←1) + h1 수령 → 보유·수령·회계가 골고루 채워진 상태.
const OPS = [
  SEND(10, 'm0', 'h0', 'h1', 'a'), SEND(11, 'm1', 'h2', 'h1', 'b'), SEND(12, 'm2', 'h0', 'h1', 'c'),
  FETCH(20, 'h1'), SEND(22, 'm3', 'h0', 'h3', 'd'), SEND(24, 'm4', 'h2', 'h5', 'e'),
];

function exmail(seeds) {
  console.log('== exmail: 우편 영속·failover(mailPersist·op 저널 replay) — crash(projection 소실) 후 저널 replay → 우편함+읽음+회계 *죽기 전과 비트 동일* 재구성(event sourcing). persist OFF → 소실(대조군). ==');
  console.log('seed   | pre-digest | crash후(빈) | reconstruct digest | 비트동일 | OFF소실 | 회계정합 | 판정');
  for (const seed of seeds) {
    const on = run({ ...base(seed, { mailOps: OPS, mailPersist: true }) });
    const mail = on.mail;
    const pre = mail.digest();
    const journalN = mail.journal.length;
    mail.crash();
    const crashed = mail.digest();   // 빈 투영 digest(보유·수령 0)
    const emptyOk = (mail.totalHeld() === 0 && mail.fetched === 0 && mail.sent === 0);
    mail.reconstruct();
    const post = mail.digest();
    const same = (post === pre);
    const acct = mail.accountConsistent();
    // 대조군: persist OFF → crash 후 reconstruct 해도 저널 0 → 빈 투영(소실)
    const off = run({ ...base(seed, { mailOps: OPS, mailPersist: false }) });
    off.mail.crash(); off.mail.reconstruct();
    const offLost = (off.mail.digest() !== pre);
    const ok =
      check(journalN > 0, `seed ${seed}: 저널 비어있음(persist 무동작)`) &&
      check(emptyOk, `seed ${seed}: crash 가 투영을 안 비움`) &&
      check(same, `seed ${seed}: reconstruct≠pre (${hex(post)}≠${hex(pre)})`) &&
      check(offLost, `seed ${seed}: persist OFF 인데 소실 안 함(영속 없이 복구?)`) &&
      check(acct, `seed ${seed}: reconstruct 후 회계 불일치`);
    console.log(`${pad(seed, 6)} | ${hex(pre)} | ${pad(emptyOk ? 'held0' : '비움실패', 11)} | ${hex(post)} | ${pad(same ? '예' : '아니오', 8)} | ${pad(offLost ? '예' : '아니오', 7)} | ${pad(acct ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 우편함은 *자기 영속*(op 저널)을 갖는다: crash 가 projection(우편함·읽음·회계)만 소실시켜도 durable 저널 replay 가 죽기 전과 *비트 동일*하게 재구성한다(send→적재·fetch→그 시점 보유 이동). 발행(sentPublish)은 replay 에서 안 함(파생 스트림·이중 0). persist OFF → 저널 0 → 소실(영속 부재의 대가). mail OFF = 0144 비트 동일(reg).');
  console.log('    다음(0146): 저널 스냅샷 압축(mailSnapshot) — 저널 N항마다 스냅샷·tail 만 보관(거래소 0110 의 우편 판).');
}

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
