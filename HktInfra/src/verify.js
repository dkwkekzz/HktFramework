// HktInfra step-0193 — 헤드리스 검증 (길드 금고 변경 발행·guildBankPublish·svc.guild.bank.changed)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankpublish`.
//   더한 한 조각: 예치/인출 성사 시 svc.guild.bank.changed{guildId,kind,itemId,member} 발행 → audit 구독. no-op 은 발행 안 함(발행==실 변경). bankPublish OFF·bus 부재면 0192 비트 동일(reg). 거래소 0108·길드 변경 발행 0183 의 금고 판.
//   검증: ⒜ `reg`(키트) — 0192 비트 동일. ⒝ `guildbankpublish`(가설) — 발행 수==audit 수신==실 변경 수·no-op 발행 0·OFF 발행 0.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run } = NET;
const { check, pad } = kit.helpers;

const GCREATE = (at, guildId, master, members) => ({ at, op: { type: 'guildCreate', guildId, master, members } });
const GDEPOSIT = (at, guildId, member, itemId) => ({ at, op: { type: 'guildDeposit', guildId, member, itemId } });
const GWITHDRAW = (at, guildId, member, itemId) => ({ at, op: { type: 'guildWithdraw', guildId, member, itemId } });
// 시나리오: 결성·예치 2(성사)·중복 예치(no-op)·인출 1(성사)·없는 인출(no-op)·비멤버 예치(no-op) → 실 변경 3.
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2']),
  GDEPOSIT(4, 'g1', 'x', 'sword'), GDEPOSIT(5, 'g1', 'c1', 'shield'),
  GDEPOSIT(6, 'g1', 'x', 'sword'),       // 중복 → 발행 안 함.
  GWITHDRAW(7, 'g1', 'c2', 'sword'),     // 성사 → 발행.
  GWITHDRAW(8, 'g1', 'c1', 'gem'),       // 없는 itemId → 발행 안 함.
  GDEPOSIT(9, 'g1', 'c9', 'gem'),        // 비멤버 → 발행 안 함.
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, audit: true };

function guildbankpublish(seeds) {
  console.log('== guildbankpublish: 금고 변경(예치/인출) 발행 — svc.guild.bank.changed 를 audit 가 구독. no-op(중복·없는 인출·비멤버) 발행 안 함(발행==실 변경). OFF 면 발행 0. 거래소 0108·길드 변경 발행 0183 의 금고 판. ==');
  console.log('seed   | ON pub | audit rx | OFF pub | pub==rx==실변경3 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 11, ...BASE, guildBankPublish: true, guildOps: OPS });
    const off = run({ seed, ticks: 11, ...BASE, guildBankPublish: false, guildOps: OPS });
    const rx = on.audit.seen.get('svc.guild.bank.changed') || 0;
    const okShape = on.guild.bankPublished === 3 && rx === 3 && off.guild.bankPublished === 0;
    const ok = check(okShape, `seed ${seed}: 발행 위반 (ON ${on.guild.bankPublished}·rx ${rx}·OFF ${off.guild.bankPublished})`);
    console.log(`${pad(seed, 6)} | ${pad(on.guild.bankPublished, 6)} | ${pad(rx, 8)} | ${pad(off.guild.bankPublished, 7)} | ${pad(okShape ? '예' : '아니오', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 실제 금고 변동(예치 2·인출 1 = 3)만 svc.guild.bank.changed 로 발행되고 발행자 무수정 소비자(audit)가 정확히 그 수를 수신(pub==rx==3). no-op(중복 예치·없는 인출·비멤버)은 발행 안 함 → 발행==실 변경. OFF 면 발행 0(0192 비트 동일). 거래소 체결 발행 0108·길드 멤버십 변경 발행 0183 의 금고 판.');
}

kit.MODES['guildbankpublish'] = guildbankpublish;
kit.ORDER.splice(1, 0, 'guildbankpublish');

(async () => { process.exit(await kit.cli(process.argv)); })();
