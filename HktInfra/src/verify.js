// HktInfra step-0198 — 헤드리스 검증 (길드 금고 배지 정합 capstone·bankFeedConsistent·배지==vault 크기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankfeedconsistent`.
//   더한 한 조각: bankFeedConsistent(guildSvc) = 전 길드 bankCountOf(id)==vault 크기 bankOf(id).length(고아 0). 순수 읽기(권위 0) → 0197 비트 동일(reg). 0188 멤버 배지 정합의 금고 판.
//   검증: ⒜ `reg`(키트) — 0197 비트 동일. ⒝ `guildbankfeedconsistent`(가설) — 정상·guild crash·feed crash 세 체제서 배지==vault.
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
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2']), GCREATE(3, 'g2', 'c4', ['c4', 'c6']),
  GDEPOSIT(4, 'g1', 'x', 'sword'), GDEPOSIT(5, 'g1', 'c1', 'shield'), GDEPOSIT(6, 'g1', 'c2', 'potion'),
  GDEPOSIT(7, 'g2', 'c4', 'ring'), GDEPOSIT(8, 'g2', 'c6', 'gem'),
  GWITHDRAW(10, 'g1', 'c2', 'sword'),   // g1 vault 2·g2 vault 2.
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, guildBankPublish: true, guildFeed: true, guildChangePublish: true, guildBankFeed: true, guildPersist: true, guildFeedPersist: true, guildOps: OPS };

function guildbankfeedconsistent(seeds) {
  console.log('== guildbankfeedconsistent: *capstone* — 금고 배지 정합 불변(bankFeedConsistent·배지==vault 크기). 예치/인출 × 정상·guild crash·feed crash 세 체제. 0188 멤버 배지 정합의 금고 판. ==');
  console.log('seed   | g1/g2 vault | A 정상 | B guild crash | C feed crash | 3체제 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const A = r.guildfeed.bankFeedConsistent(r.guild);             // A 정상.
    r.guild.crash(); r.guild.reconstruct();
    const B = r.guildfeed.bankFeedConsistent(r.guild);             // B guild crash→reconstruct(vault 재구성).
    r.guildfeed.crash(); r.guildfeed.reconstruct();
    const C = r.guildfeed.bankFeedConsistent(r.guild);             // C feed crash→reconstruct(배지 재구성).
    const g1v = r.guild.bankOf('g1').length, g2v = r.guild.bankOf('g2').length;
    const shapeOk = g1v === 2 && g2v === 2;
    const all3 = A && B && C && shapeOk;
    const ok = check(all3, `seed ${seed}: capstone 위반 (A${A} B${B} C${C}·g1v ${g1v}·g2v ${g2v})`);
    console.log(`${pad(seed, 6)} | ${pad(g1v + '/' + g2v, 11)} | ${pad(A ? '예' : '아니오', 6)} | ${pad(B ? '예' : '아니오', 13)} | ${pad(C ? '예' : '아니오', 12)} | ${pad(all3 ? '예(3/3)' : '아니오', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 금고 배지 정합 불변: 전 길드 bankCountOf(id) == vault 크기 bankOf(id).length(고아 0). 정상·guild crash→reconstruct(vault 저널 재구성)·feed crash→reconstruct(배지 저널 재구성) 세 체제 모두서 성립 → 금고 읽기 모델(CQRS)이 vault 권위 SSOT 와 결코 갈라지지 않음을 증명. 0188 멤버 수 배지 정합(feedConsistent)의 금고 판.');
}

kit.MODES['guildbankfeedconsistent'] = guildbankfeedconsistent;
kit.ORDER.splice(1, 0, 'guildbankfeedconsistent');

(async () => { process.exit(await kit.cli(process.argv)); })();
