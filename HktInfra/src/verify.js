// HktInfra step-0197 — 헤드리스 검증 (길드 금고 배지 영속·late-join·guildFeedPersist 의 금고 배지 확장)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankfeedpersist`.
//   더한 한 조각: GuildFeed 가 svc.guild.bank.changed 도 durable 저널에 기록, crash(bankCounts 소실) 후 reconstruct 가 kind 분기 replay 로 금고 배지 재구성. guildFeedPersist OFF 면 0196 비트 동일(reg). 0187 멤버 배지 영속의 금고 판.
//   검증: ⒜ `reg`(키트) — 0196 비트 동일. ⒝ `guildbankfeedpersist`(가설) — crash→reconstruct 배지==pre·OFF 면 소실(빈 배지).
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
  GWITHDRAW(9, 'g1', 'c2', 'sword'),   // g1 배지 2·g2 배지 1.
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, guildBankPublish: true, guildFeed: true, guildChangePublish: true, guildBankFeed: true, guildOps: OPS };

function guildbankfeedpersist(seeds) {
  console.log('== guildbankfeedpersist: 금고 배지 영속·late-join — 금고 소비 op 저널 replay. crash(bankCounts 소실)→reconstruct==죽기 전. OFF 면 소실. 0187 멤버 배지 영속의 금고 판. ==');
  console.log('seed   | pre g1/g2 | post g1/g2 | OFF post | ON복원·OFF소실 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 11, ...BASE, guildFeedPersist: true });
    const preG1 = on.guildfeed.bankCountOf('g1'), preG2 = on.guildfeed.bankCountOf('g2');
    on.guildfeed.crash(); on.guildfeed.reconstruct();
    const postG1 = on.guildfeed.bankCountOf('g1'), postG2 = on.guildfeed.bankCountOf('g2');
    const off = run({ seed, ticks: 11, ...BASE, guildFeedPersist: false });
    off.guildfeed.crash(); off.guildfeed.reconstruct();
    const offPost = off.guildfeed.bankCountOf('g1');
    const okShape = preG1 === postG1 && preG2 === postG2 && postG1 === 2 && postG2 === 1 && offPost === 0;
    const ok = check(okShape, `seed ${seed}: 영속 위반 (pre ${preG1}/${preG2}·post ${postG1}/${postG2}·off ${offPost})`);
    console.log(`${pad(seed, 6)} | ${pad(preG1 + '/' + preG2, 9)} | ${pad(postG1 + '/' + postG2, 10)} | ${pad(offPost, 8)} | ${pad(okShape ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 금고 배지(bankCounts)는 휘발·금고 소비 op 저널은 durable. crash 로 배지가 소실돼도 fresh GuildFeed 가 저널을 replay(kind 로 멤버/금고 배지 분기)해 금고 배지를 재구성 → 죽기 전과 동일(g1 2·g2 1). guildFeedPersist OFF 면 저널 0·crash 후 빈 배지(소실). 0187 멤버 수 배지 영속의 금고 판.');
}

kit.MODES['guildbankfeedpersist'] = guildbankfeedpersist;
kit.ORDER.splice(1, 0, 'guildbankfeedpersist');

(async () => { process.exit(await kit.cli(process.argv)); })();
