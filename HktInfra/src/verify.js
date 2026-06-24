// HktInfra step-0191 — 헤드리스 검증 (길드 금고 deposit·guildBank·guildDeposit)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbank`.
//   더한 한 조각: GuildService 에 길드 금고(vault) deposit. guildDeposit{guildId,member,itemId} → 금고가 itemId 보유(중복 0·멱등). bank OFF·미주입이면 금고 0 → 0190 비트 동일(reg). 거래소 escrow 0117·우편 custody 0157 의 조직 공유 판.
//   검증: ⒜ `reg`(키트) — 0190 비트 동일. ⒝ `guildbank`(가설) — 멤버 예치 시 금고가 itemId 보유·비멤버/미존재 길드 graceful no-op·중복 멱등.
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
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true };
// 시나리오: 한 길드 결성·멤버 예치(중복·비멤버·미존재 길드 섞임).
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2']),
  GDEPOSIT(4, 'g1', 'x', 'sword'),       // master 예치(멤버) → 금고 보유.
  GDEPOSIT(5, 'g1', 'c1', 'shield'),     // 멤버 예치 → 금고 보유.
  GDEPOSIT(6, 'g1', 'x', 'sword'),       // 중복 예치 → 멱등 no-op(금고 불변).
  GDEPOSIT(7, 'g1', 'c9', 'gem'),        // 비멤버 예치 → graceful no-op(은닉).
  GDEPOSIT(8, 'g2', 'x', 'ring'),        // 미존재 길드 → graceful no-op.
];

function guildbank(seeds) {
  console.log('== guildbank: 길드 금고(vault) deposit — 멤버가 아이템을 길드 공유 원장에 예치. 비멤버·미존재 길드·중복은 graceful/멱등 no-op. 거래소 escrow 0117·우편 custody 0157 의 조직 공유 판. ==');
  console.log('seed   | deposits | g1 vault            | 멤버만·중복0 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 10, ...COMMON, guildOps: OPS });
    const vault = r.guild.bankOf('g1');
    const okShape = vault.length === 2 && vault.includes('sword') && vault.includes('shield')
      && new Set(vault).size === vault.length      // 중복 0(멱등).
      && r.guild.bankOf('g2').length === 0;        // 미존재 길드 예치 무시.
    const ok = check(okShape, `seed ${seed}: 금고 위반 (vault ${JSON.stringify(vault)})`);
    console.log(`${pad(seed, 6)} | ${pad(r.guild.deposits, 8)} | ${pad(JSON.stringify(vault), 19)} | ${pad(okShape ? '예' : '아니오', 11)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 길드 금고 = 길드의 공유 아이템 원장(권위 단일 소유·척추 ③). 예치는 멤버만(비멤버·미존재 길드 graceful no-op = 은닉·로스터 선결)·중복 멱등(집합 의미론·중복 0). 거래소 escrow custody 0117·우편 아이템 0157 의 *조직 공유* 판 — bank arc(0191~0200) 출발.');
}

kit.MODES['guildbank'] = guildbank;
kit.ORDER.splice(1, 0, 'guildbank');

(async () => { process.exit(await kit.cli(process.argv)); })();
