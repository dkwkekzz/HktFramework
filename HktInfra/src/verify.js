// HktInfra step-0187 — 헤드리스 검증 (GuildFeed 영속·late-join·guildFeedPersist·op 저널 replay)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildfeedpersist`.
//   더한 한 조각: GuildFeed 가 소비한 svc.guild.changed 를 durable 저널에 기록·crash(투영 소실) 후 reconstruct(저널 replay)→배지 재구성. 우편 MailFeed 0154 의 길드 판. guildFeedPersist OFF 면 저널 0·빈 배지 = 0186 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildFeedPersist OFF = 0186 비트 동일. ⒝ `guildfeedpersist`(가설) — ON: crash→reconstruct 배지 == 죽기 전==로스터. OFF: reconstruct 빈 배지(소실).
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
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildChangePublish: true, guildFeed: true };
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1']), GCREATE(3, 'g2', 'c4', []),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g1', 'c3'), GLEAVE(7, 'g1', 'c1'), GJOIN(8, 'g2', 'c5'),
];
const badge = (gf) => fnv1a([...gf.counts.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([k, v]) => k + ':' + v).join('|'));

function guildfeedpersist(seeds) {
  console.log('== guildfeedpersist: 배지 영속·late-join. crash(투영 소실)→reconstruct(op 저널 replay)==죽기 전==로스터. OFF=소실. 우편 MailFeed 0154 의 길드 판. ==');
  console.log('seed   | pre badge | post(ON) | ON 동일 | 배지==로스터 | OFF 소실 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 12, ...COMMON, guildFeedPersist: true, guildOps: OPS });
    const pre = badge(on.guildfeed);
    on.guildfeed.crash(); const cleared = on.guildfeed.counts.size;
    on.guildfeed.reconstruct(); const post = badge(on.guildfeed);
    const matchRoster = [...on.guild.guilds.keys()].every(id => on.guildfeed.countOf(id) === on.guild.guilds.get(id).members.length);
    const onOk = cleared === 0 && post === pre && matchRoster;
    const off = run({ seed, ticks: 12, ...COMMON, guildFeedPersist: false, guildOps: OPS });
    off.guildfeed.crash(); off.guildfeed.reconstruct();
    const offLost = off.guildfeed.counts.size === 0;
    const ok =
      check(onOk, `seed ${seed}: ON reconstruct != 죽기 전/로스터 (pre ${pre.toString(16)}·post ${post.toString(16)})`) &&
      check(offLost, `seed ${seed}: OFF 인데 배지 살아남음(영속 휴면 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(pre.toString(16), 9)} | ${pad(post.toString(16), 8)} | ${pad(post === pre ? '예' : '아니오', 7)} | ${pad(matchRoster ? '예' : '아니오', 12)} | ${pad(offLost ? '예' : '아니오', 8)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 배지는 휘발 투영, 소비 op 저널은 durable. crash 가 투영만 날려도 fresh 박스가 저널을 replay 해 멤버 수 배지를 재구성(late-join·자기 영속 저널만으로). reconstruct 배지 == 죽기 전 == 로스터 SSOT 크기. guildFeedPersist OFF 면 저널 0 → reconstruct 빈 배지(0186 비트 동일·휴면). 우편 MailFeed 0154 의 길드 판.');
}

kit.MODES['guildfeedpersist'] = guildfeedpersist;
kit.ORDER.splice(1, 0, 'guildfeedpersist');

(async () => { process.exit(await kit.cli(process.argv)); })();
