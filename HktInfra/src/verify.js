// HktInfra step-0195 — 헤드리스 검증 (길드 금고 저널 스냅샷 압축·guildSnapshot 의 금고 확장)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildbanksnapshot`.
//   더한 한 조각: 스냅샷에 vault 도 포함·tail 만 보관. reconstruct 는 스냅샷(guilds+bank)+tail replay → 전체 저널 replay 와 비트 동일(무손실 압축). snapInterval 0 면 0194 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — 0194 비트 동일. ⒝ `guildbanksnapshot`(가설) — 압축 ON tail<full·reconstruct vault==무압축 reconstruct(무손실).
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
// 다수 금고 변경(create 1 + 예치 6 + 인출 2 = 9 저널 항) → snapInterval 로 압축 발화.
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1', 'c2', 'c3']),
  GDEPOSIT(3, 'g1', 'x', 'i1'), GDEPOSIT(4, 'g1', 'c1', 'i2'), GDEPOSIT(5, 'g1', 'c2', 'i3'),
  GDEPOSIT(6, 'g1', 'c3', 'i4'), GDEPOSIT(7, 'g1', 'x', 'i5'), GDEPOSIT(8, 'g1', 'c1', 'i6'),
  GWITHDRAW(9, 'g1', 'c2', 'i1'), GWITHDRAW(10, 'g1', 'c3', 'i3'),   // 최종 vault = [i2,i4,i5,i6].
];
const BASE = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildBank: true, guildPersist: true, guildOps: OPS };
const sig = v => JSON.stringify(v.slice().sort());

function guildbanksnapshot(seeds) {
  console.log('== guildbanksnapshot: 금고 저널 스냅샷 압축 — 스냅샷에 vault 포함·tail 만 보관. reconstruct(스냅샷+tail)==전체 저널 replay(무손실). snapInterval 0 면 0194 동일. 0185 로스터 압축의 금고 확장. ==');
  console.log('seed   | snaps | tail | full | reconstruct vault       | tail<full·무손실 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 12, ...BASE, guildSnapshot: 4 });
    const off = run({ seed, ticks: 12, ...BASE, guildSnapshot: 0 });
    const tail = on.guild.journal.length, full = off.guild.journal.length;
    on.guild.crash(); on.guild.reconstruct();
    off.guild.crash(); off.guild.reconstruct();
    const vOn = on.guild.bankOf('g1'), vOff = off.guild.bankOf('g1');
    const okShape = on.guild.snapshots > 0 && tail < full && sig(vOn) === sig(vOff) && vOn.length === 4;
    const ok = check(okShape, `seed ${seed}: 압축 위반 (snaps ${on.guild.snapshots}·tail ${tail}·full ${full}·vOn ${sig(vOn)}·vOff ${sig(vOff)})`);
    console.log(`${pad(seed, 6)} | ${pad(on.guild.snapshots, 5)} | ${pad(tail, 4)} | ${pad(full, 4)} | ${pad(sig(vOn), 23)} | ${pad(okShape ? '예' : '아니오', 16)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 금고 변경이 누적돼도 snapInterval 마다 vault projection 을 스냅샷에 굳히고 그 이하 저널을 가지치기 → 저널은 tail 만(유계). reconstruct 는 스냅샷의 guilds+bank 에서 출발해 tail 만 replay → 전체 저널 replay 와 비트 동일(무손실·vault [i2,i4,i5,i6]). 0185 로스터 스냅샷 압축의 금고 확장 — vault 도 같은 스냅샷·같은 tail replay.');
}

kit.MODES['guildbanksnapshot'] = guildbanksnapshot;
kit.ORDER.splice(1, 0, 'guildbanksnapshot');

(async () => { process.exit(await kit.cli(process.argv)); })();
