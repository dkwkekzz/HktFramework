// HktInfra step-0194 — 헤드리스 검증 (길드 금고 영속·failover·guildPersist 의 금고 확장)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbankpersist`.
//   더한 한 조각: 예치/인출을 변경 저널에 append, crash(vault 소실) 후 reconstruct 가 저널 replay 로 vault 재구성 → 비트 동일. guildPersist OFF 면 crash 후 빈 금고(소실) = 0193 비트 동일(reg). 0184 로스터 영속의 금고 확장.
//   검증: ⒜ `reg`(키트) — 0193 비트 동일. ⒝ `guildbankpersist`(가설) — crash→reconstruct vault==pre·OFF 면 소실(빈 금고).
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
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2']),
  GDEPOSIT(4, 'g1', 'x', 'sword'), GDEPOSIT(5, 'g1', 'c1', 'shield'), GDEPOSIT(6, 'g1', 'c2', 'potion'),
  GWITHDRAW(8, 'g1', 'c2', 'sword'),     // 인출 1 → 최종 vault [shield, potion].
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true };
const sig = v => JSON.stringify(v.slice().sort());

function guildbankpersist(seeds) {
  console.log('== guildbankpersist: 금고 영속·failover — 예치/인출 변경 저널 replay. crash(vault 소실)→reconstruct==죽기 전. OFF 면 소실(빈 금고). 0184 로스터 영속의 금고 확장. ==');
  console.log('seed   | pre vault           | post(reconstruct)   | OFF post | ON복원·OFF소실 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 10, ...BASE, guildPersist: true, guildOps: OPS });
    const pre = on.guild.bankOf('g1').slice();
    on.guild.crash(); on.guild.reconstruct();
    const post = on.guild.bankOf('g1');
    const off = run({ seed, ticks: 10, ...BASE, guildPersist: false, guildOps: OPS });
    off.guild.crash(); off.guild.reconstruct();
    const offPost = off.guild.bankOf('g1');
    const okShape = sig(pre) === sig(post) && pre.length === 2 && offPost.length === 0;   // ON 복원·OFF 소실.
    const ok = check(okShape, `seed ${seed}: 영속 위반 (pre ${sig(pre)}·post ${sig(post)}·off ${offPost.length})`);
    console.log(`${pad(seed, 6)} | ${pad(sig(pre), 19)} | ${pad(sig(post), 19)} | ${pad(offPost.length, 8)} | ${pad(okShape ? '예' : '아니오', 14)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 금고 vault 는 휘발(projection)·변경 저널은 durable. crash 로 vault 가 소실돼도 fresh 박스가 deposit/withdraw 저널을 seq 순 replay 해 금고를 재구성 → 죽기 전과 비트 동일(예치 3·인출 1 = vault [shield,potion]). guildPersist OFF 면 저널 0·crash 후 빈 금고(소실). 0184 로스터/마스터십 영속의 금고 확장 — 같은 저널·같은 replay 루프.');
}

kit.MODES['guildbankpersist'] = guildbankpersist;
kit.ORDER.splice(1, 0, 'guildbankpersist');

(async () => { process.exit(await kit.cli(process.argv)); })();
