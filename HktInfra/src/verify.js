// HktInfra step-0199 — 헤드리스 검증 (길드 금고 원장 정합·bankConsistent·itemId 단일 길드 소유)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankconsistent`.
//   더한 한 조각: bankConsistent() = 어떤 itemId 도 두 길드 금고에 동시에 없고(교차 중복 0=이중 소유 0)·금고 내 중복 0. 순수 읽기(권위 0) → 0198 비트 동일(reg). rosterConsistent 0190 의 아이템 권위 판·거래소 escrow 0120·우편 0164 의 길드 금고 판.
//   검증: ⒜ `reg`(키트) — 0198 비트 동일. ⒝ `guildbankconsistent`(가설) — 정상·guild crash·feed crash 세 체제서 bankConsistent true.
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
  GDEPOSIT(4, 'g1', 'x', 'sword'), GDEPOSIT(5, 'g1', 'c1', 'shield'),
  GDEPOSIT(6, 'g2', 'c4', 'ring'), GDEPOSIT(7, 'g2', 'c6', 'gem'),
  GDEPOSIT(8, 'g1', 'c2', 'shield'),    // g1 내부 중복 시도 → 멱등(중복 0 유지).
  GWITHDRAW(10, 'g1', 'c1', 'sword'),   // g1 vault 1(shield)·g2 vault 2(ring,gem).
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, guildBankPublish: true, guildFeed: true, guildChangePublish: true, guildBankFeed: true, guildPersist: true, guildFeedPersist: true, guildOps: OPS };

function guildbankconsistent(seeds) {
  console.log('== guildbankconsistent: *capstone* — 금고 원장 권위 단일 소유(bankConsistent·itemId 단일 길드 소유·교차/내부 중복 0). 정상·guild crash·feed crash 세 체제. rosterConsistent 0190 의 아이템 권위 판. ==');
  console.log('seed   | g1/g2 vault | A 정상 | B guild crash | C feed crash | 3체제 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...BASE });
    const A = r.guild.bankConsistent();
    r.guild.crash(); r.guild.reconstruct();
    const B = r.guild.bankConsistent();
    r.guildfeed.crash(); r.guildfeed.reconstruct();
    const C = r.guild.bankConsistent();
    const g1v = r.guild.bankOf('g1').length, g2v = r.guild.bankOf('g2').length;
    const shapeOk = g1v === 1 && g2v === 2;
    const all3 = A && B && C && shapeOk;
    const ok = check(all3, `seed ${seed}: capstone 위반 (A${A} B${B} C${C}·g1v ${g1v}·g2v ${g2v})`);
    console.log(`${pad(seed, 6)} | ${pad(g1v + '/' + g2v, 11)} | ${pad(A ? '예' : '아니오', 6)} | ${pad(B ? '예' : '아니오', 13)} | ${pad(C ? '예' : '아니오', 12)} | ${pad(all3 ? '예(3/3)' : '아니오', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 금고 원장 권위 단일 소유 불변: 어떤 itemId 도 두 길드 금고에 동시에 있지 않고(교차 중복 0=이중 소유 0)·한 금고 내 중복 0. 정상·guild crash→reconstruct·feed crash→reconstruct 세 체제 모두서 성립 → 금고가 어떤 연산·고장에도 아이템 이중 소유를 만들지 않음. rosterConsistent(0190·master 권위)의 *아이템 권위* 판·거래소 escrow 보존 0120·우편 0164 의 길드 금고 판.');
}

kit.MODES['guildbankconsistent'] = guildbankconsistent;
kit.ORDER.splice(1, 0, 'guildbankconsistent');

(async () => { process.exit(await kit.cli(process.argv)); })();
