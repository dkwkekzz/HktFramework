// HktInfra step-0146 — 헤드리스 검증 (우편 저널 스냅샷 압축·mailSnapshot — 스냅샷+tail == 전체 replay 비트 동일·저널 유계)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `exmail`.
//   더한 한 조각: 0145 저널은 무압축이라 무한 성장. 이 step 은 저널 N항(snapInterval)마다 projection 스냅샷+가지치기 → tail 만 유계 보관. reconstruct 는 스냅샷에서 출발해 tail 만 replay → 전체 replay 와 비트 동일(거래소 0110·가방 0018 의 우편 판·무손실 압축).
//   검증: ⒜ `reg`(키트) — mailSnapshot 0·mail OFF = 0145 비트 동일. ⒝ `exmail`(가설) — ① 압축 ON crash→reconstruct == 무압축 full == 라이브 *digest 비트 동일* ② 저널 길이 절감(유계) ③ 회계 정합.
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
// 8 op(7 send + 1 fetch) — snapInterval 3 이면 여러 번 스냅샷·tail 가지치기 발생.
const OPS = [
  SEND(8, 'm0', 'h0', 'h1', 'a'), SEND(9, 'm1', 'h2', 'h1', 'b'), SEND(10, 'm2', 'h0', 'h3', 'c'),
  SEND(11, 'm3', 'h0', 'h1', 'd'), FETCH(14, 'h1'), SEND(16, 'm4', 'h2', 'h3', 'e'),
  SEND(18, 'm5', 'h0', 'h5', 'f'), SEND(20, 'm6', 'h4', 'h3', 'g'),
];
const SNAP_INT = 3;

function exmail(seeds) {
  console.log('== exmail: 우편 저널 스냅샷 압축(mailSnapshot) — 저널 N항마다 projection 스냅샷+가지치기 → tail 만 보관. reconstruct(스냅샷+tail) == 무압축 full == 라이브 *비트 동일*(무손실 압축)·저널 유계. ==');
  console.log(`seed   | live | full(무압축) | snap+tail | tail길이(압축<full) | 비트동일3자 | 회계정합 | 판정`);
  for (const seed of seeds) {
    // 압축 ON: snapInterval=SNAP_INT. 무압축 full: snapInterval 0(전체 저널).
    const comp = run({ ...base(seed, { mailOps: OPS, mailPersist: true, mailSnapshot: SNAP_INT }) });
    const full = run({ ...base(seed, { mailOps: OPS, mailPersist: true, mailSnapshot: 0 }) });
    const live = comp.mail.digest();
    const fullJ = full.mail.journal.length;       // 무압축 = 전체 op 수
    const tailJ = comp.mail.journal.length;        // 압축 = tail 만(< full)
    const hasSnap = comp.mail.snapshot != null;
    // full reconstruct
    full.mail.crash(); full.mail.reconstruct(); const fullDig = full.mail.digest();
    // 압축 reconstruct(스냅샷+tail)
    comp.mail.crash(); comp.mail.reconstruct(); const compDig = comp.mail.digest();
    const same = (live === fullDig && fullDig === compDig);
    const compacted = (hasSnap && tailJ < fullJ);
    const acct = comp.mail.accountConsistent();
    const ok =
      check(same, `seed ${seed}: 3자 digest 불일치(live ${hex(live)}·full ${hex(fullDig)}·comp ${hex(compDig)})`) &&
      check(compacted, `seed ${seed}: 압축 안 됨(snap ${hasSnap}·tail ${tailJ}≥full ${fullJ})`) &&
      check(acct, `seed ${seed}: 회계 불일치`);
    console.log(`${pad(seed, 6)} | ${hex(live)} | ${pad(fullJ, 12)} | ${pad(tailJ, 9)} | ${pad(tailJ + '<' + fullJ, 19)} | ${pad(same ? '예' : '아니오', 11)} | ${pad(acct ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 압축은 *저널 쪽 일*(라이브 우편함 비-침습): snapInterval 마다 projection 을 스냅샷하고 그 이하 저널을 버려 tail 만 유계 보관. reconstruct 는 스냅샷에서 출발해 tail 만 replay → 전체 replay·라이브와 비트 동일(무손실). mailSnapshot 0 = 0145 비트 동일(reg).');
  console.log('    다음(0147): 읽음 확인 발행(mailReadPublish — svc.mail.read) — 수령(fetch)을 발행해 발신자/운영이 읽음 관측(수명주기 발행 확장).');
}

const base = (seed, extra) => ({ seed, ticks: 40, clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, mail: true, ...extra });

kit.MODES['exmail'] = exmail;
kit.ORDER.splice(1, 0, 'exmail');

(async () => { process.exit(await kit.cli(process.argv)); })();
