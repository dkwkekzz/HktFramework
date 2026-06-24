// HktInfra step-0184 — 헤드리스 검증 (길드 영속·failover·guildPersist·변경 저널 replay)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildpersist`.
//   더한 한 조각: 로스터 변경(create/join/leave)을 durable 저널에 append·crash(projection 소실) 후 reconstruct(저널 seq replay)→죽기 전과 비트 동일. 파티 0085 의 길드 판. guildPersist OFF 면 저널 0·reconstruct 빈 로스터 = 0183 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildPersist OFF = 0183 비트 동일. ⒝ `guildpersist`(가설) — ON: crash→reconstruct digest == 죽기 전·single-master 보존. OFF: reconstruct 빈 로스터(소실).
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
const COMMON = { clients: 4, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true };
const OPS = [
  GCREATE(3, 'g1', 'x', ['x', 'c1']), GCREATE(4, 'g2', 'c3', ['c3']),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g2', 'c4'), GLEAVE(7, 'g1', 'c1'), GLEAVE(8, 'g1', 'x'),
];
// 로스터 다이제스트(guildId 정렬·master+멤버 정렬) — projection 동치 비교.
const digest = (g) => fnv1a([...g.guilds.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1)
  .map(([k, v]) => k + ':' + v.master + ':' + v.members.slice().sort().join(',')).join('|'));

function guildpersist(seeds) {
  console.log('== guildpersist: 영속·failover. crash(projection 소실)→reconstruct(변경 저널 seq replay) == 죽기 전 비트 동일·single-master 보존. OFF=소실. 파티 0085 의 길드 판. ==');
  console.log('seed   | pre digest | post(ON) | ON 동일 | OFF post | OFF 소실 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 12, ...COMMON, guildPersist: true, guildOps: OPS });
    const pre = digest(on.guild);
    on.guild.crash(); const crashed = on.guild.guilds.size;
    on.guild.reconstruct(); const post = digest(on.guild);
    const onOk = crashed === 0 && post === pre &&
      [...on.guild.guilds.values()].every(v => v.members.includes(v.master));
    const off = run({ seed, ticks: 12, ...COMMON, guildPersist: false, guildOps: OPS });
    off.guild.crash(); off.guild.reconstruct();
    const offLost = off.guild.guilds.size === 0;   // 저널 0 → reconstruct 빈 로스터(소실).
    const ok =
      check(onOk, `seed ${seed}: ON reconstruct != 죽기 전 (pre ${pre.toString(16)}·post ${post.toString(16)})`) &&
      check(offLost, `seed ${seed}: OFF 인데 로스터 살아남음(영속 휴면 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(pre.toString(16), 10)} | ${pad(post.toString(16), 8)} | ${pad(post === pre ? '예' : '아니오', 7)} | ${pad(off.guild.guilds.size, 8)} | ${pad(offLost ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 로스터는 휘발 projection, 변경 저널은 durable. crash 가 projection 만 날려도 fresh 박스가 저널을 seq 순 replay 해 로스터+마스터십을 비트 동일하게 복원(자기 영속 저널만으로·event sourcing). master 보호도 replay 에서 동일 적용 → single-master 보존. guildPersist OFF 면 저널 0 → reconstruct 빈 로스터(0183 비트 동일·휴면). 파티 0085 의 길드 판.');
}

kit.MODES['guildpersist'] = guildpersist;
kit.ORDER.splice(1, 0, 'guildpersist');

(async () => { process.exit(await kit.cli(process.argv)); })();
