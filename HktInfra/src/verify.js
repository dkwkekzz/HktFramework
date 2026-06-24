// HktInfra step-0192 — 헤드리스 검증 (길드 금고 withdraw·guildWithdraw)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildwithdraw`.
//   더한 한 조각: guildWithdraw{guildId,member,itemId} → 멤버가 길드 금고에서 아이템 인출(있을 때만·멱등). bank OFF·미주입이면 0191 비트 동일(reg). 거래소 buy 0118·우편 fetch 0158 의 길드 금고 판.
//   검증: ⒜ `reg`(키트) — 0191 비트 동일. ⒝ `guildwithdraw`(가설) — 예치 후 인출 시 금고에서 제거·없는/비멤버 인출 graceful no-op.
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
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true };
// 시나리오: 결성·예치 2개·인출(성사·없는 itemId·비멤버 섞임).
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2']),
  GDEPOSIT(4, 'g1', 'x', 'sword'), GDEPOSIT(5, 'g1', 'c1', 'shield'),
  GWITHDRAW(7, 'g1', 'c2', 'sword'),     // 멤버가 인출 → 금고에서 sword 제거.
  GWITHDRAW(8, 'g1', 'c1', 'gem'),       // 없는 itemId → 멱등 no-op.
  GWITHDRAW(9, 'g1', 'c9', 'shield'),    // 비멤버 인출 → graceful no-op(shield 잔류).
];

function guildwithdraw(seeds) {
  console.log('== guildwithdraw: 길드 금고 인출 — 멤버가 금고에서 아이템을 꺼냄(있을 때만·멱등). 없는 itemId·비멤버·미존재 길드 graceful no-op. 거래소 buy 0118·우편 fetch 0158 의 길드 금고 판. ==');
  console.log('seed   | dep/wd | g1 vault     | sword제거·shield잔류 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 11, ...COMMON, guildOps: OPS });
    const vault = r.guild.bankOf('g1');
    const okShape = vault.length === 1 && vault.includes('shield') && !vault.includes('sword');
    const ok = check(okShape, `seed ${seed}: 인출 위반 (vault ${JSON.stringify(vault)})`);
    console.log(`${pad(seed, 6)} | ${pad(r.guild.deposits + '/' + r.guild.withdraws, 6)} | ${pad(JSON.stringify(vault), 12)} | ${pad(okShape ? '예' : '아니오', 19)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 인출은 멤버만·금고에 실재하는 itemId 만 제거(없는/비멤버/미존재 길드는 멱등 graceful no-op). itemId 가 금고를 떠나며 권위 단일 소유 보존(이중쓰기 0). 거래소 buy leg 0118·우편 fetch 0158 의 길드 금고 판 — deposit(0191)+withdraw 로 금고 입출금 쌍 완성.');
}

kit.MODES['guildwithdraw'] = guildwithdraw;
kit.ORDER.splice(1, 0, 'guildwithdraw');

(async () => { process.exit(await kit.cli(process.argv)); })();
