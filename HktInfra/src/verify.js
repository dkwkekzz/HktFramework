// HktInfra step-0196 — 헤드리스 검증 (길드 금고 아이템 수 배지·guildBankFeed·GuildFeed bankCount)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankfeed`.
//   더한 한 조각: GuildFeed 가 svc.guild.bank.changed 도 구독해 guildId 별 bankCount 배지(deposit +1·withdraw −1). vault SSOT 와 독립 파생 읽기 모델(CQRS·발신 0·권위 0). guildBankFeed OFF 면 미구독·배지 0 = 0195 비트 동일(reg). 0186 멤버 수 배지의 금고 판.
//   검증: ⒜ `reg`(키트) — 0195 비트 동일. ⒝ `guildbankfeed`(가설) — 배지 bankCount==vault 크기·OFF 면 배지 0.
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
  GDEPOSIT(7, 'g2', 'c4', 'ring'),
  GWITHDRAW(9, 'g1', 'c2', 'sword'),   // g1 최종 금고 2(shield,potion)·g2 1(ring).
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, guildBankPublish: true, guildFeed: true, guildChangePublish: true, guildOps: OPS };

function guildbankfeed(seeds) {
  console.log('== guildbankfeed: 금고 아이템 수 배지 — GuildFeed 가 svc.guild.bank.changed 구독(deposit +1·withdraw −1). vault SSOT 와 독립(CQRS·발신 0). OFF 면 배지 0. 0186 멤버 수 배지의 금고 판. ==');
  console.log('seed   | g1 배지/vault | g2 배지/vault | OFF 배지 | 배지==vault·OFF0 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 11, ...BASE, guildBankFeed: true });
    const off = run({ seed, ticks: 11, ...BASE, guildBankFeed: false });
    const g1b = on.guildfeed.bankCountOf('g1'), g1v = on.guild.bankOf('g1').length;
    const g2b = on.guildfeed.bankCountOf('g2'), g2v = on.guild.bankOf('g2').length;
    const offb = off.guildfeed.bankCountOf('g1');
    const okShape = g1b === g1v && g1b === 2 && g2b === g2v && g2b === 1 && offb === 0;
    const ok = check(okShape, `seed ${seed}: 배지 위반 (g1 ${g1b}/${g1v}·g2 ${g2b}/${g2v}·off ${offb})`);
    console.log(`${pad(seed, 6)} | ${pad(g1b + '/' + g1v, 13)} | ${pad(g2b + '/' + g2v, 13)} | ${pad(offb, 8)} | ${pad(okShape ? '예' : '아니오', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → GuildFeed 가 svc.guild.bank.changed 를 구독해 길드별 금고 아이템 수 배지를 유지(deposit +1·withdraw −1) → 배지==vault 크기(g1 2·g2 1). vault SSOT(GuildService)와 독립한 파생 읽기 모델(CQRS): 발신 0·권위 0(순수 관찰). guildBankFeed OFF 면 미구독·배지 0(0195 비트 동일). 0186 멤버 수 배지의 금고 판.');
}

kit.MODES['guildbankfeed'] = guildbankfeed;
kit.ORDER.splice(1, 0, 'guildbankfeed');

(async () => { process.exit(await kit.cli(process.argv)); })();
