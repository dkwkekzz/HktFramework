// HktInfra step-0186 — 헤드리스 검증 (길드 멤버 수 배지 읽기 모델·guildFeed·GuildFeed)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildfeed`.
//   더한 한 조각: GuildFeed = svc.guild.changed 구독 읽기 모델(create=로스터 크기·join +1·leave −1). 배지 == 로스터 SSOT 크기. 우편 MailFeed 0151 의 길드 판. guildFeed OFF 면 박스 0 = 0185 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — guildFeed OFF = 0185 비트 동일. ⒝ `guildfeed`(가설) — 배지 count == 로스터 크기(전 길드)·OFF 박스 0(비-침습).
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
const GLEAVE = (at, guildId, member) => ({ at, op: { type: 'guildLeave', guildId, member } });
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildChangePublish: true };
// g1: 결성[x,c1]·c2,c3 가입·c1 탈퇴 → 로스터 {x,c2,c3}=3. g2: 결성[c4]·c5 가입 → {c4,c5}=2.
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1']), GCREATE(3, 'g2', 'c4', []),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g1', 'c3'), GLEAVE(7, 'g1', 'c1'), GJOIN(8, 'g2', 'c5'),
];

function guildfeed(seeds) {
  console.log('== guildfeed: 멤버 수 배지 읽기 모델(GuildFeed·svc.guild.changed 구독). 배지 count == 로스터 SSOT 크기(전 길드). 우편 MailFeed 0151 의 길드 판. ==');
  console.log('seed   | g1 배지/로스터 | g2 배지/로스터 | total 배지 | OFF 박스 | 배지==로스터 | 판정');
  for (const seed of seeds) {
    const on = run({ seed, ticks: 12, ...COMMON, guildFeed: true, guildOps: OPS });
    const gf = on.guildfeed, gs = on.guild;
    const match = [...gs.guilds.keys()].every(id => gf.countOf(id) === gs.guilds.get(id).members.length);
    const g1ok = gf.countOf('g1') === 3 && gs.membersOf('g1').length === 3;
    const g2ok = gf.countOf('g2') === 2 && gs.membersOf('g2').length === 2;
    const totalOk = gf.totalMembers() === 5;
    const off = run({ seed, ticks: 12, ...COMMON, guildFeed: false, guildOps: OPS });
    const offBox = off.guildfeed === null;   // OFF 면 박스 0(비-침습).
    const ok =
      check(match && g1ok && g2ok && totalOk, `seed ${seed}: 배지 != 로스터 (g1 ${gf.countOf('g1')}·g2 ${gf.countOf('g2')})`) &&
      check(offBox, `seed ${seed}: OFF 인데 guildfeed 박스 존재(비-침습 위반)`);
    console.log(`${pad(seed, 6)} | ${pad(gf.countOf('g1') + '/' + gs.membersOf('g1').length, 14)} | ${pad(gf.countOf('g2') + '/' + gs.membersOf('g2').length, 14)} | ${pad(gf.totalMembers(), 10)} | ${pad(offBox ? '0' : '있음', 8)} | ${pad((match && totalOk) ? '예' : '아니오', 12)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → GuildFeed 는 svc.guild.changed 발행 스트림(create=로스터 크기·join +1·leave −1)을 구독해 guildId 별 멤버 수 배지를 유지한다 — 로스터 SSOT(GuildService)와 독립한 파생 읽기 모델(CQRS·발신 0·권위 0). 배지 == 로스터 크기(전 길드). guildFeed OFF 면 박스 0(0185 비트 동일·비-침습). 영속·late-join 은 0187, 정합 capstone 은 0188.');
}

kit.MODES['guildfeed'] = guildfeed;
kit.ORDER.splice(1, 0, 'guildfeed');

(async () => { process.exit(await kit.cli(process.argv)); })();
