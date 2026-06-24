// HktInfra step-0188 — 헤드리스 검증 (GuildFeed 회계 정합 capstone·feedConsistent·배지==로스터)
// 사용: node src/verify.js <mode> [seed]
//   mode 카탈로그: engine/verify-kit.js 헤더. 이 step 의 새 가설 = `guildconsistent`.
//   더한 한 조각: feedConsistent(guildSvc) = 전 길드 배지 countOf==로스터 크기 AND 고아 배지 0. 우편 MailFeed 0155 의 길드 판. 순수 읽기(권위 0) → 0187 비트 동일(reg).
//   검증: ⒜ `reg`(키트) — 0187 비트 동일. ⒝ `guildconsistent`(가설) — 정상·feed crash→reconstruct·guild crash→reconstruct·영속 네 체제서 feedConsistent true·배지 총합==로스터 총합.
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
const COMMON = { clients: 6, moves: 20, radius: 4, grid: 16, zones: 2, bus: true, guildService: true, guildChangePublish: true, guildFeed: true, guildPersist: true, guildFeedPersist: true };
const OPS = [
  GCREATE(2, 'g1', 'x', ['x', 'c1']), GCREATE(3, 'g2', 'c4', ['c4', 'c6']),
  GJOIN(5, 'g1', 'c2'), GJOIN(6, 'g1', 'c3'), GLEAVE(7, 'g1', 'c1'), GJOIN(8, 'g2', 'c5'), GLEAVE(9, 'g2', 'c6'),
];
const total = (gf) => gf.totalMembers();
const rosterTotal = (gs) => [...gs.guilds.values()].reduce((t, g) => t + g.members.length, 0);

function guildconsistent(seeds) {
  console.log('== guildconsistent: *capstone* — 배지 정합(feedConsistent). 전 길드 배지==로스터 크기·고아 0. 정상·feed crash·guild crash·영속 네 체제. 우편 MailFeed 0155 의 길드 판. ==');
  console.log('seed   | A 정상 | B feed crash | C guild crash | D 영속 | 배지총합==로스터 | 4체제 | 판정');
  for (const seed of seeds) {
    const r = run({ seed, ticks: 12, ...COMMON, guildOps: OPS });
    const a = r.guildfeed.feedConsistent(r.guild);                                  // A 정상.
    r.guildfeed.crash(); r.guildfeed.reconstruct();
    const b = r.guildfeed.feedConsistent(r.guild);                                  // B feed crash→reconstruct.
    r.guild.crash(); r.guild.reconstruct();
    const c = r.guildfeed.feedConsistent(r.guild);                                  // C guild crash→reconstruct (양쪽 복원 후도 정합).
    const totalsOk = total(r.guildfeed) === rosterTotal(r.guild);                   // D 배지 총합 == 로스터 총합(영속 후).
    const all4 = a && b && c && totalsOk;
    const ok = check(all4, `seed ${seed}: 어느 체제서 feedConsistent false (A${a} B${b} C${c} D${totalsOk})`);
    console.log(`${pad(seed, 6)} | ${pad(a ? '예' : '아니오', 6)} | ${pad(b ? '예' : '아니오', 12)} | ${pad(c ? '예' : '아니오', 13)} | ${pad(totalsOk ? '예' : '아니오', 6)} | ${pad(total(r.guildfeed) + '==' + rosterTotal(r.guild), 16)} | ${pad(all4 ? '예(4/4)' : '아니오', 7)} | ${ok ? 'OK' : 'FAIL'}`);
  }
  console.log('  → 배지 정합 불변: GuildFeed 배지 countOf(id) == GuildService 로스터 members.length(전 길드·고아 0). 정상·feed crash→reconstruct·guild crash→reconstruct·영속 *네 체제* 모두서 성립 → 읽기 모델(CQRS·파생)이 권위 SSOT 와 결코 갈라지지 않음을 증명(crash 가 양쪽을 따로 날려도 각자 자기 저널로 복원 후 재정합). 우편 MailFeed 0155 feedConsistent 의 길드 판 — GuildFeed arc(0186~0188)를 닫는다.');
}

kit.MODES['guildconsistent'] = guildconsistent;
kit.ORDER.splice(1, 0, 'guildconsistent');

(async () => { process.exit(await kit.cli(process.argv)); })();
