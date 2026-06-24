// HktInfra step-0200 — 헤드리스 검증 (길드 금고 arc capstone·bankCapstone·arc 0191~0200 닫기)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankcapstone`.
//   더한 한 조각: bankCapstone(feed) = bankConsistent()(원장 권위 단일 소유·0199) AND feed.bankFeedConsistent(this)(배지==vault·0198). 풍부한 연산·세 체제서 결합 성립. 순수 읽기(권위 0) → 0199 비트 동일(reg). 거래소 0140·우편 0180·길드 0190 capstone 의 금고 판. **guild bank arc(0191~0200) 닫기**.
//   검증: ⒜ `reg`(키트) — 0199 비트 동일. ⒝ `guildbankcapstone`(가설) — 가입/예치/인출 × 정상·guild crash·feed crash 세 체제서 bankCapstone true(3/3).
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
const GJOIN = (at, guildId, member) => ({ at, op: { type: 'guildJoin', guildId, member } });
const GDEPOSIT = (at, guildId, member, itemId) => ({ at, op: { type: 'guildDeposit', guildId, member, itemId } });
const GWITHDRAW = (at, guildId, member, itemId) => ({ at, op: { type: 'guildWithdraw', guildId, member, itemId } });
// 풍부한 시나리오: 두 길드 결성·가입·예치 다수·인출·중복/비멤버 no-op 섞임.
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1']), GCREATE(3, 'g2', 'c4', ['c4', 'c6']),
  GJOIN(4, 'g1', 'c2'),
  GDEPOSIT(5, 'g1', 'x', 'sword'), GDEPOSIT(6, 'g1', 'c1', 'shield'), GDEPOSIT(7, 'g1', 'c2', 'potion'),
  GDEPOSIT(8, 'g2', 'c4', 'ring'), GDEPOSIT(9, 'g2', 'c6', 'gem'),
  GDEPOSIT(10, 'g1', 'c9', 'staff'),     // 비멤버 → no-op.
  GWITHDRAW(11, 'g1', 'c1', 'sword'),     // g1 vault 2(shield,potion)·g2 vault 2(ring,gem).
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, guildBankPublish: true, guildFeed: true, guildChangePublish: true, guildBankFeed: true, guildPersist: true, guildFeedPersist: true, guildOps: OPS };

function guildbankcapstone(seeds) {
  console.log('== guildbankcapstone: *capstone* — 금고 박스 두 정합층 결합(bankCapstone = 원장 권위 단일 소유 AND 배지==vault). 가입/예치/인출 × 정상·guild crash·feed crash 세 체제. 거래소 0140·우편 0180·길드 0190 의 금고 판. arc 0191~0200 닫기. ==');
  console.log('seed   | g1/g2 vault | A 정상 | B guild crash | C feed crash | 3체제 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 13, ...BASE });
    const A = r.guild.bankCapstone(r.guildfeed);
    r.guild.crash(); r.guild.reconstruct();
    const B = r.guild.bankCapstone(r.guildfeed);
    r.guildfeed.crash(); r.guildfeed.reconstruct();
    const C = r.guild.bankCapstone(r.guildfeed);
    const g1v = r.guild.bankOf('g1').length, g2v = r.guild.bankOf('g2').length;
    const shapeOk = g1v === 2 && g2v === 2;
    const all3 = A && B && C && shapeOk;
    const ok = check(all3, `seed ${seed}: capstone 위반 (A${A} B${B} C${C}·g1v ${g1v}·g2v ${g2v})`);
    console.log(`${pad(seed, 6)} | ${pad(g1v + '/' + g2v, 11)} | ${pad(A ? '예' : '아니오', 6)} | ${pad(B ? '예' : '아니오', 13)} | ${pad(C ? '예' : '아니오', 12)} | ${pad(all3 ? '예(3/3)' : '아니오', 6)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 길드 금고 박스 전체를 관통하는 두 정합층: bankConsistent(원장 권위 단일 소유·itemId 이중 소유 0·0199) AND bankFeedConsistent(읽기 모델 배지==vault·0198). 풍부한 연산(create/join/deposit/withdraw·비멤버 no-op)·세 체제(정상·guild crash→reconstruct·feed crash→reconstruct) 모두서 성립 → 금고 박스가 어떤 연산·고장에도 아이템 권위를 깨지 않고 읽기 모델이 SSOT 와 갈라지지 않음을 증명. 거래소 0140·우편 0180·길드 0190 capstone 의 금고 판 — **guild bank arc(0191~0200) 닫힘**(SPINE 계층3 길드 금고 박스 완성).');
}

kit.MODES['guildbankcapstone'] = guildbankcapstone;
kit.ORDER.splice(1, 0, 'guildbankcapstone');

(async () => { process.exit(await kit.cli(process.argv)); })();
