// HktInfra step-0185 — 헤드리스 검증 (길드 저널 스냅샷 압축·guildSnapshot·snapshot+tail replay)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildsnap`.
//   더한 한 조각: snapInterval 개 변경마다 로스터 스냅샷+저널 가지치기(tail 유계). reconstruct 는 스냅샷+tail(seq>upToSeq) replay → 전체 저널 replay 와 비트 동일(무손실 압축). 파티 0086 의 길드 판. snapInterval 0 면 0184 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildSnapshot 0 = 0184 비트 동일. ⒝ `guildsnap`(가설) — tail < full·스냅샷+tail digest == 전체 저널 digest == 죽기 전·snapshots≥1.
'use strict';
const NET = require('./net-core.js');
const NETPREV = require('../baseline/net-core.js');
const makeVerifyKit = require('../engine/verify-kit.js');

const SEEDS = [42, 7, 1234, 99, 2026];
const DEATH = 40; const LEASE = 3; const RESTART_AT = 60; const SNAP_N = 6; const CHAT_SNAP_N = 5; const JLOSS = 0.3;
const kit = makeVerifyKit({ NET, NETPREV, SEEDS, DEATH, LEASE, RESTART_AT, SNAP_N, CHAT_SNAP_N, JLOSS });

const { run, fnv1a } = NET;
const { check, pad } = kit.helpers;

const GCREATE = (at, guildId, master, members) => ({ at, op: { type: 'guildCreate', guildId, master, members } });
const GJOIN = (at, guildId, member) => ({ at, op: { type: 'guildJoin', guildId, member } });
const GLEAVE = (at, guildId, member) => ({ at, op: { type: 'guildLeave', guildId, member } });
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildPersist: true };
// 변경 8건(create + 가입 5 + 탈퇴 2) — snapInterval 3 이면 압축 발화·tail 유계.
const OPS = [
  GCREATE(2, 'g1', 'x', ['x']),
  GJOIN(3, 'g1', 'c1'), GJOIN(4, 'g1', 'c2'), GJOIN(5, 'g1', 'c3'), GJOIN(6, 'g1', 'c4'), GJOIN(7, 'g1', 'c5'),
  GLEAVE(8, 'g1', 'c1'), GLEAVE(9, 'g1', 'c2'),
];
const digest = (g) => fnv1a([...g.guilds.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
  .map(([k, v]) => k + ':' + v.master + ':' + v.members.slice().sort().join(',')).join('|'));

function guildsnap(seeds) {
  console.log('== guildsnap: 저널 스냅샷 압축(snapshot+tail). tail<full·스냅샷+tail == 전체 저널 == 죽기 전(무손실). 파티 0086 의 길드 판. ==');
  console.log('seed   | full 저널 | snap tail | snapshots | snap digest | full digest | 동일 | 판정');
  for (const seed of seeds) {
    const full = run({ seed, ticks: 12, ...COMMON, guildSnapshot: 0, guildOps: OPS });   // 압축 0(0184)·무계 저널.
    const fullLen = full.guild.journal.length;
    const preFull = digest(full.guild); full.guild.crash(); full.guild.reconstruct(); const fullRe = digest(full.guild);
    const snap = run({ seed, ticks: 12, ...COMMON, guildSnapshot: 3, guildOps: OPS });   // 압축 ON·tail 유계.
    const tailLen = snap.guild.journal.length;
    const preSnap = digest(snap.guild); snap.guild.crash(); snap.guild.reconstruct(); const snapRe = digest(snap.guild);
    const ok =
      check(tailLen < fullLen, `seed ${seed}: tail(${tailLen}) < full(${fullLen}) 아님(압축 미발생)`) &&
      check(snap.guild.snapshots >= 1, `seed ${seed}: 스냅샷 0`) &&
      check(snapRe === preSnap && snapRe === fullRe && fullRe === preFull, `seed ${seed}: 스냅샷+tail != 전체 저널(무손실 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(fullLen, 9)} | ${pad(tailLen, 9)} | ${pad(snap.guild.snapshots, 9)} | ${pad(snapRe.toString(16), 11)} | ${pad(fullRe.toString(16), 11)} | ${pad(snapRe === fullRe ? '예' : '아니오', 4)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → snapInterval 개 변경마다 현재 로스터를 스냅샷(upToSeq 기록)하고 그 이하 저널 가지치기 → tail 유계(full 저널 대비 짧음). reconstruct 는 스냅샷에서 출발해 tail(seq>upToSeq)만 replay → 스냅샷+tail == 전체 저널 replay == 죽기 전(무손실 압축). snapInterval 0 면 압축 0(0184 비트 동일). 파티 0086 의 길드 판.');
}

kit.MODES['guildsnap'] = guildsnap;
kit.ORDER.splice(1, 0, 'guildsnap');

(async () => { process.exit(await kit.cli(process.argv)); })();
